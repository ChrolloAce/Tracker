import { TrackedAccount, AccountVideo } from '../types/accounts';

export class AccountTrackingService {
  private static readonly ACCOUNTS_STORAGE_KEY = 'tracked_accounts';
  private static readonly ACCOUNT_VIDEOS_STORAGE_KEY = 'account_videos';

  // Get all tracked accounts
  static getTrackedAccounts(): TrackedAccount[] {
    try {
      const stored = localStorage.getItem(this.ACCOUNTS_STORAGE_KEY);
      if (!stored) return [];
      
      return JSON.parse(stored).map((account: any) => ({
        ...account,
        dateAdded: new Date(account.dateAdded),
        lastSynced: account.lastSynced ? new Date(account.lastSynced) : undefined,
      }));
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
      // Use Instagram API to fetch profile data
      // This would use the Instagram scraper to get profile info
      // For now, return basic structure
      return {
        displayName: username,
        profilePicture: '',
        followerCount: 0,
        followingCount: 0,
        postCount: 0,
        bio: '',
        isVerified: false,
      };
    } catch (error) {
      console.error('Failed to fetch Instagram profile:', error);
      throw error;
    }
  }

  // Fetch TikTok profile data
  private static async fetchTikTokProfile(username: string) {
    try {
      // Use TikTok API to fetch profile data
      // For now, return basic structure
      return {
        displayName: username,
        profilePicture: '',
        followerCount: 0,
        followingCount: 0,
        postCount: 0,
        bio: '',
        isVerified: false,
      };
    } catch (error) {
      console.error('Failed to fetch TikTok profile:', error);
      throw error;
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
      
      // Use the Apify Instagram scraper to get profile reels
      const profileUrl = `https://www.instagram.com/${account.username}/`;
      
      // Call the Apify proxy with Instagram scraper configuration
      const proxyUrl = `${window.location.origin}/api/apify-proxy`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: 'apify~instagram-scraper',
          input: {
            directUrls: [profileUrl],
            resultsType: 'posts',
            resultsLimit: 50
          },
          action: 'run'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📊 Instagram API response:`, result);

      if (!result.items || !Array.isArray(result.items)) {
        console.warn('No items found in Instagram response');
        return [];
      }

      // Extract and update profile information from the first item
      if (result.items.length > 0) {
        const firstItem = result.items[0];
        if (firstItem.ownerFullName || firstItem.ownerUsername) {
          console.log('👤 Updating profile info from Instagram data...');
          
          // Extract profile picture from comments or tagged users
          const profilePicUrl = await this.extractProfilePicture(result.items);
          
          // Update account with profile data
          const updatedAccount = {
            ...account,
            displayName: firstItem.ownerFullName || account.displayName,
            profilePicture: profilePicUrl || account.profilePicture,
            lastSynced: new Date()
          };
          
          // Save updated account
          const accounts = this.getTrackedAccounts();
          const updatedAccounts = accounts.map(a => a.id === account.id ? updatedAccount : a);
          this.saveTrackedAccounts(updatedAccounts);
        }
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
        
        // Only include videos/reels (skip photos and carousels without videos)
        if (!item.videoViewCount && !item.videoPlayCount) {
          console.log('⏭️ Skipping non-video post:', item.shortCode);
          continue;
        }
        
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
          mentions: item.mentions || []
        };
        
        console.log('✅ Added video to account:', {
          videoId: accountVideo.videoId,
          views: accountVideo.views,
          likes: accountVideo.likes,
          thumbnail: accountVideo.thumbnail ? 'Downloaded locally' : 'Using original URL'
        });
        
        accountVideos.push(accountVideo);
      }

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
            maxItems: 50, // Max 50 videos per account
            profileSections: ['Videos'],
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
    try {
      const stored = localStorage.getItem(`${this.ACCOUNT_VIDEOS_STORAGE_KEY}_${accountId}`);
      if (!stored) return [];
      
      return JSON.parse(stored).map((video: any) => ({
        ...video,
        uploadDate: new Date(video.uploadDate),
      }));
    } catch (error) {
      console.error('Failed to load account videos:', error);
      return [];
    }
  }

  // Save videos for a specific account
  private static saveAccountVideos(accountId: string, videos: AccountVideo[]): void {
    try {
      const serialized = JSON.stringify(videos, (_key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      });
      localStorage.setItem(`${this.ACCOUNT_VIDEOS_STORAGE_KEY}_${accountId}`, serialized);
    } catch (error) {
      console.error('Failed to save account videos:', error);
    }
  }

  // Remove account
  static removeAccount(accountId: string): void {
    try {
      // Remove from accounts list
      const accounts = this.getTrackedAccounts().filter(a => a.id !== accountId);
      this.saveTrackedAccounts(accounts);

      // Remove videos data
      localStorage.removeItem(`${this.ACCOUNT_VIDEOS_STORAGE_KEY}_${accountId}`);
      
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

  // Extract profile picture from Instagram data
  private static async extractProfilePicture(items: any[]): Promise<string | null> {
    try {
      // Look for profile picture in comments, tagged users, or coauthors
      for (const item of items) {
        // Check comments for profile owner's picture
        if (item.latestComments && Array.isArray(item.latestComments)) {
          for (const comment of item.latestComments) {
            if (comment.ownerUsername === item.ownerUsername && comment.ownerProfilePicUrl) {
              console.log('📸 Found profile picture in comments');
              return await this.downloadThumbnail(comment.ownerProfilePicUrl, `profile_${item.ownerUsername}`);
            }
          }
        }

        // Check tagged users
        if (item.taggedUsers && Array.isArray(item.taggedUsers)) {
          for (const user of item.taggedUsers) {
            if (user.username === item.ownerUsername && user.profile_pic_url) {
              console.log('📸 Found profile picture in tagged users');
              return await this.downloadThumbnail(user.profile_pic_url, `profile_${item.ownerUsername}`);
            }
          }
        }

        // Check coauthors
        if (item.coauthorProducers && Array.isArray(item.coauthorProducers)) {
          for (const coauthor of item.coauthorProducers) {
            if (coauthor.username === item.ownerUsername && coauthor.profile_pic_url) {
              console.log('📸 Found profile picture in coauthors');
              return await this.downloadThumbnail(coauthor.profile_pic_url, `profile_${item.ownerUsername}`);
            }
          }
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
        // Store in localStorage with a unique key
        const storageKey = `thumbnail_${identifier}`;
        localStorage.setItem(storageKey, result.dataUrl);

        console.log(`✅ Downloaded and stored thumbnail via proxy: ${identifier}`);
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
    try {
      const storageKey = `thumbnail_${identifier}`;
      return localStorage.getItem(storageKey);
    } catch (error) {
      console.error('Failed to load thumbnail:', error);
      return null;
    }
  }
}
