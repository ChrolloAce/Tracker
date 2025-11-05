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

    initializeApp({ credential: cert(serviceAccount as any) });
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

                // Update account lastSynced timestamp
                await accountDoc.ref.update({
                  lastSynced: new Date()
                });
                
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
    const bucket = storage.bucket();
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
    // Return the original URL as fallback (will work for TikTok/YouTube, but may fail for Instagram)
    // Better than placeholder as it might still work
    if (imageUrl.includes('cdninstagram') || imageUrl.includes('fbcdn')) {
      // Instagram URLs expire, return empty string instead
      console.warn(`    ⚠️ Instagram thumbnail download failed, returning empty (URL will expire anyway)`);
      return '';
    }
    console.warn(`    ⚠️ Using original URL as fallback: ${imageUrl.substring(0, 80)}...`);
    return imageUrl;
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
      // Parse new Instagram reels scraper format
      media = video.reel_data?.media || video.media || video;
      
      // Only process video content (media_type: 2 = video)
      if (media.media_type !== 2 && media.product_type !== 'clips') {
        continue;
      }
      
      platformVideoId = media.code || media.shortCode || media.id;
    } else if (platform === 'tiktok') {
      // TikTok API doesn't return an 'id' field, extract from webVideoUrl
      // URL format: https://www.tiktok.com/@username/video/7519910249533377823
      const urlMatch = (video.webVideoUrl || '').match(/video\/(\d+)/);
      platformVideoId = urlMatch ? urlMatch[1] : (video.id || video.videoId || '');
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
      // Use Instagram reels scraper field names
      views = media.play_count || media.ig_play_count || 0;
      likes = media.like_count || 0;
      comments = media.comment_count || 0;
      shares = 0; // Instagram API doesn't provide share count
      url = `https://www.instagram.com/reel/${media.code || media.shortCode}/`;
      
      // Get thumbnail from Instagram API (actual field structure)
      const instaThumbnail = 
        media.image_versions2?.additional_candidates?.first_frame?.url || 
        media.image_versions2?.candidates?.[0]?.url || 
        media.thumbnail_url || 
        media.display_url || 
        '';
      
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
        console.log(`    🔍 Available Instagram fields:`, Object.keys(media).slice(0, 20).join(', '));
      }
      caption = media.caption?.text || media.caption || '';
      uploadDate = media.taken_at ? new Date(media.taken_at * 1000) : new Date();
    } else if (platform === 'tiktok') {
      views = video.playCount || 0;
      likes = video.diggCount || 0;
      comments = video.commentCount || 0;
      shares = video.shareCount || 0;
      url = video.webVideoUrl || video.videoUrl || '';
      
      // Get thumbnail from TikTok API (field name has a dot in it, so use bracket notation)
      const tiktokThumbnail = video['videoMeta.coverUrl'] || 
                             video.videoMeta?.coverUrl || 
                             video.coverUrl || 
                             video.thumbnail || 
                             '';
      
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
      caption = video.text || '';
      uploadDate = video.createTime ? new Date(video.createTime * 1000) : new Date();
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

