/**
 * RecentVideosList Component
 * Displays a list of recent videos sorted by upload date
 * Responds to date filters and shows video metrics with sparkline graphs
 */

import React, { useMemo } from 'react';
import { Play, Eye, Heart, MessageCircle, Share2, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import { VideoSubmission } from '../types';
import { ProxiedImage } from './ProxiedImage';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

// Platform icons
import instagramIcon from '/Instagram_icon.png';
import tiktokIcon from '/TiktokLogo.png';
import youtubeIcon from '/Youtube_shorts_icon.svg.png';
import xLogo from '/twitter-x-logo.png';

interface RecentVideosListProps {
  videos: VideoSubmission[];
  maxVideos?: number;
  onVideoClick?: (video: VideoSubmission) => void;
  showSparkline?: boolean;
}

/**
 * Build sparkline data from video snapshots
 */
const buildSparklineData = (video: VideoSubmission): { value: number }[] => {
  if (!video.snapshots || video.snapshots.length === 0) {
    // No snapshots - flat line
    return [{ value: video.views }, { value: video.views }];
  }

  const sortedSnapshots = [...video.snapshots].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
  );

  // Build growth data points
  const data = sortedSnapshots.map((snapshot, index) => {
    if (index === 0) {
      return { value: snapshot.views };
    }
    const previous = sortedSnapshots[index - 1];
    const growth = Math.max(0, snapshot.views - previous.views);
    return { value: growth };
  });

  // Add current video value if different from last snapshot
  const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1];
  if (lastSnapshot && video.views !== lastSnapshot.views) {
    const growth = Math.max(0, video.views - lastSnapshot.views);
    data.push({ value: growth });
  }

  return data.length > 1 ? data : [{ value: video.views }, { value: video.views }];
};

/**
 * Calculate growth percentage from snapshots
 */
const calculateGrowth = (video: VideoSubmission): { value: number; isPositive: boolean } | null => {
  if (!video.snapshots || video.snapshots.length < 2) {
    return null;
  }

  const sortedSnapshots = [...video.snapshots].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
  );

  const firstSnapshot = sortedSnapshots[0];
  const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1];

  if (firstSnapshot.views === 0) return null;

  const growthPercent = ((lastSnapshot.views - firstSnapshot.views) / firstSnapshot.views) * 100;
  
  return {
    value: Math.abs(growthPercent),
    isPositive: growthPercent >= 0
  };
};

const RecentVideosList: React.FC<RecentVideosListProps> = ({
  videos,
  maxVideos = 10,
  onVideoClick,
  showSparkline = true
}) => {
  // Sort videos by upload date (most recent first) and limit
  const recentVideos = useMemo(() => {
    return [...videos]
      .sort((a, b) => {
        const dateA = new Date(a.uploadDate || a.dateSubmitted).getTime();
        const dateB = new Date(b.uploadDate || b.dateSubmitted).getTime();
        return dateB - dateA;
      })
      .slice(0, maxVideos);
  }, [videos, maxVideos]);

  const getPlatformIcon = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case 'instagram': return instagramIcon;
      case 'tiktok': return tiktokIcon;
      case 'youtube': return youtubeIcon;
      case 'twitter': return xLogo;
      default: return null;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins}m ago`;
      }
      return `${diffHours}h ago`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (recentVideos.length === 0) {
    return (
      <div className="bg-zinc-900/60 backdrop-blur rounded-2xl border border-white/10 p-8 text-center">
        <Play className="w-12 h-12 text-white/20 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-white mb-1">No videos match your filters</h3>
        <p className="text-white/60 text-sm">Try adjusting the date range to see recent videos.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/60 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Recent Videos</h3>
            <span className="text-sm text-white/40">({recentVideos.length})</span>
          </div>
        </div>
      </div>

      {/* Video List */}
      <div className="divide-y divide-white/5">
        {recentVideos.map((video, index) => {
          const platformIcon = getPlatformIcon(video.platform);
          const sparklineData = showSparkline ? buildSparklineData(video) : [];
          const growth = calculateGrowth(video);
          const hasGrowth = sparklineData.length > 1 && sparklineData.some(d => d.value > 0);

          return (
            <div
              key={video.id}
              onClick={() => onVideoClick?.(video)}
              className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 cursor-pointer transition-colors group"
            >
              {/* Rank */}
              <div className="w-6 text-center">
                <span className="text-sm font-medium text-white/40">{index + 1}</span>
              </div>

              {/* Thumbnail */}
              <div className="relative w-16 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-800">
                {video.thumbnail ? (
                  <ProxiedImage
                    src={video.thumbnail}
                    alt={video.title || 'Video thumbnail'}
                    className="w-full h-full object-cover"
                    fallback={
                      <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                        <Play className="w-6 h-6 text-white/30" />
                      </div>
                    }
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-6 h-6 text-white/30" />
                  </div>
                )}
                
                {/* Platform badge */}
                {platformIcon && (
                  <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <img src={platformIcon} alt={video.platform} className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white truncate group-hover:text-emerald-400 transition-colors">
                  {video.title || video.caption || 'Untitled Video'}
                </h4>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-white/50">@{video.uploaderHandle}</span>
                  <span className="text-xs text-white/30">•</span>
                  <span className="text-xs text-white/50">{formatDate(video.uploadDate || video.dateSubmitted)}</span>
                </div>
                
                {/* Metrics row */}
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-white/40" />
                    <span className="text-xs font-medium text-white/70">{formatNumber(video.views)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-white/40" />
                    <span className="text-xs text-white/50">{formatNumber(video.likes)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5 text-white/40" />
                    <span className="text-xs text-white/50">{formatNumber(video.comments)}</span>
                  </div>
                  {video.shares && video.shares > 0 && (
                    <div className="flex items-center gap-1">
                      <Share2 className="w-3.5 h-3.5 text-white/40" />
                      <span className="text-xs text-white/50">{formatNumber(video.shares)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sparkline Graph */}
              {showSparkline && hasGrowth && (
                <div className="w-24 h-12 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparklineData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id={`gradient-${video.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#10b981"
                        strokeWidth={1.5}
                        fill={`url(#gradient-${video.id})`}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Growth indicator */}
              {growth && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  growth.isPositive 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {growth.isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>{growth.value.toFixed(0)}%</span>
                </div>
              )}

              {/* No growth indicator for videos with single snapshot */}
              {!growth && !hasGrowth && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-white/5 text-white/40">
                  <Minus className="w-3 h-3" />
                  <span>New</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentVideosList;
