import { TrackedAccount, AccountVideo } from '../../types/accounts';
import FirestoreDataService from '../FirestoreDataService';
import { InstagramSyncService } from './instagram/InstagramSyncService';
import { TikTokSyncService } from './tiktok/TikTokSyncService';
import { YoutubeSyncService } from './youtube/YoutubeSyncService';
import { TwitterSyncService } from './twitter/TwitterSyncService';
import { DateFilterService } from './shared/DateFilterService';
import { AccountAnalyticsService } from '../AccountAnalyticsService';
import { Timestamp } from 'firebase/firestore';

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
    const existingVideosRaw = await FirestoreDataService.getAccountVideos(orgId, projectId, accountId);
    const existingVideoIds = new Set(existingVideosRaw.map(v => v.videoId));
    
    // Convert VideoDoc uploadDate (Timestamp) to Date for filtering
    const existingVideos = existingVideosRaw.map(v => ({
      ...v,
      uploadDate: v.uploadDate?.toDate ? v.uploadDate.toDate() : (v.uploadDate as any)
    }));
    
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
    
    // Update account stats (aggregation + outliers + lastSynced)
    await AccountAnalyticsService.updateAccountStats(orgId, projectId, accountId, account.username);
    
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
    
    // 1. Save new videos (Batch operation with limit checking)
    if (result.newVideos.length > 0) {
      try {
        await FirestoreDataService.syncAccountVideos(
          orgId,
          projectId,
          account.id,
          userId,
          result.newVideos.map(v => ({
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
          account.platform
        );
        savedCount += result.newVideos.length;
      } catch (error) {
        console.error(`❌ Failed to batch save new videos:`, error);
      }
    }
    
    // 2. Update existing videos by creating snapshots
    for (const video of result.updatedVideos) {
      try {
        // Create a snapshot for the updated metrics
        if (video.id) {
            await FirestoreDataService.addVideoSnapshot(orgId, projectId, video.id, userId, {
              views: video.views || 0,
              likes: video.likes || 0,
              comments: video.comments || 0,
              shares: video.shares || 0
            });
            savedCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to update video ${video.videoId}:`, error);
      }
    }
    
    return savedCount;
  }
}

