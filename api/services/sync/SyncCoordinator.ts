import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreService } from './shared/FirestoreService.js';
import { ValidationService } from './shared/ValidationService.js';
import { LockService } from './shared/LockService.js';
import { InstagramSyncService } from './instagram/InstagramSyncService.js';
import { TikTokSyncService } from './tiktok/TikTokSyncService.js';
import { YoutubeSyncService } from './youtube/YoutubeSyncService.js';
import { TwitterSyncService } from './twitter/TwitterSyncService.js';

/**
 * SyncCoordinator
 * 
 * Purpose: Orchestrate account sync operations across all platforms
 * Responsibilities:
 * - Coordinate discovery and refresh phases
 * - Manage locking to prevent concurrent syncs
 * - Route to platform-specific services
 * - Apply date filtering
 * - Save videos and create snapshots
 * - Handle errors and cleanup
 */
export class SyncCoordinator {
  /**
   * Main sync orchestrator for a single account
   * 
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param accountId - Account ID to sync
   * @param options - Sync options
   * @returns Stats about the sync operation
   */
  static async syncAccount(
    orgId: string,
    projectId: string,
    accountId: string,
    options: {
      syncStrategy?: 'progressive' | 'refresh_only' | 'discovery_only';
      capturedBy?: 'manual_refresh' | 'scheduled_refresh' | 'initial_add';
      isManualSync?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    videosAdded: number;
    videosUpdated: number;
    snapshotsCreated: number;
    error?: string;
  }> {
    const {
      syncStrategy = 'progressive',
      capturedBy = 'scheduled_refresh',
      isManualSync = false
    } = options;
    
    console.log(`\n🎯 [SYNC-COORDINATOR] Starting sync for account ${accountId}`);
    console.log(`   📋 Strategy: ${syncStrategy}, Manual: ${isManualSync}`);
    
    let lockId: string | null = null;
    let videosAdded = 0;
    let videosUpdated = 0;
    let snapshotsCreated = 0;
    
    try {
      // Step 1: Fetch account
      const accountResult = await FirestoreService.getTrackedAccount(orgId, projectId, accountId);
      
      if (!accountResult) {
        throw new Error(`Account ${accountId} not found`);
      }
      
      const { ref: accountRef, data: accountData } = accountResult;
      
      // Validate account data
      const accountValidation = ValidationService.validateAccountData({
        id: accountId,
        ...accountData
      });
      
      if (!accountValidation.valid) {
        throw new Error(`Invalid account data: ${accountValidation.errors.join(', ')}`);
      }
      
      const platform = accountData.platform as 'instagram' | 'tiktok' | 'youtube' | 'twitter';
      const username = accountData.username;
      const creatorType = accountData.creatorType || 'automatic';
      
      console.log(`   📱 Platform: ${platform}, Username: @${username}, Type: ${creatorType}`);
      
      // Step 2: Acquire lock and set syncStatus
      lockId = LockService.generateLockId();
      const lockResult = await LockService.acquireLock(accountRef, lockId);
      
      if (!lockResult.acquired) {
        console.log(`   ⏭️  ${lockResult.reason} (age: ${lockResult.lockAge}s) - skipping`);
        return {
          success: true,
          videosAdded: 0,
          videosUpdated: 0,
          snapshotsCreated: 0,
          error: lockResult.reason
        };
      }
      
      console.log(`   🔒 Lock acquired: ${lockId}`);
      
      // Set syncStatus to 'syncing' for frontend UI
      await FirestoreService.updateTrackedAccount(accountRef, {
        syncStatus: 'syncing',
        lastSyncedAt: Timestamp.now()
      });
      
      // Step 3: Get existing videos
      const existingVideos = await FirestoreService.getExistingVideos(orgId, projectId, accountId);
      console.log(`   📊 Found ${existingVideos.size} existing videos`);
      
      // Step 4: Route to platform-specific sync
      let discoveredVideos: any[] = [];
      let refreshedVideos: any[] = [];
      
      const account = {
        username,
        id: accountId,
        youtubeChannelId: accountData.youtubeChannelId
      };
      
      // Run discovery first (if not refresh_only and account is automatic)
      if (syncStrategy !== 'refresh_only' && creatorType === 'automatic') {
        console.log(`\n🔍 [DISCOVERY PHASE] Starting...`);
        discoveredVideos = await this.runDiscovery(platform, account, orgId, existingVideos);
        console.log(`   ✅ Discovery complete: ${discoveredVideos.length} new videos`);
        
        // If YouTube channelId was fetched during discovery, save it to Firestore
        if (platform === 'youtube' && account.youtubeChannelId && !accountData.youtubeChannelId) {
          console.log(`   💾 [YOUTUBE] Saving discovered channelId: ${account.youtubeChannelId}`);
          await FirestoreService.updateTrackedAccount(accountRef, {
            youtubeChannelId: account.youtubeChannelId
          });
        }
      } else {
        console.log(`   ⏭️  Skipping discovery (${syncStrategy === 'refresh_only' ? 'refresh_only mode' : 'static account'})`);
      }
      
      // Then run refresh (if not discovery_only and we have existing videos)
      if (syncStrategy !== 'discovery_only' && existingVideos.size > 0) {
        console.log(`\n🔄 [REFRESH PHASE] Starting...`);
        const existingVideoIds = Array.from(existingVideos.keys());
        refreshedVideos = await this.runRefresh(platform, account, orgId, existingVideoIds);
        console.log(`   ✅ Refresh complete: ${refreshedVideos.length} videos updated`);
      } else {
        console.log(`   ⏭️  Skipping refresh (${syncStrategy === 'discovery_only' ? 'discovery_only mode' : 'no existing videos'})`);
      }
      
      // Step 5: Apply date filtering to discovered videos
      if (discoveredVideos.length > 0 && existingVideos.size > 0) {
        const existingVideosList = Array.from(existingVideos.values());
        const oldestDate = ValidationService.findOldestUploadDate(existingVideosList);
        
        if (oldestDate) {
          console.log(`\n🗓️  [DATE FILTER] Oldest existing video: ${oldestDate.toISOString().split('T')[0]}`);
          
          const filteredVideos = discoveredVideos.filter(video => {
            const shouldSkip = ValidationService.shouldSkipVideoByDate(video.uploadDate, oldestDate);
            if (shouldSkip) {
              const videoDate = video.uploadDate instanceof Timestamp 
                ? video.uploadDate.toDate() 
                : video.uploadDate;
              console.log(`   ⏭️  Skipping ${video.videoId} (${videoDate.toISOString().split('T')[0]} < ${oldestDate.toISOString().split('T')[0]})`);
            }
            return !shouldSkip;
          });
          
          console.log(`   📊 After date filter: ${filteredVideos.length}/${discoveredVideos.length} videos`);
          discoveredVideos = filteredVideos;
        }
      }
      
      // Step 6: Save discovered videos
      for (const video of discoveredVideos) {
        const result = await FirestoreService.saveVideo(
          orgId,
          projectId,
          accountId,
          video,
          isManualSync ? 'user' : 'system'
        );
        
        if (result.isNew) {
          videosAdded++;
          // Create initial snapshot for new videos
          const snapshotCreated = await FirestoreService.createSnapshot(
            result.ref,
            {
              views: video.views,
              likes: video.likes,
              comments: video.comments,
              shares: video.shares,
              saves: video.saves
            },
            capturedBy
          );
          if (snapshotCreated) snapshotsCreated++;
        }
      }
      
      // Step 7: Save refreshed videos and create snapshots
      for (const video of refreshedVideos) {
        const result = await FirestoreService.saveVideo(
          orgId,
          projectId,
          accountId,
          video,
          'system'
        );
        
        if (!result.isNew) {
          videosUpdated++;
          // Create snapshot for refreshed videos
          const snapshotCreated = await FirestoreService.createSnapshot(
            result.ref,
            {
              views: video.views,
              likes: video.likes,
              comments: video.comments,
              shares: video.shares,
              saves: video.saves
            },
            capturedBy
          );
          if (snapshotCreated) snapshotsCreated++;
        }
      }
      
      // Step 8: Update account lastSynced and clear syncStatus
      await FirestoreService.updateTrackedAccount(accountRef, {
        lastSynced: Timestamp.now(),
        syncStatus: 'completed', // Clear syncing status for frontend UI
        lastSyncError: null, // Clear any previous errors
        syncRetryCount: 0 // Reset retry count
      });
      
      // Step 9: Release lock
      if (lockId) {
        await LockService.releaseLock(accountRef, lockId);
        console.log(`   🔓 Lock released: ${lockId}`);
      }
      
      console.log(`\n✅ [SYNC-COORDINATOR] Complete: +${videosAdded} new, ~${videosUpdated} updated, 📸${snapshotsCreated} snapshots`);
      
      return {
        success: true,
        videosAdded,
        videosUpdated,
        snapshotsCreated
      };
      
    } catch (error: any) {
      console.error(`❌ [SYNC-COORDINATOR] Error:`, error.message);
      
      // Release lock and update syncStatus on error
      if (lockId) {
        try {
          const accountResult = await FirestoreService.getTrackedAccount(orgId, projectId, accountId);
          if (accountResult) {
            // Update syncStatus to 'error' so UI shows error state
            await FirestoreService.updateTrackedAccount(accountResult.ref, {
              syncStatus: 'error',
              lastSyncError: error.message,
              syncRetryCount: (accountResult.data.syncRetryCount || 0) + 1
            });
            
            await LockService.releaseLock(accountResult.ref, lockId);
            console.log(`   🔓 Lock released on error: ${lockId}`);
          }
        } catch (cleanupError: any) {
          console.error(`   ⚠️  Failed to release lock on error:`, cleanupError.message);
        }
      }
      
      return {
        success: false,
        videosAdded,
        videosUpdated,
        snapshotsCreated,
        error: error.message
      };
    }
  }
  
  /**
   * Run discovery phase for a platform
   */
  private static async runDiscovery(
    platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter',
    account: any,
    orgId: string,
    existingVideos: Map<string, any>
  ): Promise<any[]> {
    switch (platform) {
      case 'instagram':
        return InstagramSyncService.discovery(account, orgId, existingVideos);
      case 'tiktok':
        return TikTokSyncService.discovery(account, orgId, existingVideos);
      case 'youtube':
        return YoutubeSyncService.discovery(account, orgId, existingVideos);
      case 'twitter':
        return TwitterSyncService.discovery(account, orgId, existingVideos);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
  
  /**
   * Run refresh phase for a platform
   */
  private static async runRefresh(
    platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter',
    account: any,
    orgId: string,
    existingVideoIds: string[]
  ): Promise<any[]> {
    switch (platform) {
      case 'instagram':
        return InstagramSyncService.refresh(account, orgId, existingVideoIds);
      case 'tiktok':
        return TikTokSyncService.refresh(account, orgId, existingVideoIds);
      case 'youtube':
        return YoutubeSyncService.refresh(account, orgId, existingVideoIds);
      case 'twitter':
        return TwitterSyncService.refresh(account, orgId, existingVideoIds);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
}

