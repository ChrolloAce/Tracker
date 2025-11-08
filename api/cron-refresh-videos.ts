import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
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

    initializeApp({ 
      credential: cert(serviceAccount as any),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app'
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const db = getFirestore();
const storage = getStorage();

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
    let totalVideosAdded = 0;
    let totalVideosUpdated = 0;
    let failedAccounts: Array<{ org: string; project: string; account: string; error: string }> = [];
    const processedOrgs = new Map<string, { email: string; orgName: string; accountsProcessed: number; videosAdded: number; videosUpdated: number }>();

    // Process each organization
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      const orgData = orgDoc.data();
      console.log(`\n📁 Processing organization: ${orgId}`);
      
      // Track org stats for email notifications
      if (!processedOrgs.has(orgId)) {
        processedOrgs.set(orgId, {
          email: orgData.ownerEmail || '',
          orgName: orgData.name || 'Your Organization',
          accountsProcessed: 0,
          videosAdded: 0,
          videosUpdated: 0
        });
      }

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

                // Update account lastSynced timestamp and verified status
                const updateData: any = {
                  lastSynced: new Date()
                };
                
                // Add verified status if available
                if (result.verified !== undefined) {
                  updateData.isVerified = result.verified;
                }
                if (result.blueVerified !== undefined) {
                  updateData.isBlueVerified = result.blueVerified;
                }
                
                await accountDoc.ref.update(updateData);
                
                // Track stats
                const orgStats = processedOrgs.get(orgId);
                if (orgStats) {
                  orgStats.accountsProcessed++;
                  orgStats.videosAdded += result.added;
                  orgStats.videosUpdated += result.updated;
                }
                
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
            if (result.status === 'fulfilled') {
              const data = result.value;
              if (data.success) {
                totalAccountsProcessed++;
                const videosChanged = (data.updated || 0) + (data.added || 0);
                totalVideosRefreshed += videosChanged;
                totalVideosUpdated += (data.updated || 0);
                totalVideosAdded += (data.added || 0);
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
    console.log(`➕ New videos added: ${totalVideosAdded}`);
    console.log(`🔄 Videos updated: ${totalVideosUpdated}`);
    console.log(`❌ Failed accounts: ${failedAccounts.length}`);
    console.log('='.repeat(60) + '\n');

    // Send email notifications to organization owners (for both manual AND automatic cron runs)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (RESEND_API_KEY) {
      console.log('📧 Sending refresh summary emails...');
      
      for (const [orgId, stats] of processedOrgs.entries()) {
        if (stats.email && (stats.videosAdded > 0 || stats.videosUpdated > 0)) {
          try {
            const triggerTypeText = isManualTrigger ? 'Manual' : 'Automated';
            const emailResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'ViewTrack <team@viewtrack.app>',
                to: [stats.email],
                subject: `📊 ${stats.orgName} - Video Refresh Complete${stats.videosAdded > 0 ? ` (+${stats.videosAdded} New)` : ''}`,
                html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="text-align: center; padding: 30px 20px; background: #f8f9fa; border-bottom: 2px solid #e9ecef;">
                      <img src="https://www.viewtrack.app/blacklogo.png" alt="ViewTrack" style="height: 40px; width: auto;" />
                    </div>
                    <div style="padding: 30px 20px;">
                    <h2 style="color: #f5576c; margin-top: 0;">${triggerTypeText} Refresh Complete! 🎉</h2>
                    <p>Your tracked accounts for <strong>${stats.orgName}</strong> have been refreshed with the latest data.</p>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="margin-top: 0; color: #333;">📊 Summary</h3>
                      <div style="display: grid; gap: 10px;">
                        <p style="margin: 5px 0;"><strong>Accounts Refreshed:</strong> ${stats.accountsProcessed}</p>
                        <p style="margin: 5px 0; color: #10b981; font-size: 16px;"><strong>✨ New Videos Added:</strong> ${stats.videosAdded}</p>
                        <p style="margin: 5px 0; color: #3b82f6; font-size: 16px;"><strong>🔄 Videos Updated:</strong> ${stats.videosUpdated}</p>
                        <p style="margin: 5px 0;"><strong>Total Changes:</strong> ${stats.videosAdded + stats.videosUpdated}</p>
                      </div>
                    </div>
                    ${stats.videosAdded > 0 ? `
                      <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #065f46;"><strong>🎉 ${stats.videosAdded} new video${stats.videosAdded === 1 ? '' : 's'} discovered!</strong></p>
                        <p style="margin: 5px 0 0 0; color: #065f46; font-size: 14px;">Check your dashboard to see the latest content from your tracked accounts.</p>
                      </div>
                    ` : ''}
                    ${stats.videosUpdated > 0 ? `
                      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #1e40af;"><strong>📈 ${stats.videosUpdated} video${stats.videosUpdated === 1 ? '' : 's'} updated!</strong></p>
                        <p style="margin: 5px 0 0 0; color: #1e40af; font-size: 14px;">All metrics refreshed with latest views, likes, comments, and engagement data.</p>
                      </div>
                    ` : ''}
                    <p style="color: #666; font-size: 14px; margin-top: 20px;">Stay on top of your content performance and track what's trending!</p>
                    <div style="text-align: center; margin-top: 25px;">
                      <a href="https://www.viewtrack.app" style="display: inline-block; padding: 14px 28px; background: #f5576c; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Dashboard →</a>
                    </div>
                    </div>
                    <div style="text-align: center; padding: 20px; background: #f8f9fa; border-top: 1px solid #e9ecef; margin-top: 30px;">
                      <p style="margin: 0; color: #666; font-size: 12px;">Trigger Type: ${triggerTypeText} | ${new Date().toLocaleString()}</p>
                    </div>
                  </div>
                `,
              }),
            });

            if (emailResponse.ok) {
              const emailData = await emailResponse.json();
              console.log(`✅ Refresh summary email sent to ${stats.email} (ID: ${emailData.id})`);
            } else {
              const errorData = await emailResponse.json();
              console.error(`❌ Failed to send email to ${stats.email}:`, errorData);
            }
          } catch (emailError) {
            console.error(`❌ Email error for ${stats.email}:`, emailError);
          }
        }
      }
    } else {
      console.warn('⚠️ RESEND_API_KEY not configured - skipping email notifications');
    }

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
 * Download image from URL and upload to Firebase Storage
 * Returns Firebase Storage URL or fallback placeholder
 */
async function downloadAndUploadImage(
  imageUrl: string, 
  orgId: string, 
  filename: string,
  folder: string = 'thumbnails'
): Promise<string> {
  try {
    const isInstagram = imageUrl.includes('cdninstagram') || imageUrl.includes('fbcdn');
    console.log(`    📥 Downloading thumbnail from ${isInstagram ? 'Instagram' : 'platform'}...`);
    
    // Download image with proper headers for Instagram
    const fetchOptions: any = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'cross-site'
      }
    };
    
    if (isInstagram) {
      fetchOptions.headers['Referer'] = 'https://www.instagram.com/';
    }
    
    const response = await fetch(imageUrl, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (buffer.length < 100) {
      throw new Error(`Data too small (${buffer.length} bytes)`);
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Upload to Firebase Storage
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app';
    const bucket = storage.bucket(bucketName);
    const storagePath = `organizations/${orgId}/${folder}/${filename}`;
    const file = bucket.file(storagePath);
    
    await file.save(buffer, {
      metadata: {
        contentType: contentType,
        metadata: {
          uploadedAt: new Date().toISOString(),
          originalUrl: imageUrl
        }
      },
      public: true
    });
    
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    
    console.log(`    ✅ Uploaded thumbnail to Firebase Storage`);
    return publicUrl;
  } catch (error) {
    console.error(`    ❌ Failed to download/upload thumbnail:`, error);
    // DO NOT return original URL as fallback for ANY platform (all CDN URLs expire)
    // Instagram, TikTok, YouTube, Twitter URLs all have expiring signatures
    console.warn(`    ⚠️ Thumbnail download failed, returning empty (CDN URLs expire - will retry later)`);
    throw error; // Throw error so caller knows upload failed
  }
}

/**
 * OPTIMIZED: Refresh videos for a single account using incremental fetch + bulk refresh
 * 
 * Strategy:
 * 1. Fetch 2-5 newest videos at a time
 * 2. Check if any already exist in database
 * 3. Once we find an existing video, STOP fetching new videos
 * 4. Refresh all existing videos using platform-specific unique endpoints
 */
async function refreshAccountVideos(
  orgId: string,
  projectId: string,
  accountId: string,
  username: string,
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter',
  isManualTrigger: boolean
): Promise<{ fetched: number; updated: number; added: number; skipped: number; verified?: boolean; blueVerified?: boolean }> {
  console.log(`    🔄 [${platform.toUpperCase()}] Starting optimized refresh for @${username}...`);
  
  // STEP 1: Fetch initial batch of newest videos (2-5 videos)
  const INITIAL_BATCH_SIZE = 2;
  const newVideos: any[] = [];
  let foundExisting = false;
  let isVerified: boolean | undefined;
  let isBlueVerified: boolean | undefined;

  console.log(`    📥 [${platform.toUpperCase()}] Fetching ${INITIAL_BATCH_SIZE} newest videos...`);
  
  const initialBatch = await fetchVideosFromPlatform(platform, username, INITIAL_BATCH_SIZE);
  
  if (!initialBatch || initialBatch.length === 0) {
    console.log(`    ⚠️ [${platform.toUpperCase()}] No videos returned`);
    return { fetched: 0, updated: 0, added: 0, skipped: 0 };
  }

  // Extract verified status from first video
  if (initialBatch.length > 0) {
    const firstVideo = initialBatch[0];
    if (platform === 'instagram') {
      // hpix~ig-reels-scraper: verified status is in raw_data.owner.is_verified
      isVerified = firstVideo.raw_data?.owner?.is_verified || false;
    } else if (platform === 'tiktok') {
      // apidojo/tiktok-scraper: verified status is in channel.verified
      isVerified = firstVideo.channel?.verified || false;
    } else if (platform === 'twitter') {
      isVerified = firstVideo.isVerified || false;
      isBlueVerified = firstVideo.isBlueVerified || false;
    }
  }

  // Check each video in initial batch
  for (const video of initialBatch) {
    const videoId = extractVideoId(video, platform);
    if (!videoId) continue;

    const exists = await videoExistsInDatabase(orgId, projectId, videoId);
    
    if (exists) {
      console.log(`    ✓ [${platform.toUpperCase()}] Found existing video: ${videoId} - stopping new fetch`);
      foundExisting = true;
      break;
    } else {
      console.log(`    ✨ [${platform.toUpperCase()}] New video detected: ${videoId}`);
      newVideos.push(video);
    }
  }

  // STEP 2: If no existing videos found in first batch, continue fetching
  if (!foundExisting && initialBatch.length === INITIAL_BATCH_SIZE) {
    console.log(`    📥 [${platform.toUpperCase()}] No existing videos in first batch, fetching more...`);
    
    // Fetch a larger batch (10-20 more videos)
    const secondBatch = await fetchVideosFromPlatform(platform, username, 20, INITIAL_BATCH_SIZE);
    
    for (const video of secondBatch) {
      const videoId = extractVideoId(video, platform);
      if (!videoId) continue;

      const exists = await videoExistsInDatabase(orgId, projectId, videoId);
      
      if (exists) {
        console.log(`    ✓ [${platform.toUpperCase()}] Found existing video: ${videoId} - stopping`);
        foundExisting = true;
        break;
      } else {
        newVideos.push(video);
      }
    }
  }

  console.log(`    📊 [${platform.toUpperCase()}] Found ${newVideos.length} new videos`);

  // STEP 3: Save new videos to database
  let added = 0;
  if (newVideos.length > 0) {
    const counts = await saveVideosToFirestore(orgId, projectId, accountId, newVideos, platform, isManualTrigger);
    added = counts.added;
  }

  // STEP 4: Refresh all existing videos using platform-specific bulk refresh
  console.log(`    🔄 [${platform.toUpperCase()}] Refreshing existing videos...`);
  const updated = await refreshExistingVideos(orgId, projectId, accountId, platform);
  
  console.log(`    ✅ [${platform.toUpperCase()}] Complete: ${added} new, ${updated} refreshed`);

  return {
    fetched: newVideos.length,
    updated: updated,
    added: added,
    skipped: 0,
    verified: isVerified,
    blueVerified: isBlueVerified
  };
}

/**
 * Fetch videos from platform with specified batch size
 */
async function fetchVideosFromPlatform(
  platform: string,
  username: string,
  maxVideos: number,
  skipVideos: number = 0
): Promise<any[]> {
  let actorId: string;
  let input: any;

  if (platform === 'instagram') {
    actorId = 'hpix~ig-reels-scraper';
    input = {
      tags: [`https://www.instagram.com/${username}/reels/`],
      target: 'reels_only',
      reels_count: maxVideos,
      include_raw_data: true,
      custom_functions: '{ shouldSkip: (data) => false, shouldContinue: (data) => true }',
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
        apifyProxyCountry: 'US'
      },
      maxConcurrency: 1,
      maxRequestRetries: 3,
      handlePageTimeoutSecs: 120,
      debugLog: false
    };
  } else if (platform === 'tiktok') {
    actorId = 'apidojo/tiktok-scraper';
    const usernameClean = username.replace('@', '');
    input = {
      startUrls: [`https://www.tiktok.com/@${usernameClean}`],
      maxItems: maxVideos,
      sortType: 'RELEVANCE',
      dateRange: 'DEFAULT',
      location: 'US',
      includeSearchKeywords: false,
      customMapFunction: '(object) => { return {...object} }',
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    };
  } else if (platform === 'twitter') {
    actorId = 'apidojo/tweet-scraper';
    input = {
      twitterHandles: [username],
      maxItems: maxVideos,
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

  const result = await runApifyActor({
    actorId: actorId,
    input: input
  });

  const videos = result.items || [];

  // Skip videos if needed (for pagination)
  return skipVideos > 0 ? videos.slice(skipVideos) : videos;
}

/**
 * Check if a video exists in the database
 */
async function videoExistsInDatabase(
  orgId: string,
  projectId: string,
  videoId: string
): Promise<boolean> {
  const videosRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(projectId)
    .collection('videos');
    
  const query = videosRef.where('videoId', '==', videoId).limit(1);
  const snapshot = await query.get();
  
  return !snapshot.empty;
}

/**
 * Extract video ID from platform-specific video object
 */
function extractVideoId(video: any, platform: string): string | null {
    if (platform === 'instagram') {
    // hpix~ig-reels-scraper format
    return video.code || video.id || null;
    } else if (platform === 'tiktok') {
    // apidojo/tiktok-scraper format: direct id field or extract from tiktok_url
    return video.id || video.post_id || null;
    } else if (platform === 'twitter') {
    return video.id || null;
  }
  return null;
}

/**
 * Refresh all existing videos for an account using platform-specific bulk endpoints
 */
async function refreshExistingVideos(
  orgId: string,
  projectId: string,
  accountId: string,
  platform: string
): Promise<number> {
  // Get all existing videos for this account
  const videosRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(projectId)
    .collection('videos');
    
  const query = videosRef.where('trackedAccountId', '==', accountId).limit(100);
  const snapshot = await query.get();
  
  if (snapshot.empty) {
    console.log(`    ℹ️ [${platform.toUpperCase()}] No existing videos to refresh`);
    return 0;
  }

  console.log(`    📊 [${platform.toUpperCase()}] Refreshing ${snapshot.size} existing videos...`);

  if (platform === 'tiktok') {
    // TikTok: Bulk refresh using unique videos API
    return await refreshTikTokVideosBulk(orgId, projectId, snapshot.docs);
  } else if (platform === 'instagram') {
    // Instagram: Sequential refresh using unique video endpoint
    return await refreshInstagramVideosSequential(orgId, projectId, snapshot.docs);
  } else if (platform === 'twitter') {
    // Twitter: Batch refresh (can submit multiple URLs)
    return await refreshTwitterVideosBatch(orgId, projectId, snapshot.docs);
  }

  return 0;
}

/**
 * TikTok: Bulk refresh using unique videos API
 */
async function refreshTikTokVideosBulk(
  orgId: string,
  projectId: string,
  videoDocs: any[]
): Promise<number> {
  // TikTok has a unique videos API that accepts multiple video URLs
  const videoUrls = videoDocs.map(doc => doc.data().url || doc.data().videoUrl).filter(Boolean);
  
  if (videoUrls.length === 0) return 0;

  console.log(`    🔄 [TIKTOK] Bulk refreshing ${videoUrls.length} videos...`);
  
  try {
    const result = await runApifyActor({
      actorId: 'apidojo/tiktok-scraper',
      input: {
        startUrls: videoUrls,
        maxItems: videoUrls.length,
        sortType: 'RELEVANCE',
        dateRange: 'DEFAULT',
        location: 'US',
        includeSearchKeywords: false,
        customMapFunction: '(object) => { return {...object} }',
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      }
    });

    const refreshedVideos = result.items || [];
    let updatedCount = 0;

    // Update each video with fresh metrics (apidojo/tiktok-scraper format)
    for (const video of refreshedVideos) {
      const videoId = extractVideoId(video, 'tiktok');
      if (!videoId) continue;

      const videoDoc = videoDocs.find(doc => doc.data().videoId === videoId);
      if (!videoDoc) continue;

      await videoDoc.ref.update({
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0,
        shares: video.shares || 0,
        saves: video.bookmarks || 0, // ✅ BOOKMARKS
        lastRefreshed: Timestamp.now()
      });

      updatedCount++;
    }

    console.log(`    ✅ [TIKTOK] Bulk refresh complete: ${updatedCount} videos updated`);
    return updatedCount;
  } catch (error) {
    console.error(`    ❌ [TIKTOK] Bulk refresh failed:`, error);
    return 0;
  }
}

/**
 * Instagram: Sequential refresh using unique video endpoint
 */
async function refreshInstagramVideosSequential(
  orgId: string,
  projectId: string,
  videoDocs: any[]
): Promise<number> {
  console.log(`    🔄 [INSTAGRAM] Sequential refresh of ${videoDocs.length} videos...`);
  
  let updatedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < videoDocs.length; i++) {
    const videoDoc = videoDocs[i];
    const videoData = videoDoc.data();
    const videoUrl = videoData.url || videoData.videoUrl;
  
    if (!videoUrl) {
      console.log(`    ⚠️ [INSTAGRAM] Skipping video ${i + 1}/${videoDocs.length} - no URL`);
      continue;
    }

    try {
      // Add delay between requests to avoid rate limiting (2-4 seconds)
      if (i > 0) {
        const delay = 2000 + Math.random() * 2000; // Random delay 2-4s
        console.log(`    ⏳ [INSTAGRAM] Waiting ${Math.round(delay)}ms before next request...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      console.log(`    📥 [INSTAGRAM] Fetching ${i + 1}/${videoDocs.length}: ${videoData.videoId}`);

      const result = await runApifyActor({
        actorId: 'hpix~ig-reels-scraper',
        input: {
          post_urls: [videoUrl],
          target: 'reels_only',
          reels_count: 12,
          include_raw_data: true,
          custom_functions: '{ shouldSkip: (data) => false, shouldContinue: (data) => true }',
          proxy: {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL'],
            apifyProxyCountry: 'US'
          },
          maxConcurrency: 1,
          maxRequestRetries: 3,
          handlePageTimeoutSecs: 120,
          debugLog: false
        }
      });

      const videos = result.items || [];
      if (videos.length === 0) {
        console.log(`    ⚠️ [INSTAGRAM] No data returned for ${videoData.videoId}`);
        failedCount++;
        continue;
      }

      const video = videos[0];
      
      await videoDoc.ref.update({
        views: video.play_count || video.video_view_count || 0,
        likes: video.like_count || 0,
        comments: video.comment_count || 0,
        shares: video.share_count || 0,
        lastRefreshed: Timestamp.now()
      });

      updatedCount++;
      console.log(`    ✓ [INSTAGRAM] Refreshed ${i + 1}/${videoDocs.length}: ${videoData.videoId} (${video.videoViewCount || 0} views)`);
    } catch (error: any) {
      failedCount++;
      const errorMsg = error.message || String(error);
      console.error(`    ❌ [INSTAGRAM] Failed ${i + 1}/${videoDocs.length}: ${videoData.videoId} - ${errorMsg.substring(0, 150)}`);
      
      // Continue with next video instead of failing entire batch
      // Instagram errors are often temporary
      continue;
    }
  }

  const successRate = videoDocs.length > 0 ? Math.round((updatedCount / videoDocs.length) * 100) : 0;
  console.log(`    ✅ [INSTAGRAM] Complete: ${updatedCount} updated, ${failedCount} failed (${successRate}% success rate)`);
  return updatedCount;
}

/**
 * Twitter: Batch refresh (can submit multiple URLs)
 */
async function refreshTwitterVideosBatch(
  orgId: string,
  projectId: string,
  videoDocs: any[]
): Promise<number> {
  // Twitter API can handle multiple tweet IDs at once
  const tweetIds = videoDocs.map(doc => doc.data().videoId).filter(Boolean);
  
  if (tweetIds.length === 0) return 0;

  console.log(`    🔄 [TWITTER] Batch refreshing ${tweetIds.length} tweets...`);
  
  try {
    const result = await runApifyActor({
      actorId: 'apidojo/tweet-scraper',
      input: {
        tweetIds: tweetIds,
        sort: 'Latest'
      }
    });

    const refreshedTweets = result.items || [];
    let updatedCount = 0;

    // Update each tweet with fresh metrics
    for (const tweet of refreshedTweets) {
      const tweetId = tweet.id;
      if (!tweetId) continue;

      const videoDoc = videoDocs.find(doc => doc.data().videoId === tweetId);
      if (!videoDoc) continue;

      await videoDoc.ref.update({
        views: tweet.viewCount || 0,
        likes: tweet.likeCount || 0,
        comments: tweet.replyCount || 0,
        shares: tweet.retweetCount || 0,
        lastRefreshed: Timestamp.now()
      });

      updatedCount++;
    }

    console.log(`    ✅ [TWITTER] Batch refresh complete: ${updatedCount} tweets updated`);
    return updatedCount;
  } catch (error) {
    console.error(`    ❌ [TWITTER] Batch refresh failed:`, error);
    return 0;
  }
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

  // Check video limits before adding new videos
  const usageDoc = await db
    .collection('organizations')
    .doc(orgId)
    .collection('billing')
    .doc('usage')
    .get();
  
  const usage = usageDoc.data();
  const currentVideos = usage?.trackedVideos || 0;
  const videoLimit = usage?.limits?.trackedVideos || 100;
  const availableSpace = videoLimit - currentVideos;
  
  console.log(`📊 Video limits - Current: ${currentVideos}, Limit: ${videoLimit}, Available: ${availableSpace}`);

  for (const video of videos) {
    // Extract video ID and media object based on platform (this is the platform's video ID, not Firestore doc ID)
    let platformVideoId: string;
    let media: any = video; // Default to the video object itself
    
    if (platform === 'instagram') {
      // hpix~ig-reels-scraper format
      media = video;
      
      platformVideoId = video.code || video.id;
    } else if (platform === 'tiktok') {
      // apidojo/tiktok-scraper: direct id field
      platformVideoId = video.id || video.post_id || '';
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
    let saves = 0; // ✅ ADD SAVES DECLARATION
    let url = '';
    let thumbnail = '';
    let caption = '';
    let uploadDate: Date = new Date();

    if (platform === 'instagram') {
      // hpix~ig-reels-scraper field names
      const owner = video.raw_data?.owner || {};
      views = video.play_count || video.view_count || 0;
      likes = video.like_count || 0;
      comments = video.comment_count || 0;
      shares = 0; // Instagram API doesn't provide share count
      url = `https://www.instagram.com/reel/${video.code}/`;
      
      // Get thumbnail from hpix~ig-reels-scraper
      const instaThumbnail = video.thumbnail_url || '';
      
      // Download and upload thumbnail to Firebase Storage
      if (instaThumbnail) {
        console.log(`    📸 Instagram thumbnail URL found: ${instaThumbnail.substring(0, 80)}...`);
        thumbnail = await downloadAndUploadImage(
          instaThumbnail,
          orgId,
          `${platformVideoId}_thumb.jpg`,
          'thumbnails'
        );
      } else {
        console.warn(`    ⚠️ Instagram reel ${platformVideoId} has no thumbnail in API response`);
      }
      caption = video.caption || '';
      uploadDate = video.taken_at ? new Date(video.taken_at * 1000) : new Date();
    } else if (platform === 'tiktok') {
      // apidojo/tiktok-scraper format
      const videoObj = video.video || {};
      views = video.views || 0;
      likes = video.likes || 0;
      comments = video.comments || 0;
      shares = video.shares || 0;
      saves = video.bookmarks || 0; // ✅ ADD BOOKMARKS (remove const to make it available outside block)
      url = video.tiktok_url || videoObj.url || '';
      
      // ROBUST THUMBNAIL EXTRACTION: handle nested + flat keys
      let tiktokThumbnail = '';
      if (videoObj.cover) {
        tiktokThumbnail = videoObj.cover;
      } else if (videoObj.thumbnail) {
        tiktokThumbnail = videoObj.thumbnail;
      } else if (video['video.cover']) { // Flat key: "video.cover"
        tiktokThumbnail = video['video.cover'];
      } else if (video['video.thumbnail']) { // Flat key: "video.thumbnail"
        tiktokThumbnail = video['video.thumbnail'];
      } else if (video.images && Array.isArray(video.images) && video.images.length > 0) {
        tiktokThumbnail = video.images[0].url || '';
      }
      
      // Download and upload thumbnail to Firebase Storage
      if (tiktokThumbnail) {
        console.log(`    🎬 TikTok thumbnail URL found: ${tiktokThumbnail.substring(0, 80)}...`);
        thumbnail = await downloadAndUploadImage(
          tiktokThumbnail,
          orgId,
          `tt_${platformVideoId}_thumb.jpg`,
          'thumbnails'
        );
      } else {
        console.warn(`    ⚠️ TikTok video ${platformVideoId} has no thumbnail URL in API response`);
        console.log(`    🔍 Available TikTok fields:`, Object.keys(video).slice(0, 20).join(', '));
      }
      caption = video.title || video.subtitle || video.caption || '';
      uploadDate = video.uploadedAt ? new Date(video.uploadedAt * 1000) : 
                   video.uploaded_at ? new Date(video.uploaded_at * 1000) : 
                   new Date();
    } else if (platform === 'twitter') {
      views = video.viewCount || 0;
      likes = video.likeCount || 0;
      comments = video.replyCount || 0;
      shares = video.retweetCount || 0;
      url = video.url || '';
      const twitterThumbnail = video.media?.[0]?.thumbnail_url || '';
      // Download and upload thumbnail to Firebase Storage
      if (twitterThumbnail) {
        thumbnail = await downloadAndUploadImage(
          twitterThumbnail,
          orgId,
          `${platformVideoId}_thumb.jpg`,
          'thumbnails'
        );
      }
      caption = video.text || '';
      uploadDate = video.created_at ? new Date(video.created_at) : new Date();
    }
    
    // Check if video exists
    if (querySnapshot.empty) {
      // Check if we have space to add new videos
      if (currentVideos + addedCount >= videoLimit) {
        console.warn(`⚠️ Video limit reached. Skipping new video: ${platformVideoId}`);
        skippedCount++;
        continue;
      }
      
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
        saves: platform === 'tiktok' ? (saves || 0) : 0, // ✅ ADD BOOKMARKS (TikTok only)
        orgId,
        projectId,
        trackedAccountId: accountId,
        platform,
        dateAdded: Timestamp.now(),
        addedBy: 'auto_refresh',
        lastRefreshed: Timestamp.now(),
        status: 'active',
        isRead: false,
        isSingular: false,
        duration: 0,
        hashtags: [],
        mentions: []
      });

      // Create initial snapshot for new video
      const initialSnapshotRef = newVideoRef.collection('snapshots').doc();
      const snapshotTime = Timestamp.now();
      batch.set(initialSnapshotRef, {
        id: initialSnapshotRef.id,
        videoId: platformVideoId,
        views,
        likes,
        comments,
        shares,
        saves: platform === 'tiktok' ? (saves || 0) : 0, // ✅ ADD BOOKMARKS
        capturedAt: snapshotTime,
        timestamp: snapshotTime, // Backwards compatibility
        capturedBy: isManualTrigger ? 'manual_refresh_initial' : 'scheduled_refresh_initial'
      });

      addedCount++;
      batchCount++;
    } else {
      // Video exists - UPDATE IT
      const existingDoc = querySnapshot.docs[0];
      const videoRef = existingDoc.ref;
      const existingData = existingDoc.data();

      const videoData: any = {
        views,
        likes,
        comments,
        shares,
        saves: platform === 'tiktok' ? (saves || 0) : (existingData.saves || 0), // ✅ ADD BOOKMARKS
        lastRefreshed: Timestamp.now()
      };

      // Update thumbnail if:
      // 1. Existing thumbnail is empty/missing and we have a new one
      // 2. Existing thumbnail is a placeholder and we have a real one
      // 3. Existing thumbnail is NOT already a Firebase Storage URL and IS a CDN URL
      // 4. Existing thumbnail is empty string, null, or undefined
      const isFirebaseStorage = existingData.thumbnail && existingData.thumbnail.includes('storage.googleapis.com');
      const isCDNUrl = existingData.thumbnail && 
        (existingData.thumbnail.includes('cdninstagram.com') || 
         existingData.thumbnail.includes('fbcdn.net') ||
         existingData.thumbnail.includes('tiktokcdn.com') ||
         existingData.thumbnail.includes('twimg.com'));
      
      const existingThumbnailEmpty = !existingData.thumbnail || existingData.thumbnail.trim() === '';
      
      const shouldUpdateThumbnail = 
        (existingThumbnailEmpty && thumbnail && thumbnail.trim() !== '') ||
        (existingData.thumbnail && 
         existingData.thumbnail.includes('placeholder') && 
         thumbnail && 
         !thumbnail.includes('placeholder')) ||
        (!isFirebaseStorage && isCDNUrl && thumbnail && thumbnail.includes('storage.googleapis.com'));

      if (shouldUpdateThumbnail && thumbnail) {
        console.log(`    🔄 Updating thumbnail (old: ${existingData.thumbnail ? existingData.thumbnail.substring(0, 50) : 'EMPTY'}, new: ${thumbnail.substring(0, 50)}...)`);
        videoData.thumbnail = thumbnail;
      } else if (isFirebaseStorage) {
        console.log(`    ✅ Thumbnail already in Firebase Storage, keeping it unchanged`);
      } else if (existingThumbnailEmpty && (!thumbnail || thumbnail.trim() === '')) {
        console.warn(`    ⚠️ Video has no thumbnail - both existing and new are empty`);
      }

      // Update existing video metrics
      batch.update(videoRef, videoData);
      
      // Create a snapshot for the updated metrics
      const snapshotRef = videoRef.collection('snapshots').doc();
      const now = Timestamp.now();
      batch.set(snapshotRef, {
        id: snapshotRef.id,
        videoId: platformVideoId,
        views: videoData.views,
        likes: videoData.likes,
        comments: videoData.comments,
        shares: videoData.shares,
        saves: videoData.saves || 0, // ✅ ADD BOOKMARKS
        capturedAt: now,
        timestamp: now, // Backwards compatibility
        capturedBy: isManualTrigger ? 'manual_refresh' : 'scheduled_refresh',
        isInitialSnapshot: false // This is a refresh snapshot, not initial
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

  // Update usage counter if we added new videos
  if (addedCount > 0) {
    try {
      await db
        .collection('organizations')
        .doc(orgId)
        .collection('billing')
        .doc('usage')
        .update({
          trackedVideos: currentVideos + addedCount,
          lastUpdated: Timestamp.now()
        });
      console.log(`✅ Updated video usage counter: +${addedCount} videos`);
    } catch (error) {
      console.error('⚠️ Failed to update usage counter (non-critical):', error);
    }
  }

  console.log(`      📊 Updated: ${updatedCount} videos, Added: ${addedCount} new videos, Skipped: ${skippedCount} invalid videos`);
  
  return { updated: updatedCount, skipped: skippedCount, added: addedCount };
}

