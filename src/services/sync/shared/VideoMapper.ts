import { AccountVideo } from '../../../types/accounts';

/**
 * VideoMapper
 * 
 * Purpose: Transform platform-specific video data to common VideoSubmission format
 * Responsibilities:
 * - Normalize video data across platforms
 * - Extract common fields (views, likes, comments, etc.)
 * - Handle platform-specific quirks
 */
export class VideoMapper {
  
  /**
   * Create a deterministic video ID
   * Format: {platform}_{accountId}_{videoId}
   */
  static createDeterministicVideoId(
    platform: string,
    accountId: string,
    videoId: string
  ): string {
    return `${platform}_${accountId}_${videoId}`;
  }
  
  /**
   * Normalize video data to common format
   * This is a helper that can be extended for platform-specific mapping
   */
  static normalizeVideoData(rawData: any, platform: string): Partial<AccountVideo> {
    // Basic normalization - can be extended by platform-specific mappers
    return {
      platform: platform as 'instagram' | 'tiktok' | 'youtube' | 'twitter',
      views: this.extractViews(rawData, platform),
      likes: this.extractLikes(rawData, platform),
      comments: this.extractComments(rawData, platform),
      shares: this.extractShares(rawData, platform),
      uploadDate: this.extractUploadDate(rawData, platform),
    };
  }
  
  private static extractViews(data: any, platform: string): number {
    if (platform === 'instagram') {
      return data.play_count || data.view_count || 0;
    }
    if (platform === 'tiktok') {
      return data.playCount || data.views || 0;
    }
    if (platform === 'youtube') {
      return data.viewCount || 0;
    }
    if (platform === 'twitter') {
      return data.viewCount || 0;
    }
    return 0;
  }
  
  private static extractLikes(data: any, platform: string): number {
    if (platform === 'instagram') {
      return data.like_count || 0;
    }
    if (platform === 'tiktok') {
      return data.diggCount || data.likes || 0;
    }
    if (platform === 'youtube') {
      return data.likeCount || 0;
    }
    if (platform === 'twitter') {
      return data.likes || 0;
    }
    return 0;
  }
  
  private static extractComments(data: any, platform: string): number {
    if (platform === 'instagram') {
      return data.comment_count || 0;
    }
    if (platform === 'tiktok') {
      return data.commentCount || 0;
    }
    if (platform === 'youtube') {
      return data.commentCount || 0;
    }
    if (platform === 'twitter') {
      return data.replies || 0;
    }
    return 0;
  }
  
  private static extractShares(data: any, platform: string): number {
    if (platform === 'instagram') {
      return 0; // Instagram doesn't provide share count
    }
    if (platform === 'tiktok') {
      return data.shareCount || 0;
    }
    if (platform === 'youtube') {
      return 0; // YouTube doesn't provide share count in API
    }
    if (platform === 'twitter') {
      return data.retweets || 0;
    }
    return 0;
  }
  
  private static extractUploadDate(data: any, platform: string): Date | undefined {
    let timestamp: number | string | undefined;
    
    if (platform === 'instagram') {
      timestamp = data.taken_at || data.timestamp;
    } else if (platform === 'tiktok') {
      timestamp = data.createTime || data.timestamp;
    } else if (platform === 'youtube') {
      timestamp = data.publishedAt;
    } else if (platform === 'twitter') {
      timestamp = data.timestamp;
    }
    
    if (!timestamp) return undefined;
    
    // Handle both Unix timestamps (numbers) and ISO strings
    if (typeof timestamp === 'number') {
      return new Date(timestamp * 1000); // Unix timestamp to milliseconds
    }
    
    return new Date(timestamp);
  }
}

