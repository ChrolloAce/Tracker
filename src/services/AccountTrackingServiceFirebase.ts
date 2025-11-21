import { TrackedAccount, AccountVideo } from '../types/accounts';
import FirestoreDataService from './FirestoreDataService';
import { SyncManager } from './sync/SyncManager';
import { ProfileFetcher } from './sync/shared/ProfileFetcher';
import { getAuth } from 'firebase/auth';

/**
 * AccountTrackingServiceFirebase
 * 
 * Purpose: Main public API for managing tracked social media accounts
 * Responsibilities:
 * - Get and list tracked accounts
 * - Add new accounts for tracking
 * - Sync account videos (delegates to SyncManager)
 * - Remove accounts
 * - Refresh account profiles
 * 
 * Note: This is now a thin wrapper around modular services.
 * All sync logic has been extracted to src/services/sync/
 */
export class AccountTrackingServiceFirebase {
  
  /**
   * Get all tracked accounts for a project
   */
  static async getTrackedAccounts(
    orgId: string,
    projectId: string,
    platform?: 'instagram' | 'tiktok' | 'youtube' | 'twitter'
  ): Promise<TrackedAccount[]> {
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
        totalShares: acc.totalShares || 0,
        youtubeChannelId: acc.youtubeChannelId
      }));
    } catch (error) {
      console.error('❌ Failed to load tracked accounts from Firestore:', error);
      return [];
    }
  }

  /**
   * Add account for BACKGROUND sync (non-blocking)
   * Adds the account instantly and queues it for background processing
   */
  static async addAccount(
    orgId: string,
    projectId: string,
    userId: string,
    username: string,
    platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter',
    accountType: 'my' | 'competitor' = 'my',
    maxVideos: number = 100
  ): Promise<string> {
    try {
      console.log(`⚡ Quick-adding ${accountType} account @${username} on ${platform} (background sync, max ${maxVideos} videos)`);
      
      // Add to Firestore immediately with minimal data
      const accountData: any = {
        username,
        platform,
        accountType,
        displayName: username,
        isActive: true,
        maxVideos: maxVideos,
        creatorType: 'automatic'
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
   * Add account with IMMEDIATE sync (blocks until profile is fetched)
   * Use this only when you need immediate profile data
   */
  static async addAccountImmediate(
    orgId: string,
    projectId: string,
    userId: string,
    username: string,
    platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter',
    accountType: 'my' | 'competitor' = 'my',
    maxVideos: number = 100
  ): Promise<string> {
    try {
      console.log(`🚀 Adding ${accountType} account @${username} on ${platform} with IMMEDIATE profile fetch (max ${maxVideos} videos)`);
      
      // Fetch profile immediately
      const profile = await ProfileFetcher.fetchProfile(orgId, username, platform);
      
      const accountData: any = {
        username,
        platform,
        accountType,
        displayName: profile.displayName,
        profilePicture: profile.profilePicture,
        followerCount: profile.followerCount,
        followingCount: profile.followingCount,
        postCount: profile.postCount,
        bio: profile.bio,
        isVerified: profile.isVerified,
        isActive: true,
        maxVideos: maxVideos,
        creatorType: 'automatic',
        ...(platform === 'youtube' && profile.channelId && { youtubeChannelId: profile.channelId })
      };
      
      const accountId = await FirestoreDataService.addTrackedAccount(orgId, projectId, userId, accountData);

      console.log(`✅ Added account @${username} with profile data (ID: ${accountId})`);
      console.log(`⏳ Videos will be synced in the background.`);
      
      return accountId;
    } catch (error) {
      console.error('❌ Failed to add account:', error);
      throw error;
    }
  }

  /**
   * Sync account videos
   * Delegates to SyncManager which coordinates all sync operations
   * 
   * @returns Number of videos processed
   */
  static async syncAccountVideos(
    orgId: string,
    projectId: string,
    userId: string,
    accountId: string
  ): Promise<number> {
    return SyncManager.syncAccountVideos(orgId, projectId, userId, accountId);
  }

  /**
   * Get videos for a specific account
   */
  static async getAccountVideos(
    orgId: string,
    projectId: string,
    accountId: string
  ): Promise<AccountVideo[]> {
      const videos = await FirestoreDataService.getAccountVideos(orgId, projectId, accountId);
    // Convert VideoDoc to AccountVideo format
    return videos.map(v => ({
          id: v.id,
      accountId: v.trackedAccountId || accountId,
      videoId: v.videoId,
          url: v.videoUrl || v.url || '',
          thumbnail: v.thumbnail || '',
      caption: v.caption || '',
      uploadDate: v.uploadDate?.toDate ? v.uploadDate.toDate() : (v.uploadDate as any),
          views: v.views || 0,
          likes: v.likes || 0,
          comments: v.comments || 0,
          shares: v.shares || 0,
      saves: v.saves || 0,
          duration: v.duration || 0,
          isSponsored: false,
          hashtags: v.hashtags || [],
      mentions: [],
      platform: v.platform as 'instagram' | 'tiktok' | 'youtube' | 'twitter'
    }));
  }

  /**
   * Remove account and all its data (calls immediate deletion API)
   */
  static async removeAccount(
    orgId: string,
    projectId: string,
    accountId: string,
    username?: string,
    platform?: string
  ): Promise<void> {
    console.log(`🗑️ Deleting account ${accountId} (${username || 'unknown'} on ${platform || 'unknown'})...`);
    
    try {
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
        const errorText = await response.text();
        let errorMessage = 'Failed to delete account';
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log(`✅ Successfully deleted account ${accountId}:`, result);
    } catch (error) {
      console.error('❌ Error deleting account:', error);
      throw error;
    }
  }

  /**
   * Refresh account profile data
   */
  static async refreshAccountProfile(
    orgId: string,
    projectId: string,
    _userId: string,
    accountId: string
  ): Promise<void> {
    try {
      const account = await FirestoreDataService.getTrackedAccount(orgId, projectId, accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      console.log(`🔄 Refreshing profile for @${account.username} on ${account.platform}...`);
      
      const profile = await ProfileFetcher.fetchProfile(
        orgId,
        account.username,
        account.platform as 'instagram' | 'tiktok' | 'youtube' | 'twitter'
      );
      
      await FirestoreDataService.updateTrackedAccount(orgId, projectId, accountId, {
        displayName: profile.displayName,
        profilePicture: profile.profilePicture,
        followerCount: profile.followerCount,
        followingCount: profile.followingCount,
        postCount: profile.postCount,
        bio: profile.bio,
        isVerified: profile.isVerified,
        ...(account.platform === 'youtube' && profile.channelId && { youtubeChannelId: profile.channelId })
      });

      console.log(`✅ Profile refreshed for @${account.username}`);
    } catch (error) {
      console.error('❌ Failed to refresh profile:', error);
      throw error;
    }
  }
}

