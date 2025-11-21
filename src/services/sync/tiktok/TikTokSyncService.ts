import { TrackedAccount, AccountVideo } from '../../../types/accounts';
import { TikTokDiscoveryService } from './TikTokDiscoveryService';
import { TikTokRefreshService } from './TikTokRefreshService';

/**
 * TikTokSyncService
 * 
 * Purpose: Orchestrate TikTok video sync operations
 * Responsibilities:
 * - Coordinate discovery and refresh operations
 * - Execute two-call sync architecture (discover → refresh)
 * - Return structured results
 */
export class TikTokSyncService {
  
  /**
   * Sync TikTok videos using two-call architecture
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
    console.log(`🎯 [TikTok] Starting ${isNewAccount ? 'FULL' : 'TWO-CALL'} sync for @${account.username}...`);
    
    const newVideos: AccountVideo[] = [];
    const updatedVideos: AccountVideo[] = [];

    // CALL 1: Discover new videos FIRST
    console.log(`🔍 [TikTok] [CALL 1] Discovering new videos (max 10)...`);
    const discovered = await TikTokDiscoveryService.discoverNewVideos(
      orgId,
      account,
      existingVideoIds,
      oldestVideoDate
    );
    newVideos.push(...discovered);
    console.log(`✅ [TikTok] [CALL 1] Found ${discovered.length} new videos`);

    // CALL 2: Batch refresh existing videos
    if (!isNewAccount && existingVideoIds.size > 0) {
      console.log(`🔄 [TikTok] [CALL 2] Batch refreshing ${existingVideoIds.size} existing videos...`);
      const refreshed = await TikTokRefreshService.batchRefreshVideos(orgId, projectId, account);
      updatedVideos.push(...refreshed);
      console.log(`✅ [TikTok] [CALL 2] Refreshed ${refreshed.length} existing videos`);
    }

    console.log(`📊 [TikTok] Sync complete: ${newVideos.length} new, ${updatedVideos.length} refreshed`);
    return { newVideos, updatedVideos };
  }
}

