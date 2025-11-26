import { AccountVideo } from '../types/accounts';

export interface VideoOutlier {
  videoId: string;
  metric: 'views' | 'likes' | 'comments' | 'shares' | 'engagement';
  value: number;
  accountAverage: number;
  percentageDiff: number; // How much above/below average (e.g., 250 means 250% of average)
  zscore: number; // Standard deviations from mean
  isTopPerformer: boolean; // True if significantly above average
}

export interface AccountOutliers {
  accountId: string;
  accountUsername: string;
  totalVideos: number;
  averages: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagement: number;
  };
  topPerformers: VideoOutlier[];
  underperformers: VideoOutlier[];
  lastCalculated: Date;
}

/**
 * OutlierDetectionService
 * 
 * Identifies videos that perform significantly better or worse than the account's average.
 * Uses statistical methods (z-score) to detect outliers.
 */
class OutlierDetectionService {
  
  /**
   * Calculate outliers for an account's videos
   * @param videos - Array of account videos
   * @param accountId - Account ID
   * @param accountUsername - Account username
   * @param threshold - Z-score threshold for outlier detection (default: 2.0)
   */
  static detectOutliers(
    videos: AccountVideo[],
    accountId: string,
    accountUsername: string,
    threshold: number = 2.0
  ): AccountOutliers {
    
    if (videos.length < 3) {
      // Need at least 3 videos for meaningful outlier detection
      return {
        accountId,
        accountUsername,
        totalVideos: videos.length,
        averages: { views: 0, likes: 0, comments: 0, shares: 0, engagement: 0 },
        topPerformers: [],
        underperformers: [],
        lastCalculated: new Date()
      };
    }

    // Calculate averages and standard deviations
    const stats = this.calculateStats(videos);
    
    // Detect outliers for each metric
    const allOutliers: VideoOutlier[] = [];

    videos.forEach(video => {
      const views = video.views || video.viewsCount || video.playCount || 0;
      const likes = video.likes || video.likesCount || 0;
      const comments = video.comments || video.commentsCount || 0;
      const shares = video.shares || video.sharesCount || 0;
      const engagement = views > 0 ? ((likes + comments + shares) / views) * 100 : 0;

      // Check each metric for outliers
      const metrics = [
        { name: 'views' as const, value: views, avg: stats.views.mean, std: stats.views.std },
        { name: 'likes' as const, value: likes, avg: stats.likes.mean, std: stats.likes.std },
        { name: 'comments' as const, value: comments, avg: stats.comments.mean, std: stats.comments.std },
        { name: 'shares' as const, value: shares, avg: stats.shares.mean, std: stats.shares.std },
        { name: 'engagement' as const, value: engagement, avg: stats.engagement.mean, std: stats.engagement.std },
      ];

      metrics.forEach(metric => {
        if (metric.std === 0) return; // Skip if no variation
        
        const zscore = (metric.value - metric.avg) / metric.std;
        
        if (Math.abs(zscore) >= threshold) {
          const percentageDiff = metric.avg > 0 ? (metric.value / metric.avg) * 100 : 0;
          
          allOutliers.push({
            videoId: video.videoId || video.id || '',
            metric: metric.name,
            value: metric.value,
            accountAverage: metric.avg,
            percentageDiff,
            zscore,
            isTopPerformer: zscore > 0
          });
        }
      });
    });

    // Sort by absolute z-score (most significant outliers first)
    allOutliers.sort((a, b) => Math.abs(b.zscore) - Math.abs(a.zscore));

    // Separate top performers and underperformers
    const topPerformers = allOutliers.filter(o => o.isTopPerformer).slice(0, 10); // Top 10
    const underperformers = allOutliers.filter(o => !o.isTopPerformer).slice(0, 10); // Bottom 10

    return {
      accountId,
      accountUsername,
      totalVideos: videos.length,
      averages: {
        views: Math.round(stats.views.mean),
        likes: Math.round(stats.likes.mean),
        comments: Math.round(stats.comments.mean),
        shares: Math.round(stats.shares.mean),
        engagement: Math.round(stats.engagement.mean * 100) / 100
      },
      topPerformers,
      underperformers,
      lastCalculated: new Date()
    };
  }

  /**
   * Calculate mean and standard deviation for video metrics
   */
  private static calculateStats(videos: AccountVideo[]) {
    const getValues = (key: 'views' | 'likes' | 'comments' | 'shares') => {
      return videos.map(v => {
        switch (key) {
          case 'views': return v.views || v.viewsCount || v.playsCount || 0;
          case 'likes': return v.likes || v.likesCount || 0;
          case 'comments': return v.comments || v.commentsCount || 0;
          case 'shares': return v.shares || v.sharesCount || 0;
        }
      });
    };

    const engagementValues = videos.map(v => {
      const views = v.views || v.viewsCount || v.playsCount || 0;
      const likes = v.likes || v.likesCount || 0;
      const comments = v.comments || v.commentsCount || 0;
      const shares = v.shares || v.sharesCount || 0;
      return views > 0 ? ((likes + comments + shares) / views) * 100 : 0;
    });

    return {
      views: this.getMeanAndStd(getValues('views')),
      likes: this.getMeanAndStd(getValues('likes')),
      comments: this.getMeanAndStd(getValues('comments')),
      shares: this.getMeanAndStd(getValues('shares')),
      engagement: this.getMeanAndStd(engagementValues)
    };
  }

  /**
   * Calculate mean and standard deviation
   */
  private static getMeanAndStd(values: number[]): { mean: number; std: number } {
    if (values.length === 0) return { mean: 0, std: 0 };

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);

    return { mean, std };
  }

  /**
   * Get a summary message for outliers
   */
  static getOutlierSummary(outliers: AccountOutliers): string {
    const topCount = outliers.topPerformers.length;
    const bottomCount = outliers.underperformers.length;

    if (topCount === 0 && bottomCount === 0) {
      return 'All videos are performing consistently with account averages.';
    }

    const messages: string[] = [];
    
    if (topCount > 0) {
      messages.push(`${topCount} video${topCount > 1 ? 's' : ''} performing significantly above average`);
    }
    
    if (bottomCount > 0) {
      messages.push(`${bottomCount} video${bottomCount > 1 ? 's' : ''} performing below average`);
    }

    return messages.join(' | ');
  }
}

export default OutlierDetectionService;

