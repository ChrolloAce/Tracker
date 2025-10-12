import { VideoSubmission } from '../types';
import { DateFilterType } from '../components/DateRangeFilter';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

class DateFilterService {
  /**
   * Get date range based on filter type
   */
  static getDateRange(filterType: DateFilterType, customRange?: DateRange): DateRange {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filterType) {
      case 'today':
        return {
          startDate: today,
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) // End of today
        };
        
      case 'yesterday': {
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return {
          startDate: yesterday,
          endDate: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      }
        
      case 'last7days':
        return {
          startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) // End of today
        };
        
      case 'last14days':
        return {
          startDate: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000),
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
        
      case 'last30days':
        return {
          startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
        
      case 'last90days':
        return {
          startDate: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
        
      case 'mtd': // Month to Date
        return {
          startDate: new Date(now.getFullYear(), now.getMonth(), 1),
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
        
      case 'lastmonth': { // Last Month
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        lastMonthEnd.setHours(23, 59, 59, 999);
        return {
          startDate: lastMonthStart,
          endDate: lastMonthEnd
        };
      }
        
      case 'ytd': // Year to Date
        return {
          startDate: new Date(now.getFullYear(), 0, 1),
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
        
      case 'custom':
        if (customRange) {
          return customRange;
        }
        // Fallback to all time if no custom range provided
        return {
          startDate: new Date(2020, 0, 1), // Far past date
          endDate: new Date(2030, 11, 31)  // Far future date
        };
        
      case 'all':
      default:
        return {
          startDate: new Date(2020, 0, 1), // Far past date
          endDate: new Date(2030, 11, 31)  // Far future date
        };
    }
  }

  /**
   * Filter video submissions by date range
   */
  static filterVideosByDateRange(
    videos: VideoSubmission[], 
    filterType: DateFilterType, 
    customRange?: DateRange
  ): VideoSubmission[] {
    if (filterType === 'all') {
      return videos;
    }

    const dateRange = this.getDateRange(filterType, customRange);
    console.log(`🗓️ Filtering ${videos.length} videos for period: ${this.getPeriodDescription(filterType, customRange)}`);
    console.log(`📅 Date range: ${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`);
    
    const filteredVideos = videos.filter(video => {
      // Filter ONLY by upload date (when video was posted on the platform)
      // NOT by refresh date or date added
      const uploadDate = video.uploadDate
        ? new Date(video.uploadDate)
        : video.timestamp 
        ? new Date(video.timestamp)
        : video.dateSubmitted 
        ? new Date(video.dateSubmitted)
        : new Date();

      // Video is in range if uploaded during the period
      const isInRange = uploadDate >= dateRange.startDate && uploadDate <= dateRange.endDate;
      
      if (videos.length <= 10) { // Only log for small datasets to avoid spam
        console.log(`📹 Video "${video.title.substring(0, 30)}..." uploaded ${uploadDate.toLocaleDateString()} - ${isInRange ? '✅ Included' : '❌ Excluded'}`);
      }

      return isInRange;
    });

    console.log(`✅ Filtered to ${filteredVideos.length} videos based on upload date`);
    return filteredVideos;
  }

  /**
   * Calculate analytics for filtered videos using snapshot-based growth
   */
  static calculateFilteredAnalytics(filteredVideos: VideoSubmission[], filterType: DateFilterType, customRange?: DateRange) {
    if (filteredVideos.length === 0) {
      return {
        totalVideos: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        avgViews: 0,
        avgLikes: 0,
        avgEngagementRate: 0,
        instagramCount: 0,
        tiktokCount: 0,
        growthBased: false
      };
    }

    // If showing "All Time", use current totals
    if (filterType === 'all') {
      const totalViews = filteredVideos.reduce((sum, video) => sum + (video.views || 0), 0);
      const totalLikes = filteredVideos.reduce((sum, video) => sum + (video.likes || 0), 0);
      const totalComments = filteredVideos.reduce((sum, video) => sum + (video.comments || 0), 0);
      const totalShares = filteredVideos.reduce((sum, video) => sum + (video.shares || 0), 0);
      
      const instagramCount = filteredVideos.filter(video => video.platform === 'instagram').length;
      const tiktokCount = filteredVideos.filter(video => video.platform === 'tiktok').length;
      
      const avgViews = Math.round(totalViews / filteredVideos.length);
      const avgLikes = Math.round(totalLikes / filteredVideos.length);
      
      const totalEngagements = totalLikes + totalComments + totalShares;
      const avgEngagementRate = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;

      return {
        totalVideos: filteredVideos.length,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        avgViews,
        avgLikes,
        avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
        instagramCount,
        tiktokCount,
        growthBased: false
      };
    }

    // For time-based filters, show current totals for videos in the date range
    // This shows the total performance of videos uploaded during this period
    const totalViews = filteredVideos.reduce((sum, video) => sum + (video.views || 0), 0);
    const totalLikes = filteredVideos.reduce((sum, video) => sum + (video.likes || 0), 0);
    const totalComments = filteredVideos.reduce((sum, video) => sum + (video.comments || 0), 0);
    const totalShares = filteredVideos.reduce((sum, video) => sum + (video.shares || 0), 0);
    
    const instagramCount = filteredVideos.filter(video => video.platform === 'instagram').length;
    const tiktokCount = filteredVideos.filter(video => video.platform === 'tiktok').length;
    
    const avgViews = filteredVideos.length > 0 ? Math.round(totalViews / filteredVideos.length) : 0;
    const avgLikes = filteredVideos.length > 0 ? Math.round(totalLikes / filteredVideos.length) : 0;
    
    const totalEngagements = totalLikes + totalComments + totalShares;
    const avgEngagementRate = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;

    console.log(`📊 Analytics calculated for ${this.getPeriodDescription(filterType, customRange)}:`, {
      totalVideos: filteredVideos.length,
      totalViews,
      totalLikes,
      totalComments,
      showingCurrentTotals: true
    });

    return {
      totalVideos: filteredVideos.length,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      avgViews,
      avgLikes,
      avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
      instagramCount,
      tiktokCount,
      growthBased: false // Changed to false - showing current totals, not growth
    };
  }

  /**
   * Get period description for display
   */
  static getPeriodDescription(filterType: DateFilterType, customRange?: DateRange): string {
    switch (filterType) {
      case 'last7days':
        return 'Last 7 Days';
      case 'last30days':
        return 'Last 30 Days';
      case 'last90days':
        return 'Last 90 Days';
      case 'mtd':
        return 'Month to Date';
      case 'ytd':
        return 'Year to Date';
      case 'custom':
        if (customRange) {
          return `${customRange.startDate.toLocaleDateString()} - ${customRange.endDate.toLocaleDateString()}`;
        }
        return 'Custom Range';
      case 'all':
      default:
        return 'All Time';
    }
  }
}

export default DateFilterService;
