/**
 * Cron: Refresh Creator Share Videos
 * Schedule: daily at 7 AM EST (12:00 UTC)
 *
 * Finds all videos that were manually added to creators via share links
 * or "Add Videos" (have assignedCreatorId set) and are NOT already covered
 * by a tracked account's normal refresh cycle. Queues each for a stats
 * re-fetch through the existing process-single-video pipeline.
 *
 * Entry point: non-revoked creatorShareLinks docs. This avoids scanning
 * every org — only orgs with active share links are touched.
 *
 * Security: requires CRON_SECRET in Authorization header (Vercel cron
 * sends this automatically).
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeFirebase } from './_utils/firebase-admin.js';
import { JOB_PRIORITIES } from './_constants/priorities.js';

initializeFirebase();
const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth: only Vercel cron or manual trigger with CRON_SECRET
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('🔄 [CREATOR-VIDEO-REFRESH] Starting daily creator video refresh...');
  const startTime = Date.now();

  try {
    // Step 1: Find all active (non-revoked) creator share links
    const shareLinksSnap = await db.collection('creatorShareLinks')
      .where('revoked', '==', false)
      .get();

    if (shareLinksSnap.empty) {
      console.log('ℹ️ [CREATOR-VIDEO-REFRESH] No active share links found. Nothing to refresh.');
      return res.status(200).json({ success: true, message: 'No active share links', refreshed: 0 });
    }

    console.log(`📋 [CREATOR-VIDEO-REFRESH] Found ${shareLinksSnap.size} active share link(s)`);

    // Step 2: Group by (orgId, projectId, creatorId) to avoid duplicate work
    const creatorKeys = new Map<string, { orgId: string; projectId: string; creatorId: string }>();
    for (const doc of shareLinksSnap.docs) {
      const { orgId, projectId, creatorId } = doc.data();
      if (!orgId || !projectId || !creatorId) continue;
      const key = `${orgId}/${projectId}/${creatorId}`;
      if (!creatorKeys.has(key)) {
        creatorKeys.set(key, { orgId, projectId, creatorId });
      }
    }

    console.log(`👥 [CREATOR-VIDEO-REFRESH] ${creatorKeys.size} unique creator(s) to check`);

    let totalQueued = 0;
    let totalSkipped = 0;

    // Step 3: For each creator, find their standalone videos (not covered by tracked accounts)
    for (const [key, { orgId, projectId, creatorId }] of creatorKeys) {
      try {
        const projectRef = db
          .collection('organizations').doc(orgId)
          .collection('projects').doc(projectId);

        // Get videos assigned to this creator
        const videosSnap = await projectRef.collection('videos')
          .where('assignedCreatorId', '==', creatorId)
          .get();

        if (videosSnap.empty) continue;

        // Get this creator's linked account IDs so we can skip videos
        // that are already covered by the normal account-refresh cron.
        const linksSnap = await projectRef.collection('creatorLinks')
          .where('creatorId', '==', creatorId)
          .get();
        const linkedAccountIds = new Set(
          linksSnap.docs.map(d => d.data().accountId).filter(Boolean)
        );

        // Queue refresh for each standalone video (not covered by a tracked account)
        const batch = db.batch();
        let batchCount = 0;

        for (const videoDoc of videosSnap.docs) {
          const video = videoDoc.data();
          const videoUrl = video.url || video.videoUrl;

          // Skip if no URL to refresh
          if (!videoUrl) continue;

          // Skip frozen (stale) videos — no refresh needed
          if (video.isStale === true) {
            totalSkipped++;
            continue;
          }

          // Skip if this video belongs to a tracked account (the normal cron handles it)
          if (video.trackedAccountId && linkedAccountIds.has(video.trackedAccountId)) {
            totalSkipped++;
            continue;
          }

          // Queue a refresh job through the existing pipeline
          const jobRef = db.collection('syncQueue').doc();
          batch.set(jobRef, {
            type: 'single_video',
            status: 'pending',
            orgId,
            projectId,
            videoUrl,
            addedBy: 'cron:creator-video-refresh',
            userEmail: null,
            createdAt: Timestamp.now(),
            startedAt: null,
            completedAt: null,
            attempts: 0,
            maxAttempts: 3,
            priority: JOB_PRIORITIES.SCHEDULED || 50,
            error: null,
            userInitiated: false,
            assignedCreatorId: creatorId,
            isRefresh: true,
          });

          batchCount++;
          totalQueued++;

          // Firestore batch limit is 500 writes
          if (batchCount >= 400) {
            await batch.commit();
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }

        if (batchCount > 0 || totalSkipped > 0) {
          console.log(`  📹 ${key}: queued ${batchCount} refresh(es), skipped ${totalSkipped} (covered by tracked accounts)`);
        }
      } catch (err: any) {
        console.error(`  ❌ ${key}: failed — ${err.message}`);
        // Continue with other creators
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ [CREATOR-VIDEO-REFRESH] Done in ${elapsed}s. Queued: ${totalQueued}, Skipped: ${totalSkipped}`);

    // Nudge the queue-worker so jobs start processing without waiting for the next minute-cron
    try {
      const baseUrl = process.env.VERCEL_ENV === 'production'
        ? 'https://www.viewtrack.app'
        : process.env.VERCEL_URL
          ? (process.env.VERCEL_URL.includes('localhost') ? `http://${process.env.VERCEL_URL}` : `https://${process.env.VERCEL_URL}`)
          : 'http://localhost:3001';

      if (cronSecret) {
        fetch(`${baseUrl}/api/queue-worker`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cronSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trigger: 'creator_video_refresh_cron' }),
        }).catch(() => { /* non-critical */ });
      }
    } catch { /* non-critical */ }

    return res.status(200).json({
      success: true,
      activeShareLinks: shareLinksSnap.size,
      uniqueCreators: creatorKeys.size,
      videosQueued: totalQueued,
      videosSkipped: totalSkipped,
      elapsedSeconds: parseFloat(elapsed),
    });
  } catch (err: any) {
    console.error('❌ [CREATOR-VIDEO-REFRESH] Fatal error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
