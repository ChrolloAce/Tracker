export interface YoutubeApiItem {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails?: {
      maxres?: { url: string };
      standard?: { url: string };
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
    publishedAt: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails?: {
    duration?: string; // ISO 8601 e.g. PT1M21S
  };
}

import { InstagramVideoData } from '../types';

class YoutubeApiService {
  private extractVideoId(url: string): string | null {
    try {
      // Shorts URL
      const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
      if (shortsMatch) return shortsMatch[1];
      // Watch URL
      const u = new URL(url);
      if (u.hostname.includes('youtube.com')) {
        const v = u.searchParams.get('v');
        if (v) return v;
      }
      // youtu.be short links
      const youtuMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (youtuMatch) return youtuMatch[1];
      return null;
    } catch {
      return null;
    }
  }

  private iso8601DurationToSeconds(duration?: string): number {
    if (!duration) return 0;
    // Simple parser: PT#H#M#S
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  async fetchVideoData(url: string): Promise<InstagramVideoData> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Could not parse YouTube video ID from URL');
    }

    const endpoint = `${window.location.origin}/api/youtube-video`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`YouTube API error: ${res.status} ${text}`);
    }
    const { item } = (await res.json()) as { item: YoutubeApiItem };

    const thumb = item.snippet.thumbnails?.maxres?.url
      || item.snippet.thumbnails?.standard?.url
      || item.snippet.thumbnails?.high?.url
      || item.snippet.thumbnails?.medium?.url
      || item.snippet.thumbnails?.default?.url
      || '';

    const data: InstagramVideoData = {
      id: item.id,
      thumbnail_url: thumb,
      caption: item.snippet.title || '',
      username: item.snippet.channelTitle || 'YouTube',
      like_count: item.statistics?.likeCount ? Number(item.statistics.likeCount) : 0,
      comment_count: item.statistics?.commentCount ? Number(item.statistics.commentCount) : 0,
      view_count: item.statistics?.viewCount ? Number(item.statistics.viewCount) : 0,
      timestamp: item.snippet.publishedAt || new Date().toISOString(),
    };

    // Attach duration as extra field if present
    (data as any).duration = this.iso8601DurationToSeconds(item.contentDetails?.duration);

    return data;
  }
}

export default new YoutubeApiService();
