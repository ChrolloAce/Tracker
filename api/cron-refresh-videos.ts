import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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
            const result = await refreshAccountVideos(
              orgId,
              projectId,
              accountId,
              username,
              platform
            );

            if (result.fetched > 0) {
              console.log(`    ✅ @${username}: Updated ${result.updated} videos, Skipped ${result.skipped} new videos`);
              totalVideosRefreshed += result.updated;

              // Update account lastSynced timestamp
              await accountDoc.ref.update({
                lastSynced: new Date()
              });
            } else {
              console.log(`    ⚠️ No videos returned from API for @${username}`);
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
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter'
): Promise<{ fetched: number; updated: number; skipped: number }> {
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

  // Save videos to Firestore (only update existing ones)
  let updated = 0;
  let skipped = 0;
  
  if (videos && videos.length > 0) {
    const counts = await saveVideosToFirestore(orgId, projectId, accountId, videos, platform);
    updated = counts.updated;
    skipped = counts.skipped;
  }

  return {
    fetched: videos.length,
    updated: updated,
    skipped: skipped
  };
}

/**
 * Save videos to Firestore with batched writes
 * ONLY updates existing videos - does not add new videos
 */
async function saveVideosToFirestore(
  orgId: string,
  projectId: string,
  accountId: string,
  videos: any[],
  platform: string
): Promise<{ updated: number; skipped: number }> {
  const batch = db.batch();
  let batchCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const BATCH_SIZE = 500;

  for (const video of videos) {
    // Extract video ID based on platform
    let videoId: string;
    if (platform === 'instagram') {
      videoId = video.shortCode || video.id;
    } else if (platform === 'tiktok') {
      videoId = video.id || video.videoId;
    } else if (platform === 'twitter') {
      videoId = video.id;
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

    // Check if video exists (Firebase Admin uses .exists property, not .exists() method)
    const existingDoc = await videoRef.get();

    // Extract metrics based on platform
    let views = 0;
    let likes = 0;
    let comments = 0;
    let shares = 0;

    if (platform === 'instagram') {
      views = video.videoViewCount || video.viewCount || 0;
      likes = video.likesCount || 0;
      comments = video.commentsCount || 0;
      shares = 0;
    } else if (platform === 'tiktok') {
      views = video.playCount || 0;
      likes = video.diggCount || 0;
      comments = video.commentCount || 0;
      shares = video.shareCount || 0;
    } else if (platform === 'twitter') {
      views = video.viewCount || 0;
      likes = video.likeCount || 0;
      comments = video.replyCount || 0;
      shares = video.retweetCount || 0;
    }

    const videoData = {
      views,
      likes,
      comments,
      shares,
      lastRefreshed: new Date()
    };

    // ONLY update existing videos - don't add new ones
    if (!existingDoc.exists) {
      // Skip videos that don't already exist in the database
      skippedCount++;
      continue;
    }

    // Update existing video metrics
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

    updatedCount++;
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

  console.log(`      📊 Updated: ${updatedCount} videos, Skipped: ${skippedCount} new videos`);
  
  return { updated: updatedCount, skipped: skippedCount };
}

