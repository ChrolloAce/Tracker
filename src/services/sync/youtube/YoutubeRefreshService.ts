import { TrackedAccount, AccountVideo } from '../../../types/accounts';
import FirestoreDataService from '../../FirestoreDataService';

/**
 * YoutubeRefreshService
 * 
 * Purpose: Refresh existing YouTube videos with latest metrics
 * Responsibilities:
 * - Batch refresh using YouTube Data API (up to 50 IDs per call)
 * - Update views, likes, comments for existing videos
 * - Handle API responses and errors gracefully
 */
export class YoutubeRefreshService {
  
  /**
   * Batch refresh existing YouTube videos using YouTube Data API
   * Supports up to 50 video IDs per API call
   */
  static async batchRefreshVideos(
    orgId: string,
    projectId: string,
    account: TrackedAccount
  ): Promise<AccountVideo[]> {
    const existingVideos = await FirestoreDataService.getAccountVideos(orgId, projectId, account.id);
    if (existingVideos.length === 0) return [];

    const videoIds = existingVideos.map(v => v.videoId).filter(id => id);
    if (videoIds.length === 0) return [];

    console.log(`📦 [YouTube] Refreshing ${videoIds.length} videos using official API...`);

    const refreshed: AccountVideo[] = [];
    
    // YouTube Data API supports up to 50 IDs in one call
    for (let i = 0; i < videoIds.length; i += 50) {
      const batchIds = videoIds.slice(i, i + 50);
      
      try {
        const response = await fetch(`${window.location.origin}/api/youtube-channel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'batchGetVideos',
            videoIds: batchIds
          })
        });

        if (!response.ok) continue;

        const { videos } = await response.json();
        
        for (const video of videos) {
          refreshed.push({
            id: `${account.id}_${video.id}`,
            accountId: account.id,
            videoId: video.id,
            url: `https://www.youtube.com/shorts/${video.id}`,
            thumbnail: '', // Keep existing thumbnail
            caption: video.snippet?.title || '',
            uploadDate: new Date(video.snippet?.publishedAt || Date.now()),
            views: Number(video.statistics?.viewCount || 0),
            likes: Number(video.statistics?.likeCount || 0),
            comments: Number(video.statistics?.commentCount || 0),
            shares: 0,
            duration: 0,
            isSponsored: false,
            hashtags: [],
            mentions: []
          });
        }
      } catch (error) {
        console.warn(`⚠️ [YouTube] Failed to refresh batch of videos:`, error);
      }
    }

    return refreshed;
  }
}

