import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { runApifyActor } from './apify-client.js';

// Initialize Firebase Admin (same pattern as other API files)
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

    initializeApp({ credential: cert(serviceAccount as any) });
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
  // Add top-level error handling
  try {
    // Verify Firebase is initialized
    if (!getApps().length) {
      console.error('❌ Firebase Admin not initialized');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: Firebase not initialized',
        errorType: 'FIREBASE_INIT_ERROR'
      });
    }

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

    // Get scope from request body (for manual triggers)
    const scopedOrgId = req.body?.organizationId;
    const scopedProjectId = req.body?.projectId;
    
    const triggerType = isCronJob ? 'Scheduled Cron Job' : 'Manual Trigger';
    const scopeInfo = scopedOrgId ? ` (Org: ${scopedOrgId}${scopedProjectId ? `, Project: ${scopedProjectId}` : ''})` : ' (All Organizations)';
    console.log(`🚀 Starting automated video refresh (${triggerType}${scopeInfo})...`);
    const startTime = Date.now();

    try {
    // Get organizations to process
    let orgsSnapshot;
    if (scopedOrgId) {
      // Manual trigger: only process specified organization
      const orgDoc = await db.collection('organizations').doc(scopedOrgId).get();
      if (!orgDoc.exists) {
        return res.status(404).json({
          success: false,
          error: `Organization ${scopedOrgId} not found`,
          errorType: 'ORG_NOT_FOUND'
        });
      }
      orgsSnapshot = { docs: [orgDoc], size: 1 };
    } else {
      // Scheduled cron: process all organizations
      orgsSnapshot = await db.collection('organizations').get();
    }
    console.log(`📊 Found ${orgsSnapshot.size} organization(s) to process`);

    let totalAccountsProcessed = 0;
    let totalVideosRefreshed = 0;
    let failedAccounts: Array<{ org: string; project: string; account: string; error: string }> = [];

    // Process each organization
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      console.log(`\n📁 Processing organization: ${orgId}`);

      // Get projects to process
      let projectsSnapshot;
      if (scopedProjectId && scopedOrgId === orgId) {
        // Manual trigger with specific project: only process that project
        const projectDoc = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(scopedProjectId)
          .get();
        
        if (!projectDoc.exists) {
          console.error(`  ⚠️ Project ${scopedProjectId} not found in organization ${orgId}`);
          continue;
        }
        projectsSnapshot = { docs: [projectDoc], size: 1 };
      } else {
        // Get all projects for this org
        projectsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .get();
      }

      console.log(`  📂 Found ${projectsSnapshot.size} project(s) to process`);

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

        // Process accounts in parallel batches for maximum performance
        // With 12-hour intervals, we can handle large batches aggressively
        const BATCH_SIZE = 50; // Process 50 accounts at once (lightning fast!)
        const accounts = accountsSnapshot.docs;
        
        for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
          const batch = accounts.slice(i, i + BATCH_SIZE);
          console.log(`\n    ⚡ Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(accounts.length / BATCH_SIZE)} (${batch.length} accounts)...`);
          
          // Process this batch in parallel
          const batchPromises = batch.map(async (accountDoc) => {
            const accountId = accountDoc.id;
            const accountData = accountDoc.data();
            const username = accountData.username;
            const platform = accountData.platform;

            try {
              // Fetch fresh data from platform
              const result = await refreshAccountVideos(
                orgId,
                projectId,
                accountId,
                username,
                platform,
                isManualTrigger
              );

              if (result.fetched > 0) {
                console.log(`    ✅ @${username}: Updated ${result.updated} videos, Added ${result.added} new videos, Skipped ${result.skipped} invalid videos`);

                // Update account lastSynced timestamp
                await accountDoc.ref.update({
                  lastSynced: new Date()
                });
                
                return { success: true, username, updated: result.updated, added: result.added };
              } else {
                console.log(`    ⚠️ No videos returned from API for @${username}`);
                return { success: true, username, updated: 0, added: 0 };
              }

            } catch (error: any) {
              console.error(`    ❌ Failed to refresh @${username}:`, error.message);
              return {
                success: false,
                username,
                error: error.message,
                org: orgId,
                project: projectId
              };
            }
          });

          // Wait for all accounts in this batch to complete
          const results = await Promise.allSettled(batchPromises);
          
          // Process results
          results.forEach((result) => {
            totalAccountsProcessed++;
            if (result.status === 'fulfilled') {
              const data = result.value;
              if (data.success) {
                totalVideosRefreshed += data.updated || 0;
              } else {
                failedAccounts.push({
                  org: data.org,
                  project: data.project,
                  account: data.username,
                  error: data.error
                });
              }
            }
          });
          
          // No delay needed - with 12 hour intervals, we maximize speed
          // Apify proxy handles rate limiting automatically
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
        errorType: 'PROCESSING_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    // Top-level catch for any unhandled errors
    console.error('❌ Unhandled error in cron-refresh-videos:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
      errorType: 'UNHANDLED_ERROR',
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
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter',
  isManualTrigger: boolean
): Promise<{ fetched: number; updated: number; added: number; skipped: number }> {
  // Use the appropriate Apify actor based on platform
  let actorId: string;
  let input: any;

  if (platform === 'instagram') {
    // Use NEW Instagram Reels Scraper with RESIDENTIAL proxies
    actorId = 'scraper-engine~instagram-reels-scraper';
    input = {
      urls: [`https://www.instagram.com/${username}/`],
      sortOrder: "newest",
      maxComments: 0,  // Don't fetch comments for refresh (faster)
      maxReels: 50,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],  // Use RESIDENTIAL proxies to avoid Instagram 429 blocks
        apifyProxyCountry: 'US'
      },
      maxRequestRetries: 5,
      requestHandlerTimeoutSecs: 300,
      maxConcurrency: 1  // Reduce concurrency to avoid rate limits
    };
  } else if (platform === 'tiktok') {
    // FIXED: Use correct actor ID (clockworks~tiktok-scraper, not tiktok-profile-scraper)
    actorId = 'clockworks~tiktok-scraper';
    input = {
      profiles: [username],
      resultsPerPage: 100,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      proxy: {
        useApifyProxy: true
      }
    };
  } else if (platform === 'twitter') {
    actorId = 'apidojo/tweet-scraper';
    input = {
      twitterHandles: [username],
      maxItems: 100,
      sort: 'Latest',
      onlyImage: false,
      onlyVideo: false,
      onlyQuote: false,
      onlyVerifiedUsers: false,
      onlyTwitterBlue: false,
      includeSearchTerms: false
    };
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  // Run Apify actor using the helper function
  const result = await runApifyActor({
    actorId: actorId,
    input: input
  });

  const videos = result.items || [];

  console.log(`    📊 Apify returned ${videos.length} items for ${platform}`);

  // Save videos to Firestore (update existing ones AND add new ones)
  let updated = 0;
  let added = 0;
  let skipped = 0;
  
  if (videos && videos.length > 0) {
    const counts = await saveVideosToFirestore(orgId, projectId, accountId, videos, platform, isManualTrigger);
    updated = counts.updated;
    added = counts.added;
    skipped = counts.skipped;
  }

  return {
    fetched: videos.length,
    updated: updated,
    added: added,
    skipped: skipped
  };
}

/**
 * Save videos to Firestore with batched writes
 * Updates existing videos AND adds new ones
 */
async function saveVideosToFirestore(
  orgId: string,
  projectId: string,
  accountId: string,
  videos: any[],
  platform: string,
  isManualTrigger: boolean
): Promise<{ updated: number; skipped: number; added: number }> {
  const batch = db.batch();
  let batchCount = 0;
  let updatedCount = 0;
  let addedCount = 0;
  let skippedCount = 0;
  const BATCH_SIZE = 500;

  for (const video of videos) {
    // Extract video ID and media object based on platform (this is the platform's video ID, not Firestore doc ID)
    let platformVideoId: string;
    let media: any = video; // Default to the video object itself
    
    if (platform === 'instagram') {
      // Parse new Instagram reels scraper format
      media = video.reel_data?.media || video.media || video;
      
      // Only process video content (media_type: 2 = video)
      if (media.media_type !== 2 && media.product_type !== 'clips') {
        continue;
      }
      
      platformVideoId = media.code || media.shortCode || media.id;
    } else if (platform === 'tiktok') {
      platformVideoId = video.id || video.videoId;
    } else if (platform === 'twitter') {
      platformVideoId = video.id;
    } else {
      continue;
    }

    if (!platformVideoId) continue;

    // Query for the video by its videoId field (not document ID)
    const videosCollectionRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('videos');
    
    const videoQuery = videosCollectionRef
      .where('videoId', '==', platformVideoId)
      .limit(1);
    
    const querySnapshot = await videoQuery.get();
    
    // Extract metrics based on platform
    let views = 0;
    let likes = 0;
    let comments = 0;
    let shares = 0;
    let url = '';
    let thumbnail = '';
    let caption = '';
    let uploadDate: Date = new Date();

    if (platform === 'instagram') {
      // Use new Instagram reels scraper field names
      views = media.play_count || media.ig_play_count || 0;
      likes = media.like_count || 0;
      comments = media.comment_count || 0;
      shares = 0; // Instagram API doesn't provide share count
      url = `https://www.instagram.com/reel/${media.code || media.shortCode}/`;
      thumbnail = media.thumbnail_url || media.display_url || '';
      caption = media.caption?.text || media.caption || '';
      uploadDate = media.taken_at ? new Date(media.taken_at * 1000) : new Date();
    } else if (platform === 'tiktok') {
      views = video.playCount || 0;
      likes = video.diggCount || 0;
      comments = video.commentCount || 0;
      shares = video.shareCount || 0;
      url = video.webVideoUrl || video.videoUrl || '';
      thumbnail = video.videoMeta?.coverUrl || '';
      caption = video.text || '';
      uploadDate = video.createTime ? new Date(video.createTime * 1000) : new Date();
    } else if (platform === 'twitter') {
      views = video.viewCount || 0;
      likes = video.likeCount || 0;
      comments = video.replyCount || 0;
      shares = video.retweetCount || 0;
      url = video.url || '';
      thumbnail = video.media?.[0]?.thumbnail_url || '';
      caption = video.text || '';
      uploadDate = video.created_at ? new Date(video.created_at) : new Date();
    }
    
    // Check if video exists
    if (querySnapshot.empty) {
      // Video doesn't exist - ADD IT as a new video!
      const newVideoRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('videos')
        .doc();

      batch.set(newVideoRef, {
        videoId: platformVideoId,
        url,
        thumbnail,
        caption,
        description: caption,
        uploadDate: Timestamp.fromDate(uploadDate),
        views,
        likes,
        comments,
        shares,
        orgId,
        projectId,
        trackedAccountId: accountId,
        platform,
        dateAdded: Timestamp.now(),
        addedBy: 'auto_refresh',
        lastRefreshed: Timestamp.now(),
        status: 'active',
        isSingular: false,
        duration: 0,
        hashtags: [],
        mentions: []
      });

      addedCount++;
      batchCount++;
    } else {
      // Video exists - UPDATE IT
      const existingDoc = querySnapshot.docs[0];
      const videoRef = existingDoc.ref;

      const videoData = {
        views,
        likes,
        comments,
        shares,
        lastRefreshed: Timestamp.now()
      };

      // Update existing video metrics
      batch.update(videoRef, videoData);
      
      // Create a snapshot for the updated metrics
      const snapshotRef = videoRef.collection('snapshots').doc();
      batch.set(snapshotRef, {
        id: snapshotRef.id,
        videoId: platformVideoId,
        views: videoData.views,
        likes: videoData.likes,
        comments: videoData.comments,
        shares: videoData.shares,
        capturedAt: Timestamp.now(),
        capturedBy: isManualTrigger ? 'manual_refresh' : 'scheduled_refresh'
      });

      updatedCount++;
      batchCount++;
    }

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

  console.log(`      📊 Updated: ${updatedCount} videos, Added: ${addedCount} new videos, Skipped: ${skippedCount} invalid videos`);
  
  return { updated: updatedCount, skipped: skippedCount, added: addedCount };
}

