import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { initializeFirebase } from './utils/firebase-admin.js';
import { runApifyActor } from './apify-client.js';
import { ErrorNotificationService } from './services/ErrorNotificationService.js';
import { CleanupService } from './services/CleanupService.js';
import { ImageUploadService } from './services/sync/shared/ImageUploadService.js';
import { VideoStorageService } from './services/sync/shared/VideoStorageService.js';
import { SyncSessionService } from './services/sync/shared/SyncSessionService.js';
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
        
        const tiktokVideos: any[] = [];
        
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
        
        const existingVideoIds = new Set(
          existingVideosSnapshot.docs.map(doc => doc.data().videoId).filter(Boolean)
        );
        
        console.log(`📊 Found ${existingVideoIds.size} existing TikTok videos in database`);
        
        // ==================== PHASE 1: REFRESH EXISTING VIDEOS ====================
        // Always run refresh FIRST for any account with existing videos
        if (existingVideoIds.size > 0) {
          console.log(`\n🔄 [TIKTOK PHASE 1] Refreshing ${existingVideoIds.size} existing videos...`);
          try {
            const refreshedVideos = await TikTokSyncService.refresh(account, orgId, Array.from(existingVideoIds));
            
            // Mark ALL refreshed videos with flag to prevent duplication
            const markedRefreshedVideos = refreshedVideos.map((v: any) => ({
              ...v,
              _isRefreshOnly: true
            }));
            
            tiktokVideos.push(...markedRefreshedVideos);
            console.log(`   ✅ Refreshed ${refreshedVideos.length} videos`);
          } catch (refreshError) {
            console.error('⚠️ [TIKTOK] Refresh failed (non-fatal):', refreshError);
          }
        }
        
        // ==================== PHASE 2: DISCOVER NEW VIDEOS ====================
        // Only run discovery for automatic accounts (static accounts skip this)
        if (syncStrategy !== 'refresh_only' && creatorType === 'automatic') {
          console.log(`\n🔍 [TIKTOK PHASE 2] Discovering new videos...`);
          
          // For first-time syncs, pass EMPTY set (fetch all up to limit)
          // For regular syncs, pass FULL set (stop at first duplicate)
          const isFirstTimeSync = !account.lastSynced || account.totalVideos === 0;
          const videosToCheck = isFirstTimeSync ? new Set<string>() : existingVideoIds;
          
          if (isFirstTimeSync) {
            console.log(`   🆕 First-time sync - will fetch ALL ${maxVideos} videos`);
        } else {
            console.log(`   🔄 Regular sync - will stop at first duplicate`);
          }
          
          const result = await TikTokSyncService.discovery(account, orgId, videosToCheck, maxVideos);
          const newVideos = result.videos;
          
          console.log(`   ✅ Discovered ${newVideos.length} NEW videos`);
          
          // Add NEW videos (not marked as _isRefreshOnly, so they'll be created)
          tiktokVideos.push(...newVideos);
          
          // Profile handling
          if (result.profile) {
            const profile = result.profile;
            console.log(`   👤 Fetched profile: ${profile.followersCount || 0} followers`);
            
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
          console.log(`\n⏭️  [TIKTOK PHASE 2] Refresh-only mode - skipping discovery`);
          } else {
          console.log(`\n⏭️  [TIKTOK PHASE 2] Static account - skipping discovery`);
        }
        
        // ==================== PHASE 3: PROCESS ALL VIDEOS ====================
        // CRITICAL: Deduplicate by videoId (keep refreshed version if duplicate exists)
        const videoMap = new Map();
        for (const video of tiktokVideos) {
          const videoId = video.videoId;
          if (!videoMap.has(videoId)) {
            videoMap.set(videoId, video);
          } else {
            // Duplicate found - keep the REFRESHED version (has _isRefreshOnly flag)
            const existing = videoMap.get(videoId);
            if (video._isRefreshOnly && !existing._isRefreshOnly) {
              console.log(`   🔄 Deduplicating ${videoId} - keeping refreshed version`);
              videoMap.set(videoId, video);
            } else if (!video._isRefreshOnly && existing._isRefreshOnly) {
              console.log(`   🔄 Deduplicating ${videoId} - already have refreshed version`);
              // Keep existing (refreshed) version
            } else {
              console.log(`   ⚠️  Duplicate ${videoId} with same type - keeping first`);
            }
          }
        }
        
        const dedupedVideos = Array.from(videoMap.values());
        const refreshedCount = dedupedVideos.filter(v => v._isRefreshOnly).length;
        const newCount = dedupedVideos.length - refreshedCount;
        console.log(`\n📊 [TIKTOK] Processing ${dedupedVideos.length} total videos (${refreshedCount} refreshed + ${newCount} new) - removed ${tiktokVideos.length - dedupedVideos.length} duplicates`);
        videos = dedupedVideos;
        
      } catch (tiktokError) {
        console.error('TikTok fetch error:', tiktokError);
        throw tiktokError;
      }
    } else if (account.platform === 'youtube') {
      console.log(`📺 Fetching YouTube Shorts for ${account.username}...`);
      
      try {
        const creatorType = account.creatorType || 'automatic';
        console.log(`🔧 Account type: ${creatorType}`);
        
        const youtubeVideos: any[] = [];
        
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
        
        // ==================== PHASE 1: REFRESH EXISTING VIDEOS ====================
        // Always run refresh FIRST for any account with existing videos
        if (existingVideoIds.size > 0) {
          console.log(`\n🔄 [YOUTUBE PHASE 1] Refreshing ${existingVideoIds.size} existing Shorts...`);
          try {
            const refreshedVideos = await YoutubeSyncService.refresh(account, orgId, Array.from(existingVideoIds));
            
            // Mark ALL refreshed videos with flag to prevent duplication (CRITICAL FIX!)
            const markedRefreshedVideos = refreshedVideos.map((v: any) => ({
              ...v,
              _isRefreshOnly: true
            }));
            
            youtubeVideos.push(...markedRefreshedVideos);
            console.log(`   ✅ Refreshed ${refreshedVideos.length} Shorts`);
          } catch (refreshError) {
            console.error('⚠️ [YOUTUBE] Refresh failed (non-fatal):', refreshError);
          }
        }
        
        // ==================== PHASE 2: DISCOVER NEW VIDEOS ====================
        // Only run discovery for automatic accounts (static accounts skip this)
        if (syncStrategy !== 'refresh_only' && creatorType === 'automatic') {
          console.log(`\n🔍 [YOUTUBE PHASE 2] Discovering new Shorts...`);
          
          // For first-time syncs, pass EMPTY set (fetch all up to limit)
          // For regular syncs, pass FULL set (stop at first duplicate)
          const isFirstTimeSync = !account.lastSynced || account.totalVideos === 0;
          const videosToCheck = isFirstTimeSync ? new Set<string>() : existingVideoIds;
          
          if (isFirstTimeSync) {
            console.log(`   🆕 First-time sync - will fetch ALL ${maxVideos} Shorts`);
          } else {
            console.log(`   🔄 Regular sync - will stop at first duplicate`);
          }
          
          const result = await YoutubeSyncService.discovery(account, orgId, videosToCheck, maxVideos);
          const newVideos = result.videos;
          
          console.log(`   ✅ Discovered ${newVideos.length} NEW Shorts`);
          
          // Add NEW videos (not marked as _isRefreshOnly, so they'll be created)
          youtubeVideos.push(...newVideos);
          
          // Profile handling
          if (result.profile) {
            const profile = result.profile;
            console.log(`   👤 Fetched profile: ${profile.followersCount || 0} subscribers`);
            
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
          console.log(`\n⏭️  [YOUTUBE PHASE 2] Refresh-only mode - skipping discovery`);
        } else {
          console.log(`\n⏭️  [YOUTUBE PHASE 2] Static account - skipping discovery`);
        }
        
        // ==================== PHASE 3: PROCESS ALL VIDEOS ====================
        // CRITICAL: Deduplicate by videoId (keep refreshed version if duplicate exists)
        const videoMap = new Map();
        for (const video of youtubeVideos) {
          const videoId = video.videoId;
          if (!videoMap.has(videoId)) {
            videoMap.set(videoId, video);
          } else {
            // Duplicate found - keep the REFRESHED version (has _isRefreshOnly flag)
            const existing = videoMap.get(videoId);
            if (video._isRefreshOnly && !existing._isRefreshOnly) {
              console.log(`   🔄 Deduplicating ${videoId} - keeping refreshed version`);
              videoMap.set(videoId, video);
            } else if (!video._isRefreshOnly && existing._isRefreshOnly) {
              console.log(`   🔄 Deduplicating ${videoId} - already have refreshed version`);
              // Keep existing (refreshed) version
            } else {
              console.log(`   ⚠️  Duplicate ${videoId} with same type - keeping first`);
            }
          }
        }
        
        const dedupedVideos = Array.from(videoMap.values());
        const refreshedCount = dedupedVideos.filter(v => v._isRefreshOnly).length;
        const newCount = dedupedVideos.length - refreshedCount;
        console.log(`\n📊 [YOUTUBE] Processing ${dedupedVideos.length} total videos (${refreshedCount} refreshed + ${newCount} new) - removed ${youtubeVideos.length - dedupedVideos.length} duplicates`);
        videos = dedupedVideos;
        
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
      
      const tweets: any[] = [];
      
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
      
      // ==================== PHASE 1: REFRESH EXISTING TWEETS ====================
      // Always run refresh FIRST for any account with existing tweets
      if (existingTweetIds.size > 0) {
        console.log(`\n🔄 [TWITTER PHASE 1] Refreshing ${existingTweetIds.size} existing tweets...`);
        try {
          const refreshedTweets = await TwitterSyncService.refresh(account, orgId, Array.from(existingTweetIds));
          
          // Mark ALL refreshed tweets with flag to prevent duplication
          const markedRefreshedTweets = refreshedTweets.map((v: any) => ({
            ...v,
            _isRefreshOnly: true
          }));
          
          tweets.push(...markedRefreshedTweets);
          console.log(`   ✅ Refreshed ${refreshedTweets.length} tweets`);
        } catch (refreshError) {
          console.error('⚠️ [TWITTER] Refresh failed (non-fatal):', refreshError);
        }
      }
      
      // ==================== PHASE 2: DISCOVER NEW TWEETS ====================
      // Only run discovery for automatic accounts (static accounts skip this)
      if (syncStrategy !== 'refresh_only' && creatorType === 'automatic') {
        console.log(`\n🔍 [TWITTER PHASE 2] Discovering new tweets...`);
        
        // For first-time syncs, pass EMPTY set (fetch all up to limit)
        // For regular syncs, pass FULL set (stop at first duplicate)
        const isFirstTimeSync = !account.lastSynced || account.totalVideos === 0;
        const tweetsToCheck = isFirstTimeSync ? new Set<string>() : existingTweetIds;
        
        if (isFirstTimeSync) {
          console.log(`   🆕 First-time sync - will fetch ALL ${maxVideos} tweets`);
        } else {
          console.log(`   🔄 Regular sync - will stop at first duplicate`);
        }
        
        const newTweets = await TwitterSyncService.discovery(account, orgId, tweetsToCheck, maxVideos);
        
        console.log(`   ✅ Discovered ${newTweets.length} NEW tweets`);
        
        // Add NEW tweets (not marked as _isRefreshOnly, so they'll be created)
        tweets.push(...newTweets);
      } else if (syncStrategy === 'refresh_only') {
        console.log(`\n⏭️  [TWITTER PHASE 2] Refresh-only mode - skipping discovery`);
      } else {
        console.log(`\n⏭️  [TWITTER PHASE 2] Static account - skipping discovery`);
      }
      
      // ==================== PHASE 3: PROCESS ALL TWEETS ====================
      // CRITICAL: Deduplicate by videoId (keep refreshed version if duplicate exists)
      const tweetMap = new Map();
      for (const tweet of tweets) {
        const videoId = tweet.videoId;
        if (!tweetMap.has(videoId)) {
          tweetMap.set(videoId, tweet);
        } else {
          // Duplicate found - keep the REFRESHED version (has _isRefreshOnly flag)
          const existing = tweetMap.get(videoId);
          if (tweet._isRefreshOnly && !existing._isRefreshOnly) {
            console.log(`   🔄 Deduplicating ${videoId} - keeping refreshed version`);
            tweetMap.set(videoId, tweet);
          } else if (!tweet._isRefreshOnly && existing._isRefreshOnly) {
            console.log(`   🔄 Deduplicating ${videoId} - already have refreshed version`);
            // Keep existing (refreshed) version
          } else {
            console.log(`   ⚠️  Duplicate ${videoId} with same type - keeping first`);
          }
        }
      }
      
      const dedupedTweets = Array.from(tweetMap.values());
      const refreshedCount = dedupedTweets.filter(t => t._isRefreshOnly).length;
      const newCount = dedupedTweets.length - refreshedCount;
      console.log(`\n📊 [TWITTER] Processing ${dedupedTweets.length} total tweets (${refreshedCount} refreshed + ${newCount} new) - removed ${tweets.length - dedupedTweets.length} duplicates`);
      videos = dedupedTweets;
        
      } catch (twitterError) {
        console.error('Twitter fetch error:', twitterError);
        throw twitterError;
      }
    } else if (account.platform === 'instagram') {
      console.log(`👤 Fetching Instagram reels for ${account.username}...`);
      
      try {
        const creatorType = account.creatorType || 'automatic';
        console.log(`🔧 Account type: ${creatorType}`);
        
        let instagramItems: any[] = [];
        
        // Get existing video IDs
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
        
        const existingVideoIds = new Set(
          existingVideosSnapshot.docs.map(doc => doc.data().videoId).filter(Boolean)
        );
        
        console.log(`📊 Found ${existingVideoIds.size} existing Instagram reels in database`);
        
        // ==================== PHASE 1: REFRESH EXISTING REELS ====================
        // Always run refresh FIRST for any account with existing videos
        if (existingVideoIds.size > 0) {
          console.log(`\n🔄 [INSTAGRAM PHASE 1] Refreshing ${existingVideoIds.size} existing reels...`);
          
          try {
            const refreshedReels = await InstagramSyncService.refresh(account, orgId, Array.from(existingVideoIds));
            
            let successCount = 0;
            let errorCount = 0;
            
            // Handle errors and add valid ones
            for (const reel of refreshedReels) {
              if (reel.isError) {
                errorCount++;
                console.warn(`⚠️ [INSTAGRAM] Video error: ${reel.error}`);
                
                // Extract video code from URL to mark it in database
                // Support /p/ (posts), /reel/ (reels), and /tv/ (IGTV)
                const urlMatch = reel.input?.match(/\/(?:p|reel|tv)\/([^\/\?]+)/);
                const videoCode = urlMatch ? urlMatch[1] : null;
                
                if (videoCode) {
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
                    await videoQuery.docs[0].ref.update({
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
                    console.log(`   ✅ Marked video ${videoCode} with error status`);
                  }
                }
                continue;
              }
              
              // Mark valid refreshed reels with flag to prevent duplication
              instagramItems.push({
                ...reel,
                _isRefreshOnly: true
              });
              successCount++;
            }
            
            console.log(`   ✅ Refreshed ${successCount} reels (${errorCount} errors)`);
          } catch (refreshError) {
            console.error('⚠️ [INSTAGRAM] Refresh failed (non-fatal):', refreshError);
          }
        }
        
        // ==================== PHASE 2: DISCOVER NEW REELS ====================
        // Only run discovery for automatic accounts (static accounts skip this)
        if (syncStrategy !== 'refresh_only' && creatorType === 'automatic') {
          console.log(`\n🔍 [INSTAGRAM PHASE 2] Discovering new reels...`);
          
          // For first-time syncs, pass EMPTY set (fetch all up to limit)
          // For regular syncs, pass FULL set (stop at first duplicate)
          const isFirstTimeSync = !account.lastSynced || account.totalVideos === 0;
          const videosToCheck = isFirstTimeSync ? new Set<string>() : existingVideoIds;
          
          if (isFirstTimeSync) {
            console.log(`   🆕 First-time sync - will fetch ALL ${maxVideos} reels`);
          } else {
            console.log(`   🔄 Regular sync - will stop at first duplicate`);
          }
          
          const result = await InstagramSyncService.discovery(account, orgId, videosToCheck, maxVideos);
          const newReels = result.videos;
          
          console.log(`   ✅ Discovered ${newReels.length} NEW reels`);
          
          // Add NEW reels (not marked as _isRefreshOnly, so they'll be created)
          instagramItems.push(...newReels);
        } else if (syncStrategy === 'refresh_only') {
          console.log(`\n⏭️  [INSTAGRAM PHASE 2] Refresh-only mode - skipping discovery`);
        } else {
          console.log(`\n⏭️  [INSTAGRAM PHASE 2] Static account - skipping discovery`);
        }
        
        // ==================== PHASE 3: PROCESS ALL REELS ====================
        // CRITICAL: Deduplicate by videoId (keep refreshed version if duplicate exists)
        const reelMap = new Map();
        for (const reel of instagramItems) {
          const videoId = reel.videoId;
          if (!reelMap.has(videoId)) {
            reelMap.set(videoId, reel);
          } else {
            // Duplicate found - keep the REFRESHED version (has _isRefreshOnly flag)
            const existing = reelMap.get(videoId);
            if (reel._isRefreshOnly && !existing._isRefreshOnly) {
              console.log(`   🔄 Deduplicating ${videoId} - keeping refreshed version`);
              reelMap.set(videoId, reel);
            } else if (!reel._isRefreshOnly && existing._isRefreshOnly) {
              console.log(`   🔄 Deduplicating ${videoId} - already have refreshed version`);
              // Keep existing (refreshed) version
            } else {
              console.log(`   ⚠️  Duplicate ${videoId} with same type - keeping first`);
            }
          }
        }
        
        const dedupedReels = Array.from(reelMap.values());
        const originalCount = instagramItems.length;
        instagramItems = dedupedReels; // Replace with deduplicated array
        
        const refreshedCount = dedupedReels.filter(r => r._isRefreshOnly).length;
        const newCount = dedupedReels.length - refreshedCount;
        console.log(`\n📊 [INSTAGRAM] Processing ${dedupedReels.length} total reels (${refreshedCount} refreshed + ${newCount} new) - removed ${originalCount - dedupedReels.length} duplicates`);
        
        // Profile Update
        try {
          const profile = await InstagramSyncService.getProfile(account.username);
          if (profile) {
            console.log(`   👤 Fetched profile: ${profile.followersCount || 0} followers`);
            
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

    // Save videos to Firestore (using shared service)
    const savedCount = await VideoStorageService.saveVideos(
      videos,
      account,
            orgId,
      projectId,
      db
    );

    // Calculate and update account-level aggregated stats
    try {
      console.log(`📊 Calculating account stats for @${account.username}...`);
      const allVideosSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('videos')
        .where('trackedAccountId', '==', accountId)
          .get();

      const allVideos = allVideosSnapshot.docs.map(doc => doc.data());
      const totalVideos = allVideos.length;
      const totalViews = allVideos.reduce((sum, v) => sum + (v.views || 0), 0);
      const totalLikes = allVideos.reduce((sum, v) => sum + (v.likes || 0), 0);
      const totalComments = allVideos.reduce((sum, v) => sum + (v.comments || 0), 0);
      const totalShares = allVideos.reduce((sum, v) => sum + (v.shares || 0), 0);
      
      await accountRef.update({
        totalVideos,
        totalViews,
        totalLikes,
        totalComments,
        totalShares
      });
      
      console.log(`✅ Updated account stats: ${totalVideos} videos, ${totalViews.toLocaleString()} views, ${totalLikes.toLocaleString()} likes`);
    } catch (statsError: any) {
      console.error(`❌ Failed to update account stats (non-critical):`, statsError.message);
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
    if (sessionId) {
      await SyncSessionService.updateSessionProgress(
        sessionId,
        orgId,
        projectId,
        accountId,
        savedCount,
        account,
        db
      );
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


