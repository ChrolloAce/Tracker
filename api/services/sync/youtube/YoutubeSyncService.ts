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
    existingVideos: Map<string, any>,
    limit: number = 10
  ): Promise<{ videos: any[], profile?: any }> {
    console.log(`🔍 [YOUTUBE] Forward discovery - fetching ${limit} most recent Shorts...`);
    
    // Get channelId (optional but recommended)
    const channelId = account.youtubeChannelId;
    
    try {
      const scraperInput: any = {
        maxResults: limit,
        sortBy: 'latest',
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      };

      if (channelId) {
        scraperInput.channelId = channelId;
      } else {
        scraperInput.channels = [account.username];
      }
      
      const data = await runApifyActor({
        actorId: 'grow_media/youtube-shorts-scraper',
        input: scraperInput
      });

      const batch = data.items || [];
      
      if (batch.length === 0) {
        console.log(`    ⚠️ [YOUTUBE] No Shorts returned`);
        return { videos: [] };
      }
      
      console.log(`    📦 [YOUTUBE] Fetched ${batch.length} Shorts from Apify (requested 10)`);
      
      // Validate channel ownership (all videos should be from the same channel)
      if (channelId) {
      const invalidChannelVideos = batch.filter((v: any) => v.channelId && v.channelId !== channelId);
      if (invalidChannelVideos.length > 0) {
        console.warn(`    ⚠️ [YOUTUBE] Found ${invalidChannelVideos.length} videos from wrong channels - filtering out`);
        }
      }
      
      // Extract profile from first valid video
      let profile = null;
      const validProfileVideo = batch.find((v: any) => !v.channelId || v.channelId === channelId);
      
      if (validProfileVideo) {
        profile = {
          displayName: validProfileVideo.channelName || account.username,
          profilePicUrl: validProfileVideo.channelAvatarUrl,
          followersCount: validProfileVideo.numberOfSubscribers,
          isVerified: validProfileVideo.isChannelVerified
        };
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
      
      return { videos: normalizedVideos, profile };
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
    
    console.log(`🔄 [YOUTUBE] Refreshing ${existingVideoIds.length} existing Shorts using YouTube Data API...`);
    
    // Get expected channelId for validation
    const expectedChannelId = account.youtubeChannelId;
    
    try {
      // Use YouTube Data API directly (free, fast, reliable)
      // YouTube API supports up to 50 IDs per request, so batch them
      const allRefreshedVideos: any[] = [];
      
      for (let i = 0; i < existingVideoIds.length; i += 50) {
        const batchIds = existingVideoIds.slice(i, i + 50);
        console.log(`    📦 [YOUTUBE] Batch ${Math.floor(i / 50) + 1}: Fetching ${batchIds.length} videos...`);
        
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) {
          console.error('    ❌ [YOUTUBE] YOUTUBE_API_KEY not configured');
          break;
        }
        
        const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${batchIds.join(',')}&key=${apiKey}`;
        const videoRes = await fetch(videoUrl);
        
        if (!videoRes.ok) {
          console.error(`    ❌ [YOUTUBE] Batch ${Math.floor(i / 50) + 1} failed: ${videoRes.status}`);
          continue;
        }
        
        const videoData = await videoRes.json();
        const items = videoData.items || [];
        allRefreshedVideos.push(...items);
        console.log(`    ✅ [YOUTUBE] Batch ${Math.floor(i / 50) + 1}: Got ${items.length} videos`);
      }
      
      // Normalize YouTube API format to match expected format
      const refreshedVideos = allRefreshedVideos.map((video: any) => {
        // Parse duration from ISO 8601 format (PT1M30S)
        let durationSeconds = 0;
        if (video.contentDetails?.duration) {
          const durationStr = video.contentDetails.duration;
          const match = durationStr.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
          if (match) {
            const minutes = parseInt(match[1] || '0', 10);
            const seconds = parseInt(match[2] || '0', 10);
            durationSeconds = minutes * 60 + seconds;
        }
        }
        
        // Get best thumbnail
        let thumbnail = '';
        if (video.snippet?.thumbnails?.maxres?.url) {
          thumbnail = video.snippet.thumbnails.maxres.url;
        } else if (video.snippet?.thumbnails?.standard?.url) {
          thumbnail = video.snippet.thumbnails.standard.url;
        } else if (video.snippet?.thumbnails?.high?.url) {
          thumbnail = video.snippet.thumbnails.high.url;
        } else if (video.snippet?.thumbnails?.medium?.url) {
          thumbnail = video.snippet.thumbnails.medium.url;
        } else if (video.snippet?.thumbnails?.default?.url) {
          thumbnail = video.snippet.thumbnails.default.url;
        }
        
        // Normalize to Apify-like format for compatibility
        return {
          id: video.id,
          title: video.snippet?.title || '',
          url: `https://www.youtube.com/shorts/${video.id}`,
          channelId: video.snippet?.channelId,
          channelName: video.snippet?.channelTitle || '',
          channel_id: video.snippet?.channelId,
          channel_name: video.snippet?.channelTitle || '',
          thumbnailUrl: thumbnail,
          thumbnails: video.snippet?.thumbnails,
          duration: video.contentDetails?.duration || '',
          viewCount: parseInt(video.statistics?.viewCount || '0', 10),
          likes: parseInt(video.statistics?.likeCount || '0', 10),
          commentsCount: parseInt(video.statistics?.commentCount || '0', 10),
          date: video.snippet?.publishedAt,
          text: video.snippet?.description || ''
        };
      });
      
      console.log(`    ✅ [YOUTUBE] Refreshed ${refreshedVideos.length}/${existingVideoIds.length} Shorts via YouTube API`);
      
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
      views: video.viewCount || video.views || video.numberOfViews || 0,
      likes: video.likes || video.likeCount || video.numberOfLikes || 0,
      comments: video.commentsCount || video.commentCount || video.numberOfComments || 0,
      shares: 0, // YouTube doesn't expose share count
      saves: video.favoriteCount || video.favorites || 0,
      caption: video.text || '',
      duration: durationSeconds
    };
  }
}

