import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin
if (!getApps().length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    };

    initializeApp({ 
      credential: cert(serviceAccount as any),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app'
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
  }
}

const db = getFirestore();
const storage = getStorage();

/**
 * Cron Job: Process pending deletions
 * Runs every 2 minutes to clean up videos and accounts marked for deletion
 * 
 * This handles all deletion operations in the background:
 * - Delete video documents
 * - Delete video snapshots
 * - Delete thumbnails from Storage
 * - Add to deletedVideos blacklist
 * - Delete tracked accounts
 * - Update usage counters
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ Unauthorized deletion processing request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  console.log('🗑️ Starting deletion processing...');

  try {
    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;

    // ==================== PROCESS VIDEO DELETIONS ====================
    
    const videoDeletionsRef = db.collectionGroup('pendingDeletions')
      .where('type', '==', 'video')
      .where('status', '==', 'pending')
      .limit(50); // Process 50 at a time
    
    const videoDeletionsSnapshot = await videoDeletionsRef.get();
    console.log(`📋 Found ${videoDeletionsSnapshot.size} pending video deletions`);

    for (const deletionDoc of videoDeletionsSnapshot.docs) {
      const deletion = deletionDoc.data();
      const { orgId, projectId, videoId, platformVideoId, platform, trackedAccountId } = deletion;
      
      try {
        console.log(`🗑️ Processing video deletion: ${videoId}`);
        
        // Mark as processing
        await deletionDoc.ref.update({
          status: 'processing',
          processingStartedAt: Timestamp.now()
        });

        // Step 1: Delete all snapshots
        let snapshotsDeleted = 0;
        try {
          const snapshotsRef = db
            .collection('organizations')
            .doc(orgId)
            .collection('projects')
            .doc(projectId)
            .collection('videos')
            .doc(videoId)
            .collection('snapshots');
          
          const snapshotsSnapshot = await snapshotsRef.get();
          
          if (!snapshotsSnapshot.empty) {
            const batch = db.batch();
            snapshotsSnapshot.docs.forEach(snapshotDoc => {
              batch.delete(snapshotDoc.ref);
            });
            await batch.commit();
            snapshotsDeleted = snapshotsSnapshot.size;
            console.log(`  ✅ Deleted ${snapshotsDeleted} snapshots`);
          }
        } catch (error) {
          console.error(`  ⚠️ Failed to delete snapshots (non-critical):`, error);
        }

        // Step 2: Delete thumbnail from Storage (silently handle 404s)
        try {
          const possibleFilenames = [
            `${platform}_${platformVideoId}_thumb.jpg`,
            `${platform}_${videoId}_thumb.jpg`,
            `${videoId}_thumb.jpg`,
            `${platformVideoId}_thumb.jpg`
          ];

          const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app';
          const bucket = storage.bucket(bucketName);
          
          for (const filename of possibleFilenames) {
            try {
              const file = bucket.file(`organizations/${orgId}/thumbnails/${filename}`);
              await file.delete();
              console.log(`  ✅ Deleted thumbnail: ${filename}`);
              break; // Stop after first successful deletion
            } catch (error: any) {
              if (error.code !== 404) {
                // Log non-404 errors
                console.error(`  ⚠️ Storage error for ${filename}:`, error.message);
              }
              // Silently ignore 404s - CDN URLs don't exist in Storage
            }
          }
        } catch (error) {
          console.log(`  ℹ️ Thumbnail cleanup handled (may not exist in Storage)`);
        }

        // Step 3: Add to deletedVideos blacklist
        try {
          if (platformVideoId && platform) {
            const deletedVideoRef = db
              .collection('organizations')
              .doc(orgId)
              .collection('projects')
              .doc(projectId)
              .collection('deletedVideos')
              .doc(platformVideoId);
            
            await deletedVideoRef.set({
              platformVideoId,
              platform,
              deletedAt: Timestamp.now(),
              deletedBy: deletion.deletedBy || 'system',
              originalVideoId: videoId,
              trackedAccountId: trackedAccountId || null,
              reason: 'manual_deletion'
            });
            console.log(`  ✅ Added to blacklist: ${platformVideoId}`);
          }
        } catch (error) {
          console.error(`  ⚠️ Failed to add to blacklist (non-critical):`, error);
        }

        // Step 4: Delete video document
        const videoRef = db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('videos')
          .doc(videoId);
        
        await videoRef.delete();
        console.log(`  ✅ Deleted video document: ${videoId}`);

        // Step 5: Update usage counters
        try {
          const usageRef = db
            .collection('organizations')
            .doc(orgId)
            .collection('billing')
            .doc('usage');
          
          const usageDoc = await usageRef.get();
          const usage = usageDoc.data();
          const currentVideos = usage?.trackedVideos || 0;
          
          await usageRef.update({
            trackedVideos: Math.max(0, currentVideos - 1),
            lastUpdated: Timestamp.now()
          });
          console.log(`  ✅ Updated usage counter`);
        } catch (error) {
          console.error(`  ⚠️ Failed to update usage (non-critical):`, error);
        }

        // Mark as completed and delete the deletion request
        await deletionDoc.ref.delete();
        console.log(`✅ Video deletion completed: ${videoId}`);
        totalSucceeded++;
        
      } catch (error: any) {
        console.error(`❌ Failed to process video deletion ${videoId}:`, error);
        
        // Update deletion status with error
        await deletionDoc.ref.update({
          status: 'failed',
          error: error.message || 'Unknown error',
          lastAttemptAt: Timestamp.now(),
          retryCount: (deletion.retryCount || 0) + 1
        });
        
        totalFailed++;
      }
      
      totalProcessed++;
    }

    // ==================== PROCESS ACCOUNT DELETIONS ====================
    
    const accountDeletionsRef = db.collectionGroup('pendingDeletions')
      .where('type', '==', 'account')
      .where('status', '==', 'pending')
      .limit(20); // Process 20 accounts at a time
    
    const accountDeletionsSnapshot = await accountDeletionsRef.get();
    console.log(`📋 Found ${accountDeletionsSnapshot.size} pending account deletions`);

    for (const deletionDoc of accountDeletionsSnapshot.docs) {
      const deletion = deletionDoc.data();
      const { orgId, projectId, accountId } = deletion;
      
      try {
        console.log(`🗑️ Processing account deletion: ${accountId}`);
        
        // Mark as processing
        await deletionDoc.ref.update({
          status: 'processing',
          processingStartedAt: Timestamp.now()
        });

        // Delete all videos for this account
        const videosRef = db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('videos')
          .where('trackedAccountId', '==', accountId);
        
        const videosSnapshot = await videosRef.get();
        const videoCount = videosSnapshot.size;
        
        console.log(`  📊 Deleting ${videoCount} videos for account...`);
        
        let batchesCommitted = 0;
        let videosDeleted = 0;
        let snapshotsDeleted = 0;
        let thumbnailsDeleted = 0;
        
        for (let i = 0; i < videosSnapshot.docs.length; i += 500) {
          const batch = db.batch();
          const batchDocs = videosSnapshot.docs.slice(i, i + 500);
          
          for (const videoDoc of batchDocs) {
            const videoData = videoDoc.data();
            
            // Delete snapshots
            try {
              const snapshotsSnapshot = await videoDoc.ref.collection('snapshots').get();
              snapshotsSnapshot.docs.forEach(snapshotDoc => {
                batch.delete(snapshotDoc.ref);
              });
              snapshotsDeleted += snapshotsSnapshot.size;
            } catch (error) {
              console.error(`    ⚠️ Snapshot deletion error:`, error);
            }
            
            // Delete thumbnail from Storage (silently)
            try {
              const possibleFilenames = [
                `${videoData.platform}_${videoData.videoId}_thumb.jpg`,
                `${videoData.platform}_${videoDoc.id}_thumb.jpg`,
                `${videoDoc.id}_thumb.jpg`,
                `${videoData.videoId}_thumb.jpg`
              ];

              const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app';
              const bucket = storage.bucket(bucketName);
              
              for (const filename of possibleFilenames) {
                try {
                  const file = bucket.file(`organizations/${orgId}/thumbnails/${filename}`);
                  await file.delete();
                  thumbnailsDeleted++;
                  break;
                } catch (error: any) {
                  // Silently ignore 404s
                }
              }
            } catch (error) {
              // Non-critical
            }
            
            // Delete video document
            batch.delete(videoDoc.ref);
            videosDeleted++;
          }
          
          await batch.commit();
          batchesCommitted++;
          console.log(`    ✅ Batch ${batchesCommitted} committed (${videosDeleted}/${videoCount} videos)`);
        }

        // Delete the account
        const accountRef = db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('trackedAccounts')
          .doc(accountId);
        
        await accountRef.delete();
        console.log(`  ✅ Deleted account: ${accountId}`);

        // Update usage counters
        try {
          const usageRef = db
            .collection('organizations')
            .doc(orgId)
            .collection('billing')
            .doc('usage');
          
          const usageDoc = await usageRef.get();
          const usage = usageDoc.data();
          const currentAccounts = usage?.trackedAccounts || 0;
          const currentVideos = usage?.trackedVideos || 0;
          
          await usageRef.update({
            trackedAccounts: Math.max(0, currentAccounts - 1),
            trackedVideos: Math.max(0, currentVideos - videoCount),
            lastUpdated: Timestamp.now()
          });
          console.log(`  ✅ Updated usage counters`);
        } catch (error) {
          console.error(`  ⚠️ Failed to update usage (non-critical):`, error);
        }

        // Mark as completed and delete the deletion request
        await deletionDoc.ref.delete();
        console.log(`✅ Account deletion completed: ${accountId} (${videoCount} videos, ${snapshotsDeleted} snapshots, ${thumbnailsDeleted} thumbnails)`);
        totalSucceeded++;
        
      } catch (error: any) {
        console.error(`❌ Failed to process account deletion ${accountId}:`, error);
        
        // Update deletion status with error
        await deletionDoc.ref.update({
          status: 'failed',
          error: error.message || 'Unknown error',
          lastAttemptAt: Timestamp.now(),
          retryCount: (deletion.retryCount || 0) + 1
        });
        
        totalFailed++;
      }
      
      totalProcessed++;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Deletion processing completed!');
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Total processed: ${totalProcessed}`);
    console.log(`✅ Succeeded: ${totalSucceeded}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log('='.repeat(60) + '\n');

    return res.status(200).json({
      success: true,
      duration: parseFloat(duration),
      stats: {
        totalProcessed,
        totalSucceeded,
        totalFailed
      }
    });

  } catch (error: any) {
    console.error('❌ Deletion processing error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

