import { Timestamp } from 'firebase-admin/firestore';
import { runApifyActor } from '../../../apify-client.js';

/**
 * YoutubeSyncService
 * 
 * Purpose: Handle YouTube Shorts discovery and refresh
 * Responsibilities:
 * - Discover new YouTube Shorts (forward discovery, 10 most recent)
 * - Refresh existing YouTube Shorts (batch refresh all videos)
 * - Validate channel ownership to prevent wrong channel data
 * - Normalize video data format
 */
export class YoutubeSyncService {
  /**
   * Discover new YouTube Shorts (forward discovery)
   * Fetches the 10 most recent Shorts and returns only NEW videos
   * 
   * @param account - Tracked account object with youtubeChannelId
   * @param orgId - Organization ID
   * @param existingVideos - Map of existing video IDs
   * @returns Array of new video data
   */
  static async discovery(
    account: { username: string; id: string; youtubeChannelId?: string },
    orgId: string,
    existingVideos: Map<string, any>
  ): Promise<Array<any>> {
    console.log(`🔍 [YOUTUBE] Forward discovery - fetching 10 most recent Shorts...`);
    
    // Get channelId - fetch it if missing
    let channelId = account.youtubeChannelId;
    if (!channelId) {
      console.log(`    ⚠️ [YOUTUBE] No channelId found - fetching from username @${account.username}...`);
      channelId = await this.fetchChannelIdFromUsername(account.username);
      if (!channelId) {
        throw new Error(`Unable to find YouTube channel for @${account.username}`);
      }
      console.log(`    ✅ [YOUTUBE] Found channelId: ${channelId}`);
      
      // Update in-memory for this sync (will be saved to Firestore by SyncCoordinator)
      account.youtubeChannelId = channelId;
    }
    
    try {
      const scraperInput = {
        channelId: channelId,
        maxResults: 10,
        sortBy: 'latest',
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      };
      
      const data = await runApifyActor({
        actorId: 'grow_media/youtube-shorts-scraper',
        input: scraperInput
      });

      const batch = data.items || [];
      
      if (batch.length === 0) {
        console.log(`    ⚠️ [YOUTUBE] No Shorts returned`);
        return [];
      }
      
      console.log(`    📦 [YOUTUBE] Fetched ${batch.length} Shorts from Apify (requested 10)`);
      
      // Validate channel ownership (all videos should be from the same channel)
      const invalidChannelVideos = batch.filter((v: any) => v.channelId && v.channelId !== channelId);
      if (invalidChannelVideos.length > 0) {
        console.warn(`    ⚠️ [YOUTUBE] Found ${invalidChannelVideos.length} videos from wrong channels - filtering out`);
      }
      
      // Filter out existing videos and wrong channel videos
      const newVideos: any[] = [];
      let foundDuplicate = false;
      
      for (const video of batch) {
        // Skip if from wrong channel
        if (video.channelId && video.channelId !== channelId) {
          continue;
        }
        
        const videoId = video.id;
        if (!videoId) continue;
        
        if (existingVideos.has(videoId)) {
          console.log(`    ✓ [YOUTUBE] Found duplicate: ${videoId} - stopping discovery`);
          foundDuplicate = true;
          break;
        }
        
        newVideos.push(video);
      }
      
      console.log(`    📊 [YOUTUBE] Discovered ${newVideos.length} new Shorts${foundDuplicate ? ' (stopped at duplicate)' : ''}`);
      
      // Normalize videos
      const normalizedVideos: any[] = [];
      
      for (const video of newVideos) {
        try {
          const normalized = this.normalizeVideoData(video, account);
          normalizedVideos.push(normalized);
        } catch (err: any) {
          console.error(`    ❌ [YOUTUBE] Failed to normalize video ${video.id}:`, err.message);
        }
      }
      
      return normalizedVideos;
    } catch (error: any) {
      console.error(`❌ [YOUTUBE] Discovery failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * Refresh existing YouTube Shorts (batch refresh)
   * Fetches updated metrics for all existing Shorts
   * 
   * @param account - Tracked account object with youtubeChannelId
   * @param orgId - Organization ID
   * @param existingVideoIds - Array of existing video IDs to refresh
   * @returns Array of refreshed video data
   */
  static async refresh(
    account: { username: string; id: string; youtubeChannelId?: string },
    orgId: string,
    existingVideoIds: string[]
  ): Promise<Array<any>> {
    if (existingVideoIds.length === 0) {
      console.log(`    ℹ️ [YOUTUBE] No existing videos to refresh`);
      return [];
    }
    
    console.log(`🔄 [YOUTUBE] Refreshing ${existingVideoIds.length} existing Shorts...`);
    
    // Get expected channelId for validation
    const expectedChannelId = account.youtubeChannelId;
    
    try {
      const refreshInput = {
        videoIds: existingVideoIds,
        maxResults: existingVideoIds.length,
        sortBy: 'latest',
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      };
      
      const data = await runApifyActor({
        actorId: 'grow_media/youtube-shorts-scraper',
        input: refreshInput
      });
      
      const refreshedVideos = data.items || [];
      console.log(`    ✅ [YOUTUBE] Refreshed ${refreshedVideos.length}/${existingVideoIds.length} Shorts`);
      
      // Validate channel ownership during refresh
      let filteredVideos = refreshedVideos;
      if (expectedChannelId) {
        filteredVideos = refreshedVideos.filter((v: any) => {
          if (v.channelId && v.channelId !== expectedChannelId) {
            console.warn(`    ⚠️ [YOUTUBE] Video ${v.id} belongs to wrong channel (${v.channelId}), filtering out`);
            return false;
          }
          return true;
        });
        
        if (filteredVideos.length < refreshedVideos.length) {
          console.log(`    🔍 [YOUTUBE] Filtered out ${refreshedVideos.length - filteredVideos.length} videos from wrong channels`);
        }
      }
      
      // Normalize refreshed videos
      const normalizedVideos: any[] = [];
      
      for (const video of filteredVideos) {
        try {
          const normalized = this.normalizeVideoData(video, account);
          normalizedVideos.push(normalized);
        } catch (err: any) {
          console.error(`    ❌ [YOUTUBE] Failed to normalize refreshed video:`, err.message);
        }
      }
      
      return normalizedVideos;
    } catch (error: any) {
      console.error(`❌ [YOUTUBE] Refresh failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * Normalize YouTube video data to standard format
   */
  private static normalizeVideoData(
    video: any,
    account: { username: string; id: string }
  ): any {
    // Parse duration from ISO 8601 format (PT1M30S)
    let durationSeconds = 0;
    if (video.duration) {
      const durationStr = video.duration;
      const match = durationStr.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        const minutes = parseInt(match[1] || '0', 10);
        const seconds = parseInt(match[2] || '0', 10);
        durationSeconds = minutes * 60 + seconds;
      }
    }
    
    // Get best thumbnail
    let thumbnail = '';
    if (video.thumbnails?.maxres?.url) {
      thumbnail = video.thumbnails.maxres.url;
    } else if (video.thumbnails?.standard?.url) {
      thumbnail = video.thumbnails.standard.url;
    } else if (video.thumbnails?.high?.url) {
      thumbnail = video.thumbnails.high.url;
    } else if (video.thumbnails?.medium?.url) {
      thumbnail = video.thumbnails.medium.url;
    } else if (video.thumbnails?.default?.url) {
      thumbnail = video.thumbnails.default.url;
    } else if (video.thumbnailUrl) {
      thumbnail = video.thumbnailUrl;
    }
    
    // Parse upload date
    let uploadTimestamp: FirebaseFirestore.Timestamp;
    if (video.date) {
      uploadTimestamp = Timestamp.fromDate(new Date(video.date));
    } else {
      console.warn(`    ⚠️ [YOUTUBE] Video ${video.id} missing upload date - using epoch`);
      uploadTimestamp = Timestamp.fromMillis(0);
    }
    
    return {
      videoId: video.id,
      videoTitle: video.title || 'Untitled Short',
      videoUrl: video.url || `https://youtube.com/shorts/${video.id}`,
      platform: 'youtube',
      thumbnail: thumbnail,
      accountUsername: account.username,
      accountDisplayName: video.channelName || account.username,
      uploadDate: uploadTimestamp,
      views: video.viewCount || 0,
      likes: video.likes || 0,
      comments: video.commentsCount || 0,
      shares: 0, // YouTube doesn't expose share count
      saves: video.favoriteCount || video.favorites || 0,
      caption: video.text || '',
      duration: durationSeconds
    };
  }
  
  /**
   * Fetch YouTube channelId from username/handle
   * Uses YouTube Data API to get channel info
   */
  private static async fetchChannelIdFromUsername(username: string): Promise<string | null> {
    try {
      // Remove @ symbol if present
      const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
      
      console.log(`    🔍 [YOUTUBE] Searching for channel: ${cleanUsername}`);
      
      // Try to fetch channel info by searching for videos from this user
      // Then extract the channelId from the first video
      const scraperInput = {
        channelUrl: `https://www.youtube.com/@${cleanUsername}`,
        maxResults: 1,
        sortBy: 'latest',
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      };
      
      const data = await runApifyActor({
        actorId: 'grow_media/youtube-shorts-scraper',
        input: scraperInput
      });
      
      if (data.items && data.items.length > 0 && data.items[0].channelId) {
        const channelId = data.items[0].channelId;
        console.log(`    ✅ [YOUTUBE] Extracted channelId from video: ${channelId}`);
        return channelId;
      }
      
      console.warn(`    ⚠️ [YOUTUBE] No channelId found for @${cleanUsername}`);
      return null;
    } catch (error: any) {
      console.error(`    ❌ [YOUTUBE] Failed to fetch channelId for @${username}:`, error.message);
      return null;
    }
  }
}

