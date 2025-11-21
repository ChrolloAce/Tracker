import { TrackedAccount, AccountVideo } from '../../../types/accounts';
import { TwitterDiscoveryService } from './TwitterDiscoveryService';

/**
 * TwitterSyncService
 * 
 * Purpose: Orchestrate Twitter sync operations
 * Responsibilities:
 * - Coordinate tweet fetching and processing
 * - Return structured results (new vs updated)
 * 
 * Note: Twitter doesn't separate discovery/refresh into two calls
 * It fetches latest tweets and updates everything in one call
 */
export class TwitterSyncService {
  
  /**
   * Sync Twitter tweets
   * Fetches latest tweets and separates new vs existing
   */
  static async syncTweets(
    orgId: string,
    _projectId: string,
    account: TrackedAccount,
    existingVideoIds: Set<string>,
    oldestVideoDate: Date | null = null
  ): Promise<{ newVideos: AccountVideo[], updatedVideos: AccountVideo[] }> {
    const isNewAccount = existingVideoIds.size === 0;
    console.log(`🎯 [Twitter] Starting ${isNewAccount ? 'FULL' : 'INCREMENTAL'} sync for @${account.username}...`);
    
    try {
      const maxTweets = 10;
      
      const result = await TwitterDiscoveryService.fetchAndProcessTweets(
        orgId,
        account,
        existingVideoIds,
        oldestVideoDate,
        maxTweets
      );

      console.log(`📊 [Twitter] Sync complete: ${result.newVideos.length} new tweets, ${result.updatedVideos.length} updated tweets`);
      
      return result;
    } catch (error) {
      console.error('❌ [Twitter] Failed to sync:', error);
      throw error;
    }
  }
}

