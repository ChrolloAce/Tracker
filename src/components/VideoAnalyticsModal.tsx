import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye, Heart, MessageCircle, Share2, TrendingUp, TrendingDown, Minus, Bookmark, Clock, Flame, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { VideoSubmission } from '../types';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { PlatformIcon } from './ui/PlatformIcon';
import DateRangeFilter, { DateFilterType as ImportedDateFilterType } from './DateRangeFilter';

interface VideoAnalyticsModalProps {
  video: VideoSubmission | null;
  isOpen: boolean;
  onClose: () => void;
  totalCreatorVideos?: number; // Total number of videos from this creator
  hideDateFilter?: boolean; // Hide date filter and always show all time data
}

interface ChartDataPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
  timestamp: number;
}

const VideoAnalyticsModal: React.FC<VideoAnalyticsModalProps> = ({ video, isOpen, onClose, totalCreatorVideos, hideDateFilter = false }) => {
  // Tooltip state for smooth custom tooltips
  const [tooltipData, setTooltipData] = useState<{ 
    x: number; 
    y: number; 
    dataPoint: any; 
    metricKey: string;
    metricLabel: string;
    isPercentage: boolean;
    lineX: number;
    chartRect: DOMRect;
  } | null>(null);

  // Pagination state for snapshots
  const [snapshotsPage, setSnapshotsPage] = useState(1);
  const snapshotsPerPage = 5;
  
  // Date filter state - force 'all' when hideDateFilter is true
  type DateFilterType = ImportedDateFilterType;
  type TimeGranularity = 'daily' | 'weekly' | 'monthly';
  const [dateFilter, setDateFilter] = useState<DateFilterType>(hideDateFilter ? 'all' : 'all');
  const [customDateRange, setCustomDateRange] = useState<{ startDate: Date; endDate: Date } | undefined>();
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>('daily');
  const [showPreviousPeriod, setShowPreviousPeriod] = useState(false);

  // Extract title without hashtags and separate hashtags
  const { cleanTitle, hashtags } = useMemo(() => {
    if (!video) return { cleanTitle: '', hashtags: [] };
    
    const fullText = video.title || video.caption || '';
    
    // Extract hashtags
    const hashtagMatches = fullText.match(/#[\w\u00C0-\u017F]+/g) || [];
    const uniqueHashtags = [...new Set(hashtagMatches)];
    
    // Remove hashtags from title
    const cleanText = fullText.replace(/#[\w\u00C0-\u017F]+/g, '').trim();
    
    return {
      cleanTitle: cleanText || '(No caption)',
      hashtags: uniqueHashtags
    };
  }, [video?.title, video?.caption]);

  // Calculate virality factor (likes + comments + shares relative to views)
  const viralityFactor = useMemo(() => {
    if (!video || video.views === 0) return 0;
    const totalEngagement = video.likes + video.comments + (video.shares || 0);
    return (totalEngagement / video.views) * 100;
  }, [video?.views, video?.likes, video?.comments, video?.shares]);

  // Calculate performance score and ranking
  const performanceScore = useMemo(() => {
    // Default to 100 if totalCreatorVideos not provided
    const maxVideos = totalCreatorVideos || 100;
    
    if (!video) return { score: 0, rank: 0, total: maxVideos };
    
    // Calculate normalized scores (0-100) for each metric
    const engagementRate = video.views > 0 
      ? ((video.likes + video.comments + (video.shares || 0)) / video.views) * 100 
      : 0;
    
    // Normalize views (assuming 1M views = 100 points)
    const viewScore = Math.min((video.views / 1000000) * 100, 100);
    
    // Normalize likes (assuming 50K likes = 100 points)
    const likeScore = Math.min((video.likes / 50000) * 100, 100);
    
    // Engagement rate score (cap at 20% engagement = 100 points)
    const engagementScore = Math.min((engagementRate / 20) * 100, 100);
    
    // Virality score (cap at 10x = 100 points)
    const viralityScore = Math.min((viralityFactor / 10) * 100, 100);
    
    // Weighted average score
    const totalScore = (
      viewScore * 0.30 +      // 30% weight on views
      likeScore * 0.25 +      // 25% weight on likes
      engagementScore * 0.30 + // 30% weight on engagement rate
      viralityScore * 0.15    // 15% weight on virality
    );
    
    // Calculate rank based on score (higher score = lower rank number)
    // Map score (0-100) to rank (1-maxVideos), where 100 score = rank 1
    const rank = Math.max(1, Math.min(maxVideos, Math.round((101 - totalScore) * (maxVideos / 100))));
    
    return {
      score: Math.round(totalScore),
      rank,
      total: maxVideos
    };
  }, [video?.views, video?.likes, video?.comments, video?.shares, viralityFactor, totalCreatorVideos]);

  // Format duration from seconds to MM:SS
  const formatDuration = (seconds: number): string => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Prepare chart data from snapshots (showing incremental changes/deltas)
  // Reset previous period toggle when date filter changes
  React.useEffect(() => {
    setShowPreviousPeriod(false);
  }, [dateFilter]);

  // Calculate period ranges for current and previous periods
  const periodRanges = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let currentEnd = new Date(now);
    let currentStart = new Date();
    let daysBack = 0;
    
    // Calculate current period based on filter
    switch (dateFilter) {
      case 'today':
        currentStart = today;
        currentEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
        daysBack = 1;
        break;
      case 'yesterday': {
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        currentStart = yesterday;
        currentEnd = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1);
        daysBack = 1;
        break;
      }
      case 'last7days':
        currentStart = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
        currentEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
        daysBack = 7;
        break;
      case 'last14days':
        currentStart = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000);
        currentEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
        daysBack = 14;
        break;
      case 'last30days':
        currentStart = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
        currentEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
        daysBack = 30;
        break;
      case 'last90days':
        currentStart = new Date(today.getTime() - 89 * 24 * 60 * 60 * 1000);
        currentEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
        daysBack = 90;
        break;
      case 'mtd': // Month to Date
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
        daysBack = now.getDate();
        break;
      case 'lastmonth': {
        currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        currentEnd.setHours(23, 59, 59, 999);
        daysBack = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000));
        break;
      }
      case 'ytd': // Year to Date
        currentStart = new Date(now.getFullYear(), 0, 1);
        currentEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
        daysBack = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000));
        break;
      case 'custom':
        if (customDateRange) {
          currentStart = customDateRange.startDate;
          currentEnd = customDateRange.endDate;
          daysBack = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000));
        } else {
          currentStart.setTime(0);
          daysBack = 0;
        }
        break;
      case 'all':
      default:
        currentStart.setTime(0);
        daysBack = 0;
        break;
    }
    
    // Calculate previous period (same length, going back from current start)
    // Use milliseconds to ensure accurate date math across month boundaries
    const periodLength = currentEnd.getTime() - currentStart.getTime();
    const prevEnd = new Date(currentStart.getTime() - 1); // 1ms before current period starts
    const prevStart = new Date(currentStart.getTime() - periodLength); // Same duration back
    
    console.log('📅 Period Calculation:', {
      dateFilter,
      currentPeriod: `${currentStart.toLocaleDateString()} - ${currentEnd.toLocaleDateString()}`,
      previousPeriod: `${prevStart.toLocaleDateString()} - ${prevEnd.toLocaleDateString()}`,
      daysBack,
      periodLength: Math.round(periodLength / (1000 * 60 * 60 * 24)) + ' days'
    });
    
    return { currentStart, currentEnd, prevStart, prevEnd };
  }, [dateFilter, customDateRange]);

  const chartData = useMemo((): ChartDataPoint[] => {
    if (!video) return [];
    
    // Helper to create a data point with cumulative stats (for KPI display)
    const createDataPoint = (stats: any, timestamp: Date): ChartDataPoint => {
      const totalEngagement = stats.likes + stats.comments + (stats.shares || 0);
      const engagementRate = stats.views > 0 ? (totalEngagement / stats.views) * 100 : 0;
      
      return {
        date: timestamp.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric'
        }),
        views: stats.views,
        likes: stats.likes,
        comments: stats.comments,
        shares: stats.shares || 0,
        saves: stats.saves || 0,
        engagementRate,
        timestamp: timestamp.getTime(),
      };
    };

    // If no snapshots, create data point from current video stats only
    if (!video.snapshots || video.snapshots.length === 0) {
      const dataPoint = createDataPoint(video, new Date(video.timestamp || video.dateSubmitted));
      // Duplicate the single point to create a flat line
      return [dataPoint, { ...dataPoint }];
    }

    // Sort snapshots by date
    const sortedSnapshots = [...video.snapshots].sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );
    
    // Apply date filter based on current or previous period
    const filterStart = showPreviousPeriod ? periodRanges.prevStart : periodRanges.currentStart;
    const filterEnd = showPreviousPeriod ? periodRanges.prevEnd : periodRanges.currentEnd;
    
    const filteredSnapshots = sortedSnapshots.filter(snapshot => {
      const snapshotTime = new Date(snapshot.capturedAt).getTime();
      return snapshotTime >= filterStart.getTime() && snapshotTime <= filterEnd.getTime();
    });

    // Append current video stats if different from last snapshot (only for current period, not previous)
    const allSnapshots = [...filteredSnapshots];
    if (!showPreviousPeriod) {
      const lastSnapshotData = filteredSnapshots[filteredSnapshots.length - 1];
      const hasNewData = !lastSnapshotData || 
        lastSnapshotData.views !== video.views ||
        lastSnapshotData.likes !== video.likes ||
        lastSnapshotData.comments !== video.comments ||
        (lastSnapshotData.shares || 0) !== (video.shares || 0);
      
      if (hasNewData) {
        allSnapshots.push({
          id: `current-${Date.now()}`,
          videoId: video.id,
          views: video.views,
          likes: video.likes,
          comments: video.comments,
          shares: video.shares || 0,
          saves: video.saves || 0,
          capturedAt: new Date(),
          capturedBy: 'manual_refresh'
        });
      }
    }

    // Create data points with DELTAS (incremental changes)
    // First point shows initial snapshot values, subsequent points show changes
    const data: ChartDataPoint[] = [];
    
    for (let i = 0; i < allSnapshots.length; i++) {
      const snapshot = allSnapshots[i];
      const timestamp = new Date(snapshot.capturedAt);
      
      if (i === 0) {
        // First point: show absolute values
        data.push(createDataPoint(snapshot, timestamp));
      } else {
        // Subsequent points: show delta/difference from previous snapshot
        const prevSnapshot = allSnapshots[i - 1];
        const deltaViews = snapshot.views - prevSnapshot.views;
        const deltaLikes = snapshot.likes - prevSnapshot.likes;
        const deltaComments = snapshot.comments - prevSnapshot.comments;
        const deltaShares = (snapshot.shares || 0) - (prevSnapshot.shares || 0);
        const deltaSaves = (snapshot.saves || 0) - (prevSnapshot.saves || 0);
        const totalDeltaEngagement = deltaLikes + deltaComments + deltaShares;
        const deltaEngagementRate = deltaViews > 0 ? (totalDeltaEngagement / deltaViews) * 100 : 0;
        
        data.push({
          date: timestamp.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric'
          }),
          views: deltaViews,
          likes: deltaLikes,
          comments: deltaComments,
          shares: deltaShares,
          saves: deltaSaves,
          engagementRate: deltaEngagementRate,
          timestamp: timestamp.getTime(),
        });
      }
    }
    
    // If only one data point, duplicate it to create a flat line
    if (data.length === 1) {
      return [data[0], { ...data[0] }];
    }
    
    return data;
  }, [video?.id, video?.views, video?.likes, video?.comments, video?.shares, video?.snapshots?.length, dateFilter, showPreviousPeriod, periodRanges]);

  // Calculate cumulative totals for KPI display based on filtered period
  const cumulativeTotals = useMemo(() => {
    if (!video) return { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagementRate: 0 };
    
    // If "all time" is selected, show current video totals
    if (dateFilter === 'all') {
      const views = video.views || 0;
      const likes = video.likes || 0;
      const comments = video.comments || 0;
      const shares = video.shares || 0;
      const saves = video.saves || 0;
      
      return {
        views,
        likes,
        comments,
        shares,
        saves,
        engagementRate: views > 0 ? ((likes + comments + shares) / views) * 100 : 0,
      };
    }
    
    // For specific date ranges, calculate from snapshots only
    if (!video.snapshots || video.snapshots.length === 0) {
      // No snapshots - check if upload date is in range
      const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
      const filterStart = showPreviousPeriod ? periodRanges.prevStart : periodRanges.currentStart;
      const filterEnd = showPreviousPeriod ? periodRanges.prevEnd : periodRanges.currentEnd;
      
      if (uploadDate >= filterStart && uploadDate <= filterEnd) {
        // Video was uploaded in this period, show its current stats
        const views = video.views || 0;
        const likes = video.likes || 0;
        const comments = video.comments || 0;
        const shares = video.shares || 0;
        const saves = video.saves || 0;
        
        return {
          views,
          likes,
          comments,
          shares,
          saves,
          engagementRate: views > 0 ? ((likes + comments + shares) / views) * 100 : 0,
        };
      }
      
      // Video not in this period, return zeros
      return { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagementRate: 0 };
    }
    
    // Filter snapshots to selected date range
    const filterStart = showPreviousPeriod ? periodRanges.prevStart : periodRanges.currentStart;
    const filterEnd = showPreviousPeriod ? periodRanges.prevEnd : periodRanges.currentEnd;
    
    const filteredSnapshots = video.snapshots.filter(snapshot => {
      const snapshotTime = new Date(snapshot.capturedAt).getTime();
      return snapshotTime >= filterStart.getTime() && snapshotTime <= filterEnd.getTime();
    });
    
    if (filteredSnapshots.length === 0) {
      return { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagementRate: 0 };
    }
    
    // Get first and last snapshot in the range
    const sortedSnapshots = [...filteredSnapshots].sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );
    const firstSnapshot = sortedSnapshots[0];
    const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1];
    
    // Calculate delta (growth) between first and last snapshot in period
    const views = lastSnapshot.views - firstSnapshot.views;
    const likes = lastSnapshot.likes - firstSnapshot.likes;
    const comments = lastSnapshot.comments - firstSnapshot.comments;
    const shares = (lastSnapshot.shares || 0) - (firstSnapshot.shares || 0);
    const saves = (lastSnapshot.saves || 0) - (firstSnapshot.saves || 0);
    
    return {
      views,
      likes,
      comments,
      shares,
      saves,
      engagementRate: views > 0 ? ((likes + comments + shares) / views) * 100 : 0,
    };
  }, [video, dateFilter, showPreviousPeriod, periodRanges, video?.snapshots?.length]);

  // Calculate growth during the selected period
  const metricGrowth = useMemo(() => {
    if (chartData.length < 2) {
      return {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        engagementRate: 0,
      };
    }
    
    const firstPoint = chartData[0];
    const lastPoint = chartData[chartData.length - 1];
    
    return {
      views: lastPoint.views - firstPoint.views,
      likes: lastPoint.likes - firstPoint.likes,
      comments: lastPoint.comments - firstPoint.comments,
      shares: lastPoint.shares - firstPoint.shares,
      saves: video?.saves && video.snapshots && video.snapshots.length > 1
        ? (video.snapshots[video.snapshots.length - 1].saves || 0) - (video.snapshots[0].saves || 0)
        : 0,
      engagementRate: lastPoint.engagementRate - firstPoint.engagementRate,
    };
  }, [chartData, video?.saves, video?.snapshots]);

  // Determine trend based on snapshot data (excluding initial upload)
  const videoTrend = useMemo(() => {
    if (!video || !video.snapshots || video.snapshots.length < 2) {
      // No snapshots or only one snapshot, default to positive (green)
      return { isPositive: true, percentChange: 0 };
    }
    
    // Sort snapshots by date
    const sortedSnapshots = [...video.snapshots].sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );
    
    // Skip the first snapshot (initial upload) and use subsequent snapshots
    const snapshotsToAnalyze = sortedSnapshots.slice(1);
    
    if (snapshotsToAnalyze.length === 0) {
      // Only initial upload exists, default to positive
      return { isPositive: true, percentChange: 0 };
    }
    
    // Calculate average growth rate across snapshots (excluding initial)
    let totalGrowthRate = 0;
    let validComparisons = 0;
    
    for (let i = 1; i < snapshotsToAnalyze.length; i++) {
      const prev = snapshotsToAnalyze[i - 1];
      const current = snapshotsToAnalyze[i];
      
      // Calculate growth rate based on views (primary metric)
      const viewsDelta = current.views - prev.views;
      const prevViews = prev.views || 1; // Avoid division by zero
      const growthRate = (viewsDelta / prevViews) * 100;
      
      totalGrowthRate += growthRate;
      validComparisons++;
    }
    
    // If we have snapshot comparisons, use average growth rate
    if (validComparisons > 0) {
      const avgGrowthRate = totalGrowthRate / validComparisons;
      return {
        isPositive: avgGrowthRate >= 0,
        percentChange: Math.abs(avgGrowthRate)
      };
    }
    
    // Compare last snapshot to first (excluding initial upload)
    const firstSnapshot = snapshotsToAnalyze[0];
    const lastSnapshot = snapshotsToAnalyze[snapshotsToAnalyze.length - 1];
    const viewsGrowth = lastSnapshot.views - firstSnapshot.views;
    
    return {
      isPositive: viewsGrowth >= 0,
      percentChange: firstSnapshot.views > 0 
        ? Math.abs((viewsGrowth / firstSnapshot.views) * 100)
        : 0
    };
  }, [video?.snapshots]);

  if (!isOpen || !video) return null;

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  // Convert video URL to embed URL
  const getEmbedUrl = (url: string, platform: string): string => {
    try {
      // TikTok
      if (platform === 'tiktok' || url.includes('tiktok.com')) {
        const videoIdMatch = url.match(/video\/(\d+)/);
        if (videoIdMatch) {
          return `https://www.tiktok.com/embed/v2/${videoIdMatch[1]}`;
        }
      }
      
      // Instagram
      if (platform === 'instagram' || url.includes('instagram.com')) {
        const postMatch = url.match(/instagram\.com\/(p|reel|reels)\/([^\/\?]+)/);
        if (postMatch) {
          const type = postMatch[1] === 'reels' ? 'reel' : postMatch[1];
          const code = postMatch[2];
          return `https://www.instagram.com/${type}/${code}/embed`;
        }
      }
      
      // YouTube
      if (platform === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
        const shortsMatch = url.match(/shorts\/([a-zA-Z0-9_-]+)/);
        if (shortsMatch) {
          return `https://www.youtube.com/embed/${shortsMatch[1]}`;
        }
        
        const youtuMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
        if (youtuMatch) {
          return `https://www.youtube.com/embed/${youtuMatch[1]}`;
        }
        
        const u = new URL(url);
        const v = u.searchParams.get('v');
        if (v) {
          return `https://www.youtube.com/embed/${v}`;
        }
      }
      
      return url;
    } catch (error) {
      return url;
    }
  };

  const embedUrl = getEmbedUrl(video.url, video.platform);

  // Define metrics with their configurations (using cumulative totals, not deltas)
  const metrics = [
    {
      key: 'views' as const,
      label: 'Views',
      icon: Eye,
      color: '#B47CFF',
      value: cumulativeTotals.views,
      growth: metricGrowth.views,
    },
    {
      key: 'likes' as const,
      label: 'Likes',
      icon: Heart,
      color: '#FF6B9D',
      value: cumulativeTotals.likes,
      growth: metricGrowth.likes,
    },
    {
      key: 'comments' as const,
      label: 'Comments',
      icon: MessageCircle,
      color: '#4ECDC4',
      value: cumulativeTotals.comments,
      growth: metricGrowth.comments,
    },
    {
      key: 'shares' as const,
      label: 'Shares',
      icon: Share2,
      color: '#FFE66D',
      value: cumulativeTotals.shares,
      growth: metricGrowth.shares,
    },
    {
      key: 'engagementRate' as const,
      label: 'Engagement',
      icon: TrendingUp,
      color: '#00D9FF',
      value: cumulativeTotals.engagementRate,
      growth: metricGrowth.engagementRate,
      isPercentage: true,
    },
    {
      key: 'saves' as const,
      label: 'Bookmarks',
      icon: Bookmark,
      color: '#FF8A5B',
      value: cumulativeTotals.saves,
      growth: metricGrowth.saves,
      showNA: !cumulativeTotals.saves && cumulativeTotals.saves !== 0, // Show N/A only if undefined/null
    },
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3"
      onClick={onClose}
    >
      <div 
        className="rounded-xl shadow-2xl border border-white/10 w-full max-w-6xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-4"
        style={{ backgroundColor: '#121214' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          {/* Left: Period Date Display */}
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-400">
              {showPreviousPeriod ? (
                <span>
                  {periodRanges.prevStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' - '}
                  {periodRanges.prevEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              ) : (
                <span>
                  {periodRanges.currentStart.getTime() > 0 
                    ? periodRanges.currentStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'All time'
                  }
                  {periodRanges.currentStart.getTime() > 0 && (
                    <>
                      {' - '}
                      {periodRanges.currentEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </>
                  )}
                </span>
              )}
            </div>
            
            {/* Previous Period Toggle */}
            {dateFilter !== 'all' && (
              <button
                onClick={() => setShowPreviousPeriod(!showPreviousPeriod)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 hover:text-emerald-300 transition-all"
              >
                {showPreviousPeriod ? (
                  <>
                    <ChevronRight className="w-4 h-4" />
                    Show Current Period
                  </>
                ) : (
                  <>
                    <ChevronLeft className="w-4 h-4" />
                    Show Previous {
                      dateFilter === 'last7days' ? '7 Days' :
                      dateFilter === 'last14days' ? '14 Days' :
                      dateFilter === 'last30days' ? '30 Days' :
                      dateFilter === 'last90days' ? '90 Days' :
                      'Period'
                    }
                  </>
                )}
              </button>
            )}
          </div>
          
          {/* Right: Filters & Close */}
          <div className="flex items-center gap-3">
            {/* Date Filter - Hidden when hideDateFilter is true */}
            {!hideDateFilter && (
              <DateRangeFilter 
                selectedFilter={dateFilter}
                customRange={customDateRange}
                onFilterChange={(filter, customRange) => {
                  setDateFilter(filter);
                  setCustomDateRange(customRange);
                }}
              />
            )}
            
            {/* Time Granularity */}
            <select
              value={timeGranularity}
              onChange={(e) => setTimeGranularity(e.target.value as TimeGranularity)}
              className="px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/20 transition-colors"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            
            <button
              onClick={onClose}
              className="p-2 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all"
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Main Content - 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 overflow-hidden">
          {/* Left: Video Embed (Scrollable) */}
          <div className="overflow-hidden">
            <div className="relative rounded-xl border border-white/5 shadow-lg p-3 overflow-hidden" style={{ backgroundColor: '#121214' }}>
              {/* Depth Gradient Overlay */}
              <div 
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                  background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
                }}
              />
              
              <div className="relative w-full aspect-[9/16] bg-black rounded-lg overflow-hidden border border-white/10 z-10">
                <iframe
                  src={embedUrl}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  style={{ border: 'none' }}
                  title={video.title || video.caption || 'Video'}
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                />
              </div>

              {/* Duration & Virality Info */}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/5 p-2" style={{ backgroundColor: '#0a0a0b' }}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs text-gray-400">Duration</span>
                  </div>
                  <div className="text-sm font-bold text-white">
                    {formatDuration(video.duration || 0)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/5 p-2" style={{ backgroundColor: '#0a0a0b' }}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-xs text-gray-400">Virality</span>
                  </div>
                  <div className="text-sm font-bold text-white">
                    {viralityFactor.toFixed(2)}x
                  </div>
                </div>
              </div>

              {/* Posted & Last Refresh Info */}
              <div className="mt-2 rounded-lg border border-white/5 p-2.5 space-y-1.5" style={{ backgroundColor: '#0a0a0b' }}>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400">Posted:</span>
                  <span className="text-white font-medium">
                    {new Date(video.uploadDate || video.dateSubmitted).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                {video.lastRefreshed && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">Last refresh:</span>
                    <span className="text-white font-medium">
                      {new Date(video.lastRefreshed).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* View on Platform Button */}
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-sm font-medium text-white"
              >
                <ExternalLink className="w-4 h-4" />
                View on Platform
              </a>
            </div>
          </div>

          {/* Right: SCROLLABLE Content */}
          <div className="space-y-4 min-w-0 overflow-hidden">
            {/* 6 Metric Charts in 3-Column Grid */}
            <div className="grid grid-cols-3 gap-4 min-w-0">
            {metrics.map((metric) => {
              // Use video trend (based on snapshot data, excluding initial upload)
              // Green for positive trend, red for negative trend
              const displayColor = videoTrend.isPositive ? '#22c55e' : '#ef4444';
              
              return (
                <div 
                  key={metric.label}
                  className="group relative rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg hover:shadow-xl hover:ring-1 hover:ring-white/10 transition-all duration-300 overflow-hidden"
                  style={{ minHeight: '180px' }}
                >
                  {/* Depth Gradient Overlay */}
                  <div 
                    className="absolute inset-0 pointer-events-none z-0"
                    style={{
                      background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
                    }}
                  />
                  
                  {/* Upper Solid Portion - 60% */}
                  <div className="relative px-5 pt-4 pb-2 z-10" style={{ height: '60%' }}>
                    {/* Icon (top-right) */}
                    <div className="absolute top-4 right-4">
                      <metric.icon className="w-5 h-5 text-gray-400 opacity-60" />
                    </div>

                    {/* Metric Content */}
                    <div className="flex flex-col h-full justify-start pt-1">
                      {/* Label */}
                      <div className="text-xs font-medium text-zinc-400 tracking-wide mb-2">
                        {metric.label}
                      </div>

                      {/* Value */}
                      <div className="flex flex-col gap-1 -mt-1">
                        <span className="text-3xl lg:text-4xl font-bold tracking-tight text-white">
                          {(metric as any).showNA
                            ? 'N/A'
                            : metric.isPercentage 
                              ? `${metric.value.toFixed(1)}%` 
                              : formatNumber(metric.value)
                          }
                        </span>
                        
                        {/* Growth Indicator */}
                        {!(metric as any).showNA && (metric as any).growth !== undefined && (metric as any).growth !== 0 && (
                          <span className={`text-xs font-semibold ${(metric as any).growth > 0 ? 'text-emerald-400' : 'text-red-400'} flex items-center gap-1`}>
                            {(metric as any).growth > 0 ? (
                              <>
                                <TrendingUp className="w-3 h-3" />
                                <span>
                                  +{metric.isPercentage 
                                    ? `${Math.abs((metric as any).growth).toFixed(1)}%` 
                                    : formatNumber(Math.abs((metric as any).growth))
                                  } gained
                                </span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="w-3 h-3" />
                                <span>
                                  -{metric.isPercentage 
                                    ? `${Math.abs((metric as any).growth).toFixed(1)}%` 
                                    : formatNumber(Math.abs((metric as any).growth))
                                  } lost
                                </span>
                              </>
                            )}
                          </span>
                        )}
              </div>
            </div>
          </div>

                  {/* Bottom Graph Layer - 40% */}
                  {chartData && chartData.length > 0 && (
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
                          background: `linear-gradient(to top, ${displayColor}15 0%, transparent 80%)`,
                          mixBlendMode: 'soft-light'
                        }}
                      />
                      
                      {/* Line Chart with Custom Tooltip */}
                      <div 
                        className="absolute inset-0" 
                        style={{ padding: '0' }}
                        onMouseMove={(e) => {
                          if (!chartData || chartData.length === 0) return;
                          
                          const chartContainer = e.currentTarget;
                          const chartRect = chartContainer.getBoundingClientRect();
                          const x = e.clientX - chartRect.left;
                          const percentage = x / chartRect.width;
                          const index = Math.min(
                            Math.max(0, Math.floor(percentage * chartData.length)),
                            chartData.length - 1
                          );
                          const dataPoint = chartData[index];
                          
                          setTooltipData({
                            x: e.clientX,
                            y: e.clientY,
                            dataPoint,
                            metricKey: metric.key,
                            metricLabel: metric.label,
                            isPercentage: metric.isPercentage || false,
                            lineX: x,
                            chartRect
                          });
                        }}
                        onMouseLeave={() => setTooltipData(null)}
                      >
                        {/* Vertical cursor line */}
                        {tooltipData && tooltipData.metricKey === metric.key && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${tooltipData.lineX}px`,
                              top: 0,
                              bottom: 0,
                              width: '2px',
                              background: `linear-gradient(to bottom, ${displayColor}00 0%, ${displayColor}80 15%, ${displayColor}60 50%, ${displayColor}40 85%, ${displayColor}00 100%)`,
                              pointerEvents: 'none',
                              zIndex: 50
                            }}
                          />
                        )}
                        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
                            <AreaChart 
                              data={chartData}
                              margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
                            >
                <defs>
                                <linearGradient id={`gradient-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={displayColor} stopOpacity={0.2} />
                                  <stop offset="100%" stopColor={displayColor} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area 
                                type="monotoneX"
                                dataKey={metric.key}
                                stroke={displayColor}
                    strokeWidth={2}
                                fill={`url(#gradient-${metric.key})`}
                                isAnimationActive={false}
                                dot={false}
                    activeDot={{ 
                                  r: 4, 
                                  fill: displayColor, 
                      strokeWidth: 2, 
                      stroke: '#fff' 
                    }}
                  />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          </div>
              </div>
            )}
          </div>
              );
            })}
            </div>

            {/* Creator Info & Content Section */}
            <div className="space-y-3 min-w-0">
              {/* Creator Details & Performance Score Grid */}
              <div className="grid grid-cols-2 gap-3 min-w-0">
                {/* Creator Details */}
                <div className="rounded-xl border border-white/5 shadow-lg p-3 min-w-0 overflow-hidden" style={{ backgroundColor: '#121214' }}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Creator Details
                  </h3>
                  
                  <div className="flex items-center gap-3">
                    {/* Profile Picture */}
                    <div className="relative flex-shrink-0">
                      {video.uploaderProfilePicture ? (
                        <img 
                          src={video.uploaderProfilePicture} 
                          alt={video.uploader || video.uploaderHandle}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700/50 to-gray-800/50 flex items-center justify-center ring-2 ring-white/10">
                          <span className="text-white/70 font-semibold text-sm">
                            {(video.uploader || video.uploaderHandle || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {/* Platform Badge */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-zinc-900 rounded-full p-0.5 ring-1 ring-zinc-900">
                        <PlatformIcon platform={video.platform} size="sm" />
                      </div>
                    </div>
                    
                    {/* Username and Followers */}
                    <div className="flex-1">
                      <p className="text-base font-bold text-white mb-1">
                        @{video.uploaderHandle}
                      </p>
                      <p className="text-sm text-gray-400">
                        {video.followerCount ? formatNumber(video.followerCount) : 'N/A'} followers
                      </p>
                    </div>
                  </div>
                </div>

                {/* Video Performance Score */}
                <div className="rounded-xl border border-white/5 shadow-lg p-3 min-w-0 overflow-hidden" style={{ backgroundColor: '#121214' }}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Performance Rank
                  </h3>
                  
                  <div className="flex items-center gap-3">
                    {/* Rank Display - Compact Layout */}
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white">
                          #{performanceScore.rank}
                        </span>
                        <span className="text-sm text-gray-400">
                          out of {performanceScore.total}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Caption & Hashtags Grid */}
              <div className="grid grid-cols-2 gap-3 min-w-0">
                {/* Video Caption */}
                <div className="rounded-xl border border-white/5 shadow-lg p-3 min-w-0 overflow-hidden" style={{ backgroundColor: '#121214' }}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Video Caption
                  </h3>
                  <p className="text-base text-white leading-relaxed">
                    {cleanTitle}
                  </p>
                </div>

                {/* Hashtags */}
                <div className="rounded-xl border border-white/5 shadow-lg p-3 min-w-0 overflow-hidden" style={{ backgroundColor: '#121214' }}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Hashtags
                  </h3>
                  {hashtags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {hashtags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white/80 border border-white/10 hover:border-white/20 transition-colors"
                          style={{ backgroundColor: '#0a0a0b' }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No hashtags</p>
                  )}
                </div>
              </div>

              {/* Snapshots History */}
              {video.snapshots && video.snapshots.length > 0 && (() => {
                const sortedSnapshots = [...video.snapshots].sort((a, b) => 
                  new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
                );
                
                // Apply date filter
                const now = new Date();
                const filterDate = new Date();
                switch (dateFilter) {
                  case 'last7days':
                    filterDate.setDate(now.getDate() - 7);
                    break;
                  case 'last14days':
                    filterDate.setDate(now.getDate() - 14);
                    break;
                  case 'last30days':
                    filterDate.setDate(now.getDate() - 30);
                    break;
                  case 'last90days':
                    filterDate.setDate(now.getDate() - 90);
                    break;
                  case 'all':
                  default:
                    filterDate.setTime(0);
                    break;
                }
                
                const filteredSnapshots = sortedSnapshots.filter(snapshot => 
                  new Date(snapshot.capturedAt).getTime() >= filterDate.getTime()
                );
                
                // Calculate engagement for each snapshot with trend
                const snapshotsWithEngagement = filteredSnapshots.map((snapshot, idx) => {
                  const engagement = snapshot.views > 0 
                    ? ((snapshot.likes + snapshot.comments + (snapshot.shares || 0)) / snapshot.views) * 100 
                    : 0;
                  
                  let trend: 'up' | 'down' | 'neutral' = 'neutral';
                  if (idx < filteredSnapshots.length - 1) {
                    const prevSnapshot = filteredSnapshots[idx + 1];
                    const prevEngagement = prevSnapshot.views > 0 
                      ? ((prevSnapshot.likes + prevSnapshot.comments + (prevSnapshot.shares || 0)) / prevSnapshot.views) * 100 
                      : 0;
                    
                    if (engagement > prevEngagement + 0.1) trend = 'up';
                    else if (engagement < prevEngagement - 0.1) trend = 'down';
                  }
                  
                  return { ...snapshot, engagement, trend };
                });

                const totalPages = Math.ceil(snapshotsWithEngagement.length / snapshotsPerPage);
                const startIndex = (snapshotsPage - 1) * snapshotsPerPage;
                const endIndex = startIndex + snapshotsPerPage;
                const paginatedSnapshots = snapshotsWithEngagement.slice(startIndex, endIndex);
                
                return (
                  <div className="relative rounded-2xl border border-white/5 shadow-lg overflow-hidden min-w-0" style={{ backgroundColor: '#121214' }}>
                    {/* Depth Gradient Overlay */}
                    <div 
                      className="absolute inset-0 pointer-events-none z-0"
                      style={{
                        background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
                      }}
                    />
                    
                    {/* Header with Pagination */}
                    <div className="relative px-6 py-4 border-b border-white/5 z-10" style={{ backgroundColor: 'rgba(18, 18, 20, 0.6)' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Bookmark className="w-4 h-4 text-gray-400" />
                          <div>
                            <h3 className="text-base font-semibold text-white">
                              Snapshots History
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {video.snapshots.length} {video.snapshots.length === 1 ? 'recording' : 'recordings'}
                            </p>
                          </div>
                        </div>
                        
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSnapshotsPage(p => Math.max(1, p - 1))}
                              disabled={snapshotsPage === 1}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronLeft className="w-4 h-4 text-white" />
                            </button>
                            <span className="text-xs text-gray-400 min-w-[80px] text-center">
                              Page {snapshotsPage} of {totalPages}
                            </span>
                            <button
                              onClick={() => setSnapshotsPage(p => Math.min(totalPages, p + 1))}
                              disabled={snapshotsPage === totalPages}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronRight className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Horizontally Scrollable Table */}
                    <div className="relative overflow-x-scroll overflow-y-auto z-10 scrollbar-thin" style={{ maxHeight: '400px' }}>
                      <table className="w-full" style={{ minWidth: '1100px' }}>
                        <thead className="sticky top-0 z-20">
                          <tr className="border-b border-white/5" style={{ backgroundColor: 'rgba(18, 18, 20, 0.95)' }}>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Date & Time
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Type
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Views
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Likes
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Comments
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Shares
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Bookmarks
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Engagement
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {paginatedSnapshots.map((snapshot, index) => (
                            <tr 
                              key={snapshot.id || index}
                              className="hover:bg-white/[0.03] transition-colors"
                              style={{ backgroundColor: index % 2 === 0 ? '#121214' : 'rgba(18, 18, 20, 0.5)' }}
                            >
                              <td className="px-6 py-4 text-sm font-medium text-gray-300 whitespace-nowrap">
                                {new Date(snapshot.capturedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-xs text-gray-400 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
                                  {snapshot.capturedBy?.replace('_', ' ') || 'unknown'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center text-sm font-semibold text-white whitespace-nowrap">
                                {formatNumber(snapshot.views || 0)}
                              </td>
                              <td className="px-6 py-4 text-center text-sm font-semibold text-white whitespace-nowrap">
                                {formatNumber(snapshot.likes || 0)}
                              </td>
                              <td className="px-6 py-4 text-center text-sm font-semibold text-white whitespace-nowrap">
                                {formatNumber(snapshot.comments || 0)}
                              </td>
                              <td className="px-6 py-4 text-center text-sm font-semibold text-white whitespace-nowrap">
                                {formatNumber(snapshot.shares || 0)}
                              </td>
                              <td className="px-6 py-4 text-center text-sm font-semibold text-white whitespace-nowrap">
                                {formatNumber(snapshot.saves || 0)}
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-sm font-semibold text-white">
                                    {snapshot.engagement.toFixed(2)}%
                                  </span>
                                  {snapshot.trend === 'up' && (
                                    <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                                  )}
                                  {snapshot.trend === 'down' && (
                                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                                  )}
                                  {snapshot.trend === 'neutral' && (
                                    <Minus className="w-3.5 h-3.5 text-gray-400" />
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Portal Tooltip - Rendered at document.body level for smooth movement */}
      {tooltipData && (() => {
        const tooltipWidth = 300;
        const verticalOffset = 20;
        const horizontalPadding = 20;
        const windowWidth = window.innerWidth;
        
        // Calculate horizontal position to keep tooltip on screen
        let leftPosition = tooltipData.x;
        let transformX = '-50%';
        
        // Check if tooltip would go off left edge
        if (tooltipData.x - (tooltipWidth / 2) < horizontalPadding) {
          leftPosition = horizontalPadding;
          transformX = '0';
        }
        // Check if tooltip would go off right edge
        else if (tooltipData.x + (tooltipWidth / 2) > windowWidth - horizontalPadding) {
          leftPosition = windowWidth - horizontalPadding;
          transformX = '-100%';
        }
        
        const value = tooltipData.dataPoint[tooltipData.metricKey];
        
        return createPortal(
          <div 
            className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10" 
            style={{ 
              position: 'fixed',
              left: `${leftPosition}px`,
              top: `${tooltipData.y + verticalOffset}px`,
              transform: `translateX(${transformX})`,
              zIndex: 999999999,
              width: `${tooltipWidth}px`,
              pointerEvents: 'none'
            }}
          >
            {/* Header */}
            <div className="px-5 py-3 border-b border-white/10">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                {tooltipData.dataPoint.date}
              </p>
            </div>

            {/* Value */}
            <div className="px-5 py-4">
              <p className="text-2xl text-white font-bold">
                {tooltipData.isPercentage 
                  ? `${value.toFixed(1)}%` 
                  : formatNumber(value)
                }
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {tooltipData.metricLabel}
              </p>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
};

export default VideoAnalyticsModal;
