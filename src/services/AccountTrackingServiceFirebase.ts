import { TrackedAccount, AccountVideo } from '../types/accounts';
import FirestoreDataService from './FirestoreDataService';
import FirebaseStorageService from './FirebaseStorageService';
import OutlierDetectionService from './OutlierDetectionService';
import YoutubeAccountService from './YoutubeAccountService';
import TwitterApiService from './TwitterApiService';
import { Timestamp, writeBatch, doc, collection } from 'firebase/firestore';
import { db } from './firebase';

/**
 * AccountTrackingServiceFirebase
 * 
 * Purpose: Manage tracked social media accounts and their videos using Firebase
 * Responsibilities:
 * - Add and manage tracked accounts in Firestore
 * - Fetch and sync videos from social media platforms
 * - Upload images to Firebase Storage
 * - Integrate with Apify API for data scraping
 */
export class AccountTrackingServiceFirebase {
  
  /**
   * Get all tracked accounts for a project
   */
  static async getTrackedAccounts(orgId: string, projectId: string, platform?: 'instagram' | 'tiktok' | 'youtube' | 'twitter'): Promise<TrackedAccount[]> {
    try {
      const firestoreAccounts = await FirestoreDataService.getTrackedAccounts(orgId, projectId, platform);
      
      // Convert Firestore format to TrackedAccount format
      return firestoreAccounts.map(acc => ({
        id: acc.id,
        username: acc.username,
        platform: acc.platform as 'instagram' | 'tiktok' | 'youtube' | 'twitter',
        accountType: acc.accountType as 'my' | 'competitor',
        displayName: acc.displayName || acc.username,
        profilePicture: acc.profilePicture || '',
        followerCount: acc.followerCount || 0,
        followingCount: acc.followingCount || 0,
        postCount: acc.totalVideos || 0,
        bio: acc.bio || '',
        isVerified: acc.isVerified || false,
        dateAdded: acc.dateAdded.toDate(),
        lastSynced: acc.lastSynced?.toDate(),
        isActive: acc.isActive,
        totalVideos: acc.totalVideos || 0,
        totalViews: acc.totalViews || 0,
        totalLikes: acc.totalLikes || 0,
        totalComments: acc.totalComments || 0,
        totalShares: acc.totalShares || 0
      }));
    } catch (error) {
      console.error('❌ Failed to load tracked accounts from Firestore:', error);
      return [];
    }
  }

  /**
   * Add a new account to track in a project
   */
  /**
   * Add account for BACKGROUND sync (NEW - non-blocking)
   * This adds the account instantly and queues it for background processing
   */
  static async addAccount(
    orgId: string,
    projectId: string,
    userId: string,
    username: string,
    platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter',
    accountType: 'my' | 'competitor' = 'my',
    maxVideos: number = 100 // Default to 100 if not specified
  ): Promise<string> {
    try {
      console.log(`⚡ Quick-adding ${accountType} account @${username} on ${platform} (background sync, max ${maxVideos} videos)`);
      
      // Add to Firestore immediately with minimal data
      // The cron job will fetch profile data and videos in the background
      const accountData: any = {
        username,
        platform,
        accountType,
        displayName: username, // Use username as placeholder
        isActive: true,
        maxVideos: maxVideos, // Store the user's preference for how many videos to scrape
        creatorType: 'automatic' // Full account tracking - discovers new videos on refresh
      };
      
      const accountId = await FirestoreDataService.addTrackedAccount(orgId, projectId, userId, accountData);

      console.log(`✅ Queued account @${username} for background sync (ID: ${accountId})`);
      console.log(`⏳ Videos will be synced in the background. You'll receive an email when complete.`);
      
      return accountId;
    } catch (error) {
      console.error('❌ Failed to add account:', error);
      throw error;
    }
  }

  /**
   * Add account with IMMEDIATE sync (OLD - blocking, kept for backward compatibility)
   * Use this only when you need immediate profile data
   */
  static async addAccountImmediate(
    orgId: string,
    projectId: string,
    userId: string,
    username: string,
    platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter',
    accountType: 'my' | 'competitor' = 'my'
  ): Promise<string> {
    try {
      console.log(`➕ Adding ${accountType} account @${username} on ${platform} with immediate sync`);
      
      // Fetch account profile data (BLOCKS UI)
      let profileData;
      if (platform === 'youtube') {
        profileData = await this.fetchYoutubeProfile(orgId, username);
      } else if (platform === 'twitter') {
        profileData = await this.fetchTwitterProfile(orgId, username);
      } else {
        profileData = await this.fetchAccountProfile(orgId, username, platform);
      }
      
      // Add to Firestore (omit undefined fields)
      const accountData: any = {
        username,
        platform,
        accountType,
        displayName: profileData.displayName,
        followerCount: profileData.followerCount,
        followingCount: profileData.followingCount,
        bio: profileData.bio,
        isVerified: profileData.isVerified,
        isActive: true,
        creatorType: 'automatic' // Full account tracking - discovers new videos on refresh
      };
      
      // Only add profilePicture if it exists
      if (profileData.profilePicture) {
        accountData.profilePicture = profileData.profilePicture;
      }
      
      const accountId = await FirestoreDataService.addTrackedAccount(orgId, projectId, userId, accountData);

      console.log(`✅ Added ${accountType} account @${username}`);
      return accountId;
    } catch (error) {
      console.error('❌ Failed to add account:', error);
      throw error;
    }
  }

  /**
   * Fetch YouTube profile data
   */
  private static async fetchYoutubeProfile(orgId: string, usernameOrHandle: string) {
    try {
      console.log(`🔄 Fetching YouTube channel for @${usernameOrHandle}...`);
      
      const profile = await YoutubeAccountService.fetchChannelProfile(usernameOrHandle);
      
      // Download and upload avatar to Firebase Storage if present
      let profilePicture = '';
      if (profile.profilePicture) {
        profilePicture = await FirebaseStorageService.downloadAndUpload(
          orgId,
          profile.profilePicture,
          `youtube_${usernameOrHandle}`,
          'profile'
        );
      }
      
      return {
        displayName: profile.displayName,
        profilePicture,
        followerCount: profile.followerCount,
        followingCount: profile.followingCount,
        postCount: profile.postCount,
        bio: profile.bio,
        isVerified: profile.isVerified,
        channelId: profile.channelId, // Store for later video sync
      };
    } catch (error) {
      console.error('❌ Failed to fetch YouTube channel:', error);
      return {
        displayName: usernameOrHandle,
        profilePicture: '',
        followerCount: 0,
        followingCount: 0,
        postCount: 0,
        bio: '',
        isVerified: false,
        channelId: undefined,
      };
    }
  }

  /**
   * Fetch Twitter profile data
   */
  private static async fetchTwitterProfile(orgId: string, username: string) {
    try {
      console.log(`🐦 Fetching Twitter profile for @${username}...`);
      
      const profile = await TwitterApiService.getProfileInfo(username);
      console.log(`📊 Twitter profile data:`, profile);
      
      // Download and upload avatar to Firebase Storage if present
      let profilePicture = '';
      if (profile.profilePicture) {
        try {
          console.log(`🖼️ Uploading profile picture for @${username}...`);
          profilePicture = await FirebaseStorageService.downloadAndUpload(
            orgId,
            profile.profilePicture,
            `twitter_${username}`,
            'profile'
          );
          console.log(`✅ Profile picture uploaded successfully`);
        } catch (uploadError) {
          console.warn(`⚠️ Failed to upload profile picture, using original URL:`, uploadError);
          // Use original URL if upload fails
          profilePicture = profile.profilePicture;
        }
      }
      
      return {
        displayName: profile.displayName,
        profilePicture,
        followerCount: profile.followerCount,
        followingCount: profile.followingCount,
        postCount: 0, // Twitter doesn't provide post count easily
        bio: '', // Not available from scraper
        isVerified: profile.isVerified,
      };
    } catch (error) {
      console.error('❌ Failed to fetch Twitter profile:', error);
      // Return defaults but don't throw - allow account creation to continue
      return {
        displayName: username,
        profilePicture: '',
        followerCount: 0,
        followingCount: 0,
        postCount: 0,
        bio: '',
        isVerified: false,
      };
    }
  }

  /**
   * Fetch account profile data from social media
   */
  private static async fetchAccountProfile(
    orgId: string,
    username: string,
    platform: 'instagram' | 'tiktok'
  ): Promise<{
    displayName: string;
    profilePicture?: string;
    followerCount: number;
    followingCount: number;
    postCount: number;
    bio: string;
    isVerified: boolean;
  }> {
    if (platform === 'instagram') {
      return await this.fetchInstagramProfile(orgId, username);
    } else {
      return await this.fetchTikTokProfile(orgId, username);
    }
  }

  /**
   * Fetch Instagram profile data
   */
  private static async fetchInstagramProfile(orgId: string, username: string) {
    try {
      console.log(`🔄 Fetching Instagram profile for @${username} using NEW scraper...`);
      
      const proxyUrl = `${window.location.origin}/api/apify-proxy`;
      
      // Get Instagram session cookie from environment variable
      const sessionId = import.meta.env.VITE_INSTAGRAM_SESSION_ID || '';
      console.log('🔐 Instagram auth:', sessionId ? 'Using session cookies ✓' : '⚠️ No session cookies (may fail with 401)');
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // USE NEW WORKING SCRAPER with RESIDENTIAL proxies!
          actorId: 'scraper-engine~instagram-reels-scraper',
          input: {
            urls: [`https://www.instagram.com/${username}/`],
            sortOrder: "newest",
            maxComments: 10,
            maxReels: 10, // Just need a few for profile info
            // 🔑 ADD SESSION COOKIES FOR AUTHENTICATION
            ...(sessionId && {
              sessionCookie: sessionId,
              additionalCookies: [
                {
                  name: 'sessionid',
                  value: sessionId,
                  domain: '.instagram.com'
                }
              ]
            }),
            proxyConfiguration: {
              useApifyProxy: true,
              apifyProxyGroups: ['RESIDENTIAL'],  // 🔑 Use RESIDENTIAL proxies to avoid Instagram 429 blocks
              apifyProxyCountry: 'US'  // Use US proxies for better compatibility
            },
            // Additional anti-blocking measures
            maxRequestRetries: 5,
            requestHandlerTimeoutSecs: 300,
            maxConcurrency: 1
          },
          action: 'run'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📊 NEW scraper profile API response: ${result.items?.length || 0} items`);

      if (!result.items || result.items.length === 0) {
        return {
          displayName: username,
          profilePicture: '',
          followerCount: 0,
          followingCount: 0,
          postCount: 0,
          bio: '',
          isVerified: false,
        };
      }

      const firstItem = result.items[0];
      // NEW SCRAPER: Data is nested under reel_data.media
      const media = firstItem.reel_data?.media || firstItem.media || firstItem;
      
      console.log(`📊 Found ${result.items.length} videos/posts`);
      
      // NEW SCRAPER: Get HD profile picture (best quality) with fallbacks
      let profilePictureUrl = media.user?.hd_profile_pic_url_info?.url ||      // HD version (925x925)
                              media.owner?.hd_profile_pic_url_info?.url ||     // HD version from owner
                              media.user?.profile_pic_url ||                   // Standard version (150x150)
                              media.owner?.profile_pic_url ||                  // Standard from owner
                              '';
      
      console.log(`📸 Found Instagram profile picture URL from NEW scraper (HD):`, profilePictureUrl ? 'Yes' : 'No');
      
      let profilePicture = '';
      
      // Download and upload to Firebase Storage to avoid CORS issues
      if (profilePictureUrl) {
        try {
          console.log(`📥 Downloading Instagram profile picture for @${username}...`);
          profilePicture = await FirebaseStorageService.downloadAndUpload(
            orgId,
            profilePictureUrl,
            `instagram_${username}`,
            'profile'
          );
          console.log(`✅ Successfully uploaded Instagram profile picture to Firebase Storage for @${username}`);
        } catch (error) {
          console.error(`❌ Failed to upload Instagram profile picture for @${username}:`, error);
          // Use original URL as fallback
          profilePicture = profilePictureUrl;
        }
      } else {
        console.warn(`⚠️ No profile picture URL found for @${username} - will use placeholder`);
      }

      return {
        displayName: media.user?.full_name || media.owner?.full_name || username,
        profilePicture,
        followerCount: 0,
        followingCount: 0,
        postCount: result.items.length,
        bio: '',
        isVerified: media.user?.is_verified || media.owner?.is_verified || false,
      };
    } catch (error) {
      console.error('❌ Failed to fetch Instagram profile:', error);
      return {
        displayName: username,
        profilePicture: '',
        followerCount: 0,
        followingCount: 0,
        postCount: 0,
        bio: '',
        isVerified: false,
      };
    }
  }

  /**
   * Fetch TikTok profile data
   */
  private static async fetchTikTokProfile(orgId: string, username: string) {
    try {
      console.log(`🔄 Fetching TikTok profile for @${username}...`);
      
      const proxyUrl = `${window.location.origin}/api/apify-proxy`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: 'clockworks~tiktok-scraper',
          input: {
            profiles: [username],
            resultsPerPage: 30,
            shouldDownloadCovers: false,
            shouldDownloadVideos: false,
            shouldDownloadSubtitles: false
          },
          action: 'run'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📊 TikTok profile API response:`, result);

      if (!result.items || result.items.length === 0) {
        return {
          displayName: username,
          profilePicture: '',
          followerCount: 0,
          followingCount: 0,
          postCount: 0,
          bio: '',
          isVerified: false,
        };
      }

      // Extract profile info
      let profileInfo = null;
      let videoCount = 0;
      let profilePicture = '';

      for (const item of result.items) {
        if (item.webVideoUrl || item.id) videoCount++;
        
        if (item.authorMeta || item.author) {
          const author = item.authorMeta || item.author;
          if (!profileInfo && author.name === username) {
            profileInfo = author;
            profilePicture = author.avatar || author.profilePicture || '';
            break;
          }
        }
      }

      // Download and upload to Firebase Storage
      if (profilePicture) {
        profilePicture = await FirebaseStorageService.downloadAndUpload(
          orgId,
          profilePicture,
          `tiktok_${username}`,
          'profile'
        );
      }

      return {
        displayName: profileInfo?.displayName || profileInfo?.nickname || username,
        profilePicture,
        followerCount: profileInfo?.fans || 0,
        followingCount: profileInfo?.following || 0,
        postCount: videoCount,
        bio: profileInfo?.signature || '',
        isVerified: profileInfo?.verified || false,
      };
    } catch (error) {
      console.error('❌ Failed to fetch TikTok profile:', error);
      return {
        displayName: username,
        profilePicture: '',
        followerCount: 0,
        followingCount: 0,
        postCount: 0,
        bio: '',
        isVerified: false,
      };
    }
  }

  /**
   * Sync account videos (fetch all videos from the platform and save to Firestore)
   * Now with INCREMENTAL SYNC: Only fetches new videos, updates snapshots for existing ones
   */
  static async syncAccountVideos(orgId: string, projectId: string, userId: string, accountId: string): Promise<number> {
    try {
      // Get account from Firestore
      const accounts = await this.getTrackedAccounts(orgId, projectId);
      const account = accounts.find(a => a.id === accountId);
      
      if (!account) {
        throw new Error('Account not found');
      }

      console.log(`🔄 Syncing videos for @${account.username} (${account.platform})`);

      // STEP 1: Get existing videos to check what we already have
      const existingVideos = await this.getAccountVideos(orgId, projectId, accountId);
      const existingVideoIds = new Set(existingVideos.map(v => v.videoId).filter((id): id is string => !!id));
      console.log(`📚 Found ${existingVideoIds.size} existing videos in database`);

      // STEP 2 & 3: Fetch videos from platform (gets FRESH metrics!)
      // This returns BOTH new videos AND updated existing videos
      let syncResult: { newVideos: AccountVideo[], updatedVideos: AccountVideo[] };
      if (account.platform === 'instagram') {
        syncResult = await this.syncInstagramVideosIncremental(orgId, projectId, account, existingVideoIds);
      } else if (account.platform === 'tiktok') {
        // TikTok with incremental sync
        syncResult = await this.syncTikTokVideosIncremental(orgId, projectId, account, existingVideoIds);
      } else if (account.platform === 'twitter') {
        // Twitter with incremental sync
        syncResult = await this.syncTwitterTweetsIncremental(orgId, projectId, account, existingVideoIds);
      } else if (account.platform === 'youtube') {
        // YouTube with incremental sync
        syncResult = await this.syncYoutubeShortsIncremental(orgId, projectId, account, existingVideoIds);
      } else {
        throw new Error(`Unsupported platform: ${account.platform}`);
      }

      console.log(`📹 Fetched ${syncResult.newVideos.length} NEW videos, ${syncResult.updatedVideos.length} updated videos from platform`);

      // STEP 4: Update existing videos with fresh metrics + create snapshots
      if (syncResult.updatedVideos.length > 0) {
        console.log(`🔄 Updating ${syncResult.updatedVideos.length} existing videos with fresh metrics...`);
        await this.updateExistingVideosWithFreshMetrics(orgId, projectId, syncResult.updatedVideos);
      }

      // Use only new videos for the rest of the sync process
      const videos = syncResult.newVideos;
      console.log(`➕ Saving ${videos.length} new videos to database`);

      // NOTE: Rules are applied during DISPLAY, not during sync
      // All videos are saved to Firestore, rules filter what's shown in the UI

      // Sync to Firestore
      await FirestoreDataService.syncAccountVideos(
        orgId,
        projectId,
        accountId,
        userId,
        videos.map(v => ({
          videoId: v.videoId || '',
          url: v.url || '',
          thumbnail: v.thumbnail || '',
          caption: v.caption || '',
          uploadDate: v.uploadDate || new Date(),
          views: v.views || 0,
          likes: v.likes || 0,
          comments: v.comments || 0,
          shares: v.shares || 0,
          duration: v.duration || 0,
          hashtags: v.hashtags || [],
          mentions: v.mentions || []
        })),
        account.platform // Pass the platform from the account
      );

      // Update account stats
      const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
      const totalLikes = videos.reduce((sum, v) => sum + (v.likes || 0), 0);
      const totalComments = videos.reduce((sum, v) => sum + (v.comments || 0), 0);
      const totalShares = videos.reduce((sum, v) => sum + (v.shares || 0), 0);

      // Calculate outliers
      const outlierAnalysis = OutlierDetectionService.detectOutliers(
        videos,
        accountId,
        account.username
      );

      console.log(`📊 Outlier Analysis for @${account.username}:`);
      console.log(`   - Top performers: ${outlierAnalysis.topPerformers.length} videos`);
      console.log(`   - Underperformers: ${outlierAnalysis.underperformers.length} videos`);
      console.log(`   - ${OutlierDetectionService.getOutlierSummary(outlierAnalysis)}`);

      await FirestoreDataService.updateTrackedAccount(orgId, projectId, accountId, {
        totalVideos: videos.length,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        lastSynced: new Date() as any,
        outlierAnalysis: {
          topPerformersCount: outlierAnalysis.topPerformers.length,
          underperformersCount: outlierAnalysis.underperformers.length,
          lastCalculated: Timestamp.fromDate(outlierAnalysis.lastCalculated)
        }
      });

      console.log(`✅ Synced ${videos.length} videos for @${account.username}`);
      return videos.length;
    } catch (error) {
      console.error('❌ Failed to sync account videos:', error);
      throw error;
    }
  }

  /**
   * NEW: Incremental Instagram sync - Fetches videos and separates new vs existing
   * Uses batches of 2 videos, stops when it hits a known video
   * For new accounts (no existing videos), fetches larger batches to get initial history
   * Returns BOTH new videos (to add) AND updated videos (to refresh metrics)
   */
  private static async syncInstagramVideosIncremental(
    orgId: string,
    _projectId: string,
    account: TrackedAccount,
    existingVideoIds: Set<string>
  ): Promise<{ newVideos: AccountVideo[], updatedVideos: AccountVideo[] }> {
    const isNewAccount = existingVideoIds.size === 0;
    console.log(`🎯 Starting ${isNewAccount ? 'FULL' : 'INCREMENTAL'} sync for @${account.username}...`);
    
    const newVideos: AccountVideo[] = [];
    const updatedVideos: AccountVideo[] = [];
    // For new accounts, fetch more videos per batch to get their full history faster
    const BATCH_SIZE = isNewAccount ? 20 : 2;
    let currentBatch = 0;
    let consecutiveExistingVideos = 0;
    // For new accounts, allow more batches to get full history (up to 100 videos)
    const MAX_BATCHES = isNewAccount ? 5 : 25; // New: 5 * 20 = 100 videos, Incremental: 25 * 2 = 50 videos
    const STOP_AFTER_EXISTING = 3; // Stop after hitting 3 existing videos in a row (means we got all new ones)
    
    while (consecutiveExistingVideos < STOP_AFTER_EXISTING && currentBatch < MAX_BATCHES) {
      currentBatch++;
      const maxReels = BATCH_SIZE * currentBatch;
      
      console.log(`📦 Batch ${currentBatch}: Fetching up to ${maxReels} videos...`);
      
      try {
        // Fetch videos from platform
        const proxyUrl = `${window.location.origin}/api/apify-proxy`;
        const sessionId = import.meta.env.VITE_INSTAGRAM_SESSION_ID || '';
        
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actorId: 'scraper-engine~instagram-reels-scraper',
            input: {
              urls: [`https://www.instagram.com/${account.username}/`],
              sortOrder: "newest",
              maxComments: 10,
              maxReels: maxReels, // Incrementally increase
              ...(sessionId && {
                sessionCookie: sessionId,
                additionalCookies: [{
                  name: 'sessionid',
                  value: sessionId,
                  domain: '.instagram.com'
                }]
              }),
              proxyConfiguration: {
                useApifyProxy: true,
                apifyProxyGroups: ['RESIDENTIAL'],
                apifyProxyCountry: 'US'
              },
              maxRequestRetries: 5,
              requestHandlerTimeoutSecs: 300,
              maxConcurrency: 1
            },
            action: 'run'
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        const items = result.items || [];
        
        console.log(`📊 Batch ${currentBatch} returned ${items.length} items`);
        
        if (items.length === 0) {
          console.log(`✅ No more videos available, stopping`);
          break;
        }
        
        // Process videos in this batch
        for (const item of items) {
          const media = item.reel_data?.media || item.media || item;
          const isVideo = !!(media.play_count || media.ig_play_count || media.video_duration);
          
          if (!isVideo) continue;
          
          const videoCode = media.code || media.shortCode || media.id;
          if (!videoCode) continue;
          
          // CHECK: Is this a NEW video or an EXISTING one?
          const isExistingVideo = existingVideoIds.has(videoCode);
          
          // Extract thumbnail URL from media
          const thumbnailUrl = media.image_versions2?.candidates?.[0]?.url || 
                               media.display_uri || 
                               media.displayUrl || '';
          
          // ONLY upload thumbnail to Firebase Storage for NEW videos
          // For existing videos, we keep their existing thumbnail
          let uploadedThumbnail = thumbnailUrl;
          if (!isExistingVideo && thumbnailUrl) {
            try {
              console.log(`📸 Uploading thumbnail to Firebase Storage for NEW video: ${videoCode}`);
              uploadedThumbnail = await FirebaseStorageService.downloadAndUpload(
                orgId,
                thumbnailUrl,
                `ig_${videoCode}`,
                'thumbnail'
              );
            } catch (error) {
              console.warn(`⚠️ Failed to upload thumbnail for ${videoCode}, using CDN URL`);
              uploadedThumbnail = thumbnailUrl;
            }
          } else if (isExistingVideo) {
            console.log(`✅ Keeping existing thumbnail for video: ${videoCode}`);
            // For existing videos, we don't include thumbnail in the update
            // (it will be preserved from the existing document)
            uploadedThumbnail = ''; // Don't overwrite existing thumbnail
          }
          
          const caption = media.caption?.text || (typeof media.caption === 'string' ? media.caption : '') || '';
          const uploadDate = media.taken_at ? new Date(media.taken_at * 1000) : new Date();
          const views = media.play_count || media.ig_play_count || 0;
          const likes = media.like_count || 0;
          const comments = media.comment_count || 0;
          const duration = media.video_duration || 0;
          
          const videoData: AccountVideo = {
            id: `${account.id}_${videoCode}`,
            accountId: account.id,
            videoId: videoCode,
            url: `https://www.instagram.com/reel/${videoCode}/`,
            thumbnail: uploadedThumbnail,
            caption: caption,
            uploadDate: uploadDate,
            views: views,
            likes: likes,
            comments: comments,
            shares: 0,
            duration: duration,
            isSponsored: false,
            hashtags: [],
            mentions: []
          };
          
          if (isExistingVideo) {
            // EXISTING VIDEO - Add to update list with fresh metrics
            updatedVideos.push(videoData);
            consecutiveExistingVideos++;
            console.log(`🔄 Existing video: ${videoCode} (will update metrics, ${consecutiveExistingVideos} consecutive)`);
            
            // If we hit too many existing videos in a row, we've found all new ones
            if (consecutiveExistingVideos >= STOP_AFTER_EXISTING) {
              console.log(`✅ Hit ${STOP_AFTER_EXISTING} existing videos in a row - all new videos found`);
              break;
            }
          } else {
            // NEW VIDEO - Add to new list
            newVideos.push(videoData);
            consecutiveExistingVideos = 0; // Reset counter
            console.log(`➕ NEW video found: ${videoCode} (${newVideos.length} total new)`);
          }
        }
        
        // If we got fewer items than maxReels, we've reached the end
        if (items.length < maxReels) {
          console.log(`✅ Reached end of account videos (got ${items.length} < ${maxReels})`);
          break;
        }
        
        // If we hit our stopping condition, break
        if (consecutiveExistingVideos >= STOP_AFTER_EXISTING) {
          break;
        }
        
      } catch (error) {
        console.error(`❌ Error in batch ${currentBatch}:`, error);
        break;
      }
    }
    
    console.log(`🎉 Incremental sync finished: ${newVideos.length} new videos, ${updatedVideos.length} updated videos, ${currentBatch} batches`);
    return { newVideos, updatedVideos };
  }

  /**
   * NEW: Update existing videos with fresh metrics from platform + create snapshots
   * This updates BOTH the video document AND creates a new snapshot
   */
  private static async updateExistingVideosWithFreshMetrics(
    orgId: string,
    projectId: string,
    videos: AccountVideo[]
  ): Promise<void> {
    if (videos.length === 0) return;
    
    console.log(`🔄 Updating ${videos.length} existing videos with fresh metrics...`);
    
    let batch = writeBatch(db);
    const now = Timestamp.now();
    let updateCount = 0;
    let operationsInBatch = 0;
    
    for (const video of videos) {
      const videoId = video.id || video.videoId || '';
      if (!videoId) continue;
      
      // Update the video document with fresh metrics
      const videoRef = doc(db, 'organizations', orgId, 'projects', projectId, 'videos', videoId);
      batch.update(videoRef, {
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0,
        shares: video.shares || 0,
        duration: video.duration || 0,
        lastUpdated: now
      });
      operationsInBatch++;
      
      // Create a snapshot with the fresh metrics
      const snapshotRef = doc(
        collection(db, 'organizations', orgId, 'projects', projectId, 'videos', videoId, 'snapshots')
      );
      batch.set(snapshotRef, {
        capturedAt: now,
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0,
        shares: video.shares || 0,
        saves: 0
      });
      operationsInBatch++;
      
      updateCount++;
      
      // Firestore batch limit is 500 operations (we do 2 operations per video)
      if (operationsInBatch >= 500) {
        await batch.commit();
        console.log(`✅ Updated ${updateCount} videos...`);
        batch = writeBatch(db); // Create new batch
        operationsInBatch = 0;
      }
    }
    
    // Commit remaining updates
    if (operationsInBatch > 0) {
      await batch.commit();
    }
    
    console.log(`✅ Updated ${updateCount} existing videos with fresh metrics + snapshots`);
  }

  /**
   * Sync TikTok videos
   */
  /**
   * INCREMENTAL TikTok sync - Fetches videos and separates new vs existing
   * Only fetches up to 30 videos (sorted by newest) and stops when hitting existing videos
   */
  private static async syncTikTokVideosIncremental(
    orgId: string,
    _projectId: string,
    account: TrackedAccount,
    existingVideoIds: Set<string>
  ): Promise<{ newVideos: AccountVideo[], updatedVideos: AccountVideo[] }> {
    const isNewAccount = existingVideoIds.size === 0;
    console.log(`🎯 Starting ${isNewAccount ? 'FULL' : 'INCREMENTAL'} TikTok sync for @${account.username}...`);
    
    const newVideos: AccountVideo[] = [];
    const updatedVideos: AccountVideo[] = [];
    
    // Fetch TikTok videos (up to 30 for new accounts, 10 for incremental)
    const maxVideos = isNewAccount ? 30 : 10;
    
    console.log(`🔄 Fetching up to ${maxVideos} TikTok videos for @${account.username}...`);
    
    const proxyUrl = `${window.location.origin}/api/apify-proxy`;
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorId: 'clockworks~tiktok-scraper',
        input: {
          profiles: [account.username],
          resultsPerPage: maxVideos, // Limit to avoid fetching all 100 videos
          shouldDownloadCovers: false,
          shouldDownloadVideos: false,
          shouldDownloadSubtitles: false
        },
        action: 'run'
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.items || !Array.isArray(result.items)) {
      return { newVideos: [], updatedVideos: [] };
    }

    console.log(`📦 TikTok API returned ${result.items.length} videos`);

    // Process videos in order (newest first)
    for (const item of result.items) {
      if (!item.webVideoUrl && !item.id) continue;

      const videoId = item.id || item.videoId || '';
      const isExisting = existingVideoIds.has(videoId);

      // Try multiple possible thumbnail field names for TikTok
      const thumbnailUrl = item['videoMeta.coverUrl'] || 
                          item.videoMeta?.coverUrl || 
                          item.covers?.default || 
                          item.coverUrl || 
                          item.thumbnail || 
                          item.cover || 
                          '';
      
      // ONLY upload thumbnail to Firebase Storage for NEW videos
      let uploadedThumbnail = thumbnailUrl;
      if (!isExisting && thumbnailUrl) {
        console.log(`🖼️ TikTok thumbnail URL found for NEW video ${videoId}: ${thumbnailUrl.substring(0, 80)}...`);
        try {
          uploadedThumbnail = await FirebaseStorageService.downloadAndUpload(
            orgId,
            thumbnailUrl,
            `tt_${videoId}_thumb`,
            'thumbnail'
          );
          console.log(`✅ TikTok thumbnail uploaded to Firebase Storage`);
        } catch (error) {
          console.warn(`⚠️ Failed to upload TikTok thumbnail for ${videoId}, using original URL:`, error);
          uploadedThumbnail = thumbnailUrl;
        }
      } else if (isExisting) {
        console.log(`✅ Keeping existing thumbnail for TikTok video: ${videoId}`);
        uploadedThumbnail = ''; // Don't overwrite existing thumbnail
      } else if (!thumbnailUrl) {
        console.warn(`⚠️ TikTok video ${videoId} has no thumbnail URL in API response`);
      }

      const caption = item.text || item.description || '';
      
      const video: AccountVideo = {
        id: `${account.id}_${videoId}`,
        accountId: account.id,
        videoId: videoId,
        url: item.webVideoUrl || `https://www.tiktok.com/@${account.username}/video/${videoId}`,
        thumbnail: uploadedThumbnail,
        caption: caption,
        uploadDate: new Date(item.createTimeISO || item.createTime || Date.now()),
        views: item.playCount || 0,
        likes: item.diggCount || 0,
        comments: item.commentCount || 0,
        shares: item.shareCount || 0,
        saves: item.collectCount || 0,
        duration: item['videoMeta.duration'] || item.videoMeta?.duration || 0,
        isSponsored: false,
        hashtags: item.hashtags || [],
        mentions: item.mentions || [],
        platform: 'tiktok'
      };
      
      // Separate into new vs existing
      if (isExisting) {
        console.log(`   ♻️  Video ${videoId} already exists - updating metrics`);
        updatedVideos.push(video);
      } else {
        console.log(`   ✨ Video ${videoId} is NEW - will be added`);
        newVideos.push(video);
      }
    }

    console.log(`📊 TikTok sync complete: ${newVideos.length} new videos, ${updatedVideos.length} updated videos`);
    return { newVideos, updatedVideos };
  }

  /**
   * NEW: Incremental YouTube sync - Fetches videos and separates new vs existing
   * Returns BOTH new videos (to add) AND updated videos (to refresh metrics)
   */
  private static async syncYoutubeShortsIncremental(
    orgId: string,
    _projectId: string,
    account: TrackedAccount,
    existingVideoIds: Set<string>
  ): Promise<{ newVideos: AccountVideo[], updatedVideos: AccountVideo[] }> {
    const isNewAccount = existingVideoIds.size === 0;
    console.log(`🎯 Starting ${isNewAccount ? 'FULL' : 'INCREMENTAL'} YouTube sync for @${account.username}...`);
    
    try {
      // We need the channel ID to fetch Shorts
      // Fetch profile again to get channelId if not stored
      const profile = await YoutubeAccountService.fetchChannelProfile(account.username);
      if (!profile.channelId) {
        throw new Error('Could not resolve YouTube channel ID');
      }

      // Fetch shorts (up to 50 videos, sorted by date)
      const shorts = await YoutubeAccountService.syncChannelShorts(profile.channelId!, account.displayName || account.username);

      const newVideos: AccountVideo[] = [];
      const updatedVideos: AccountVideo[] = [];

      // Process each video and determine if it's new or existing
      for (const short of shorts) {
        const isExisting = existingVideoIds.has(short.videoId || '');
        
        // ONLY upload thumbnail to Firebase Storage for NEW videos
        let uploadedThumbnail = short.thumbnail;
        if (!isExisting && short.thumbnail) {
          try {
            console.log(`📸 Uploading thumbnail to Firebase Storage for NEW YouTube Short: ${short.videoId}`);
            uploadedThumbnail = await FirebaseStorageService.downloadAndUpload(
              orgId,
              short.thumbnail,
              `yt_${short.videoId}`,
              'thumbnail'
            );
          } catch (error) {
            console.warn(`⚠️ Failed to upload YouTube thumbnail for ${short.videoId}, using original URL:`, error);
            uploadedThumbnail = short.thumbnail;
          }
        } else if (isExisting) {
          console.log(`✅ Keeping existing thumbnail for YouTube Short: ${short.videoId}`);
          uploadedThumbnail = ''; // Don't overwrite existing thumbnail
        }

        const processedVideo: AccountVideo = {
          ...short,
          id: `${account.id}_${short.videoId}`,
          accountId: account.id,
          thumbnail: uploadedThumbnail,
        };

        if (isExisting) {
          // This video already exists - add to updated list for metric refresh
          updatedVideos.push(processedVideo);
          console.log(`♻️ Existing YouTube Short: ${short.videoId} - will refresh metrics`);
        } else {
          // This is a new video - add to new list
          newVideos.push(processedVideo);
          console.log(`➕ New YouTube Short: ${short.videoId}`);
        }
      }

      console.log(`🎉 YouTube incremental sync finished: ${newVideos.length} new videos, ${updatedVideos.length} updated videos`);
      return { newVideos, updatedVideos };
    } catch (error) {
      console.error('❌ Failed to sync YouTube Shorts:', error);
      throw error;
    }
  }

  // LEGACY syncYoutubeShorts removed - use syncYoutubeShortsIncremental instead

  /**
   * Sync Twitter tweets for an account
   */
  /**
   * INCREMENTAL Twitter sync - Fetches tweets and separates new vs existing
   * Only fetches up to 20 tweets (sorted by newest) and stops when hitting existing tweets
   */
  private static async syncTwitterTweetsIncremental(
    orgId: string,
    _projectId: string,
    account: TrackedAccount,
    existingVideoIds: Set<string>
  ): Promise<{ newVideos: AccountVideo[], updatedVideos: AccountVideo[] }> {
    const isNewAccount = existingVideoIds.size === 0;
    console.log(`🎯 Starting ${isNewAccount ? 'FULL' : 'INCREMENTAL'} Twitter sync for @${account.username}...`);
    
    try {
      const newVideos: AccountVideo[] = [];
      const updatedVideos: AccountVideo[] = [];
      
      // Fetch tweets (up to 20 for new accounts, 10 for incremental)
      const maxTweets = isNewAccount ? 20 : 10;
      
      const tweets = await TwitterApiService.fetchTweets(account.username, maxTweets);
      console.log(`📦 Twitter API returned ${tweets.length} tweets`);

      if (tweets.length === 0) {
        console.warn(`⚠️ No tweets found for @${account.username}`);
        return { newVideos: [], updatedVideos: [] };
      }

      // Process tweets and separate new vs existing
      for (const tweet of tweets) {
        const videoId = tweet.videoId || '';
        const isExisting = existingVideoIds.has(videoId);
        
        let uploadedThumbnail = tweet.thumbnail || '';
        
        // Log tweet data for debugging
        console.log(`📝 Processing tweet ${videoId}:`, {
          url: tweet.url,
          views: tweet.views,
          likes: tweet.likes,
          comments: tweet.comments,
          shares: tweet.shares,
          hasThumbnail: !!tweet.thumbnail,
          isExisting
        });
        
        // ONLY upload thumbnail to Firebase Storage for NEW tweets
        if (!isExisting && tweet.thumbnail) {
          try {
            console.log(`📸 Uploading thumbnail to Firebase Storage for NEW tweet: ${videoId}`);
            uploadedThumbnail = await FirebaseStorageService.downloadAndUpload(
              orgId,
              tweet.thumbnail,
              `twitter_${videoId}`,
              'thumbnail'
            );
            console.log(`✅ Twitter thumbnail uploaded to Firebase Storage for tweet ${videoId}`);
          } catch (error) {
            console.warn(`⚠️ Failed to upload Twitter thumbnail for ${videoId}, using original URL:`, error);
            uploadedThumbnail = tweet.thumbnail;
          }
        } else if (isExisting) {
          console.log(`✅ Keeping existing thumbnail for Twitter tweet: ${videoId}`);
          uploadedThumbnail = ''; // Don't overwrite existing thumbnail
        } else if (!tweet.thumbnail) {
          console.warn(`⚠️ Twitter tweet ${videoId} has no thumbnail`);
        }

        const video: AccountVideo = {
          ...tweet,
          id: `${account.id}_${videoId}`,
          accountId: account.id,
          thumbnail: uploadedThumbnail,
          platform: 'twitter'
        };

        // Separate into new vs existing
        if (isExisting) {
          console.log(`   ♻️  Tweet ${videoId} already exists - updating metrics`);
          updatedVideos.push(video);
        } else {
          console.log(`   ✨ Tweet ${videoId} is NEW - will be added`);
          newVideos.push(video);
        }
      }

      console.log(`📊 Twitter sync complete: ${newVideos.length} new tweets, ${updatedVideos.length} updated tweets`);
      
      return { newVideos, updatedVideos };
    } catch (error) {
      console.error('❌ Failed to sync Twitter tweets:', error);
      throw error;
    }
  }

  /**
   * Get videos for a specific account
   */
  static async getAccountVideos(orgId: string, projectId: string, accountId: string): Promise<AccountVideo[]> {
    try {
      const videos = await FirestoreDataService.getAccountVideos(orgId, projectId, accountId);
      
      // Convert to AccountVideo format
      const mappedVideos = videos.map(v => {
        // Try to get caption from all available fields in VideoDoc (description and title)
        // This ensures captions are always loaded regardless of which field they're stored in
        const caption = v.caption || v.videoTitle || '';
        const title = v.videoTitle || v.caption || '';
        
        return {
          id: v.id,
          accountId: v.trackedAccountId || '',
          videoId: v.videoId || '',
          url: v.videoUrl || v.url || '',
          thumbnail: v.thumbnail || '',
          caption: caption,
          title: title,
          uploadDate: v.uploadDate.toDate(),
          views: v.views || 0,
          likes: v.likes || 0,
          comments: v.comments || 0,
          shares: v.shares || 0,
          duration: v.duration || 0,
          isSponsored: false,
          hashtags: v.hashtags || [],
          mentions: []
        };
      });
      
      // Debug: Log first video caption to verify it's loaded
      if (mappedVideos.length > 0) {
        const first = mappedVideos[0];
        console.log('🔍 AccountTrackingServiceFirebase - First video:');
        console.log('   Video ID:', first.videoId);
        console.log('   Title:', first.title || '(EMPTY)');
        console.log('   Caption:', first.caption || '(EMPTY)');
        console.log('   Title length:', first.title?.length || 0);
        console.log('   Caption length:', first.caption?.length || 0);
      }
      
      return mappedVideos;
    } catch (error) {
      console.error('❌ Failed to load account videos:', error);
      return [];
    }
  }

  /**
   * Remove account and all its data
   */
  static async removeAccount(orgId: string, projectId: string, accountId: string): Promise<void> {
    try {
      console.log(`🗑️ Removing account ${accountId}...`);
      
      // Delete all videos
      await FirestoreDataService.deleteAccountVideos(orgId, projectId, accountId);
      
      // Delete all thumbnails
      await FirebaseStorageService.deleteAccountThumbnails(orgId, accountId);
      
      // Delete profile picture
      await FirebaseStorageService.deleteProfilePicture(orgId, accountId);
      
      // Delete account
      await FirestoreDataService.deleteTrackedAccount(orgId, projectId, accountId);
      
      console.log(`✅ Removed account ${accountId}`);
    } catch (error) {
      console.error('❌ Failed to remove account:', error);
      throw error;
    }
  }

  /**
   * Refresh account profile data
   */
  static async refreshAccountProfile(orgId: string, projectId: string, _userId: string, accountId: string): Promise<void> {
    try {
      const accounts = await this.getTrackedAccounts(orgId, projectId);
      const account = accounts.find(a => a.id === accountId);
      
      if (!account) {
        throw new Error('Account not found');
      }

      console.log(`🔄 Refreshing profile data for @${account.username}`);

      const profileData = await this.fetchAccountProfile(orgId, account.username, account.platform as any);
      
      await FirestoreDataService.updateTrackedAccount(orgId, projectId, accountId, {
        displayName: profileData.displayName,
        profilePicture: profileData.profilePicture,
        followerCount: profileData.followerCount,
        followingCount: profileData.followingCount,
        bio: profileData.bio,
        isVerified: profileData.isVerified,
        lastSynced: new Date() as any
      });

      console.log(`✅ Refreshed profile data`);
    } catch (error) {
      console.error('❌ Failed to refresh account profile:', error);
      throw error;
    }
  }
}

