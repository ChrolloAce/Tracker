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
  customRange?: { startDate: Date; endDate: Date };
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
  customRange,
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
    
    // Check for custom range first
    if (dateFilter === 'custom' && customRange) {
      dateRangeStart = new Date(customRange.startDate);
      dateRangeStart.setHours(0, 0, 0, 0); // Start of day
      dateRangeEnd = new Date(customRange.endDate);
      dateRangeEnd.setHours(23, 59, 59, 999); // End of day
    } else if (dateFilter === 'today') {
      dateRangeStart = new Date();
      dateRangeStart.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'yesterday') {
      dateRangeStart = new Date();
      dateRangeStart.setDate(dateRangeStart.getDate() - 1);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date();
      dateRangeEnd.setDate(dateRangeEnd.getDate() - 1);
      dateRangeEnd.setHours(23, 59, 59, 999);
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
    
    // Calculate metrics based on date filter
    // KEY: Show ALL activity during the period, regardless of when videos were uploaded
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    
    if (dateRangeStart) {
      // For specific date ranges, calculate growth during the period from ALL videos
      submissions.forEach(video => {
        const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
        
        if (video.snapshots && video.snapshots.length > 0) {
          // Get the snapshot closest to (but before or at) the range start
          const snapshotBeforeOrAtStart = video.snapshots
            .filter(s => new Date(s.capturedAt) <= dateRangeStart!)
            .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
          
          // Get the snapshot closest to (but before or at) the range end
          const snapshotBeforeOrAtEnd = video.snapshots
            .filter(s => new Date(s.capturedAt) <= dateRangeEnd)
            .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
          
          // Get snapshots that are WITHIN the date range
          const snapshotsInRange = video.snapshots.filter(s => {
            const capturedDate = new Date(s.capturedAt);
            return capturedDate >= dateRangeStart! && capturedDate <= dateRangeEnd;
          });
          
          if (snapshotBeforeOrAtStart && snapshotBeforeOrAtEnd && snapshotBeforeOrAtStart !== snapshotBeforeOrAtEnd) {
            // Both snapshots exist and they're different - calculate growth between them
            totalViews += Math.max(0, (snapshotBeforeOrAtEnd.views || 0) - (snapshotBeforeOrAtStart.views || 0));
            totalLikes += Math.max(0, (snapshotBeforeOrAtEnd.likes || 0) - (snapshotBeforeOrAtStart.likes || 0));
            totalComments += Math.max(0, (snapshotBeforeOrAtEnd.comments || 0) - (snapshotBeforeOrAtStart.comments || 0));
            totalShares += Math.max(0, (snapshotBeforeOrAtEnd.shares || 0) - (snapshotBeforeOrAtStart.shares || 0));
          } else if (snapshotBeforeOrAtStart && snapshotBeforeOrAtEnd && snapshotBeforeOrAtStart === snapshotBeforeOrAtEnd && snapshotsInRange.length > 0) {
            // Both snapshots are the SAME (no new snapshot after period start), but we have snapshots WITHIN the period
            // This can happen when the last snapshot was taken just before the period, and there are snapshots during the period
            const sortedSnapshotsInRange = snapshotsInRange.sort((a, b) => 
              new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
            );
            
            const lastSnapshotInRange = sortedSnapshotsInRange[sortedSnapshotsInRange.length - 1];
            
            // Calculate growth from the snapshot before the period to the last snapshot in the period
            totalViews += Math.max(0, (lastSnapshotInRange.views || 0) - (snapshotBeforeOrAtStart.views || 0));
            totalLikes += Math.max(0, (lastSnapshotInRange.likes || 0) - (snapshotBeforeOrAtStart.likes || 0));
            totalComments += Math.max(0, (lastSnapshotInRange.comments || 0) - (snapshotBeforeOrAtStart.comments || 0));
            totalShares += Math.max(0, (lastSnapshotInRange.shares || 0) - (snapshotBeforeOrAtStart.shares || 0));
          } else if (!snapshotBeforeOrAtStart && snapshotsInRange.length > 0) {
            // No snapshot before period start, but we have snapshots IN the period
            // This means either: video was uploaded during period, OR we're missing historical snapshots
            
            // Sort snapshots in range by date
            const sortedSnapshotsInRange = snapshotsInRange.sort((a, b) => 
              new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
            );
            
            const firstSnapshotInRange = sortedSnapshotsInRange[0];
            const lastSnapshotInRange = sortedSnapshotsInRange[sortedSnapshotsInRange.length - 1];
            
            if (uploadDate >= dateRangeStart && uploadDate <= dateRangeEnd) {
              // Video was uploaded during this period - count full value from last snapshot
              totalViews += lastSnapshotInRange.views || 0;
              totalLikes += lastSnapshotInRange.likes || 0;
              totalComments += lastSnapshotInRange.comments || 0;
              totalShares += lastSnapshotInRange.shares || 0;
            } else {
              // Video was uploaded BEFORE the period, but we only have snapshots from within the period
              // Calculate growth from first to last snapshot in the range
              totalViews += Math.max(0, (lastSnapshotInRange.views || 0) - (firstSnapshotInRange.views || 0));
              totalLikes += Math.max(0, (lastSnapshotInRange.likes || 0) - (firstSnapshotInRange.likes || 0));
              totalComments += Math.max(0, (lastSnapshotInRange.comments || 0) - (firstSnapshotInRange.comments || 0));
              totalShares += Math.max(0, (lastSnapshotInRange.shares || 0) - (firstSnapshotInRange.shares || 0));
            }
          } else if (!snapshotBeforeOrAtStart && !snapshotBeforeOrAtEnd) {
            // No snapshots before the range end at all
            if (uploadDate >= dateRangeStart && uploadDate <= dateRangeEnd) {
              // Video was uploaded during the period - use current metrics
              totalViews += video.views || 0;
              totalLikes += video.likes || 0;
              totalComments += video.comments || 0;
              totalShares += video.shares || 0;
            }
          }
          // If snapshotBeforeOrAtStart exists but not snapshotBeforeOrAtEnd, 
          // it means there are no new snapshots during the period, so no growth to count
        } else {
          // No snapshots at all
          if (uploadDate >= dateRangeStart && uploadDate <= dateRangeEnd) {
            // Video was uploaded during this period - count current metrics
            totalViews += video.views || 0;
            totalLikes += video.likes || 0;
            totalComments += video.comments || 0;
            totalShares += video.shares || 0;
          }
          // If video was uploaded before the period and has no snapshots, we can't track growth
        }
      });
    } else {
      // For 'all' time filter, use current metrics
      totalViews = submissions.reduce((sum, v) => sum + (v.views || 0), 0);
      totalLikes = submissions.reduce((sum, v) => sum + (v.likes || 0), 0);
      totalComments = submissions.reduce((sum, v) => sum + (v.comments || 0), 0);
      totalShares = submissions.reduce((sum, v) => sum + (v.shares || 0), 0);
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

    // Calculate delta (CP vs PP) based on the selected date filter
    // CP = Current Period, PP = Previous Period (same length as CP, immediately before it)
    
    // Calculate the previous period's date range
    let ppDateRangeStart: Date | null = null;
    let ppDateRangeEnd: Date | null = null;
    
    if (dateRangeStart) {
      const periodLength = dateRangeEnd.getTime() - dateRangeStart.getTime();
      ppDateRangeEnd = new Date(dateRangeStart.getTime() - 1); // End of PP is 1ms before start of CP
      ppDateRangeStart = new Date(ppDateRangeEnd.getTime() - periodLength);
    }
    
    // Calculate PP metrics using the same logic as CP
    // Show ALL activity during the previous period, regardless of when videos were uploaded
    let ppViews = 0;
    let ppLikes = 0;
    let ppComments = 0;
    let ppShares = 0;
    let ppVideos = 0;
    
    if (ppDateRangeStart && ppDateRangeEnd) {
      submissions.forEach(video => {
        const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
        
        if (video.snapshots && video.snapshots.length > 0) {
          // Get the snapshot closest to (but before or at) the PP range start
          const snapshotBeforeOrAtStart = video.snapshots
            .filter(s => new Date(s.capturedAt) <= ppDateRangeStart!)
            .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
          
          // Get the snapshot closest to (but before or at) the PP range end
          const snapshotBeforeOrAtEnd = video.snapshots
            .filter(s => new Date(s.capturedAt) <= ppDateRangeEnd!)
            .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
          
          // Get snapshots that are WITHIN the PP date range
          const snapshotsInRange = video.snapshots.filter(s => {
            const capturedDate = new Date(s.capturedAt);
            return capturedDate >= ppDateRangeStart! && capturedDate <= ppDateRangeEnd!;
          });
          
          if (snapshotBeforeOrAtStart && snapshotBeforeOrAtEnd && snapshotBeforeOrAtStart !== snapshotBeforeOrAtEnd) {
            // Both snapshots exist and they're different - calculate growth between them
            ppViews += Math.max(0, (snapshotBeforeOrAtEnd.views || 0) - (snapshotBeforeOrAtStart.views || 0));
            ppLikes += Math.max(0, (snapshotBeforeOrAtEnd.likes || 0) - (snapshotBeforeOrAtStart.likes || 0));
            ppComments += Math.max(0, (snapshotBeforeOrAtEnd.comments || 0) - (snapshotBeforeOrAtStart.comments || 0));
            ppShares += Math.max(0, (snapshotBeforeOrAtEnd.shares || 0) - (snapshotBeforeOrAtStart.shares || 0));
          } else if (snapshotBeforeOrAtStart && snapshotBeforeOrAtEnd && snapshotBeforeOrAtStart === snapshotBeforeOrAtEnd && snapshotsInRange.length > 0) {
            // Both snapshots are the SAME, but we have snapshots WITHIN the PP period
            const sortedSnapshotsInRange = snapshotsInRange.sort((a, b) => 
              new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
            );
            
            const lastSnapshotInRange = sortedSnapshotsInRange[sortedSnapshotsInRange.length - 1];
            
            // Calculate growth from the snapshot before PP to the last snapshot in PP
            ppViews += Math.max(0, (lastSnapshotInRange.views || 0) - (snapshotBeforeOrAtStart.views || 0));
            ppLikes += Math.max(0, (lastSnapshotInRange.likes || 0) - (snapshotBeforeOrAtStart.likes || 0));
            ppComments += Math.max(0, (lastSnapshotInRange.comments || 0) - (snapshotBeforeOrAtStart.comments || 0));
            ppShares += Math.max(0, (lastSnapshotInRange.shares || 0) - (snapshotBeforeOrAtStart.shares || 0));
          } else if (!snapshotBeforeOrAtStart && snapshotsInRange.length > 0) {
            // No snapshot before period start, but we have snapshots IN the period
            const sortedSnapshotsInRange = snapshotsInRange.sort((a, b) => 
              new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
            );
            
            const firstSnapshotInRange = sortedSnapshotsInRange[0];
            const lastSnapshotInRange = sortedSnapshotsInRange[sortedSnapshotsInRange.length - 1];
            
            if (uploadDate >= ppDateRangeStart! && uploadDate <= ppDateRangeEnd!) {
              // Video was uploaded during PP - count full value from last snapshot
              ppViews += lastSnapshotInRange.views || 0;
              ppLikes += lastSnapshotInRange.likes || 0;
              ppComments += lastSnapshotInRange.comments || 0;
              ppShares += lastSnapshotInRange.shares || 0;
            } else {
              // Video was uploaded BEFORE PP, but we only have snapshots from within PP
              ppViews += Math.max(0, (lastSnapshotInRange.views || 0) - (firstSnapshotInRange.views || 0));
              ppLikes += Math.max(0, (lastSnapshotInRange.likes || 0) - (firstSnapshotInRange.likes || 0));
              ppComments += Math.max(0, (lastSnapshotInRange.comments || 0) - (firstSnapshotInRange.comments || 0));
              ppShares += Math.max(0, (lastSnapshotInRange.shares || 0) - (firstSnapshotInRange.shares || 0));
            }
          } else if (!snapshotBeforeOrAtStart && !snapshotBeforeOrAtEnd) {
            // No snapshots before the range end
            if (uploadDate >= ppDateRangeStart! && uploadDate <= ppDateRangeEnd!) {
              ppViews += video.views || 0;
              ppLikes += video.likes || 0;
              ppComments += video.comments || 0;
              ppShares += video.shares || 0;
            }
          }
        } else {
          // No snapshots at all
          if (uploadDate >= ppDateRangeStart! && uploadDate <= ppDateRangeEnd!) {
            ppViews += video.views || 0;
            ppLikes += video.likes || 0;
            ppComments += video.comments || 0;
            ppShares += video.shares || 0;
          }
        }
      });
      
      // Count videos published in PP
      ppVideos = submissions.filter(v => {
        const uploadDate = new Date(v.uploadDate || v.dateSubmitted);
        return uploadDate >= ppDateRangeStart! && uploadDate <= ppDateRangeEnd!;
      }).length;
    }

    // Calculate deltas (CP - PP)
    const viewsGrowthAbsolute = ppViews === 0 ? totalViews : totalViews - ppViews;
    const viewsGrowth = ppViews > 0 ? ((totalViews - ppViews) / ppViews) * 100 : 0;
    
    const likesGrowthAbsolute = ppLikes === 0 ? totalLikes : totalLikes - ppLikes;
    const commentsGrowthAbsolute = ppComments === 0 ? totalComments : totalComments - ppComments;
    const sharesGrowthAbsolute = ppShares === 0 ? totalShares : totalShares - ppShares;
    const videosGrowthAbsolute = ppVideos === 0 ? publishedVideos : publishedVideos - ppVideos;

    // Calculate engagement rate for PP
    const ppEngagement = ppLikes + ppComments;
    const ppEngagementRate = ppViews > 0 ? (ppEngagement / ppViews) * 100 : 0;
    const engagementRateGrowthAbsolute = ppEngagementRate === 0 ? engagementRate : engagementRate - ppEngagementRate;

    // Generate sparkline data based on date filter and metric type
    const generateSparklineData = (metric: 'views' | 'likes' | 'comments' | 'shares' | 'videos' | 'accounts') => {
      const data = [];
      
      // Calculate the actual date range and determine appropriate intervals
      let actualStartDate: Date;
      let actualEndDate: Date = new Date();
      let numPoints = 30;
      let intervalMs = 24 * 60 * 60 * 1000; // 1 day
      
      if (dateRangeStart) {
        actualStartDate = new Date(dateRangeStart);
        actualEndDate = new Date(dateRangeEnd);
        
        // Calculate the range duration in days
        const rangeDurationMs = actualEndDate.getTime() - actualStartDate.getTime();
        const rangeDurationDays = rangeDurationMs / (24 * 60 * 60 * 1000);
        
        // Determine appropriate granularity based on range
        if (rangeDurationDays <= 1) {
          // For 1 day or less (today, yesterday), use hourly intervals
          numPoints = 24;
          intervalMs = 60 * 60 * 1000; // 1 hour
        } else if (rangeDurationDays <= 7) {
          // For up to 7 days, use daily intervals
          numPoints = Math.ceil(rangeDurationDays);
          intervalMs = 24 * 60 * 60 * 1000; // 1 day
        } else if (rangeDurationDays <= 31) {
          // For up to a month, use daily intervals
          numPoints = Math.ceil(rangeDurationDays);
          intervalMs = 24 * 60 * 60 * 1000; // 1 day
        } else if (rangeDurationDays <= 90) {
          // For up to 90 days, use daily intervals (might show many points)
          numPoints = Math.ceil(rangeDurationDays);
          intervalMs = 24 * 60 * 60 * 1000; // 1 day
        } else if (rangeDurationDays <= 180) {
          // For up to 180 days (6 months), use weekly intervals
          numPoints = Math.ceil(rangeDurationDays / 7);
          intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week
        } else if (rangeDurationDays <= 365) {
          // For up to a year, use weekly intervals
          numPoints = Math.ceil(rangeDurationDays / 7);
          intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week
        } else {
          // For more than a year, use monthly intervals
          numPoints = Math.ceil(rangeDurationDays / 30);
          intervalMs = 30 * 24 * 60 * 60 * 1000; // ~1 month
        }
        
        // Cap numPoints to reasonable limits for display
        if (numPoints > 90) {
          // If we have too many points, adjust to weekly intervals
          numPoints = Math.min(52, Math.ceil(rangeDurationDays / 7));
          intervalMs = 7 * 24 * 60 * 60 * 1000;
        }
      } else {
        // For 'all' time filter, use last 30 days as default
        actualStartDate = new Date();
        actualStartDate.setDate(actualStartDate.getDate() - 30);
        numPoints = 30;
        intervalMs = 24 * 60 * 60 * 1000;
      }
      
      // Determine the starting point for data generation
      let startTime: number = actualStartDate.getTime();
      
      // Generate trend showing growth over time
      for (let i = 0; i < numPoints; i++) {
        const pointDate = new Date(startTime + (i * intervalMs));
        const nextPointDate = new Date(startTime + ((i + 1) * intervalMs));
        const timestamp = pointDate.getTime();
        
        // For hourly data, calculate previous day's same hour value for comparison
        let previousValue: number | undefined;
        if (intervalMs === 60 * 60 * 1000 && metric !== 'videos' && metric !== 'accounts') {
          // This is hourly data
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
          const videosPublishedInInterval = submissions.filter(v => {
            const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
            return uploadDate >= pointDate && uploadDate < nextPointDate;
          });
          data.push({ value: videosPublishedInInterval.length, timestamp, previousValue });
        } else if (metric === 'accounts') {
          // For active accounts: count unique accounts that were active IN THIS INTERVAL
          const videosInInterval = submissions.filter(v => {
            const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
            return uploadDate >= pointDate && uploadDate < nextPointDate;
          });
          const uniqueAccountsInInterval = new Set(videosInInterval.map(v => v.uploaderHandle)).size;
          data.push({ value: uniqueAccountsInInterval, timestamp, previousValue });
        } else {
          // Show per-interval values (NOT cumulative)
          let intervalValue = 0;
          
          submissions.forEach(video => {
            const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
            
            // Only process videos that are relevant to the date range we're analyzing
            if (uploadDate < actualStartDate) {
              // Video was uploaded before our analysis period
              // Check if it has growth during this interval via snapshots
              if (video.snapshots && video.snapshots.length > 0) {
                const snapshotAtStart = video.snapshots
                  .filter(s => new Date(s.capturedAt) <= pointDate)
                  .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
                
                const snapshotAtEnd = video.snapshots
                  .filter(s => new Date(s.capturedAt) <= nextPointDate)
                  .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
                
                if (snapshotAtStart && snapshotAtEnd && snapshotAtStart !== snapshotAtEnd) {
                  const delta = Math.max(0, (snapshotAtEnd[metric] || 0) - (snapshotAtStart[metric] || 0));
                  intervalValue += delta;
                }
              }
            } else if (uploadDate >= pointDate && uploadDate < nextPointDate) {
              // Video was uploaded during this interval
              // Use either the first snapshot or current value
              if (video.snapshots && video.snapshots.length > 0) {
                const firstSnapshot = video.snapshots
                  .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())[0];
                intervalValue += firstSnapshot[metric] || 0;
              } else {
                // No snapshots, use current value
                intervalValue += video[metric] || 0;
              }
            } else if (uploadDate >= nextPointDate) {
              // Video was uploaded after this interval, skip it
              return;
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

    // Calculate link clicks growth using the same CP vs PP logic
    let cpClicks = 0;
    let ppClicks = 0;
    
    if (dateRangeStart) {
      // Count clicks in Current Period (CP)
      cpClicks = linkClicks.filter(click => {
        const clickDate = new Date(click.timestamp);
        return clickDate >= dateRangeStart! && clickDate <= dateRangeEnd;
      }).length;
      
      // Count clicks in Previous Period (PP)
      if (ppDateRangeStart && ppDateRangeEnd) {
        ppClicks = linkClicks.filter(click => {
          const clickDate = new Date(click.timestamp);
          return clickDate >= ppDateRangeStart! && clickDate <= ppDateRangeEnd!;
        }).length;
      }
    } else {
      // For 'all' time, use total clicks (no PP comparison)
      cpClicks = linkClicks.length;
    }
    
    const clicksGrowthAbsolute = ppClicks === 0 ? cpClicks : cpClicks - ppClicks;

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
        isIncreasing: viewsGrowthAbsolute >= 0 // Use delta, not sparkline trend
      },
      {
        id: 'likes',
        label: 'Likes',
        value: formatNumber(totalLikes),
        icon: Heart,
        accent: 'pink',
        delta: { value: 0, isPositive: likesGrowthAbsolute >= 0, absoluteValue: likesGrowthAbsolute },
        sparklineData: likesSparkline,
        isIncreasing: likesGrowthAbsolute >= 0 // Use delta, not sparkline trend
      },
      {
        id: 'comments',
        label: 'Comments',
        value: formatNumber(totalComments),
        icon: MessageCircle,
        accent: 'blue',
        delta: { value: 0, isPositive: commentsGrowthAbsolute >= 0, absoluteValue: commentsGrowthAbsolute },
        sparklineData: commentsSparkline,
        isIncreasing: commentsGrowthAbsolute >= 0 // Use delta, not sparkline trend
      },
      {
        id: 'shares',
        label: 'Shares',
        value: formatNumber(totalShares),
        icon: Share2,
        accent: 'orange',
        delta: { value: 0, isPositive: sharesGrowthAbsolute >= 0, absoluteValue: sharesGrowthAbsolute },
        sparklineData: sharesSparkline,
        isIncreasing: sharesGrowthAbsolute >= 0 // Use delta, not sparkline trend
      },
      {
        id: 'videos',
        label: 'Published Videos',
        value: publishedVideos,
        icon: Video,
        accent: 'violet',
        delta: { value: 0, isPositive: videosGrowthAbsolute >= 0, absoluteValue: videosGrowthAbsolute },
        sparklineData: videosSparkline,
        isIncreasing: videosGrowthAbsolute >= 0 // Use delta, not sparkline trend
      },
      {
        id: 'accounts',
        label: 'Active Accounts',
        value: activeAccounts,
        icon: AtSign,
        accent: 'teal',
        sparklineData: accountsSparkline,
        isIncreasing: true // Default to green for accounts (no delta calculated)
      },
      (() => {
        // Generate engagement rate sparkline data (per-interval, not cumulative)
        let actualStartDate: Date;
        let actualEndDate: Date = new Date();
        let numPoints = 30;
        let intervalMs = 24 * 60 * 60 * 1000; // 1 day
        
        if (dateRangeStart) {
          actualStartDate = new Date(dateRangeStart);
          actualEndDate = new Date(dateRangeEnd);
          
          // Calculate the range duration in days
          const rangeDurationMs = actualEndDate.getTime() - actualStartDate.getTime();
          const rangeDurationDays = rangeDurationMs / (24 * 60 * 60 * 1000);
          
          // Determine appropriate granularity based on range (same as other metrics)
          if (rangeDurationDays <= 1) {
            numPoints = 24;
            intervalMs = 60 * 60 * 1000; // 1 hour
          } else if (rangeDurationDays <= 7) {
            numPoints = Math.ceil(rangeDurationDays);
            intervalMs = 24 * 60 * 60 * 1000; // 1 day
          } else if (rangeDurationDays <= 31) {
            numPoints = Math.ceil(rangeDurationDays);
            intervalMs = 24 * 60 * 60 * 1000; // 1 day
          } else if (rangeDurationDays <= 90) {
            numPoints = Math.ceil(rangeDurationDays);
            intervalMs = 24 * 60 * 60 * 1000; // 1 day
          } else if (rangeDurationDays <= 180) {
            numPoints = Math.ceil(rangeDurationDays / 7);
            intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week
          } else if (rangeDurationDays <= 365) {
            numPoints = Math.ceil(rangeDurationDays / 7);
            intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week
          } else {
            numPoints = Math.ceil(rangeDurationDays / 30);
            intervalMs = 30 * 24 * 60 * 60 * 1000; // ~1 month
          }
          
          // Cap numPoints to reasonable limits for display
          if (numPoints > 90) {
            numPoints = Math.min(52, Math.ceil(rangeDurationDays / 7));
            intervalMs = 7 * 24 * 60 * 60 * 1000;
          }
        } else {
          // For 'all' time filter, use last 30 days as default
          actualStartDate = new Date();
          actualStartDate.setDate(actualStartDate.getDate() - 30);
          numPoints = 30;
          intervalMs = 24 * 60 * 60 * 1000;
        }
        
        // Determine the starting point for data generation
        let startTime: number = actualStartDate.getTime();
        
        const data = [];
        for (let i = 0; i < numPoints; i++) {
          const pointDate = new Date(startTime + (i * intervalMs));
          const nextPointDate = new Date(startTime + ((i + 1) * intervalMs));
          
          // Calculate engagement rate for ONLY this specific interval
          let periodViews = 0;
          let periodEngagement = 0;
          
          submissions.forEach(video => {
            const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
            
            // Only process videos that are relevant to the date range we're analyzing
            if (uploadDate < actualStartDate) {
              // Video was uploaded before our analysis period
              // Check if it has growth during this interval via snapshots
              if (video.snapshots && video.snapshots.length > 0) {
                const snapshotAtStart = video.snapshots
                  .filter(s => new Date(s.capturedAt) <= pointDate)
                  .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
                
                const snapshotAtEnd = video.snapshots
                  .filter(s => new Date(s.capturedAt) <= nextPointDate)
                  .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
                
                if (snapshotAtStart && snapshotAtEnd && snapshotAtStart !== snapshotAtEnd) {
                  const viewsDelta = Math.max(0, (snapshotAtEnd.views || 0) - (snapshotAtStart.views || 0));
                  const likesDelta = Math.max(0, (snapshotAtEnd.likes || 0) - (snapshotAtStart.likes || 0));
                  const commentsDelta = Math.max(0, (snapshotAtEnd.comments || 0) - (snapshotAtStart.comments || 0));
                  const sharesDelta = Math.max(0, (snapshotAtEnd.shares || 0) - (snapshotAtStart.shares || 0));
                  
                  periodViews += viewsDelta;
                  periodEngagement += likesDelta + commentsDelta + sharesDelta;
                }
              }
            } else if (uploadDate >= pointDate && uploadDate < nextPointDate) {
              // Video was uploaded during this interval
              // Use either the first snapshot or current value
              if (video.snapshots && video.snapshots.length > 0) {
                const firstSnapshot = video.snapshots
                  .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())[0];
                periodViews += firstSnapshot.views || 0;
                periodEngagement += (firstSnapshot.likes || 0) + (firstSnapshot.comments || 0) + (firstSnapshot.shares || 0);
              } else {
                // No snapshots, use current value
                periodViews += video.views || 0;
                periodEngagement += (video.likes || 0) + (video.comments || 0) + (video.shares || 0);
              }
            } else if (uploadDate >= nextPointDate) {
              // Video was uploaded after this interval, skip it
              return;
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
          isIncreasing: engagementRateGrowthAbsolute >= 0 // Use delta, not sparkline trend
        };
      })(),
      (() => {
        // Generate link clicks sparkline data
        let actualStartDate: Date;
        let actualEndDate: Date = new Date();
        let numPoints = 30;
        let intervalMs = 24 * 60 * 60 * 1000; // 1 day
        
        if (dateRangeStart) {
          actualStartDate = new Date(dateRangeStart);
          actualEndDate = new Date(dateRangeEnd);
          
          // Calculate the range duration in days
          const rangeDurationMs = actualEndDate.getTime() - actualStartDate.getTime();
          const rangeDurationDays = rangeDurationMs / (24 * 60 * 60 * 1000);
          
          // Determine appropriate granularity based on range (same as other metrics)
          if (rangeDurationDays <= 1) {
            numPoints = 24;
            intervalMs = 60 * 60 * 1000; // 1 hour
          } else if (rangeDurationDays <= 7) {
            numPoints = Math.ceil(rangeDurationDays);
            intervalMs = 24 * 60 * 60 * 1000; // 1 day
          } else if (rangeDurationDays <= 31) {
            numPoints = Math.ceil(rangeDurationDays);
            intervalMs = 24 * 60 * 60 * 1000; // 1 day
          } else if (rangeDurationDays <= 90) {
            numPoints = Math.ceil(rangeDurationDays);
            intervalMs = 24 * 60 * 60 * 1000; // 1 day
          } else if (rangeDurationDays <= 180) {
            numPoints = Math.ceil(rangeDurationDays / 7);
            intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week
          } else if (rangeDurationDays <= 365) {
            numPoints = Math.ceil(rangeDurationDays / 7);
            intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week
          } else {
            numPoints = Math.ceil(rangeDurationDays / 30);
            intervalMs = 30 * 24 * 60 * 60 * 1000; // ~1 month
          }
          
          // Cap numPoints to reasonable limits for display
          if (numPoints > 90) {
            numPoints = Math.min(52, Math.ceil(rangeDurationDays / 7));
            intervalMs = 7 * 24 * 60 * 60 * 1000;
          }
        } else {
          // For 'all' time filter, use last 30 days as default
          actualStartDate = new Date();
          actualStartDate.setDate(actualStartDate.getDate() - 30);
          numPoints = 30;
          intervalMs = 24 * 60 * 60 * 1000;
        }
        
        // Determine the starting point for data generation
        let startTime: number = actualStartDate.getTime();
        
        const data = [];
        for (let i = 0; i < numPoints; i++) {
          const pointDate = new Date(startTime + (i * intervalMs));
          const nextPointDate = new Date(startTime + ((i + 1) * intervalMs));
          
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
        const hasClicks = cpClicks > 0 || linkClicks.length > 0;
        const displayClicks = dateRangeStart ? cpClicks : linkClicks.length;
        return {
          id: 'link-clicks',
          label: 'Link Clicks',
          value: formatNumber(displayClicks),
          icon: LinkIcon,
          accent: 'slate' as const,
          isEmpty: displayClicks === 0,
          ctaText: displayClicks === 0 ? 'Create link' : undefined,
          delta: hasClicks ? { value: 0, isPositive: clicksGrowthAbsolute >= 0, absoluteValue: clicksGrowthAbsolute } : undefined,
          sparklineData: linkClicksSparkline,
          isIncreasing: hasClicks ? clicksGrowthAbsolute >= 0 : true // Use delta, not sparkline trend
        };
      })()
    ];

    return cards;
  }, [submissions, linkClicks, dateFilter, customRange, timePeriod]);

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
        customRange={customRange}
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
          position={{ y: -60 }}
          offset={40}
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
                <div className="bg-[#1a1a1a] backdrop-blur-xl text-white px-5 py-3 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-sm space-y-2 min-w-[240px] border border-white/10 pointer-events-none" style={{ zIndex: 999999, position: 'relative' }}>
                  {/* Always show total if available */}
                  {totalDisplay && (
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                      {totalDisplay}
                    </p>
                  )}
                  {/* Show date and per-day value */}
                  {dateStr ? (
                    <p className="text-sm text-gray-300 font-medium">
                      {dateStr}: <span className="text-white font-bold">{displayValue} {metricLabel?.toLowerCase()}</span>
                    </p>
                  ) : (
                    <p className="font-bold text-lg">{displayValue}</p>
                  )}
                  {/* Show trend comparison if available */}
                  {showComparison && trendText && (
                    <p className={`text-xs font-semibold ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
