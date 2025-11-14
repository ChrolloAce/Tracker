import { Play, Heart, MessageCircle, Share2, Video, AtSign, Activity, DollarSign, Download, LinkIcon } from 'lucide-react';
import { VideoSubmission } from '../../types';
import { LinkClick } from '../../services/LinkClicksService';
import { TrackedLink } from '../../types/firestore';
import { RevenueMetrics } from '../../types/revenue';
import { DateFilterType } from '../DateRangeFilter';
import { KPICardData } from './kpiTypes';
import { formatNumber } from './kpiHelpers';
import { generateSparklineData } from './kpiDataProcessing';
import DataAggregationService from '../../services/DataAggregationService';

export interface GenerateKPICardDataParams {
  submissions: VideoSubmission[];
  allSubmissions: VideoSubmission[] | undefined;
  linkClicks: LinkClick[];
  links: TrackedLink[]; // Kept for future use
  dateFilter: DateFilterType;
  customRange?: { startDate: Date; endDate: Date };
  granularity: 'day' | 'week' | 'month' | 'year';
  revenueMetrics?: RevenueMetrics | null;
  onOpenRevenueSettings?: () => void;
}

/**
 * Generates KPI card data based on video submissions and date filters
 * This is a large computation extracted from the main component
 */
export function generateKPICardData(params: GenerateKPICardDataParams): {
  cards: KPICardData[];
  dateRangeStart: Date | null;
  dateRangeEnd: Date;
} {
  const {
    submissions,
    allSubmissions,
    linkClicks,
    links: _links, // Kept for potential future use
    dateFilter,
    customRange,
    granularity,
    revenueMetrics,
    onOpenRevenueSettings
  } = params;

  const startTime = performance.now();
  console.log('🔄 KPI Data calculation started');
  
  // Determine the date range based on date filter
  let dateRangeStart: Date | null = null;
  let dateRangeEnd: Date = new Date();
  dateRangeEnd.setHours(23, 59, 59, 999); // Always normalize to end of today
  
  // Check for custom range first
  if (dateFilter === 'custom' && customRange) {
    dateRangeStart = new Date(customRange.startDate);
    dateRangeStart.setHours(0, 0, 0, 0); // Start of day
    dateRangeEnd = new Date(customRange.endDate);
    dateRangeEnd.setHours(23, 59, 59, 999); // End of day
  } else if (dateFilter === 'today') {
    dateRangeStart = new Date();
    dateRangeStart.setHours(0, 0, 0, 0);
    dateRangeEnd = new Date();
    dateRangeEnd.setHours(23, 59, 59, 999);
  } else if (dateFilter === 'yesterday') {
    dateRangeStart = new Date();
    dateRangeStart.setDate(dateRangeStart.getDate() - 1);
    dateRangeStart.setHours(0, 0, 0, 0);
    dateRangeEnd = new Date();
    dateRangeEnd.setDate(dateRangeEnd.getDate() - 1);
    dateRangeEnd.setHours(23, 59, 59, 999);
  } else if (dateFilter === 'last7days') {
    dateRangeStart = new Date();
    dateRangeStart.setDate(dateRangeStart.getDate() - 6); // 6 days back + today = 7 days
    dateRangeStart.setHours(0, 0, 0, 0);
    dateRangeEnd = new Date();
    dateRangeEnd.setHours(23, 59, 59, 999);
  } else if (dateFilter === 'last14days') {
    dateRangeStart = new Date();
    dateRangeStart.setDate(dateRangeStart.getDate() - 13); // 13 days back + today = 14 days
    dateRangeStart.setHours(0, 0, 0, 0);
    dateRangeEnd = new Date();
    dateRangeEnd.setHours(23, 59, 59, 999);
  } else if (dateFilter === 'last30days') {
    dateRangeStart = new Date();
    dateRangeStart.setDate(dateRangeStart.getDate() - 29); // 29 days back + today = 30 days
    dateRangeStart.setHours(0, 0, 0, 0);
    dateRangeEnd = new Date();
    dateRangeEnd.setHours(23, 59, 59, 999);
  } else if (dateFilter === 'last90days') {
    dateRangeStart = new Date();
    dateRangeStart.setDate(dateRangeStart.getDate() - 89); // 89 days back + today = 90 days
    dateRangeStart.setHours(0, 0, 0, 0);
    dateRangeEnd = new Date();
    dateRangeEnd.setHours(23, 59, 59, 999);
  } else if (dateFilter === 'mtd') {
    dateRangeStart = new Date();
    dateRangeStart.setDate(1);
    dateRangeStart.setHours(0, 0, 0, 0);
    dateRangeEnd = new Date();
    dateRangeEnd.setHours(23, 59, 59, 999);
  } else if (dateFilter === 'lastmonth') {
    dateRangeStart = new Date();
    dateRangeStart.setMonth(dateRangeStart.getMonth() - 1, 1); // First day of last month
    dateRangeStart.setHours(0, 0, 0, 0);
    dateRangeEnd = new Date();
    dateRangeEnd.setDate(0); // Last day of last month
    dateRangeEnd.setHours(23, 59, 59, 999);
  } else if (dateFilter === 'ytd') {
    dateRangeStart = new Date();
    dateRangeStart.setMonth(0, 1);
    dateRangeStart.setHours(0, 0, 0, 0);
    dateRangeEnd = new Date();
    dateRangeEnd.setHours(23, 59, 59, 999);
  } else if (dateFilter === 'all') {
    // For 'all' time: find the earliest video upload date
    if (submissions.length > 0) {
      const dates = submissions.map(v => new Date(v.uploadDate || v.dateSubmitted).getTime());
      const earliestTime = Math.min(...dates);
      dateRangeStart = new Date(earliestTime);
      dateRangeStart.setHours(0, 0, 0, 0);
    } else {
      // No videos yet, default to 30 days ago
      dateRangeStart = new Date();
      dateRangeStart.setDate(dateRangeStart.getDate() - 29);
      dateRangeStart.setHours(0, 0, 0, 0);
    }
  }
  
  // Calculate metrics based on date filter
  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalSaves = 0;
  
  if (dateRangeStart) {
    // For specific date ranges, calculate growth during the period from ALL videos
    submissions.forEach(video => {
      const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
      
      if (video.snapshots && video.snapshots.length > 0) {
        const snapshotBeforeOrAtStart = video.snapshots
          .filter(s => new Date(s.capturedAt) <= dateRangeStart!)
          .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
        
        const snapshotBeforeOrAtEnd = video.snapshots
          .filter(s => new Date(s.capturedAt) <= dateRangeEnd)
          .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
        
        const snapshotsInRange = video.snapshots.filter(s => {
          const capturedDate = new Date(s.capturedAt);
          return capturedDate >= dateRangeStart! && capturedDate <= dateRangeEnd;
        });
        
        if (snapshotBeforeOrAtStart && snapshotBeforeOrAtEnd && snapshotBeforeOrAtStart !== snapshotBeforeOrAtEnd) {
          totalViews += Math.max(0, (snapshotBeforeOrAtEnd.views || 0) - (snapshotBeforeOrAtStart.views || 0));
          totalLikes += Math.max(0, (snapshotBeforeOrAtEnd.likes || 0) - (snapshotBeforeOrAtStart.likes || 0));
          totalComments += Math.max(0, (snapshotBeforeOrAtEnd.comments || 0) - (snapshotBeforeOrAtStart.comments || 0));
          totalShares += Math.max(0, (snapshotBeforeOrAtEnd.shares || 0) - (snapshotBeforeOrAtStart.shares || 0));
          totalSaves += Math.max(0, (snapshotBeforeOrAtEnd.saves || 0) - (snapshotBeforeOrAtStart.saves || 0));
        } else if (snapshotBeforeOrAtStart && snapshotBeforeOrAtEnd && snapshotBeforeOrAtStart === snapshotBeforeOrAtEnd && snapshotsInRange.length > 0) {
          const sortedSnapshotsInRange = snapshotsInRange.sort((a, b) => 
            new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
          );
          
          const lastSnapshotInRange = sortedSnapshotsInRange[sortedSnapshotsInRange.length - 1];
          
          totalViews += Math.max(0, (lastSnapshotInRange.views || 0) - (snapshotBeforeOrAtStart.views || 0));
          totalLikes += Math.max(0, (lastSnapshotInRange.likes || 0) - (snapshotBeforeOrAtStart.likes || 0));
          totalComments += Math.max(0, (lastSnapshotInRange.comments || 0) - (snapshotBeforeOrAtStart.comments || 0));
          totalShares += Math.max(0, (lastSnapshotInRange.shares || 0) - (snapshotBeforeOrAtStart.shares || 0));
          totalSaves += Math.max(0, (lastSnapshotInRange.saves || 0) - (snapshotBeforeOrAtStart.saves || 0));
        } else if (!snapshotBeforeOrAtStart && snapshotsInRange.length > 0) {
          const sortedSnapshotsInRange = snapshotsInRange.sort((a, b) => 
            new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
          );
          
          const firstSnapshotInRange = sortedSnapshotsInRange[0];
          const lastSnapshotInRange = sortedSnapshotsInRange[sortedSnapshotsInRange.length - 1];
          
          if (uploadDate >= dateRangeStart && uploadDate <= dateRangeEnd) {
            totalViews += lastSnapshotInRange.views || 0;
            totalLikes += lastSnapshotInRange.likes || 0;
            totalComments += lastSnapshotInRange.comments || 0;
            totalShares += lastSnapshotInRange.shares || 0;
            totalSaves += lastSnapshotInRange.saves || 0;
          } else {
            totalViews += Math.max(0, (lastSnapshotInRange.views || 0) - (firstSnapshotInRange.views || 0));
            totalLikes += Math.max(0, (lastSnapshotInRange.likes || 0) - (firstSnapshotInRange.likes || 0));
            totalComments += Math.max(0, (lastSnapshotInRange.comments || 0) - (firstSnapshotInRange.comments || 0));
            totalShares += Math.max(0, (lastSnapshotInRange.shares || 0) - (firstSnapshotInRange.shares || 0));
            totalSaves += Math.max(0, (lastSnapshotInRange.saves || 0) - (firstSnapshotInRange.saves || 0));
          }
        } else if (!snapshotBeforeOrAtStart && !snapshotBeforeOrAtEnd) {
          if (uploadDate >= dateRangeStart && uploadDate <= dateRangeEnd) {
            totalViews += video.views || 0;
            totalLikes += video.likes || 0;
            totalComments += video.comments || 0;
            totalShares += video.shares || 0;
            totalSaves += video.saves || 0;
          }
        }
      } else {
        if (uploadDate >= dateRangeStart && uploadDate <= dateRangeEnd) {
          totalViews += video.views || 0;
          totalLikes += video.likes || 0;
          totalComments += video.comments || 0;
          totalShares += video.shares || 0;
          totalSaves += video.saves || 0;
        }
      }
    });
  } else {
    // For 'all' time filter, use current metrics
    totalViews = submissions.reduce((sum, v) => sum + (v.views || 0), 0);
    totalLikes = submissions.reduce((sum, v) => sum + (v.likes || 0), 0);
    totalComments = submissions.reduce((sum, v) => sum + (v.comments || 0), 0);
    totalShares = submissions.reduce((sum, v) => sum + (v.shares || 0), 0);
    totalSaves = submissions.reduce((sum, v) => sum + (v.saves || 0), 0);
  }
  
  // Filter videos by date range for counts
  let videosInRange = submissions;
  if (dateRangeStart) {
    videosInRange = submissions.filter(v => {
      const uploadDate = new Date(v.uploadDate || v.dateSubmitted);
      return uploadDate >= dateRangeStart! && uploadDate <= dateRangeEnd;
    });
  }
  
  const activeAccounts = new Set(videosInRange.map(v => v.uploaderHandle)).size;
  const publishedVideos = videosInRange.length;
  
  const totalEngagement = totalLikes + totalComments;
  const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

  // Calculate Previous Period (PP) metrics
  let ppDateRangeStart: Date | null = null;
  let ppDateRangeEnd: Date | null = null;
  
  if (dateRangeStart) {
    const periodLength = dateRangeEnd.getTime() - dateRangeStart.getTime();
    ppDateRangeEnd = new Date(dateRangeStart.getTime() - 1);
    ppDateRangeStart = new Date(ppDateRangeEnd.getTime() - periodLength);
    console.log('📅 PP Date Range:', ppDateRangeStart.toLocaleDateString(), '-', ppDateRangeEnd.toLocaleDateString());
  }
  
  let ppViews = 0;
  let ppLikes = 0;
  let ppComments = 0;
  let ppShares = 0;
  let ppVideos = 0;
  
  if (ppDateRangeStart && ppDateRangeEnd) {
    const relevantVideosForPP = (allSubmissions || submissions).filter(video => {
      const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
      return uploadDate >= ppDateRangeStart! && uploadDate <= ppDateRangeEnd!;
    });
    
    console.log('📊 PP Calculation - Total videos:', (allSubmissions || submissions).length, '| Relevant for PP:', relevantVideosForPP.length);
    
    relevantVideosForPP.forEach(video => {
      ppViews += video.views || 0;
      ppLikes += video.likes || 0;
      ppComments += video.comments || 0;
      ppShares += video.shares || 0;
    });
    
    ppVideos = relevantVideosForPP.length;
    
    console.log('📊 PP Metrics:', {
      views: ppViews,
      likes: ppLikes,
      comments: ppComments,
      shares: ppShares,
      videos: ppVideos
    });
  }

  console.log('📊 CP Metrics:', {
    views: totalViews,
    likes: totalLikes,
    comments: totalComments,
    shares: totalShares,
    videos: publishedVideos,
    accounts: activeAccounts
  });
  
  // Calculate deltas
  const viewsGrowthAbsolute = ppViews === 0 ? totalViews : totalViews - ppViews;
  const viewsGrowth = ppViews > 0 ? ((totalViews - ppViews) / ppViews) * 100 : 0;
  
  console.log('📈 Views Delta:', {
    cpViews: totalViews,
    ppViews: ppViews,
    difference: viewsGrowthAbsolute,
    percentChange: viewsGrowth.toFixed(2) + '%'
  });
  
  const likesGrowthAbsolute = ppLikes === 0 ? totalLikes : totalLikes - ppLikes;
  const commentsGrowthAbsolute = ppComments === 0 ? totalComments : totalComments - ppComments;
  const sharesGrowthAbsolute = ppShares === 0 ? totalShares : totalShares - ppShares;
  const videosGrowthAbsolute = ppVideos === 0 ? publishedVideos : publishedVideos - ppVideos;

  const ppEngagement = ppLikes + ppComments;
  const ppEngagementRate = ppViews > 0 ? (ppEngagement / ppViews) * 100 : 0;
  const engagementRateGrowthAbsolute = ppEngagementRate === 0 ? engagementRate : engagementRate - ppEngagementRate;

  // Calculate link clicks
  let cpClicks = 0;
  let ppClicks = 0;
  
  if (dateRangeStart) {
    cpClicks = linkClicks.filter(click => {
      const clickDate = new Date(click.timestamp);
      const clickDateLocal = new Date(clickDate.getFullYear(), clickDate.getMonth(), clickDate.getDate());
      const rangeStartLocal = new Date(dateRangeStart!.getFullYear(), dateRangeStart!.getMonth(), dateRangeStart!.getDate());
      const rangeEndLocal = new Date(dateRangeEnd.getFullYear(), dateRangeEnd.getMonth(), dateRangeEnd.getDate());
      return clickDateLocal >= rangeStartLocal && clickDateLocal <= rangeEndLocal;
    }).length;
    
    if (ppDateRangeStart && ppDateRangeEnd) {
      ppClicks = linkClicks.filter(click => {
        const clickDate = new Date(click.timestamp);
        const clickDateLocal = new Date(clickDate.getFullYear(), clickDate.getMonth(), clickDate.getDate());
        const ppStartLocal = new Date(ppDateRangeStart!.getFullYear(), ppDateRangeStart!.getMonth(), ppDateRangeStart!.getDate());
        const ppEndLocal = new Date(ppDateRangeEnd!.getFullYear(), ppDateRangeEnd!.getMonth(), ppDateRangeEnd!.getDate());
        return clickDateLocal >= ppStartLocal && clickDateLocal <= ppEndLocal;
      }).length;
    }
  } else {
    cpClicks = linkClicks.length;
  }
  
  const clicksGrowthAbsolute = ppClicks === 0 ? cpClicks : cpClicks - ppClicks;

  // Generate sparkline data
  const viewsSparklineResult = generateSparklineData('views', submissions, allSubmissions, dateRangeStart, dateRangeEnd, dateFilter, granularity);
  const likesSparklineResult = generateSparklineData('likes', submissions, allSubmissions, dateRangeStart, dateRangeEnd, dateFilter, granularity);
  const commentsSparklineResult = generateSparklineData('comments', submissions, allSubmissions, dateRangeStart, dateRangeEnd, dateFilter, granularity);
  const sharesSparklineResult = generateSparklineData('shares', submissions, allSubmissions, dateRangeStart, dateRangeEnd, dateFilter, granularity);
  const videosSparklineResult = generateSparklineData('videos', submissions, allSubmissions, dateRangeStart, dateRangeEnd, dateFilter, granularity);
  
  // Generate sparkline data for link clicks
  const linkClicksSparklineResult = (() => {
    let actualStartDate: Date;
    let actualEndDate: Date = new Date();
    
    if (dateRangeStart) {
      actualStartDate = new Date(dateRangeStart);
      actualEndDate = new Date(dateRangeEnd);
    } else {
      // For 'all' time filter, use last 30 days as default
      actualStartDate = new Date();
      actualStartDate.setDate(actualStartDate.getDate() - 30);
    }
    
    const intervalType = granularity;
    
    // Generate intervals for current period
    const intervals = DataAggregationService.generateIntervals(
      { startDate: actualStartDate, endDate: actualEndDate },
      intervalType
    );
    
    // Generate intervals for previous period if applicable
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
    
    const data: Array<{ value: number; timestamp: number; interval: any; ppValue?: number }> = [];
    
    // Process each interval
    for (let i = 0; i < intervals.length; i++) {
      const interval = intervals[i];
      const timestamp = interval.timestamp;
      
      // Count clicks in this interval
      const intervalClicks = linkClicks.filter(click => {
        const clickDate = new Date(click.timestamp);
        return DataAggregationService.isDateInInterval(clickDate, interval);
      });
      
      const intervalValue = intervalClicks.length;
      
      // Calculate PP value if applicable
      let ppValue = 0;
      if (ppIntervals.length > 0 && i < ppIntervals.length) {
        const ppInterval = ppIntervals[i];
        const ppIntervalClicks = linkClicks.filter(click => {
          const clickDate = new Date(click.timestamp);
          return DataAggregationService.isDateInInterval(clickDate, ppInterval);
        });
        ppValue = ppIntervalClicks.length;
      }
      
      data.push({
        value: intervalValue,
        timestamp,
        interval,
        ppValue: ppIntervals.length > 0 ? ppValue : undefined
      });
    }
    
    // Add padding if single data point
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
      return { data: [paddingLeft, singlePoint, paddingRight], intervalType };
    }
    
    return { data, intervalType };
  })();
  
  // Build card data array
  const cards: KPICardData[] = [
    {
      id: 'views',
      label: 'Views',
      value: formatNumber(totalViews),
      icon: Play,
      accent: 'emerald',
      delta: { value: Math.abs(viewsGrowth), isPositive: viewsGrowth >= 0, absoluteValue: viewsGrowthAbsolute },
      sparklineData: viewsSparklineResult.data,
      intervalType: viewsSparklineResult.intervalType,
      isIncreasing: viewsGrowthAbsolute >= 0
    },
    {
      id: 'likes',
      label: 'Likes',
      value: formatNumber(totalLikes),
      icon: Heart,
      accent: 'pink',
      delta: { value: 0, isPositive: likesGrowthAbsolute >= 0, absoluteValue: likesGrowthAbsolute },
      sparklineData: likesSparklineResult.data,
      intervalType: likesSparklineResult.intervalType,
      isIncreasing: likesGrowthAbsolute >= 0
    },
    {
      id: 'comments',
      label: 'Comments',
      value: formatNumber(totalComments),
      icon: MessageCircle,
      accent: 'blue',
      delta: { value: 0, isPositive: commentsGrowthAbsolute >= 0, absoluteValue: commentsGrowthAbsolute },
      sparklineData: commentsSparklineResult.data,
      intervalType: commentsSparklineResult.intervalType,
      isIncreasing: commentsGrowthAbsolute >= 0
    },
    {
      id: 'shares',
      label: 'Shares',
      value: formatNumber(totalShares),
      icon: Share2,
      accent: 'orange',
      delta: { value: 0, isPositive: sharesGrowthAbsolute >= 0, absoluteValue: sharesGrowthAbsolute },
      sparklineData: sharesSparklineResult.data,
      intervalType: sharesSparklineResult.intervalType,
      isIncreasing: sharesGrowthAbsolute >= 0
    },
    {
      id: 'videos',
      label: 'Published Videos',
      value: publishedVideos,
      icon: Video,
      accent: 'violet',
      delta: { value: 0, isPositive: videosGrowthAbsolute >= 0, absoluteValue: videosGrowthAbsolute },
      sparklineData: videosSparklineResult.data,
      intervalType: videosSparklineResult.intervalType,
      isIncreasing: videosGrowthAbsolute >= 0
    },
    // Active Accounts card with dynamic calculation
    (() => {
      let currentCount = 0;
      let previousCount = 0;
      
      if (dateRangeStart) {
        const currentVideos = submissions.filter(v => {
          const uploadDate = new Date(v.uploadDate || v.dateSubmitted);
          return uploadDate >= dateRangeStart! && uploadDate <= dateRangeEnd;
        });
        currentCount = new Set(currentVideos.map(v => v.uploaderHandle)).size;
        
        if (ppDateRangeStart && ppDateRangeEnd) {
          const previousVideos = (allSubmissions || submissions).filter(v => {
            const uploadDate = new Date(v.uploadDate || v.dateSubmitted);
            return uploadDate >= ppDateRangeStart! && uploadDate <= ppDateRangeEnd!;
          });
          previousCount = new Set(previousVideos.map(v => v.uploaderHandle)).size;
        }
      } else {
        currentCount = activeAccounts;
      }
      
      const accountsGrowthAbsolute = currentCount - previousCount;
      const accountsGrowth = previousCount > 0 ? ((accountsGrowthAbsolute / previousCount) * 100) : 0;
      
      const accountsSparklineResult = generateSparklineData('accounts', submissions, allSubmissions, dateRangeStart, dateRangeEnd, dateFilter, granularity);
      
      return {
        id: 'active-accounts',
        label: 'Active Accounts',
        value: formatNumber(currentCount),
        icon: AtSign,
        accent: 'slate' as const,
        delta: { value: Math.abs(accountsGrowth), isPositive: accountsGrowthAbsolute >= 0, absoluteValue: accountsGrowthAbsolute },
        sparklineData: accountsSparklineResult.data,
        intervalType: accountsSparklineResult.intervalType,
        isIncreasing: accountsGrowthAbsolute >= 0
      };
    })(),
    // Engagement Rate card with sparkline
    (() => {
      // Generate engagement rate sparkline data (per-interval, not cumulative)
      let actualStartDate: Date;
      let actualEndDate: Date = new Date();
      
      if (dateRangeStart) {
        actualStartDate = new Date(dateRangeStart);
        actualEndDate = new Date(dateRangeEnd);
      } else {
        actualStartDate = new Date();
        actualStartDate.setDate(actualStartDate.getDate() - 30);
      }
      
      const intervals = DataAggregationService.generateIntervals(
        { startDate: actualStartDate, endDate: actualEndDate },
        granularity
      );
      
      const engagementData = intervals.map(interval => {
        let intervalViews = 0;
        let intervalEngagement = 0;
        
        submissions.forEach(video => {
          const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
          
          if (uploadDate < interval.startDate) {
            if (video.snapshots && video.snapshots.length > 0) {
              const snapshotAtEnd = video.snapshots
                .filter(s => new Date(s.capturedAt) <= interval.endDate)
                .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
              
              if (snapshotAtEnd) {
                const allSnapshotsBeforeEnd = video.snapshots
                  .filter(s => new Date(s.capturedAt) < new Date(snapshotAtEnd.capturedAt))
                  .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
                
                const previousSnapshot = allSnapshotsBeforeEnd[0];
                
                if (previousSnapshot) {
                  const viewsDelta = Math.max(0, (snapshotAtEnd.views || 0) - (previousSnapshot.views || 0));
                  const likesDelta = Math.max(0, (snapshotAtEnd.likes || 0) - (previousSnapshot.likes || 0));
                  const commentsDelta = Math.max(0, (snapshotAtEnd.comments || 0) - (previousSnapshot.comments || 0));
                  
                  intervalViews += viewsDelta;
                  intervalEngagement += (likesDelta + commentsDelta);
                } else {
                  intervalViews += snapshotAtEnd.views || 0;
                  intervalEngagement += (snapshotAtEnd.likes || 0) + (snapshotAtEnd.comments || 0);
                }
              }
            }
          } else if (DataAggregationService.isDateInInterval(uploadDate, interval)) {
            const initialSnapshot = video.snapshots?.find(s => s.isInitialSnapshot);
            if (initialSnapshot) {
              intervalViews += initialSnapshot.views || 0;
              intervalEngagement += (initialSnapshot.likes || 0) + (initialSnapshot.comments || 0);
            } else {
              intervalViews += video.views || 0;
              intervalEngagement += (video.likes || 0) + (video.comments || 0);
            }
          }
        });
        
        const intervalEngagementRate = intervalViews > 0 ? (intervalEngagement / intervalViews) * 100 : 0;
        
        return {
          value: intervalEngagementRate,
          timestamp: interval.timestamp,
          interval
        };
      });
      
      // Add padding if single data point
      let finalEngagementData = engagementData;
      if (engagementData.length === 1) {
        const singlePoint = engagementData[0];
        const paddingLeft = {
          value: singlePoint.value,
          timestamp: singlePoint.timestamp - 1,
          interval: singlePoint.interval
        };
        const paddingRight = {
          value: singlePoint.value,
          timestamp: singlePoint.timestamp + 1,
          interval: singlePoint.interval
        };
        finalEngagementData = [paddingLeft, singlePoint, paddingRight];
      }
      
      return {
        id: 'engagement-rate',
        label: 'Engagement Rate',
        value: `${engagementRate.toFixed(1)}%`,
        icon: Activity,
        accent: 'teal' as const,
        delta: {
          value: Math.abs(engagementRateGrowthAbsolute),
          isPositive: engagementRateGrowthAbsolute >= 0,
          absoluteValue: engagementRateGrowthAbsolute,
          isPercentage: true
        },
        sparklineData: finalEngagementData,
        intervalType: granularity,
        isIncreasing: engagementRateGrowthAbsolute >= 0
      };
    })(),
    // Link Clicks card
    {
      id: 'link-clicks',
      label: 'Link Clicks',
      value: formatNumber(cpClicks),
      icon: LinkIcon,
      accent: 'orange',
      delta: { value: 0, isPositive: clicksGrowthAbsolute >= 0, absoluteValue: clicksGrowthAbsolute },
      sparklineData: linkClicksSparklineResult.data,
      intervalType: linkClicksSparklineResult.intervalType,
      isEmpty: linkClicks.length === 0,
      ctaText: linkClicks.length === 0 ? 'Create a tracked link' : undefined,
      isIncreasing: clicksGrowthAbsolute >= 0
    }
  ];

  // Add revenue cards if available
  if (revenueMetrics && revenueMetrics.dailyMetrics) {
    // Filter daily metrics by date range
    const filteredDailyMetrics = revenueMetrics.dailyMetrics.filter(day => {
      const dayDate = day.date?.toDate ? day.date.toDate() : new Date(day.date);
      if (!dateRangeStart) return true; // Include all if no start date
      return dayDate >= dateRangeStart && dayDate <= dateRangeEnd;
    });
    
    // Calculate totals from FILTERED data
    const filteredTotalRevenue = filteredDailyMetrics.reduce((sum, day) => sum + (day.revenue || 0), 0);
    const filteredTotalDownloads = filteredDailyMetrics.reduce((sum, day) => sum + (day.downloads || 0), 0);
    
    // Generate sparkline data for revenue
    const revenueSparkline = filteredDailyMetrics
      .sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      })
      .map(day => ({
        value: day.revenue / 100, // Convert cents to dollars
        ppValue: 0 // PP not implemented for revenue yet
      }));
    
    // Generate sparkline data for downloads
    const downloadsSparkline = filteredDailyMetrics
      .sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      })
      .map(day => ({
        value: day.downloads,
        ppValue: 0 // PP not implemented for revenue yet
      }));
    
    cards.push(
      {
        id: 'revenue',
        label: 'Revenue',
        value: `$${formatNumber(filteredTotalRevenue / 100, true)}`,
        icon: DollarSign,
        accent: 'emerald',
        sparklineData: revenueSparkline,
        intervalType: granularity,
        isEmpty: filteredTotalRevenue === 0
      },
      {
        id: 'downloads',
        label: 'Downloads',
        value: formatNumber(filteredTotalDownloads),
        icon: Download,
        accent: 'blue',
        sparklineData: downloadsSparkline,
        intervalType: granularity,
        isEmpty: filteredTotalDownloads === 0
      }
    );
  } else if (onOpenRevenueSettings) {
    cards.push({
      id: 'revenue',
      label: 'Revenue',
      value: '—',
      icon: DollarSign,
      accent: 'emerald',
      sparklineData: [],
      isEmpty: true,
      ctaText: 'Connect App Store',
      onClick: onOpenRevenueSettings
    } as any);
  }

  const endTime = performance.now();
  console.log(`✅ KPI Data calculation completed in ${(endTime - startTime).toFixed(2)}ms`);

  return { cards, dateRangeStart, dateRangeEnd };
}

