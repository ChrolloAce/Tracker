import React, { useMemo, useState } from 'react';
import { X, Eye, Heart, MessageCircle, Share2, Activity, Video, Users, MousePointerClick, Play, TrendingUp, Upload } from 'lucide-react';
import { VideoSubmission } from '../types';
import { TimeInterval } from '../services/DataAggregationService';
import { LinkClick } from '../services/LinkClicksService';
import { PlatformIcon } from './ui/PlatformIcon';

interface DayVideosModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  videos: VideoSubmission[];
  metricLabel: string;
  onVideoClick?: (video: VideoSubmission) => void;
  accountFilter?: string; // Optional: filter by account username
  dateRangeLabel?: string; // Optional: show date range instead of specific date (e.g., "Last 7 Days")
  interval?: TimeInterval | null; // Optional: interval information for formatted date range
  ppVideos?: VideoSubmission[]; // Previous period videos
  ppInterval?: TimeInterval | null; // Previous period interval
  linkClicks?: LinkClick[]; // Link clicks for the period
  ppLinkClicks?: LinkClick[]; // Previous period link clicks
  dayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // Optional: filter by specific day of week (0 = Sunday, 6 = Saturday)
  hourRange?: { start: number; end: number }; // Optional: filter by hour range (e.g., {start: 13, end: 14})
}

const DayVideosModal: React.FC<DayVideosModalProps> = ({
  isOpen,
  onClose,
  date,
  videos,
  metricLabel: _metricLabel,
  onVideoClick,
  accountFilter,
  dateRangeLabel,
  interval,
  ppVideos = [],
  ppInterval,
  linkClicks = [],
  ppLinkClicks = [],
  dayOfWeek,
  hourRange
}) => {
  const [showPreviousPeriod, setShowPreviousPeriod] = useState(false);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatIntervalRange = (interval: TimeInterval): string => {
    const startDate = new Date(interval.startDate);
    const endDate = new Date(interval.endDate);
    
    switch (interval.intervalType) {
      case 'year':
        // Just show the year: "2024"
        return startDate.getFullYear().toString();
      
      case 'month':
        // Show month and year: "Oct 2024"
        return startDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short'
        });
      
      case 'week':
        // Show date range: "Sun, Oct 1, 2024 - Sat, Oct 7, 2024"
        const startFormatted = startDate.toLocaleDateString('en-US', { 
          weekday: 'short',
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
        const endFormatted = endDate.toLocaleDateString('en-US', { 
          weekday: 'short',
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
        return `${startFormatted} - ${endFormatted}`;
      
      case 'day':
      default:
        // Show single day: "Sun, Oct 1, 2024"
        return formatDate(startDate);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const getDayName = (dayIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayIndex];
  };

  const formatHourRange = (start: number, end: number): string => {
    const formatHour = (hour: number) => {
      const h = hour % 12 === 0 ? 12 : hour % 12;
      const period = hour < 12 ? 'AM' : 'PM';
      return `${h} ${period}`;
    };
    return `${formatHour(start)} - ${formatHour(end)}`;
  };

  // Filter by account, day of week, and hour if specified
  const filteredVideos = useMemo(() => {
    let videosToFilter = showPreviousPeriod ? ppVideos : videos;
    
    // Debug logging
    if (dayOfWeek !== undefined || hourRange) {
      console.log('🔍 DayVideosModal Filtering:', {
        dayOfWeek,
        hourRange,
        totalVideos: videosToFilter.length,
        sampleVideo: videosToFilter[0] ? {
          uploadDate: videosToFilter[0].uploadDate,
          dateSubmitted: videosToFilter[0].dateSubmitted,
          parsedDay: (videosToFilter[0].uploadDate ? new Date(videosToFilter[0].uploadDate) : new Date(videosToFilter[0].dateSubmitted)).getDay(),
          parsedHour: (videosToFilter[0].uploadDate ? new Date(videosToFilter[0].uploadDate) : new Date(videosToFilter[0].dateSubmitted)).getHours()
        } : null
      });
    }
    
    // Filter by account
    if (accountFilter) {
      videosToFilter = videosToFilter.filter(v => 
        v.uploaderHandle?.toLowerCase() === accountFilter.toLowerCase()
      );
    }
    
    // Filter by day of week (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== undefined) {
      videosToFilter = videosToFilter.filter(v => {
        const dateStr = v.uploadDate || v.dateSubmitted;
        if (!dateStr) return false;
        
        const videoDate = new Date(dateStr);
        const videoDayOfWeek = videoDate.getDay();
        const matches = videoDayOfWeek === dayOfWeek;
        
        return matches;
      });
      console.log(`✅ After day filter (${dayOfWeek}):`, videosToFilter.length, 'videos');
    }
    
    // Filter by hour range
    if (hourRange) {
      videosToFilter = videosToFilter.filter(v => {
        const dateStr = v.uploadDate || v.dateSubmitted;
        if (!dateStr) return false;
        
        const videoDate = new Date(dateStr);
        const hour = videoDate.getHours();
        const matches = hour >= hourRange.start && hour < hourRange.end;
        
        return matches;
      });
      console.log(`✅ After hour filter (${hourRange.start}-${hourRange.end}):`, videosToFilter.length, 'videos');
    }
    
    return videosToFilter;
  }, [videos, ppVideos, accountFilter, dayOfWeek, hourRange, showPreviousPeriod]);

  const calculateComparison = (cpValue: number, ppValue: number) => {
    if (ppValue === 0) return { percentChange: 0, isPositive: true };
    const percentChange = ((cpValue - ppValue) / ppValue) * 100;
    return {
      percentChange: Math.abs(percentChange),
      isPositive: percentChange >= 0
    };
  };

  const hasPPData = ppInterval !== null && ppInterval !== undefined;

  // Calculate all KPI metrics for current period
  const cpKPIMetrics = useMemo(() => {
    let videosToUse = videos;
    
    // Apply account filter
    if (accountFilter) {
      videosToUse = videosToUse.filter(v => v.uploaderHandle?.toLowerCase() === accountFilter.toLowerCase());
    }
    
    // Apply day of week filter
    if (dayOfWeek !== undefined) {
      videosToUse = videosToUse.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        return videoDate.getDay() === dayOfWeek;
      });
    }
    
    // Apply hour range filter
    if (hourRange) {
      videosToUse = videosToUse.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        const hour = videoDate.getHours();
        return hour >= hourRange.start && hour < hourRange.end;
      });
    }
    
    const totalViews = videosToUse.reduce((sum, v) => sum + (v.views || 0), 0);
    const totalLikes = videosToUse.reduce((sum, v) => sum + (v.likes || 0), 0);
    const totalComments = videosToUse.reduce((sum, v) => sum + (v.comments || 0), 0);
    const totalShares = videosToUse.reduce((sum, v) => sum + (v.shares || 0), 0);
    const totalEngagement = totalLikes + totalComments + totalShares;
    const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;
    const uniqueAccounts = new Set(videosToUse.map(v => v.uploaderHandle)).size;
    const clicksCount = linkClicks.length;

    return {
      views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      engagementRate,
      videos: videosToUse.length,
      accounts: uniqueAccounts,
      clicks: clicksCount
    };
  }, [videos, accountFilter, linkClicks, dayOfWeek, hourRange]);

  // Calculate all KPI metrics for previous period
  const ppKPIMetrics = useMemo(() => {
    let videosToUse = ppVideos;
    
    // Apply account filter
    if (accountFilter) {
      videosToUse = videosToUse.filter(v => v.uploaderHandle?.toLowerCase() === accountFilter.toLowerCase());
    }
    
    // Apply day of week filter
    if (dayOfWeek !== undefined) {
      videosToUse = videosToUse.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        return videoDate.getDay() === dayOfWeek;
      });
    }
    
    // Apply hour range filter
    if (hourRange) {
      videosToUse = videosToUse.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        const hour = videoDate.getHours();
        return hour >= hourRange.start && hour < hourRange.end;
      });
    }
    
    const totalViews = videosToUse.reduce((sum, v) => sum + (v.views || 0), 0);
    const totalLikes = videosToUse.reduce((sum, v) => sum + (v.likes || 0), 0);
    const totalComments = videosToUse.reduce((sum, v) => sum + (v.comments || 0), 0);
    const totalShares = videosToUse.reduce((sum, v) => sum + (v.shares || 0), 0);
    const totalEngagement = totalLikes + totalComments + totalShares;
    const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;
    const uniqueAccounts = new Set(videosToUse.map(v => v.uploaderHandle)).size;
    const clicksCount = ppLinkClicks.length;

    return {
      views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      engagementRate,
      videos: videosToUse.length,
      accounts: uniqueAccounts,
      clicks: clicksCount
    };
  }, [ppVideos, accountFilter, ppLinkClicks, dayOfWeek, hourRange]);

  // Calculate New Uploads (most recent videos in the period)
  const newUploads = useMemo(() => {
    return [...filteredVideos]
      .sort((a, b) => {
        const dateA = a.uploadDate ? new Date(a.uploadDate) : new Date(a.dateSubmitted);
        const dateB = b.uploadDate ? new Date(b.uploadDate) : new Date(b.dateSubmitted);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 10); // Show top 10 most recent
  }, [filteredVideos]);

  // Calculate Top Gainers (videos with highest growth from snapshots)
  const topGainers = useMemo(() => {
    return filteredVideos
      .map((video: VideoSubmission) => {
        const snapshots = video.snapshots || [];
        if (snapshots.length < 2) return null;
        
        const sortedSnapshots = [...snapshots].sort((a, b) => 
          new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
        );
        
        const earliest = sortedSnapshots[0];
        const latest = sortedSnapshots[sortedSnapshots.length - 1];
        
        // Calculate growth based on views (most common metric)
        const earliestViews = earliest.views || 0;
        const latestViews = latest.views || video.views || 0;
        const growth = earliestViews > 0 ? ((latestViews - earliestViews) / earliestViews) * 100 : 0;
        
        return {
          video,
          growth,
          currentViews: latestViews,
          snapshotCount: snapshots.length,
          earliestViews,
          viewsGained: latestViews - earliestViews
        };
      })
      .filter(item => item !== null && item.growth > 0)
      .sort((a: any, b: any) => b.growth - a.growth)
      .slice(0, 10); // Show top 10 gainers
  }, [filteredVideos]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-[#0a0a0a] rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden border border-white/[0.06]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white">
              {(() => {
                // If filtering by day of week and hour, show special format
                if (dayOfWeek !== undefined && hourRange) {
                  const dayName = getDayName(dayOfWeek);
                  const timeRange = formatHourRange(hourRange.start, hourRange.end);
                  return `${dayName} ${timeRange}`;
                }
                
                const currentInterval = showPreviousPeriod ? ppInterval : interval;
                // Priority: interval > dateRangeLabel > fallback to formatted date
                if (currentInterval) {
                  return accountFilter 
                    ? `@${accountFilter} · ${formatIntervalRange(currentInterval)}`
                    : formatIntervalRange(currentInterval);
                }
                if (dateRangeLabel && accountFilter) {
                  return `@${accountFilter} · ${dateRangeLabel}`;
                }
                return dateRangeLabel || formatDate(date);
              })()}
            </h2>
            <span className={`text-xs px-2 py-0.5 rounded-full ${showPreviousPeriod ? 'bg-white/5 text-gray-400' : 'bg-white/5 text-gray-400'}`}>
              {showPreviousPeriod ? 'Previous Period' : 'Current Period'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Previous Period Toggle */}
            {hasPPData && (
              <button
                onClick={() => setShowPreviousPeriod(!showPreviousPeriod)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-white/5 text-gray-300 hover:bg-white/10 border border-white/[0.06]"
              >
                {showPreviousPeriod ? (
                  <>Previous Period</>
                ) : (
                  <>Compare Period</>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Main Content - Reorganized Layout */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 65px)' }}>
          {/* Metrics Grid - Primary Focus */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {/* Views */}
            <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Views</span>
                <Eye className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.views : cpKPIMetrics.views)}
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.views, cpKPIMetrics.views)
                    : calculateComparison(cpKPIMetrics.views, ppKPIMetrics.views);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Likes */}
            <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Likes</span>
                <Heart className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.likes : cpKPIMetrics.likes)}
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.likes, cpKPIMetrics.likes)
                    : calculateComparison(cpKPIMetrics.likes, ppKPIMetrics.likes);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Comments */}
            <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Comments</span>
                <MessageCircle className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.comments : cpKPIMetrics.comments)}
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.comments, cpKPIMetrics.comments)
                    : calculateComparison(cpKPIMetrics.comments, ppKPIMetrics.comments);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Shares */}
            <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Shares</span>
                <Share2 className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.shares : cpKPIMetrics.shares)}
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.shares, cpKPIMetrics.shares)
                    : calculateComparison(cpKPIMetrics.shares, ppKPIMetrics.shares);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Engagement Rate */}
            <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Engagement</span>
                <Activity className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {(showPreviousPeriod ? ppKPIMetrics.engagementRate : cpKPIMetrics.engagementRate).toFixed(1)}%
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.engagementRate, cpKPIMetrics.engagementRate)
                    : calculateComparison(cpKPIMetrics.engagementRate, ppKPIMetrics.engagementRate);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Videos */}
            <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Videos</span>
                <Video className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.videos : cpKPIMetrics.videos)}
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.videos, cpKPIMetrics.videos)
                    : calculateComparison(cpKPIMetrics.videos, ppKPIMetrics.videos);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Accounts */}
            <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Accounts</span>
                <Users className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.accounts : cpKPIMetrics.accounts)}
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.accounts, cpKPIMetrics.accounts)
                    : calculateComparison(cpKPIMetrics.accounts, ppKPIMetrics.accounts);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Link Clicks */}
            <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Clicks</span>
                <MousePointerClick className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.clicks : cpKPIMetrics.clicks)}
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.clicks, cpKPIMetrics.clicks)
                    : calculateComparison(cpKPIMetrics.clicks, ppKPIMetrics.clicks);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>
          </div>

          {/* Secondary Content - New Uploads & Top Gainers */}
          <div className="grid grid-cols-2 gap-6">
            {/* New Uploads */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Upload className="w-3.5 h-3.5 text-gray-500" />
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  New Uploads · {newUploads.length}
                </h3>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {newUploads.length > 0 ? (
                  newUploads.map((video, idx) => (
                    <div 
                      key={`new-${video.id}-${idx}`}
                      onClick={() => onVideoClick?.(video)}
                      className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04] hover:bg-white/[0.04] cursor-pointer transition-colors group"
                    >
                      <div className="flex gap-3">
                        {/* Thumbnail */}
                        <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-white/[0.02]">
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
                              <Play className="w-5 h-5 text-gray-700" />
                            </div>
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium mb-1 line-clamp-2 group-hover:text-gray-200 transition-colors">
                            {video.title || video.caption || '(No caption)'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <div className="w-3 h-3">
                              <PlatformIcon platform={video.platform} size="sm" />
                            </div>
                            <span>{video.uploaderHandle || video.platform}</span>
                            <span>·</span>
                            <span>{formatNumber(video.views || 0)} views</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-white/[0.02] flex items-center justify-center mb-3">
                      <Upload className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-sm text-gray-500">No new uploads</p>
                  </div>
                )}
              </div>
            </div>

            {/* Top Gainers */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Top Gainers · {topGainers.length}
                </h3>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {topGainers.length > 0 ? (
                  topGainers.map((item: any, idx: number) => (
                    <div 
                      key={`gainer-${item.video.id}-${idx}`}
                      onClick={() => onVideoClick?.(item.video)}
                      className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04] hover:bg-white/[0.04] cursor-pointer transition-colors group"
                    >
                      <div className="flex gap-3">
                        {/* Thumbnail with Badge */}
                        <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-white/[0.02] relative">
                          {item.video.thumbnail ? (
                            <img 
                              src={item.video.thumbnail} 
                              alt={item.video.title || item.video.caption || 'Video'} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Play className="w-5 h-5 text-gray-700" />
                            </div>
                          )}
                          {/* Growth Badge */}
                          <div className="absolute top-1 right-1 bg-white/90 backdrop-blur-sm rounded px-1.5 py-0.5">
                            <span className="text-[9px] font-bold text-black">
                              +{item.growth.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium mb-1 line-clamp-2 group-hover:text-gray-200 transition-colors">
                            {item.video.title || item.video.caption || '(No caption)'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                            <div className="w-3 h-3">
                              <PlatformIcon platform={item.video.platform} size="sm" />
                            </div>
                            <span>{item.snapshotCount} snapshots</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-gray-400 font-medium">+{formatNumber(item.viewsGained)}</span>
                            <span className="text-gray-600">→</span>
                            <span className="text-gray-400">{formatNumber(item.currentViews)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-white/[0.02] flex items-center justify-center mb-3">
                      <TrendingUp className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-sm text-gray-500">No growth data</p>
                    <p className="text-xs text-gray-600 mt-1">Videos need snapshots</p>
                  </div>
                )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayVideosModal;
