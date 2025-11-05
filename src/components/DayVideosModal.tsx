import React, { useMemo, useState } from 'react';
import { X, Eye, Heart, MessageCircle, Share2, Activity, Video, Users, MousePointerClick, ChevronLeft, ChevronRight, Play, TrendingUp, Upload, RefreshCw } from 'lucide-react';
import { VideoSubmission } from '../types';
import { TimeInterval, DataAggregationService } from '../services/DataAggregationService';
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

  // Calculate Refreshed Videos (videos with snapshots captured in the interval, showing growth deltas)
  const refreshedVideos = useMemo(() => {
    if (!interval) return [];
    
    const videosWithSnapshotsInInterval = filteredVideos.filter((video: VideoSubmission) => {
      const snapshots = video.snapshots || [];
      return snapshots.some(snapshot => {
        const snapshotDate = new Date(snapshot.capturedAt);
        return DataAggregationService.isDateInInterval(snapshotDate, interval);
      });
    });

    return videosWithSnapshotsInInterval
      .map((video: VideoSubmission) => {
        const allSnapshots = video.snapshots || [];
        
        // Find all snapshots in this interval
        const snapshotsInInterval = allSnapshots.filter(snapshot => {
          const snapshotDate = new Date(snapshot.capturedAt);
          return DataAggregationService.isDateInInterval(snapshotDate, interval);
        });
        
        const latestSnapshot = snapshotsInInterval.sort((a, b) => 
          new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
        )[0];
        
        // Calculate growth in this interval for views
        const snapshotsInOrBeforeInterval = allSnapshots.filter(snapshot => {
          const snapshotDate = new Date(snapshot.capturedAt);
          return snapshotDate <= interval.endDate;
        });
        
        const sortedSnapshots = [...snapshotsInOrBeforeInterval].sort((a, b) => 
          new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
        );
        
        // Get snapshot at/before interval start (baseline)
        const snapshotAtStart = sortedSnapshots.filter(s => 
          new Date(s.capturedAt) <= interval.startDate
        ).pop();
        
        // Get latest snapshot at/before interval end
        const snapshotAtEnd = sortedSnapshots.filter(s => 
          new Date(s.capturedAt) <= interval.endDate
        ).pop();
        
        // Calculate delta for views
        let viewsDelta = 0;
        if (snapshotAtEnd) {
          if (snapshotAtStart && snapshotAtStart !== snapshotAtEnd) {
            viewsDelta = Math.max(0, snapshotAtEnd.views || 0) - (snapshotAtStart.views || 0);
          } else if (!snapshotAtStart) {
            viewsDelta = snapshotAtEnd.views || 0;
          }
        }
        
        return {
          video,
          lastRefreshed: latestSnapshot ? new Date(latestSnapshot.capturedAt) : new Date(),
          snapshotCountInInterval: snapshotsInInterval.length,
          viewsDelta: viewsDelta
        };
      })
      .sort((a, b) => b.lastRefreshed.getTime() - a.lastRefreshed.getTime())
      .slice(0, 10);
  }, [filteredVideos, interval]);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-[1400px] max-h-[85vh] overflow-hidden border border-white/10 ring-1 ring-white/5"
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

        {/* Main Content - 4 Column Layout */}
        <div className="flex gap-3 p-6 overflow-hidden" style={{ height: 'calc(85vh - 100px)' }}>
          {/* Column 1: New Uploads */}
          <div className="w-64 flex-shrink-0 flex flex-col">
            <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
              <Upload className="w-3.5 h-3.5" />
              New Uploads ({newUploads.length})
            </h3>
            <div className="overflow-auto space-y-2 flex-1">
              {newUploads.length > 0 ? (
                newUploads.map((video, idx) => (
                  <div 
                    key={`new-${video.id}-${idx}`}
                    onClick={() => onVideoClick?.(video)}
                    className="bg-[#1a1a1a] rounded-lg p-2.5 border border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {/* Thumbnail */}
                      <div className="flex-shrink-0 w-14 h-14 rounded-md overflow-hidden bg-gray-800">
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
                        <p className="text-xs text-white font-medium leading-tight mb-1 line-clamp-2">
                          {((video.title || video.caption || '(No caption)').length > 40 
                            ? (video.title || video.caption || '(No caption)').substring(0, 40) + '...'
                            : (video.title || video.caption || '(No caption)'))}
                        </p>
                        <div className="flex items-center gap-1 mb-0.5">
                          <div className="w-3 h-3">
                            <PlatformIcon platform={video.platform} size="sm" />
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {video.uploaderHandle || video.platform}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500">
                          {formatNumber(video.views || 0)} views
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Upload className="w-10 h-10 text-gray-600 mb-2" />
                  <p className="text-xs text-gray-500">No new uploads</p>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Refreshed Videos */}
          <div className="w-64 flex-shrink-0 flex flex-col border-l border-white/5 pl-3">
            <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" />
              Refreshed Videos ({refreshedVideos.length})
            </h3>
            <div className="overflow-auto space-y-2 flex-1">
              {refreshedVideos.length > 0 ? (
                refreshedVideos.map((item: any, idx: number) => (
                  <div 
                    key={`refreshed-${item.video.id}-${idx}`}
                    onClick={() => onVideoClick?.(item.video)}
                    className="bg-[#1a1a1a] rounded-lg p-2.5 border border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {/* Thumbnail */}
                      <div className="flex-shrink-0 w-14 h-14 rounded-md overflow-hidden bg-gray-800">
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
                            <Play className="w-5 h-5 text-gray-600" />
                          </div>
                        )}
                      </div>
                      
                      {/* Metadata */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white font-medium leading-tight mb-1 line-clamp-2">
                          {((item.video.title || item.video.caption || '(No caption)').length > 40 
                            ? (item.video.title || item.video.caption || '(No caption)').substring(0, 40) + '...'
                            : (item.video.title || item.video.caption || '(No caption)'))}
                        </p>
                        <div className="flex items-center gap-1 mb-0.5">
                          <div className="w-3 h-3">
                            <PlatformIcon platform={item.video.platform} size="sm" />
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {item.snapshotCountInInterval} snapshot{item.snapshotCountInInterval !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <p className="text-[10px] font-semibold text-emerald-400">
                          +{formatNumber(item.viewsDelta)} views
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <RefreshCw className="w-10 h-10 text-gray-600 mb-2" />
                  <p className="text-xs text-gray-500">No refreshed videos</p>
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Top Gainers */}
          <div className="w-64 flex-shrink-0 flex flex-col border-l border-white/5 pl-3">
            <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" />
              Top Gainers ({topGainers.length})
            </h3>
            <div className="overflow-auto space-y-2 flex-1">
              {topGainers.length > 0 ? (
                topGainers.map((item: any, idx: number) => (
                  <div 
                    key={`gainer-${item.video.id}-${idx}`}
                    onClick={() => onVideoClick?.(item.video)}
                    className="bg-[#1a1a1a] rounded-lg p-2.5 border border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {/* Thumbnail */}
                      <div className="flex-shrink-0 w-14 h-14 rounded-md overflow-hidden bg-gray-800 relative">
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
                            <Play className="w-5 h-5 text-gray-600" />
                          </div>
                        )}
                        {/* Growth badge */}
                        <div className="absolute top-0.5 right-0.5 bg-emerald-500/90 backdrop-blur-sm rounded px-1 py-0.5">
                          <span className="text-[9px] font-bold text-white">
                            +{item.growth.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      
                      {/* Metadata */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white font-medium leading-tight mb-1 line-clamp-2">
                          {((item.video.title || item.video.caption || '(No caption)').length > 40 
                            ? (item.video.title || item.video.caption || '(No caption)').substring(0, 40) + '...'
                            : (item.video.title || item.video.caption || '(No caption)'))}
                        </p>
                        <div className="flex items-center gap-1 mb-0.5">
                          <div className="w-3 h-3">
                            <PlatformIcon platform={item.video.platform} size="sm" />
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {item.snapshotCount} snapshots
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[10px] font-semibold text-emerald-400">
                            +{formatNumber(item.viewsGained)}
                          </p>
                          <span className="text-[10px] text-gray-500">→</span>
                          <p className="text-[10px] text-gray-300">
                            {formatNumber(item.currentViews)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <TrendingUp className="w-10 h-10 text-gray-600 mb-2" />
                  <p className="text-xs text-gray-500">No growth data</p>
                  <p className="text-[10px] text-gray-600 mt-1">Videos need snapshots</p>
                </div>
              )}
            </div>
          </div>

          {/* Column 4: KPI Metrics Grid - More Compact */}
          <div className="flex-1 flex flex-col border-l border-white/5 pl-3">
            <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">All Metrics</h3>
            <div className="grid grid-cols-2 gap-2.5 overflow-auto content-start" style={{ height: 'calc(85vh - 150px)' }}>
            {/* Views */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10 min-h-[90px] flex flex-col justify-between">
              {/* Icon and label */}
              <div className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-white/60" />
                <p className="text-[10px] text-gray-400 font-medium">Views</p>
              </div>
              
              {/* Value with percentage */}
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <p className="text-xl font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.views : cpKPIMetrics.views)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.views, cpKPIMetrics.views)
                    : calculateComparison(cpKPIMetrics.views, ppKPIMetrics.views);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[9px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Likes */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10 min-h-[90px] flex flex-col justify-between">
              <div className="flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-white/60" />
                <p className="text-[10px] text-gray-400 font-medium">Likes</p>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <p className="text-xl font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.likes : cpKPIMetrics.likes)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.likes, cpKPIMetrics.likes)
                    : calculateComparison(cpKPIMetrics.likes, ppKPIMetrics.likes);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[9px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Comments */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10 min-h-[90px] flex flex-col justify-between">
              <div className="flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-white/60" />
                <p className="text-[10px] text-gray-400 font-medium">Comments</p>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <p className="text-xl font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.comments : cpKPIMetrics.comments)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.comments, cpKPIMetrics.comments)
                    : calculateComparison(cpKPIMetrics.comments, ppKPIMetrics.comments);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[9px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Shares */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10 min-h-[90px] flex flex-col justify-between">
              <div className="flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-white/60" />
                <p className="text-[10px] text-gray-400 font-medium">Shares</p>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <p className="text-xl font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.shares : cpKPIMetrics.shares)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.shares, cpKPIMetrics.shares)
                    : calculateComparison(cpKPIMetrics.shares, ppKPIMetrics.shares);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[9px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Engagement Rate */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10 min-h-[90px] flex flex-col justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-white/60" />
                <p className="text-[10px] text-gray-400 font-medium">Engagement</p>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <p className="text-xl font-bold text-white">
                  {(showPreviousPeriod ? ppKPIMetrics.engagementRate : cpKPIMetrics.engagementRate).toFixed(2)}%
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.engagementRate, cpKPIMetrics.engagementRate)
                    : calculateComparison(cpKPIMetrics.engagementRate, ppKPIMetrics.engagementRate);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[9px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Videos */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10 min-h-[90px] flex flex-col justify-between">
              <div className="flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-white/60" />
                <p className="text-[10px] text-gray-400 font-medium">Videos</p>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <p className="text-xl font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.videos : cpKPIMetrics.videos)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.videos, cpKPIMetrics.videos)
                    : calculateComparison(cpKPIMetrics.videos, cpKPIMetrics.videos);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[9px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Accounts */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10 min-h-[90px] flex flex-col justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-white/60" />
                <p className="text-[10px] text-gray-400 font-medium">Accounts</p>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <p className="text-xl font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.accounts : cpKPIMetrics.accounts)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.accounts, cpKPIMetrics.accounts)
                    : calculateComparison(ppKPIMetrics.accounts, cpKPIMetrics.accounts);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[9px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Link Clicks */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10 min-h-[90px] flex flex-col justify-between">
              <div className="flex items-center gap-1.5">
                <MousePointerClick className="w-3.5 h-3.5 text-white/60" />
                <p className="text-[10px] text-gray-400 font-medium">Clicks</p>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <p className="text-xl font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.clicks : cpKPIMetrics.clicks)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.clicks, cpKPIMetrics.clicks)
                    : calculateComparison(cpKPIMetrics.clicks, ppKPIMetrics.clicks);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[9px] font-semibold ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
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

