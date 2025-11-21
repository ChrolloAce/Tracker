import { TrackedAccount, AccountVideo } from '../../../types/accounts';
import YoutubeAccountService from '../../YoutubeAccountService';
import FirestoreDataService from '../../FirestoreDataService';
import { YoutubeDiscoveryService } from './YoutubeDiscoveryService';
import { YoutubeRefreshService } from './YoutubeRefreshService';

/**
 * YoutubeSyncService
 * 
 * Purpose: Orchestrate YouTube video sync operations
 * Responsibilities:
 * - Resolve and store YouTube channel ID
 * - Coordinate discovery and refresh operations
 * - Execute two-call sync architecture (discover → refresh)
 * - Return structured results
 */
export class YoutubeSyncService {
  
  /**
   * Sync YouTube videos using two-call architecture
   * CALL 1: Discover new videos (max 10)
   * CALL 2: Refresh existing videos (batch)
   */
  static async syncVideos(
    orgId: string,
    projectId: string,
    account: TrackedAccount,
    existingVideoIds: Set<string>,
    oldestVideoDate: Date | null = null
  ): Promise<{ newVideos: AccountVideo[], updatedVideos: AccountVideo[] }> {
    const isNewAccount = existingVideoIds.size === 0;
    console.log(`🎯 [YouTube] Starting ${isNewAccount ? 'FULL' : 'TWO-CALL'} sync for @${account.username}...`);
    
    try {
      const newVideos: AccountVideo[] = [];
      const updatedVideos: AccountVideo[] = [];

      // Get channel ID - use stored ID to avoid wrong channel lookups!
      let channelId = account.youtubeChannelId;
      if (!channelId) {
        console.log(`⚠️ No stored channel ID, fetching from YouTube API for: ${account.username}`);
        const profile = await YoutubeAccountService.fetchChannelProfile(account.username);
        if (!profile.channelId) {
          throw new Error('Could not resolve YouTube channel ID');
        }
        
        // Verify the fetched channel matches the expected username
        const normalizedUsername = account.username.toLowerCase().replace('@', '');
        const normalizedChannelName = profile.displayName.toLowerCase().replace('@', '');
        
        const isMatch = normalizedChannelName.includes(normalizedUsername) || 
                       normalizedUsername.includes(normalizedChannelName.split(' ')[0]) ||
                       normalizedUsername.split(/[_\-]/)[0].includes(normalizedChannelName.split(' ')[0]);
        
        if (!isMatch) {
          console.warn(`⚠️ WARNING: Fetched channel "${profile.displayName}" doesn't match username "${account.username}"`);
          console.warn(`⚠️ Possible fuzzy search mismatch - using channel ID but please verify manually!`);
        }
        
        channelId = profile.channelId;
        
        // Save it for future syncs
        await FirestoreDataService.updateTrackedAccount(orgId, projectId, account.id, {
          youtubeChannelId: channelId
        });
        console.log(`✅ Saved YouTube channel ID: ${channelId} for @${account.username}`);
      } else {
        console.log(`✅ Using stored YouTube channel ID: ${channelId} for @${account.username}`);
      }

      // CALL 1: Discover new videos FIRST
      console.log(`🔍 [YouTube] [CALL 1] Discovering new Shorts (max 10)...`);
      const discovered = await YoutubeDiscoveryService.discoverNewVideos(
        orgId,
        channelId,
        account,
        existingVideoIds,
        oldestVideoDate
      );
      newVideos.push(...discovered);
      console.log(`✅ [YouTube] [CALL 1] Found ${discovered.length} new videos`);

      // CALL 2: Batch refresh existing videos
      if (!isNewAccount && existingVideoIds.size > 0) {
        console.log(`🔄 [YouTube] [CALL 2] Batch refreshing ${existingVideoIds.size} existing videos...`);
        const refreshed = await YoutubeRefreshService.batchRefreshVideos(orgId, projectId, account);
        updatedVideos.push(...refreshed);
        console.log(`✅ [YouTube] [CALL 2] Refreshed ${refreshed.length} existing videos`);
      }

      console.log(`📊 [YouTube] Sync complete: ${newVideos.length} new, ${updatedVideos.length} refreshed`);
      return { newVideos, updatedVideos };
    } catch (error) {
      console.error('❌ [YouTube] Failed to sync:', error);
      throw error;
    }
  }
}

