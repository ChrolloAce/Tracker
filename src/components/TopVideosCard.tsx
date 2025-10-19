import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { VideoSubmission } from '../types';
import { PlatformIcon } from './ui/PlatformIcon';
import { ChevronDown, Play } from 'lucide-react';

interface TopVideosCardProps {
  submissions: VideoSubmission[];
  onVideoClick?: (video: VideoSubmission) => void;
}

type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'engagement';

const TopVideosCard: React.FC<TopVideosCardProps> = ({ submissions, onVideoClick }) => {
  const [topCount, setTopCount] = useState(5);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('views');
  const [hoveredVideo, setHoveredVideo] = useState<{ video: VideoSubmission; x: number; y: number } | null>(null);

  const getMetricValue = (video: VideoSubmission, metric: MetricType): number => {
    switch (metric) {
      case 'views':
        return video.views || 0;
      case 'likes':
        return video.likes || 0;
      case 'comments':
        return video.comments || 0;
      case 'shares':
        return video.shares || 0;
      case 'engagement':
        const totalEngagement = (video.likes || 0) + (video.comments || 0) + (video.shares || 0);
        return video.views > 0 ? (totalEngagement / video.views) * 100 : 0;
      default:
        return 0;
    }
  };

  const topVideos = useMemo(() => {
    const uniqueVideos = new Map<string, VideoSubmission>();
    submissions.forEach(video => {
      const key = video.id || video.url || `${video.platform}_${video.uploaderHandle}_${video.dateSubmitted.getTime()}`;
      if (!uniqueVideos.has(key)) {
        uniqueVideos.set(key, video);
      }
    });

    return Array.from(uniqueVideos.values())
      .sort((a, b) => getMetricValue(b, selectedMetric) - getMetricValue(a, selectedMetric))
      .slice(0, topCount);
  }, [submissions, selectedMetric, topCount]);

  const maxMetricValue = topVideos.length > 0 ? getMetricValue(topVideos[0], selectedMetric) : 1;

  const formatNumber = (num: number, metric: MetricType): string => {
    if (metric === 'engagement') {
      return `${num.toFixed(1)}%`;
    }
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const getMetricColor = (metric: MetricType): string => {
    switch (metric) {
      case 'views': return 'from-blue-500 to-cyan-500';
      case 'likes': return 'from-pink-500 to-rose-500';
      case 'comments': return 'from-purple-500 to-indigo-500';
      case 'shares': return 'from-green-500 to-emerald-500';
      case 'engagement': return 'from-orange-500 to-amber-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg shadow-lg border border-white/10 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Top Videos</h2>
          <p className="text-sm text-white/60 mt-1">Highest performing content</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Metric Selector */}
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <option value="views">Views</option>
            <option value="likes">Likes</option>
            <option value="comments">Comments</option>
            <option value="shares">Shares</option>
            <option value="engagement">Engagement</option>
          </select>

          {/* Top Count Selector */}
          <div className="relative">
            <select
              value={topCount}
              onChange={(e) => setTopCount(Number(e.target.value))}
              className="pl-3 pr-8 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 transition-colors cursor-pointer appearance-none"
            >
              <option value={3}>Top 3</option>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Videos List */}
      <div className="space-y-4">
        {topVideos.map((video, index) => {
          const metricValue = getMetricValue(video, selectedMetric);
          const percentage = maxMetricValue > 0 ? (metricValue / maxMetricValue) * 100 : 0;

          return (
            <div key={video.id} className="group">
              <div className="flex items-center gap-3 mb-2">
                {/* Rank */}
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex-shrink-0">
                  <span className="text-sm font-bold text-white">#{index + 1}</span>
                </div>

                {/* Video Info */}
                <div className="flex-1 min-w-0">
                  <div 
                    className="relative h-12 bg-zinc-800/50 rounded-lg overflow-hidden cursor-pointer hover:bg-zinc-800/70 transition-colors"
                    onClick={() => onVideoClick?.(video)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredVideo({
                        video,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 10,
                      });
                    }}
                    onMouseLeave={() => setHoveredVideo(null)}
                  >
                    {/* Progress Bar */}
                    <div
                      className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getMetricColor(selectedMetric)} transition-all duration-500 ease-out`}
                      style={{ width: `${percentage}%` }}
                    />
                    
                    {/* Content */}
                    <div className="absolute inset-0 flex items-center px-3 gap-3">
                      {/* Platform Icon */}
                      <div className="flex-shrink-0 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center z-10">
                        <PlatformIcon platform={video.platform} className="w-4 h-4" />
                      </div>

                      {/* Video Title */}
                      <span className="text-sm font-semibold text-white z-10 truncate flex-1">
                        {video.title || video.caption || 'Untitled'}
                      </span>

                      {/* Metric Value */}
                      <span className="text-sm font-bold text-white z-10 flex-shrink-0">
                        {formatNumber(metricValue, selectedMetric)}
                      </span>
                    </div>
                  </div>

                  {/* Account Info */}
                  <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                    <span>@{video.uploaderHandle}</span>
                    {video.views && (
                      <>
                        <span>•</span>
                        <span>{formatNumber(video.views, 'views')} views</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {topVideos.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/40 text-sm">No videos found</p>
        </div>
      )}

      {/* Tooltip */}
      {hoveredVideo && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: hoveredVideo.x,
            top: hoveredVideo.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-xs whitespace-nowrap">
            <div className="flex items-center gap-2 mb-1">
              <Play className="w-3 h-3" />
              <span className="font-semibold">{hoveredVideo.video.title || hoveredVideo.video.caption || 'Untitled'}</span>
            </div>
            <div className="text-gray-300">
              @{hoveredVideo.video.uploaderHandle} • {formatNumber(hoveredVideo.video.views, 'views')} views
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TopVideosCard;

