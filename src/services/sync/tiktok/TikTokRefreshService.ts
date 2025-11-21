import { TrackedAccount, AccountVideo } from '../../../types/accounts';
import FirestoreDataService from '../../FirestoreDataService';

/**
 * TikTokRefreshService
 * 
 * Purpose: Refresh existing TikTok videos with latest metrics
 * Responsibilities:
 * - Batch refresh existing videos using postURLs
 * - Update views, likes, comments for existing videos
 * - Handle API responses and errors gracefully
 */
export class TikTokRefreshService {
  
  /**
   * Batch refresh existing TikTok videos using postURLs
   */
  static async batchRefreshVideos(
    orgId: string,
    projectId: string,
    account: TrackedAccount
  ): Promise<AccountVideo[]> {
    const existingVideos = await FirestoreDataService.getAccountVideos(orgId, projectId, account.id);
    if (existingVideos.length === 0) return [];

    // Build array of post URLs for batch refresh
    const postURLs = existingVideos
      .map(v => v.url)
      .filter(url => url);

    if (postURLs.length === 0) return [];

    console.log(`📦 [TikTok] Refreshing ${postURLs.length} existing videos in ONE API call...`);

    const proxyUrl = `${window.location.origin}/api/apify-proxy`;

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorId: 'clockworks~tiktok-scraper',
        input: {
          postURLs: postURLs,
          shouldDownloadCovers: false,
          shouldDownloadVideos: false,
          shouldDownloadSubtitles: false
        },
        action: 'run'
      }),
    });

    if (!response.ok) {
      console.warn(`⚠️ [TikTok] Batch refresh failed: ${response.status}`);
      return [];
    }

    const result = await response.json();
    if (!result.items || !Array.isArray(result.items)) return [];

    console.log(`📦 [TikTok] Batch refresh returned ${result.items.length} videos`);

    // Process refreshed videos
    const refreshed: AccountVideo[] = [];
    for (const item of result.items) {
      if (!item.webVideoUrl && !item.id) continue;

      const videoId = item.id || item.videoId || '';
      
      const video: AccountVideo = {
        id: `${account.id}_${videoId}`,
        accountId: account.id,
        videoId: videoId,
        url: item.webVideoUrl || `https://www.tiktok.com/@${account.username}/video/${videoId}`,
        thumbnail: '', // Keep existing thumbnail
        caption: item.text || item.description || '',
        uploadDate: new Date(item.createTimeISO || item.createTime || Date.now()),
        views: item.playCount || 0,
        likes: item.diggCount || 0,
        comments: item.commentCount || 0,
        shares: item.shareCount || 0,
        saves: item.collectCount || 0,
        duration: item['videoMeta.duration'] || item.videoMeta?.duration || 0,
        isSponsored: false,
        hashtags: item.hashtags || [],
        mentions: item.mentions || [],
        platform: 'tiktok'
      };
      
      refreshed.push(video);
    }

    return refreshed;
  }
}

