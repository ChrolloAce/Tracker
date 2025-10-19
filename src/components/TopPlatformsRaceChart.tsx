import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { VideoSubmission } from '../types';
import { PlatformIcon } from './ui/PlatformIcon';
import { ChevronDown } from 'lucide-react';

interface TopPlatformsRaceChartProps {
  submissions: VideoSubmission[];
}

type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'videos';

const TopPlatformsRaceChart: React.FC<TopPlatformsRaceChartProps> = ({ submissions }) => {
  const [topCount, setTopCount] = useState(5);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('views');
  
  // Tooltip state
  const [hoveredPlatform, setHoveredPlatform] = useState<{ platform: string; x: number; y: number } | null>(null);

  // Get platform data
  const platformData = useMemo(() => {
    // Deduplicate videos by ID first
    const uniqueVideos = new Map<string, VideoSubmission>();
    submissions.forEach(video => {
      const key = video.id || video.url || `${video.platform}_${video.uploaderHandle}_${video.dateSubmitted.getTime()}`;
      if (!uniqueVideos.has(key)) {
        uniqueVideos.set(key, video);
      }
    });
    
    const platformMap = new Map<string, {
      platform: VideoSubmission['platform'];
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      totalShares: number;
      videoCount: number;
    }>();

    uniqueVideos.forEach(video => {
      const platform = video.platform;
      
      if (!platformMap.has(platform)) {
        platformMap.set(platform, {
          platform,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          videoCount: 0,
        });
      }

      const platformStats = platformMap.get(platform)!;
      platformStats.totalViews += video.views || 0;
      platformStats.totalLikes += video.likes || 0;
      platformStats.totalComments += video.comments || 0;
      platformStats.totalShares += video.shares || 0;
      platformStats.videoCount += 1;
    });

    return Array.from(platformMap.values());
  }, [submissions]);

  // Calculate metric value for a platform
  const getMetricValue = (platform: typeof platformData[0], metric: MetricType): number => {
    switch (metric) {
      case 'views':
        return platform.totalViews;
      case 'likes':
        return platform.totalLikes;
      case 'comments':
        return platform.totalComments;
      case 'shares':
        return platform.totalShares;
      case 'engagement':
        const totalEngagement = platform.totalLikes + platform.totalComments + platform.totalShares;
        return platform.totalViews > 0 ? (totalEngagement / platform.totalViews) * 100 : 0;
      case 'videos':
        return platform.videoCount;
      default:
        return 0;
    }
  };

  // Sort and slice platforms
  const topPlatforms = useMemo(() => {
    return platformData
      .sort((a, b) => getMetricValue(b, selectedMetric) - getMetricValue(a, selectedMetric))
      .slice(0, topCount);
  }, [platformData, selectedMetric, topCount]);

  const maxValue = topPlatforms.length > 0 ? getMetricValue(topPlatforms[0], selectedMetric) : 1;

  // Format number with proper units
  const formatNumber = (num: number, metric: MetricType): string => {
    if (metric === 'engagement') {
      return `${num.toFixed(1)}%`;
    }
    if (num >= 1000000000) {
      return `${(num / 1000000000).toFixed(1)}B`;
    } else if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  // Get platform display name
  const getPlatformName = (platform: VideoSubmission['platform']): string => {
    switch (platform) {
      case 'instagram':
        return 'Instagram';
      case 'tiktok':
        return 'TikTok';
      case 'youtube':
        return 'YouTube';
      case 'twitter':
        return 'X (Twitter)';
      default:
        return platform.charAt(0).toUpperCase() + platform.slice(1);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg shadow-lg border border-white/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Top Platforms</h2>
          <p className="text-sm text-white/60 mt-1">Performance by platform</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Count Selector */}
          <div className="relative">
            <select
              value={topCount}
              onChange={(e) => setTopCount(Number(e.target.value))}
              className="appearance-none pl-4 pr-10 py-2 bg-white/5 text-white rounded-lg text-sm font-medium border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer"
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          </div>

          {/* Metric Selector */}
          <div className="relative">
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
              className="appearance-none pl-4 pr-10 py-2 bg-white/5 text-white rounded-lg text-sm font-medium border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer"
            >
              <option value="views">Views</option>
              <option value="likes">Likes</option>
              <option value="comments">Comments</option>
              <option value="shares">Shares</option>
              <option value="engagement">Engagement %</option>
              <option value="videos">Video Count</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Platform Race Bars */}
      <div className="space-y-3">
        {topPlatforms.length === 0 ? (
          <div className="text-center py-8 text-white/40">
            No platform data available
          </div>
        ) : (
          topPlatforms.map((platform) => {
            const value = getMetricValue(platform, selectedMetric);
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            
            return (
              <div
                key={platform.platform}
                className="group relative"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredPlatform({
                    platform: platform.platform,
                    x: rect.left + rect.width / 2,
                    y: rect.top - 10
                  });
                }}
                onMouseLeave={() => setHoveredPlatform(null)}
              >
                <div className="flex items-center gap-3">
                  {/* Platform Icon */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                      <PlatformIcon platform={platform.platform} className="w-7 h-7" />
                    </div>
                  </div>

                  {/* Bar Container */}
                  <div className="flex-1 min-w-0">
                    <div className="relative h-12 bg-white/5 rounded-lg overflow-hidden border border-white/10 group-hover:border-white/20 transition-colors">
                      {/* Animated Bar */}
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/80 to-emerald-400/80 transition-all duration-700 ease-out"
                        style={{ width: `${percentage}%` }}
                      />
                      
                      {/* Platform Name & Video Count */}
                      <div className="absolute inset-0 flex items-center justify-between px-4 z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {getPlatformName(platform.platform)}
                          </span>
                          <span className="text-xs text-white/50">
                            {platform.videoCount} video{platform.videoCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Value Display */}
                  <div className="flex-shrink-0 w-24 text-right">
                    <div className="text-lg font-bold text-white">
                      {formatNumber(value, selectedMetric)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tooltip */}
      {hoveredPlatform && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: hoveredPlatform.x,
            top: hoveredPlatform.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-xs whitespace-nowrap">
            <div className="font-semibold">{getPlatformName(hoveredPlatform.platform)}</div>
            <div className="text-gray-300 mt-1">
              {platformData.find(p => p.platform === hoveredPlatform.platform)?.videoCount} videos tracked
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TopPlatformsRaceChart;
