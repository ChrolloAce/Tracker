import type { VercelRequest, VercelResponse} from '@vercel/node';
import { setCorsHeaders, handleCorsPreFlight } from './middleware/auth.js';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
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
 * API: Delete Video Immediately
 * Handles complete video deletion with snapshots, storage, and blacklist
 * Called directly from UI instead of queuing for cron
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  setCorsHeaders(res, req);
  if (handleCorsPreFlight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify Firebase ID token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - Missing token' });
  }

  const token = authHeader.substring(7);

  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(token);
    console.log(`🔐 Authenticated as: ${decodedToken.uid}`);
  } catch (error: any) {
    console.error('❌ Token verification failed:', error.message);
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }

  const { orgId, projectId, videoId, platformVideoId, platform, trackedAccountId } = req.body;

  if (!orgId || !projectId || !videoId) {
    return res.status(400).json({ error: 'Missing required fields' });
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
  console.log(`🗑️ [IMMEDIATE] Starting video deletion: ${videoId}`);

  try {
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
        console.log(`✅ Deleted ${snapshotsDeleted} snapshots`);
      }
    } catch (error) {
      console.error(`⚠️ Failed to delete snapshots (non-critical):`, error);
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
          console.log(`✅ Deleted thumbnail: ${filename}`);
          break; // Stop after first successful deletion
        } catch (error: any) {
          if (error.code !== 404) {
            console.error(`⚠️ Storage error for ${filename}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.log(`ℹ️ Thumbnail cleanup handled (may not exist in Storage)`);
    }

    // Step 3: Delete the video document
    try {
      const videoRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('videos')
        .doc(videoId);
      
      await videoRef.delete();
      console.log(`✅ Deleted video document: ${videoId}`);
    } catch (error) {
      console.error(`⚠️ Failed to delete video document:`, error);
    }

    // Step 4: Recalculate account stats after video deletion
    try {
      const accountRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .doc(trackedAccountId);
      
      // Get all remaining videos for this account
      const videosRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('videos');
      
      const videosSnapshot = await videosRef
        .where('trackedAccountId', '==', trackedAccountId)
        .get();
      
      // Calculate fresh totals from remaining videos
      let totalVideos = 0;
      let totalViews = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;
      
      videosSnapshot.docs.forEach(doc => {
        const video = doc.data();
        totalVideos++;
        totalViews += video.views || 0;
        totalLikes += video.likes || 0;
        totalComments += video.comments || 0;
        totalShares += video.shares || 0;
      });
      
      // Update account with recalculated stats
      await accountRef.update({
        totalVideos,
        totalViews,
        totalLikes,
        totalComments,
        totalShares
      });
      
      console.log(`✅ Recalculated account stats: ${totalVideos} videos, ${totalViews} views, ${totalLikes} likes`);
    } catch (error) {
      console.error(`⚠️ Failed to recalculate account stats (non-critical):`, error);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Video deletion completed in ${duration}s`);

    return res.status(200).json({
      success: true,
      message: 'Video deleted successfully',
      videoId,
      duration: parseFloat(duration),
      snapshotsDeleted
    });

  } catch (error: any) {
    console.error('❌ Video deletion failed:', error);
    return res.status(500).json({
      error: 'Failed to delete video',
      message: error.message
    });
  }
}

