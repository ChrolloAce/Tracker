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
 * Delete Project API
 * Immediately deletes a project and all associated data:
 * - All tracked accounts
 * - All videos and snapshots
 * - All links and link clicks
 * - All campaigns and resources
 * - All creator profiles and payouts
 * - All tracking rules
 * - All thumbnails and assets in Storage
 * - Project document
 * - Updates organization counters
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

    const { orgId, projectId } = req.body;

    if (!orgId || !projectId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: orgId, projectId' 
      });
    }

    const startTime = Date.now();
    console.log(`🗑️ [IMMEDIATE] Starting project deletion: ${projectId}`);

    const projectRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId);

    // Verify project exists
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Project not found' 
      });
    }

    const projectData = projectDoc.data();
    console.log(`  📁 Project: ${projectData?.name}`);

    let deletionStats = {
      accounts: 0,
      videos: 0,
      snapshots: 0,
      thumbnails: 0,
      links: 0,
      linkClicks: 0,
      campaigns: 0,
      creators: 0,
      rules: 0
    };

    // Step 1: Delete all tracked accounts and their videos
    console.log(`  🔄 Step 1: Deleting tracked accounts...`);
    const accountsSnapshot = await projectRef.collection('trackedAccounts').get();
    console.log(`    Found ${accountsSnapshot.size} accounts`);

    for (const accountDoc of accountsSnapshot.docs) {
      const accountData = accountDoc.data();
      const accountId = accountDoc.id;

      // Delete all videos for this account
      const videosSnapshot = await projectRef
        .collection('videos')
        .where('trackedAccountId', '==', accountId)
        .get();

      for (let i = 0; i < videosSnapshot.docs.length; i += 500) {
        const batch = db.batch();
        const batchDocs = videosSnapshot.docs.slice(i, i + 500);

        for (const videoDoc of batchDocs) {
          const videoData = videoDoc.data();

          // Delete snapshots
          const snapshotsSnapshot = await videoDoc.ref.collection('snapshots').get();
          snapshotsSnapshot.docs.forEach(snapshotDoc => {
            batch.delete(snapshotDoc.ref);
            deletionStats.snapshots++;
          });

          // Delete thumbnail from Storage
          if (videoData.thumbnail && videoData.thumbnail.includes('firebasestorage')) {
            try {
              const thumbnailPath = `thumbnails/${videoData.platform}_${videoData.videoId}_thumb.jpg`;
              await storage.bucket().file(thumbnailPath).delete();
              deletionStats.thumbnails++;
            } catch (error) {
              // Thumbnail may not exist
            }
          }

          batch.delete(videoDoc.ref);
          deletionStats.videos++;
        }

        await batch.commit();
      }

      // Delete profile picture
      if (accountData.username && accountData.platform) {
        try {
          const profilePath = `profile-pictures/${accountData.platform}_${accountData.username}.jpg`;
          await storage.bucket().file(profilePath).delete();
        } catch (error) {
          // Profile picture may not exist
        }
      }

      // Delete account
      await accountDoc.ref.delete();
      deletionStats.accounts++;
    }

    // Step 2: Delete all links and clicks
    console.log(`  🔄 Step 2: Deleting links...`);
    const linksSnapshot = await projectRef.collection('links').get();
    console.log(`    Found ${linksSnapshot.size} links`);

    for (const linkDoc of linksSnapshot.docs) {
      // Delete clicks
      const clicksSnapshot = await linkDoc.ref.collection('clicks').get();
      for (const clickDoc of clicksSnapshot.docs) {
        await clickDoc.ref.delete();
        deletionStats.linkClicks++;
      }

      await linkDoc.ref.delete();
      deletionStats.links++;
    }

    // Step 3: Delete all campaigns
    console.log(`  🔄 Step 3: Deleting campaigns...`);
    const campaignsSnapshot = await projectRef.collection('campaigns').get();
    console.log(`    Found ${campaignsSnapshot.size} campaigns`);

    for (const campaignDoc of campaignsSnapshot.docs) {
      // Delete resources
      const resourcesSnapshot = await campaignDoc.ref.collection('resources').get();
      for (const resourceDoc of resourcesSnapshot.docs) {
        await resourceDoc.ref.delete();
      }

      // Delete video submissions
      const submissionsSnapshot = await campaignDoc.ref.collection('videoSubmissions').get();
      for (const submissionDoc of submissionsSnapshot.docs) {
        await submissionDoc.ref.delete();
      }

      await campaignDoc.ref.delete();
      deletionStats.campaigns++;
    }

    // Step 4: Delete all creator profiles and payouts
    console.log(`  🔄 Step 4: Deleting creators...`);
    const creatorsSnapshot = await projectRef.collection('creators').get();
    console.log(`    Found ${creatorsSnapshot.size} creators`);

    for (const creatorDoc of creatorsSnapshot.docs) {
      // Delete payouts
      const payoutsSnapshot = await creatorDoc.ref.collection('payouts').get();
      for (const payoutDoc of payoutsSnapshot.docs) {
        await payoutDoc.ref.delete();
      }

      await creatorDoc.ref.delete();
      deletionStats.creators++;
    }

    // Step 5: Delete tracking rules
    console.log(`  🔄 Step 5: Deleting tracking rules...`);
    const rulesSnapshot = await projectRef.collection('rules').get();
    for (const ruleDoc of rulesSnapshot.docs) {
      await ruleDoc.ref.delete();
      deletionStats.rules++;
    }

    // Step 6: Delete all other subcollections
    const subcollections = [
      'linkClicks',
      'userPreferences',
      'deletedVideos',
      'revenueIntegrations',
      'revenueTransactions',
      'revenueMetrics',
      'creatorLinks',
      'payoutStructures'
    ];

    for (const subcollection of subcollections) {
      const snapshot = await projectRef.collection(subcollection).get();
      if (snapshot.size > 0) {
        console.log(`    Deleting ${snapshot.size} documents from ${subcollection}`);
        for (const doc of snapshot.docs) {
          await doc.ref.delete();
        }
      }
    }

    // Step 7: Delete the project document
    await projectRef.delete();
    console.log(`  ✅ Deleted project document`);

    // Step 8: Update organization counters
    try {
      const orgRef = db.collection('organizations').doc(orgId);
      await orgRef.update({
        projectCount: FieldValue.increment(-1),
        updatedAt: Timestamp.now()
      });
      console.log(`  ✅ Updated organization counters`);
    } catch (error) {
      console.error(`  ⚠️ Failed to update org counters (non-critical):`, error);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Project deletion completed for ${projectId} in ${duration}s`);

    return res.status(200).json({
      success: true,
      message: `Project "${projectData?.name}" deleted successfully`,
      projectId,
      deleted: deletionStats,
      duration: parseFloat(duration)
    });

  } catch (error: any) {
    console.error(`❌ Failed to delete project:`, error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error',
      errorType: 'PROCESSING_ERROR'
    });
  }
}

