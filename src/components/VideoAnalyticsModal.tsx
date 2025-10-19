import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Eye, Heart, MessageCircle, Share2, TrendingUp, Bookmark, Clock, Flame } from 'lucide-react';
import { VideoSubmission } from '../types';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { PlatformIcon } from './ui/PlatformIcon';

interface VideoAnalyticsModalProps {
  video: VideoSubmission | null;
  isOpen: boolean;
  onClose: () => void;
}

interface ChartDataPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  timestamp: number;
}

const VideoAnalyticsModal: React.FC<VideoAnalyticsModalProps> = ({ video, isOpen, onClose }) => {
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

  // Format duration from seconds to MM:SS
  const formatDuration = (seconds: number): string => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Prepare chart data from snapshots (showing incremental changes/deltas)
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

    // Append current video stats if different from last snapshot
    const allSnapshots = [...sortedSnapshots];
    const lastSnapshotData = sortedSnapshots[sortedSnapshots.length - 1];
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
        capturedAt: new Date(),
        capturedBy: 'manual_refresh'
      });
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
  }, [video?.id, video?.views, video?.likes, video?.comments, video?.shares, video?.snapshots?.length]);

  // Calculate cumulative totals for KPI display (not deltas)
  const cumulativeTotals = useMemo(() => {
    const views = video?.views || 0;
    const likes = video?.likes || 0;
    const comments = video?.comments || 0;
    const shares = video?.shares || 0;
    
    return {
      views,
      likes,
      comments,
      shares,
      engagementRate: views > 0 
        ? ((likes + comments + shares) / views) * 100 
        : 0,
    };
  }, [video?.views, video?.likes, video?.comments, video?.shares]);

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
    },
    {
      key: 'likes' as const,
      label: 'Likes',
      icon: Heart,
      color: '#FF6B9D',
      value: cumulativeTotals.likes,
    },
    {
      key: 'comments' as const,
      label: 'Comments',
      icon: MessageCircle,
      color: '#4ECDC4',
      value: cumulativeTotals.comments,
    },
    {
      key: 'shares' as const,
      label: 'Shares',
      icon: Share2,
      color: '#FFE66D',
      value: cumulativeTotals.shares,
    },
    {
      key: 'engagementRate' as const,
      label: 'Engagement',
      icon: TrendingUp,
      color: '#00D9FF',
      value: cumulativeTotals.engagementRate,
      isPercentage: true,
    },
    {
      key: 'likes' as const, // Reusing likes key for bookmarks
      label: 'Bookmarks',
      icon: Bookmark,
      color: '#FF8A5B',
      value: 0, // Bookmarks data not available yet
      showNA: true,
    },
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3"
      onClick={onClose}
    >
      <div 
        className="rounded-xl shadow-2xl border border-white/10 w-full max-w-6xl max-h-[92vh] overflow-y-auto p-4"
        style={{ backgroundColor: '#121214' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Profile Picture */}
            <div className="relative flex-shrink-0">
              {video.uploaderProfilePicture ? (
                <img 
                  src={video.uploaderProfilePicture} 
                  alt={video.uploader || video.uploaderHandle}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700/50 to-gray-800/50 flex items-center justify-center ring-2 ring-white/10">
                  <span className="text-white/70 font-semibold text-xs">
                    {(video.uploader || video.uploaderHandle || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {/* Platform Badge */}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-zinc-900 rounded-full p-0.5 ring-1 ring-zinc-900">
                <PlatformIcon platform={video.platform} size="sm" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold text-white line-clamp-2 max-w-xl">
                {video.title || video.caption || '(No caption)'}
              </h2>
              <p className="text-xs text-[#A1A1AA]">@{video.uploaderHandle}</p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-[#9B9B9B]">
                <span>Posted: {new Date(video.timestamp || video.dateSubmitted).toLocaleDateString()}</span>
                {video.lastRefreshed && (
                  <>
                    <span>•</span>
                    <span>Updated: {new Date(video.lastRefreshed).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Main Content - 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Left: Video Embed (FIXED) */}
          <div className="lg:sticky lg:top-0 lg:self-start">
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
            </div>
          </div>

          {/* Right: SCROLLABLE Content */}
          <div className="space-y-4">
            {/* 6 Metric Charts in 2x3 Grid */}
            <div className="grid grid-cols-2 gap-4">
            {metrics.map((metric) => {
              // Calculate if metric is increasing (comparing first to last data point)
              const isIncreasing = chartData.length > 1 
                ? chartData[chartData.length - 1][metric.key] >= chartData[0][metric.key]
                : true;
              
              // Use green for increasing, red for decreasing
              const displayColor = isIncreasing ? '#22c55e' : '#ef4444';
              
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
                      <div className="flex items-baseline gap-3 -mt-1">
                        <span className="text-3xl lg:text-4xl font-bold tracking-tight text-white">
                          {(metric as any).showNA
                            ? 'N/A'
                            : metric.isPercentage 
                              ? `${metric.value.toFixed(1)}%` 
                              : formatNumber(metric.value)
                          }
                        </span>
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

            {/* Video Title & Hashtags Section */}
            <div className="space-y-3">
              {/* Video Title */}
              <div className="rounded-xl border border-white/5 shadow-lg p-3" style={{ backgroundColor: '#121214' }}>
                <div className="flex items-start gap-2 mb-1.5">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: '#0a0a0b' }}>
                    <MessageCircle className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Video Caption
                    </h3>
                    <p className="text-base text-white leading-relaxed">
                      {cleanTitle}
                    </p>
                  </div>
                </div>
              </div>

              {/* Hashtags */}
              {hashtags.length > 0 && (
                <div className="rounded-xl border border-white/5 shadow-lg p-3" style={{ backgroundColor: '#121214' }}>
                  <div className="flex items-start gap-2">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: '#0a0a0b' }}>
                      <span className="text-sm text-gray-400">#</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        Hashtags
                      </h3>
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
                    </div>
                  </div>
                </div>
              )}
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
