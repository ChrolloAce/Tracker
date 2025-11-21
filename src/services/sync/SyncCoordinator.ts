import { TrackedAccount, AccountVideo } from '../../types/accounts';
import FirestoreDataService from '../FirestoreDataService';
import { InstagramSyncService } from './instagram/InstagramSyncService';
import { TikTokSyncService } from './tiktok/TikTokSyncService';
import { YoutubeSyncService } from './youtube/YoutubeSyncService';
import { TwitterSyncService } from './twitter/TwitterSyncService';
import { DateFilterService } from './shared/DateFilterService';

/**
 * SyncCoordinator
 * 
 * Purpose: Coordinate sync operations across all platforms
 * Responsibilities:
 * - Orchestrate discovery → refresh flow
 * - Manage sync state and existing video tracking
 * - Calculate oldest video dates for filtering
 * - Delegate to platform-specific services
 * - Return structured sync results
 */
export class SyncCoordinator {
  
  /**
   * Sync videos for an account (any platform)
   * Coordinates discovery and refresh operations
   */
  static async syncAccount(
    orgId: string,
    projectId: string,
    userId: string,
    accountId: string
  ): Promise<number> {
    console.log(`\n🎯 [SyncCoordinator] Starting sync for account: ${accountId}`);
    
    // Get account details
    const firestoreAccount = await FirestoreDataService.getTrackedAccount(orgId, projectId, accountId);
    if (!firestoreAccount) {
      throw new Error(`Account ${accountId} not found`);
    }
    
    const account: TrackedAccount = {
      id: firestoreAccount.id,
      username: firestoreAccount.username,
      platform: firestoreAccount.platform as 'instagram' | 'tiktok' | 'youtube' | 'twitter',
      accountType: firestoreAccount.accountType as 'my' | 'competitor',
      displayName: firestoreAccount.displayName || firestoreAccount.username,
      profilePicture: firestoreAccount.profilePicture || '',
      followerCount: firestoreAccount.followerCount || 0,
      followingCount: firestoreAccount.followingCount || 0,
      postCount: firestoreAccount.totalVideos || 0,
      bio: firestoreAccount.bio || '',
      isVerified: firestoreAccount.isVerified || false,
      dateAdded: firestoreAccount.dateAdded.toDate(),
      lastSynced: firestoreAccount.lastSynced?.toDate(),
      isActive: firestoreAccount.isActive,
      totalVideos: firestoreAccount.totalVideos || 0,
      totalViews: firestoreAccount.totalViews || 0,
      totalLikes: firestoreAccount.totalLikes || 0,
      totalComments: firestoreAccount.totalComments || 0,
      totalShares: firestoreAccount.totalShares || 0,
      youtubeChannelId: firestoreAccount.youtubeChannelId
    };
    
    // Get existing videos
    const existingVideos = await FirestoreDataService.getAccountVideos(orgId, projectId, accountId);
    const existingVideoIds = new Set(existingVideos.map(v => v.videoId));
    
    // Calculate oldest video date for filtering
    const oldestVideoDate = DateFilterService.findOldestUploadDate(existingVideos);
    
    console.log(`📊 [SyncCoordinator] Account state: ${existingVideoIds.size} existing videos, oldest: ${oldestVideoDate?.toLocaleDateString() || 'N/A'}`);
    
    // Delegate to platform-specific service
    let result: { newVideos: AccountVideo[], updatedVideos: AccountVideo[] };
    
    switch (account.platform) {
      case 'instagram':
        result = await InstagramSyncService.syncVideos(orgId, projectId, account, existingVideoIds, oldestVideoDate);
        break;
      case 'tiktok':
        result = await TikTokSyncService.syncVideos(orgId, projectId, account, existingVideoIds, oldestVideoDate);
        break;
      case 'youtube':
        result = await YoutubeSyncService.syncVideos(orgId, projectId, account, existingVideoIds, oldestVideoDate);
        break;
      case 'twitter':
        result = await TwitterSyncService.syncTweets(orgId, projectId, account, existingVideoIds, oldestVideoDate);
        break;
      default:
        throw new Error(`Unsupported platform: ${account.platform}`);
    }
    
    // Save new and updated videos to Firestore
    const totalSaved = await this.saveVideoResults(orgId, projectId, userId, account, result);
    
    // Update last synced timestamp
    await FirestoreDataService.updateTrackedAccount(orgId, projectId, accountId, {
      lastSynced: new Date()
    });
    
    console.log(`✅ [SyncCoordinator] Sync complete for @${account.username}: ${totalSaved} videos processed`);
    
    return totalSaved;
  }
  
  /**
   * Save sync results to Firestore
   */
  private static async saveVideoResults(
    orgId: string,
    projectId: string,
    userId: string,
    account: TrackedAccount,
    result: { newVideos: AccountVideo[], updatedVideos: AccountVideo[] }
  ): Promise<number> {
    let savedCount = 0;
    
    // Save new videos
    for (const video of result.newVideos) {
      try {
        await FirestoreDataService.addVideo(orgId, projectId, userId, video);
        savedCount++;
      } catch (error) {
        console.error(`❌ Failed to save new video ${video.videoId}:`, error);
      }
    }
    
    // Update existing videos
    for (const video of result.updatedVideos) {
      try {
        await FirestoreDataService.updateVideo(orgId, projectId, video.id, video);
        savedCount++;
      } catch (error) {
        console.error(`❌ Failed to update video ${video.videoId}:`, error);
      }
    }
    
    return savedCount;
  }
}

