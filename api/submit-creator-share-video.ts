/**
 * Submit Video via Creator Share Link
 * POST /api/submit-creator-share-video
 *
 * Public endpoint for creators to submit a video from their personal share
 * page. Not Firebase-authenticated — the share token is the credential.
 *
 * Body:    { token, url }
 * Returns: { success, jobId } | { error }
 *
 * Gates applied, in order:
 *   1. Token must exist, not be revoked, and have acceptSubmissions !== false
 *   2. Per-token rate limits: 10/hour, 100/day (counters on the token doc)
 *   3. Org plan video-limit check (same as the authenticated path)
 *
 * The video is queued in syncQueue with assignedCreatorId set so the admin
 * dashboard can tell it came from the share link. A fire-and-forget ping is
 * sent to the queue-worker so it doesn't wait for the next cron.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeFirebase } from './_utils/firebase-admin.js';
import { JOB_PRIORITIES } from './_constants/priorities.js';
import { resolveTikTokUrl, isShortenedTikTokUrl } from './_utils/resolve-tiktok-url.js';
import { checkVideoLimit } from './_utils/video-limits.js';
import { getBaseUrl } from './_utils/base-url.js';

initializeFirebase();
const db = getFirestore();

// Per-token rate limits (see spec)
const MAX_PER_HOUR = 10;
const MAX_PER_DAY = 100;

// Typed error used inside the rate-limit transaction. The transaction body can
// only signal a policy rejection by throwing — this class lets the outer catch
// tell a rate-limit bounce apart from an unexpected Firestore failure.
class SubmitRateLimitError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'SubmitRateLimitError';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { token, url, crossPostGroupId } = req.body || {};
    console.log(`📩 [submit-creator-share-video] Received: url=${url}, crossPostGroupId=${crossPostGroupId || '(none)'}`);
    if (!token || !url) {
      return res.status(400).json({ error: 'token and url are required' });
    }
    // Optional shared id that the creator portal passes when batch-submitting the same
    // video across platforms. Must be a short identifier; ignored if malformed.
    const validCrossPostGroupId = (typeof crossPostGroupId === 'string' && /^[a-zA-Z0-9_-]{4,64}$/.test(crossPostGroupId))
      ? crossPostGroupId
      : undefined;
    if (crossPostGroupId && !validCrossPostGroupId) {
      console.warn(`⚠️ [submit-creator-share-video] crossPostGroupId failed validation: ${crossPostGroupId}`);
    }

    const shareRef = db.collection('creatorShareLinks').doc(token);
    const shareDoc = await shareRef.get();
    if (!shareDoc.exists) {
      return res.status(404).json({ error: 'Invalid share link' });
    }

    const share = shareDoc.data()!;
    if (share.revoked) {
      return res.status(410).json({ error: 'This share link has been revoked' });
    }
    if (share.acceptSubmissions === false) {
      return res.status(403).json({ error: 'Submissions are disabled for this share link' });
    }

    const { orgId, projectId, creatorId } = share;
    if (!orgId || !projectId || !creatorId) {
      return res.status(500).json({ error: 'Share link is missing required fields' });
    }

    // Basic URL sanity check
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url) || url.length > 500) {
      return res.status(400).json({ error: 'Invalid video URL' });
    }

    // ==================== RATE LIMITING (atomic) ====================
    // Run the read-check-increment inside a Firestore transaction so two
    // concurrent requests can't both see the same stale count and both slip
    // past the limit by one. Bucket strings are the "did we roll over" recipe:
    // if the doc's stored bucket doesn't match the current bucket, we reset
    // to 0 before counting this request.
    //
    // The share-validation reads above (exists / revoked / acceptSubmissions
    // / required fields) are fine outside the transaction — those aren't the
    // racy part. We re-fetch the share inside the transaction so the
    // check+write see a consistent view of the counter fields.
    const now = new Date();
    const hourBucket = now.toISOString().slice(0, 13); // e.g. "2026-04-12T01"
    const dayBucket = now.toISOString().slice(0, 10);  // e.g. "2026-04-12"

    try {
      await db.runTransaction(async (tx) => {
        const txDoc = await tx.get(shareRef);
        // Defensive: the share existed a moment ago; if it vanished (admin
        // deleted it mid-flight) we surface the right error rather than
        // silently incrementing a ghost doc.
        if (!txDoc.exists) {
          throw new SubmitRateLimitError(404, 'Invalid share link');
        }
        const txShare = txDoc.data()!;
        if (txShare.revoked) {
          throw new SubmitRateLimitError(410, 'This share link has been revoked');
        }
        if (txShare.acceptSubmissions === false) {
          throw new SubmitRateLimitError(403, 'Submissions are disabled for this share link');
        }

        const currentHour = txShare.submitCountHourBucket === hourBucket
          ? (txShare.submitCountHour || 0)
          : 0;
        const currentDay = txShare.submitCountDayBucket === dayBucket
          ? (txShare.submitCountToday || 0)
          : 0;

        if (currentHour >= MAX_PER_HOUR) {
          throw new SubmitRateLimitError(
            429,
            `Rate limit reached: ${MAX_PER_HOUR} submissions per hour. Try again later.`,
            3600,
          );
        }
        if (currentDay >= MAX_PER_DAY) {
          throw new SubmitRateLimitError(
            429,
            `Daily limit reached: ${MAX_PER_DAY} submissions per day. Try again tomorrow.`,
            86400,
          );
        }

        tx.update(shareRef, {
          submitCount: (txShare.submitCount || 0) + 1,
          submitCountHour: currentHour + 1,
          submitCountHourBucket: hourBucket,
          submitCountToday: currentDay + 1,
          submitCountDayBucket: dayBucket,
          lastSubmitAt: Timestamp.now(),
        });
      });
    } catch (rateErr: any) {
      if (rateErr instanceof SubmitRateLimitError) {
        const body: { error: string; retryAfter?: number } = { error: rateErr.message };
        if (rateErr.retryAfter !== undefined) body.retryAfter = rateErr.retryAfter;
        return res.status(rateErr.status).json(body);
      }
      throw rateErr;
    }

    // ==================== PLAN LIMIT CHECK ====================
    // External share creators count the same as regular creators against
    // the org's plan. We don't pass a userEmail so super-admin bypass
    // cannot be triggered through a share link.
    const videoLimit = await checkVideoLimit(orgId);
    if (!videoLimit.allowed) {
      return res.status(403).json({
        error: 'VIDEO_LIMIT_REACHED',
        message: `The organization has reached its video limit (${videoLimit.currentCount}/${videoLimit.limit}).`,
      });
    }

    // Resolve shortened TikTok URLs before entering the pipeline
    let resolvedUrl: string = url;
    if (isShortenedTikTokUrl(url)) {
      try {
        resolvedUrl = await resolveTikTokUrl(url);
      } catch {
        resolvedUrl = url;
      }
    }

    // ==================== QUEUE THE JOB ====================
    const jobRef = db.collection('syncQueue').doc();
    const jobPayload: Record<string, unknown> = {
      type: 'single_video',
      status: 'pending',
      orgId,
      projectId,
      videoUrl: resolvedUrl,
      // Audit trail — shows admins this came from a share link, not an auth session.
      // First 8 chars of the token are plenty for a debugging breadcrumb.
      addedBy: `creatorShare:${token.slice(0, 8)}`,
      userEmail: null,
      createdAt: Timestamp.now(),
      startedAt: null,
      completedAt: null,
      attempts: 0,
      maxAttempts: 3,
      priority: JOB_PRIORITIES.USER_INITIATED,
      error: null,
      userInitiated: true,
      assignedCreatorId: creatorId,
      sourceToken: token,
    };
    if (validCrossPostGroupId) {
      jobPayload.crossPostGroupId = validCrossPostGroupId;
    }
    await jobRef.set(jobPayload);
    console.log(`📦 [submit-creator-share-video] Queued syncQueue job ${jobRef.id} for ${resolvedUrl}${validCrossPostGroupId ? ` (cross-post group ${validCrossPostGroupId})` : ''}`);

    // Note: counters were already incremented atomically inside the rate-limit
    // transaction above. If the job creation fails between here and there the
    // counter is slightly over-counted, which fails closed (blocks sooner) —
    // better than the old post-queue increment, which could fail open if the
    // update itself errored after the job was already queued.

    // Fire-and-forget queue-worker nudge so the job starts processing
    // without waiting for the next cron tick. Failure here is non-critical
    // because the cron will pick up the pending job on its regular schedule.
    try {
      const baseUrl = getBaseUrl();
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret) {
        console.warn(`⚠️ [submit-creator-share-video] CRON_SECRET missing — queue-worker won't be nudged. Job ${jobRef.id} will sit until manually triggered. This is the most common cause of "no sync" in local dev.`);
      } else if (!baseUrl) {
        console.warn(`⚠️ [submit-creator-share-video] baseUrl unresolved — can't nudge queue-worker.`);
      } else {
        console.log(`🔔 [submit-creator-share-video] Nudging queue-worker at ${baseUrl}/api/queue-worker for job ${jobRef.id}`);
        fetch(`${baseUrl}/api/queue-worker`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cronSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trigger: 'creator_share_submit' }),
        }).catch(err => {
          console.warn('Queue worker nudge failed (non-critical):', err.message);
        });
      }
    } catch {
      // Non-critical
    }

    return res.status(200).json({
      success: true,
      jobId: jobRef.id,
      message: 'Video queued for processing',
    });
  } catch (err: any) {
    console.error('❌ submit-creator-share-video error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
