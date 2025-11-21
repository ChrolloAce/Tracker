import { TrackedAccount, AccountVideo } from '../../../types/accounts';
import FirebaseStorageService from '../../FirebaseStorageService';
import { DateFilterService } from '../shared/DateFilterService';

/**
 * TikTokDiscoveryService
 * 
 * Purpose: Discover new TikTok videos
 * Responsibilities:
 * - Fetch latest videos from TikTok
 * - Filter out existing videos
 * - Apply date-based filtering
 * - Upload thumbnails to Firebase Storage
 */
export class TikTokDiscoveryService {
  
  /**
   * Discover new TikTok videos (max 10)
   * Stops at first duplicate or video older than oldestVideoDate
   */
  static async discoverNewVideos(
    orgId: string,
    account: TrackedAccount,
    existingVideoIds: Set<string>,
    oldestVideoDate: Date | null = null
  ): Promise<AccountVideo[]> {
    const maxVideos = 10;
    
    console.log(`🔍 [TikTok] Fetching up to ${maxVideos} latest videos for discovery...`);
    
    const proxyUrl = `${window.location.origin}/api/apify-proxy`;
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorId: 'clockworks~tiktok-scraper',
        input: {
          profiles: [account.username],
          resultsPerPage: maxVideos,
          shouldDownloadCovers: false,
          shouldDownloadVideos: false,
          shouldDownloadSubtitles: false
        },
        action: 'run'
      }),
    });

    if (!response.ok) {
      console.warn(`⚠️ [TikTok] Discovery failed: ${response.status}`);
      return [];
    }

    const result = await response.json();
    if (!result.items || !Array.isArray(result.items)) return [];

    console.log(`📦 [TikTok] Discovery returned ${result.items.length} videos`);

    const newVideos: AccountVideo[] = [];

    for (const item of result.items) {
      if (!item.webVideoUrl && !item.id) continue;

      const videoId = item.id || item.videoId || '';
      
      // SKIP if already exists
      if (existingVideoIds.has(videoId)) {
        console.log(`   ⏭️  Skipping existing video: ${videoId}`);
        continue;
      }

      // SKIP if older than our oldest video
      const videoUploadDate = new Date(item.createTimeISO || item.createTime || Date.now());
      if (DateFilterService.shouldSkipVideo(videoUploadDate, oldestVideoDate)) {
        console.log(`   ⏭️  Skipping old video: ${videoId}`);
        continue;
      }

      // Upload thumbnail
      const thumbnailUrl = item['videoMeta.coverUrl'] || 
                          item.videoMeta?.coverUrl || 
                          item.covers?.default || 
                          item.coverUrl || 
                          item.thumbnail || 
                          item.cover || 
                          '';
      
      let uploadedThumbnail = thumbnailUrl;
      if (thumbnailUrl) {
        try {
          uploadedThumbnail = await FirebaseStorageService.downloadAndUpload(
            orgId,
            thumbnailUrl,
            `tt_${videoId}_thumb`,
            'thumbnail'
          );
        } catch (error) {
          console.warn(`⚠️ Failed to upload thumbnail, using original URL`);
        }
      }
      
      const video: AccountVideo = {
        id: `${account.id}_${videoId}`,
        accountId: account.id,
        videoId: videoId,
        url: item.webVideoUrl || `https://www.tiktok.com/@${account.username}/video/${videoId}`,
        thumbnail: uploadedThumbnail,
        caption: item.text || item.description || '',
        uploadDate: videoUploadDate,
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
      
      newVideos.push(video);
      console.log(`   ✨ NEW video: ${videoId}`);
    }

    return newVideos;
  }
}

