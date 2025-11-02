import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '', 'base64').toString('utf-8')
  );

  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'viewtrack-25d71.appspot.com'
  });
}

const db = getFirestore();

/**
 * Clean up videos with malformed placeholder thumbnail URLs
 * 
 * This fixes the ERR_NAME_NOT_RESOLVED error by removing bad placeholder URLs
 * 
 * Usage: POST /api/clean-placeholder-thumbnails
 * Body: { orgId: string, projectId: string, dryRun?: boolean }
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId, projectId, dryRun = true } = req.body;

  if (!orgId || !projectId) {
    return res.status(400).json({
      error: 'Missing required parameters',
      required: ['orgId', 'projectId'],
      usage: 'POST { "orgId": "xxx", "projectId": "yyy", "dryRun": false }'
    });
  }

  console.log(`🧹 ${dryRun ? '[DRY RUN] ' : ''}Cleaning placeholder thumbnails for org ${orgId}, project ${projectId}...`);

  try {
    // Get all videos with placeholder thumbnails
    const videosRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('videos');

    const snapshot = await videosRef.get();

    console.log(`📊 Scanning ${snapshot.size} total videos...`);

    let cleanedCount = 0;
    const videosToClean: any[] = [];

    // Identify videos with bad placeholder URLs
    for (const doc of snapshot.docs) {
      const video = doc.data();
      const thumbnail = video.thumbnail || '';

      // Check for malformed placeholder URLs (missing protocol or containing "placeholder")
      const isBadPlaceholder = 
        thumbnail.includes('placeholder') ||
        thumbnail.includes('640x360?text=') ||
        (thumbnail && !thumbnail.startsWith('http'));

      if (isBadPlaceholder) {
        videosToClean.push({
          id: doc.id,
          platform: video.platform,
          videoId: video.videoId,
          url: video.url,
          oldThumbnail: thumbnail,
          ref: doc.ref
        });
      }
    }

    console.log(`🔍 Found ${videosToClean.length} videos with bad placeholder thumbnails`);

    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        message: `Would clean ${videosToClean.length} videos. Set dryRun=false to apply changes.`,
        totalVideos: snapshot.size,
        videosToClean: videosToClean.length,
        samples: videosToClean.slice(0, 20).map(v => ({
          platform: v.platform,
          videoId: v.videoId,
          url: v.url,
          currentThumbnail: v.oldThumbnail
        })),
        note: 'Thumbnails will be set to empty string. Run the fix-tiktok-thumbnails script afterward to restore them.'
      });
    }

    // Clean up the bad URLs
    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (const video of videosToClean) {
      // Set thumbnail to empty string - the fix script will restore them properly
      batch.update(video.ref, {
        thumbnail: '',
        lastRefreshed: Timestamp.now(),
        cleanedAt: Timestamp.now()
      });

      batchCount++;
      cleanedCount++;

      // Commit batch if we reach the limit
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`   ✅ Committed batch of ${batchCount} updates`);
        batchCount = 0;
      }
    }

    // Commit remaining operations
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   ✅ Committed final batch of ${batchCount} updates`);
    }

    console.log(`✅ Cleanup complete: ${cleanedCount} videos cleaned`);

    return res.status(200).json({
      success: true,
      totalVideos: snapshot.size,
      cleanedCount,
      message: `Successfully cleaned ${cleanedCount} videos. Console errors should be gone.`,
      nextSteps: [
        'The console errors (ERR_NAME_NOT_RESOLVED) should now be fixed',
        'Videos now have empty thumbnails',
        'Run /api/fix-tiktok-thumbnails to restore thumbnails from TikTok API',
        'Or wait for the next cron refresh to automatically fix them'
      ]
    });

  } catch (error: any) {
    console.error('❌ Cleanup failed:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Cleanup failed',
      message: error.message
    });
  }
}

