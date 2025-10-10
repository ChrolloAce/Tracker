import React, { useState, useMemo } from 'react';
import { VideoSubmission } from '../types';
import { PlatformIcon } from './ui/PlatformIcon';
import { Info, ChevronDown } from 'lucide-react';

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

  const truncateText = (text: string, maxLength: number = 40): string => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Top Videos */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Videos</h2>
            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <Info className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            {/* Count Selector */}
            <div className="relative">
              <select
                value={topVideosCount}
                onChange={(e) => setTopVideosCount(Number(e.target.value))}
                className="appearance-none bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-2 pr-10 text-sm font-medium border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 transition-colors cursor-pointer"
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
            {/* Metric Selector */}
            <div className="relative">
              <select
                value={videosMetric}
                onChange={(e) => setVideosMetric(e.target.value as MetricType)}
                className="appearance-none bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-2 pr-10 text-sm font-medium border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 transition-colors cursor-pointer"
              >
                <option value="views">Views</option>
                <option value="likes">Likes</option>
                <option value="comments">Comments</option>
                <option value="shares">Shares</option>
                <option value="engagement">Engagement</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Race Bars */}
        <div className="space-y-4">
          {topVideos.map((video, index) => {
            const value = getMetricValue(video, videosMetric);
            const percentage = maxVideoValue > 0 ? (value / maxVideoValue) * 100 : 0;
            
            return (
              <div 
                key={video.id} 
                className="group relative"
                style={{
                  animation: `slideIn 0.6s ease-out ${index * 0.1}s both`
                }}
              >
                {/* Bar Container */}
                <div className="relative h-16 flex items-center">
                  {/* Profile Icon (Spearhead) */}
                  <div className="absolute left-0 z-10 flex-shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-900 dark:border-gray-800 bg-gray-800">
                      {video.thumbnail ? (
                        <img 
                          src={video.thumbnail} 
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                          <PlatformIcon platform={video.platform} className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Animated Bar */}
                  <div className="ml-6 flex-1 relative">
                    <div className="h-12 bg-gray-100 dark:bg-gray-800/50 rounded-r-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-gray-800 to-gray-700 dark:from-gray-700 dark:to-gray-600 rounded-r-full relative transition-all duration-1000 ease-out group-hover:from-gray-700 group-hover:to-gray-600 dark:group-hover:from-gray-600 dark:group-hover:to-gray-500"
                        style={{
                          width: `${percentage}%`,
                          minWidth: '40%'
                        }}
                      >
                        {/* Text Content */}
                        <div className="absolute inset-0 flex items-center justify-between px-4">
                          <span className="text-sm font-medium text-white truncate pr-4">
                            {truncateText(video.title, 35)}
                          </span>
                          <span className="text-lg font-bold text-white tabular-nums flex-shrink-0">
                            {formatNumber(value, videosMetric)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Name Below */}
                <div className="ml-6 mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <PlatformIcon platform={video.platform} className="w-3 h-3" />
                  <span>{video.uploader || video.uploaderHandle || 'Unknown'}</span>
                </div>
              </div>
            );
          })}
        </div>

        {topVideos.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-sm">No videos found</p>
          </div>
        )}
      </div>

      {/* Top Accounts */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Accounts</h2>
            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <Info className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            {/* Count Selector */}
            <div className="relative">
              <select
                value={topAccountsCount}
                onChange={(e) => setTopAccountsCount(Number(e.target.value))}
                className="appearance-none bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-2 pr-10 text-sm font-medium border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 transition-colors cursor-pointer"
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
            {/* Metric Selector */}
            <div className="relative">
              <select
                value={accountsMetric}
                onChange={(e) => setAccountsMetric(e.target.value as MetricType)}
                className="appearance-none bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-2 pr-10 text-sm font-medium border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 transition-colors cursor-pointer"
              >
                <option value="views">Views</option>
                <option value="likes">Likes</option>
                <option value="comments">Comments</option>
                <option value="shares">Shares</option>
                <option value="engagement">Engagement</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Race Bars */}
        <div className="space-y-4">
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
                  animation: `slideIn 0.6s ease-out ${index * 0.1}s both`
                }}
              >
                {/* Bar Container */}
                <div className="relative h-16 flex items-center">
                  {/* Profile Icon (Spearhead) */}
                  <div className="absolute left-0 z-10 flex-shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-900 dark:border-gray-800 bg-gray-800">
                      {account.profileImage ? (
                        <img 
                          src={account.profileImage} 
                          alt={account.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800 text-white font-bold text-lg">
                          {account.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Animated Bar */}
                  <div className="ml-6 flex-1 relative">
                    <div className="h-12 bg-gray-100 dark:bg-gray-800/50 rounded-r-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-gray-800 to-gray-700 dark:from-gray-700 dark:to-gray-600 rounded-r-full relative transition-all duration-1000 ease-out group-hover:from-gray-700 group-hover:to-gray-600 dark:group-hover:from-gray-600 dark:group-hover:to-gray-500"
                        style={{
                          width: `${percentage}%`,
                          minWidth: '40%'
                        }}
                      >
                        {/* Text Content */}
                        <div className="absolute inset-0 flex items-center justify-between px-4">
                          <span className="text-sm font-medium text-white truncate pr-4">
                            {truncateText(account.displayName, 25)}
                          </span>
                          <span className="text-lg font-bold text-white tabular-nums flex-shrink-0">
                            {formatNumber(value, accountsMetric)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Stats Below */}
                <div className="ml-6 mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <PlatformIcon platform={account.platform} className="w-3 h-3" />
                  <span>@{account.handle}</span>
                  <span>•</span>
                  <span>{account.videoCount} video{account.videoCount !== 1 ? 's' : ''}</span>
                </div>
              </div>
            );
          })}
        </div>

        {topAccounts.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-sm">No accounts found</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
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

