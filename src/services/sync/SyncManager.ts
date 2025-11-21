import { SyncCoordinator } from './SyncCoordinator';
import { ProfileFetcher } from './shared/ProfileFetcher';

/**
 * SyncManager
 * 
 * Purpose: Main entry point for all sync operations
 * Responsibilities:
 * - Provide public API for video syncing
 * - Delegate to SyncCoordinator for actual sync operations
 * - Handle profile fetching
 * - Maintain clean separation between public API and internal logic
 */
export class SyncManager {
  
  /**
   * Sync videos for a tracked account
   * @returns Number of videos processed
   */
  static async syncAccountVideos(
    orgId: string,
    projectId: string,
    userId: string,
    accountId: string
  ): Promise<number> {
    return SyncCoordinator.syncAccount(orgId, projectId, userId, accountId);
  }
  
  /**
   * Fetch profile data for a social media account
   */
  static async fetchProfile(
    orgId: string,
    username: string,
    platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter'
  ) {
    return ProfileFetcher.fetchProfile(orgId, username, platform);
  }
}

