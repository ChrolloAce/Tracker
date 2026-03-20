import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
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
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
  }
}

const db = getFirestore();
const storage = getStorage();

/**
 * Delete Account API
 * Immediately deletes a tracked account and all associated data:
 * - All videos for this account
 * - All snapshots for those videos
 * - All thumbnails in Storage
 * - Profile picture in Storage
 * - Account document
 * - Updates usage counters
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Check Firebase initialization
  if (!getApps().length) {
    console.error('❌ Firebase not initialized');
    return res.status(500).json({ 
      success: false, 
      error: 'Server configuration error',
      errorType: 'FIREBASE_NOT_INITIALIZED'
    });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized - Missing token' });
    }

    const token = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
      console.log(`🔐 Authenticated as: ${decodedToken.uid}`);
    } catch (error) {
      console.error('❌ Token verification failed:', error);
      return res.status(401).json({ success: false, message: 'Unauthorized - Invalid token' });
    }

    const { orgId, projectId, accountId, username, platform } = req.body;

    if (!orgId || !projectId || !accountId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: orgId, projectId, accountId'
      });
    }

    // Verify user is a member of the organization
    const membershipSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('members')
      .where('userId', '==', decodedToken.uid)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (membershipSnapshot.empty) {
      console.error(`❌ Access denied: User ${decodedToken.uid} is not a member of org ${orgId}`);
      return res.status(403).json({ success: false, message: 'Access denied - you are not a member of this organization' });
    }

    const startTime = Date.now();
    console.log(`🗑️ [IMMEDIATE] Starting account deletion: ${accountId} (@${username})`);

    // Step 1: Delete all videos for this account (in batches of 500)
    let videosDeleted = 0;
    let snapshotsDeleted = 0;
    let thumbnailsDeleted = 0;

    const videosRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('videos')
      .where('trackedAccountId', '==', accountId);

    const videosSnapshot = await videosRef.get();
    console.log(`  📹 Found ${videosSnapshot.size} videos to delete`);

    // Process videos in batches
    for (let i = 0; i < videosSnapshot.docs.length; i += 500) {
      const batch = db.batch();
      const batchDocs = videosSnapshot.docs.slice(i, i + 500);

      for (const videoDoc of batchDocs) {
        const videoData = videoDoc.data();
        const videoId = videoDoc.id;
        const platformVideoId = videoData.videoId;

        // Delete all snapshots for this video
        const snapshotsSnapshot = await videoDoc.ref.collection('snapshots').get();
        snapshotsSnapshot.docs.forEach(snapshotDoc => {
          batch.delete(snapshotDoc.ref);
          snapshotsDeleted++;
        });

        // Delete thumbnail from Storage
        if (videoData.thumbnail && videoData.thumbnail.includes('firebasestorage')) {
          try {
            const thumbnailPath = `thumbnails/${platform}_${platformVideoId}_thumb.jpg`;
            const bucket = storage.bucket();
            const file = bucket.file(thumbnailPath);
            await file.delete();
            thumbnailsDeleted++;
            console.log(`    🗑️ Deleted thumbnail: ${thumbnailPath}`);
          } catch (storageError) {
            console.log(`    ℹ️ Thumbnail cleanup handled (may not exist in Storage)`);
          }
        }

        // Delete video document
        batch.delete(videoDoc.ref);
        videosDeleted++;
      }

      await batch.commit();
      console.log(`    ✅ Batch ${Math.floor(i / 500) + 1} committed (${videosDeleted}/${videosSnapshot.size} videos)`);
    }

    console.log(`  ✅ Deleted ${videosDeleted} videos, ${snapshotsDeleted} snapshots, ${thumbnailsDeleted} thumbnails`);

    // Step 2: Delete profile picture from Storage
    try {
      const profilePicPath = `profile-pictures/${platform}_${username}.jpg`;
      const bucket = storage.bucket();
      const profileFile = bucket.file(profilePicPath);
      await profileFile.delete();
      console.log(`  ✅ Deleted profile picture: ${profilePicPath}`);
    } catch (error) {
      console.log(`  ℹ️ Profile picture cleanup handled (may not exist)`);
    }

    // Step 3: Delete the account document
    const accountRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('trackedAccounts')
      .doc(accountId);

    await accountRef.delete();
    console.log(`  ✅ Deleted account document: ${accountId}`);

    // Step 4: Cancel any running/pending jobs for this account in the queue
    let jobsCancelled = 0;
    try {
      console.log(`  🛑 Checking for active jobs to cancel...`);
      
      // Find all pending or running jobs for this account
      const jobsSnapshot = await db.collection('syncQueue')
        .where('accountId', '==', accountId)
        .where('status', 'in', ['pending', 'running'])
        .get();
      
      if (!jobsSnapshot.empty) {
        console.log(`    📋 Found ${jobsSnapshot.size} job(s) to cancel`);
        
        const batch = db.batch();
        
        for (const jobDoc of jobsSnapshot.docs) {
          const jobData = jobDoc.data();
          console.log(`      ❌ Cancelling job ${jobDoc.id} (${jobData.status}) for @${jobData.accountUsername}`);
          
          // Delete the job from queue (will prevent further processing)
          batch.delete(jobDoc.ref);
          jobsCancelled++;
        }
        
        await batch.commit();
        console.log(`    ✅ Cancelled and deleted ${jobsCancelled} job(s) from queue`);
      } else {
        console.log(`    ℹ️  No active jobs found for this account`);
      }
    } catch (jobError: any) {
      console.error(`    ⚠️  Failed to cancel jobs (non-critical):`, jobError.message);
      // Don't fail the whole deletion if job cancellation fails
    }

    // Step 5: Update project counters
    try {
      const projectRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId);

      await projectRef.update({
        trackedAccountCount: FieldValue.increment(-1),
        videoCount: FieldValue.increment(-videosDeleted),
        updatedAt: Timestamp.now()
      });
      console.log(`  ✅ Updated project counters`);
    } catch (error) {
      console.error(`  ⚠️ Failed to update project counters (non-critical):`, error);
    }

    // Step 5: Update organization usage counters
    try {
      const usageRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('billing')
        .doc('usage');

      const usageDoc = await usageRef.get();
      if (usageDoc.exists) {
        const usage = usageDoc.data();
        const currentAccounts = usage?.trackedAccounts || 0;
        const currentVideos = usage?.trackedVideos || 0;

        await usageRef.update({
          trackedAccounts: Math.max(0, currentAccounts - 1),
          trackedVideos: Math.max(0, currentVideos - videosDeleted),
          lastUpdated: Timestamp.now()
        });
        console.log(`  ✅ Updated organization usage counters`);
      }
    } catch (error) {
      console.error(`  ⚠️ Failed to update usage counters (non-critical):`, error);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Account deletion completed for ${accountId} in ${duration}s`);
    console.log(`   📊 Stats: ${videosDeleted} videos, ${snapshotsDeleted} snapshots, ${thumbnailsDeleted} thumbnails, ${jobsCancelled} jobs cancelled`);

    return res.status(200).json({
      success: true,
      message: `Account @${username} deleted successfully${jobsCancelled > 0 ? ` (${jobsCancelled} active job(s) cancelled)` : ''}`,
      accountId,
      videosDeleted,
      snapshotsDeleted,
      thumbnailsDeleted,
      jobsCancelled,
      duration: parseFloat(duration)
    });

  } catch (error: any) {
    console.error(`❌ Failed to delete account:`, error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error',
      errorType: 'PROCESSING_ERROR'
    });
  }
}

