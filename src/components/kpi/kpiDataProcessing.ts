import { VideoSubmission } from '../../types';
import DataAggregationService, { IntervalType, TimeInterval } from '../../services/DataAggregationService';
import { DateFilterType } from '../DateRangeFilter';

/**
 * KPI Data Processing
 * Handles sparkline generation and metric calculations
 */

interface SparklineDataPoint {
  value: number;
  timestamp: number;
  interval: TimeInterval;
  ppValue?: number;
}

interface SparklineResult {
  data: SparklineDataPoint[];
  intervalType: IntervalType;
}

export const generateSparklineData = (
  metric: 'views' | 'likes' | 'comments' | 'shares' | 'videos' | 'accounts',
  submissions: VideoSubmission[],
  allSubmissions: VideoSubmission[] | undefined,
  dateRangeStart: Date | null,
  dateRangeEnd: Date,
  dateFilter: DateFilterType,
  granularity: IntervalType
): SparklineResult => {
  // Calculate the actual date range
  let actualStartDate: Date;
  let actualEndDate: Date = new Date();
  
  if (dateRangeStart) {
    actualStartDate = new Date(dateRangeStart);
    actualEndDate = new Date(dateRangeEnd);
  } else {
    // For 'all' time filter, find the earliest date from data
    // If no data, default to 30 days
    let minTime = new Date().getTime();
    let hasData = false;
    
    if (submissions && submissions.length > 0) {
      submissions.forEach(s => {
        const uploadTime = new Date(s.uploadDate || s.dateSubmitted).getTime();
        if (!isNaN(uploadTime) && uploadTime < minTime) {
          minTime = uploadTime;
          hasData = true;
        }
        if (s.snapshots) {
          s.snapshots.forEach(sn => {
            const snTime = new Date(sn.capturedAt).getTime();
            if (!isNaN(snTime) && snTime < minTime) {
              minTime = snTime;
              hasData = true;
            }
          });
        }
      });
    }

    if (hasData) {
      actualStartDate = new Date(minTime);
    } else {
    actualStartDate = new Date();
    actualStartDate.setDate(actualStartDate.getDate() - 30);
    }
  }
  
  // Use the granularity prop
  const intervalType = granularity as IntervalType;
  
  // Generate intervals for current period (CP)
  const intervals = DataAggregationService.generateIntervals(
    { startDate: actualStartDate, endDate: actualEndDate },
    intervalType
  );
  
  // Generate intervals for previous period (PP) - same length as CP
  let ppIntervals: typeof intervals = [];
  
  if (dateRangeStart && dateFilter !== 'all') {
    const periodLength = actualEndDate.getTime() - actualStartDate.getTime();
    const tempPPEndDate = new Date(actualStartDate.getTime() - 1);
    const tempPPStartDate = new Date(tempPPEndDate.getTime() - periodLength);
    
    ppIntervals = DataAggregationService.generateIntervals(
      { startDate: tempPPStartDate, endDate: tempPPEndDate },
      intervalType
    );
  }
  
  let data: SparklineDataPoint[] = [];
  
  // Process each interval
  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    const ppInterval = ppIntervals[i]; // Corresponding previous period interval
    const timestamp = interval.timestamp;
    
    if (metric === 'videos') {
      // For published videos: count how many videos were published IN THIS INTERVAL
      const videosPublishedInInterval = submissions.filter(v => {
        const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        return DataAggregationService.isDateInInterval(uploadDate, interval);
      });
      
      // Calculate PP value if available - use ALL submissions, not filtered
      let ppValue = 0;
      if (ppInterval) {
        const ppVideosPublished = (allSubmissions || submissions).filter(v => {
          const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
          return DataAggregationService.isDateInInterval(uploadDate, ppInterval);
        });
        ppValue = ppVideosPublished.length;
      }
      
      data.push({ 
        value: videosPublishedInInterval.length, 
        timestamp,
        interval,
        ppValue
      });
    } else if (metric === 'accounts') {
      // For active accounts: count unique accounts that were active IN THIS INTERVAL
      const videosInInterval = submissions.filter(v => {
        const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        return DataAggregationService.isDateInInterval(uploadDate, interval);
      });
      const uniqueAccountsInInterval = new Set(videosInInterval.map(v => v.uploaderHandle)).size;
      
      // Calculate PP value if available - use ALL submissions, not filtered
      let ppValue = 0;
      if (ppInterval) {
        const ppVideosInInterval = (allSubmissions || submissions).filter(v => {
          const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
          return DataAggregationService.isDateInInterval(uploadDate, ppInterval);
        });
        ppValue = new Set(ppVideosInInterval.map(v => v.uploaderHandle)).size;
      }
      
      data.push({ 
        value: uniqueAccountsInInterval, 
        timestamp,
        interval,
        ppValue
      });
    } else {
      // Show per-interval values (NOT cumulative)
      let intervalValue = 0;
      let ppIntervalValue = 0;
      
      // Use filtered submissions for CP, all submissions for PP calculation
      const submissionsForCP = submissions;
      const submissionsForPP = allSubmissions || submissions;
      
      submissionsForCP.forEach(video => {
        const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
        
        // === CURRENT PERIOD (CP) CALCULATION ===
        // Check if video was uploaded before this interval started
        if (uploadDate < interval.startDate) {
          // Video was uploaded before this interval - calculate growth delta ONLY for this interval
          if (video.snapshots && video.snapshots.length > 0) {
            // Find snapshot at or before interval START (baseline)
            const snapshotAtStart = video.snapshots
              .filter(s => new Date(s.capturedAt) <= interval.startDate)
              .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
            
            // Find snapshot at or before interval END (current value)
            const snapshotAtEnd = video.snapshots
              .filter(s => new Date(s.capturedAt) <= interval.endDate)
              .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
            
            // Only count growth if we have both start and end snapshots
            if (snapshotAtStart && snapshotAtEnd && snapshotAtStart !== snapshotAtEnd) {
              // Calculate growth from start to end of THIS interval only
              const delta = Math.max(0, (snapshotAtEnd[metric] || 0) - (snapshotAtStart[metric] || 0));
              intervalValue += delta;
            }
          }
        } else if (DataAggregationService.isDateInInterval(uploadDate, interval)) {
          // Video was uploaded during this interval AND within the selected period
          // This represents NEW CONTENT added during this period
          const initialSnapshot = video.snapshots?.find(s => s.isInitialSnapshot);
          if (initialSnapshot) {
            // Use the initial snapshot value (what the video had when first added)
            intervalValue += initialSnapshot[metric] || 0;
          } else {
            // No initial snapshot, use current value as fallback
            intervalValue += video[metric] || 0;
          }
        }
      });
      
      // === PREVIOUS PERIOD (PP) CALCULATION ===
      // Use ALL submissions (not filtered) for PP calculation
      if (ppInterval) {
        submissionsForPP.forEach(video => {
          const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
          
          // Use the same logic as CP, but for PP interval dates
          if (uploadDate < ppInterval.startDate) {
            // Video was uploaded before PP interval started - calculate growth delta ONLY for this PP interval
            if (video.snapshots && video.snapshots.length > 0) {
              // Find snapshot at or before PP interval START (baseline)
              const snapshotAtStart = video.snapshots
                .filter(s => new Date(s.capturedAt) <= ppInterval.startDate)
                .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
              
              // Find snapshot at or before PP interval END (current value)
              const snapshotAtEnd = video.snapshots
                .filter(s => new Date(s.capturedAt) <= ppInterval.endDate)
                .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
              
              // Only count growth if we have both start and end snapshots
              if (snapshotAtStart && snapshotAtEnd && snapshotAtStart !== snapshotAtEnd) {
                // Calculate growth from start to end of THIS PP interval only
                const delta = Math.max(0, (snapshotAtEnd[metric] || 0) - (snapshotAtStart[metric] || 0));
                ppIntervalValue += delta;
              }
            }
          } else if (DataAggregationService.isDateInInterval(uploadDate, ppInterval)) {
            // Video was uploaded during PP interval AND within the PP period
            if (video.snapshots && video.snapshots.length > 0) {
              const firstSnapshot = video.snapshots
                .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())[0];
              ppIntervalValue += firstSnapshot[metric] || 0;
            } else {
              ppIntervalValue += video[metric] || 0;
            }
          }
        });
      }
      
      const finalPPValue = ppInterval ? ppIntervalValue : 0;
      
      data.push({ 
        value: intervalValue, 
        timestamp,
        interval,
        ppValue: finalPPValue
      });
    }
  }
  
  // Debug: Log PP sparkline data
  const ppDataPoints = data.filter(d => typeof d.ppValue === 'number' && d.ppValue > 0).length;
  if (ppDataPoints > 0) {
    console.log(`✨ Generated ${ppDataPoints} PP sparkline points for metric: ${metric}`);
  }
  
  // If only one data point exists, add padding points to create a flat line
  if (data.length === 1) {
    const singlePoint = data[0];
    const paddingLeft = {
      value: singlePoint.value,
      timestamp: singlePoint.timestamp - 1,
      interval: singlePoint.interval,
      ppValue: singlePoint.ppValue
    };
    const paddingRight = {
      value: singlePoint.value,
      timestamp: singlePoint.timestamp + 1,
      interval: singlePoint.interval,
      ppValue: singlePoint.ppValue
    };
    // Add padding points before and after to create a flat line
    data = [paddingLeft, singlePoint, paddingRight];
  }
  
  return { data, intervalType };
};

export const calculateDateRanges = (dateFilter: DateFilterType, customRange?: { startDate: Date; endDate: Date }) => {
  let dateRangeStart: Date | null = null;
  let dateRangeEnd: Date = new Date();
  let ppDateRangeStart: Date | null = null;
  let ppDateRangeEnd: Date | null = null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (dateFilter) {
    case 'today':
      dateRangeStart = new Date(today);
      dateRangeEnd = new Date(today);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Yesterday
      ppDateRangeStart = new Date(today);
      ppDateRangeStart.setDate(ppDateRangeStart.getDate() - 1);
      ppDateRangeEnd = new Date(ppDateRangeStart);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      dateRangeStart = new Date(today);
      dateRangeStart.setDate(dateRangeStart.getDate() - 1);
      dateRangeEnd = new Date(dateRangeStart);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Day before yesterday
      ppDateRangeStart = new Date(dateRangeStart);
      ppDateRangeStart.setDate(ppDateRangeStart.getDate() - 1);
      ppDateRangeEnd = new Date(ppDateRangeStart);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'last7days':
      dateRangeStart = new Date(today);
      dateRangeStart.setDate(dateRangeStart.getDate() - 6);
      dateRangeEnd = new Date(today);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Previous 7 days
      ppDateRangeStart = new Date(dateRangeStart);
      ppDateRangeStart.setDate(ppDateRangeStart.getDate() - 7);
      ppDateRangeEnd = new Date(dateRangeStart);
      ppDateRangeEnd.setDate(ppDateRangeEnd.getDate() - 1);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'last14days':
      dateRangeStart = new Date(today);
      dateRangeStart.setDate(dateRangeStart.getDate() - 13);
      dateRangeEnd = new Date(today);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Previous 14 days
      ppDateRangeStart = new Date(dateRangeStart);
      ppDateRangeStart.setDate(ppDateRangeStart.getDate() - 14);
      ppDateRangeEnd = new Date(dateRangeStart);
      ppDateRangeEnd.setDate(ppDateRangeEnd.getDate() - 1);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'last30days':
      dateRangeStart = new Date(today);
      dateRangeStart.setDate(dateRangeStart.getDate() - 29);
      dateRangeEnd = new Date(today);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Previous 30 days
      ppDateRangeStart = new Date(dateRangeStart);
      ppDateRangeStart.setDate(ppDateRangeStart.getDate() - 30);
      ppDateRangeEnd = new Date(dateRangeStart);
      ppDateRangeEnd.setDate(ppDateRangeEnd.getDate() - 1);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'last90days':
      dateRangeStart = new Date(today);
      dateRangeStart.setDate(dateRangeStart.getDate() - 89);
      dateRangeEnd = new Date(today);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Previous 90 days
      ppDateRangeStart = new Date(dateRangeStart);
      ppDateRangeStart.setDate(ppDateRangeStart.getDate() - 90);
      ppDateRangeEnd = new Date(dateRangeStart);
      ppDateRangeEnd.setDate(ppDateRangeEnd.getDate() - 1);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'mtd':
      dateRangeStart = new Date(today.getFullYear(), today.getMonth(), 1);
      dateRangeEnd = new Date(today);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Last month (same day range)
      ppDateRangeStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      ppDateRangeEnd = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'ytd':
      dateRangeStart = new Date(today.getFullYear(), 0, 1);
      dateRangeEnd = new Date(today);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Last year (same date range)
      ppDateRangeStart = new Date(today.getFullYear() - 1, 0, 1);
      ppDateRangeEnd = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'custom':
      if (customRange) {
        dateRangeStart = new Date(customRange.startDate);
        dateRangeEnd = new Date(customRange.endDate);
        dateRangeEnd.setHours(23, 59, 59, 999);
        // PP: Same length period before custom range
        const customLength = dateRangeEnd.getTime() - dateRangeStart.getTime();
        ppDateRangeEnd = new Date(dateRangeStart);
        ppDateRangeEnd.setDate(ppDateRangeEnd.getDate() - 1);
        ppDateRangeEnd.setHours(23, 59, 59, 999);
        ppDateRangeStart = new Date(ppDateRangeEnd.getTime() - customLength);
      }
      break;
    case 'all':
    default:
      dateRangeStart = null;
      dateRangeEnd = new Date();
      ppDateRangeStart = null;
      ppDateRangeEnd = null;
  }

  return {
    dateRangeStart,
    dateRangeEnd,
    ppDateRangeStart,
    ppDateRangeEnd
  };
};

