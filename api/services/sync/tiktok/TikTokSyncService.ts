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
    existingVideos: Map<string, any>
  ): Promise<Array<any>> {
    console.log(`🔍 [TIKTOK] Forward discovery - fetching 10 most recent videos...`);
    
    try {
      const scraperInput = {
        profiles: [`https://www.tiktok.com/@${account.username}`],
        maxItems: 10,
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      };
      
      const data = await runApifyActor({
        actorId: 'OtzYfK1ndEGdwWFKQ',
        input: scraperInput
      });

      const batch = data.items || [];
      
      if (batch.length === 0) {
        console.log(`    ⚠️ [TIKTOK] No videos returned`);
        return [];
      }
      
      console.log(`    📦 [TIKTOK] Fetched ${batch.length} videos from Apify`);
      
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
      
      return normalizedVideos;
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
      
      const refreshInput = {
        postURLs: videoUrls,
        maxItems: videoUrls.length,
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      };
      
      const data = await runApifyActor({
        actorId: 'OtzYfK1ndEGdwWFKQ',
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
    let thumbnailUrl = video.videoMeta?.coverUrl || video.coverUrl || '';
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
    
    // Parse upload date
    let uploadTimestamp: FirebaseFirestore.Timestamp;
    if (video.createTime || video.createTimeISO) {
      const uploadDate = new Date(video.createTimeISO || Number(video.createTime) * 1000);
      uploadTimestamp = Timestamp.fromDate(uploadDate);
    } else {
      console.warn(`    ⚠️ [TIKTOK] Video ${videoId} missing timestamp - using epoch`);
      uploadTimestamp = Timestamp.fromMillis(0);
    }
    
    return {
      videoId: videoId,
      videoTitle: (video.text || '').substring(0, 100) || 'Untitled Video',
      videoUrl: video.webVideoUrl || `https://www.tiktok.com/@${account.username}/video/${videoId}`,
      platform: 'tiktok',
      thumbnail: thumbnailUrl,
      accountUsername: account.username,
      accountDisplayName: video.authorMeta?.name || account.username,
      uploadDate: uploadTimestamp,
      views: video.playCount || 0,
      likes: video.diggCount || 0,
      comments: video.commentCount || 0,
      shares: video.shareCount || 0,
      saves: video.collectCount || 0,
      caption: video.text || '',
      duration: video.videoMeta?.duration || 0
    };
  }
}

