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
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('views');
  
  // Tooltip state
  const [hoveredPlatform, setHoveredPlatform] = useState<{ platform: string; x: number; y: number } | null>(null);

  // Calculate metric value for a video
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
      case 'videos':
        return 1; // Each video counts as 1
      default:
        return 0;
    }
  };

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

    // Calculate the value for each platform based on selected metric
    const platforms = Array.from(platformMap.values()).map(platform => {
      let value = 0;
      switch (selectedMetric) {
        case 'views':
          value = platform.totalViews;
          break;
        case 'likes':
          value = platform.totalLikes;
          break;
        case 'comments':
          value = platform.totalComments;
          break;
        case 'shares':
          value = platform.totalShares;
          break;
        case 'engagement':
          const totalEngagement = platform.totalLikes + platform.totalComments + platform.totalShares;
          value = platform.totalViews > 0 ? (totalEngagement / platform.totalViews) * 100 : 0;
          break;
        case 'videos':
          value = platform.videoCount;
          break;
      }
      return { ...platform, value };
    });

    // Sort by value
    return platforms.sort((a, b) => b.value - a.value);
  }, [submissions, selectedMetric]);

  // Format number with proper units
  const formatNumber = (num: number, metric: MetricType): string => {
    if (metric === 'engagement') {
      return `${num.toFixed(1)}%`;
    }
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  // Calculate max value for bar width
  const maxValue = platformData.length > 0 ? platformData[0].value : 1;

  // Get platform display name
  const getPlatformName = (platform: VideoSubmission['platform']): string => {
    switch (platform) {
      case 'instagram':
        return 'Instagram';
      case 'tiktok':
        return 'TikTok';
      case 'youtube':
        return 'YouTube';
      default:
        return platform.charAt(0).toUpperCase() + platform.slice(1);
    }
  };

  // Get platform color
  const getPlatformColor = (platform: VideoSubmission['platform']): string => {
    switch (platform) {
      case 'instagram':
        return 'from-pink-500 to-purple-600';
      case 'tiktok':
        return 'from-black to-gray-800';
      case 'youtube':
        return 'from-red-500 to-red-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Platforms</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Performance by platform</p>
        </div>
        
        {/* Metric Selector */}
        <div className="relative">
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
            className="appearance-none pl-4 pr-10 py-2 bg-white/5 dark:bg-white/5 text-gray-900 dark:text-white rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer"
          >
            <option value="views">Views</option>
            <option value="likes">Likes</option>
            <option value="comments">Comments</option>
            <option value="shares">Shares</option>
            <option value="engagement">Engagement %</option>
            <option value="videos">Video Count</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Platform Bars */}
      <div className="space-y-4">
        {platformData.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No platform data available
          </div>
        ) : (
          platformData.map((platform, index) => {
            const percentage = maxValue > 0 ? (platform.value / maxValue) * 100 : 0;
            
            return (
              <div
                key={platform.platform}
                className="group"
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
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800">
                      <PlatformIcon platform={platform.platform} className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {getPlatformName(platform.platform)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="relative h-10 bg-gray-100 dark:bg-gray-900/50 rounded-lg overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getPlatformColor(platform.platform)} transition-all duration-500 ease-out`}
                        style={{ width: `${percentage}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-3">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white z-10">
                          {formatNumber(platform.value, selectedMetric)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 min-w-[60px] text-right">
                    {platform.videoCount} {platform.videoCount === 1 ? 'video' : 'videos'}
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

