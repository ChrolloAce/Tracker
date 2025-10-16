import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, 
  Heart, 
  MessageCircle, 
  Activity, 
  AtSign, 
  Video, 
  Share2,
  ChevronRight,
  Link as LinkIcon,
  Calendar
} from 'lucide-react';
import { VideoSubmission } from '../types';
import { LinkClick } from '../services/LinkClicksService';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { DateFilterType } from './DateRangeFilter';
import { TimePeriodType } from './TimePeriodSelector';
import MetricComparisonModal from './MetricComparisonModal';
import { PlatformIcon } from './ui/PlatformIcon';

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
      <div className="grid gap-4 md:gap-5 xl:gap-6 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ overflow: 'visible' }}>
        {kpiData.map((card) => (
          <KPICard 
            key={card.id} 
            data={card} 
            onClick={() => handleCardClick(card.id)} 
            timePeriod={timePeriod}
            submissions={submissions}
            onDateFilterChange={onDateFilterChange}
          />
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

// Separate component to handle sparkline rendering consistently (kept for reference)
// @ts-ignore - Keeping for potential future use
const _KPISparkline: React.FC<{
  data: Array<{ value: number; timestamp?: number; previousValue?: number }>;
  id: string;
  gradient: string[];
  stroke: string;
  timePeriod?: TimePeriodType;
  totalValue?: string | number;
  metricLabel?: string;
}> = ({ data, id, gradient, stroke, timePeriod = 'days', totalValue: _totalValue, metricLabel }) => {
  
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
              
              return (
                <div className="bg-[#1a1a1a] backdrop-blur-xl text-white px-5 py-3 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-sm space-y-2 min-w-[240px] border border-white/10 pointer-events-none" style={{ zIndex: 999999, position: 'relative' }}>
                  {/* Show date at top */}
                  {dateStr && (
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                      {dateStr}
                    </p>
                  )}
                  {/* Show value prominently */}
                  <p className="text-lg text-white font-bold">
                    {displayValue} {metricLabel?.toLowerCase()}
                  </p>
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

const KPICard: React.FC<{ 
  data: KPICardData; 
  onClick?: () => void; 
  timePeriod?: TimePeriodType;
  submissions?: VideoSubmission[];
  onDateFilterChange?: (filter: DateFilterType, customRange?: { startDate: Date; endDate: Date }) => void;
}> = ({ data, onClick, submissions = [], onDateFilterChange }) => {
  // Tooltip state for Portal rendering
  const [tooltipData, setTooltipData] = useState<{ x: number; y: number; point: any; lineX: number } | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  
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
      ref={cardRef}
      onClick={onClick}
      onMouseMove={(e) => {
        if (!data.sparklineData || data.sparklineData.length === 0 || !cardRef.current) return;
        
        const cardRect = cardRef.current.getBoundingClientRect();
        
        // Calculate X position within the card
        const x = e.clientX - cardRect.left;
        const percentage = x / cardRect.width;
        
        // Calculate X position relative to the card (for full-height line)
        const lineX = x;
        
        // Clamp percentage between 0 and 1
        const clampedPercentage = Math.max(0, Math.min(1, percentage));
        
        // Get nearest data point
        const dataIndex = Math.max(0, Math.min(
          data.sparklineData.length - 1,
          Math.round(clampedPercentage * (data.sparklineData.length - 1))
        ));
        
        const point = data.sparklineData[dataIndex];
        
        if (point) {
          setTooltipData({
            x: e.clientX,
            y: e.clientY,
            point: point,
            lineX: lineX // Store X position relative to card for full-height line
          });
        }
      }}
      onMouseLeave={() => setTooltipData(null)}
      className="group relative rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg hover:shadow-xl hover:ring-1 hover:ring-white/10 transition-all duration-300 cursor-pointer"
      style={{ minHeight: '180px', overflow: 'visible' }}
    >
      {/* Full-height vertical cursor line */}
      {tooltipData && (
        <div
          style={{
            position: 'absolute',
            left: `${tooltipData.lineX}px`,
            top: 0,
            bottom: 0,
            width: '2px',
            background: `linear-gradient(to bottom, ${colors.stroke}00 0%, ${colors.stroke}80 15%, ${colors.stroke}60 50%, ${colors.stroke}40 85%, ${colors.stroke}00 100%)`,
            pointerEvents: 'none',
            zIndex: 50
          }}
        />
      )}

      {/* Upper Solid Portion - 75% (reduced to give more space to graph) */}
      <div className="relative px-5 pt-5 pb-2" style={{ height: '75%' }}>
        {/* Icon (top-right) */}
        <div className="absolute top-4 right-4">
          <Icon className="w-5 h-5 text-gray-400 opacity-60" />
        </div>

        {/* Metric Content - Pushed Higher */}
        <div className="flex flex-col h-full justify-start pt-1">
          {/* Label - Smaller */}
          <div className="text-xs font-medium text-zinc-400 tracking-wide mb-2">
            {data.label}
          </div>

          {/* Value Row - Number + Delta Badge aligned horizontally */}
          <div className="flex items-baseline gap-3 -mt-1">
            <span className={`text-3xl lg:text-4xl font-bold tracking-tight ${data.isEmpty ? 'text-zinc-600' : 'text-white'}`}>
              {data.value}
            </span>
            
            {/* Delta Badge (if exists) - Aligned with number baseline */}
            {data.delta && data.delta.absoluteValue !== undefined && (
              <span className={`inline-flex items-baseline text-xs font-semibold ${
                data.delta.isPositive ? 'text-green-400' : 'text-red-400'
              }`} style={{ letterSpacing: '-0.02em' }}>
                <span className="mr-0">{data.delta.isPositive ? '+' : '−'}</span>
                {data.delta.isPercentage 
                  ? `${Math.abs(data.delta.absoluteValue).toFixed(1)}%`
                  : formatDeltaNumber(data.delta.absoluteValue)}
              </span>
            )}
          </div>

          {/* Period/Subtitle */}
          {data.period && (
            <span className="text-xs text-zinc-500 mt-1.5 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-700"></span>
              {data.period}
            </span>
          )}
        </div>

        {/* CTA Button (if exists) */}
        {!data.delta && data.ctaText && (
          <button className="absolute bottom-3 right-5 inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-xs text-zinc-400 bg-white/5 hover:bg-white/10 transition-colors">
            {data.ctaText}
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Bottom Graph Layer - 25% (expanded from 20%) */}
      {data.sparklineData && data.sparklineData.length > 0 && (
        <div 
          className="relative w-full overflow-hidden"
          style={{ 
            height: '25%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 100%)',
            borderBottomLeftRadius: '1rem',
            borderBottomRightRadius: '1rem'
          }}
        >
          {/* Atmospheric Gradient Overlay */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to top, ${colors.stroke}15 0%, transparent 80%)`,
              mixBlendMode: 'soft-light'
            }}
          />
          
          {/* Line Chart - More vertical space for amplitude */}
          <div className="absolute inset-0" style={{ padding: '0' }}>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={data.sparklineData}
                  margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
                >
                  <defs>
                    <linearGradient id={`bottom-gradient-${data.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={colors.stroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotoneX"
                    dataKey="value"
                    stroke={colors.stroke}
                    strokeWidth={2}
                    fill={`url(#bottom-gradient-${data.id})`}
                    dot={false}
                    isAnimationActive={true}
                    animationDuration={800}
                    animationEasing="ease-in-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Fallback if no sparkline data */}
      {(!data.sparklineData || data.sparklineData.length === 0) && (
        <div 
          className="relative w-full overflow-hidden"
          style={{ 
            height: '25%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.2) 0%, transparent 100%)',
            borderBottomLeftRadius: '1rem',
            borderBottomRightRadius: '1rem'
          }}
        />
      )}

      {/* Portal Tooltip - Rendered at document.body level */}
      {tooltipData && createPortal(
        <div 
          className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10" 
          style={{ 
            position: 'fixed',
            left: `${tooltipData.x}px`,
            top: `${tooltipData.y + 20}px`,
            transform: 'translate(-50%, 0)',
            zIndex: 999999999,
            width: '400px',
            maxHeight: '500px',
            pointerEvents: 'none'
          }}
        >
          {(() => {
            const point = tooltipData.point;
            const value = point.value;
            const timestamp = point.timestamp;
            
            // Format date
            const date = timestamp ? new Date(timestamp) : null;
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const dateStr = date ? `${monthNames[date.getMonth()]} ${date.getDate()}${date.getDate() === 1 ? 'st' : date.getDate() === 2 ? 'nd' : date.getDate() === 3 ? 'rd' : 'th'}, ${date.getFullYear()}` : '';
            const filterDateStr = date ? `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}` : '';
            
            // Format value based on metric type
            const formatDisplayNumber = (num: number): string => {
              if (num >= 1000000) return `${(num / 1000000).toFixed(1)} M`;
              if (num >= 1000) return `${(num / 1000).toFixed(1)} k`;
              return num.toLocaleString();
            };
            
            const displayValue = typeof value === 'number' ? formatDisplayNumber(value) : value;
            
            // Filter videos for this specific day
            const dayStart = date ? new Date(date) : null;
            const dayEnd = date ? new Date(date) : null;
            if (dayStart) {
              dayStart.setHours(0, 0, 0, 0);
              console.log('📅 Tooltip Date:', dateStr);
              console.log('📅 Day Range:', { start: dayStart, end: dayEnd, timestamp });
            }
            if (dayEnd) dayEnd.setHours(23, 59, 59, 999);
            
            const videosOnDay = submissions.filter((video: VideoSubmission) => {
              if (!video.dateSubmitted) return false;
              
              const videoDate = new Date(video.dateSubmitted);
              if (!dayStart || !dayEnd) return false;
              
              const matches = videoDate >= dayStart && videoDate <= dayEnd;
              
              return matches;
            }).sort((a: VideoSubmission, b: VideoSubmission) => (b.views || 0) - (a.views || 0)).slice(0, 5); // Top 5 videos
            
            if (dayStart) {
              console.log(`📹 Found ${videosOnDay.length} videos for ${dateStr}`, videosOnDay.map(v => ({ title: v.title, date: v.dateSubmitted })));
            }
            
            return (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                    {dateStr}
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {displayValue}
                  </p>
                </div>
                
                {/* Divider */}
                <div className="border-t border-white/10 mx-5"></div>
                
                {/* Video List */}
                {videosOnDay.length > 0 ? (
                  <div className="overflow-y-auto px-5 py-3" style={{ maxHeight: '320px' }}>
                    {videosOnDay.map((video: VideoSubmission, idx: number) => (
                      <div 
                        key={`${video.id}-${idx}`}
                        className="flex items-center gap-3 py-2.5 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
                      >
                        {/* Thumbnail */}
                        <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-800">
                          {video.thumbnail ? (
                            <img 
                              src={video.thumbnail} 
                              alt={video.title || 'Video'} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Play className="w-5 h-5 text-gray-600" />
                            </div>
                          )}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate leading-tight mb-1">
                            {video.title || 'Untitled Video'}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4">
                              <PlatformIcon platform={video.platform} size="sm" />
                            </div>
                            <span className="text-xs text-gray-400 lowercase">
                              {video.uploaderHandle || video.platform}
                            </span>
                          </div>
                        </div>
                        
                        {/* Views */}
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-bold text-white">
                            {formatDisplayNumber(video.views || 0)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-6 text-center">
                    <Video className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No videos for this date</p>
                  </div>
                )}
                
                {/* Footer Button */}
                {date && onDateFilterChange && (
                  <div className="px-5 pb-4 pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const customRange = {
                          startDate: dayStart!,
                          endDate: dayEnd!
                        };
                        onDateFilterChange('custom', customRange);
                        setTooltipData(null); // Close tooltip after click
                      }}
                      className="w-full px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-xs font-semibold text-white transition-colors flex items-center justify-center gap-2"
                      style={{ pointerEvents: 'auto' }}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Set page date filter to {filterDateStr}
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>,
        document.body
      )}
    </div>
  );
};

export default KPICards;
