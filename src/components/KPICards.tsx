import React, { useMemo, useState } from 'react';
import { 
  Play, 
  Heart, 
  MessageCircle, 
  Activity, 
  AtSign, 
  Video, 
  Share2,
  ChevronRight,
  Link as LinkIcon
} from 'lucide-react';
import { VideoSubmission } from '../types';
import { LinkClick } from '../services/LinkClicksService';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { DateFilterType } from './DateRangeFilter';
import { TimePeriodType } from './TimePeriodSelector';
import MetricComparisonModal from './MetricComparisonModal';

interface KPICardsProps {
  submissions: VideoSubmission[];
  linkClicks?: LinkClick[];
  dateFilter?: DateFilterType;
  timePeriod?: TimePeriodType;
  onCreateLink?: () => void;
  onDateFilterChange?: (filter: DateFilterType, customRange?: { startDate: Date; endDate: Date }) => void;
}

interface KPICardData {
  id: string;
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'emerald' | 'pink' | 'blue' | 'violet' | 'teal' | 'orange' | 'slate';
  delta?: { value: number; isPositive: boolean; absoluteValue: number; isPercentage?: boolean };
  period?: string;
  sparklineData?: Array<{ value: number; timestamp?: number; previousValue?: number }>;
  isEmpty?: boolean;
  ctaText?: string;
  isIncreasing?: boolean;
}

const KPICards: React.FC<KPICardsProps> = ({ 
  submissions, 
  linkClicks = [], 
  dateFilter = 'all', 
  timePeriod = 'weeks', 
  onCreateLink,
  onDateFilterChange = () => {} 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'views' | 'likes' | 'comments' | 'shares' | 'videos' | 'accounts' | 'engagement' | 'engagementRate' | 'linkClicks'>('views');

  const handleCardClick = (metricId: string) => {
    // If it's link clicks and there are no links, trigger create link callback
    if (metricId === 'link-clicks' && linkClicks.length === 0 && onCreateLink) {
      onCreateLink();
      return;
    }
    
    setSelectedMetric(metricId as any);
    setIsModalOpen(true);
  };

  const kpiData = useMemo(() => {
    // Determine the date range based on date filter
    let dateRangeStart: Date | null = null;
    let dateRangeEnd: Date = new Date(); // Always up to now
    
    if (dateFilter === 'today') {
      dateRangeStart = new Date();
      dateRangeStart.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'last7days') {
      dateRangeStart = new Date();
      dateRangeStart.setDate(dateRangeStart.getDate() - 7);
    } else if (dateFilter === 'last30days') {
      dateRangeStart = new Date();
      dateRangeStart.setDate(dateRangeStart.getDate() - 30);
    } else if (dateFilter === 'last90days') {
      dateRangeStart = new Date();
      dateRangeStart.setDate(dateRangeStart.getDate() - 90);
    } else if (dateFilter === 'mtd') {
      dateRangeStart = new Date();
      dateRangeStart.setDate(1);
      dateRangeStart.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'ytd') {
      dateRangeStart = new Date();
      dateRangeStart.setMonth(0, 1);
      dateRangeStart.setHours(0, 0, 0, 0);
    }
    // For 'all' time, dateRangeStart remains null
    
    // Note: submissions are already filtered by date range from DashboardPage
    // We need to:
    // 1. Sum up current metrics for all filtered videos
    // 2. Add snapshot values if they fall within the selected time period
    
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    
    // Sum up current metrics for all (already filtered) submissions
    totalViews = submissions.reduce((sum, v) => sum + (v.views || 0), 0);
    totalLikes = submissions.reduce((sum, v) => sum + (v.likes || 0), 0);
    totalComments = submissions.reduce((sum, v) => sum + (v.comments || 0), 0);
    totalShares = submissions.reduce((sum, v) => sum + (v.shares || 0), 0);
    
    // Add snapshot values that fall within the selected date range
    if (dateRangeStart) {
      submissions.forEach(video => {
        if (video.snapshots && video.snapshots.length > 0) {
          video.snapshots.forEach(snapshot => {
            const capturedDate = snapshot.capturedAt instanceof Date 
              ? snapshot.capturedAt 
              : new Date(snapshot.capturedAt);
            
            // Check if snapshot falls within the selected time period
            if (capturedDate >= dateRangeStart! && capturedDate <= dateRangeEnd) {
              totalViews += snapshot.views || 0;
              totalLikes += snapshot.likes || 0;
              totalComments += snapshot.comments || 0;
              totalShares += snapshot.shares || 0;
            }
          });
        }
      });
    }
    
    const activeAccounts = new Set(submissions.map(v => v.uploaderHandle)).size;
    const publishedVideos = submissions.length;
    
    const totalEngagement = totalLikes + totalComments;
    const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

    // Calculate growth (last 7 days vs previous 7 days)
    const now = new Date();
    const last7Days = submissions.filter(v => {
      const uploadDate = new Date(v.uploadDate);
      const daysDiff = (now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    });
    
    const previous7Days = submissions.filter(v => {
      const uploadDate = new Date(v.uploadDate);
      const daysDiff = (now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff > 7 && daysDiff <= 14;
    });

    // Calculate growth for all metrics
    // CP = Current Period (last 7 days), PP = Previous Period (previous 7 days)
    const last7DaysViews = last7Days.reduce((sum, v) => sum + (v.views || 0), 0);
    const previous7DaysViews = previous7Days.reduce((sum, v) => sum + (v.views || 0), 0);
    // If PP is 0, all CP data is new growth, so show + with CP value
    const viewsGrowthAbsolute = previous7DaysViews === 0 ? last7DaysViews : last7DaysViews - previous7DaysViews;
    const viewsGrowth = previous7DaysViews > 0 
      ? ((last7DaysViews - previous7DaysViews) / previous7DaysViews) * 100 
      : 0;

    const last7DaysLikes = last7Days.reduce((sum, v) => sum + (v.likes || 0), 0);
    const previous7DaysLikes = previous7Days.reduce((sum, v) => sum + (v.likes || 0), 0);
    const likesGrowthAbsolute = previous7DaysLikes === 0 ? last7DaysLikes : last7DaysLikes - previous7DaysLikes;

    const last7DaysComments = last7Days.reduce((sum, v) => sum + (v.comments || 0), 0);
    const previous7DaysComments = previous7Days.reduce((sum, v) => sum + (v.comments || 0), 0);
    const commentsGrowthAbsolute = previous7DaysComments === 0 ? last7DaysComments : last7DaysComments - previous7DaysComments;

    const last7DaysShares = last7Days.reduce((sum, v) => sum + (v.shares || 0), 0);
    const previous7DaysShares = previous7Days.reduce((sum, v) => sum + (v.shares || 0), 0);
    const sharesGrowthAbsolute = previous7DaysShares === 0 ? last7DaysShares : last7DaysShares - previous7DaysShares;

    const last7DaysVideos = last7Days.length;
    const previous7DaysVideos = previous7Days.length;
    const videosGrowthAbsolute = previous7DaysVideos === 0 ? last7DaysVideos : last7DaysVideos - previous7DaysVideos;

    // Calculate engagement rate growth
    const last7DaysEngagement = last7DaysLikes + last7DaysComments + last7DaysShares;
    const previous7DaysEngagement = previous7DaysLikes + previous7DaysComments + previous7DaysShares;
    const last7DaysEngagementRate = last7DaysViews > 0 ? (last7DaysEngagement / last7DaysViews) * 100 : 0;
    const previous7DaysEngagementRate = previous7DaysViews > 0 ? (previous7DaysEngagement / previous7DaysViews) * 100 : 0;
    const engagementRateGrowthAbsolute = previous7DaysEngagementRate === 0 ? last7DaysEngagementRate : last7DaysEngagementRate - previous7DaysEngagementRate;

    // Generate sparkline data based on date filter and metric type
    const generateSparklineData = (metric: 'views' | 'likes' | 'comments' | 'shares' | 'videos' | 'accounts') => {
      const data = [];
      
      // Determine number of data points based on dateFilter
      let numPoints = 30;
      let intervalMs = 24 * 60 * 60 * 1000; // 1 day
      
      // Match the number of points to the actual filtered range
      if (dateFilter === 'today') {
        numPoints = 24;
        intervalMs = 60 * 60 * 1000; // 1 hour
      } else if (dateFilter === 'last7days') {
        numPoints = 7;
        intervalMs = 24 * 60 * 60 * 1000; // 1 day
      } else if (dateFilter === 'last30days') {
        numPoints = 30;
        intervalMs = 24 * 60 * 60 * 1000; // 1 day
      } else if (dateFilter === 'last90days') {
        numPoints = 90;
        intervalMs = 24 * 60 * 60 * 1000; // 1 day
      } else if (timePeriod === 'weeks') {
        numPoints = 12;
        intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week
      } else if (timePeriod === 'months') {
        numPoints = 12;
        intervalMs = 30 * 24 * 60 * 60 * 1000; // ~1 month
      }
      
      // Generate trend showing growth over time
      for (let i = numPoints - 1; i >= 0; i--) {
        const pointDate = new Date(Date.now() - (i * intervalMs));
        const timestamp = pointDate.getTime();
        
        // For hourly data, calculate previous day's same hour value for comparison
        let previousValue: number | undefined;
        if (timePeriod === 'hours' && metric !== 'videos' && metric !== 'accounts') {
          const previousDayDate = new Date(timestamp - (24 * 60 * 60 * 1000));
          let prevDayValue = 0;
          
          submissions.forEach(video => {
            if (video.snapshots && video.snapshots.length > 0) {
              const snapshotAtPrevDay = video.snapshots
                .filter(s => new Date(s.capturedAt) <= previousDayDate)
                .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
              
              if (snapshotAtPrevDay && metric in snapshotAtPrevDay) {
                prevDayValue += (snapshotAtPrevDay as any)[metric] || 0;
              }
            }
          });
          previousValue = prevDayValue;
        }
        
        if (metric === 'videos') {
          // For published videos: count how many videos were published IN THIS INTERVAL
          const nextPointDate = new Date(Date.now() - ((i - 1) * intervalMs));
          const videosPublishedInInterval = submissions.filter(v => {
            const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
            return uploadDate > pointDate && uploadDate <= nextPointDate;
          });
          data.push({ value: videosPublishedInInterval.length, timestamp, previousValue });
        } else if (metric === 'accounts') {
          // For active accounts: count unique accounts that were active IN THIS INTERVAL
          const nextPointDate = new Date(Date.now() - ((i - 1) * intervalMs));
          const videosInInterval = submissions.filter(v => {
            const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
            return uploadDate > pointDate && uploadDate <= nextPointDate;
          });
          const uniqueAccountsInInterval = new Set(videosInInterval.map(v => v.uploaderHandle)).size;
          data.push({ value: uniqueAccountsInInterval, timestamp, previousValue });
        } else {
          // Show per-day/per-hour values (NOT cumulative)
          const nextPointDate = new Date(Date.now() - ((i - 1) * intervalMs));
          
          // Calculate metrics for videos in this specific time interval
          let intervalValue = 0;
          
          submissions.forEach(video => {
            const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
            
            if (video.snapshots && video.snapshots.length > 0) {
              // Get snapshot at the start and end of this interval
              const snapshotAtStart = video.snapshots
                .filter(s => new Date(s.capturedAt) <= pointDate)
                .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
              
              const snapshotAtEnd = video.snapshots
                .filter(s => new Date(s.capturedAt) <= nextPointDate)
                .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
              
              if (snapshotAtStart && snapshotAtEnd) {
                // Calculate the delta for this interval
                const delta = Math.max(0, (snapshotAtEnd[metric] || 0) - (snapshotAtStart[metric] || 0));
                intervalValue += delta;
              } else if (snapshotAtEnd && uploadDate > pointDate && uploadDate <= nextPointDate) {
                // Video was uploaded in this interval
                intervalValue += snapshotAtEnd[metric] || 0;
              }
            } else if (uploadDate > pointDate && uploadDate <= nextPointDate) {
              // Video was uploaded in this interval, no snapshots
              intervalValue += video[metric] || 0;
            }
          });
          
          data.push({ value: intervalValue, timestamp, previousValue });
        }
      }
      return data;
    };

    const formatNumber = (num: number): string => {
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
      return num.toString();
    };

    // Helper to determine if data is trending up or down
    const calculateTrend = (data: Array<{ value: number }> | undefined): boolean => {
      if (!data || data.length < 2) return true; // Default to green if no data
      
      // Compare the average of the first half to the average of the second half
      const midPoint = Math.floor(data.length / 2);
      const firstHalf = data.slice(0, midPoint);
      const secondHalf = data.slice(midPoint);
      
      const firstAvg = firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, d) => sum + d.value, 0) / secondHalf.length;
      
      return secondAvg >= firstAvg; // true = increasing (green), false = decreasing (red)
    };

    // Calculate link clicks growth (last 7 days vs previous 7 days)
    const now7DaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
    const now14DaysAgo = new Date(Date.now() - (14 * 24 * 60 * 60 * 1000));
    const last7DaysClicks = linkClicks.filter(click => new Date(click.timestamp) >= now7DaysAgo).length;
    const previous7DaysClicks = linkClicks.filter(click => {
      const clickDate = new Date(click.timestamp);
      return clickDate >= now14DaysAgo && clickDate < now7DaysAgo;
    }).length;
    const clicksGrowthAbsolute = previous7DaysClicks === 0 ? last7DaysClicks : last7DaysClicks - previous7DaysClicks;

    // Generate sparkline data first so we can calculate trends
    const viewsSparkline = generateSparklineData('views');
    const likesSparkline = generateSparklineData('likes');
    const commentsSparkline = generateSparklineData('comments');
    const sharesSparkline = generateSparklineData('shares');
    const videosSparkline = generateSparklineData('videos');
    const accountsSparkline = generateSparklineData('accounts');

    const cards: KPICardData[] = [
      {
        id: 'views',
        label: 'Views',
        value: formatNumber(totalViews),
        icon: Play,
        accent: 'emerald',
        delta: { value: Math.abs(viewsGrowth), isPositive: viewsGrowth >= 0, absoluteValue: viewsGrowthAbsolute },
        sparklineData: viewsSparkline,
        isIncreasing: calculateTrend(viewsSparkline)
      },
      {
        id: 'likes',
        label: 'Likes',
        value: formatNumber(totalLikes),
        icon: Heart,
        accent: 'pink',
        delta: { value: 0, isPositive: likesGrowthAbsolute >= 0, absoluteValue: likesGrowthAbsolute },
        sparklineData: likesSparkline,
        isIncreasing: calculateTrend(likesSparkline)
      },
      {
        id: 'comments',
        label: 'Comments',
        value: formatNumber(totalComments),
        icon: MessageCircle,
        accent: 'blue',
        delta: { value: 0, isPositive: commentsGrowthAbsolute >= 0, absoluteValue: commentsGrowthAbsolute },
        sparklineData: commentsSparkline,
        isIncreasing: calculateTrend(commentsSparkline)
      },
      {
        id: 'shares',
        label: 'Shares',
        value: formatNumber(totalShares),
        icon: Share2,
        accent: 'orange',
        delta: { value: 0, isPositive: sharesGrowthAbsolute >= 0, absoluteValue: sharesGrowthAbsolute },
        sparklineData: sharesSparkline,
        isIncreasing: calculateTrend(sharesSparkline)
      },
      {
        id: 'videos',
        label: 'Published Videos',
        value: publishedVideos,
        icon: Video,
        accent: 'violet',
        delta: { value: 0, isPositive: videosGrowthAbsolute >= 0, absoluteValue: videosGrowthAbsolute },
        sparklineData: videosSparkline,
        isIncreasing: calculateTrend(videosSparkline)
      },
      {
        id: 'accounts',
        label: 'Active Accounts',
        value: activeAccounts,
        icon: AtSign,
        accent: 'teal',
        sparklineData: accountsSparkline,
        isIncreasing: calculateTrend(accountsSparkline)
      },
      (() => {
        // Generate engagement rate sparkline data (per-day, not cumulative)
        let numPoints = 30;
        let intervalMs = 24 * 60 * 60 * 1000; // 1 day
        
        if (dateFilter === 'today') {
          numPoints = 24;
          intervalMs = 60 * 60 * 1000;
        } else if (dateFilter === 'last7days') {
          numPoints = 7;
        } else if (dateFilter === 'last90days') {
          numPoints = 90;
        }
        
        const data = [];
        for (let i = numPoints - 1; i >= 0; i--) {
          const pointDate = new Date(Date.now() - (i * intervalMs));
          const nextPointDate = new Date(Date.now() - ((i - 1) * intervalMs));
          
          // Calculate engagement rate for ONLY this specific day/period
          let periodViews = 0;
          let periodEngagement = 0;
          
          submissions.forEach(video => {
            const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
            
            if (video.snapshots && video.snapshots.length > 0) {
              // Get snapshots at start and end of interval
              const snapshotAtStart = video.snapshots
                .filter(s => new Date(s.capturedAt) <= pointDate)
                .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
              
              const snapshotAtEnd = video.snapshots
                .filter(s => new Date(s.capturedAt) <= nextPointDate)
                .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
              
              if (snapshotAtStart && snapshotAtEnd) {
                // Calculate delta for this interval
                const viewsDelta = Math.max(0, (snapshotAtEnd.views || 0) - (snapshotAtStart.views || 0));
                const likesDelta = Math.max(0, (snapshotAtEnd.likes || 0) - (snapshotAtStart.likes || 0));
                const commentsDelta = Math.max(0, (snapshotAtEnd.comments || 0) - (snapshotAtStart.comments || 0));
                const sharesDelta = Math.max(0, (snapshotAtEnd.shares || 0) - (snapshotAtStart.shares || 0));
                
                periodViews += viewsDelta;
                periodEngagement += likesDelta + commentsDelta + sharesDelta;
              } else if (snapshotAtEnd && uploadDate > pointDate && uploadDate <= nextPointDate) {
                // Video uploaded in this interval
                periodViews += snapshotAtEnd.views || 0;
                periodEngagement += (snapshotAtEnd.likes || 0) + (snapshotAtEnd.comments || 0) + (snapshotAtEnd.shares || 0);
              }
            } else if (uploadDate > pointDate && uploadDate <= nextPointDate) {
              // Video uploaded in this interval, no snapshots
              periodViews += video.views || 0;
              periodEngagement += (video.likes || 0) + (video.comments || 0) + (video.shares || 0);
            }
          });
          
          const rate = periodViews > 0 ? ((periodEngagement / periodViews) * 100) : 0;
          
          data.push({
            value: Number(rate.toFixed(1)),
            timestamp: pointDate.getTime()
          });
        }
        
        const engagementSparkline = data;
        return {
          id: 'engagementRate',
          label: 'Engagement Rate',
          value: `${engagementRate.toFixed(1)}%`,
          icon: Activity,
          accent: 'violet' as const,
          delta: { value: 0, isPositive: engagementRateGrowthAbsolute >= 0, absoluteValue: engagementRateGrowthAbsolute, isPercentage: true },
          sparklineData: engagementSparkline,
          isIncreasing: calculateTrend(engagementSparkline)
        };
      })(),
      (() => {
        // Generate link clicks sparkline data
        let numPoints = 30;
        let intervalMs = 24 * 60 * 60 * 1000; // 1 day
        
        if (dateFilter === 'today') {
          numPoints = 24;
          intervalMs = 60 * 60 * 1000;
        } else if (dateFilter === 'last7days') {
          numPoints = 7;
        } else if (dateFilter === 'last90days') {
          numPoints = 90;
        }
        
        const data = [];
        for (let i = numPoints - 1; i >= 0; i--) {
          const pointDate = new Date(Date.now() - (i * intervalMs));
          const nextPointDate = new Date(Date.now() - ((i - 1) * intervalMs));
          
          // Count clicks in this time period
          const clicksInPeriod = linkClicks.filter(click => {
            const clickDate = new Date(click.timestamp);
            return clickDate >= pointDate && clickDate < nextPointDate;
          });
          
          data.push({
            value: clicksInPeriod.length,
            timestamp: pointDate.getTime()
          });
        }
        
        const linkClicksSparkline = data;
        const hasClicks = linkClicks.length > 0;
        return {
          id: 'link-clicks',
          label: 'Link Clicks',
          value: formatNumber(linkClicks.length),
          icon: LinkIcon,
          accent: 'slate' as const,
          isEmpty: linkClicks.length === 0,
          ctaText: linkClicks.length === 0 ? 'Create link' : undefined,
          delta: hasClicks ? { value: 0, isPositive: clicksGrowthAbsolute >= 0, absoluteValue: clicksGrowthAbsolute } : undefined,
          sparklineData: linkClicksSparkline,
          isIncreasing: calculateTrend(linkClicksSparkline)
        };
      })()
    ];

    return cards;
  }, [submissions, linkClicks, dateFilter, timePeriod]);

  return (
    <>
      <div className="grid gap-4 md:gap-5 xl:gap-6 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kpiData.map((card) => (
          <KPICard key={card.id} data={card} onClick={() => handleCardClick(card.id)} timePeriod={timePeriod} />
        ))}
      </div>

      <MetricComparisonModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        submissions={submissions}
        linkClicks={linkClicks}
        dateFilter={dateFilter}
        onDateFilterChange={onDateFilterChange}
        initialMetric={selectedMetric}
      />
    </>
  );
};

// Separate component to handle sparkline rendering consistently
const KPISparkline: React.FC<{
  data: Array<{ value: number; timestamp?: number; previousValue?: number }>;
  id: string;
  gradient: string[];
  stroke: string;
  timePeriod?: TimePeriodType;
  totalValue?: string | number;
  metricLabel?: string;
}> = ({ data, id, gradient, stroke, timePeriod = 'days', totalValue, metricLabel }) => {
  
  const formatTooltipDate = (timestamp?: number) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    if (timePeriod === 'hours') {
      const hour = date.getHours();
      const nextHour = (hour + 1) % 24;
      const nextPeriod = nextHour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      const displayNextHour = nextHour % 12 || 12;
      return `${monthNames[date.getMonth()]} ${date.getDate()}, ${displayHour}–${displayNextHour} ${nextPeriod}`;
    } else if (timePeriod === 'weeks') {
      const weekEnd = new Date(timestamp + (6 * 24 * 60 * 60 * 1000));
      return `${monthNames[date.getMonth()]} ${date.getDate()}–${date.getMonth() === weekEnd.getMonth() ? weekEnd.getDate() : monthNames[weekEnd.getMonth()] + ' ' + weekEnd.getDate()}`;
    } else if (timePeriod === 'months') {
      return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    } else {
      // Default to days format (for 'days' or any other case)
      return `${monthNames[date.getMonth()]} ${date.getDate()}`;
    }
  };
  
  return (
    <ResponsiveContainer width="100%" height={56}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradient[0]} stopOpacity={0.3} />
            <stop offset="100%" stopColor={gradient[1]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          offset={15}
          allowEscapeViewBox={{ x: false, y: true }}
          wrapperStyle={{ 
            zIndex: 99999,
            position: 'fixed'
          }}
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              const value = data.value;
              const timestamp = data.timestamp;
              const previousValue = data.previousValue;
              
              const dateStr = formatTooltipDate(timestamp);
              const showComparison = timePeriod === 'hours' && previousValue !== undefined;
              
              const diff = previousValue !== undefined ? value - previousValue : 0;
              let trendText = '';
              if (showComparison && previousValue !== undefined) {
                const percentChange = previousValue > 0 ? ((diff / previousValue) * 100).toFixed(1) : '0';
                const isPositive = diff >= 0;
                const trendIcon = isPositive ? '↑' : '↓';
                trendText = `${trendIcon} ${Math.abs(Number(percentChange))}% vs yesterday`;
              }
              
              // Format value based on metric type
              const isEngagementRate = id === 'engagementRate';
              
              // Helper function to format numbers (1M, 200K, etc.)
              const formatDisplayNumber = (num: number): string => {
                if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
                if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
                return num.toLocaleString();
              };
              
              const displayValue = isEngagementRate 
                ? `${value?.toLocaleString()}%` 
                : formatDisplayNumber(value);
              
              // Format the total value with metric label (uppercase)
              const totalDisplay = totalValue && metricLabel 
                ? `total: ${totalValue} ${metricLabel.toUpperCase()}` 
                : null;
              
              return (
                <div className="bg-gray-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-lg shadow-2xl text-sm space-y-1.5 min-w-[220px] border border-white/20 pointer-events-none" style={{ zIndex: 999999, position: 'relative' }}>
                  {/* Always show total if available */}
                  {totalDisplay && (
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                      {totalDisplay}
                    </p>
                  )}
                  {/* Show date and per-day value */}
                  {dateStr ? (
                    <p className="text-sm text-gray-200 font-medium">
                      {dateStr}: <span className="text-white font-semibold">{displayValue} {metricLabel?.toLowerCase()}</span>
                    </p>
                  ) : (
                    <p className="font-semibold text-lg">{displayValue}</p>
                  )}
                  {/* Show trend comparison if available */}
                  {showComparison && trendText && (
                    <p className={`text-xs font-medium ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trendText}
                    </p>
                  )}
                </div>
              );
            }
            return null;
          }}
          cursor={{ stroke: stroke, strokeWidth: 1, strokeDasharray: '3 3' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={2}
          fill={`url(#gradient-${id})`}
          isAnimationActive={false}
          dot={false}
          activeDot={{ r: 4, fill: stroke, strokeWidth: 2, stroke: '#fff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

const KPICard: React.FC<{ data: KPICardData; onClick?: () => void; timePeriod?: TimePeriodType }> = ({ data, onClick, timePeriod = 'days' }) => {
  const formatDeltaNumber = (num: number): string => {
    const absNum = Math.abs(num);
    if (absNum >= 1000000) return `${(absNum / 1000000).toFixed(1)}M`;
    if (absNum >= 1000) return `${(absNum / 1000).toFixed(1)}K`;
    return absNum.toString();
  };

  // Determine colors based on trend (green for increase, red for decrease)
  const isIncreasing = data.isIncreasing !== undefined ? data.isIncreasing : true;
  const colors = {
    icon: 'bg-white/5',
    iconColor: 'text-white',
    gradient: isIncreasing ? ['#22c55e', '#22c55e00'] : ['#ef4444', '#ef444400'], // green-500 : red-500
    stroke: isIncreasing ? '#22c55e' : '#ef4444',
    deltaBg: 'bg-white/10 text-white'
  };

  const Icon = data.icon;

  return (
    <div 
      onClick={onClick}
      className="group relative min-h-[8rem] rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg hover:shadow-xl hover:ring-1 hover:ring-white/10 transition-all duration-300 p-4 lg:p-5 cursor-pointer">
      
      {/* Delta Indicator (top-right) */}
      {data.delta && data.delta.absoluteValue !== undefined && (
        <div className="absolute top-4 right-4">
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-white">
            {data.delta.isPositive ? '+' : '-'}
            {data.delta.isPercentage 
              ? `${Math.abs(data.delta.absoluteValue).toFixed(2)}%`
              : formatDeltaNumber(data.delta.absoluteValue)}
          </span>
        </div>
      )}

      {/* CTA Button (top-right, if no delta) */}
      {!data.delta && data.ctaText && (
        <button className="absolute top-4 right-4 inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-xs text-zinc-300/90 bg-white/5 hover:bg-white/10 transition-colors">
          {data.ctaText}
          <ChevronRight className="w-3 h-3" />
        </button>
      )}

      <div className="flex items-start justify-between h-full">
        {/* Left: Text Stack */}
        <div className="flex-1 flex flex-col justify-between min-h-full">
          <div>
            {/* Icon + Label */}
            <div className="flex items-center gap-2.5 mb-3">
              <Icon className={`w-5 h-5 ${colors.iconColor}`} />
              <span className="text-sm font-medium text-zinc-300">{data.label}</span>
            </div>

            {/* Value */}
            <div className="flex items-baseline gap-2 mb-1">
              <span className={`text-3xl font-bold ${data.isEmpty ? 'text-zinc-500' : 'text-white'}`}>
                {data.value}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Sparkline */}
        {data.sparklineData && (
          <div className="w-[40%] h-full flex items-center ml-2">
            <KPISparkline
              data={data.sparklineData}
              id={data.id}
              gradient={colors.gradient}
              stroke={colors.stroke}
              timePeriod={timePeriod}
              totalValue={data.value}
              metricLabel={data.label}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default KPICards;
