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
  ChevronDown,
  Link as LinkIcon,
  DollarSign,
  Download
} from 'lucide-react';
import { VideoSubmission } from '../types';
import { LinkClick } from '../services/LinkClicksService';
import { RevenueMetrics, RevenueIntegration } from '../types/revenue';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { DateFilterType } from './DateRangeFilter';
import { TimePeriodType } from './TimePeriodSelector';
import DayVideosModal from './DayVideosModal';
import { PlatformIcon } from './ui/PlatformIcon';
import DataAggregationService, { IntervalType, TimeInterval } from '../services/DataAggregationService';
import { useNavigate } from 'react-router-dom';

interface KPICardsProps {
  submissions: VideoSubmission[]; // Filtered submissions for current period
  allSubmissions?: VideoSubmission[]; // All submissions (unfiltered) for PP calculation
  linkClicks?: LinkClick[];
  dateFilter?: DateFilterType;
  customRange?: { startDate: Date; endDate: Date };
  timePeriod?: TimePeriodType;
  granularity?: 'day' | 'week' | 'month' | 'year';
  onCreateLink?: () => void;
  onVideoClick?: (video: VideoSubmission) => void;
  revenueMetrics?: RevenueMetrics | null;
  revenueIntegrations?: RevenueIntegration[];
  isEditMode?: boolean;
  cardOrder?: string[];
  onReorder?: (newOrder: string[]) => void;
}

interface KPICardData {
  id: string;
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'emerald' | 'pink' | 'blue' | 'violet' | 'teal' | 'orange' | 'slate';
  delta?: { value: number; isPositive: boolean; absoluteValue: number; isPercentage?: boolean };
  period?: string;
  sparklineData?: Array<{ value: number; timestamp?: number; interval?: TimeInterval; ppValue?: number }>;
  isEmpty?: boolean;
  ctaText?: string;
  isIncreasing?: boolean;
  intervalType?: IntervalType; // Add interval type to track how data is aggregated
}

const KPICards: React.FC<KPICardsProps> = ({ 
  submissions, 
  allSubmissions, // All submissions for PP calculation
  linkClicks = [], 
  dateFilter = 'all',
  customRange,
  timePeriod = 'weeks', 
  granularity = 'day',
  onCreateLink,
  onVideoClick,
  revenueMetrics,
  revenueIntegrations = [],
  isEditMode = false,
  cardOrder = [],
  onReorder
}) => {
  const navigate = useNavigate();
  // Day Videos Modal state
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayVideos, setSelectedDayVideos] = useState<VideoSubmission[]>([]);
  const [selectedPPVideos, setSelectedPPVideos] = useState<VideoSubmission[]>([]);
  const [selectedLinkClicks, setSelectedLinkClicks] = useState<LinkClick[]>([]);
  const [selectedPPLinkClicks, setSelectedPPLinkClicks] = useState<LinkClick[]>([]);
  const [dayModalMetric, setDayModalMetric] = useState<string>('');
  const [hoveredInterval, setHoveredInterval] = useState<TimeInterval | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<TimeInterval | null>(null);
  
  // Drag and drop state
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [dragOverCard, setDragOverCard] = useState<string | null>(null);
  const [selectedPPInterval, setSelectedPPInterval] = useState<TimeInterval | null>(null);

  const handleCardClick = (metricId: string, metricLabel: string) => {
    // If it's link clicks and there are no links, trigger create link callback
    if (metricId === 'link-clicks' && linkClicks.length === 0 && onCreateLink) {
      onCreateLink();
      return;
    }
    
    // If it's revenue or downloads and no integration is set up, redirect to settings
    if ((metricId === 'revenue' || metricId === 'downloads') && revenueIntegrations.length === 0) {
      navigate('/settings');
      // Set the active tab to revenue when navigating
      localStorage.setItem('settingsActiveTab', 'revenue');
      return;
    }
    
    // Open Day Videos Modal with hovered interval or most recent date
    if (submissions.length > 0) {
      let targetDate: Date;
      let videosForInterval: VideoSubmission[];
      let ppVideosForInterval: VideoSubmission[] = [];
      let clicksForInterval: LinkClick[] = [];
      let ppClicksForInterval: LinkClick[] = [];
      let ppIntervalData: TimeInterval | null = null;
      
      // Use hovered interval if available (from tooltip hover)
      if (hoveredInterval) {
        targetDate = new Date(hoveredInterval.startDate);
        
        // Filter videos for the entire interval (day, week, month, or year!)
        videosForInterval = submissions.filter(video => {
          const uploadDate = video.uploadDate ? new Date(video.uploadDate) : new Date(video.dateSubmitted);
          return DataAggregationService.isDateInInterval(uploadDate, hoveredInterval);
        });
        
        // Filter link clicks for this interval
        clicksForInterval = linkClicks.filter(click => {
          const clickDate = new Date(click.timestamp);
          return DataAggregationService.isDateInInterval(clickDate, hoveredInterval);
        });
        
        // Calculate PP interval
        if (dateFilter !== 'all') {
          const periodLength = hoveredInterval.endDate.getTime() - hoveredInterval.startDate.getTime();
          const ppEndDate = new Date(hoveredInterval.startDate.getTime() - 1);
          const ppStartDate = new Date(ppEndDate.getTime() - periodLength);
          
          ppIntervalData = {
            startDate: ppStartDate,
            endDate: ppEndDate,
            timestamp: ppStartDate.getTime(),
            intervalType: hoveredInterval.intervalType,
            label: DataAggregationService.formatIntervalLabel(ppStartDate, hoveredInterval.intervalType)
          };
          
          // Filter PP videos using all submissions
          ppVideosForInterval = (allSubmissions || submissions).filter(video => {
            const uploadDate = video.uploadDate ? new Date(video.uploadDate) : new Date(video.dateSubmitted);
            return DataAggregationService.isDateInInterval(uploadDate, ppIntervalData!);
          });
          
          // Filter PP link clicks
          ppClicksForInterval = linkClicks.filter(click => {
            const clickDate = new Date(click.timestamp);
            return DataAggregationService.isDateInInterval(clickDate, ppIntervalData!);
          });
        }
        
        // Store the interval for modal display
        setSelectedInterval(hoveredInterval);
        setSelectedPPInterval(ppIntervalData);
      } else {
        // Fallback: find most recent date and filter for that single day
        const sortedSubmissions = [...submissions].sort((a, b) => 
          new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
        );
        targetDate = new Date(sortedSubmissions[0].uploadDate);
        
        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        videosForInterval = submissions.filter(video => {
          const videoDate = new Date(video.uploadDate);
          return videoDate >= dayStart && videoDate <= dayEnd;
        });
        
        // Filter link clicks for this day
        clicksForInterval = linkClicks.filter(click => {
          const clickDate = new Date(click.timestamp);
          clickDate.setHours(0, 0, 0, 0);
          return clickDate >= dayStart && clickDate <= dayEnd;
        });
        
        // Calculate PP data even for fallback case if date filter is active
        if (dateFilter !== 'all') {
          // Calculate previous day
          const ppDayStart = new Date(dayStart);
          ppDayStart.setDate(ppDayStart.getDate() - 1);
          const ppDayEnd = new Date(ppDayStart);
          ppDayEnd.setHours(23, 59, 59, 999);
          
          ppIntervalData = {
            startDate: ppDayStart,
            endDate: ppDayEnd,
            timestamp: ppDayStart.getTime(),
            intervalType: 'day',
            label: DataAggregationService.formatIntervalLabel(ppDayStart, 'day')
          };
          
          // Filter PP videos
          ppVideosForInterval = (allSubmissions || submissions).filter(video => {
            const videoDate = new Date(video.uploadDate);
            videoDate.setHours(0, 0, 0, 0);
            return videoDate >= ppDayStart && videoDate <= ppDayEnd;
          });
          
          // Filter PP link clicks
          ppClicksForInterval = linkClicks.filter(click => {
            const clickDate = new Date(click.timestamp);
            clickDate.setHours(0, 0, 0, 0);
            return clickDate >= ppDayStart && clickDate <= ppDayEnd;
          });
        }
        
        // Set interval for fallback case (single day)
        setSelectedInterval({
          startDate: dayStart,
          endDate: dayEnd,
          timestamp: dayStart.getTime(),
          intervalType: 'day',
          label: DataAggregationService.formatIntervalLabel(dayStart, 'day')
        });
        setSelectedPPInterval(ppIntervalData);
      }
      
      setSelectedDate(targetDate);
      setSelectedDayVideos(videosForInterval);
      setSelectedPPVideos(ppVideosForInterval);
      setSelectedLinkClicks(clicksForInterval);
      setSelectedPPLinkClicks(ppClicksForInterval);
      setDayModalMetric(metricLabel);
      setIsDayModalOpen(true);
    }
  };

  const kpiData = useMemo(() => {
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
      console.log('📅 PP Date Range:', ppDateRangeStart.toLocaleDateString(), '-', ppDateRangeEnd.toLocaleDateString());
    }
    
    // Calculate PP metrics using the same logic as CP
    // Show ALL activity during the previous period, regardless of when videos were uploaded
    let ppViews = 0;
    let ppLikes = 0;
    let ppComments = 0;
    let ppShares = 0;
    let ppVideos = 0;
    
    if (ppDateRangeStart && ppDateRangeEnd) {
      console.log('📊 PP Calculation - Using submissions with platform/rule filters (not date filter):', (allSubmissions || submissions).length);
      (allSubmissions || submissions).forEach(video => {
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
    const generateSparklineData = (metric: 'views' | 'likes' | 'comments' | 'shares' | 'videos' | 'accounts'): { data: any[], intervalType: IntervalType } => {
      // Calculate the actual date range
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
      
      // Use the granularity prop instead of auto-determining
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
      
      let data = [];
      
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
            // Check if video was uploaded before the analysis period started
            if (uploadDate < actualStartDate) {
              // Video was uploaded before our analysis period
              // Check if it has growth during this interval via snapshots
              if (video.snapshots && video.snapshots.length > 0) {
                const snapshotAtStart = video.snapshots
                  .filter(s => new Date(s.capturedAt) <= interval.startDate)
                  .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
                
                const snapshotAtEnd = video.snapshots
                  .filter(s => new Date(s.capturedAt) <= interval.endDate)
                  .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
                
                if (snapshotAtStart && snapshotAtEnd && snapshotAtStart !== snapshotAtEnd) {
                  const delta = Math.max(0, (snapshotAtEnd[metric] || 0) - (snapshotAtStart[metric] || 0));
                  intervalValue += delta;
                }
              }
            } else if (DataAggregationService.isDateInInterval(uploadDate, interval)) {
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
            }
          });
          
          // === PREVIOUS PERIOD (PP) CALCULATION ===
          // Use ALL submissions (not filtered) for PP calculation
          if (ppInterval) {
            submissionsForPP.forEach(video => {
              const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
              
              // Use the same logic as CP, but for PP interval dates
              if (uploadDate < ppInterval.startDate) {
                // Video was uploaded before PP started - look for growth during PP interval
                if (video.snapshots && video.snapshots.length > 0) {
                  const snapshotAtStart = video.snapshots
                    .filter(s => new Date(s.capturedAt) <= ppInterval.startDate)
                    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
                  
                  const snapshotAtEnd = video.snapshots
                    .filter(s => new Date(s.capturedAt) <= ppInterval.endDate)
                    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
                  
                  if (snapshotAtStart && snapshotAtEnd && snapshotAtStart !== snapshotAtEnd) {
                    const delta = Math.max(0, (snapshotAtEnd[metric] || 0) - (snapshotAtStart[metric] || 0));
                    ppIntervalValue += delta;
                  }
                }
              } else if (DataAggregationService.isDateInInterval(uploadDate, ppInterval)) {
                // Video was uploaded during PP interval
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
        // Normalize to local date for accurate day matching
        const clickDateLocal = new Date(clickDate.getFullYear(), clickDate.getMonth(), clickDate.getDate());
        const rangeStartLocal = new Date(dateRangeStart!.getFullYear(), dateRangeStart!.getMonth(), dateRangeStart!.getDate());
        const rangeEndLocal = new Date(dateRangeEnd.getFullYear(), dateRangeEnd.getMonth(), dateRangeEnd.getDate());
        return clickDateLocal >= rangeStartLocal && clickDateLocal <= rangeEndLocal;
      }).length;
      
      // Count clicks in Previous Period (PP)
      if (ppDateRangeStart && ppDateRangeEnd) {
        ppClicks = linkClicks.filter(click => {
          const clickDate = new Date(click.timestamp);
          // Normalize to local date for accurate day matching
          const clickDateLocal = new Date(clickDate.getFullYear(), clickDate.getMonth(), clickDate.getDate());
          const ppStartLocal = new Date(ppDateRangeStart!.getFullYear(), ppDateRangeStart!.getMonth(), ppDateRangeStart!.getDate());
          const ppEndLocal = new Date(ppDateRangeEnd!.getFullYear(), ppDateRangeEnd!.getMonth(), ppDateRangeEnd!.getDate());
          return clickDateLocal >= ppStartLocal && clickDateLocal <= ppEndLocal;
        }).length;
      }
    } else {
      // For 'all' time, use total clicks (no PP comparison)
      cpClicks = linkClicks.length;
    }
    
    const clicksGrowthAbsolute = ppClicks === 0 ? cpClicks : cpClicks - ppClicks;

    // Generate sparkline data first so we can calculate trends
    const viewsSparklineResult = generateSparklineData('views');
    const likesSparklineResult = generateSparklineData('likes');
    const commentsSparklineResult = generateSparklineData('comments');
    const sharesSparklineResult = generateSparklineData('shares');
    const videosSparklineResult = generateSparklineData('videos');
    const accountsSparklineResult = generateSparklineData('accounts');
    
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
        isIncreasing: viewsGrowthAbsolute >= 0 // Use delta, not sparkline trend
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
        isIncreasing: likesGrowthAbsolute >= 0 // Use delta, not sparkline trend
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
        isIncreasing: commentsGrowthAbsolute >= 0 // Use delta, not sparkline trend
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
        isIncreasing: sharesGrowthAbsolute >= 0 // Use delta, not sparkline trend
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
        isIncreasing: videosGrowthAbsolute >= 0 // Use delta, not sparkline trend
      },
      {
        id: 'accounts',
        label: 'Active Accounts',
        value: activeAccounts,
        icon: AtSign,
        accent: 'teal',
        sparklineData: accountsSparklineResult.data,
        intervalType: accountsSparklineResult.intervalType,
        isIncreasing: true // Default to green for accounts (no delta calculated)
      },
      (() => {
        // Generate engagement rate sparkline data (per-interval, not cumulative)
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
        
        // Use the granularity prop instead of auto-determining
        const intervalType = granularity as IntervalType;
        
        // Generate intervals for current period
        const intervals = DataAggregationService.generateIntervals(
          { startDate: actualStartDate, endDate: actualEndDate },
          intervalType
        );
        
        // Generate intervals for previous period (PP)
        let ppIntervals: typeof intervals = [];
        if (dateRangeStart && dateFilter !== 'all') {
          const periodLength = actualEndDate.getTime() - actualStartDate.getTime();
          const ppEndDate = new Date(actualStartDate.getTime() - 1);
          const ppStartDate = new Date(ppEndDate.getTime() - periodLength);
          
          ppIntervals = DataAggregationService.generateIntervals(
            { startDate: ppStartDate, endDate: ppEndDate },
            intervalType
          );
        }
        
        const data = [];
        for (let i = 0; i < intervals.length; i++) {
          const interval = intervals[i];
          const ppInterval = ppIntervals[i];
          
          // Calculate engagement rate for ONLY this specific interval
          let periodViews = 0;
          let periodEngagement = 0;
          let ppPeriodViews = 0;
          let ppPeriodEngagement = 0;
          
          // Use filtered submissions for CP
          const submissionsForCP = submissions;
          const submissionsForPP = allSubmissions || submissions;
          
          submissionsForCP.forEach(video => {
            const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
            
            // Check if video was uploaded before the analysis period started
            if (uploadDate < actualStartDate) {
              // Video was uploaded before our analysis period
              // Check if it has growth during this interval via snapshots
              if (video.snapshots && video.snapshots.length > 0) {
                const snapshotAtStart = video.snapshots
                  .filter(s => new Date(s.capturedAt) <= interval.startDate)
                  .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
                
                const snapshotAtEnd = video.snapshots
                  .filter(s => new Date(s.capturedAt) <= interval.endDate)
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
            } else if (DataAggregationService.isDateInInterval(uploadDate, interval)) {
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
            }
          });
          
          // Calculate PP values if available - use ALL submissions
          if (ppInterval) {
            submissionsForPP.forEach(video => {
              const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
              const ppStartDate = ppInterval.startDate;
              
              if (uploadDate < ppStartDate) {
                // Video was uploaded before PP
                if (video.snapshots && video.snapshots.length > 0) {
                  const snapshotAtStart = video.snapshots
                    .filter(s => new Date(s.capturedAt) <= ppInterval.startDate)
                    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
                  
                  const snapshotAtEnd = video.snapshots
                    .filter(s => new Date(s.capturedAt) <= ppInterval.endDate)
                    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
                  
                  if (snapshotAtStart && snapshotAtEnd && snapshotAtStart !== snapshotAtEnd) {
                    const viewsDelta = Math.max(0, (snapshotAtEnd.views || 0) - (snapshotAtStart.views || 0));
                    const likesDelta = Math.max(0, (snapshotAtEnd.likes || 0) - (snapshotAtStart.likes || 0));
                    const commentsDelta = Math.max(0, (snapshotAtEnd.comments || 0) - (snapshotAtStart.comments || 0));
                    const sharesDelta = Math.max(0, (snapshotAtEnd.shares || 0) - (snapshotAtStart.shares || 0));
                    
                    ppPeriodViews += viewsDelta;
                    ppPeriodEngagement += likesDelta + commentsDelta + sharesDelta;
                  }
                }
              } else if (DataAggregationService.isDateInInterval(uploadDate, ppInterval)) {
                // Video was uploaded during PP
                if (video.snapshots && video.snapshots.length > 0) {
                  const firstSnapshot = video.snapshots
                    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())[0];
                  ppPeriodViews += firstSnapshot.views || 0;
                  ppPeriodEngagement += (firstSnapshot.likes || 0) + (firstSnapshot.comments || 0) + (firstSnapshot.shares || 0);
                } else {
                  ppPeriodViews += video.views || 0;
                  ppPeriodEngagement += (video.likes || 0) + (video.comments || 0) + (video.shares || 0);
                }
              }
            });
          }
          
          const rate = periodViews > 0 ? ((periodEngagement / periodViews) * 100) : 0;
          const ppRate = ppInterval && ppPeriodViews > 0 ? ((ppPeriodEngagement / ppPeriodViews) * 100) : 0;
          
          data.push({
            value: Number(rate.toFixed(1)),
            timestamp: interval.timestamp,
            interval,
            ppValue: Number(ppRate.toFixed(1))
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
          intervalType: intervalType,
          isIncreasing: engagementRateGrowthAbsolute >= 0 // Use delta, not sparkline trend
        };
      })(),
      (() => {
        // Generate link clicks sparkline data
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
        
        // Use the granularity prop instead of auto-determining
        const intervalType = granularity as IntervalType;
        
        // Generate intervals for current period
        const intervals = DataAggregationService.generateIntervals(
          { startDate: actualStartDate, endDate: actualEndDate },
          intervalType
        );
        
        // Generate intervals for previous period (PP)
        let ppIntervals: typeof intervals = [];
        if (dateRangeStart && dateFilter !== 'all') {
          const periodLength = actualEndDate.getTime() - actualStartDate.getTime();
          const ppEndDate = new Date(actualStartDate.getTime() - 1);
          const ppStartDate = new Date(ppEndDate.getTime() - periodLength);
          
          ppIntervals = DataAggregationService.generateIntervals(
            { startDate: ppStartDate, endDate: ppEndDate },
            intervalType
          );
        }
        
        const data = [];
        for (let i = 0; i < intervals.length; i++) {
          const interval = intervals[i];
          const ppInterval = ppIntervals[i];
          
          // Count clicks in this time period
          const clicksInPeriod = linkClicks.filter(click => {
            const clickDate = new Date(click.timestamp);
            return DataAggregationService.isDateInInterval(clickDate, interval);
          });
          
          // Count PP clicks if available
          let ppClicksCount = 0;
          if (ppInterval) {
            const ppClicksInPeriod = linkClicks.filter(click => {
              const clickDate = new Date(click.timestamp);
              return DataAggregationService.isDateInInterval(clickDate, ppInterval);
            });
            ppClicksCount = ppClicksInPeriod.length;
          }
          
          data.push({
            value: clicksInPeriod.length,
            timestamp: interval.timestamp,
            interval,
            ppValue: ppClicksCount
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
          intervalType: intervalType,
          isIncreasing: hasClicks ? clicksGrowthAbsolute >= 0 : true // Use delta, not sparkline trend
        };
      })(),
      // Revenue card
      (() => {
        const hasIntegration = revenueIntegrations.length > 0 && revenueIntegrations.some(i => i.enabled);
        
        if (!hasIntegration) {
          return {
            id: 'revenue',
            label: 'Revenue',
            value: 'Setup',
            icon: DollarSign,
            accent: 'emerald' as const,
            isEmpty: true,
            ctaText: 'Setup',
            isIncreasing: true
          };
        }
        
        if (!revenueMetrics) {
          return {
            id: 'revenue',
            label: 'Revenue',
            value: '$0',
            icon: DollarSign,
            accent: 'emerald' as const,
            isEmpty: true,
            ctaText: 'Sync now',
            isIncreasing: true
          };
        }
        
        const totalRevenue = (revenueMetrics.totalRevenue || 0) / 100; // Convert cents to dollars
        const ppRevenue = (revenueMetrics.previousPeriodRevenue || 0) / 100;
        const revenueGrowth = ppRevenue > 0 ? ((totalRevenue - ppRevenue) / ppRevenue) * 100 : 0;
        const revenueGrowthAbsolute = totalRevenue - ppRevenue;
        
        // Generate simple sparkline data (showing current period trend)
        // For now, create a simple upward/downward trend based on growth
        const sparklineData: Array<{ value: number }> = [];
        if (ppRevenue > 0 && totalRevenue > 0) {
          // Create a trend line from PP to current
          const dataPoints = 10;
          for (let i = 0; i <= dataPoints; i++) {
            const progress = i / dataPoints;
            const value = ppRevenue + (totalRevenue - ppRevenue) * progress;
            sparklineData.push({ value });
          }
        } else if (totalRevenue > 0) {
          // No PP data, show flat line at current value
          for (let i = 0; i < 10; i++) {
            sparklineData.push({ value: totalRevenue });
          }
        }
        
        return {
          id: 'revenue',
          label: 'MRR (28d)',
          value: `$${formatNumber(totalRevenue)}`,
          icon: DollarSign,
          accent: 'emerald' as const,
          delta: { value: Math.abs(revenueGrowth), isPositive: revenueGrowth >= 0, absoluteValue: revenueGrowthAbsolute },
          sparklineData: sparklineData.length > 0 ? sparklineData : undefined,
          intervalType: 'day' as IntervalType,
          isIncreasing: revenueGrowth >= 0,
          tooltip: 'Monthly Recurring Revenue (fixed 28-day period from RevenueCat)'
        };
      })(),
      // Downloads card (from RevenueCat new subscriptions)
      (() => {
        const hasIntegration = revenueIntegrations.length > 0 && revenueIntegrations.some(i => i.enabled);
        
        if (!hasIntegration) {
          return {
            id: 'downloads',
            label: 'Downloads',
            value: 'Setup',
            icon: Download,
            accent: 'blue' as const,
            isEmpty: true,
            ctaText: 'Setup',
            isIncreasing: true
          };
        }
        
        if (!revenueMetrics) {
          return {
            id: 'downloads',
            label: 'Downloads',
            value: '0',
            icon: Download,
            accent: 'blue' as const,
            isEmpty: true,
            ctaText: 'Sync now',
            isIncreasing: true
          };
        }
        
        // Use active subscriptions from RevenueCat
        const activeSubscriptions = revenueMetrics.activeSubscriptions || revenueMetrics.newSubscriptions || 0;
        
        // Generate simple sparkline
        const sparklineData: Array<{ value: number }> = [];
        if (activeSubscriptions > 0) {
          // Show a simple upward trend leading to current value
          for (let i = 0; i < 10; i++) {
            const progress = i / 9;
            sparklineData.push({ value: Math.round(activeSubscriptions * progress) });
          }
        }
        
        return {
          id: 'downloads',
          label: 'Active Subs',
          value: formatNumber(activeSubscriptions),
          icon: Download,
          accent: 'blue' as const,
          sparklineData: sparklineData.length > 0 ? sparklineData : undefined,
          intervalType: 'day' as IntervalType,
          isIncreasing: true,
          tooltip: 'Active Subscriptions from RevenueCat'
        };
      })()
    ];

    return cards;
  }, [submissions, linkClicks, dateFilter, customRange, timePeriod, granularity, revenueMetrics, revenueIntegrations]);

  return (
    <>
      {/* Edit Mode Indicator */}
      {isEditMode && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-emerald-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          <span className="text-sm font-medium">Drag cards to reorder your dashboard</span>
        </div>
      )}
      
      <div className="grid gap-4 md:gap-5 xl:gap-6 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ overflow: 'visible' }}>
        {(() => {
          // Sort cards based on saved order
          let orderedCards = [...kpiData];
          if (cardOrder.length > 0) {
            orderedCards.sort((a, b) => {
              const aIndex = cardOrder.indexOf(a.id);
              const bIndex = cardOrder.indexOf(b.id);
              if (aIndex === -1) return 1;
              if (bIndex === -1) return -1;
              return aIndex - bIndex;
            });
          }
          
          return orderedCards.map((card) => (
            <KPICard 
              key={card.id} 
              data={card} 
              onClick={() => !isEditMode && handleCardClick(card.id, card.label)}
              onIntervalHover={setHoveredInterval}
              timePeriod={timePeriod}
              submissions={submissions}
              linkClicks={linkClicks}
              isEditMode={isEditMode}
              isDragging={draggedCard === card.id}
              isDragOver={dragOverCard === card.id}
              onDragStart={() => {
                if (isEditMode) setDraggedCard(card.id);
              }}
              onDragEnd={() => {
                setDraggedCard(null);
                setDragOverCard(null);
              }}
              onDragOver={(e) => {
                if (isEditMode) {
                  e.preventDefault();
                  setDragOverCard(card.id);
                }
              }}
              onDragLeave={() => {
                setDragOverCard(null);
              }}
              onDrop={() => {
                if (isEditMode && draggedCard && draggedCard !== card.id) {
                  const currentOrder = cardOrder.length > 0 ? cardOrder : kpiData.map(c => c.id);
                  const draggedIndex = currentOrder.indexOf(draggedCard);
                  const targetIndex = currentOrder.indexOf(card.id);
                  
                  if (draggedIndex !== -1 && targetIndex !== -1) {
                    const newOrder = [...currentOrder];
                    newOrder.splice(draggedIndex, 1);
                    newOrder.splice(targetIndex, 0, draggedCard);
                    onReorder?.(newOrder);
                  }
                }
                setDraggedCard(null);
                setDragOverCard(null);
              }}
            />
          ));
        })()}
      </div>

      {/* Old Metrics Modal Removed - Now using Day Videos Modal */}

      {selectedDate && (
        <DayVideosModal
          isOpen={isDayModalOpen}
          onClose={() => setIsDayModalOpen(false)}
          date={selectedDate}
          videos={selectedDayVideos}
          metricLabel={dayModalMetric}
          onVideoClick={onVideoClick}
          interval={selectedInterval}
          ppVideos={selectedPPVideos}
          ppInterval={selectedPPInterval}
          linkClicks={selectedLinkClicks}
          ppLinkClicks={selectedPPLinkClicks}
        />
      )}
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
  onIntervalHover?: (interval: TimeInterval | null) => void;
  timePeriod?: TimePeriodType;
  submissions?: VideoSubmission[];
  linkClicks?: LinkClick[];
  isEditMode?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
}> = ({ 
  data, 
  onClick, 
  onIntervalHover, 
  submissions = [], 
  linkClicks = [],
  isEditMode = false,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop
}) => {
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
        // Disable tooltips in edit mode
        if (isEditMode) return;
        
        if (!data.sparklineData || data.sparklineData.length === 0 || !cardRef.current) return;
        
        const cardRect = cardRef.current.getBoundingClientRect();
        
        // Calculate X position within the card
        const x = e.clientX - cardRect.left;
        const percentage = x / cardRect.width;
        
        // Clamp percentage between 0 and 1
        const clampedPercentage = Math.max(0, Math.min(1, percentage));
        
        // Get nearest data point
        const dataIndex = Math.max(0, Math.min(
          data.sparklineData.length - 1,
          Math.round(clampedPercentage * (data.sparklineData.length - 1))
        ));
        
        const point = data.sparklineData[dataIndex];
        
        if (point) {
          // Calculate the SNAPPED X position based on the actual data point index
          const snappedPercentage = dataIndex / (data.sparklineData.length - 1);
          const snappedLineX = snappedPercentage * cardRect.width;
          
          setTooltipData({
            x: e.clientX,
            y: e.clientY,
            point: point,
            lineX: snappedLineX // Snapped to data point, not mouse position
          });
          
          // Store the hovered interval so handleCardClick knows the full timeframe
          if (point.interval && onIntervalHover) {
            onIntervalHover(point.interval);
          }
        }
      }}
      onMouseLeave={() => {
        setTooltipData(null);
        if (onIntervalHover) onIntervalHover(null);
      }}
      draggable={isEditMode}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`
        group relative rounded-2xl bg-zinc-900/60 backdrop-blur border shadow-lg transition-all duration-300 overflow-hidden
        ${isEditMode ? 'cursor-move' : 'cursor-pointer'}
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${isDragOver ? 'ring-2 ring-emerald-500 border-emerald-500/50' : 'border-white/5 hover:shadow-xl hover:ring-1 hover:ring-white/10'}
      `}
      style={{ minHeight: '180px' }}
    >
      {/* Depth Gradient Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
        }}
      />
      
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

      {/* Upper Solid Portion - 60% (reduced to give more space to graph) */}
      <div className="relative px-5 pt-4 pb-2 z-10" style={{ height: '60%' }}>
        {/* Drag Handle (edit mode only) */}
        {isEditMode && (
          <div className="absolute top-4 left-4 text-emerald-400 opacity-60">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </div>
        )}
        
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

      {/* Bottom Graph Layer - 40% (expanded for better visibility) */}
      {data.sparklineData && data.sparklineData.length > 0 && (
        <div 
          className="relative w-full overflow-hidden z-10"
          style={{ 
            height: '40%',
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
              {(() => {
                // Calculate intelligent Y-axis domain with outlier capping
                const values = data.sparklineData.map(d => d.value).filter((v): v is number => typeof v === 'number');
                const ppValues = data.sparklineData.map(d => d.ppValue).filter((v): v is number => typeof v === 'number' && v > 0);
                const allValues: number[] = [...values, ...ppValues];
                
                if (allValues.length === 0) {
                  return null;
                }
                
                // Sort to find statistics
                const sortedValues = [...allValues].sort((a, b) => a - b);
                const max = sortedValues[sortedValues.length - 1] || 1;
                const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)] || 1;
                
                // Cap outliers: if max is more than 5x the Q3, cap at 2x Q3
                let yMax = max;
                if (max > q3 * 5 && q3 > 0) {
                  yMax = q3 * 2;
                }
                
                // Check if PP data exists
                const hasPPData = data.sparklineData.some(d => typeof d.ppValue === 'number' && d.ppValue > 0);
                
                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={data.sparklineData}
                      margin={{ top: 4, right: 0, bottom: 4, left: 0 }}
                    >
                      <defs>
                        <linearGradient id={`bottom-gradient-${data.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={colors.stroke} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id={`pp-gradient-${data.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.08} />
                          <stop offset="100%" stopColor={colors.stroke} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      {/* Y-axis with intelligent domain */}
                      <YAxis 
                        domain={[0, yMax]} 
                        hide={true}
                      />
                      {/* PP (Previous Period) Ghost Graph - rendered first so it's behind */}
                      {hasPPData && (
                        <Area
                          type="monotoneX"
                          dataKey="ppValue"
                          stroke="rgb(156, 163, 175)"
                          strokeWidth={1.5}
                          strokeOpacity={0.15}
                          fill="none"
                          dot={false}
                          isAnimationActive={false}
                        />
                      )}
                      {/* Main Current Period Graph */}
                      <Area
                        type="monotoneX"
                        dataKey="value"
                        stroke={colors.stroke}
                        strokeWidth={2.5}
                        fill={`url(#bottom-gradient-${data.id})`}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Fallback if no sparkline data */}
      {(!data.sparklineData || data.sparklineData.length === 0) && (
        <div 
          className="relative w-full overflow-hidden"
          style={{ 
            height: '40%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.2) 0%, transparent 100%)',
            borderBottomLeftRadius: '1rem',
            borderBottomRightRadius: '1rem'
          }}
        />
      )}

      {/* Portal Tooltip - Rendered at document.body level */}
      {tooltipData && (() => {
        // Always position below cursor, but adjust horizontal position to stay on screen
        const tooltipWidth = 400;
        const verticalOffset = 20; // spacing below cursor
        const horizontalPadding = 20; // minimum distance from screen edges
        const windowWidth = window.innerWidth;
        
        // Calculate horizontal position to keep tooltip on screen
        let leftPosition = tooltipData.x;
        let transformX = '-50%'; // default: centered under cursor
        
        // Check if tooltip would go off left edge
        if (tooltipData.x - (tooltipWidth / 2) < horizontalPadding) {
          leftPosition = horizontalPadding;
          transformX = '0'; // align left edge to position
        }
        // Check if tooltip would go off right edge
        else if (tooltipData.x + (tooltipWidth / 2) > windowWidth - horizontalPadding) {
          leftPosition = windowWidth - horizontalPadding;
          transformX = '-100%'; // align right edge to position
        }
        
        return createPortal(
          <div 
            className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10" 
            style={{ 
              position: 'fixed',
              left: `${leftPosition}px`,
              top: `${tooltipData.y + verticalOffset}px`,
              transform: `translateX(${transformX})`,
              zIndex: 999999999,
              width: '400px',
              maxHeight: '500px',
              pointerEvents: 'none'
            }}
          >
            {(() => {
            const point = tooltipData.point;
            const value = point.value;
            
            // Get the interval from the data point
            const interval = point.interval;
            
            // Format date based on interval type
            const dateStr = interval 
              ? DataAggregationService.formatIntervalLabelFull(new Date(interval.startDate), interval.intervalType)
              : '';
            
            // Format value based on metric type
            const formatDisplayNumber = (num: number): string => {
              if (num >= 1000000) return `${(num / 1000000).toFixed(1)} M`;
              if (num >= 1000) return `${(num / 1000).toFixed(1)} k`;
              return num.toLocaleString();
            };
            
            const displayValue = typeof value === 'number' ? formatDisplayNumber(value) : value;
            const ppValue = point.ppValue;
            const ppDisplayValue = typeof ppValue === 'number' ? formatDisplayNumber(ppValue) : null;
            
            // Calculate PP comparison
            const ppComparison = (typeof ppValue === 'number' && ppValue > 0 && typeof value === 'number') ? (() => {
              const diff = value - ppValue;
              const percentChange = ppValue > 0 ? ((diff / ppValue) * 100) : 0;
              const isPositive = diff >= 0;
              return {
                diff,
                percentChange,
                isPositive,
                displayValue: ppDisplayValue
              };
            })() : null;
            
            // Filter videos for this interval (not just a single day!)
            const videosInInterval = interval ? submissions.filter((video: VideoSubmission) => {
              const uploadDate = video.uploadDate ? new Date(video.uploadDate) : new Date(video.dateSubmitted);
              return DataAggregationService.isDateInInterval(uploadDate, interval);
            }) : [];
            
            // Sort by the relevant metric
            let sortedItems: any[] = [];
            if (data.id === 'accounts') {
              // For accounts: group by uploaderHandle and sum total views
              const accountsMap = new Map<string, { handle: string; platform: string; totalViews: number; videoCount: number; profilePicture?: string }>();
              videosInInterval.forEach(video => {
                const handle = video.uploaderHandle || 'Unknown';
                if (accountsMap.has(handle)) {
                  const existing = accountsMap.get(handle)!;
                  existing.totalViews += video.views || 0;
                  existing.videoCount += 1;
                } else {
                  accountsMap.set(handle, {
                    handle,
                    platform: video.platform,
                    totalViews: video.views || 0,
                    videoCount: 1,
                    profilePicture: video.uploaderProfilePicture || undefined
                  });
                }
              });
              sortedItems = Array.from(accountsMap.values())
                .sort((a, b) => b.totalViews - a.totalViews)
                .slice(0, 5);
            } else if (data.id === 'link-clicks') {
              // For link clicks: show links clicked in this interval
              const clicksInInterval = interval ? linkClicks.filter((click: LinkClick) => {
                const clickDate = new Date(click.timestamp);
                return DataAggregationService.isDateInInterval(clickDate, interval);
              }) : [];
              
              // Group by linkId and count clicks
              const linksMap = new Map<string, { linkId: string; title: string; url: string; shortCode: string; clicks: number; accountHandle?: string; accountProfilePicture?: string; accountPlatform?: string }>();
              clicksInInterval.forEach((click: LinkClick) => {
                if (linksMap.has(click.linkId)) {
                  const existing = linksMap.get(click.linkId)!;
                  existing.clicks += 1;
                } else {
                  linksMap.set(click.linkId, {
                    linkId: click.linkId,
                    title: click.linkTitle || click.shortCode || 'Untitled Link',
                    url: click.linkUrl || '',
                    shortCode: click.shortCode || '',
                    clicks: 1,
                    accountHandle: click.accountHandle,
                    accountProfilePicture: click.accountProfilePicture,
                    accountPlatform: click.accountPlatform
                  });
                }
              });
              
              sortedItems = Array.from(linksMap.values())
                .sort((a, b) => b.clicks - a.clicks)
                .slice(0, 5);
            } else {
              // For other metrics: sort videos by the relevant metric
              const metricKey = data.id === 'views' ? 'views' 
                : data.id === 'likes' ? 'likes'
                : data.id === 'comments' ? 'comments'
                : data.id === 'shares' ? 'shares'
                : 'views'; // default to views
              
              sortedItems = videosInInterval
                .sort((a: VideoSubmission, b: VideoSubmission) => ((b as any)[metricKey] || 0) - ((a as any)[metricKey] || 0))
                .slice(0, 5);
            }
            
              // Top items sorted by metric
            
            // Get the metric label and key for display
            const metricLabel = data.id === 'views' ? 'Views'
              : data.id === 'likes' ? 'Likes'
              : data.id === 'comments' ? 'Comments'
              : data.id === 'shares' ? 'Shares'
              : data.id === 'accounts' ? 'Total Views'
              : data.id === 'link-clicks' ? 'Clicks'
              : 'Views';
            
            const metricKey = data.id === 'views' ? 'views'
              : data.id === 'likes' ? 'likes'
              : data.id === 'comments' ? 'comments'
              : data.id === 'shares' ? 'shares'
              : 'views';
            
            return (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                    {dateStr}
                  </p>
                  <div className="flex items-baseline gap-3">
                  <p className="text-2xl font-bold text-white">
                    {displayValue}
                  </p>
                    {ppComparison && (
                      <span className={`text-xs font-semibold ${ppComparison.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {ppComparison.isPositive ? '↑' : '↓'} {Math.abs(ppComparison.percentChange).toFixed(0)}%
                      </span>
                    )}
                  </div>
            </div>
                
                {/* Divider */}
                <div className="border-t border-white/10 mx-5"></div>
                
                {/* Content List - Accounts or Videos */}
                {sortedItems.length > 0 ? (
                  <div className="px-5 py-3">
                    {data.id === 'accounts' ? (
                      // Render Accounts with Profile Pictures
                      sortedItems.map((account: any, idx: number) => (
                        <div 
                          key={`${account.handle}-${idx}`}
                          className="flex items-center gap-3 py-2.5 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
                        >
                          {/* Profile Picture with Platform Icon */}
                          <div className="flex-shrink-0 w-12 h-12 relative">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800">
                              {account.profilePicture ? (
                                <img 
                                  src={account.profilePicture} 
                                  alt={account.handle} 
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <AtSign className="w-6 h-6 text-gray-600" />
                                </div>
                              )}
                            </div>
                            {/* Platform Icon Badge */}
                            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#1a1a1a] border-2 border-[#1a1a1a] flex items-center justify-center">
                              <div className="w-3.5 h-3.5">
                                <PlatformIcon platform={account.platform} size="sm" />
                              </div>
          </div>
        </div>

                          {/* Metadata */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate leading-tight mb-1">
                              {account.handle}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-400">
                                {account.videoCount} {account.videoCount === 1 ? 'video' : 'videos'}
              </span>
            </div>
          </div>
                          
                          {/* Total Views */}
                          <div className="flex-shrink-0 text-right">
                            <p className="text-sm font-bold text-white">
                              {formatDisplayNumber(account.totalViews)}
                            </p>
                            <p className="text-xs text-gray-500">{metricLabel}</p>
        </div>
                        </div>
                      ))
                    ) : data.id === 'link-clicks' ? (
                      // Render Link Clicks with Account Profile Pictures
                      sortedItems.map((link: any, idx: number) => (
                        <div 
                          key={`${link.linkId}-${idx}`}
                          className="flex items-center gap-3 py-2.5 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
                        >
                          {/* Account Profile Picture (if attached) */}
                          {link.accountHandle ? (
                            <div className="flex-shrink-0 w-12 h-12 relative">
                              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800">
                                {link.accountProfilePicture ? (
                                  <img 
                                    src={link.accountProfilePicture} 
                                    alt={link.accountHandle} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <AtSign className="w-6 h-6 text-gray-600" />
                                  </div>
                                )}
                              </div>
                              {/* Platform Icon Badge */}
                              {link.accountPlatform && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#1a1a1a] border-2 border-[#1a1a1a] flex items-center justify-center">
                                  <div className="w-3.5 h-3.5">
                                    <PlatformIcon platform={link.accountPlatform} size="sm" />
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center">
                              <LinkIcon className="w-6 h-6 text-gray-600" />
                            </div>
                          )}
                          
                          {/* Link Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate leading-tight mb-1">
                              {link.title}
                            </p>
                            <div className="flex items-center gap-1.5">
                              {link.accountHandle && (
                                <span className="text-xs text-gray-400">
                                  {link.accountHandle}
                                </span>
                              )}
                              {link.shortCode && (
                                <span className="text-xs text-gray-500">
                                  • {link.shortCode}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Click Count */}
                          <div className="flex-shrink-0 text-right">
                            <p className="text-sm font-bold text-white">
                              {formatDisplayNumber(link.clicks)}
                            </p>
                            <p className="text-xs text-gray-500">{link.clicks === 1 ? 'click' : 'clicks'}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      // Render Videos
                      sortedItems.map((video: VideoSubmission, idx: number) => (
                        <div 
                          key={`${video.id}-${idx}`}
                          className="flex items-center gap-3 py-2.5 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
                        >
                          {/* Thumbnail */}
                          <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-800">
                            {video.thumbnail ? (
                              <img 
                                src={video.thumbnail} 
                                alt={video.title || video.caption || 'Video'} 
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
                              {video.title || video.caption || '(No caption)'}
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
                          
                          {/* Metric Value */}
                          <div className="flex-shrink-0 text-right">
                            <p className="text-sm font-bold text-white">
                              {formatDisplayNumber((video as any)[metricKey] || 0)}
                            </p>
                            <p className="text-xs text-gray-500">{metricLabel}</p>
                          </div>
                        </div>
                      ))
                    )}
                    
                    {/* Click to Expand */}
                    <div className="mt-2 pt-3 border-t border-white/10">
                      <button className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-white transition-colors">
                        <span>Click to expand data</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-6 text-center">
                    <Video className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No data for this date</p>
                  </div>
                )}
                
              </>
            );
          })()}
          </div>,
          document.body
        );
      })()}
    </div>
  );
};

export default KPICards;
