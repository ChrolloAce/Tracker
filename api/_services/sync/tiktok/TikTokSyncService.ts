import { Timestamp } from 'firebase-admin/firestore';
import { runApifyActor } from '../../../apify-client.js';
import { ImageUploadService } from '../shared/ImageUploadService.js';

/**
 * Deep-scan an object for avatar/profile picture URLs.
 */
function deepScanForAvatarUrl(obj: any, depth: number = 0, maxDepth: number = 4): string {
  if (!obj || typeof obj !== 'object' || depth > maxDepth) return '';
  const avatarKeys = [
    'avatarLarger', 'avatarMedium', 'avatar', 'avatarThumb', 'avatar_url',
    'profilePicUrl', 'profile_pic_url', 'profilePicture', 'coverMediumUrl'
  ];
  for (const key of avatarKeys) {
    const val = obj[key];
    if (typeof val === 'string' && val.startsWith('http') && (val.includes('.jpg') || val.includes('.jpeg') || val.includes('.png') || val.includes('.webp') || val.includes('tiktokcdn') || val.includes('tplv-'))) {
      return val;
    }
  }
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      const lk = key.toLowerCase();
      if ((lk.includes('avatar') || lk.includes('profilepic') || lk.includes('profile_pic')) && obj[key].startsWith('http')) {
        return obj[key];
      }
    }
  }
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      const found = deepScanForAvatarUrl(obj[key], depth + 1, maxDepth);
      if (found) return found;
    }
  }
  return '';
}

/**
 * TikTokSyncService
 * 
 * Purpose: Handle TikTok video discovery and refresh
 * Responsibilities:
 * - Discover new TikTok videos (scan up to `limit` recent posts, dedupe by id)
 * - Refresh existing TikTok videos (batch refresh all videos)
 * - Upload thumbnails to Firebase Storage
 * - Normalize video data format
 */
export class TikTokSyncService {
  /**
   * Discover new TikTok videos.
   *
   * Fetches up to `limit` videos from the profile and returns every video
   * whose id is not in `existingVideos`. We deliberately scan the entire
   * batch instead of stopping at the first duplicate — apidojo/tiktok-scraper-api
   * surfaces pinned/featured posts first, so a strict "stop at first match"
   * loop misses every newer-than-pinned post.
   *
   * @param account - Tracked account object
   * @param orgId - Organization ID for thumbnail storage
   * @param existingVideos - Map of existing video IDs
   * @returns Array of new video data
   */
  static async discovery(
    account: { username: string; id: string },
    orgId: string,
    existingVideos: Map<string, any>,
    limit: number = 10
  ): Promise<{ videos: any[], profile?: any }> {
    console.log(`🔍 [TIKTOK] Forward discovery - fetching ${limit} most recent videos...`);
    
    try {
      const scraperInput: any = {
        startUrls: [`https://www.tiktok.com/@${account.username}`],
        maxItems: limit,
        includeSearchKeywords: false
      };
      
      // Only include location if it's a valid string (API rejects null)
      // Location should be ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB', 'CA')
      // Omit if not needed
      
      const data = await runApifyActor({
        actorId: 'apidojo/tiktok-scraper-api',
        input: scraperInput
      });

      const batch = data.items || [];
      
      if (batch.length === 0) {
        console.log(`    ⚠️ [TIKTOK] No videos returned`);
        return { videos: [] };
      }
      
      console.log(`    📦 [TIKTOK] Fetched ${batch.length} videos from Apify`);
      
      // Extract profile from first video — check all known avatar field names + deep scan
      let profile = null;
      if (batch.length > 0) {
        const v = batch[0];
        const channel = v.channel || {};
        const authorMeta = v.authorMeta || {};
        const author = v.author || {};
        const knownAvatar = channel.avatar || channel.avatarLarger || channel.avatarMedium || channel.avatarThumb || channel.avatar_url
          || authorMeta.avatar || authorMeta.avatarLarger || authorMeta.avatarThumb
          || author.avatar || author.avatarLarger || author.avatarThumb
          || v['channel.avatar'] || v['authorMeta.avatar'] || v.avatar || '';
        const avatarUrl = knownAvatar || deepScanForAvatarUrl(v);
        
        if (avatarUrl) {
          console.log(`✅ [TIKTOK] Profile avatar found: ${avatarUrl.substring(0, 80)}...`);
          profile = {
            username: channel.username || channel.name || authorMeta.name || author.uniqueId || v['channel.username'] || v['authorMeta.name'],
            displayName: channel.name || channel.username || authorMeta.name || author.name || v['channel.name'] || v['authorMeta.name'],
            profilePicUrl: avatarUrl,
            followersCount: channel.followers || authorMeta.fans || author.fans,
            followingCount: channel.following || authorMeta.following || author.following,
            likesCount: 0,
            isVerified: channel.verified || authorMeta.verified || false
          };
        } else {
          console.warn(`⚠️ [TIKTOK] No avatar URL found in raw data for @${account.username}`);
        }
      }
      
      // Scan the full batch and dedupe against existingVideos. apidojo's
      // ordering is pinned-first then chronological, so we can't break early.
      const newVideos: any[] = [];
      let duplicateCount = 0;

      for (const video of batch) {
        const videoId = video.id;
        if (!videoId) continue;
        if (existingVideos.has(videoId)) {
          duplicateCount++;
          continue;
        }
        newVideos.push(video);
      }

      console.log(`    📊 [TIKTOK] Discovered ${newVideos.length} new videos (skipped ${duplicateCount} already in DB)`);
      
      // Normalize and upload thumbnails
      const normalizedVideos: any[] = [];
      
      for (const video of newVideos) {
        try {
          const normalized = await this.normalizeVideoData(video, account, orgId);
          normalizedVideos.push(normalized);
        } catch (err: any) {
          console.error(`    ❌ [TIKTOK] Failed to normalize video ${video.id}:`, err.message);
        }
      }
      
      return { videos: normalizedVideos, profile };
    } catch (error: any) {
      console.error(`❌ [TIKTOK] Discovery failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * Refresh existing TikTok videos (batch refresh)
   * Fetches updated metrics for all existing videos
   * 
   * @param account - Tracked account object
   * @param orgId - Organization ID
   * @param existingVideoIds - Array of existing video IDs to refresh
   * @returns Array of refreshed video data
   */
  static async refresh(
    account: { username: string; id: string },
    orgId: string,
    existingVideoIds: string[]
  ): Promise<Array<any>> {
    if (existingVideoIds.length === 0) {
      console.log(`    ℹ️ [TIKTOK] No existing videos to refresh`);
      return [];
    }
    
    console.log(`🔄 [TIKTOK] Refreshing ${existingVideoIds.length} existing videos...`);
    
    try {
      // Build TikTok video URLs
      const videoUrls = existingVideoIds.map(id => `https://www.tiktok.com/@${account.username}/video/${id}`);
      
      const refreshInput: any = {
        startUrls: videoUrls,
        maxItems: videoUrls.length,
        includeSearchKeywords: false,
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      };

      const data = await runApifyActor({
        actorId: 'apidojo/tiktok-scraper-api',
        input: refreshInput
      });
      
      const refreshedVideos = data.items || [];
      console.log(`    ✅ [TIKTOK] Refreshed ${refreshedVideos.length}/${existingVideoIds.length} videos`);
      
      // Normalize refreshed videos (no thumbnail upload needed, already exists)
      const normalizedVideos: any[] = [];
      
      for (const video of refreshedVideos) {
        try {
          const normalized = await this.normalizeVideoData(video, account, orgId, false);
          normalizedVideos.push(normalized);
        } catch (err: any) {
          console.error(`    ❌ [TIKTOK] Failed to normalize refreshed video:`, err.message);
        }
      }
      
      return normalizedVideos;
    } catch (error: any) {
      console.error(`❌ [TIKTOK] Refresh failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * Normalize TikTok video data to standard format
   * Handles thumbnail upload if uploadThumbnail is true
   */
  private static async normalizeVideoData(
    video: any,
    account: { username: string; id: string },
    orgId: string,
    uploadThumbnail: boolean = true
  ): Promise<any> {
    const videoId = video.id;
    
    // Upload thumbnail if requested
    // New API format: video.video.cover, video.video.thumbnail, video.video.url
    let thumbnailUrl = video.video?.cover || 
                       video.video?.thumbnail || 
                       video.videoMeta?.coverUrl || 
                       video.coverUrl || 
                       '';
    
    if (uploadThumbnail && thumbnailUrl) {
      try {
        thumbnailUrl = await ImageUploadService.downloadAndUpload(
          thumbnailUrl,
          orgId,
          `tiktok_${videoId}.jpg`,
          'thumbnails'
        );
      } catch (err: any) {
        console.warn(`    ⚠️ [TIKTOK] Thumbnail upload failed for ${videoId}, using CDN URL:`, err.message);
      }
    }
    
    if (!thumbnailUrl) {
      console.warn(`    ⚠️ [TIKTOK] No valid thumbnail URL for video ${videoId}. Available fields:`,
        Object.keys(video).filter(k =>
          k.toLowerCase().includes('url') ||
          k.toLowerCase().includes('image') ||
          k.toLowerCase().includes('thumb') ||
          k.toLowerCase().includes('cover') ||
          k.toLowerCase().includes('video')
        )
      );
    }
    
    // Parse upload date
    // New API format: video.uploadedAtFormatted, video.uploadedAt
    let uploadTimestamp: FirebaseFirestore.Timestamp;
    if (video.uploadedAtFormatted) {
      uploadTimestamp = Timestamp.fromDate(new Date(video.uploadedAtFormatted));
    } else if (video.uploadedAt) {
      uploadTimestamp = Timestamp.fromMillis(video.uploadedAt * 1000);
    } else if (video.createTime || video.createTimeISO) {
      const uploadDate = new Date(video.createTimeISO || Number(video.createTime) * 1000);
      uploadTimestamp = Timestamp.fromDate(uploadDate);
    } else if (video.created_time || video.createdAt) {
      uploadTimestamp = Timestamp.fromDate(new Date(video.created_time || video.createdAt));
    } else {
      console.warn(`    ⚠️ [TIKTOK] Video ${videoId} missing timestamp - using current time as fallback`);
      uploadTimestamp = Timestamp.now();
    }
    
    // Get channel info
    const channel = video.channel || {};
    
    return {
      videoId: videoId,
      videoTitle: (video.title || video.text || '').substring(0, 100) || 'Untitled Video',
      videoUrl: video.postPage || video.webVideoUrl || `https://www.tiktok.com/@${account.username}/video/${videoId}`,
      platform: 'tiktok',
      thumbnail: thumbnailUrl,
      accountUsername: channel.username || account.username,
      accountDisplayName: channel.name || video.authorMeta?.name || account.username,
      uploadDate: uploadTimestamp,
      views: video.views || video.playCount || 0,
      likes: video.likes || video.diggCount || 0,
      comments: video.comments || video.commentCount || 0,
      shares: video.shares || video.shareCount || 0,
      saves: video.bookmarks || video.collectCount || 0,
      caption: video.title || video.text || '',
      duration: video.video?.duration || video.videoMeta?.duration || 0,
      mediaUrl: video.video?.playAddr || video.video?.downloadAddr || video.videoUrl || video.contentUrl || video.playAddr || '',
    };
  }
}

