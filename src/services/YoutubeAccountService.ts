import { AccountVideo } from '../types/accounts';

export interface YoutubeChannelInfo {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails?: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
    customUrl?: string;
  };
  statistics?: {
    subscriberCount?: string;
    videoCount?: string;
    viewCount?: string;
  };
}

export interface YoutubeVideoItem {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails?: {
      maxres?: { url: string };
      standard?: { url: string };
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails?: {
    duration?: string;
  };
}

/**
 * YoutubeAccountService
 * 
 * Handles YouTube channel profile fetching and Shorts video syncing
 * Uses YouTube Data API v3 via serverless endpoint
 */
class YoutubeAccountService {
  private readonly endpoint = `${window.location.origin}/api/youtube-channel`;

  /**
   * Fetch channel profile info by @handle or channel ID
   */
  async fetchChannelProfile(usernameOrHandle: string): Promise<{
    displayName: string;
    profilePicture?: string;
    followerCount: number;
    followingCount: number;
    postCount: number;
    bio: string;
    isVerified: boolean;
    channelId?: string;
  }> {
    try {
      console.log(`🔄 Fetching YouTube channel for: ${usernameOrHandle}`);

      const body = usernameOrHandle.startsWith('@') 
        ? { action: 'getChannelInfo', channelHandle: usernameOrHandle }
        : { action: 'getChannelInfo', channelId: usernameOrHandle };

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`YouTube channel fetch failed: ${res.status} ${text}`);
      }

      const { channel } = (await res.json()) as { channel: YoutubeChannelInfo };

      const thumbnailUrl = channel.snippet.thumbnails?.high?.url
        || channel.snippet.thumbnails?.medium?.url
        || channel.snippet.thumbnails?.default?.url
        || '';

      return {
        displayName: channel.snippet.title || usernameOrHandle,
        profilePicture: thumbnailUrl,
        followerCount: channel.statistics?.subscriberCount ? Number(channel.statistics.subscriberCount) : 0,
        followingCount: 0, // YouTube doesn't expose "following" count
        postCount: channel.statistics?.videoCount ? Number(channel.statistics.videoCount) : 0,
        bio: channel.snippet.description || '',
        isVerified: false, // YouTube verification not exposed in snippet
        channelId: channel.id,
      };
    } catch (error) {
      console.error('❌ Failed to fetch YouTube channel:', error);
      throw error;
    }
  }

  /**
   * Sync Shorts videos for a YouTube channel
   */
  async syncChannelShorts(channelId: string, channelTitle: string): Promise<AccountVideo[]> {
    try {
      console.log(`🔄 Fetching YouTube Shorts for channel: ${channelId}`);

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getShorts',
          channelId,
          maxResults: 50,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`YouTube Shorts fetch failed: ${res.status} ${text}`);
      }

      const { videos } = (await res.json()) as { videos: YoutubeVideoItem[] };

      const accountVideos: AccountVideo[] = videos.map((video) => {
        const thumbnail = video.snippet.thumbnails?.maxres?.url
          || video.snippet.thumbnails?.standard?.url
          || video.snippet.thumbnails?.high?.url
          || video.snippet.thumbnails?.medium?.url
          || video.snippet.thumbnails?.default?.url
          || '';

        return {
          id: `youtube_${video.id}_${Date.now()}`,
          accountId: '', // Will be set by caller
          videoId: video.id,
          url: `https://www.youtube.com/shorts/${video.id}`,
          thumbnail,
          caption: video.snippet.title || '',
          uploadDate: new Date(video.snippet.publishedAt || Date.now()),
          views: video.statistics?.viewCount ? Number(video.statistics.viewCount) : 0,
          likes: video.statistics?.likeCount ? Number(video.statistics.likeCount) : 0,
          comments: video.statistics?.commentCount ? Number(video.statistics.commentCount) : 0,
          shares: 0, // YouTube doesn't expose share count
          duration: this.parseDuration(video.contentDetails?.duration),
          isSponsored: false,
          hashtags: [],
          mentions: [],
        };
      });

      console.log(`✅ Fetched ${accountVideos.length} YouTube Shorts`);
      return accountVideos;
    } catch (error) {
      console.error('❌ Failed to sync YouTube Shorts:', error);
      throw error;
    }
  }

  /**
   * Parse ISO 8601 duration (e.g., PT1M21S) to seconds
   */
  private parseDuration(duration?: string): number {
    if (!duration) return 0;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }
}

export default new YoutubeAccountService();

