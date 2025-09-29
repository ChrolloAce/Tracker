import { VideoSubmission, VideoSnapshot } from '../types';

export class TrendCalculationService {
  /**
   * Calculate 7-day trend data for a video's views
   */
  static getViewsTrend(video: VideoSubmission): number[] {
    if (!video.snapshots || video.snapshots.length === 0) {
      // If no historical data, generate sample trend for demo
      return this.generateSampleTrend(video.views);
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    // Filter snapshots from the last 7 days and sort by date
    const recentSnapshots = video.snapshots
      .filter(snapshot => new Date(snapshot.capturedAt) >= sevenDaysAgo)
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());

    if (recentSnapshots.length === 0) {
      return [video.views];
    }

    // If we have fewer than 7 data points, fill in with the earliest available data
    const trendData: number[] = [];
    
    if (recentSnapshots.length === 1) {
      // Only one snapshot, show growth from that point to current
      trendData.push(recentSnapshots[0].views);
      trendData.push(video.views);
    } else {
      // Use all available snapshots
      recentSnapshots.forEach(snapshot => {
        trendData.push(snapshot.views);
      });
      
      // Add current value if it's different from the last snapshot
      const lastSnapshot = recentSnapshots[recentSnapshots.length - 1];
      if (lastSnapshot.views !== video.views) {
        trendData.push(video.views);
      }
    }

    return trendData;
  }

  /**
   * Calculate 7-day trend data for a video's likes
   */
  static getLikesTrend(video: VideoSubmission): number[] {
    if (!video.snapshots || video.snapshots.length === 0) {
      return [video.likes];
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    const recentSnapshots = video.snapshots
      .filter(snapshot => new Date(snapshot.capturedAt) >= sevenDaysAgo)
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());

    if (recentSnapshots.length === 0) {
      return [video.likes];
    }

    const trendData: number[] = [];
    
    if (recentSnapshots.length === 1) {
      trendData.push(recentSnapshots[0].likes);
      trendData.push(video.likes);
    } else {
      recentSnapshots.forEach(snapshot => {
        trendData.push(snapshot.likes);
      });
      
      const lastSnapshot = recentSnapshots[recentSnapshots.length - 1];
      if (lastSnapshot.likes !== video.likes) {
        trendData.push(video.likes);
      }
    }

    return trendData;
  }

  /**
   * Calculate trend percentage change
   */
  static getTrendPercentage(trendData: number[]): number {
    if (trendData.length < 2) return 0;
    
    const firstValue = trendData[0];
    const lastValue = trendData[trendData.length - 1];
    
    if (firstValue === 0) return lastValue > 0 ? 100 : 0;
    
    return ((lastValue - firstValue) / firstValue) * 100;
  }

  /**
   * Get trend direction as string
   */
  static getTrendDirection(trendData: number[]): 'up' | 'down' | 'flat' {
    if (trendData.length < 2) return 'flat';
    
    const firstValue = trendData[0];
    const lastValue = trendData[trendData.length - 1];
    
    if (lastValue > firstValue) return 'up';
    if (lastValue < firstValue) return 'down';
    return 'flat';
  }

  /**
   * Generate sample trend data for videos without snapshots (for demo purposes)
   */
  static generateSampleTrend(baseValue: number): number[] {
    const points = 7;
    const data: number[] = [];
    
    // Generate some realistic variation
    const variation = baseValue * 0.1; // 10% variation
    const trend = (Math.random() - 0.5) * 2; // Random trend direction
    
    for (let i = 0; i < points; i++) {
      const randomVariation = (Math.random() - 0.5) * variation;
      const trendValue = (trend * variation * i) / points;
      const value = Math.max(0, Math.round(baseValue + trendValue + randomVariation));
      data.push(value);
    }
    
    return data;
  }
}
