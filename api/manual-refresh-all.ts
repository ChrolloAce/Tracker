import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
    );
    
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const db = getFirestore();

/**
 * Manual Refresh All Videos
 * Creates new snapshots for all videos in a project with current metrics
 * 
 * This is a temporary endpoint for manual data refresh
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId, projectId, userId } = req.body;

  if (!orgId || !projectId || !userId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  console.log('🔄 Manual refresh triggered for:', { orgId, projectId, userId });
  const startTime = Date.now();

  try {
    // Get all videos for this project
    const videosSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('videos')
      .get();

    console.log(`📊 Found ${videosSnapshot.size} videos to refresh`);

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ videoId: string; error: string }> = [];

    // Process each video
    for (const videoDoc of videosSnapshot.docs) {
      const videoId = videoDoc.id;
      const videoData = videoDoc.data();

      try {
        // Create a snapshot with current metrics
        const snapshotRef = db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('videos')
          .doc(videoId)
          .collection('snapshots')
          .doc();

        const snapshotData = {
          id: snapshotRef.id,
          videoId: videoId,
          views: videoData.views || 0,
          likes: videoData.likes || 0,
          comments: videoData.comments || 0,
          shares: videoData.shares || 0,
          capturedAt: Timestamp.now(),
          capturedBy: userId
        };

        // Save snapshot
        await snapshotRef.set(snapshotData);

        // Update video's lastRefreshed timestamp
        await videoDoc.ref.update({
          lastRefreshed: Timestamp.now()
        });

        successCount++;
        console.log(`✅ Created snapshot for video ${videoId}`);

      } catch (error: any) {
        errorCount++;
        errors.push({
          videoId,
          error: error.message
        });
        console.error(`❌ Failed to create snapshot for video ${videoId}:`, error.message);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    const summary = {
      success: true,
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
      stats: {
        totalVideos: videosSnapshot.size,
        successCount,
        errorCount
      },
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Manual refresh completed!');
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Total videos: ${videosSnapshot.size}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log('='.repeat(60) + '\n');

    return res.status(200).json(summary);

  } catch (error: any) {
    console.error('❌ Manual refresh failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

