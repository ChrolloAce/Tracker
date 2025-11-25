// Trigger redeploy: 2025-11-22 Admin bypass fix
import { TrackedAccount, AccountVideo } from '../types/accounts';
import FirestoreDataService from './FirestoreDataService';
import YoutubeAccountService from './YoutubeAccountService';
import TwitterApiService from './TwitterApiService';
import { SyncCoordinator } from './sync/SyncCoordinator';
import { getAuth } from 'firebase/auth';
import FirebaseStorageService from './FirebaseStorageService';

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
      
      // Add YouTube channel ID if available (CRITICAL for avoiding wrong channel lookups)
      if (platform === 'youtube' && 'channelId' in profileData && profileData.channelId) {
        accountData.youtubeChannelId = profileData.channelId;
        console.log(`✅ Storing YouTube channel ID: ${profileData.channelId}`);
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
      return await SyncCoordinator.syncAccount(orgId, projectId, userId, accountId);
    } catch (error) {
      console.error('❌ Failed to sync account videos:', error);
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
   * Remove account and all its data (calls immediate deletion API)
   */
  static async removeAccount(orgId: string, projectId: string, accountId: string, username?: string, platform?: string): Promise<void> {
    try {
      console.log(`🗑️ Removing account ${accountId} immediately via API...`);
      
      // Get Firebase ID token for authentication
      const user = getAuth().currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const token = await user.getIdToken();
      
      // Call the immediate deletion API
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orgId,
          projectId,
          accountId,
          username,
          platform
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete account');
      }
      
      const result = await response.json();
      console.log(`✅ Account deleted successfully in ${result.duration}s (${result.videosDeleted} videos, ${result.snapshotsDeleted} snapshots removed)`);
      
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

