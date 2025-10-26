import React, { useMemo, useState, useEffect } from 'react';
import { X, Calendar, Eye, Heart, MessageCircle, Share2, Activity, Video, Users, MousePointerClick, ChevronLeft, ChevronRight } from 'lucide-react';
import { VideoSubmission } from '../types';
import { VideoSubmissionsTable } from './VideoSubmissionsTable';
import { TimeInterval } from '../services/DataAggregationService';
import { LinkClick } from '../services/LinkClicksService';

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

  // Debug: Log props on mount
  useEffect(() => {
    console.log('📋 DayVideosModal Props:', {
      dayOfWeek,
      hourRange,
      totalVideos: videos.length,
      date,
      accountFilter
    });
  }, [dayOfWeek, hourRange, videos.length, date, accountFilter]);

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

  // Generate button text with actual dates for clarity
  const getToggleButtonText = () => {
    if (!ppInterval) return { show: 'Show Previous Period', showing: 'Show Current Period' };
    
    // Show the actual date/period being compared to for clarity
    const ppLabel = formatIntervalRange(ppInterval);
    const cpLabel = interval ? formatIntervalRange(interval) : '';
    
    return { 
      show: `Show Previous Period (${ppLabel})`, 
      showing: `Show Current Period (${cpLabel})` 
    };
  };

  const buttonText = getToggleButtonText();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-6xl max-h-[85vh] overflow-hidden border border-white/10 ring-1 ring-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {(() => {
                // If filtering by day of week and hour, show special format
                if (dayOfWeek !== undefined && hourRange) {
                  const dayName = getDayName(dayOfWeek);
                  const timeRange = formatHourRange(hourRange.start, hourRange.end);
                  return `Every video posted ${dayName} ${timeRange} - ${dateRangeLabel || 'All Time'}`;
                }
                
                const currentInterval = showPreviousPeriod ? ppInterval : interval;
                // Priority: interval > dateRangeLabel > fallback to formatted date
                if (currentInterval) {
                  return accountFilter 
                    ? `@${accountFilter} ${formatIntervalRange(currentInterval)}`
                    : formatIntervalRange(currentInterval);
                }
                if (dateRangeLabel && accountFilter) {
                  return `@${accountFilter} ${dateRangeLabel} Stats`;
                }
                return dateRangeLabel || formatDate(date);
              })()}
            </h2>
            <p className={`text-sm mt-1 font-medium ${showPreviousPeriod ? 'text-red-400' : 'text-emerald-400'}`}>
              {showPreviousPeriod 
                ? 'Viewing data from a past period' 
                : 'Viewing data from current period'
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Previous Period Toggle */}
            {hasPPData && (
              <button
                onClick={() => setShowPreviousPeriod(!showPreviousPeriod)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                  showPreviousPeriod
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/25'
                }`}
              >
                {showPreviousPeriod ? (
                  <>
                    <ChevronRight className="w-4 h-4" />
                    {buttonText.showing}
                  </>
                ) : (
                  <>
                    <ChevronLeft className="w-4 h-4" />
                    {buttonText.show}
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        {/* Main Content - 2 Column Layout */}
        <div className="flex gap-6 p-6 overflow-hidden" style={{ height: 'calc(85vh - 100px)' }}>
          {/* Left: Videos Table */}
          <div className="flex-1 overflow-auto min-w-0" style={{ height: 'calc(85vh - 150px)' }}>
            {filteredVideos.length > 0 ? (
              <VideoSubmissionsTable 
                submissions={filteredVideos}
                onVideoClick={onVideoClick}
                headerTitle={(() => {
                  // If filtering by day of week and hour, show that instead of date
                  if (dayOfWeek !== undefined && hourRange) {
                    const dayName = getDayName(dayOfWeek);
                    const timeRange = formatHourRange(hourRange.start, hourRange.end);
                    return `All ${dayName}s ${timeRange}`;
                  }
                  
                  const currentInterval = showPreviousPeriod ? ppInterval : interval;
                  if (currentInterval) {
                    return `Content from ${formatIntervalRange(currentInterval)}`;
                  }
                  return `Content from ${formatDate(date)}`;
                })()}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="p-4 bg-white/5 rounded-full mb-4 border border-white/10">
                  <Calendar className="w-12 h-12 text-gray-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  No videos found
                </h3>
                <p className="text-gray-400 text-sm">
                  {(() => {
                    // If filtering by day of week and hour
                    if (dayOfWeek !== undefined && hourRange) {
                      const dayName = getDayName(dayOfWeek);
                      const timeRange = formatHourRange(hourRange.start, hourRange.end);
                      return accountFilter 
                        ? `No videos from @${accountFilter} on ${dayName}s ${timeRange}`
                        : `No videos were uploaded on ${dayName}s ${timeRange}`;
                    }
                    
                    // Otherwise show date-based message
                    return accountFilter 
                      ? `No videos from @${accountFilter} on ${formatDate(date)}`
                      : `No videos were uploaded on ${formatDate(date)}`;
                  })()}
                </p>
              </div>
            )}
          </div>

          {/* Right: KPI Metrics Grid (2x4) */}
          <div className="w-80 flex-shrink-0 flex flex-col">
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">All Metrics</h3>
            <div className="grid grid-cols-2 gap-3 overflow-auto content-start" style={{ height: 'calc(85vh - 150px)' }}>
            {/* Views */}
            <div className="bg-[#1a1a1a] rounded-lg p-5 border border-white/10 min-h-[120px] flex flex-col justify-between">
              {/* Icon and label */}
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Views</p>
              </div>
              
              {/* Value with percentage */}
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.views : cpKPIMetrics.views)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.views, cpKPIMetrics.views)
                    : calculateComparison(cpKPIMetrics.views, ppKPIMetrics.views);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Likes */}
            <div className="bg-[#1a1a1a] rounded-lg p-5 border border-white/10 min-h-[120px] flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Likes</p>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.likes : cpKPIMetrics.likes)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.likes, cpKPIMetrics.likes)
                    : calculateComparison(cpKPIMetrics.likes, ppKPIMetrics.likes);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Comments */}
            <div className="bg-[#1a1a1a] rounded-lg p-5 border border-white/10 min-h-[120px] flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Comments</p>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.comments : cpKPIMetrics.comments)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.comments, cpKPIMetrics.comments)
                    : calculateComparison(cpKPIMetrics.comments, ppKPIMetrics.comments);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Shares */}
            <div className="bg-[#1a1a1a] rounded-lg p-5 border border-white/10 min-h-[120px] flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Shares</p>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.shares : cpKPIMetrics.shares)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.shares, cpKPIMetrics.shares)
                    : calculateComparison(cpKPIMetrics.shares, ppKPIMetrics.shares);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Engagement Rate */}
            <div className="bg-[#1a1a1a] rounded-lg p-5 border border-white/10 min-h-[120px] flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Engagement</p>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-bold text-white">
                  {(showPreviousPeriod ? ppKPIMetrics.engagementRate : cpKPIMetrics.engagementRate).toFixed(2)}%
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.engagementRate, cpKPIMetrics.engagementRate)
                    : calculateComparison(cpKPIMetrics.engagementRate, ppKPIMetrics.engagementRate);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Videos */}
            <div className="bg-[#1a1a1a] rounded-lg p-5 border border-white/10 min-h-[120px] flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Videos</p>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.videos : cpKPIMetrics.videos)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.videos, cpKPIMetrics.videos)
                    : calculateComparison(cpKPIMetrics.videos, cpKPIMetrics.videos);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Accounts */}
            <div className="bg-[#1a1a1a] rounded-lg p-5 border border-white/10 min-h-[120px] flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Accounts</p>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.accounts : cpKPIMetrics.accounts)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.accounts, cpKPIMetrics.accounts)
                    : calculateComparison(ppKPIMetrics.accounts, cpKPIMetrics.accounts);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Link Clicks */}
            <div className="bg-[#1a1a1a] rounded-lg p-5 border border-white/10 min-h-[120px] flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Clicks</p>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.clicks : cpKPIMetrics.clicks)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.clicks, cpKPIMetrics.clicks)
                    : calculateComparison(cpKPIMetrics.clicks, ppKPIMetrics.clicks);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayVideosModal;

