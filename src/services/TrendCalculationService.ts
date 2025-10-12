import { VideoSubmission } from '../types';

export class TrendCalculationService {
  /**
   * Calculate 7-day trend data for a video's views (showing daily growth, not cumulative)
   */
  static getViewsTrend(video: VideoSubmission): number[] {
    if (!video.snapshots || video.snapshots.length === 0) {
      // If no historical data, return single point (flat line)
      return [video.views];
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    // Filter snapshots from the last 7 days and sort by date
    const recentSnapshots = video.snapshots
      .filter(snapshot => new Date(snapshot.capturedAt) >= sevenDaysAgo)
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());

    if (recentSnapshots.length === 0) {
      // No recent snapshots, return single point (flat line)
      return [video.views];
    }

    // Calculate daily growth (difference from previous snapshot)
    const trendData: number[] = [];
    
    if (recentSnapshots.length === 1) {
      const snapshotValue = recentSnapshots[0].views;
      // Only show growth if there's actual change
      if (video.views !== snapshotValue) {
        trendData.push(snapshotValue); // First point is baseline
        trendData.push(Math.max(0, video.views - snapshotValue)); // Second point is growth
      } else {
        // No change, return single point (flat line)
        return [video.views];
      }
    } else {
      // First snapshot shows absolute value (baseline)
      trendData.push(recentSnapshots[0].views);
      
      // Subsequent snapshots show growth (difference from previous)
      for (let i = 1; i < recentSnapshots.length; i++) {
        const growth = Math.max(0, recentSnapshots[i].views - recentSnapshots[i - 1].views);
        trendData.push(growth);
      }
      
      // Add current value growth if it's different from the last snapshot
      const lastSnapshot = recentSnapshots[recentSnapshots.length - 1];
      if (lastSnapshot.views !== video.views) {
        const finalGrowth = Math.max(0, video.views - lastSnapshot.views);
        trendData.push(finalGrowth);
      }
    }

    return trendData;
  }

  /**
   * Calculate 7-day trend data for a video's likes (showing daily growth, not cumulative)
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

    // Calculate daily growth (difference from previous snapshot)
    const trendData: number[] = [];
    
    if (recentSnapshots.length === 1) {
      const snapshotValue = recentSnapshots[0].likes;
      // Only show growth if there's actual change
      if (video.likes !== snapshotValue) {
        trendData.push(snapshotValue); // First point is baseline
        trendData.push(Math.max(0, video.likes - snapshotValue)); // Second point is growth
      } else {
        return [video.likes];
      }
    } else {
      // First snapshot shows absolute value (baseline)
      trendData.push(recentSnapshots[0].likes);
      
      // Subsequent snapshots show growth (difference from previous)
      for (let i = 1; i < recentSnapshots.length; i++) {
        const growth = Math.max(0, recentSnapshots[i].likes - recentSnapshots[i - 1].likes);
        trendData.push(growth);
      }
      
      const lastSnapshot = recentSnapshots[recentSnapshots.length - 1];
      if (lastSnapshot.likes !== video.likes) {
        const finalGrowth = Math.max(0, video.likes - lastSnapshot.likes);
        trendData.push(finalGrowth);
      }
    }

    return trendData;
  }

  /**
   * Calculate trend percentage change (works with daily growth data)
   * First value is baseline, subsequent values are daily growth
   */
  static getTrendPercentage(trendData: number[]): number {
    if (trendData.length < 2) return 0;
    
    const baseline = trendData[0];
    // Sum all growth values (excluding baseline)
    const totalGrowth = trendData.slice(1).reduce((sum, val) => sum + val, 0);
    
    if (baseline === 0) return totalGrowth > 0 ? 100 : 0;
    
    return (totalGrowth / baseline) * 100;
  }

  /**
   * Get trend direction as string (works with daily growth data)
   * Looks at the most recent growth values to determine direction
   */
  static getTrendDirection(trendData: number[]): 'up' | 'down' | 'flat' {
    if (trendData.length < 2) return 'flat';
    
    // Sum all growth values (excluding baseline)
    const totalGrowth = trendData.slice(1).reduce((sum, val) => sum + val, 0);
    
    if (totalGrowth > 0) return 'up';
    if (totalGrowth < 0) return 'down';
    return 'flat';
  }

}
