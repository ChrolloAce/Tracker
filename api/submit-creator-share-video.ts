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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { token, url } = req.body || {};
    if (!token || !url) {
      return res.status(400).json({ error: 'token and url are required' });
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

    // ==================== RATE LIMITING ====================
    // Bucket strings are the recipe for "did we roll over". If the doc's
    // stored bucket doesn't match the current bucket, we reset to 0 before
    // counting this request.
    const now = new Date();
    const hourBucket = now.toISOString().slice(0, 13); // e.g. "2026-04-12T01"
    const dayBucket = now.toISOString().slice(0, 10);  // e.g. "2026-04-12"

    const currentHour = share.submitCountHourBucket === hourBucket ? (share.submitCountHour || 0) : 0;
    const currentDay = share.submitCountDayBucket === dayBucket ? (share.submitCountToday || 0) : 0;

    if (currentHour >= MAX_PER_HOUR) {
      return res.status(429).json({
        error: `Rate limit reached: ${MAX_PER_HOUR} submissions per hour. Try again later.`,
        retryAfter: 3600,
      });
    }
    if (currentDay >= MAX_PER_DAY) {
      return res.status(429).json({
        error: `Daily limit reached: ${MAX_PER_DAY} submissions per day. Try again tomorrow.`,
        retryAfter: 86400,
      });
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
    await jobRef.set({
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
    });

    // Update counters atomically-enough. This is a single-writer hot path per
    // token; a full transaction would be overkill given the per-token limits.
    await shareRef.update({
      submitCount: (share.submitCount || 0) + 1,
      submitCountHour: currentHour + 1,
      submitCountHourBucket: hourBucket,
      submitCountToday: currentDay + 1,
      submitCountDayBucket: dayBucket,
      lastSubmitAt: Timestamp.now(),
    });

    // Fire-and-forget queue-worker nudge so the job starts processing
    // without waiting for the next cron tick. Failure here is non-critical
    // because the cron will pick up the pending job on its regular schedule.
    try {
      const baseUrl = getBaseUrl();
      const cronSecret = process.env.CRON_SECRET;
      if (baseUrl && cronSecret) {
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
