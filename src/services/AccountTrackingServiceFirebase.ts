import { TrackedAccount, AccountVideo } from '../types/accounts';
import FirestoreDataService from './FirestoreDataService';
import FirebaseStorageService from './FirebaseStorageService';
import OutlierDetectionService from './OutlierDetectionService';
import YoutubeAccountService from './YoutubeAccountService';
import TwitterApiService from './TwitterApiService';
import RulesService from './RulesService';
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
    accountType: 'my' | 'competitor' = 'my'
  ): Promise<string> {
    try {
      console.log(`⚡ Quick-adding ${accountType} account @${username} on ${platform} (background sync)`);
      
      // Add to Firestore immediately with minimal data
      // The cron job will fetch profile data and videos in the background
      const accountData: any = {
        username,
        platform,
        accountType,
        displayName: username, // Use username as placeholder
        isActive: true
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
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // USE NEW WORKING SCRAPER!
          actorId: 'scraper-engine~instagram-reels-scraper',
          input: {
            urls: [`https://www.instagram.com/${username}/`],
            sortOrder: "newest",
            maxComments: 10,
            maxReels: 10, // Just need a few for profile info
            proxyConfiguration: {
              useApifyProxy: true  // Use Apify proxy for better reliability
            }
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
      
      // NEW SCRAPER: Profile pic from media.user
      let profilePictureUrl = media.user?.profile_pic_url || media.owner?.profile_pic_url || '';
      
      console.log(`📸 Found Instagram profile picture URL from NEW scraper:`, profilePictureUrl ? 'Yes' : 'No');
      
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
      let videos: AccountVideo[];
      if (account.platform === 'instagram') {
        videos = await this.syncInstagramVideos(orgId, projectId, account);
      } else if (account.platform === 'tiktok') {
        videos = await this.syncTikTokVideos(orgId, account);
      } else if (account.platform === 'twitter') {
        videos = await this.syncTwitterTweets(orgId, account);
      } else {
        // YouTube
        videos = await this.syncYoutubeShorts(orgId, account);
      }

      // Apply tracking rules to filter videos
      console.log(`📋 Checking for tracking rules...`);
      const filteredVideos = await RulesService.filterVideosByRules(
        orgId,
        projectId,
        accountId,
        account.platform,
        videos
      );

      console.log(`✅ After rules: ${filteredVideos.length}/${videos.length} videos will be tracked`);

      // Sync to Firestore
      await FirestoreDataService.syncAccountVideos(
        orgId,
        projectId,
        accountId,
        userId,
        filteredVideos.map(v => ({
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

      console.log(`✅ Synced ${filteredVideos.length} videos for @${account.username}`);
      return filteredVideos.length;
    } catch (error) {
      console.error('❌ Failed to sync account videos:', error);
      throw error;
    }
  }

  /**
   * Sync Instagram videos - USING NEW WORKING SCRAPER!
   */
  private static async syncInstagramVideos(orgId: string, projectId: string, account: TrackedAccount): Promise<AccountVideo[]> {
    console.log(`🔄 Fetching Instagram videos for @${account.username} using NEW Reels Scraper...`);
    
    const proxyUrl = `${window.location.origin}/api/apify-proxy`;
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // NEW WORKING SCRAPER!
        actorId: 'scraper-engine~instagram-reels-scraper',
        input: {
          urls: [`https://www.instagram.com/${account.username}/`],
          sortOrder: "newest",
          maxComments: 10,
          maxReels: 100,
          proxyConfiguration: {
            useApifyProxy: true  // Use Apify proxy for better reliability
          }
        },
        action: 'run'
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`📊 NEW Scraper returned ${result.items?.length || 0} items`);

    if (!result.items || !Array.isArray(result.items)) {
      console.warn('⚠️ No items returned from NEW Instagram scraper');
      return [];
    }

    // Extract and update profile info from first item (NEW SCRAPER FORMAT)
    if (result.items.length > 0) {
      const firstItem = result.items[0];
      // NEW SCRAPER: Data is nested under reel_data.media
      const media = firstItem.reel_data?.media || firstItem.media || firstItem;
      
      const profileFullName = media.user?.full_name || media.owner?.full_name;
      const profilePicUrl = media.user?.profile_pic_url || media.owner?.profile_pic_url;
      
      if (profileFullName || profilePicUrl) {
        console.log('👤 Updating Instagram profile from NEW scraper...');
        
        // Download and save profile picture if available
        let uploadedProfilePic = account.profilePicture;
        if (profilePicUrl) {
          try {
            console.log('📸 Downloading profile picture from NEW scraper...');
            uploadedProfilePic = await FirebaseStorageService.downloadAndUpload(
              orgId,
              profilePicUrl,
              `ig_profile_${account.username}`,
              'profile'
            );
            console.log('✅ Profile picture uploaded to Firebase Storage');
          } catch (error) {
            console.warn('⚠️ Failed to upload profile picture:', error);
            uploadedProfilePic = profilePicUrl; // Use original URL as fallback
          }
        }
        
        // Update account with profile data
        const profileUpdates: any = {};
        if (profileFullName) {
          profileUpdates.displayName = profileFullName;
        }
        if (uploadedProfilePic && uploadedProfilePic !== account.profilePicture) {
          profileUpdates.profilePicture = uploadedProfilePic;
        }
        
        if (Object.keys(profileUpdates).length > 0) {
          await FirestoreDataService.updateTrackedAccount(orgId, projectId, account.id, profileUpdates);
          console.log('✅ Updated Instagram profile for @' + account.username);
        }
      }
    }

    const videos: AccountVideo[] = [];

    for (const item of result.items) {
      // NEW SCRAPER: Data is nested under 'reel_data.media'
      const media = item.reel_data?.media || item.media || item;
      
      // Filter for videos only (check for play_count or video_duration)
      const isVideo = !!(media.play_count || media.ig_play_count || media.video_duration);
      if (!isVideo) {
        console.log(`⏭️ Skipping non-video item (no play_count or video_duration)`);
        continue;
      }

      // NEW SCRAPER: Use 'code' field for ID
      const videoCode = media.code || media.shortCode || media.id;
      if (!videoCode) {
        console.warn('⚠️ Video missing code/ID, skipping');
        continue;
      }

      // NEW SCRAPER: Thumbnail from image_versions2
      let thumbnailUrl = '';
      if (media.image_versions2?.candidates && media.image_versions2.candidates.length > 0) {
        thumbnailUrl = media.image_versions2.candidates[0].url;
      } else if (media.display_uri) {
        thumbnailUrl = media.display_uri;
      } else if (media.displayUrl) {
        thumbnailUrl = media.displayUrl;
      }

      // Upload thumbnail to Firebase Storage if we have one
      let uploadedThumbnail = thumbnailUrl;
      if (thumbnailUrl) {
        try {
          uploadedThumbnail = await FirebaseStorageService.downloadAndUpload(
            orgId,
            thumbnailUrl,
            `ig_${videoCode}`,
            'thumbnail'
          );
        } catch (error) {
          console.warn(`⚠️ Failed to upload thumbnail for ${videoCode}, using original URL:`, error);
          uploadedThumbnail = thumbnailUrl;
        }
      }

      // NEW SCRAPER: Caption is nested under caption.text
      const caption = media.caption?.text || (typeof media.caption === 'string' ? media.caption : '') || '';
      
      // NEW SCRAPER: Upload date from taken_at (Unix seconds)
      const uploadDate = media.taken_at 
        ? new Date(media.taken_at * 1000) 
        : (media.takenAt ? new Date(media.takenAt * 1000) : new Date());

      // NEW SCRAPER: Metrics with correct field names
      const views = media.play_count || media.ig_play_count || 0;
      const likes = media.like_count || 0;
      const comments = media.comment_count || 0;
      const duration = media.video_duration || 0;

      // Debug: Log first video
      if (videos.length === 0) {
        console.log('🔍 NEW Scraper first video:', {
          code: videoCode,
          caption: caption.substring(0, 50),
          views,
          likes,
          comments,
          duration,
          uploadDate: uploadDate.toISOString()
        });
      }

      videos.push({
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
        shares: 0, // Instagram doesn't provide share count via API
        duration: duration,
        isSponsored: false,
        hashtags: [], // Could extract from caption if needed
        mentions: [] // Could extract from caption if needed
      });
    }

    console.log(`✅ Fetched ${videos.length} Instagram videos using NEW scraper`);
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

      const caption = item.text || item.description || '';
      
      // Debug: Log first video caption
      if (videos.length === 0 && caption) {
        console.log('🔍 TikTok first video caption:', {
          text: item.text,
          description: item.description,
          finalCaption: caption,
          videoId: item.id
        });
      }
      
      videos.push({
        id: `${account.id}_${item.id}`,
        accountId: account.id,
        videoId: item.id || '',
        url: item.webVideoUrl || `https://www.tiktok.com/@${account.username}/video/${item.id}`,
        thumbnail: uploadedThumbnail,
        caption: caption,
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
   * Sync YouTube Shorts videos
   */
  private static async syncYoutubeShorts(orgId: string, account: TrackedAccount): Promise<AccountVideo[]> {
    console.log(`🔄 Fetching YouTube Shorts for @${account.username}...`);
    
    try {
      // We need the channel ID to fetch Shorts
      // Fetch profile again to get channelId if not stored
      const profile = await YoutubeAccountService.fetchChannelProfile(account.username);
      if (!profile.channelId) {
        throw new Error('Could not resolve YouTube channel ID');
      }

      const shorts = await YoutubeAccountService.syncChannelShorts(profile.channelId!, account.displayName || account.username);

      // Upload thumbnails to Firebase Storage
      const videos: AccountVideo[] = [];
      for (const short of shorts) {
        let uploadedThumbnail = short.thumbnail;
        if (short.thumbnail) {
          uploadedThumbnail = await FirebaseStorageService.downloadAndUpload(
            orgId,
            short.thumbnail,
            `yt_${short.videoId}`,
            'thumbnail'
          );
        }

        videos.push({
          ...short,
          id: `${account.id}_${short.videoId}`,
          accountId: account.id,
          thumbnail: uploadedThumbnail,
        });
      }

      console.log(`✅ Fetched ${videos.length} YouTube Shorts`);
      return videos;
    } catch (error) {
      console.error('❌ Failed to sync YouTube Shorts:', error);
      throw error;
    }
  }

  /**
   * Sync Twitter tweets for an account
   */
  private static async syncTwitterTweets(orgId: string, account: TrackedAccount): Promise<AccountVideo[]> {
    console.log(`🐦 Fetching tweets for @${account.username}...`);
    
    try {
      const tweets = await TwitterApiService.fetchTweets(account.username, 100);
      console.log(`📊 Fetched ${tweets.length} raw tweets from Twitter`);

      if (tweets.length === 0) {
        console.warn(`⚠️ No tweets found for @${account.username}`);
        return [];
      }

      // Upload thumbnails to Firebase Storage if they exist
      const videos: AccountVideo[] = [];
      for (const tweet of tweets) {
        let uploadedThumbnail = tweet.thumbnail || '';
        
        // Log tweet data for debugging
        console.log(`📝 Processing tweet ${tweet.videoId}:`, {
          url: tweet.url,
          views: tweet.views,
          likes: tweet.likes,
          comments: tweet.comments,
          shares: tweet.shares,
          hasThumbnail: !!tweet.thumbnail
        });
        
        if (tweet.thumbnail) {
          try {
            uploadedThumbnail = await FirebaseStorageService.downloadAndUpload(
              orgId,
              tweet.thumbnail,
              `twitter_${tweet.videoId}`,
              'thumbnail'
            );
            console.log(`✅ Thumbnail uploaded for tweet ${tweet.videoId}`);
          } catch (error) {
            console.warn(`⚠️ Failed to upload thumbnail for tweet ${tweet.videoId}, using original URL:`, error);
            // Keep original URL if upload fails
            uploadedThumbnail = tweet.thumbnail;
          }
        }

        videos.push({
          ...tweet,
          id: `${account.id}_${tweet.videoId}`,
          accountId: account.id,
          thumbnail: uploadedThumbnail,
          platform: 'twitter', // Ensure platform is set
        });
      }

      console.log(`✅ Processed ${videos.length} tweets for @${account.username}`);
      console.log(`📊 Sample tweet data:`, videos[0] || 'No tweets');
      
      return videos;
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
      return videos.map(v => ({
        id: v.id,
        accountId: v.trackedAccountId || '',
        videoId: v.videoId || '',
        url: v.url || '',
        thumbnail: v.thumbnail || '',
        caption: v.description || '',
        title: v.title || '',
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

