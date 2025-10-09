import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
 * Cron Job: Refresh all videos for all tracked accounts
 * Runs every 12 hours (scheduled) or can be triggered manually by authenticated users
 * 
 * Security: 
 * - Cron jobs: Requires CRON_SECRET in Authorization header
 * - Manual triggers: Accepts authenticated user requests (no CRON_SECRET needed)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  // Allow requests with valid CRON_SECRET OR from authenticated users
  const isCronJob = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isManualTrigger = req.body?.manual === true; // Manual trigger from authenticated user
  
  if (!isCronJob && !isManualTrigger) {
    console.warn('⚠️ Unauthorized refresh attempt');
    return res.status(401).json({ 
      success: false,
      error: 'Unauthorized: Must be a scheduled cron job or manual trigger' 
    });
  }

  const triggerType = isCronJob ? 'Scheduled Cron Job' : 'Manual Trigger';
  console.log(`🚀 Starting automated video refresh (${triggerType})...`);
  const startTime = Date.now();

  try {
    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`📊 Found ${orgsSnapshot.size} organizations`);

    let totalAccountsProcessed = 0;
    let totalVideosRefreshed = 0;
    let failedAccounts: Array<{ org: string; project: string; account: string; error: string }> = [];

    // Process each organization
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      console.log(`\n📁 Processing organization: ${orgId}`);

      // Get all projects for this org
      const projectsSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .get();

      console.log(`  📂 Found ${projectsSnapshot.size} projects`);

      // Process each project
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        const projectData = projectDoc.data();
        console.log(`\n  📦 Processing project: ${projectData.name || projectId}`);

        // Get all tracked accounts for this project
        const accountsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('trackedAccounts')
          .where('isActive', '==', true)
          .get();

        console.log(`    👥 Found ${accountsSnapshot.size} active accounts`);

        // Process each account
        for (const accountDoc of accountsSnapshot.docs) {
          const accountId = accountDoc.id;
          const accountData = accountDoc.data();
          const username = accountData.username;
          const platform = accountData.platform;

          console.log(`\n    🔄 Refreshing @${username} (${platform})...`);
          totalAccountsProcessed++;

          try {
            // Fetch fresh data from platform
            const videos = await refreshAccountVideos(
              orgId,
              projectId,
              accountId,
              username,
              platform
            );

            if (videos && videos.length > 0) {
              console.log(`    ✅ Successfully refreshed ${videos.length} videos for @${username}`);
              totalVideosRefreshed += videos.length;

              // Update account lastSynced timestamp
              await accountDoc.ref.update({
                lastSynced: new Date(),
                totalVideos: videos.length
              });
            } else {
              console.log(`    ⚠️ No videos found for @${username}`);
            }

          } catch (error: any) {
            console.error(`    ❌ Failed to refresh @${username}:`, error.message);
            failedAccounts.push({
              org: orgId,
              project: projectId,
              account: username,
              error: error.message
            });
          }

          // Add delay to avoid rate limiting (2 seconds between accounts)
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    const summary = {
      success: true,
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
      stats: {
        totalOrganizations: orgsSnapshot.size,
        totalAccountsProcessed,
        totalVideosRefreshed,
        failedAccounts: failedAccounts.length
      },
      failures: failedAccounts
    };

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Video refresh job completed!');
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Accounts processed: ${totalAccountsProcessed}`);
    console.log(`🎬 Videos refreshed: ${totalVideosRefreshed}`);
    console.log(`❌ Failed accounts: ${failedAccounts.length}`);
    console.log('='.repeat(60) + '\n');

    return res.status(200).json(summary);

  } catch (error: any) {
    console.error('❌ Cron job failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Refresh videos for a single account by fetching from Apify
 */
async function refreshAccountVideos(
  orgId: string,
  projectId: string,
  accountId: string,
  username: string,
  platform: 'instagram' | 'tiktok' | 'youtube'
): Promise<any[]> {
  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  
  if (!APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN not configured');
  }

  // Use the appropriate Apify actor based on platform
  let actorId: string;
  let input: any;

  if (platform === 'instagram') {
    actorId = 'apify/instagram-profile-scraper';
    input = {
      username: [username],
      resultsLimit: 50
    };
  } else if (platform === 'tiktok') {
    actorId = 'clockworks/tiktok-profile-scraper';
    input = {
      profiles: [username],
      maxProfilesPerQuery: 1,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false
    };
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  // Run Apify actor
  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }
  );

  if (!runResponse.ok) {
    throw new Error(`Apify request failed: ${runResponse.statusText}`);
  }

  const videos = await runResponse.json();

  // Save videos to Firestore
  if (videos && videos.length > 0) {
    await saveVideosToFirestore(orgId, projectId, accountId, videos, platform);
  }

  return videos;
}

/**
 * Save videos to Firestore with batched writes
 */
async function saveVideosToFirestore(
  orgId: string,
  projectId: string,
  accountId: string,
  videos: any[],
  platform: string
) {
  const batch = db.batch();
  let batchCount = 0;
  const BATCH_SIZE = 500;

  for (const video of videos) {
    // Extract video ID based on platform
    let videoId: string;
    if (platform === 'instagram') {
      videoId = video.shortCode || video.id;
    } else if (platform === 'tiktok') {
      videoId = video.id || video.videoId;
    } else {
      continue;
    }

    if (!videoId) continue;

    const videoRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('videos')
      .doc(videoId);

    // Check if video exists
    const existingDoc = await videoRef.get();

    const videoData = {
      views: platform === 'instagram' ? (video.videoViewCount || video.viewCount || 0) : (video.playCount || 0),
      likes: platform === 'instagram' ? (video.likesCount || 0) : (video.diggCount || 0),
      comments: platform === 'instagram' ? (video.commentsCount || 0) : (video.commentCount || 0),
      shares: platform === 'tiktok' ? (video.shareCount || 0) : 0,
      lastRefreshed: new Date()
    };

    if (existingDoc.exists()) {
      // Update existing video
      batch.update(videoRef, videoData);
      
      // Create a snapshot for the updated metrics
      const snapshotRef = videoRef.collection('snapshots').doc();
      batch.set(snapshotRef, {
        id: snapshotRef.id,
        videoId: videoId,
        views: videoData.views,
        likes: videoData.likes,
        comments: videoData.comments,
        shares: videoData.shares,
        capturedAt: new Date(),
        capturedBy: 'scheduled_refresh' // Indicates this was from a scheduled cron job
      });
    } else {
      // Create new video
      batch.set(videoRef, {
        ...videoData,
        id: videoId,
        orgId,
        trackedAccountId: accountId,
        videoId: videoId,
        url: platform === 'instagram' ? 
          `https://www.instagram.com/reel/${videoId}` : 
          `https://www.tiktok.com/@${video.authorMeta?.name}/video/${videoId}`,
        thumbnail: platform === 'instagram' ? 
          (video.displayUrl || video.thumbnailUrl) : 
          (video.covers?.[0] || ''),
        title: (video.caption || video.text || '').substring(0, 100),
        description: video.caption || video.text || '',
        platform: platform,
        uploadDate: new Date(video.timestamp || video.createTime || Date.now()),
        duration: video.videoDuration || 0,
        hashtags: video.hashtags || [],
        status: 'active',
        isSingular: false,
        dateAdded: new Date(),
        addedBy: 'cron-job'
      });
      
      // Create initial snapshot for new video
      const snapshotRef = videoRef.collection('snapshots').doc();
      batch.set(snapshotRef, {
        id: snapshotRef.id,
        videoId: videoId,
        views: videoData.views,
        likes: videoData.likes,
        comments: videoData.comments,
        shares: videoData.shares,
        capturedAt: new Date(),
        capturedBy: 'initial_upload' // Indicates this was from initial video upload
      });
    }

    batchCount++;

    // Commit batch if we reach the limit
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batchCount = 0;
    }
  }

  // Commit remaining operations
  if (batchCount > 0) {
    await batch.commit();
  }
}

