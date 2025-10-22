import React, { useMemo, useState } from 'react';
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
  ppLinkClicks = []
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

  // Filter by account if specified
  const filteredVideos = useMemo(() => {
    const videosToFilter = showPreviousPeriod ? ppVideos : videos;
    if (!accountFilter) return videosToFilter;
    return videosToFilter.filter(v => 
      v.uploaderHandle?.toLowerCase() === accountFilter.toLowerCase()
    );
  }, [videos, ppVideos, accountFilter, showPreviousPeriod]);

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
    const videosToUse = accountFilter 
      ? videos.filter(v => v.uploaderHandle?.toLowerCase() === accountFilter.toLowerCase())
      : videos;
    
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
  }, [videos, accountFilter, linkClicks]);

  // Calculate all KPI metrics for previous period
  const ppKPIMetrics = useMemo(() => {
    const videosToUse = accountFilter 
      ? ppVideos.filter(v => v.uploaderHandle?.toLowerCase() === accountFilter.toLowerCase())
      : ppVideos;
    
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
  }, [ppVideos, accountFilter, ppLinkClicks]);

  // Generate button text based on interval type
  const getToggleButtonText = () => {
    if (!interval) return { show: 'Show Previous Period', showing: 'Show Current Period' };
    
    switch (interval.intervalType) {
      case 'day':
        return { show: 'Show Previous Day', showing: 'Show Current Day' };
      case 'week':
        return { show: 'Show Previous Week', showing: 'Show Current Week' };
      case 'month':
        return { show: 'Show Previous Month', showing: 'Show Current Month' };
      case 'year':
        return { show: 'Show Previous Year', showing: 'Show Current Year' };
      default:
        return { show: 'Show Previous Period', showing: 'Show Current Period' };
    }
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
                  {accountFilter ? 
                    `No videos from @${accountFilter} on ${formatDate(date)}` :
                    `No videos were uploaded on ${formatDate(date)}`
                  }
                </p>
              </div>
            )}
          </div>

          {/* Right: KPI Metrics Grid (2x4) */}
          <div className="w-80 flex-shrink-0 flex flex-col">
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">All Metrics</h3>
            <div className="grid grid-cols-2 gap-3 overflow-auto content-start" style={{ height: 'calc(85vh - 150px)' }}>
            {/* Views */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Views</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.views : cpKPIMetrics.views)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.views, cpKPIMetrics.views)
                    : calculateComparison(cpKPIMetrics.views, ppKPIMetrics.views);
                  return comp.percentChange > 0 ? (
                    <span className={`text-xs font-semibold flex items-center ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Likes */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Likes</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.likes : cpKPIMetrics.likes)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.likes, cpKPIMetrics.likes)
                    : calculateComparison(cpKPIMetrics.likes, ppKPIMetrics.likes);
                  return comp.percentChange > 0 ? (
                    <span className={`text-xs font-semibold flex items-center ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Comments */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Comments</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.comments : cpKPIMetrics.comments)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.comments, cpKPIMetrics.comments)
                    : calculateComparison(cpKPIMetrics.comments, ppKPIMetrics.comments);
                  return comp.percentChange > 0 ? (
                    <span className={`text-xs font-semibold flex items-center ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Shares */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Share2 className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Shares</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.shares : cpKPIMetrics.shares)}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.shares, cpKPIMetrics.shares)
                    : calculateComparison(cpKPIMetrics.shares, ppKPIMetrics.shares);
                  return comp.percentChange > 0 ? (
                    <span className={`text-xs font-semibold flex items-center ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Engagement Rate */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Engagement</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold text-white">
                  {(showPreviousPeriod ? ppKPIMetrics.engagementRate : cpKPIMetrics.engagementRate).toFixed(2)}%
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.engagementRate, cpKPIMetrics.engagementRate)
                    : calculateComparison(cpKPIMetrics.engagementRate, ppKPIMetrics.engagementRate);
                  return comp.percentChange > 0 ? (
                    <span className={`text-xs font-semibold flex items-center ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Videos */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Videos</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold text-white">
                  {showPreviousPeriod ? ppKPIMetrics.videos : cpKPIMetrics.videos}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.videos, cpKPIMetrics.videos)
                    : calculateComparison(cpKPIMetrics.videos, ppKPIMetrics.videos);
                  return comp.percentChange > 0 ? (
                    <span className={`text-xs font-semibold flex items-center ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Accounts */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Accounts</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold text-white">
                  {showPreviousPeriod ? ppKPIMetrics.accounts : cpKPIMetrics.accounts}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.accounts, cpKPIMetrics.accounts)
                    : calculateComparison(cpKPIMetrics.accounts, ppKPIMetrics.accounts);
                  return comp.percentChange > 0 ? (
                    <span className={`text-xs font-semibold flex items-center ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {comp.isPositive ? '↑' : '↓'} {comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Link Clicks */}
            <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <MousePointerClick className="w-4 h-4 text-white/70" />
                <p className="text-xs text-gray-400 font-medium">Clicks</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold text-white">
                  {showPreviousPeriod ? ppKPIMetrics.clicks : cpKPIMetrics.clicks}
                </p>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.clicks, cpKPIMetrics.clicks)
                    : calculateComparison(cpKPIMetrics.clicks, ppKPIMetrics.clicks);
                  return comp.percentChange > 0 ? (
                    <span className={`text-xs font-semibold flex items-center ${comp.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
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

