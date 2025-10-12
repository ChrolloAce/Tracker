import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { runApifyActor } from './apify-client.js';

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

    initializeApp({ credential: cert(serviceAccount as any) });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const db = getFirestore();
const INSTAGRAM_REELS_SCRAPER_ACTOR = 'scraper-engine/instagram-reels-scraper';
const BATCH_SIZE = 5; // Process reels in smaller batches

/**
 * Cron Job: Refresh Instagram Reels for tracked accounts
 * Runs every 6 hours or can be triggered manually
 * 
 * Security: 
 * - Cron jobs: Requires CRON_SECRET in Authorization header
 * - Manual triggers: Accepts authenticated user requests
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
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
    
    const isCronJob = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isManualTrigger = req.body?.manual === true;
    
    if (!isCronJob && !isManualTrigger) {
      console.warn('⚠️ Unauthorized reels refresh attempt');
      return res.status(401).json({ 
        success: false,
        error: 'Unauthorized: Must be a scheduled cron job or manual trigger' 
      });
    }

    const scopedOrgId = req.body?.organizationId;
    const scopedProjectId = req.body?.projectId;
    
    const triggerType = isCronJob ? 'Scheduled Cron Job' : 'Manual Trigger';
    const scopeInfo = scopedOrgId ? ` (Org: ${scopedOrgId}${scopedProjectId ? `, Project: ${scopedProjectId}` : ''})` : ' (All Organizations)';
    console.log(`🎬 Starting Instagram Reels refresh (${triggerType}${scopeInfo})...`);
    const startTime = Date.now();

    try {
      // Get organizations to process
      let orgsSnapshot;
      if (scopedOrgId) {
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
        orgsSnapshot = await db.collection('organizations').get();
      }
      console.log(`📊 Found ${orgsSnapshot.size} organization(s) to process`);

      let totalAccountsProcessed = 0;
      let totalReelsRefreshed = 0;
      let failedAccounts: Array<{ org: string; project: string; account: string; error: string }> = [];

      // Process each organization
      for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id;
        console.log(`\n📂 Processing org: ${orgId}`);

        // Get projects for this organization
        let projectsSnapshot;
        if (scopedProjectId) {
          const projectDoc = await db.collection('organizations').doc(orgId).collection('projects').doc(scopedProjectId).get();
          if (!projectDoc.exists) {
            console.warn(`⚠️ Project ${scopedProjectId} not found in org ${orgId}`);
            continue;
          }
          projectsSnapshot = { docs: [projectDoc], size: 1 };
        } else {
          projectsSnapshot = await db.collection('organizations').doc(orgId).collection('projects').get();
        }

        for (const projectDoc of projectsSnapshot.docs) {
          const projectId = projectDoc.id;
          console.log(`  📁 Processing project: ${projectId}`);

          // Get Instagram accounts for this project
          const accountsSnapshot = await db.collection('organizations')
            .doc(orgId)
            .collection('projects')
            .doc(projectId)
            .collection('trackedAccounts')
            .where('platform', '==', 'instagram')
            .where('isActive', '==', true)
            .get();

          console.log(`    📱 Found ${accountsSnapshot.size} Instagram account(s)`);

          // Process accounts in batches
          for (let i = 0; i < accountsSnapshot.docs.length; i += BATCH_SIZE) {
            const batch = accountsSnapshot.docs.slice(i, i + BATCH_SIZE);
            console.log(`    🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(accountsSnapshot.docs.length / BATCH_SIZE)}`);

            await Promise.all(batch.map(async (accountDoc) => {
              const accountId = accountDoc.id;
              const accountData = accountDoc.data();
              const username = accountData.username;

              console.log(`      👤 Refreshing reels for @${username}...`);

              try {
                // Scrape latest reels using Apify
                const run = await runApifyActor(INSTAGRAM_REELS_SCRAPER_ACTOR, {
                  usernames: [username],
                  resultsLimit: 20, // Get last 20 reels
                }, {
                  token: process.env.APIFY_TOKEN
                });

                if (run.status !== 'SUCCEEDED') {
                  throw new Error(`Scraper failed with status: ${run.status}`);
                }

                const reels = run.items || [];
                console.log(`      ✅ Found ${reels.length} reels for @${username}`);

                // Process each reel
                for (const reelData of reels) {
                  const media = reelData.media || reelData;
                  
                  // Extract reel ID
                  const reelId = media.code || media.pk || media.id || media.strong_id__;
                  
                  // Check if reel already exists
                  const existingReelQuery = await db.collection('organizations')
                    .doc(orgId)
                    .collection('projects')
                    .doc(projectId)
                    .collection('videoSubmissions')
                    .where('videoId', '==', reelId)
                    .limit(1)
                    .get();

                  const now = Timestamp.now();
                  
                  // Extract metrics
                  const likes = media.like_count || 0;
                  const comments = media.comment_count || 0;
                  const views = media.play_count || media.ig_play_count || 0;
                  const shares = media.share_count || 0;
                  
                  // Extract caption
                  const caption = media.caption?.text || media.title || '';
                  
                  // Extract timestamp
                  const uploadDate = media.taken_at 
                    ? Timestamp.fromMillis(media.taken_at * 1000)
                    : now;
                  
                  // Extract thumbnail
                  let thumbnailUrl = '';
                  if (media.image_versions2?.candidates && media.image_versions2.candidates.length > 0) {
                    thumbnailUrl = media.image_versions2.candidates[0].url;
                  } else if (media.display_uri) {
                    thumbnailUrl = media.display_uri;
                  }

                  if (existingReelQuery.empty) {
                    // New reel - add it
                    const videoDoc = db.collection('organizations')
                      .doc(orgId)
                      .collection('projects')
                      .doc(projectId)
                      .collection('videoSubmissions')
                      .doc();

                    await videoDoc.set({
                      videoId: reelId,
                      title: caption.substring(0, 100) || 'Instagram Reel',
                      description: caption,
                      url: `https://www.instagram.com/reel/${reelId}/`,
                      uploadDate: uploadDate,
                      dateSubmitted: now,
                      timestamp: now,
                      platform: 'instagram',
                      thumbnailUrl: thumbnailUrl,
                      views: views,
                      likes: likes,
                      comments: comments,
                      shares: shares,
                      trackedAccountId: accountId,
                      username: username,
                      displayName: media.user?.full_name || media.owner?.full_name || username,
                      profilePictureUrl: media.user?.profile_pic_url || media.owner?.profile_pic_url || '',
                      isVerified: media.user?.is_verified || media.owner?.is_verified || false,
                      videoDuration: media.video_duration || 0,
                      snapshots: [
                        {
                          capturedAt: now,
                          views: views,
                          likes: likes,
                          comments: comments,
                          shares: shares,
                          source: 'Scheduled Refresh'
                        }
                      ]
                    });
                    totalReelsRefreshed++;
                    console.log(`        ➕ Added new reel: ${reelId}`);
                  } else {
                    // Existing reel - update with snapshot
                    const existingReelDoc = existingReelQuery.docs[0];
                    await existingReelDoc.ref.update({
                      views: views,
                      likes: likes,
                      comments: comments,
                      shares: shares,
                      lastRefreshed: now,
                      snapshots: FieldValue.arrayUnion({
                        capturedAt: now,
                        views: views,
                        likes: likes,
                        comments: comments,
                        shares: shares,
                        source: 'Scheduled Refresh'
                      })
                    });
                    totalReelsRefreshed++;
                    console.log(`        🔄 Updated reel: ${reelId}`);
                  }
                }

                // Update account last synced timestamp
                await accountDoc.ref.update({
                  lastSyncedAt: Timestamp.now(),
                  lastSyncStatus: 'success'
                });

                totalAccountsProcessed++;

              } catch (error) {
                console.error(`      ❌ Failed to refresh reels for @${username}:`, error);
                failedAccounts.push({
                  org: orgId,
                  project: projectId,
                  account: username,
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
                
                // Update account with error status
                await accountDoc.ref.update({
                  lastSyncStatus: 'error',
                  lastSyncError: error instanceof Error ? error.message : 'Unknown error'
                });
              }
            }));
          }
        }
      }

      const duration = Date.now() - startTime;
      const summary = {
        success: true,
        triggerType,
        organizationsProcessed: orgsSnapshot.size,
        accountsProcessed: totalAccountsProcessed,
        reelsRefreshed: totalReelsRefreshed,
        failedAccounts: failedAccounts.length,
        failures: failedAccounts,
        durationMs: duration,
        durationSec: Math.round(duration / 1000),
        completedAt: new Date().toISOString()
      };

      console.log(`\n✅ Instagram Reels refresh completed in ${Math.round(duration / 1000)}s`);
      console.log(`📊 Summary:`, summary);

      return res.status(200).json(summary);

    } catch (error) {
      console.error('❌ Fatal error in reels refresh:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: 'REFRESH_ERROR',
        stack: error instanceof Error ? error.stack : undefined
      });
    }

  } catch (error) {
    console.error('❌ Top-level error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: 'SERVER_ERROR'
    });
  }
}

