import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { VideoSubmission } from '../types';
import { PlatformIcon } from './ui/PlatformIcon';
import { ChevronDown, Play, Info } from 'lucide-react';

interface TopPlatformsRaceChartProps {
  submissions: VideoSubmission[];
}

type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'videos';

const TopPlatformsRaceChart: React.FC<TopPlatformsRaceChartProps> = ({ submissions }) => {
  const [topCount, setTopCount] = useState(5);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('views');
  
  // Tooltip state
  const [hoveredPlatform, setHoveredPlatform] = useState<{ 
    platform: VideoSubmission['platform']; 
    x: number; 
    y: number 
  } | null>(null);
  const [showInfo, setShowInfo] = useState(false);

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
      videos: VideoSubmission[];
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
          videos: []
        });
      }

      const platformStats = platformMap.get(platform)!;
      platformStats.totalViews += video.views || 0;
      platformStats.totalLikes += video.likes || 0;
      platformStats.totalComments += video.comments || 0;
      platformStats.totalShares += video.shares || 0;
      platformStats.videoCount += 1;
      platformStats.videos.push(video);
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
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
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
        return (platform as string).charAt(0).toUpperCase() + (platform as string).slice(1);
    }
  };

  // Get platform videos sorted by metric
  const getPlatformVideos = (platform: VideoSubmission['platform']) => {
    const platformStats = platformData.find(p => p.platform === platform);
    if (!platformStats) return [];
    
    return [...platformStats.videos]
      .sort((a, b) => {
        const aValue = selectedMetric === 'views' ? (a.views || 0)
          : selectedMetric === 'likes' ? (a.likes || 0)
          : selectedMetric === 'comments' ? (a.comments || 0)
          : selectedMetric === 'shares' ? (a.shares || 0)
          : selectedMetric === 'engagement' ? (() => {
              const eng = (a.likes || 0) + (a.comments || 0) + (a.shares || 0);
              return a.views > 0 ? (eng / a.views) * 100 : 0;
            })()
          : 0;
        
        const bValue = selectedMetric === 'views' ? (b.views || 0)
          : selectedMetric === 'likes' ? (b.likes || 0)
          : selectedMetric === 'comments' ? (b.comments || 0)
          : selectedMetric === 'shares' ? (b.shares || 0)
          : selectedMetric === 'engagement' ? (() => {
              const eng = (b.likes || 0) + (b.comments || 0) + (b.shares || 0);
              return b.views > 0 ? (eng / b.views) * 100 : 0;
            })()
          : 0;
        
        return bValue - aValue;
      })
      .slice(0, 5);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">Top Platforms</h2>
          <div className="relative">
            <button
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
              className="text-gray-500 hover:text-gray-400 transition-colors"
            >
              <Info className="w-4 h-4" style={{ opacity: 0.5 }} />
            </button>
            
            {/* Info Tooltip */}
            {showInfo && (
              <div 
                className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] p-3 rounded-lg border shadow-xl z-50"
                style={{
                  backgroundColor: 'rgba(26, 26, 26, 0.98)',
                  borderColor: 'rgba(255, 255, 255, 0.1)'
                }}
              >
                <p className="text-xs text-gray-300 leading-relaxed">
                  Compares performance across Instagram, TikTok, YouTube, and Twitter. Helps you identify which platforms drive the most engagement.
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Count Selector */}
          <div className="relative">
            <select
              value={topCount}
              onChange={(e) => setTopCount(Number(e.target.value))}
              className="appearance-none bg-white/10 text-white rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all cursor-pointer"
            >
              <option value={3} className="bg-gray-900">3</option>
              <option value={5} className="bg-gray-900">5</option>
              <option value={10} className="bg-gray-900">10</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
          </div>

          {/* Metric Selector */}
          <div className="relative">
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
              className="appearance-none bg-white/10 text-white rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all cursor-pointer"
            >
              <option value="views" className="bg-gray-900">Views</option>
              <option value="likes" className="bg-gray-900">Likes</option>
              <option value="comments" className="bg-gray-900">Comments</option>
              <option value="shares" className="bg-gray-900">Shares</option>
              <option value="engagement" className="bg-gray-900">Engagement</option>
              <option value="videos" className="bg-gray-900">Video Count</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Platform Race Bars */}
      <div className="space-y-3">
        {topPlatforms.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <p className="text-sm">No platform data available</p>
          </div>
        ) : (
          topPlatforms.map((platform, index) => {
            const value = getMetricValue(platform, selectedMetric);
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            
            return (
              <div
                key={platform.platform}
                className="group relative cursor-pointer"
                style={{
                  animation: `raceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.12}s both`
                }}
                onMouseEnter={(e) => {
                  // Only update if not already hovering this platform
                  if (hoveredPlatform?.platform !== platform.platform) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredPlatform({
                      platform: platform.platform,
                      x: rect.left + rect.width / 2,
                      y: rect.top
                    });
                  }
                  const barElement = e.currentTarget.querySelector('.race-bar') as HTMLElement;
                  if (barElement) {
                    barElement.style.background = 'linear-gradient(to right, #E5E7EB, #F9FAFB)';
                  }
                }}
                onMouseLeave={(e) => {
                  setHoveredPlatform(null);
                  const barElement = e.currentTarget.querySelector('.race-bar') as HTMLElement;
                  if (barElement) {
                    barElement.style.background = 'linear-gradient(to right, #52525B, #3F3F46)';
                  }
                }}
              >
                {/* Bar Container */}
                <div className="relative h-10 flex items-center">
                  {/* Platform Icon (Spearhead) */}
                  <div className="absolute left-0 z-10 flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-gray-800/50 backdrop-blur-sm relative flex items-center justify-center">
                      <PlatformIcon platform={platform.platform} className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Animated Bar */}
                  <div className="ml-14 flex-1 relative flex items-center">
                    <div className="h-10 rounded-lg overflow-hidden flex-1">
                      <div 
                        className="race-bar h-full relative transition-all duration-300 ease-out rounded-lg"
                        style={{
                          width: `${percentage}%`,
                          minWidth: '8%',
                          background: 'linear-gradient(to right, #52525B, #3F3F46)'
                        }}
                      >
                      </div>
                    </div>
                    {/* Metric Value - Always on Right */}
                    <div className="ml-4 min-w-[100px] text-right">
                      <span className="text-lg font-semibold text-white tabular-nums tracking-tight" style={{ fontFamily: 'Inter, SF Pro Display, system-ui, sans-serif' }}>
                        {formatNumber(value, selectedMetric)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Platform Tooltip */}
      {hoveredPlatform && createPortal(
        <div
          className="fixed z-[999999] pointer-events-none"
          style={{
            left: `${hoveredPlatform.x}px`,
            top: `${hoveredPlatform.y - 10}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10 w-[380px]">
            {(() => {
              // Find the platform data
              const platformStats = topPlatforms.find(p => p.platform === hoveredPlatform.platform);
              if (!platformStats) return null;

              const formatNum = (num: number) => {
                if (num >= 1000000) return `${(num / 1000000).toFixed(1)} M`;
                if (num >= 1000) return `${(num / 1000).toFixed(1)} k`;
                return num.toLocaleString();
              };

              const platformVideos = getPlatformVideos(hoveredPlatform.platform);
              const totalValue = getMetricValue(platformStats, selectedMetric);

              return (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-3">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                      {getPlatformName(hoveredPlatform.platform)}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold text-white">
                        {formatNumber(totalValue, selectedMetric)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-white/10 mx-5"></div>
                  
                  {/* Video List */}
                  <div className="overflow-y-auto px-5 py-3" style={{ maxHeight: '400px' }}>
                    {platformVideos.map((video, idx) => {
                      const videoValue = selectedMetric === 'views' ? (video.views || 0)
                        : selectedMetric === 'likes' ? (video.likes || 0)
                        : selectedMetric === 'comments' ? (video.comments || 0)
                        : selectedMetric === 'shares' ? (video.shares || 0)
                        : selectedMetric === 'engagement' ? (() => {
                            const eng = (video.likes || 0) + (video.comments || 0) + (video.shares || 0);
                            return video.views && video.views > 0 ? (eng / video.views) * 100 : 0;
                          })()
                        : 0;

                      return (
                        <div
                          key={video.id || idx}
                          className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-b-0"
                        >
                          {/* Thumbnail */}
                          <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-800">
                            {video.thumbnail ? (
                              <img 
                                src={video.thumbnail} 
                                alt="" 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Play className="w-5 h-5 text-gray-600" />
                              </div>
                            )}
                          </div>

                          {/* Metadata */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate leading-tight mb-1">
                              {video.title || video.caption || '(No caption)'}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <div className="w-4 h-4">
                                <PlatformIcon platform={video.platform} size="sm" />
                              </div>
                              <span className="text-xs text-gray-400 lowercase">
                                {video.uploaderHandle || video.platform}
                              </span>
                            </div>
                          </div>

                          {/* Metric Value */}
                          <div className="flex-shrink-0 text-right">
                            <p className="text-sm font-semibold text-white tabular-nums">
                              {formatNum(videoValue)}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {platformVideos.length === 0 && (
                      <div className="text-center py-4 text-gray-400 text-sm">
                        No videos found
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3 border-t border-white/10">
                    <div className="text-xs text-gray-400 text-center">
                      {platformStats.videoCount} total {platformStats.videoCount === 1 ? 'video' : 'videos'}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes raceSlideIn {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default TopPlatformsRaceChart;
