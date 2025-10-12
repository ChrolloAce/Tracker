import React, { useState, useMemo } from 'react';
import { VideoSubmission } from '../types';
import { PlatformIcon } from './ui/PlatformIcon';
import { ChevronDown } from 'lucide-react';

interface TopPerformersRaceChartProps {
  submissions: VideoSubmission[];
}

type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'engagement';

const TopPerformersRaceChart: React.FC<TopPerformersRaceChartProps> = ({ submissions }) => {
  const [topVideosCount, setTopVideosCount] = useState(5);
  const [topAccountsCount, setTopAccountsCount] = useState(5);
  const [videosMetric, setVideosMetric] = useState<MetricType>('views');
  const [accountsMetric, setAccountsMetric] = useState<MetricType>('views');

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
      default:
        return 0;
    }
  };

  // Get top videos sorted by selected metric
  const topVideos = useMemo(() => {
    return [...submissions]
      .sort((a, b) => getMetricValue(b, videosMetric) - getMetricValue(a, videosMetric))
      .slice(0, topVideosCount);
  }, [submissions, videosMetric, topVideosCount]);

  // Get top accounts (aggregate by uploader handle)
  const topAccounts = useMemo(() => {
    const accountMap = new Map<string, {
      handle: string;
      displayName: string;
      platform: VideoSubmission['platform'];
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      totalShares: number;
      videoCount: number;
      profileImage?: string;
    }>();

    submissions.forEach(video => {
      const handle = video.uploaderHandle || 'unknown';
      if (!accountMap.has(handle)) {
        accountMap.set(handle, {
          handle,
          displayName: video.uploader || handle,
          platform: video.platform,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          videoCount: 0,
          profileImage: video.uploaderProfilePicture
        });
      }

      const account = accountMap.get(handle)!;
      account.totalViews += video.views || 0;
      account.totalLikes += video.likes || 0;
      account.totalComments += video.comments || 0;
      account.totalShares += video.shares || 0;
      account.videoCount += 1;
    });

    const getAccountMetric = (account: typeof accountMap extends Map<string, infer T> ? T : never): number => {
      switch (accountsMetric) {
        case 'views':
          return account.totalViews;
        case 'likes':
          return account.totalLikes;
        case 'comments':
          return account.totalComments;
        case 'shares':
          return account.totalShares;
        case 'engagement':
          const totalEng = account.totalLikes + account.totalComments + account.totalShares;
          return account.totalViews > 0 ? (totalEng / account.totalViews) * 100 : 0;
        default:
          return 0;
      }
    };

    return Array.from(accountMap.values())
      .sort((a, b) => getAccountMetric(b) - getAccountMetric(a))
      .slice(0, topAccountsCount);
  }, [submissions, accountsMetric, topAccountsCount]);

  const maxVideoValue = topVideos.length > 0 ? getMetricValue(topVideos[0], videosMetric) : 1;
  const maxAccountValue = topAccounts.length > 0 
    ? (accountsMetric === 'views' ? topAccounts[0].totalViews
      : accountsMetric === 'likes' ? topAccounts[0].totalLikes
      : accountsMetric === 'comments' ? topAccounts[0].totalComments
      : accountsMetric === 'shares' ? topAccounts[0].totalShares
      : (() => {
          const totalEng = topAccounts[0].totalLikes + topAccounts[0].totalComments + topAccounts[0].totalShares;
          return topAccounts[0].totalViews > 0 ? (totalEng / topAccounts[0].totalViews) * 100 : 0;
        })())
    : 1;

  const formatNumber = (num: number, metric: MetricType): string => {
    if (metric === 'engagement') {
      return `${num.toFixed(1)}%`;
    }
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Top Videos */}
      <div className="bg-gradient-to-br from-[#121212] to-[#151515] rounded-xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-semibold text-white/90">Top Videos</h2>
          <div className="flex items-center gap-3">
            {/* Count Selector */}
            <div className="relative">
              <select
                value={topVideosCount}
                onChange={(e) => setTopVideosCount(Number(e.target.value))}
                className="appearance-none bg-white/5 text-white/90 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm"
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
                value={videosMetric}
                onChange={(e) => setVideosMetric(e.target.value as MetricType)}
                className="appearance-none bg-white/5 text-white/90 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm"
              >
                <option value="views" className="bg-gray-900">Views</option>
                <option value="likes" className="bg-gray-900">Likes</option>
                <option value="comments" className="bg-gray-900">Comments</option>
                <option value="shares" className="bg-gray-900">Shares</option>
                <option value="engagement" className="bg-gray-900">Engagement</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Race Bars */}
        <div className="space-y-3">
          {topVideos.map((video, index) => {
            const value = getMetricValue(video, videosMetric);
            const percentage = maxVideoValue > 0 ? (value / maxVideoValue) * 100 : 0;
            
            return (
              <div 
                key={video.id} 
                className="group relative"
                style={{
                  animation: `raceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.12}s both`
                }}
              >
                {/* Bar Container */}
                <div className="relative h-10 flex items-center">
                  {/* Profile Icon (Spearhead) */}
                  <div className="absolute left-0 z-10 flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-gray-800/50 backdrop-blur-sm">
                      {video.thumbnail ? (
                        <img 
                          src={video.thumbnail} 
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700/50 to-gray-800/50">
                          <PlatformIcon platform={video.platform} className="w-5 h-5 opacity-60" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Animated Bar */}
                  <div className="ml-8 flex-1 relative">
                    <div className="h-10 bg-white/[0.03] rounded-lg overflow-hidden backdrop-blur-sm">
                      <div 
                        className="h-full rounded-lg relative transition-all duration-1000 ease-out group-hover:opacity-90"
                        style={{
                          width: `${percentage}%`,
                          minWidth: '30%',
                          background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.5) 0%, rgba(34, 197, 94, 0) 100%)',
                          boxShadow: '0 0 12px rgba(34, 197, 94, 0.15)'
                        }}
                      >
                        {/* Metric Value - Center Right */}
                        <div className="absolute inset-0 flex items-center justify-end pr-4">
                          <span className="text-lg font-semibold text-white/80 tabular-nums tracking-tight" style={{ fontFamily: 'Inter, SF Pro Display, system-ui, sans-serif' }}>
                            {formatNumber(value, videosMetric)}
                          </span>
                        </div>

                        {/* Subtle shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {topVideos.length === 0 && (
          <div className="text-center py-16 text-white/40">
            <p className="text-sm">No videos found</p>
          </div>
        )}
      </div>

      {/* Top Accounts */}
      <div className="bg-gradient-to-br from-[#121212] to-[#151515] rounded-xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-semibold text-white/90">Top Accounts</h2>
          <div className="flex items-center gap-3">
            {/* Count Selector */}
            <div className="relative">
              <select
                value={topAccountsCount}
                onChange={(e) => setTopAccountsCount(Number(e.target.value))}
                className="appearance-none bg-white/5 text-white/90 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm"
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
                value={accountsMetric}
                onChange={(e) => setAccountsMetric(e.target.value as MetricType)}
                className="appearance-none bg-white/5 text-white/90 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm"
              >
                <option value="views" className="bg-gray-900">Views</option>
                <option value="likes" className="bg-gray-900">Likes</option>
                <option value="comments" className="bg-gray-900">Comments</option>
                <option value="shares" className="bg-gray-900">Shares</option>
                <option value="engagement" className="bg-gray-900">Engagement</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Race Bars */}
        <div className="space-y-3">
          {topAccounts.map((account, index) => {
            const value = accountsMetric === 'views' ? account.totalViews
              : accountsMetric === 'likes' ? account.totalLikes
              : accountsMetric === 'comments' ? account.totalComments
              : accountsMetric === 'shares' ? account.totalShares
              : (() => {
                  const totalEng = account.totalLikes + account.totalComments + account.totalShares;
                  return account.totalViews > 0 ? (totalEng / account.totalViews) * 100 : 0;
                })();
            const percentage = maxAccountValue > 0 ? (value / maxAccountValue) * 100 : 0;
            
            return (
              <div 
                key={account.handle} 
                className="group relative"
                style={{
                  animation: `raceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.12}s both`
                }}
              >
                {/* Bar Container */}
                <div className="relative h-10 flex items-center">
                  {/* Profile Icon (Spearhead) */}
                  <div className="absolute left-0 z-10 flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-gray-800/50 backdrop-blur-sm">
                      {account.profileImage ? (
                        <img 
                          src={account.profileImage} 
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700/50 to-gray-800/50 text-white/70 font-semibold text-sm">
                          {account.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Animated Bar */}
                  <div className="ml-8 flex-1 relative">
                    <div className="h-10 bg-white/[0.03] rounded-lg overflow-hidden backdrop-blur-sm">
                      <div 
                        className="h-full rounded-lg relative transition-all duration-1000 ease-out group-hover:opacity-90"
                        style={{
                          width: `${percentage}%`,
                          minWidth: '30%',
                          background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.5) 0%, rgba(34, 197, 94, 0) 100%)',
                          boxShadow: '0 0 12px rgba(34, 197, 94, 0.15)'
                        }}
                      >
                        {/* Metric Value - Center Right */}
                        <div className="absolute inset-0 flex items-center justify-end pr-4">
                          <span className="text-lg font-semibold text-white/80 tabular-nums tracking-tight" style={{ fontFamily: 'Inter, SF Pro Display, system-ui, sans-serif' }}>
                            {formatNumber(value, accountsMetric)}
                          </span>
                        </div>

                        {/* Subtle shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {topAccounts.length === 0 && (
          <div className="text-center py-16 text-white/40">
            <p className="text-sm">No accounts found</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes raceSlideIn {
          from {
            opacity: 0;
            transform: translateX(-40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default TopPerformersRaceChart;
