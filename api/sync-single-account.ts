import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { initializeFirebase } from './utils/firebase-admin.js';
import { runApifyActor } from './apify-client.js';
import { ErrorNotificationService } from './services/ErrorNotificationService.js';
import { CleanupService } from './services/CleanupService.js';
import { ImageUploadService } from './services/sync/shared/ImageUploadService.js';
import { LockService } from './services/sync/shared/LockService.js';
import { InstagramSyncService } from './services/sync/instagram/InstagramSyncService.js';
import { TikTokSyncService } from './services/sync/tiktok/TikTokSyncService.js';
import { YoutubeSyncService } from './services/sync/youtube/YoutubeSyncService.js';
import { TwitterSyncService } from './services/sync/twitter/TwitterSyncService.js';
import { authenticateAndVerifyOrg, setCorsHeaders, handleCorsPreFlight, validateRequiredFields } from './middleware/auth.js';

// Initialize Firebase Admin
const { db } = initializeFirebase();

/**
 * Sync Single Account - Immediately processes one account
 * Called right after user adds an account for instant feedback
 * No auth required - this is a public endpoint for better UX
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  setCorsHeaders(res);
  
  // Handle preflight requests
  if (handleCorsPreFlight(req, res)) {
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, orgId, projectId } = req.body;
  const sessionId = req.body.sessionId || null;
  const jobId = req.body.jobId || null;

  console.log(`\n🎯 [SYNC-ACCOUNT] Received request for account: ${accountId}`);
  console.log(`   📦 Org: ${orgId}, Project: ${projectId}, Session: ${sessionId || 'none'}, Job: ${jobId || 'none'}`);

  // Validate required fields
  const validation = validateRequiredFields(req.body, ['accountId', 'orgId', 'projectId']);
  if (!validation.valid) {
    console.error(`❌ [SYNC-ACCOUNT] Validation failed: ${validation.missing.join(', ')}`);
    return res.status(400).json({ 
      error: 'Missing required parameters', 
      missing: validation.missing 
    });
  }

  // 🔒 Authenticate - either user (manual) or cron secret (automated)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isCronRequest = authHeader === cronSecret;
  const isManualSync = !isCronRequest; // Manual = user triggered, Scheduled = cron triggered
  
  console.log(`   🔐 Auth: ${isCronRequest ? 'CRON' : 'USER'} | Manual: ${isManualSync}`);
  
  if (isCronRequest) {
    console.log(`🔒 Authenticated as CRON job for sync request (SCHEDULED REFRESH)`);
  } else {
    // Regular user authentication
    try {
      const { user } = await authenticateAndVerifyOrg(req, orgId);
      console.log(`🔒 Authenticated user ${user.userId} for sync request (MANUAL ADD)`);
    } catch (authError: any) {
      console.error('❌ Authentication failed:', authError.message);
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: authError.message 
      });
    }
  }

    console.log(`⚡ Sync started for account: ${accountId} [${isManualSync ? 'MANUAL' : 'SCHEDULED'}]`);

  try {
    // Read job metadata to determine sync strategy
    let syncStrategy = 'progressive'; // default for backwards compatibility
    let maxVideosOverride: number | null = null;
    // TODO: SPIDERWEB - Variables kept for backwards compatibility, but phase spawning is disabled
    let isSpiderwebPhase = false; // Keep variable but don't use for spawning
    let spiderwebPhase: number | null = null; // Keep variable but don't use for spawning
    let existingVideoIdsFromJob: string[] = [];
    
    if (jobId) {
      try {
        const jobDoc = await db.collection('syncQueue').doc(jobId).get();
        if (jobDoc.exists) {
          const jobData = jobDoc.data();
          syncStrategy = jobData?.syncStrategy || 'progressive';
          maxVideosOverride = jobData?.maxVideos || null;
          // TODO: SPIDERWEB - Read but don't use for spawning new phases
          isSpiderwebPhase = jobData?.isSpiderwebPhase || false;
          spiderwebPhase = jobData?.spiderwebPhase || null;
          existingVideoIdsFromJob = jobData?.existingVideoIds || [];
          
          console.log(`   📋 Job strategy: ${syncStrategy}`);
          if (maxVideosOverride) console.log(`   📊 Max videos: ${maxVideosOverride}`);
          // Log spiderweb info if present (legacy jobs may have it)
          if (isSpiderwebPhase) console.log(`   🕸️  Spiderweb phase detected: ${spiderwebPhase} (phase spawning disabled)`);
        }
        
        // Update job status to running
        await db.collection('syncQueue').doc(jobId).update({
          status: 'running',
          startedAt: Timestamp.now()
        });
        console.log(`   📝 Job ${jobId} marked as running`);
      } catch (jobError: any) {
        console.warn(`   ⚠️  Failed to read/update job (non-critical):`, jobError.message);
      }
    }
    
    const accountRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('trackedAccounts')
      .doc(accountId);

    const accountDoc = await accountRef.get();

    if (!accountDoc.exists) {
      console.error(`❌ Account ${accountId} not found in Firestore!`);
      console.log(`   ℹ️  Account may have been deleted - cleaning up job if it exists...`);
      
      // If job exists, delete it (account was deleted)
      if (jobId) {
        try {
          await db.collection('syncQueue').doc(jobId).delete();
          console.log(`   ✅ Job ${jobId} deleted (account no longer exists)`);
        } catch (jobError: any) {
          console.warn(`   ⚠️  Failed to delete job (non-critical):`, jobError.message);
        }
      }
      
      return res.status(404).json({ 
        error: 'Account not found',
        message: 'Account may have been deleted'
      });
    }

    // ==================== FIX #1: JOB-LEVEL LOCKING ====================
    // Prevent multiple simultaneous syncs for the same account
    const lockKey = jobId || `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const lockResult = await LockService.acquireLock(accountRef, lockKey, 5);
    
    if (!lockResult.acquired) {
      console.log(`⏭️  Account ${accountId} is locked by another job (age: ${lockResult.lockAge}s), skipping to prevent duplicates`);
      
      // Delete this job since account is being processed
      if (jobId) {
        try {
          await db.collection('syncQueue').doc(jobId).delete();
          console.log(`   ✅ Job ${jobId} deleted (duplicate prevented)`);
        } catch (err: any) {
          console.warn(`   ⚠️  Could not delete job:`, err.message);
        }
      }
      
      return res.status(200).json({ 
        success: true,
        skipped: true,
        reason: lockResult.reason,
        lockAge: lockResult.lockAge
      });
    }
    console.log(`🔒 Acquired sync lock: ${lockKey}`);
    // ==================== END FIX #1 ====================

    const account = accountDoc.data() as any;
    
    console.log(`📊 Account info: @${account.username} (${account.platform})`);
    console.log(`   🔹 Creator Type: ${account.creatorType || 'automatic'}`);
    console.log(`   🔹 Is Active: ${account.isActive}`);
    console.log(`   🔹 Last synced: ${account.lastRefreshed?.toDate() || 'Never'}`);
    console.log(`   🔹 Total Videos: ${account.totalVideos || 0}`);
    console.log(`   🔹 Sync Status: ${account.syncStatus || 'unknown'}`);
    
    // Get maxVideos from account settings, default to 100 if not set
    const maxVideos = account.maxVideos || 100;
    console.log(`📊 Will scrape up to ${maxVideos} videos for @${account.username}`);

    // Update to syncing status (check account still exists first)
    try {
      const accountCheckDoc = await accountRef.get();
      if (!accountCheckDoc.exists) {
        console.log(`⚠️  Account ${accountId} was deleted before sync started`);
        if (jobId) {
          await db.collection('syncQueue').doc(jobId).delete();
          console.log(`✅ Job ${jobId} deleted (account deleted before sync)`);
        }
        return res.status(404).json({ 
          error: 'Account not found',
          message: 'Account may have been deleted'
        });
      }
      
      await accountRef.update({
        syncStatus: 'syncing',
        syncProgress: {
          current: 10,
          total: 100,
          message: 'Starting sync...'
        }
      });
    } catch (error: any) {
      console.error(`❌ Error updating account to syncing:`, error.message);
      throw error;
    }

    // Fetch profile data if needed
    if (!account.displayName || account.displayName === account.username) {
      console.log(`👤 Fetching profile data for ${account.username}...`);
      
      try {
        const accountCheckDoc = await accountRef.get();
        if (accountCheckDoc.exists) {
          await accountRef.update({
            displayName: account.username.charAt(0).toUpperCase() + account.username.slice(1)
          });
        }
      } catch (error: any) {
        console.warn(`⚠️  Could not update display name:`, error.message);
      }
    }

    // Fetch videos based on platform
    let videos = [];

    if (account.platform === 'tiktok') {
      console.log(`🎵 Fetching TikTok videos for ${account.username}...`);
      
      try {
        const creatorType = account.creatorType || 'automatic';
        console.log(`🔧 Account type: ${creatorType}`);
        
        let newTikTokVideos: any[] = [];
        let existingVideoIds = new Set<string>();
        
        // Get existing video IDs
        const existingVideosSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('videos')
          .where('trackedAccountId', '==', accountId)
          .where('platform', '==', 'tiktok')
          .select('videoId')
          .get();
        
        existingVideoIds = new Set(
          existingVideosSnapshot.docs.map(doc => doc.data().videoId).filter(Boolean)
        );
        
        console.log(`📊 Found ${existingVideoIds.size} existing TikTok videos in database`);
        
        // ===== NEW VIDEO DISCOVERY =====
        if (syncStrategy !== 'refresh_only' && creatorType === 'automatic') {
          const result = await TikTokSyncService.discovery(account, orgId, existingVideoIds);
          newTikTokVideos = result.videos;
          
          // Profile handling from discovery result
          if (result.profile) {
             const profile = result.profile;
             console.log(`✅ Fetched profile: ${profile.followersCount || 0} followers`);
             
             const profileUpdates: any = {
               displayName: profile.displayName,
               followerCount: profile.followersCount || 0,
               followingCount: profile.followingCount || 0,
               isVerified: profile.isVerified || false
             };
             
             if (profile.profilePicUrl) {
               try {
                 const uploadedProfilePic = await ImageUploadService.downloadAndUpload(
                   profile.profilePicUrl,
                   orgId,
                   `tiktok_profile_${account.username}.jpg`,
                   'profile'
                 );
                 profileUpdates.profilePicture = uploadedProfilePic;
               } catch (err: any) {
                 console.warn('⚠️ Could not upload profile pic:', err.message);
               }
             }
             
             await accountRef.update(profileUpdates);
          }
        } else if (syncStrategy === 'refresh_only') {
          console.log(`🔄 [TIKTOK] Refresh-only mode - skipping new video discovery`);
        } else {
          console.log(`🔒 [TIKTOK] Static account - skipping new video discovery`);
        }
        
        const tiktokVideos = newTikTokVideos;
        
        // ===== REFRESH EXISTING VIDEOS =====
        if (existingVideoIds.size > 0) {
          try {
            const refreshedVideos = await TikTokSyncService.refresh(account, orgId, Array.from(existingVideoIds));
            
            // Mark refreshed videos as refresh-only (important!)
            const markedRefreshedVideos = refreshedVideos.map((v: any) => ({
              ...v,
              _isRefreshOnly: true
            }));
            
            tiktokVideos.push(...markedRefreshedVideos);
          } catch (refreshError) {
            console.error('⚠️ [TIKTOK] Failed to refresh existing videos (non-fatal):', refreshError);
          }
        }
        
        console.log(`📊 [TIKTOK] Processing ${tiktokVideos.length} videos`);
        videos = tiktokVideos;
        
      } catch (tiktokError) {
        console.error('TikTok fetch error:', tiktokError);
        throw tiktokError;
      }
    } else if (account.platform === 'youtube') {
      console.log(`📺 Fetching YouTube Shorts for ${account.username}...`);
      
      try {
        const creatorType = account.creatorType || 'automatic';
        console.log(`🔧 Account type: ${creatorType}`);
        
        let newYouTubeVideos: any[] = [];
        const channelHandle = account.username.startsWith('@') ? account.username : `@${account.username}`;
        
        // Get existing video IDs
        const existingVideosSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('videos')
          .where('trackedAccountId', '==', accountId)
          .where('platform', '==', 'youtube')
          .select('videoId')
          .get();
        
        const existingVideoIds = new Set(
          existingVideosSnapshot.docs.map(doc => doc.data().videoId).filter(Boolean)
        );
        
        console.log(`📊 Found ${existingVideoIds.size} existing YouTube Shorts in database`);
        
        // ===== NEW VIDEO DISCOVERY =====
        if (syncStrategy !== 'refresh_only' && creatorType === 'automatic') {
          // Pass channel handle via username, and ID if present
          const result = await YoutubeSyncService.discovery(account, orgId, existingVideoIds);
          newYouTubeVideos = result.videos;
          
          // Profile handling
          if (result.profile) {
             const profile = result.profile;
             console.log(`✅ Fetched profile: ${profile.followersCount || 0} subscribers`);
             
             const profileUpdates: any = {
               displayName: profile.displayName,
               followerCount: profile.followersCount || 0,
               isVerified: profile.isVerified || false
             };
             
             if (profile.profilePicUrl) {
               try {
                 const uploadedProfilePic = await ImageUploadService.downloadAndUpload(
                   profile.profilePicUrl,
                   orgId,
                   `youtube_profile_${account.username}.jpg`,
                   'profile'
                 );
                 profileUpdates.profilePicture = uploadedProfilePic;
               } catch (err: any) {
                 console.warn('⚠️ Could not upload profile pic:', err.message);
               }
             }
             
             await accountRef.update(profileUpdates);
          }
        } else if (syncStrategy === 'refresh_only') {
          console.log(`🔄 [YOUTUBE] Refresh-only mode - skipping new video discovery`);
        } else {
          console.log(`🔒 [YOUTUBE] Static account - skipping new video discovery`);
        }
        
        const youtubeVideos = newYouTubeVideos;
        
        // ===== REFRESH EXISTING VIDEOS =====
        if (existingVideoIds.size > 0) {
          try {
            const refreshedVideos = await YoutubeSyncService.refresh(account, orgId, Array.from(existingVideoIds));
            youtubeVideos.push(...refreshedVideos);
          } catch (refreshError) {
            console.error('⚠️ [YOUTUBE] Failed to refresh existing videos (non-fatal):', refreshError);
          }
        }
        
        console.log(`📊 [YOUTUBE] Processing ${youtubeVideos.length} videos`);
        videos = youtubeVideos;
        
      } catch (youtubeError) {
        console.error('YouTube fetch error:', youtubeError);
        throw youtubeError;
      }
    } else if (account.platform === 'twitter') {
      console.log(`🐦 Fetching tweets for ${account.username}...`);
      
      try {
        // 1. Fetch Profile Data
        try {
           const profile = await TwitterSyncService.getProfile(account.username);
           
           if (profile) {
             console.log(`✅ Fetched profile: ${profile.followersCount} followers`);
             
             const profileUpdates: any = {
                displayName: profile.displayName,
                followerCount: profile.followersCount,
                followingCount: profile.followingCount,
                isVerified: profile.isVerified
             };
             
             if (profile.profilePicUrl) {
                try {
                    const uploadedProfilePic = await ImageUploadService.downloadAndUpload(
                        profile.profilePicUrl,
                        orgId,
                        `twitter_profile_${account.username}.jpg`,
                        'profile'
                    );
                    profileUpdates.profilePicture = uploadedProfilePic;
                } catch (uploadError: any) {
                    console.warn('⚠️ Could not upload profile pic:', uploadError.message);
                }
             }
             
             await accountRef.update(profileUpdates);
           }
        } catch (profileError) {
             console.error('Profile fetch error:', profileError);
        }
      
        const creatorType = account.creatorType || 'automatic';
        console.log(`🔧 Account type: ${creatorType}`);
        
        let newTweets: any[] = [];
        
        // Get existing tweet IDs
        const existingTweetsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('videos')
          .where('trackedAccountId', '==', accountId)
          .where('platform', '==', 'twitter')
          .select('videoId')
          .get();
        
        const existingTweetIds = new Set(
          existingTweetsSnapshot.docs.map(doc => doc.data().videoId).filter(Boolean)
        );
        
        console.log(`📊 Found ${existingTweetIds.size} existing tweets in database`);
        
        // ===== NEW TWEET DISCOVERY =====
        if (syncStrategy !== 'refresh_only' && creatorType === 'automatic') {
           newTweets = await TwitterSyncService.discovery(account, orgId, existingTweetIds);
        } else if (syncStrategy === 'refresh_only') {
           console.log(`🔄 [TWITTER] Refresh-only mode - skipping new tweet discovery`);
        } else {
           console.log(`🔒 [TWITTER] Static account - skipping new tweet discovery`);
        }
        
        const tweets = newTweets;
        
        // ===== REFRESH EXISTING TWEETS =====
        if (existingTweetIds.size > 0) {
           try {
             const refreshedTweets = await TwitterSyncService.refresh(account, orgId, Array.from(existingTweetIds));
             tweets.push(...refreshedTweets);
           } catch (refreshError) {
             console.error('⚠️ [TWITTER] Failed to refresh existing tweets (non-fatal):', refreshError);
           }
        }
        
        console.log(`📊 [TWITTER] Processing ${tweets.length} tweets`);
        videos = tweets;
        
      } catch (twitterError) {
        console.error('Twitter fetch error:', twitterError);
        throw twitterError;
      }
    } else if (account.platform === 'instagram') {
      console.log(`👤 Fetching Instagram reels for ${account.username}...`);
      
      try {
        const creatorType = account.creatorType || 'automatic';
        console.log(`🔧 Account type: ${creatorType}`);
        
        let newInstagramReels: any[] = [];
        let existingVideoIds = new Set<string>();
        
        // Get existing video IDs (used for duplicate checking)
        const existingVideosSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('videos')
          .where('trackedAccountId', '==', accountId)
          .where('platform', '==', 'instagram')
          .select('videoId')
          .get();
        
        existingVideoIds = new Set(
          existingVideosSnapshot.docs.map(doc => doc.data().videoId).filter(Boolean)
        );
        
        console.log(`📊 Found ${existingVideoIds.size} existing Instagram reels in database`);
        
        // ===== NEW VIDEO DISCOVERY (only if NOT refresh_only) =====
        if (syncStrategy !== 'refresh_only' && creatorType === 'automatic') {
          const result = await InstagramSyncService.discovery(account, orgId, existingVideoIds);
          newInstagramReels = result.videos;
          
          // TODO: SPIDERWEB - Re-enable later (multi-phase discovery)
          // if (useProgressiveFetch && !result.foundDuplicate) { ... }
        } else if (syncStrategy === 'refresh_only') {
          console.log(`🔄 [INSTAGRAM] Refresh-only mode - skipping new video discovery`);
        } else {
          console.log(`🔒 [INSTAGRAM] Static account - skipping new video discovery`);
        }
        
        const instagramItems = newInstagramReels;
        console.log(`📊 [INSTAGRAM] Processing ${instagramItems.length} new reels`);
        
        // ===== REFRESH EXISTING REELS (runs for ALL accounts with existing videos) =====
        if (existingVideoIds.size > 0) {
          console.log(`🔄 Fetching updated metrics for existing reels...`);
          
          try {
            const refreshedReels = await InstagramSyncService.refresh(account, orgId, Array.from(existingVideoIds));
            
            // Handle errors and add valid ones
            for (const reel of refreshedReels) {
              if (reel.isError) {
                console.warn(`⚠️ [INSTAGRAM] Video error: ${reel.error}`);
                console.warn(`   Input URL: ${reel.input}`);
                
                // Extract video code from URL to mark it in database
                const urlMatch = reel.input?.match(/\/p\/([^\/]+)/);
                const videoCode = urlMatch ? urlMatch[1] : null;
                
                if (videoCode) {
                  console.log(`🔍 Marking video ${videoCode} as deleted/restricted in database...`);
                  
                  const videoQuery = await db
                    .collection('organizations')
                    .doc(orgId)
                    .collection('projects')
                    .doc(projectId)
                    .collection('videos')
                    .where('videoId', '==', videoCode)
                    .where('platform', '==', 'instagram')
                    .limit(1)
                    .get();
                  
                  if (!videoQuery.empty) {
                    const videoRef = videoQuery.docs[0].ref;
                    await videoRef.update({
                      status: 'error',
                      lastRefreshError: reel.error,
                      lastRefreshed: Timestamp.now(),
                      errorDetails: {
                        type: reel.error.includes('Restricted') ? 'restricted' : 
                              reel.error.includes('private') ? 'private' : 'deleted',
                        message: reel.error,
                        detectedAt: Timestamp.now()
                      }
                    });
                    console.log(`✅ Marked video ${videoCode} with error status: ${reel.error}`);
                  }
                }
                continue;
              }
              
              // Add refreshed reels to instagramItems array (will be processed together)
              instagramItems.push(reel);
            }
          } catch (refreshError) {
            console.error('⚠️ Failed to refresh existing reels (non-fatal):', refreshError);
          }
        }
        
        console.log(`📦 Total reels to process: ${instagramItems.length}`);
        
        // Profile Update
        try {
          const profile = await InstagramSyncService.getProfile(account.username);
          if (profile) {
            console.log(`✅ Fetched profile: ${profile.followersCount || 0} followers`);
            
            const profileUpdates: any = {
              displayName: profile.fullName || account.username,
              followerCount: profile.followersCount || 0,
              followingCount: profile.followsCount || 0,
              isVerified: profile.verified || false
            };

            if (profile.profilePicUrl) {
              try {
                console.log(`📸 Downloading Instagram profile pic for @${account.username}...`);
                const uploadedProfilePic = await ImageUploadService.downloadAndUpload(
                  profile.profilePicUrl,
                  orgId,
                  `instagram_profile_${account.username}.jpg`,
                  'profile'
                );
                profileUpdates.profilePicture = uploadedProfilePic;
                console.log(`✅ Instagram profile picture uploaded to Firebase Storage`);
              } catch (uploadError: any) {
                console.error(`❌ Error uploading Instagram profile picture:`, uploadError);
                console.warn(`⚠️ Skipping profile picture - will retry on next sync`);
              }
            }

            await accountRef.update(profileUpdates);
            console.log(`✅ Updated Instagram profile: ${profile.fullName || account.username}`);
          }
        } catch (profileError) {
          console.error(`❌ Failed to fetch profile via apify/instagram-profile-scraper:`, profileError);
        }
        
        // Items are already normalized by the service!
        videos = instagramItems;
        
      } catch (instagramError) {
        console.error('❌ Instagram fetch error:', instagramError);
        throw instagramError;
      }
    }

    console.log(`📊 Found ${videos.length} videos/posts`);

    // Update progress
    await accountRef.update({
      syncProgress: {
        current: 50,
        total: 100,
        message: `Saving ${videos.length} videos...`
      }
    });

    // Save videos to Firestore (BOTH locations for compatibility)
    const batch = db.batch();
    let savedCount = 0;

    for (const video of videos) {
      // Download and upload thumbnail to Firebase Storage (REQUIRED - no fallback to direct URLs)
      let firebaseThumbnailUrl = '';
      if (video.thumbnail && video.thumbnail.startsWith('http')) {
        try {
          console.log(`    📸 [${account.platform.toUpperCase()}] Downloading thumbnail for video ${video.videoId}...`);
          console.log(`    🌐 [${account.platform.toUpperCase()}] Thumbnail URL: ${video.thumbnail.substring(0, 100)}...`);
          firebaseThumbnailUrl = await ImageUploadService.downloadAndUpload(
            video.thumbnail,
            orgId,
            `${account.platform}_${video.videoId}_thumb.jpg`,
            'thumbnails'
          );
          console.log(`    ✅ [${account.platform.toUpperCase()}] Thumbnail uploaded to Firebase Storage: ${firebaseThumbnailUrl}`);
        } catch (thumbError) {
          console.error(`    ❌ [${account.platform.toUpperCase()}] Thumbnail upload failed for ${video.videoId}:`, thumbError);
          // DO NOT use direct URLs as fallback (they expire)
          // Leave empty - will retry on next sync
          console.warn(`    ⚠️ [${account.platform.toUpperCase()}] No fallback - thumbnail will retry on next sync`);
        }
      } else {
        console.warn(`    ⚠️ [${account.platform.toUpperCase()}] No valid thumbnail URL for video ${video.videoId}`);
      }

      // ==================== FIX #2 & #3: DETERMINISTIC IDs + NO DUPLICATES ====================
      // Use deterministic doc ID: {platform}_{accountId}_{videoId}
      // This prevents race conditions - if 2 jobs try to create same video, only one succeeds
      const videoDocId = `${account.platform}_${accountId}_${video.videoId}`;
      const videoRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('videos')
        .doc(videoDocId); // DETERMINISTIC ID

      const snapshotTime = Timestamp.now();
      const isManualTrigger = account.syncRequestedBy ? true : false;

      // Check if video already exists (fast doc.get instead of query)
      const existingVideo = await videoRef.get();
      const isRefreshOnly = video._isRefreshOnly === true;
        
      if (existingVideo.exists) {
        // VIDEO EXISTS - Update metrics only (and thumbnail if we have a new one)
        const updateData: any = {
          views: video.views || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          saves: video.saves || 0,
          lastRefreshed: snapshotTime
        };
        
        // Update thumbnail only if we have a new one
        if (firebaseThumbnailUrl) {
          updateData.thumbnail = firebaseThumbnailUrl;
        }
        
        // For non-refresh videos, also update title/date if provided
        // (Refresh-only videos should NEVER overwrite title/date)
        if (!isRefreshOnly) {
          if (video.videoTitle) {
            updateData.videoTitle = video.videoTitle;
          }
          if (video.uploadDate) {
            updateData.uploadDate = video.uploadDate;
          }
        }
        
        batch.update(videoRef, updateData);

        // ==================== FIX #4: SNAPSHOT DEDUPLICATION ====================
        // Check for recent snapshot to prevent duplicates
        const fiveMinutesAgo = Timestamp.fromMillis(snapshotTime.toMillis() - (5 * 60 * 1000));
        const recentSnapshotQuery = await videoRef.collection('snapshots')
          .where('capturedAt', '>=', fiveMinutesAgo)
          .limit(1)
          .get();

        if (!recentSnapshotQuery.empty) {
          const snapshotAge = Math.round((snapshotTime.toMillis() - recentSnapshotQuery.docs[0].data().capturedAt.toMillis()) / 1000);
          console.log(`    ⏭️  Skipping snapshot for ${video.videoId} - recent one exists (${snapshotAge}s ago)`);
        } else {
        // Create refresh snapshot
        const snapshotRef = videoRef.collection('snapshots').doc();
        batch.set(snapshotRef, {
          id: snapshotRef.id,
          videoId: video.videoId,
          views: video.views || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          saves: video.saves || 0,
          capturedAt: snapshotTime,
          timestamp: snapshotTime,
          capturedBy: isManualTrigger ? 'manual_refresh' : 'scheduled_refresh',
            isInitialSnapshot: false
        });
          console.log(`    🔄 Updated video ${video.videoId} + created refresh snapshot`);
        }
      } else {
        // Video doesn't exist
        
        if (isRefreshOnly) {
          // CRITICAL: Refresh-only videos should NEVER create new entries
          // If video doesn't exist, it was probably deleted - skip it
          console.log(`    ⏭️  Skipping refresh-only video ${video.videoId} - doesn't exist in DB (likely deleted)`);
          continue; // Skip to next video
        }
        
        // NEW VIDEO - Create with initial snapshot (only for discovery, not refresh)
        // Remove internal flags before saving
        const { _isRefreshOnly, ...cleanVideoData } = video;
        
      batch.set(videoRef, {
        ...cleanVideoData,
          thumbnail: firebaseThumbnailUrl,
        orgId: orgId,
        projectId: projectId,
        trackedAccountId: accountId,
        platform: account.platform,
          dateAdded: snapshotTime,
        addedBy: account.syncRequestedBy || account.addedBy || 'system',
          lastRefreshed: snapshotTime,
        status: 'active',
        isRead: false,
        isSingular: false
      });

        // Create initial snapshot (no deduplication needed for new videos)
      const snapshotRef = videoRef.collection('snapshots').doc();
      batch.set(snapshotRef, {
        id: snapshotRef.id,
        videoId: video.videoId,
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0,
        shares: video.shares || 0,
          saves: video.saves || 0,
        capturedAt: snapshotTime,
        timestamp: snapshotTime,
          capturedBy: 'initial_sync',
          isInitialSnapshot: true
      });

        console.log(`    ✅ Created new video ${video.videoId} + initial snapshot`);
      }
      // ==================== FIX #3: REMOVED DUPLICATE SUBCOLLECTION ====================
      // The accountVideoRef subcollection was causing duplicate entries - REMOVED!
      // Videos are stored ONCE in /organizations/{org}/projects/{project}/videos/{deterministicId}

      savedCount++;

      // Commit in batches of 500 (Firestore limit)
      if (savedCount % 500 === 0) {
        await batch.commit();
      }
    }

    // Commit remaining
    if (savedCount % 500 !== 0) {
      await batch.commit();
    }

    // Mark as completed (but first check if account still exists)
    try {
      const accountCheckDoc = await accountRef.get();
      
      if (!accountCheckDoc.exists) {
        console.log(`⚠️  Account ${accountId} was deleted during sync - discarding results`);
        
        // Delete job if it exists
        if (jobId) {
          await db.collection('syncQueue').doc(jobId).delete();
          console.log(`✅ Job ${jobId} deleted (account was deleted during sync)`);
        }
        
        return res.status(200).json({
          success: true,
          message: 'Account was deleted during sync - results discarded',
          accountId,
          videosSynced: 0
        });
      }
      
      // Account still exists - update it
      await accountRef.update({
        syncStatus: 'completed',
        lastSyncAt: Timestamp.now(),
        lastSynced: Timestamp.now(),
        lastRefreshed: Timestamp.now(), // Update lastRefreshed for UI display
        lastSyncError: null,
        syncRetryCount: 0,
        syncProgress: {
          current: 100,
          total: 100,
          message: `Successfully synced ${savedCount} videos`
        }
      });

      console.log(`✅ Completed immediate sync: ${account.username} - ${savedCount} videos saved`);
      console.log(`📊 Summary: Org=${orgId}, Project=${projectId}, Account=${accountId}, Videos=${savedCount}, Session=${sessionId || 'none'}`);
    } catch (checkError: any) {
      console.error(`❌ Error checking/updating account status:`, checkError.message);
      // Continue anyway - don't fail the whole sync
    }

    // NOTE: Email notifications are handled by cron-orchestrator.ts
    // which sends a single summary email per organization instead of individual emails per account.
    // This prevents email spam and provides a better user experience with aggregated stats.

    // 🧹 Auto-cleanup: Delete any invalid videos/accounts (no username, no stats, etc.)
    try {
      console.log(`🧹 Running auto-cleanup for invalid videos/accounts...`);
      const cleanupStats = await CleanupService.runFullCleanup(orgId, projectId);
      console.log(`✅ Cleanup complete: ${cleanupStats.videosDeleted} videos, ${cleanupStats.accountsDeleted} accounts deleted`);
    } catch (cleanupError) {
      console.error('❌ Cleanup failed (non-fatal):', cleanupError);
      // Don't fail the request if cleanup fails
    }

    // ===============================================================================
    // 📊 SESSION TRACKING & "LAST ONE OUT" EMAIL
    // ===============================================================================
    // If this sync is part of a coordinated refresh session (from cron orchestrator),
    // track progress and send email when ALL accounts in the org have completed.
    // sessionId is already extracted at the top of the function
    
    if (sessionId) {
      try {
        console.log(`📊 Updating session progress: ${sessionId}`);
        
        // Get current account stats for email
        const accountSnapshot = await accountRef.get();
        const accountData = accountSnapshot.data() as any;
        const currentViews = accountData?.totalViews || 0;
        const currentLikes = accountData?.totalLikes || 0;
        const currentComments = accountData?.totalComments || 0;
        const currentShares = accountData?.totalShares || 0;
        
        const sessionRef = db
          .collection('organizations')
          .doc(orgId)
          .collection('refreshSessions')
          .doc(sessionId);
        
        // Atomically increment completed count and add account stats
        await sessionRef.update({
          completedAccounts: FieldValue.increment(1),
          totalVideos: FieldValue.increment(savedCount),
          totalViews: FieldValue.increment(currentViews),
          totalLikes: FieldValue.increment(currentLikes),
          totalComments: FieldValue.increment(currentComments),
          totalShares: FieldValue.increment(currentShares),
          [`accountStats.${accountId}`]: {
            username: account.username,
            platform: account.platform,
            videosSynced: savedCount,
            views: currentViews,
            likes: currentLikes,
            comments: currentComments,
            shares: currentShares,
            displayName: accountData?.displayName || account.username,
            profilePicture: accountData?.profilePicture || ''
          }
        });
        
        // Check if this is the last account to complete ("last one out")
        const sessionSnapshot = await sessionRef.get();
        const session = sessionSnapshot.data() as any;
        
        if (session && session.completedAccounts === session.totalAccounts) {
          console.log(`🎉 Last account completed! Sending summary email...`);
          
          // Mark session as completed
          await sessionRef.update({
            status: 'completed',
            completedAt: Timestamp.now()
          });
          
          // Send summary email
          await sendRefreshSummaryEmail(session, db);
          
          // Mark email as sent
          await sessionRef.update({
            emailSent: true,
            emailSentAt: Timestamp.now()
          });
          
          console.log(`✅ Summary email sent successfully`);
        } else {
          console.log(`⏳ Session progress: ${session?.completedAccounts || 0}/${session?.totalAccounts || 0} accounts`);
        }
        
      } catch (sessionError: any) {
        console.error('❌ Session tracking failed (non-critical):', sessionError.message);
        // Don't fail the request if session tracking fails
      }
    }

    // Delete completed job from queue
    if (jobId) {
      try {
        await db.collection('syncQueue').doc(jobId).delete();
        console.log(`   ✅ Job ${jobId} deleted from queue (${savedCount} videos synced)`);
      } catch (jobError: any) {
        console.warn(`   ⚠️  Failed to delete job (non-critical):`, jobError.message);
      }
    }
    
    console.log(`\n✅ [SYNC-ACCOUNT] Successfully completed sync for @${account.username}`);
    console.log(`   📊 Final stats: ${savedCount} videos, Session: ${sessionId || 'none'}, Job: ${jobId || 'none'}\n`);
    
    // Release sync lock
    await LockService.releaseLock(accountRef, lockKey);
    
    return res.status(200).json({
      success: true,
      message: 'Account synced successfully',
      videosCount: savedCount,
      username: account.username
    });

  } catch (error: any) {
    console.error(`❌ [SYNC-ACCOUNT] Error for account ${accountId}:`, error.message);
    console.error(`   Stack trace:`, error.stack);

    // Release sync lock on error
    try {
      const accountRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .doc(accountId);
      
      await LockService.releaseLock(accountRef, lockKey);
    } catch (unlockError: any) {
      console.warn(`⚠️  Failed to release lock on error (non-critical):`, unlockError.message);
    }

    // Update job status on error if jobId provided
    if (jobId) {
      try {
        const jobDoc = await db.collection('syncQueue').doc(jobId).get();
        const jobData = jobDoc.data();
        
        if (jobData) {
          const attempts = jobData.attempts || 0;
          const maxAttempts = jobData.maxAttempts || 3;
          
          if (attempts + 1 >= maxAttempts) {
            // Max retries exceeded - mark as failed
            await db.collection('syncQueue').doc(jobId).update({
              status: 'failed',
              completedAt: Timestamp.now(),
              attempts: attempts + 1,
              error: error.message || String(error)
            });
            console.log(`   ❌ Job ${jobId} marked as failed (max retries exceeded)`);
          } else {
            // Reset to pending for retry
            await db.collection('syncQueue').doc(jobId).update({
              status: 'pending',
              attempts: attempts + 1,
              error: error.message || String(error),
              startedAt: null
            });
            console.log(`   🔄 Job ${jobId} reset to pending for retry (attempt ${attempts + 1}/${maxAttempts})`);
          }
        }
      } catch (jobError: any) {
        console.warn(`   ⚠️  Failed to update job status (non-critical):`, jobError.message);
      }
    }

    // Mark account with error status and send notifications
    try {
      const accountRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .doc(accountId);

      // Get account data for error notification
      const accountDoc = await accountRef.get();
      const account = accountDoc.data();

      await accountRef.update({
        syncStatus: 'error',
        hasError: true,
        lastSyncError: error.message || String(error),
        lastSyncErrorAt: Timestamp.now(),
        syncRetryCount: (account?.syncRetryCount || 0) + 1,
        syncProgress: {
          current: 0,
          total: 100,
          message: `Error: ${error.message || String(error)}`
        }
      });

      // Send error notification email and log to Firestore
      await ErrorNotificationService.notifyError({
        type: 'account_sync',
        platform: account?.platform || 'unknown',
        accountId: accountId,
        username: account?.username || 'unknown',
        errorMessage: error.message || String(error),
        errorStack: error.stack,
        orgId: orgId,
        projectId: projectId,
        timestamp: new Date(),
        attemptNumber: (account?.syncRetryCount || 0) + 1
      });
    } catch (updateError) {
      console.error('Failed to update account status:', updateError);
    }

    return res.status(500).json({
      success: false,
      error: error.message || String(error),
      message: 'Sync failed - admin notified'
    });
  }
}

/**
 * Send refresh summary email after all accounts in an organization have completed syncing
 * This implements the "last one out" pattern - only the final account to complete triggers the email
 * 
 * Shows DELTA metrics (what changed since last refresh) not absolute totals
 */
async function sendRefreshSummaryEmail(session: any, db: any) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not set - skipping email');
    return;
  }
  
  if (!session.ownerEmail) {
    console.warn('⚠️ No owner email found - skipping email');
    return;
  }
  
  console.log(`📧 Preparing email for: ${session.ownerEmail} (Org: ${session.orgName})`);
  console.log(`   Owner ID: ${session.ownerId || 'Not set'}`);
  console.log(`   Org ID: ${session.orgId}`);
  
  // Calculate time since last refresh (not this session duration)
  let timeSinceLastRefreshText = 'first refresh';
  let timeSinceLastRefreshMs = 0;
  
  if (session.previousRefreshTimestamp) {
    timeSinceLastRefreshMs = Date.now() - session.previousRefreshTimestamp.toMillis();
    const hours = Math.floor(timeSinceLastRefreshMs / (1000 * 60 * 60));
    const minutes = Math.floor((timeSinceLastRefreshMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      timeSinceLastRefreshText = `${days}d`;
    } else if (hours > 0) {
      timeSinceLastRefreshText = `${hours}h`;
    } else if (minutes > 0) {
      timeSinceLastRefreshText = `${minutes}m`;
    } else {
      timeSinceLastRefreshText = '<1m';
    }
  }
  
  // Calculate DELTA metrics (what changed since last refresh)
  const viewsGained = Math.max(0, (session.totalViews || 0) - (session.previousTotalViews || 0));
  const likesGained = Math.max(0, (session.totalLikes || 0) - (session.previousTotalLikes || 0));
  const commentsGained = Math.max(0, (session.totalComments || 0) - (session.previousTotalComments || 0));
  const sharesGained = Math.max(0, (session.totalShares || 0) - (session.previousTotalShares || 0));
  const linkClicksGained = Math.max(0, (session.totalLinkClicks || 0) - (session.previousTotalLinkClicks || 0));
  
  // Calculate engagement rate from deltas
  const totalEngagement = likesGained + commentsGained + sharesGained;
  const engagementRate = viewsGained > 0 
    ? ((totalEngagement / viewsGained) * 100).toFixed(2)
    : '0.00';
  
  // Get top 5 videos from THIS refresh cycle (sorted by views)
  console.log(`🔍 Fetching top videos from this refresh...`);
  const videosSnapshot = await db
    .collectionGroup('videos')
    .where('lastRefreshed', '>=', session.startedAt)
    .orderBy('lastRefreshed', 'desc')
    .orderBy('viewCount', 'desc')
    .limit(50) // Get more to filter to org
    .get();
  
  // Filter to only videos from this org
  const orgVideos = videosSnapshot.docs.filter((doc: any) => {
    const path = doc.ref.path;
    return path.includes(`organizations/${session.orgId}/`);
  });
  
  const topVideos = orgVideos.slice(0, 5);
  console.log(`   Found ${topVideos.length} top videos from this refresh`);
  
  // Sort accounts by views gained (top performers)
  const accountStats = Object.values(session.accountStats || {}) as any[];
  const topPerformers = accountStats
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5);
  
  // Generate top videos HTML from this refresh
  const topVideosHtml = topVideos
    .map((videoDoc: any, index: number) => {
      const video = videoDoc.data();
      const rankEmoji = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index];
      const platform = video.platform || 'unknown';
      const platformEmoji = platform === 'tiktok' ? '📱' : platform === 'youtube' ? '▶️' : platform === 'instagram' ? '📷' : '🐦';
      
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <div>
              <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${rankEmoji} ${video.title || 'Untitled'}</div>
              <div style="font-size: 12px; color: #6b7280;">${platformEmoji} ${platform.charAt(0).toUpperCase() + platform.slice(1)} • @${video.accountUsername || 'Unknown'}</div>
            </div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            <div style="font-weight: 600; color: #667eea;">${(video.viewCount || 0).toLocaleString()}</div>
            <div style="font-size: 11px; color: #6b7280;">views</div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            <div style="font-weight: 600; color: #f56565;">${(video.likeCount || 0).toLocaleString()}</div>
            <div style="font-size: 11px; color: #6b7280;">likes</div>
          </td>
        </tr>
      `;
    })
    .join('');
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 48px 40px; text-align: center;">
                    <img src="https://www.viewtrack.app/whitelogo.png" alt="ViewTrack" style="height: 40px; width: auto; margin-bottom: 20px;" />
                    <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                      ${session.orgName}
                    </h1>
                    <p style="margin: 12px 0 0; color: rgba(255,255,255,0.95); font-size: 18px; font-weight: 500;">
                      Data Refresh Complete
                    </p>
                  </td>
                </tr>
                
                <!-- Time Since Last Refresh Banner -->
                <tr>
                  <td style="background: #f9fafb; padding: 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 15px; color: #6b7280;">
                      📊 In the last <strong style="color: #111827; font-weight: 700;">${timeSinceLastRefreshText}</strong>, you've gained:
                    </p>
                  </td>
                </tr>
                
                <!-- Delta Metrics -->
                <tr>
                  <td style="padding: 40px;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 32px;">
                      <!-- Views Gained -->
                      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px; text-align: center;">
                        <div style="color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Views</div>
                        <div style="color: #ffffff; font-size: 36px; font-weight: 800; margin-bottom: 4px;">+${viewsGained.toLocaleString()}</div>
                        <div style="color: rgba(255,255,255,0.8); font-size: 12px;">gained</div>
                      </div>
                      
                      <!-- Link Clicks -->
                      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 24px; border-radius: 12px; text-align: center;">
                        <div style="color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Link Clicks</div>
                        <div style="color: #ffffff; font-size: 36px; font-weight: 800; margin-bottom: 4px;">+${linkClicksGained.toLocaleString()}</div>
                        <div style="color: rgba(255,255,255,0.8); font-size: 12px;">gained</div>
                      </div>
                    </div>
                    
                    <!-- Engagement Rate Card -->
                    <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 28px; border-radius: 12px; text-align: center; margin-bottom: 32px;">
                      <div style="color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Engagement Rate</div>
                      <div style="color: #ffffff; font-size: 48px; font-weight: 800; margin-bottom: 4px;">${engagementRate}%</div>
                      <div style="color: rgba(255,255,255,0.8); font-size: 13px;">${totalEngagement.toLocaleString()} total engagements (likes + comments + shares)</div>
                    </div>
                    
                    <!-- Top Videos Section -->
                    ${topVideos.length > 0 ? `
                    <div style="margin: 40px 0;">
                      <h2 style="margin: 0 0 20px; font-size: 22px; font-weight: 700; color: #111827; letter-spacing: -0.3px;">
                        🔥 Top 5 Videos from this Refresh
                      </h2>
                      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #ffffff;">
                        ${topVideosHtml}
                      </table>
                    </div>
                    ` : ''}
                    
                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 48px 0 24px;">
                      <a href="https://www.viewtrack.app" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; letter-spacing: 0.3px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                        View Full Dashboard →
                      </a>
                    </div>
                    
                    <!-- Summary Footer -->
                    <div style="background-color: #f9fafb; padding: 20px; border-radius: 10px; text-align: center;">
                      <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                        <strong style="color: #111827;">${session.completedAccounts || 0}</strong> account${session.completedAccounts !== 1 ? 's' : ''} refreshed • 
                        <strong style="color: #111827;">${session.totalVideos || 0}</strong> new video${session.totalVideos !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #111827; padding: 28px 40px; text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 15px; color: #ffffff; font-weight: 600;">
                      ViewTrack
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #9ca3af;">
                      Professional Social Media Analytics
                    </p>
                    <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">
                      Automated refresh • ${new Date().toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
  
  try {
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ViewTrack <team@viewtrack.app>',
        to: [session.ownerEmail],
        subject: `${session.orgName} - Data Refresh Complete (+${viewsGained.toLocaleString()} Views | ${engagementRate}% Engagement)`,
        html: emailHtml
      })
    });
    
    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error(`❌ Email API error (${emailResponse.status}):`, errorText);
      throw new Error(`Email API returned ${emailResponse.status}: ${errorText}`);
    }
    
    const emailResult = await emailResponse.json();
    console.log(`✅ Refresh summary email sent successfully!`);
    console.log(`   📧 Recipient: ${session.ownerEmail}`);
    console.log(`   🏢 Organization: ${session.orgName} (${session.orgId})`);
    console.log(`   👤 Owner ID: ${session.ownerId || 'Not set'}`);
    console.log(`   📊 Deltas: +${viewsGained.toLocaleString()} views, ${engagementRate}% engagement`);
    console.log(`   📨 Email ID: ${emailResult.id || 'Unknown'}`);
    
  } catch (error: any) {
    console.error('❌ Failed to send refresh summary email:', error.message);
    throw error;
  }
}

