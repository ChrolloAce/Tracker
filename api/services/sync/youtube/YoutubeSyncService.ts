import { Timestamp } from 'firebase-admin/firestore';

export type YoutubeVideoType = 'shorts' | 'long' | 'both';

/**
 * YoutubeSyncService
 * 
 * Handles YouTube video discovery and refresh using the YouTube Data API v3.
 * Supports Shorts, long-form videos, or both based on account preference.
 */
export class YoutubeSyncService {
  /**
   * Discover new YouTube videos via YouTube Data API v3
   */
  static async discovery(
    account: { username: string; id: string; youtubeChannelId?: string; youtubeVideoType?: YoutubeVideoType },
    orgId: string,
    existingVideos: Set<string> | Map<string, any>,
    limit: number = 10
  ): Promise<{ videos: any[], profile?: any }> {
    const videoType = account.youtubeVideoType || 'both';
    console.log(`🔍 [YOUTUBE] Forward discovery - fetching ${limit} most recent videos (type: ${videoType})...`);

    const channelId = account.youtubeChannelId;
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      console.error('❌ [YOUTUBE] YOUTUBE_API_KEY not configured');
      return { videos: [] };
    }

    // Resolve channelId from username if not stored
    let resolvedChannelId = channelId;
    if (!resolvedChannelId) {
      resolvedChannelId = await this.resolveChannelId(account.username, apiKey);
      if (!resolvedChannelId) {
        console.error(`❌ [YOUTUBE] Could not resolve channel ID for @${account.username}`);
        return { videos: [] };
      }
      console.log(`    🔍 Resolved channel ID: ${resolvedChannelId}`);
    }

    try {
      // Fetch profile info from channel endpoint
      const profile = await this.fetchChannelProfile(resolvedChannelId, apiKey, account.username);

      // Search for videos based on type preference
      const searchResults = await this.searchVideos(resolvedChannelId, apiKey, videoType, limit);

      if (searchResults.length === 0) {
        console.log(`    ⚠️ [YOUTUBE] No videos returned for type: ${videoType}`);
        return { videos: [], profile };
      }

      console.log(`    📦 [YOUTUBE] Fetched ${searchResults.length} videos from YouTube API`);

      // Filter out existing videos
      const newVideos: any[] = [];
      let foundDuplicate = false;

      for (const video of searchResults) {
        const videoId = video.id;
        if (!videoId) continue;

        if (existingVideos.has(videoId)) {
          console.log(`    ✓ [YOUTUBE] Found duplicate: ${videoId} - stopping discovery`);
          foundDuplicate = true;
          break;
        }

        newVideos.push(video);
      }

      console.log(`    📊 [YOUTUBE] Discovered ${newVideos.length} new videos${foundDuplicate ? ' (stopped at duplicate)' : ''}`);

      // Normalize
      const normalizedVideos: any[] = [];
      for (const video of newVideos) {
        try {
          normalizedVideos.push(this.normalizeApiVideoData(video, account));
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
   * Refresh existing YouTube videos via Data API v3 (batch by ID)
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

    console.log(`🔄 [YOUTUBE] Refreshing ${existingVideoIds.length} existing videos using YouTube Data API...`);

    const expectedChannelId = account.youtubeChannelId;
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      console.error('    ❌ [YOUTUBE] YOUTUBE_API_KEY not configured');
      return [];
    }

    try {
      const allRefreshedVideos: any[] = [];

      for (let i = 0; i < existingVideoIds.length; i += 50) {
        const batchIds = existingVideoIds.slice(i, i + 50);
        console.log(`    📦 [YOUTUBE] Batch ${Math.floor(i / 50) + 1}: Fetching ${batchIds.length} videos...`);

        const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${batchIds.join(',')}&key=${apiKey}`;
        const videoRes = await fetch(videoUrl);

        if (!videoRes.ok) {
          console.error(`    ❌ [YOUTUBE] Batch ${Math.floor(i / 50) + 1} failed: ${videoRes.status}`);
          continue;
        }

        const videoData = await videoRes.json();
        allRefreshedVideos.push(...(videoData.items || []));
        console.log(`    ✅ [YOUTUBE] Batch ${Math.floor(i / 50) + 1}: Got ${(videoData.items || []).length} videos`);
      }

      // Filter by channel ownership
      let filtered = allRefreshedVideos;
      if (expectedChannelId) {
        filtered = allRefreshedVideos.filter((v: any) => {
          if (v.snippet?.channelId && v.snippet.channelId !== expectedChannelId) {
            console.warn(`    ⚠️ [YOUTUBE] Video ${v.id} belongs to wrong channel, filtering out`);
            return false;
          }
          return true;
        });
      }

      console.log(`    ✅ [YOUTUBE] Refreshed ${filtered.length}/${existingVideoIds.length} videos via YouTube API`);

      const normalizedVideos: any[] = [];
      for (const video of filtered) {
        try {
          normalizedVideos.push(this.normalizeApiVideoData(video, account));
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
   * Resolve a YouTube username/handle to a channel ID
   */
  private static async resolveChannelId(username: string, apiKey: string): Promise<string | null> {
    const handle = username.startsWith('@') ? username.substring(1) : username;

    // Try forHandle first
    const handleUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
    const handleRes = await fetch(handleUrl);
    if (handleRes.ok) {
      const data = await handleRes.json();
      if (data.items && data.items.length > 0) {
        return data.items[0].id;
      }
    }

    // Fallback: try as channel ID directly
    const idUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${encodeURIComponent(username)}&key=${apiKey}`;
    const idRes = await fetch(idUrl);
    if (idRes.ok) {
      const data = await idRes.json();
      if (data.items && data.items.length > 0) {
        return data.items[0].id;
      }
    }

    return null;
  }

  /**
   * Fetch channel profile data
   */
  private static async fetchChannelProfile(
    channelId: string,
    apiKey: string,
    fallbackUsername: string
  ): Promise<any> {
    try {
      const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(channelId)}&key=${apiKey}`;
      const res = await fetch(url);

      if (!res.ok) return null;

      const data = await res.json();
      if (!data.items || data.items.length === 0) return null;

      const channel = data.items[0];
      const profile = {
        displayName: channel.snippet?.title || fallbackUsername,
        profilePicUrl: channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.default?.url || null,
        followersCount: parseInt(channel.statistics?.subscriberCount || '0', 10),
        isVerified: false,
        channelId
      };

      console.log(`    👤 [YOUTUBE] Profile: ${profile.displayName}, ${profile.followersCount} subscribers`);
      return profile;
    } catch (err: any) {
      console.error(`    ⚠️ [YOUTUBE] Profile fetch failed:`, err.message);
      return null;
    }
  }

  /**
   * Search for videos on a channel with optional duration filter
   */
  private static async searchVideos(
    channelId: string,
    apiKey: string,
    videoType: YoutubeVideoType,
    maxResults: number
  ): Promise<any[]> {
    const allVideoIds: string[] = [];

    if (videoType === 'shorts') {
      const ids = await this.searchWithDuration(channelId, apiKey, 'short', maxResults);
      allVideoIds.push(...ids);
    } else if (videoType === 'long') {
      const ids = await this.searchWithDuration(channelId, apiKey, 'long', maxResults);
      allVideoIds.push(...ids);
    } else {
      // 'both' — fetch without duration filter
      const ids = await this.searchWithDuration(channelId, apiKey, undefined, maxResults);
      allVideoIds.push(...ids);
    }

    if (allVideoIds.length === 0) return [];

    // Fetch full video details
    const videos: any[] = [];
    for (let i = 0; i < allVideoIds.length; i += 50) {
      const batch = allVideoIds.slice(i, i + 50);
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${batch.join(',')}&key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        videos.push(...(data.items || []));
      }
    }

    return videos;
  }

  private static async searchWithDuration(
    channelId: string,
    apiKey: string,
    videoDuration: 'short' | 'long' | undefined,
    maxResults: number
  ): Promise<string[]> {
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&type=video&maxResults=${Math.min(maxResults, 50)}&order=date&key=${apiKey}`;

    if (videoDuration) {
      url += `&videoDuration=${videoDuration}`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      console.error(`    ❌ [YOUTUBE] Search failed: ${res.status} - ${text}`);
      return [];
    }

    const data = await res.json();
    return (data.items || []).map((item: any) => item.id.videoId).filter(Boolean);
  }

  /**
   * Normalize a YouTube Data API v3 video object to standard format
   */
  private static normalizeApiVideoData(
    video: any,
    account: { username: string; id: string }
  ): any {
    // Parse ISO 8601 duration (PT1H2M30S)
    let durationSeconds = 0;
    if (video.contentDetails?.duration) {
      const match = video.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        durationSeconds = (parseInt(match[1] || '0', 10) * 3600)
          + (parseInt(match[2] || '0', 10) * 60)
          + parseInt(match[3] || '0', 10);
      }
    }

    // Determine if this is a Short (<=60s) for URL format
    const isShort = durationSeconds > 0 && durationSeconds <= 60;
    const videoUrl = isShort
      ? `https://www.youtube.com/shorts/${video.id}`
      : `https://www.youtube.com/watch?v=${video.id}`;

    // Best thumbnail
    const thumbnails = video.snippet?.thumbnails || {};
    const thumbnail = thumbnails.maxres?.url
      || thumbnails.standard?.url
      || thumbnails.high?.url
      || thumbnails.medium?.url
      || thumbnails.default?.url
      || '';

    // Upload date
    let uploadTimestamp: FirebaseFirestore.Timestamp;
    if (video.snippet?.publishedAt) {
      uploadTimestamp = Timestamp.fromDate(new Date(video.snippet.publishedAt));
    } else {
      uploadTimestamp = Timestamp.now();
    }

    return {
      videoId: video.id,
      videoTitle: video.snippet?.title || 'Untitled',
      videoUrl,
      platform: 'youtube',
      thumbnail,
      accountUsername: video.snippet?.channelTitle || account.username,
      accountDisplayName: video.snippet?.channelTitle || account.username,
      uploadDate: uploadTimestamp,
      views: parseInt(video.statistics?.viewCount || '0', 10),
      likes: parseInt(video.statistics?.likeCount || '0', 10),
      comments: parseInt(video.statistics?.commentCount || '0', 10),
      shares: 0,
      saves: 0,
      caption: video.snippet?.description || '',
      duration: durationSeconds,
      channelId: video.snippet?.channelId
    };
  }
}
