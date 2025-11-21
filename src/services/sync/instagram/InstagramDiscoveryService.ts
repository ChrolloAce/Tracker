import { TrackedAccount, AccountVideo } from '../../../types/accounts';
import FirebaseStorageService from '../../FirebaseStorageService';
import { DateFilterService } from '../shared/DateFilterService';

/**
 * InstagramDiscoveryService
 * 
 * Purpose: Discover new Instagram videos
 * Responsibilities:
 * - Fetch latest videos from Instagram
 * - Filter out existing videos
 * - Apply date-based filtering
 * - Upload thumbnails to Firebase Storage
 */
export class InstagramDiscoveryService {
  
  /**
   * Discover new Instagram videos (max 10)
   * Stops at first duplicate or video older than oldestVideoDate
   */
  static async discoverNewVideos(
    orgId: string,
    account: TrackedAccount,
    existingVideoIds: Set<string>,
    oldestVideoDate: Date | null = null
  ): Promise<AccountVideo[]> {
    const maxReels = 10;
    
    console.log(`🔍 [Instagram] Fetching up to ${maxReels} latest videos for discovery...`);
    
    const proxyUrl = `${window.location.origin}/api/apify-proxy`;
    const sessionId = import.meta.env.VITE_INSTAGRAM_SESSION_ID || '';
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorId: 'scraper-engine~instagram-reels-scraper',
        input: {
          urls: [`https://www.instagram.com/${account.username}/`],
          sortOrder: "newest",
          maxComments: 10,
          maxReels: maxReels,
          ...(sessionId && {
            sessionCookie: sessionId,
            additionalCookies: [{
              name: 'sessionid',
              value: sessionId,
              domain: '.instagram.com'
            }]
          }),
          proxyConfiguration: {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL'],
            apifyProxyCountry: 'US'
          },
          maxRequestRetries: 5,
          requestHandlerTimeoutSecs: 300,
          maxConcurrency: 1
        },
        action: 'run'
      }),
    });

    if (!response.ok) {
      console.warn(`⚠️ [Instagram] Discovery failed: ${response.status}`);
      return [];
    }

    const result = await response.json();
    if (!result.items || !Array.isArray(result.items)) return [];
    
    console.log(`📦 [Instagram] Discovery returned ${result.items.length} items`);
    
    const newVideos: AccountVideo[] = [];
    
    for (const item of result.items) {
      const media = item.reel_data?.media || item.media || item;
      const isVideo = !!(media.play_count || media.ig_play_count || media.video_duration);
      
      if (!isVideo) continue;
      
      const videoCode = media.code || media.shortCode || media.id;
      if (!videoCode) continue;
      
      // SKIP if already exists
      if (existingVideoIds.has(videoCode)) {
        console.log(`   ⏭️  Skipping existing video: ${videoCode}`);
        continue;
      }
      
      // SKIP if older than our oldest video
      const videoUploadDate = media.taken_at ? new Date(media.taken_at * 1000) : null;
      if (DateFilterService.shouldSkipVideo(videoUploadDate, oldestVideoDate)) {
        console.log(`   ⏭️  Skipping old video: ${videoCode}`);
        continue;
      }
      
      // Upload thumbnail
      const thumbnailUrl = media.image_versions2?.candidates?.[0]?.url || 
                           media.display_uri || 
                           media.displayUrl || '';
      
      let uploadedThumbnail = thumbnailUrl;
      if (thumbnailUrl) {
        try {
          uploadedThumbnail = await FirebaseStorageService.downloadAndUpload(
            orgId,
            thumbnailUrl,
            `ig_${videoCode}`,
            'thumbnail'
          );
        } catch (error) {
          console.warn(`⚠️ Failed to upload thumbnail, using CDN URL`);
        }
      }
      
      const videoData: AccountVideo = {
        id: `${account.id}_${videoCode}`,
        accountId: account.id,
        videoId: videoCode,
        url: `https://www.instagram.com/reel/${videoCode}/`,
        thumbnail: uploadedThumbnail,
        caption: media.caption?.text || '',
        uploadDate: videoUploadDate || new Date(),
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
      
      newVideos.push(videoData);
      console.log(`   ✨ NEW video: ${videoCode}`);
    }
    
    return newVideos;
  }
}

