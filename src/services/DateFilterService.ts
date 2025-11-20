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
  static getDateRange(filterType: DateFilterType, customRange?: DateRange, submissions?: VideoSubmission[]): DateRange {
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
          startDate: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000), // 6 days back + today = 7 days
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) // End of today
        };
        
      case 'last14days':
        return {
          startDate: new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000), // 13 days back + today = 14 days
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
        
      case 'last30days':
        return {
          startDate: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000), // 29 days back + today = 30 days
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
        
      case 'last90days':
        return {
          startDate: new Date(today.getTime() - 89 * 24 * 60 * 60 * 1000), // 89 days back + today = 90 days
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
        {
          const ytdStart = new Date(now.getFullYear(), 0, 1);
          ytdStart.setHours(0, 0, 0, 0);
          const ytdEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
          
          // If we have submissions, check if any videos exist before YTD start
          // If not, use earliest video date as start to avoid empty chart
          if (submissions && submissions.length > 0) {
            const dates = submissions
              .map(v => {
                const uploadDate = v.uploadDate || v.dateSubmitted || v.timestamp;
                return uploadDate ? new Date(uploadDate).getTime() : null;
              })
              .filter((d): d is number => d !== null);
            
            if (dates.length > 0) {
              const earliestTime = Math.min(...dates);
              const earliestDate = new Date(earliestTime);
              earliestDate.setHours(0, 0, 0, 0);
              
              // If earliest video is after YTD start, use earliest video date
              // This prevents showing empty months at the beginning of the year
              const actualStart = earliestDate > ytdStart ? earliestDate : ytdStart;
              
              console.log(`📊 [YTD] Date range from ${actualStart.toLocaleDateString()} to ${ytdEnd.toLocaleDateString()}`);
              
              return {
                startDate: actualStart,
                endDate: ytdEnd
              };
            }
          }
          
          return {
            startDate: ytdStart,
            endDate: ytdEnd
          };
        }
        
      case 'custom':
        if (customRange) {
          // Normalize custom range to include full days
          const startDate = new Date(customRange.startDate);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(customRange.endDate);
          endDate.setHours(23, 59, 59, 999);
          return { startDate, endDate };
        }
        // Fallback to all time if no custom range provided
        return {
          startDate: new Date(2020, 0, 1), // Far past date
          endDate: new Date(2030, 11, 31)  // Far future date
        };
        
      case 'all':
      default:
        // For 'all' time: find the earliest video upload date
        if (submissions && submissions.length > 0) {
          const dates = submissions
            .map(v => {
              const uploadDate = v.uploadDate || v.dateSubmitted || v.timestamp;
              return uploadDate ? new Date(uploadDate).getTime() : null;
            })
            .filter((d): d is number => d !== null);
          
          if (dates.length > 0) {
            const earliestTime = Math.min(...dates);
            const startDate = new Date(earliestTime);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
            
            console.log(`📊 [ALL TIME] Date range from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} based on ${submissions.length} videos`);
            
            return {
              startDate,
              endDate
            };
          }
        }
        // Fallback if no submissions provided - use last year as a reasonable default
        const fallbackEnd = new Date();
        fallbackEnd.setHours(23, 59, 59, 999);
        const fallbackStart = new Date(fallbackEnd);
        fallbackStart.setFullYear(fallbackEnd.getFullYear() - 1);
        fallbackStart.setHours(0, 0, 0, 0);
        
        console.warn(`⚠️ [ALL TIME] No submissions provided, using fallback: ${fallbackStart.toLocaleDateString()} to ${fallbackEnd.toLocaleDateString()}`);
        
        return {
          startDate: fallbackStart,
          endDate: fallbackEnd
        };
    }
  }

  /**
   * Filter video submissions by date range
   */
  static filterVideosByDateRange(
    videos: VideoSubmission[], 
    filterType: DateFilterType, 
    customRange?: DateRange,
    strictMode: boolean = true // Strict mode: only filter by upload date
  ): VideoSubmission[] {
    if (filterType === 'all') {
      return videos;
    }

    const dateRange = this.getDateRange(filterType, customRange);
    console.log(`🗓️ Filtering ${videos.length} videos for period: ${this.getPeriodDescription(filterType, customRange)}`);
    console.log(`📅 Date range: ${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`);
    
    const filteredVideos = videos.filter(video => {
      const uploadDate = video.uploadDate
        ? new Date(video.uploadDate)
        : video.timestamp 
        ? new Date(video.timestamp)
        : video.dateSubmitted 
        ? new Date(video.dateSubmitted)
        : new Date();

      // Strict mode (for KPI cards): Only filter by upload date
      if (strictMode) {
        const isInRange = uploadDate >= dateRange.startDate && uploadDate <= dateRange.endDate;
        
        if (videos.length <= 10) { // Only log for small datasets to avoid spam
          console.log(`📹 Video "${video.title.substring(0, 30)}..." uploaded ${uploadDate.toLocaleDateString()} - ${isInRange ? '✅ Included' : '❌ Excluded'}`);
        }
        
        return isInRange;
      }
      
      // Non-strict mode: Video is in range if uploaded OR has snapshots in period
      const uploadedInRange = uploadDate >= dateRange.startDate && uploadDate <= dateRange.endDate;
      
      // Check if video has any NON-INITIAL snapshots within the date range
      // Initial snapshots don't count towards date filtering (they're just baseline data)
      const hasSnapshotsInRange = video.snapshots && video.snapshots.some(snapshot => {
        // Exclude initial snapshots from date filtering
        if (snapshot.isInitialSnapshot) return false;
        const snapshotDate = new Date(snapshot.capturedAt);
        return snapshotDate >= dateRange.startDate && snapshotDate <= dateRange.endDate;
      });
      
      const isInRange = uploadedInRange || hasSnapshotsInRange;
      
      if (videos.length <= 10) { // Only log for small datasets to avoid spam
        console.log(`📹 Video "${video.title.substring(0, 30)}..." uploaded ${uploadDate.toLocaleDateString()} - ${isInRange ? '✅ Included' : '❌ Excluded'} ${hasSnapshotsInRange ? '(has snapshots in range)' : ''}`);
      }

      return isInRange;
    });

    console.log(`✅ Filtered to ${filteredVideos.length} videos (strict mode: ${strictMode})`);
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
