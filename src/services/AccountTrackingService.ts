import { TrackedAccount, AccountVideo } from '../types/accounts';
import LocalStorageService from './LocalStorageService';

export class AccountTrackingService {
  private static readonly ACCOUNTS_STORAGE_KEY = 'tracked_accounts';

  // Get all tracked accounts
  static getTrackedAccounts(): TrackedAccount[] {
    try {
      const stored = localStorage.getItem(this.ACCOUNTS_STORAGE_KEY);
      if (!stored) return [];
      
      return JSON.parse(stored).map((account: any) => {
        // Try to load locally stored profile picture
        const localProfilePic = LocalStorageService.loadProfilePicture(account.username);
        
        return {
          ...account,
          dateAdded: new Date(account.dateAdded),
          lastSynced: account.lastSynced ? new Date(account.lastSynced) : undefined,
          // Use local profile picture if available, otherwise use stored URL
          profilePicture: localProfilePic || account.profilePicture,
        };
      });
    } catch (error) {
      console.error('Failed to load tracked accounts:', error);
      return [];
    }
  }

  // Save tracked accounts
  static saveTrackedAccounts(accounts: TrackedAccount[]): void {
    try {
      const serialized = JSON.stringify(accounts, (_key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      });
      localStorage.setItem(this.ACCOUNTS_STORAGE_KEY, serialized);
    } catch (error) {
      console.error('Failed to save tracked accounts:', error);
    }
  }

  // Add a new account to track
  static async addAccount(username: string, platform: 'instagram' | 'tiktok'): Promise<TrackedAccount> {
    try {
      // Fetch account profile data
      const profileData = await this.fetchAccountProfile(username, platform);
      
      const newAccount: TrackedAccount = {
        id: `${platform}_${username}_${Date.now()}`,
        username,
        platform,
        displayName: profileData.displayName,
        profilePicture: profileData.profilePicture,
        followerCount: profileData.followerCount,
        followingCount: profileData.followingCount,
        postCount: profileData.postCount,
        bio: profileData.bio,
        isVerified: profileData.isVerified,
        dateAdded: new Date(),
        lastSynced: undefined,
        isActive: true,
        totalVideos: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: platform === 'tiktok' ? 0 : undefined,
      };

      // Save to storage
      const accounts = this.getTrackedAccounts();
      accounts.push(newAccount);
      this.saveTrackedAccounts(accounts);

      return newAccount;
    } catch (error) {
      console.error('Failed to add account:', error);
      throw error;
    }
  }

  // Fetch account profile data
  private static async fetchAccountProfile(username: string, platform: 'instagram' | 'tiktok') {
    if (platform === 'instagram') {
      return await this.fetchInstagramProfile(username);
    } else {
      return await this.fetchTikTokProfile(username);
    }
  }

  // Fetch Instagram profile data
  private static async fetchInstagramProfile(username: string) {
    try {
      console.log(`🔄 Fetching Instagram profile for @${username}...`);
      
      // Call the Apify proxy to get profile data
      const proxyUrl = `${window.location.origin}/api/apify-proxy`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: 'apify~instagram-scraper',
          input: {
            directUrls: [`https://www.instagram.com/${username}/`],
            resultsType: 'posts',
            resultsLimit: 50, // Get more posts to increase chance of getting profile data
            addParentData: true, // This helps get profile info
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

      if (!result.items || !Array.isArray(result.items) || result.items.length === 0) {
        console.warn('No items found in Instagram profile response');
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

      // Extract profile information from the first item
      const firstItem = result.items[0];
      console.log('👤 Processing profile info from first item:', {
        ownerFullName: firstItem.ownerFullName,
        ownerUsername: firstItem.ownerUsername,
        ownerId: firstItem.ownerId
      });

      // Try to get profile picture from various sources
      let profilePictureUrl = '';
      
      // Method 1: Direct profile picture from item
      if (firstItem.ownerProfilePicUrl) {
        profilePictureUrl = firstItem.ownerProfilePicUrl;
        console.log('📸 Found profile picture from owner data:', profilePictureUrl);
      }
      
      // Method 2: Look in comments for profile owner's picture
      if (!profilePictureUrl && firstItem.latestComments && Array.isArray(firstItem.latestComments)) {
        for (const comment of firstItem.latestComments) {
          if (comment.ownerUsername === username && comment.ownerProfilePicUrl) {
            profilePictureUrl = comment.ownerProfilePicUrl;
            console.log('📸 Found profile picture in comments:', profilePictureUrl);
            break;
          }
        }
      }

      // Method 3: Look in all items for any profile picture reference
      if (!profilePictureUrl) {
        for (const item of result.items.slice(0, 10)) { // Check first 10 items
          if (item.ownerProfilePicUrl) {
            profilePictureUrl = item.ownerProfilePicUrl;
            console.log('📸 Found profile picture in item:', item.shortCode, profilePictureUrl);
            break;
          }
        }
      }

      // Download profile picture locally if found
      let localProfilePicture = '';
      if (profilePictureUrl) {
        localProfilePicture = await this.downloadThumbnail(profilePictureUrl, `profile_${username}`) || '';
        console.log('💾 Profile picture download result:', localProfilePicture ? 'Success' : 'Failed');
      }

      return {
        displayName: firstItem.ownerFullName || username,
        profilePicture: localProfilePicture,
        followerCount: 0, // Instagram API doesn't provide this easily
        followingCount: 0,
        postCount: result.items.length, // Use the number of posts we found
        bio: '',
        isVerified: firstItem.isVerified || false,
      };
    } catch (error) {
      console.error('Failed to fetch Instagram profile:', error);
      // Return basic structure on error
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

  // Fetch TikTok profile data
  private static async fetchTikTokProfile(username: string) {
    try {
      console.log(`🔄 Fetching TikTok profile for @${username}...`);
      
      // Call the Apify proxy to get profile data
      const proxyUrl = `${window.location.origin}/api/apify-proxy`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: 'clockworks~tiktok-scraper',
          input: {
            profiles: [username], // TikTok username without @
            maxItems: 30, // Get more videos to increase chance of getting profile data
            profileSections: ['Videos', 'Info'],
            profileVideoSorting: 'Latest'
          },
          action: 'run'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📊 TikTok profile API response:`, result);

      if (!result.items || !Array.isArray(result.items) || result.items.length === 0) {
        console.warn('No items found in TikTok profile response');
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

      // Look for profile information in the response
      let profileInfo = null;
      let videoCount = 0;
      let profilePictureUrl = '';

      // Check for profile data in items
      for (const item of result.items) {
        // Count videos
        if (item.webVideoUrl || item.id) {
          videoCount++;
        }
        
        // Look for profile info
        if (item.authorMeta || item.author) {
          const author = item.authorMeta || item.author;
          if (!profileInfo && author.name === username) {
            profileInfo = author;
            profilePictureUrl = author.avatar || author.profilePicture || '';
            console.log('👤 Found TikTok profile info:', {
              name: author.name,
              displayName: author.displayName || author.nickname,
              verified: author.verified,
              hasAvatar: !!profilePictureUrl
            });
            break;
          }
        }
      }

      // Download profile picture locally if found
      let localProfilePicture = '';
      if (profilePictureUrl) {
        localProfilePicture = await this.downloadThumbnail(profilePictureUrl, `profile_${username}`) || '';
        console.log('💾 TikTok profile picture download result:', localProfilePicture ? 'Success' : 'Failed');
      }

      return {
        displayName: profileInfo?.displayName || profileInfo?.nickname || username,
        profilePicture: localProfilePicture,
        followerCount: profileInfo?.fans || 0,
        followingCount: profileInfo?.following || 0,
        postCount: videoCount,
        bio: profileInfo?.signature || '',
        isVerified: profileInfo?.verified || false,
      };
    } catch (error) {
      console.error('Failed to fetch TikTok profile:', error);
      // Return basic structure on error
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

  // Sync account videos (fetch all videos from the account)
  static async syncAccountVideos(accountId: string): Promise<AccountVideo[]> {
    try {
      const accounts = this.getTrackedAccounts();
      const account = accounts.find(a => a.id === accountId);
      
      if (!account) {
        throw new Error('Account not found');
      }

      console.log(`🔄 Syncing videos for @${account.username} (${account.platform})`);

      let videos: AccountVideo[] = [];
      
      if (account.platform === 'instagram') {
        videos = await this.syncInstagramVideos(account);
      } else {
        videos = await this.syncTikTokVideos(account);
      }

      // Update account stats
      account.totalVideos = videos.length;
      account.totalViews = videos.reduce((sum, v) => sum + v.views, 0);
      account.totalLikes = videos.reduce((sum, v) => sum + v.likes, 0);
      account.totalComments = videos.reduce((sum, v) => sum + v.comments, 0);
      account.totalShares = videos.reduce((sum, v) => sum + (v.shares || 0), 0);
      account.lastSynced = new Date();

      // Save updated account
      const updatedAccounts = accounts.map(a => a.id === accountId ? account : a);
      this.saveTrackedAccounts(updatedAccounts);

      // Save videos
      this.saveAccountVideos(accountId, videos);

      console.log(`✅ Synced ${videos.length} videos for @${account.username}`);
      return videos;

    } catch (error) {
      console.error('Failed to sync account videos:', error);
      throw error;
    }
  }

  // Sync Instagram account videos
  private static async syncInstagramVideos(account: TrackedAccount): Promise<AccountVideo[]> {
    try {
      console.log(`🔄 Fetching Instagram reels for @${account.username}...`);
      
      // Prioritize direct reels endpoint as requested by user
      const approachesToTry = [
        {
          type: 'direct_reels_primary',
          input: {
            addParentData: false,
            directUrls: [`https://www.instagram.com/${account.username}/reels/`],
            enhanceUserSearchWithFacebookPage: false,
            isUserReelFeedURL: false,
            isUserTaggedFeedURL: false,
            resultsLimit: 50,
            resultsType: "stories",
            searchLimit: 1,
            searchType: "hashtag"
          }
        },
        {
          type: 'direct_reels_extended',
          input: {
            directUrls: [`https://www.instagram.com/${account.username}/reels/`],
            resultsType: 'posts',
            resultsLimit: 100,
            addParentData: true,
            searchType: 'user',
            scrollWaitSecs: 4,
            pageTimeout: 90
          }
        },
        {
          type: 'comprehensive_profile',
          input: {
            directUrls: [`https://www.instagram.com/${account.username}/`],
            resultsType: 'posts',
            resultsLimit: 150,
            addParentData: true,
            searchType: 'user',
            scrollWaitSecs: 4,
            pageTimeout: 90
          }
        },
        {
          type: 'fallback_profile',
          input: {
            directUrls: [`https://www.instagram.com/${account.username}/`],
            resultsType: 'posts',
            resultsLimit: 30,
            addParentData: false,
            searchType: 'user',
            scrollWaitSecs: 2,
            pageTimeout: 60
          }
        }
      ];
      
      let result: any = null;
      let usedApproach = '';
      
      // Call the Apify proxy with Instagram scraper configuration
      const proxyUrl = `${window.location.origin}/api/apify-proxy`;
      
      for (const approach of approachesToTry) {
        console.log(`🎯 Trying approach: ${approach.type}`);
        console.log(`📋 Input parameters:`, approach.input);
        
        try {
          const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              actorId: 'apify~instagram-scraper',
              input: approach.input,
              action: 'run'
            }),
          });

          if (!response.ok) {
            console.warn(`⚠️ Failed with ${approach.type}: ${response.status}`);
            continue;
          }

          const tempResult = await response.json();
          console.log(`📋 Raw API response for ${approach.type}:`, {
            hasItems: !!tempResult.items,
            itemsLength: tempResult.items?.length || 0,
            responseKeys: Object.keys(tempResult)
          });
          
          if (tempResult.items && Array.isArray(tempResult.items) && tempResult.items.length > 0) {
            result = tempResult;
            usedApproach = approach.type;
            console.log(`✅ Success with ${approach.type}: ${tempResult.items.length} items`);
            console.log(`📊 All items found:`, tempResult.items.map((item: any, index: number) => ({
              index: index + 1,
              shortCode: item.shortCode,
              type: item.type,
              productType: item.productType,
              hasVideo: !!(item.videoViewCount || item.videoPlayCount || item.videoDuration),
              videoViews: item.videoViewCount || item.videoPlayCount || 0,
              videoDuration: item.videoDuration || 0,
              hasVideoUrl: !!item.videoUrl
            })));
            break;
          } else {
            console.warn(`⚠️ No items found with ${approach.type}`);
            console.log(`📋 Response structure:`, tempResult);
          }
        } catch (error) {
          console.warn(`⚠️ Error with ${approach.type}:`, error);
          continue;
        }
      }

      if (!result) {
        throw new Error('Failed to fetch data from any URL');
      }

      console.log(`📊 Instagram API response from ${usedApproach}:`, result);

      if (!result.items || !Array.isArray(result.items)) {
        console.warn('No items found in Instagram response');
        return [];
      }

      // Extract and update profile information from the first item
      if (result.items.length > 0) {
        const firstItem = result.items[0];
        console.log('👤 Processing profile info from Instagram data...');
        console.log('📋 First item owner info:', {
          ownerFullName: firstItem.ownerFullName,
          ownerUsername: firstItem.ownerUsername,
          ownerId: firstItem.ownerId
        });
        
        if (firstItem.ownerFullName || firstItem.ownerUsername) {
          console.log('👤 Updating profile info from Instagram data...');
          
          // Extract profile picture from comments or tagged users
          const profilePicUrl = await this.extractProfilePicture(result.items);
          console.log('📸 Profile picture extraction result:', profilePicUrl ? 'Found and downloaded' : 'Not found');
          
          // Update account with profile data
          const updatedAccount = {
            ...account,
            displayName: firstItem.ownerFullName || account.displayName,
            profilePicture: profilePicUrl || account.profilePicture,
            lastSynced: new Date()
          };
          
          console.log('💾 Saving updated account with profile data:', {
            displayName: updatedAccount.displayName,
            hasProfilePicture: !!updatedAccount.profilePicture,
            profilePictureLength: updatedAccount.profilePicture?.length || 0
          });
          
          // Save updated account
          const accounts = this.getTrackedAccounts();
          const updatedAccounts = accounts.map(a => a.id === account.id ? updatedAccount : a);
          this.saveTrackedAccounts(updatedAccounts);
          
          console.log('✅ Profile info updated successfully');
        } else {
          console.log('⚠️ No owner info found in first item');
        }
      } else {
        console.log('⚠️ No items found to extract profile info from');
      }

      // Transform the Instagram data to AccountVideo format
      const accountVideos: AccountVideo[] = [];
      
      for (const item of result.items) {
        console.log('📊 Processing Instagram item:', {
          type: item.type,
          shortCode: item.shortCode,
          hasVideo: !!(item.videoViewCount || item.videoPlayCount),
          fields: Object.keys(item)
        });
        
        // More inclusive filtering for videos/reels
        const hasVideoMetrics = !!(item.videoViewCount || item.videoPlayCount);
        const hasVideoDuration = !!(item.videoDuration && item.videoDuration > 0);
        const isVideoType = item.type === 'Video';
        const isReelProduct = item.productType === 'clips';
        const hasVideoUrl = !!(item.videoUrl);
        
        // Include if it has any video indicators
        const shouldInclude = hasVideoMetrics || hasVideoDuration || isVideoType || isReelProduct || hasVideoUrl;
        
        console.log('🔍 Video filtering check:', {
          shortCode: item.shortCode,
          type: item.type,
          productType: item.productType,
          hasVideoMetrics,
          hasVideoDuration,
          isVideoType,
          isReelProduct,
          hasVideoUrl,
          shouldInclude
        });
        
        if (!shouldInclude) {
          console.log('⏭️ Skipping non-video post:', item.shortCode);
          continue;
        }
        
        console.log('✅ Including video/reel:', item.shortCode, 'Type:', item.type, 'ProductType:', item.productType, 'Views:', item.videoViewCount || item.videoPlayCount);
        
        // Download thumbnail locally
        const localThumbnail = await this.downloadThumbnail(item.displayUrl, `ig_${item.shortCode}`);
        
        const accountVideo: AccountVideo = {
          id: `${account.id}_${item.shortCode || item.id || Date.now()}`,
          accountId: account.id,
          videoId: item.shortCode || item.id || '',
          url: item.url || `https://www.instagram.com/p/${item.shortCode}/`,
          thumbnail: localThumbnail || item.displayUrl || '',
          caption: item.caption || '',
          uploadDate: new Date(item.timestamp || Date.now()),
          views: item.videoViewCount || item.videoPlayCount || 0,
          likes: item.likesCount || 0,
          comments: item.commentsCount || 0,
          shares: 0, // Instagram doesn't provide share count
          duration: item.videoDuration || 0,
          isSponsored: item.isSponsored || false,
          hashtags: item.hashtags || [],
          mentions: item.mentions || [],
          // Store the full original API data for reference
          rawData: {
            id: item.id,
            type: item.type,
            shortCode: item.shortCode,
            caption: item.caption,
            hashtags: item.hashtags || [],
            mentions: item.mentions || [],
            url: item.url,
            commentsCount: item.commentsCount,
            dimensionsHeight: item.dimensionsHeight,
            dimensionsWidth: item.dimensionsWidth,
            images: item.images || [],
            videoUrl: item.videoUrl,
            likesCount: item.likesCount,
            timestamp: item.timestamp,
            ownerFullName: item.ownerFullName,
            ownerUsername: item.ownerUsername,
            ownerId: item.ownerId,
            productType: item.productType,
            isSponsored: item.isSponsored,
            videoDuration: item.videoDuration,
            inputUrl: item.inputUrl,
            firstComment: item.firstComment,
            latestComments: item.latestComments || [],
            displayUrl: item.displayUrl,
            alt: item.alt,
            videoViewCount: item.videoViewCount,
            videoPlayCount: item.videoPlayCount,
            childPosts: item.childPosts || [],
            musicInfo: item.musicInfo,
            isCommentsDisabled: item.isCommentsDisabled
          }
        };
        
        console.log('✅ Added video to account:', {
          videoId: accountVideo.videoId,
          views: accountVideo.views,
          likes: accountVideo.likes,
          thumbnail: accountVideo.thumbnail ? 'Downloaded locally' : 'Using original URL'
        });
        
        accountVideos.push(accountVideo);
      }

      console.log(`📊 Instagram sync summary for @${account.username}:`, {
        totalItemsFromAPI: result.items.length,
        videosProcessed: accountVideos.length,
        filterRatio: `${accountVideos.length}/${result.items.length}`,
        usedApproach: usedApproach
      });
      
      console.log(`✅ Fetched ${accountVideos.length} Instagram videos for @${account.username}`);
      return accountVideos;

    } catch (error) {
      console.error('❌ Failed to sync Instagram videos:', error);
      throw error;
    }
  }

  // Sync TikTok account videos
  private static async syncTikTokVideos(account: TrackedAccount): Promise<AccountVideo[]> {
    try {
      console.log(`🔄 Fetching TikTok videos for @${account.username}...`);
      
      // Call the Apify proxy with TikTok scraper configuration
      const proxyUrl = `${window.location.origin}/api/apify-proxy`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: 'clockworks~tiktok-scraper',
          input: {
            profiles: [account.username], // TikTok username without @
            maxItems: 100, // Increased to get more videos per account
            profileSections: ['Videos', 'Info'], // Include profile info
            profileVideoSorting: 'Latest'
          },
          action: 'run'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📊 TikTok API response:`, result);

      if (!result.items || !Array.isArray(result.items)) {
        console.warn('No items found in TikTok response');
        return [];
      }

      // Transform the TikTok data to AccountVideo format
      const accountVideos: AccountVideo[] = [];
      
      for (const item of result.items) {
        // Skip if it's profile data, not video data
        if (!item.webVideoUrl && !item.id) continue;
        
        // Download thumbnail locally
        const thumbnailUrl = item['videoMeta.coverUrl'] || item.videoMeta?.coverUrl || item.coverUrl || '';
        const localThumbnail = await this.downloadThumbnail(thumbnailUrl, `tt_${item.id}`);
        
        const accountVideo: AccountVideo = {
          id: `${account.id}_${item.id || Date.now()}`,
          accountId: account.id,
          videoId: item.id || '',
          url: item.webVideoUrl || `https://www.tiktok.com/@${account.username}/video/${item.id}`,
          thumbnail: localThumbnail || thumbnailUrl,
          caption: item.text || item.description || '',
          uploadDate: new Date(item.createTimeISO || item.createTime || Date.now()),
          views: item.playCount || 0,
          likes: item.diggCount || 0,
          comments: item.commentCount || 0,
          shares: item.shareCount || 0,
          duration: item['videoMeta.duration'] || item.videoMeta?.duration || 0,
          isSponsored: false, // TikTok doesn't provide this info
          hashtags: item.hashtags || [],
          mentions: item.mentions || []
        };
        
        console.log('✅ Added TikTok video to account:', {
          videoId: accountVideo.videoId,
          views: accountVideo.views,
          likes: accountVideo.likes,
          thumbnail: accountVideo.thumbnail ? 'Downloaded locally' : 'Using original URL'
        });
        
        accountVideos.push(accountVideo);
      }

      console.log(`✅ Fetched ${accountVideos.length} TikTok videos for @${account.username}`);
      return accountVideos;

    } catch (error) {
      console.error('❌ Failed to sync TikTok videos:', error);
      throw error;
    }
  }

  // Get videos for a specific account
  static getAccountVideos(accountId: string): AccountVideo[] {
    return LocalStorageService.loadAccountVideos(accountId);
  }

  // Save videos for a specific account
  private static saveAccountVideos(accountId: string, videos: AccountVideo[]): void {
    LocalStorageService.saveAccountVideos(accountId, videos);
  }

  // Remove account
  static removeAccount(accountId: string): void {
    try {
      // Remove from accounts list
      const accounts = this.getTrackedAccounts().filter(a => a.id !== accountId);
      this.saveTrackedAccounts(accounts);

      // Remove videos data and profile picture
      LocalStorageService.removeAccountVideos(accountId);
      LocalStorageService.removeProfilePicture(accountId);
      
      console.log(`✅ Removed account ${accountId}`);
    } catch (error) {
      console.error('Failed to remove account:', error);
    }
  }

  // Toggle account active status
  static toggleAccountStatus(accountId: string): void {
    try {
      const accounts = this.getTrackedAccounts();
      const account = accounts.find(a => a.id === accountId);
      
      if (account) {
        account.isActive = !account.isActive;
        this.saveTrackedAccounts(accounts);
      }
    } catch (error) {
      console.error('Failed to toggle account status:', error);
    }
  }

  // Refresh account profile data (useful for updating profile pictures and info)
  static async refreshAccountProfile(accountId: string): Promise<TrackedAccount | null> {
    try {
      const accounts = this.getTrackedAccounts();
      const account = accounts.find(a => a.id === accountId);
      
      if (!account) {
        throw new Error('Account not found');
      }

      console.log(`🔄 Refreshing profile data for @${account.username} (${account.platform})`);

      // Fetch fresh profile data
      const profileData = await this.fetchAccountProfile(account.username, account.platform);
      
      // Update account with new profile data
      const updatedAccount = {
        ...account,
        displayName: profileData.displayName || account.displayName,
        profilePicture: profileData.profilePicture || account.profilePicture,
        followerCount: profileData.followerCount || account.followerCount,
        followingCount: profileData.followingCount || account.followingCount,
        postCount: profileData.postCount || account.postCount,
        bio: profileData.bio || account.bio,
        isVerified: profileData.isVerified ?? account.isVerified,
        lastSynced: new Date()
      };

      // Save updated account
      const updatedAccounts = accounts.map(a => a.id === accountId ? updatedAccount : a);
      this.saveTrackedAccounts(updatedAccounts);

      console.log(`✅ Refreshed profile data for @${account.username}`);
      return updatedAccount;

    } catch (error) {
      console.error('Failed to refresh account profile:', error);
      throw error;
    }
  }

  // Extract profile picture from Instagram data
  private static async extractProfilePicture(items: any[]): Promise<string | null> {
    try {
      console.log('🔍 Searching for profile picture in Instagram data...');
      
      // Look for profile picture in comments, tagged users, or coauthors
      for (const item of items) {
        console.log(`📊 Checking item ${item.shortCode} for profile picture...`);
        
        // Check comments for profile owner's picture
        if (item.latestComments && Array.isArray(item.latestComments)) {
          console.log(`💬 Checking ${item.latestComments.length} comments for profile picture...`);
          for (const comment of item.latestComments) {
            console.log(`👤 Comment by: ${comment.ownerUsername}, Target: ${item.ownerUsername}`);
            if (comment.ownerUsername === item.ownerUsername && comment.ownerProfilePicUrl) {
              console.log('📸 Found profile picture in comments!', comment.ownerProfilePicUrl);
              return await this.downloadThumbnail(comment.ownerProfilePicUrl, `profile_${item.ownerUsername}`);
            }
          }
        }

        // Check tagged users
        if (item.taggedUsers && Array.isArray(item.taggedUsers)) {
          console.log(`🏷️ Checking ${item.taggedUsers.length} tagged users for profile picture...`);
          for (const user of item.taggedUsers) {
            console.log(`👤 Tagged user: ${user.username}, Target: ${item.ownerUsername}`);
            if (user.username === item.ownerUsername && user.profile_pic_url) {
              console.log('📸 Found profile picture in tagged users!', user.profile_pic_url);
              return await this.downloadThumbnail(user.profile_pic_url, `profile_${item.ownerUsername}`);
            }
          }
        }

        // Check coauthors
        if (item.coauthorProducers && Array.isArray(item.coauthorProducers)) {
          console.log(`🤝 Checking ${item.coauthorProducers.length} coauthors for profile picture...`);
          for (const coauthor of item.coauthorProducers) {
            console.log(`👤 Coauthor: ${coauthor.username}, Target: ${item.ownerUsername}`);
            if (coauthor.username === item.ownerUsername && coauthor.profile_pic_url) {
              console.log('📸 Found profile picture in coauthors!', coauthor.profile_pic_url);
              return await this.downloadThumbnail(coauthor.profile_pic_url, `profile_${item.ownerUsername}`);
            }
          }
        }

        // Also check if there's any owner profile pic directly on the item
        if (item.ownerProfilePicUrl) {
          console.log('📸 Found profile picture directly on item!', item.ownerProfilePicUrl);
          return await this.downloadThumbnail(item.ownerProfilePicUrl, `profile_${item.ownerUsername}`);
        }
      }

      console.log('⚠️ No profile picture found in Instagram data');
      return null;
    } catch (error) {
      console.error('❌ Failed to extract profile picture:', error);
      return null;
    }
  }

  // Download and store thumbnail/image locally via proxy
  private static async downloadThumbnail(imageUrl: string, identifier: string): Promise<string | null> {
    try {
      if (!imageUrl) return null;

      console.log(`📥 Downloading thumbnail via proxy: ${identifier}`);
      
      // Use our Vercel proxy to download the image and bypass CORS
      const proxyUrl = `${window.location.origin}/api/image-proxy`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageUrl,
          identifier: identifier
        })
      });

      if (!response.ok) {
        throw new Error(`Proxy failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.dataUrl) {
        // Store using LocalStorageService based on identifier type
        if (identifier.startsWith('profile_')) {
          // This is a profile picture - extract account identifier
          const accountIdentifier = identifier.replace('profile_', '');
          LocalStorageService.saveProfilePicture(accountIdentifier, result.dataUrl);
        } else {
          // This is a video thumbnail
          LocalStorageService.saveThumbnail(identifier, result.dataUrl);
        }

        console.log(`✅ Downloaded and stored image via proxy: ${identifier}`);
        return result.dataUrl;
      } else {
        throw new Error(result.error || 'Proxy download failed');
      }

    } catch (error) {
      console.warn(`⚠️ Failed to download thumbnail for ${identifier}:`, error);
      // Return original URL as fallback - img tags can still load it directly
      console.log(`📷 Using original URL as fallback: ${identifier}`);
      return imageUrl;
    }
  }

  // Load thumbnail from localStorage
  static loadThumbnail(identifier: string): string | null {
    if (identifier.startsWith('profile_')) {
      // This is a profile picture - extract account identifier
      const accountIdentifier = identifier.replace('profile_', '');
      return LocalStorageService.loadProfilePicture(accountIdentifier);
    } else {
      // This is a video thumbnail
      return LocalStorageService.loadThumbnail(identifier);
    }
  }
}
