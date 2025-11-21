import { TrackedAccount, AccountVideo } from '../../../types/accounts';
import FirestoreDataService from '../../FirestoreDataService';

/**
 * InstagramRefreshService
 * 
 * Purpose: Refresh existing Instagram videos with latest metrics
 * Responsibilities:
 * - Batch refresh existing videos using post_urls
 * - Update views, likes, comments for existing videos
 * - Handle API responses and errors gracefully
 */
export class InstagramRefreshService {
  
  /**
   * Batch refresh existing Instagram videos using post_urls
   */
  static async batchRefreshVideos(
    orgId: string,
    projectId: string,
    account: TrackedAccount
  ): Promise<AccountVideo[]> {
    const existingVideos = await FirestoreDataService.getAccountVideos(orgId, projectId, account.id);
    if (existingVideos.length === 0) return [];

    // Build array of post URLs for batch refresh
    const postUrls = existingVideos
      .map(v => `https://www.instagram.com/p/${v.videoId}/`)
      .filter(url => url);

    if (postUrls.length === 0) return [];

    console.log(`📦 [Instagram] Refreshing ${postUrls.length} existing videos in ONE API call...`);

    const proxyUrl = `${window.location.origin}/api/apify-proxy`;
    const sessionId = import.meta.env.VITE_INSTAGRAM_SESSION_ID || '';

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorId: 'scraper-engine~instagram-reels-scraper',
        input: {
          post_urls: postUrls,
          target: 'reels_only',
          reels_count: postUrls.length,
          include_raw_data: true,
          ...(sessionId && {
            sessionCookie: sessionId,
            additionalCookies: [{
              name: 'sessionid',
              value: sessionId,
              domain: '.instagram.com'
            }]
          }),
          proxy: {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL'],
            apifyProxyCountry: 'US'
          },
          maxConcurrency: 1,
          maxRequestRetries: 3,
          handlePageTimeoutSecs: 120
        },
        action: 'run'
      }),
    });

    if (!response.ok) {
      console.warn(`⚠️ [Instagram] Batch refresh failed: ${response.status}`);
      return [];
    }

    const result = await response.json();
    if (!result.items || !Array.isArray(result.items)) return [];

    console.log(`📦 [Instagram] Batch refresh returned ${result.items.length} videos`);

    // Process refreshed videos
    const refreshed: AccountVideo[] = [];
    for (const item of result.items) {
      const media = item.reel_data?.media || item.media || item;
      const videoCode = media.code || media.shortCode || media.id;
      if (!videoCode) continue;

      const videoData: AccountVideo = {
        id: `${account.id}_${videoCode}`,
        accountId: account.id,
        videoId: videoCode,
        url: `https://www.instagram.com/reel/${videoCode}/`,
        thumbnail: '', // Keep existing thumbnail
        caption: media.caption?.text || '',
        uploadDate: media.taken_at ? new Date(media.taken_at * 1000) : new Date(),
        views: media.play_count || media.ig_play_count || 0,
        likes: media.like_count || 0,
        comments: media.comment_count || 0,
        shares: 0,
        duration: media.video_duration || 0,
        isSponsored: false,
        hashtags: [],
        mentions: [],
        platform: 'instagram'
      };

      refreshed.push(videoData);
    }

    return refreshed;
  }
}

