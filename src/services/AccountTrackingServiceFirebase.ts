import { TrackedAccount, AccountVideo } from '../types/accounts';
import FirestoreDataService from './FirestoreDataService';
import FirebaseStorageService from './FirebaseStorageService';
import OutlierDetectionService from './OutlierDetectionService';
import { Timestamp } from 'firebase/firestore';

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
  static async getTrackedAccounts(orgId: string, projectId: string, platform?: 'instagram' | 'tiktok' | 'youtube'): Promise<TrackedAccount[]> {
    try {
      const firestoreAccounts = await FirestoreDataService.getTrackedAccounts(orgId, projectId, platform);
      
      // Convert Firestore format to TrackedAccount format
      return firestoreAccounts.map(acc => ({
        id: acc.id,
        username: acc.username,
        platform: acc.platform as 'instagram' | 'tiktok' | 'youtube',
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
  static async addAccount(
    orgId: string,
    projectId: string,
    userId: string,
    username: string,
    platform: 'instagram' | 'tiktok' | 'youtube',
    accountType: 'my' | 'competitor' = 'my'
  ): Promise<string> {
    try {
      console.log(`➕ Adding ${accountType} account @${username} on ${platform} to project ${projectId}`);
      
      // Fetch account profile data
      const profileData = platform !== 'youtube' 
        ? await this.fetchAccountProfile(orgId, username, platform)
        : {
            displayName: username,
            profilePicture: undefined,
            followerCount: 0,
            followingCount: 0,
            postCount: 0,
            bio: '',
            isVerified: false
          };
      
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
        isActive: true
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
  private static async fetchInstagramProfile(_orgId: string, username: string) {
    try {
      console.log(`🔄 Fetching Instagram profile for @${username}...`);
      
      const proxyUrl = `${window.location.origin}/api/apify-proxy`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: 'apify~instagram-scraper',
          input: {
            directUrls: [`https://www.instagram.com/${username}/`],
            resultsType: 'posts',
            resultsLimit: 50,
            addParentData: true,
            searchType: 'user',
            scrollWaitSecs: 2,
            pageTimeout: 60
          },
          action: 'run'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📊 Instagram profile API response:`, result);

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
      
      // Try multiple fields for profile picture (Instagram API varies)
      let profilePictureUrl = firstItem.ownerProfilePicUrl || 
                              firstItem.ownerProfilePicture ||
                              firstItem.profilePicUrl ||
                              firstItem.profilePicture ||
                              (firstItem.owner && firstItem.owner.profilePicUrl) ||
                              '';
      
      console.log(`📸 Found Instagram profile picture URL:`, profilePictureUrl);
      
      // Instagram CDN URLs are heavily protected and expire quickly
      // Don't try to download them - just use the URL directly or leave empty
      // The frontend will show a placeholder icon if no profile picture
      const profilePicture = profilePictureUrl || '';
      
      if (profilePicture) {
        console.log(`✅ Using Instagram profile picture URL directly for @${username}`);
      } else {
        console.warn(`⚠️ No profile picture URL found for @${username} - will use placeholder`);
      }

      return {
        displayName: firstItem.ownerFullName || username,
        profilePicture,
        followerCount: 0,
        followingCount: 0,
        postCount: result.items.length,
        bio: '',
        isVerified: firstItem.isVerified || false,
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

      // Fetch videos from platform
      const videos = account.platform === 'instagram'
        ? await this.syncInstagramVideos(orgId, account)
        : await this.syncTikTokVideos(orgId, account);

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
   * Sync Instagram videos
   */
  private static async syncInstagramVideos(orgId: string, account: TrackedAccount): Promise<AccountVideo[]> {
    // Implementation similar to original but using Firebase Storage for thumbnails
    // This is a simplified version - you can expand based on your needs
    console.log(`🔄 Fetching Instagram videos for @${account.username}...`);
    
    const proxyUrl = `${window.location.origin}/api/apify-proxy`;
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorId: 'apify~instagram-scraper',
        input: {
          directUrls: [`https://www.instagram.com/${account.username}/reels/`],
          resultsType: 'posts',
          resultsLimit: 100,
          addParentData: true,
          searchType: 'user'
        },
        action: 'run'
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.items || !Array.isArray(result.items)) {
      return [];
    }

    const videos: AccountVideo[] = [];

    for (const item of result.items) {
      // Filter for videos only
      const isVideo = !!(item.videoViewCount || item.videoPlayCount || item.videoDuration);
      if (!isVideo) continue;

      // Upload thumbnail to Firebase Storage
      let thumbnailUrl = item.displayUrl;
      if (thumbnailUrl) {
        thumbnailUrl = await FirebaseStorageService.downloadAndUpload(
          orgId,
          thumbnailUrl,
          `ig_${item.shortCode}`,
          'thumbnail'
        );
      }

      videos.push({
        id: `${account.id}_${item.shortCode}`,
        accountId: account.id,
        videoId: item.shortCode || '',
        url: item.url || `https://www.instagram.com/p/${item.shortCode}/`,
        thumbnail: thumbnailUrl,
        caption: item.caption || '',
        uploadDate: new Date(item.timestamp || Date.now()),
        views: item.videoViewCount || item.videoPlayCount || 0,
        likes: item.likesCount || 0,
        comments: item.commentsCount || 0,
        shares: 0,
        duration: item.videoDuration || 0,
        isSponsored: item.isSponsored || false,
        hashtags: item.hashtags || [],
        mentions: item.mentions || []
      });
    }

    console.log(`✅ Fetched ${videos.length} Instagram videos`);
    return videos;
  }

  /**
   * Sync TikTok videos
   */
  private static async syncTikTokVideos(orgId: string, account: TrackedAccount): Promise<AccountVideo[]> {
    console.log(`🔄 Fetching TikTok videos for @${account.username}...`);
    
    const proxyUrl = `${window.location.origin}/api/apify-proxy`;
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorId: 'clockworks~tiktok-scraper',
        input: {
          profiles: [account.username],
          resultsPerPage: 100,
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
      return [];
    }

    const videos: AccountVideo[] = [];

    for (const item of result.items) {
      if (!item.webVideoUrl && !item.id) continue;

      // Upload thumbnail to Firebase Storage
      const thumbnailUrl = item['videoMeta.coverUrl'] || item.videoMeta?.coverUrl || item.coverUrl || '';
      let uploadedThumbnail = thumbnailUrl;
      if (thumbnailUrl) {
        uploadedThumbnail = await FirebaseStorageService.downloadAndUpload(
          orgId,
          thumbnailUrl,
          `tt_${item.id}`,
          'thumbnail'
        );
      }

      videos.push({
        id: `${account.id}_${item.id}`,
        accountId: account.id,
        videoId: item.id || '',
        url: item.webVideoUrl || `https://www.tiktok.com/@${account.username}/video/${item.id}`,
        thumbnail: uploadedThumbnail,
        caption: item.text || item.description || '',
        uploadDate: new Date(item.createTimeISO || item.createTime || Date.now()),
        views: item.playCount || 0,
        likes: item.diggCount || 0,
        comments: item.commentCount || 0,
        shares: item.shareCount || 0,
        duration: item['videoMeta.duration'] || item.videoMeta?.duration || 0,
        isSponsored: false,
        hashtags: item.hashtags || [],
        mentions: item.mentions || []
      });
    }

    console.log(`✅ Fetched ${videos.length} TikTok videos`);
    return videos;
  }

  /**
   * Get videos for a specific account
   */
  static async getAccountVideos(orgId: string, projectId: string, accountId: string): Promise<AccountVideo[]> {
    try {
      const videos = await FirestoreDataService.getAccountVideos(orgId, projectId, accountId);
      
      // Convert to AccountVideo format
      return videos.map(v => ({
        id: v.id,
        accountId: v.trackedAccountId || '',
        videoId: v.videoId || '',
        url: v.url || '',
        thumbnail: v.thumbnail || '',
        caption: v.description || '',
        uploadDate: v.uploadDate.toDate(),
        views: v.views || 0,
        likes: v.likes || 0,
        comments: v.comments || 0,
        shares: v.shares || 0,
        duration: v.duration || 0,
        isSponsored: false,
        hashtags: v.hashtags || [],
        mentions: []
      }));
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

