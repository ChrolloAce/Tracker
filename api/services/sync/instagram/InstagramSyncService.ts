import { Timestamp } from 'firebase-admin/firestore';
import { runApifyActor } from '../../../apify-client.js';
import { ImageUploadService } from '../shared/ImageUploadService.js';
import { ValidationService } from '../shared/ValidationService.js';

/**
 * InstagramSyncService
 * 
 * Purpose: Handle Instagram video discovery and refresh
 * Responsibilities:
 * - Discover new Instagram reels (forward discovery, 10 most recent)
 * - Refresh existing Instagram reels (batch refresh all videos)
 * - Upload thumbnails to Firebase Storage
 * - Normalize video data format
 */
export class InstagramSyncService {
  /**
   * Discover new Instagram reels (forward discovery)
   * Fetches the 10 most recent reels and returns only NEW videos
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
  ): Promise<{ videos: any[], foundDuplicate: boolean }> {
    console.log(`🔍 [INSTAGRAM] Forward discovery - fetching ${limit} most recent reels...`);
    
    try {
      const scraperInput: any = {
        tags: [`https://www.instagram.com/${account.username}/reels/`],
        target: 'reels_only',
        reels_count: limit,
        include_raw_data: true,
        custom_functions: '{ shouldSkip: (data) => false, shouldContinue: (data) => true }',
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL'],
          apifyProxyCountry: 'US'
        },
        maxConcurrency: 1,
        maxRequestRetries: 3,
        handlePageTimeoutSecs: 120,
        debugLog: false
      };
      
      const data = await runApifyActor({
        actorId: 'hpix~ig-reels-scraper',
        input: scraperInput
      });

      const batch = data.items || [];
      
      if (batch.length === 0) {
        console.log(`    ⚠️ [INSTAGRAM] No reels returned`);
        return { videos: [], foundDuplicate: false };
      }
      
      console.log(`    📦 [INSTAGRAM] Fetched ${batch.length} reels from Apify`);
      
      // Filter out existing videos
      const newVideos: any[] = [];
      let foundDuplicate = false;
      
      for (const reel of batch) {
        const reelId = reel.shortCode || reel.id;
        if (!reelId) continue;
        
        if (existingVideos.has(reelId)) {
          console.log(`    ✓ [INSTAGRAM] Found duplicate: ${reelId} - stopping discovery`);
          foundDuplicate = true;
          break;
        }
        
        newVideos.push(reel);
      }
      
      console.log(`    📊 [INSTAGRAM] Discovered ${newVideos.length} new reels${foundDuplicate ? ' (stopped at duplicate)' : ''}`);
      
      // Normalize and upload thumbnails
      const normalizedVideos: any[] = [];
      
      for (const reel of newVideos) {
        try {
          const normalized = await this.normalizeVideoData(reel, account, orgId);
          normalizedVideos.push(normalized);
        } catch (err: any) {
          console.error(`    ❌ [INSTAGRAM] Failed to normalize reel ${reel.shortCode}:`, err.message);
        }
      }
      
      return { videos: normalizedVideos, foundDuplicate };
    } catch (error: any) {
      console.error(`❌ [INSTAGRAM] Discovery failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * Refresh existing Instagram reels (batch refresh)
   * Fetches updated metrics for all existing reels
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
      console.log(`    ℹ️ [INSTAGRAM] No existing videos to refresh`);
      return [];
    }
    
    console.log(`🔄 [INSTAGRAM] Refreshing ${existingVideoIds.length} existing reels...`);
    
    try {
      // Build Instagram post URLs
      const postUrls = existingVideoIds.map(id => `https://www.instagram.com/p/${id}/`);
      
      const refreshInput: any = {
        post_urls: postUrls,
        target: 'reels_only',
        reels_count: postUrls.length,
        include_raw_data: true,
        custom_functions: '{ shouldSkip: (data) => false, shouldContinue: (data) => true }',
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL'],
          apifyProxyCountry: 'US'
        },
        maxConcurrency: 1,
        maxRequestRetries: 3,
        handlePageTimeoutSecs: 120,
        debugLog: false
      };
      
      const data = await runApifyActor({
        actorId: 'hpix~ig-reels-scraper',
        input: refreshInput
      });
      
      const refreshedReels = data.items || [];
      console.log(`    ✅ [INSTAGRAM] Refreshed ${refreshedReels.length}/${existingVideoIds.length} reels`);
      
      // Normalize refreshed videos (no thumbnail upload needed, already exists)
      const normalizedVideos: any[] = [];
      
      for (const reel of refreshedReels) {
        // Check for errors (deleted/restricted)
        if (reel.error) {
           // Return error object to be handled by caller
           normalizedVideos.push({
             error: reel.error,
             input: reel.input,
             isError: true
           });
           continue;
        }

        try {
          const normalized = await this.normalizeVideoData(reel, account, orgId, false);
          normalizedVideos.push(normalized);
        } catch (err: any) {
          console.error(`    ❌ [INSTAGRAM] Failed to normalize refreshed reel:`, err.message);
        }
      }
      
      return normalizedVideos;
    } catch (error: any) {
      console.error(`❌ [INSTAGRAM] Refresh failed:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch Instagram profile data
   */
  static async getProfile(username: string): Promise<any> {
    console.log(`👤 [INSTAGRAM] Fetching profile data for ${username}...`);
    try {
      const profileData = await runApifyActor({
        actorId: 'apify~instagram-profile-scraper',
        input: {
          usernames: [username.replace('@', '')],
          proxyConfiguration: {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL'],
            apifyProxyCountry: 'US'
          },
          includeAboutSection: false
        }
      });

      const profiles = profileData.items || [];
      if (profiles.length > 0) {
        return profiles[0];
      }
      return null;
    } catch (error: any) {
      console.error(`❌ [INSTAGRAM] Failed to fetch profile:`, error.message);
      throw error;
    }
  }

  
  /**
   * Normalize Instagram reel data to standard format
   * Handles thumbnail upload if uploadThumbnail is true
   */
  private static async normalizeVideoData(
    reel: any,
    account: { username: string; id: string },
    orgId: string,
    uploadThumbnail: boolean = true
  ): Promise<any> {
    const reelId = reel.shortCode || reel.id;
    
    // Upload thumbnail if requested - try multiple possible fields
    let thumbnailUrl = reel.displayUrl || 
                       reel.thumbnailUrl || 
                       reel.thumbnail || 
                       reel.videoUrl || 
                       reel.thumbnailSrc ||
                       reel.display_url ||
                       reel.thumbnail_url ||
                       (reel.images && reel.images.length > 0 ? reel.images[0].url : '') ||
                       '';
    
    // Log available fields if thumbnail is missing for debugging
    if (!thumbnailUrl) {
      console.warn(`    ⚠️ [INSTAGRAM] No thumbnail found for ${reelId}. Available fields:`, Object.keys(reel).filter(k => k.toLowerCase().includes('url') || k.toLowerCase().includes('image') || k.toLowerCase().includes('thumb')));
    }
    
    if (uploadThumbnail && thumbnailUrl) {
      try {
        thumbnailUrl = await ImageUploadService.downloadAndUpload(
          thumbnailUrl,
          orgId,
          `instagram_${reelId}.jpg`,
          'thumbnails'
        );
      } catch (err: any) {
        console.warn(`    ⚠️ [INSTAGRAM] Thumbnail upload failed for ${reelId}, using CDN URL:`, err.message);
      }
    }
    
    // Parse upload date
    let uploadTimestamp: FirebaseFirestore.Timestamp;
    if (reel.timestamp) {
      const uploadDate = typeof reel.timestamp === 'string' 
        ? new Date(reel.timestamp)
        : new Date(Number(reel.timestamp) * 1000);
      uploadTimestamp = Timestamp.fromDate(uploadDate);
    } else if (reel.taken_at || reel.takenAt) {
      // Alternative timestamp fields
      const ts = reel.taken_at || reel.takenAt;
      const uploadDate = typeof ts === 'string' ? new Date(ts) : new Date(Number(ts) * 1000);
      uploadTimestamp = Timestamp.fromDate(uploadDate);
    } else if (reel.created_time || reel.createdTime) {
      // Another variation
      const uploadDate = new Date(reel.created_time || reel.createdTime);
      uploadTimestamp = Timestamp.fromDate(uploadDate);
    } else {
      console.warn(`    ⚠️ [INSTAGRAM] Reel ${reelId} missing timestamp - using current time as fallback`);
      uploadTimestamp = Timestamp.now();
    }
    
    return {
      videoId: reelId,
      videoTitle: (reel.caption || '').substring(0, 100) || 'Untitled Reel',
      videoUrl: reel.url || `https://www.instagram.com/p/${reelId}/`,
      platform: 'instagram',
      thumbnail: thumbnailUrl,
      accountUsername: account.username,
      accountDisplayName: reel.ownerUsername || account.username,
      uploadDate: uploadTimestamp,
      views: reel.videoViewCount || reel.viewCount || reel.playCount || reel.play_count || 0,
      likes: reel.likesCount || reel.likeCount || reel.like_count || 0,
      comments: reel.commentsCount || reel.commentCount || reel.comment_count || 0,
      shares: 0, // Instagram API doesn't provide share count
      saves: 0, // Instagram doesn't expose saves via scraping
      caption: reel.caption || '',
      duration: reel.videoDuration || 0
    };
  }
}

