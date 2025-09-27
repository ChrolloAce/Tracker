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
      // Use Instagram API to fetch all videos from the account
      // This would call the Instagram scraper with profile URL to get all posts
      // For now, return empty array - you'll need to implement the actual API call
      console.log(`Fetching Instagram videos for ${account.username}`);
      
      return [];
    } catch (error) {
      console.error('Failed to sync Instagram videos:', error);
      throw error;
    }
  }

  // Sync TikTok account videos
  private static async syncTikTokVideos(account: TrackedAccount): Promise<AccountVideo[]> {
    try {
      // Use TikTok API to fetch all videos from the account
      // This would call the TikTok scraper with profile URL to get all videos
      // For now, return empty array - you'll need to implement the actual API call
      console.log(`Fetching TikTok videos for @${account.username}`);
      
      return [];
    } catch (error) {
      console.error('Failed to sync TikTok videos:', error);
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
}
