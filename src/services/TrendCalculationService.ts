import { VideoSubmission } from '../types';
import { DateFilterType } from '../components/DateRangeFilter';
import { PeriodComparisonService, Period, DateRange } from './PeriodComparisonService';

/**
 * Trend direction enum
 */
export type TrendDirection = 'up' | 'down' | 'flat';

/**
 * Metric type for trend calculation
 */
export type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'videos' | 'accounts' | 'ctr';

/**
 * Trend indicator result
 */
export interface TrendIndicator {
  direction: TrendDirection;
  percentChange: number;
  absoluteDelta: number;
  currentValue: number;
  previousValue: number;
  arrow: '↑' | '↓' | '→';
  formattedPercent: string;
  tooltip: string;
}

/**
 * Aggregated metrics for a period
 */
interface PeriodMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  videoCount: number;
  accountCount: number;
}

/**
 * Service for calculating trend indicators comparing current period to previous period.
 * Implements timezone-aware calculations with proper edge case handling.
 */
export class TrendCalculationService {

  /**
   * Calculate trend indicator for a specific metric
   */
  static calculateTrend(
    submissions: VideoSubmission[],
    metric: MetricType,
    filterType: DateFilterType,
    customRange?: DateRange,
    timezone: string = 'America/Los_Angeles'
  ): TrendIndicator {
    // Get current and previous periods
    const periodPair = PeriodComparisonService.getPeriodPair(filterType, customRange, timezone);

    // Aggregate metrics for both periods
    const currentMetrics = this.aggregateMetrics(submissions, periodPair.current, periodPair.timezone);
    const previousMetrics = this.aggregateMetrics(submissions, periodPair.previous, periodPair.timezone);

    // Debug logging
    if (metric === 'views') {
      console.log('📊 Trend Calculation Debug:', {
        metric,
        filterType,
        currentPeriod: `${periodPair.current.start.toLocaleDateString()} - ${periodPair.current.end.toLocaleDateString()}`,
        previousPeriod: `${periodPair.previous.start.toLocaleDateString()} - ${periodPair.previous.end.toLocaleDateString()}`,
        currentViews: currentMetrics.views,
        previousViews: previousMetrics.views,
        submissionsReceived: submissions.length,
        videosInCurrentPeriod: submissions.filter(v => {
          const upload = new Date(v.uploadDate || v.dateSubmitted);
          return upload <= periodPair.current.end;
        }).length,
        snapshotSample: submissions.slice(0, 3).map(v => ({
          title: v.title.substring(0, 30),
          snapshots: v.snapshots?.length || 0,
          uploadDate: new Date(v.uploadDate || v.dateSubmitted).toLocaleDateString(),
          hasSnapshotInCP: v.snapshots?.some(s => new Date(s.capturedAt) <= periodPair.current.end) || false,
          hasSnapshotInPP: v.snapshots?.some(s => new Date(s.capturedAt) <= periodPair.previous.start) || false
        }))
      });
    }

    // Extract specific metric values
    const currentValue = this.extractMetricValue(currentMetrics, metric);
    const previousValue = this.extractMetricValue(previousMetrics, metric);

    // Calculate trend
    return this.calculateTrendFromValues(
      currentValue,
      previousValue,
      metric,
      periodPair.current,
      periodPair.previous,
      timezone
    );
  }

  /**
   * Calculate trend from raw values
   */
  private static calculateTrendFromValues(
    currentValue: number,
    previousValue: number,
    _metric: MetricType,
    currentPeriod: Period,
    previousPeriod: Period,
    timezone: string
  ): TrendIndicator {
    let percentChange: number;
    let direction: TrendDirection;
    let arrow: '↑' | '↓' | '→';

    // Handle edge cases
    if (previousValue === 0 && currentValue === 0) {
      // Both periods have zero - no change
      percentChange = 0;
      direction = 'flat';
      arrow = '→';
    } else if (previousValue === 0 && currentValue > 0) {
      // Previous period had zero, current has value
      // Without snapshots, we can't tell if this is growth or just missing data
      // Show it as significant growth
      percentChange = 100;
      direction = 'up';
      arrow = '↑';
    } else if (previousValue === 0) {
      // Edge case: shouldn't happen with above logic, but guard anyway
      percentChange = 100;
      direction = 'up';
      arrow = '↑';
    } else {
      // Normal calculation - can go above 100%
      percentChange = ((currentValue - previousValue) / previousValue) * 100;
      
      const epsilon = PeriodComparisonService.getEpsilon();
      if (percentChange > epsilon) {
        direction = 'up';
        arrow = '↑';
      } else if (percentChange < -epsilon) {
        direction = 'down';
        arrow = '↓';
      } else {
        direction = 'flat';
        arrow = '→';
      }
    }

    const absoluteDelta = currentValue - previousValue;
    const formattedPercent = this.formatPercent(percentChange);

    // Build tooltip
    const tooltip = this.buildTooltip(
      currentValue,
      previousValue,
      absoluteDelta,
      percentChange,
      currentPeriod,
      previousPeriod,
      timezone
    );

    return {
      direction,
      percentChange: Math.round(percentChange * 10) / 10, // One decimal place
      absoluteDelta,
      currentValue,
      previousValue,
      arrow,
      formattedPercent,
      tooltip
    };
  }

  /**
   * Aggregate metrics for a period from video submissions
   * This calculates the TOTAL metrics of all videos at the END of the period
   */
  private static aggregateMetrics(
    submissions: VideoSubmission[],
    period: Period,
    _timezone: string
  ): PeriodMetrics {
    const metrics: PeriodMetrics = {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      videoCount: 0,
      accountCount: 0
    };

    const uniqueAccounts = new Set<string>();

    submissions.forEach(video => {
      const uploadDate = new Date(video.uploadDate || video.timestamp || video.dateSubmitted);
      
      // Only include videos that existed at the end of this period
      if (uploadDate > period.end) {
        return; // Video didn't exist yet
      }

      // Get metrics at the end of this period using snapshot data
      const metricsAtPeriodEnd = this.getVideoMetricsAtTime(video, period.end);
      
      // Only count videos where we have actual snapshot data
      // This prevents false +100% from videos without historical tracking
      if (metricsAtPeriodEnd) {
        metrics.views += metricsAtPeriodEnd.views;
        metrics.likes += metricsAtPeriodEnd.likes;
        metrics.comments += metricsAtPeriodEnd.comments;
        metrics.shares += metricsAtPeriodEnd.shares;
        
        // Count video if we have data for it
        metrics.videoCount++;
        uniqueAccounts.add(video.uploaderHandle);
      }
    });

    metrics.accountCount = uniqueAccounts.size;

    return metrics;
  }

  /**
   * Get video metrics at a specific point in time
   * Uses the SAME logic as sparklines for consistency
   */
  private static getVideoMetricsAtTime(
    video: VideoSubmission,
    targetTime: Date
  ): { views: number; likes: number; comments: number; shares: number } | null {
    const uploadDate = new Date(video.uploadDate || video.timestamp || video.dateSubmitted);
    const now = new Date();
    
    // If video was uploaded after target time, it didn't exist
    if (uploadDate > targetTime) {
      return null;
    }

    // If target time is very recent (within last 24 hours), use current metrics
    // This handles the case where snapshots haven't been captured yet for "yesterday"
    const timeSinceTarget = now.getTime() - targetTime.getTime();
    if (timeSinceTarget < (24 * 60 * 60 * 1000)) {
      return {
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0,
        shares: video.shares || 0
      };
    }

    // If no snapshots and target is old, we have no data
    if (!video.snapshots || video.snapshots.length === 0) {
      return null;
    }

    // Find the snapshot closest to (but not after) the target time
    const snapshotAtTime = video.snapshots
      .filter(s => new Date(s.capturedAt) <= targetTime)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];

    if (snapshotAtTime) {
      return {
        views: snapshotAtTime.views || 0,
        likes: snapshotAtTime.likes || 0,
        comments: snapshotAtTime.comments || 0,
        shares: snapshotAtTime.shares || 0
      };
    }

    // No snapshot before target time - use the OLDEST snapshot as baseline
    // This handles cases where video tracking started after the target date
    const oldestSnapshot = video.snapshots
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())[0];
    
    if (oldestSnapshot && uploadDate <= targetTime) {
      return {
        views: oldestSnapshot.views || 0,
        likes: oldestSnapshot.likes || 0,
        comments: oldestSnapshot.comments || 0,
        shares: oldestSnapshot.shares || 0
      };
    }

    return null;
  }


  /**
   * Extract specific metric value from aggregated metrics
   */
  private static extractMetricValue(metrics: PeriodMetrics, metric: MetricType): number {
    switch (metric) {
      case 'views':
        return metrics.views;
      case 'likes':
        return metrics.likes;
      case 'comments':
        return metrics.comments;
      case 'shares':
        return metrics.shares;
      case 'videos':
        return metrics.videoCount;
      case 'accounts':
        return metrics.accountCount;
      case 'engagement':
        // Engagement rate = (likes + comments) / views * 100
        return metrics.views > 0 
          ? ((metrics.likes + metrics.comments) / metrics.views) * 100 
          : 0;
      case 'ctr':
        // CTR would need click data - return 0 for now
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Format percent change for display
   */
  private static formatPercent(percent: number): string {
    const rounded = Math.round(percent * 10) / 10;
    const sign = rounded > 0 ? '+' : '';
    return `${sign}${rounded.toFixed(1)}%`;
  }

  /**
   * Build tooltip text
   */
  private static buildTooltip(
    currentValue: number,
    previousValue: number,
    delta: number,
    percentChange: number,
    currentPeriod: Period,
    previousPeriod: Period,
    timezone: string
  ): string {
    const formattedCurrent = this.formatNumber(currentValue);
    const formattedPrevious = this.formatNumber(previousValue);
    const formattedDelta = this.formatDelta(delta);
    const formattedPercent = this.formatPercent(percentChange);

    return `Current: ${formattedCurrent} | Previous: ${formattedPrevious} | Δ: ${formattedDelta} (${formattedPercent})\nCP: ${currentPeriod.label} • PP: ${previousPeriod.label} (${timezone})`;
  }

  /**
   * Format number for display
   */
  private static formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  }

  /**
   * Format delta for display
   */
  private static formatDelta(delta: number): string {
    const sign = delta > 0 ? '+' : '';
    return sign + this.formatNumber(Math.abs(delta));
  }

  /**
   * Calculate multiple trends at once (for efficiency)
   */
  static calculateAllTrends(
    submissions: VideoSubmission[],
    filterType: DateFilterType,
    customRange?: DateRange,
    timezone: string = 'America/Los_Angeles'
  ): Record<MetricType, TrendIndicator> {
    const metrics: MetricType[] = ['views', 'likes', 'comments', 'shares', 'engagement', 'videos', 'accounts'];
    const trends: Record<string, TrendIndicator> = {};

    metrics.forEach(metric => {
      trends[metric] = this.calculateTrend(submissions, metric, filterType, customRange, timezone);
    });

    return trends as Record<MetricType, TrendIndicator>;
  }

  /**
   * Get 7-day trend data for a video's views (for mini sparkline charts)
   * Legacy method kept for individual video trend visualization
   */
  static getViewsTrend(video: VideoSubmission): number[] {
    if (!video.snapshots || video.snapshots.length === 0) {
      return [video.views];
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    const recentSnapshots = video.snapshots
      .filter(snapshot => new Date(snapshot.capturedAt) >= sevenDaysAgo)
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());

    if (recentSnapshots.length === 0) {
      return [video.views];
    }

    const trendData: number[] = [];
    
    if (recentSnapshots.length === 1) {
      const snapshotValue = recentSnapshots[0].views;
      if (video.views !== snapshotValue) {
        trendData.push(snapshotValue);
        trendData.push(video.views);
      } else {
        return [video.views];
      }
    } else {
      recentSnapshots.forEach(snapshot => {
        trendData.push(snapshot.views);
      });
      
      const lastSnapshot = recentSnapshots[recentSnapshots.length - 1];
      if (lastSnapshot.views !== video.views) {
        trendData.push(video.views);
      }
    }

    return trendData;
  }

  /**
   * Get 7-day trend data for a video's likes (for mini sparkline charts)
   * Legacy method kept for individual video trend visualization
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
      const snapshotValue = recentSnapshots[0].likes;
      if (video.likes !== snapshotValue) {
        trendData.push(snapshotValue);
        trendData.push(video.likes);
      } else {
        return [video.likes];
      }
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
   * Get trend percentage change for legacy compatibility
   */
  static getTrendPercentage(trendData: number[]): number {
    if (trendData.length < 2) return 0;
    
    const firstValue = trendData[0];
    const lastValue = trendData[trendData.length - 1];
    
    if (firstValue === 0) return lastValue > 0 ? 100 : 0;
    
    return ((lastValue - firstValue) / firstValue) * 100;
  }

  /**
   * Get trend direction for legacy compatibility
   */
  static getTrendDirection(trendData: number[]): 'up' | 'down' | 'flat' {
    if (trendData.length < 2) return 'flat';
    
    const firstValue = trendData[0];
    const lastValue = trendData[trendData.length - 1];
    
    if (lastValue > firstValue) return 'up';
    if (lastValue < firstValue) return 'down';
    return 'flat';
  }
}
