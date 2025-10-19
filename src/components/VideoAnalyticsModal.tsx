import React, { useMemo } from 'react';
import { X, ExternalLink, Eye, Heart, MessageCircle, Share2, TrendingUp, Bookmark, Clock, Flame } from 'lucide-react';
import { VideoSubmission } from '../types';
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
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

  // Prepare chart data from snapshots
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!video) return [];
    
    // Helper to create a data point
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

    // Create data points from snapshots
    const data = sortedSnapshots.map((snapshot) => 
      createDataPoint(snapshot, new Date(snapshot.capturedAt))
    );
    
    // Always append current video stats as the most recent data point
    // This ensures KPI cards show the latest actual numbers, not just the last snapshot
    const currentDataPoint = createDataPoint(video, new Date());
    
    // Only add current stats if they're different from the last snapshot (to avoid duplicates)
    const lastSnapshot = data[data.length - 1];
    const hasNewData = !lastSnapshot || 
      lastSnapshot.views !== video.views ||
      lastSnapshot.likes !== video.likes ||
      lastSnapshot.comments !== video.comments ||
      lastSnapshot.shares !== (video.shares || 0);
    
    if (hasNewData) {
      data.push(currentDataPoint);
    }
    
    // If only one data point, duplicate it to create a flat line
    if (data.length === 1) {
      return [data[0], { ...data[0] }];
    }
    
    return data;
  }, [video?.id, video?.views, video?.likes, video?.comments, video?.shares, video?.snapshots?.length]);

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

  // Define metrics with their configurations
  const metrics = [
    {
      key: 'views' as const,
      label: 'Views',
      icon: Eye,
      color: '#B47CFF',
      value: chartData[chartData.length - 1]?.views || 0,
    },
    {
      key: 'likes' as const,
      label: 'Likes',
      icon: Heart,
      color: '#FF6B9D',
      value: chartData[chartData.length - 1]?.likes || 0,
    },
    {
      key: 'comments' as const,
      label: 'Comments',
      icon: MessageCircle,
      color: '#4ECDC4',
      value: chartData[chartData.length - 1]?.comments || 0,
    },
    {
      key: 'shares' as const,
      label: 'Shares',
      icon: Share2,
      color: '#FFE66D',
      value: chartData[chartData.length - 1]?.shares || 0,
    },
    {
      key: 'engagementRate' as const,
      label: 'Engagement',
      icon: TrendingUp,
      color: '#00D9FF',
      value: chartData[chartData.length - 1]?.engagementRate || 0,
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="rounded-2xl shadow-2xl border border-white/10 w-full max-w-7xl max-h-[90vh] overflow-y-auto p-6"
        style={{ backgroundColor: '#121214' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
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
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-zinc-900 rounded-full p-0.5 ring-2 ring-zinc-900">
                <PlatformIcon platform={video.platform} size="sm" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white line-clamp-2 max-w-xl">
                {video.title || video.caption || '(No caption)'}
              </h2>
              <p className="text-sm text-[#A1A1AA]">@{video.uploaderHandle}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-[#9B9B9B]">
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
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
          {/* Left: Video Embed (FIXED) */}
          <div className="lg:sticky lg:top-0 lg:self-start">
            <div className="relative rounded-2xl border border-white/5 shadow-lg p-4 overflow-hidden" style={{ backgroundColor: '#121214' }}>
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
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/5 p-3" style={{ backgroundColor: '#0a0a0b' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-400">Duration</span>
                  </div>
                  <div className="text-lg font-bold text-white">
                    {formatDuration(video.duration || 0)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 p-3" style={{ backgroundColor: '#0a0a0b' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span className="text-xs text-gray-400">Virality</span>
                  </div>
                  <div className="text-lg font-bold text-white">
                    {viralityFactor.toFixed(2)}x
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: SCROLLABLE Content */}
          <div className="space-y-6">
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
                  className="group relative rounded-2xl border border-white/5 shadow-lg hover:shadow-xl hover:ring-1 hover:ring-white/10 transition-all duration-300 overflow-hidden"
                  style={{ minHeight: '180px', backgroundColor: '#121214' }}
                >
                  {/* Depth Gradient Overlay */}
                  <div 
                    className="absolute inset-0 pointer-events-none z-0"
                    style={{
                      background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
                    }}
                  />
                  
                  {/* Upper Solid Portion - 75% */}
                  <div className="relative px-5 pt-5 pb-2 z-10" style={{ height: '75%' }}>
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

                  {/* Bottom Graph Layer - 25% */}
                  {chartData && chartData.length > 0 && (
                    <div 
                      className="relative w-full overflow-hidden z-10"
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
                          background: `linear-gradient(to top, ${displayColor}15 0%, transparent 80%)`,
                          mixBlendMode: 'soft-light'
                        }}
                      />
                      
                      {/* Line Chart */}
                      <div className="absolute inset-0" style={{ padding: '0' }}>
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
                      const data = payload[0]?.payload;
                                    const value = data[metric.key];
                      
                      return (
                                      <div className="bg-[#1a1a1a] backdrop-blur-xl text-white px-5 py-3 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-sm space-y-2 min-w-[240px] border border-white/10 pointer-events-none">
                                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                            {data?.date}
                          </p>
                                        <p className="text-lg text-white font-bold">
                                          {metric.isPercentage 
                                            ? `${value.toFixed(1)}%` 
                                            : formatNumber(value)
                                          } {metric.label.toLowerCase()}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                                cursor={{ stroke: displayColor, strokeWidth: 1, strokeDasharray: '3 3' }}
                />
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
            <div className="space-y-4">
              {/* Video Title */}
              <div className="rounded-2xl border border-white/5 shadow-lg p-5" style={{ backgroundColor: '#121214' }}>
                <div className="flex items-start gap-3 mb-2">
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
                <div className="rounded-2xl border border-white/5 shadow-lg p-5" style={{ backgroundColor: '#121214' }}>
                  <div className="flex items-start gap-3">
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
    </div>
  );
};

export default VideoAnalyticsModal;
