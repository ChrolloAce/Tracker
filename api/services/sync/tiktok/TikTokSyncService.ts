import { Timestamp } from 'firebase-admin/firestore';
import { runApifyActor } from '../../../apify-client.js';
import { ImageUploadService } from '../shared/ImageUploadService.js';

/**
 * TikTokSyncService
 * 
 * Purpose: Handle TikTok video discovery and refresh
 * Responsibilities:
 * - Discover new TikTok videos (forward discovery, 10 most recent)
 * - Refresh existing TikTok videos (batch refresh all videos)
 * - Upload thumbnails to Firebase Storage
 * - Normalize video data format
 */
export class TikTokSyncService {
  /**
   * Discover new TikTok videos (forward discovery)
   * Fetches the 10 most recent videos and returns only NEW videos
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
        actorId: 'apidojo/tiktok-scraper',
        input: scraperInput
      });

      const batch = data.items || [];
      
      if (batch.length === 0) {
        console.log(`    ⚠️ [TIKTOK] No videos returned`);
        return { videos: [] };
      }
      
      console.log(`    📦 [TIKTOK] Fetched ${batch.length} videos from Apify`);
      
      // Extract profile from first video
      let profile = null;
      if (batch.length > 0) {
        const v = batch[0];
        const channel = v.channel || {};
        if (channel.avatar) {
          profile = {
            username: channel.username || channel.name,
            displayName: channel.name || channel.username,
            profilePicUrl: channel.avatar,
            followersCount: channel.followers,
            followingCount: channel.following,
            likesCount: 0,
            isVerified: channel.verified || false
          };
        }
      }
      
      // Filter out existing videos
      const newVideos: any[] = [];
      let foundDuplicate = false;
      
      for (const video of batch) {
        const videoId = video.id;
        if (!videoId) continue;
        
        if (existingVideos.has(videoId)) {
          console.log(`    ✓ [TIKTOK] Found duplicate: ${videoId} - stopping discovery`);
          foundDuplicate = true;
          break;
        }
        
        newVideos.push(video);
      }
      
      console.log(`    📊 [TIKTOK] Discovered ${newVideos.length} new videos${foundDuplicate ? ' (stopped at duplicate)' : ''}`);
      
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
        includeSearchKeywords: false
      };
      
      // Only include location if it's a valid string (API rejects null)
      // Location should be ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB', 'CA')
      // Omit if not needed
      
      const data = await runApifyActor({
        actorId: 'apidojo/tiktok-scraper',
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
      duration: video.video?.duration || video.videoMeta?.duration || 0
    };
  }
}

