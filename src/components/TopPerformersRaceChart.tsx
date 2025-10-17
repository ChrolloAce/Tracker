import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { VideoSubmission } from '../types';
import { PlatformIcon } from './ui/PlatformIcon';
import { ChevronDown, TrendingUp, TrendingDown, Calendar, Eye, Play } from 'lucide-react';

interface TopPerformersRaceChartProps {
  submissions: VideoSubmission[];
}

type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'engagement';

const TopPerformersRaceChart: React.FC<TopPerformersRaceChartProps> = ({ submissions }) => {
  const [topVideosCount, setTopVideosCount] = useState(5);
  const [topAccountsCount, setTopAccountsCount] = useState(5);
  const [videosMetric, setVideosMetric] = useState<MetricType>('views');
  const [accountsMetric, setAccountsMetric] = useState<MetricType>('views');
  
  // Tooltip states
  const [hoveredVideo, setHoveredVideo] = useState<{ video: VideoSubmission; x: number; y: number } | null>(null);
  const [hoveredAccount, setHoveredAccount] = useState<{ handle: string; x: number; y: number } | null>(null);

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

  // Calculate video stats for tooltip
  const getVideoStats = (video: VideoSubmission) => {
    const currentViews = video.views || 0;
    const totalEngagement = (video.likes || 0) + (video.comments || 0) + (video.shares || 0);
    const engagementRate = currentViews > 0 ? (totalEngagement / currentViews) * 100 : 0;
    
    // Calculate view change from snapshots
    let viewChange = 0;
    let viewChangePercentage = 0;
    let lastSnapshotDate: Date | null = null;
    
    if (video.snapshots && video.snapshots.length > 1) {
      const sortedSnapshots = [...video.snapshots].sort((a, b) => 
        new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
      );
      const firstSnapshot = sortedSnapshots[0];
      const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1];
      
      viewChange = currentViews - firstSnapshot.views;
      viewChangePercentage = firstSnapshot.views > 0 
        ? ((currentViews - firstSnapshot.views) / firstSnapshot.views) * 100 
        : 0;
      lastSnapshotDate = new Date(lastSnapshot.capturedAt);
    } else if (video.snapshots && video.snapshots.length === 1) {
      lastSnapshotDate = new Date(video.snapshots[0].capturedAt);
    }
    
    const uploadDate = video.uploadDate || video.dateSubmitted;
    
    return {
      currentViews,
      viewChange,
      viewChangePercentage,
      engagementRate,
      uploadDate,
      lastSnapshotDate,
      totalEngagement
    };
  };

  // Get videos for account tooltip
  const getAccountVideos = (handle: string) => {
    const accountVideos = submissions.filter(v => v.uploaderHandle === handle);
    
    // Sort by view growth (if snapshots available) or upload date
    return accountVideos.sort((a, b) => {
      const aStats = getVideoStats(a);
      const bStats = getVideoStats(b);
      
      // If both have snapshots with view growth, sort by growth
      if (aStats.viewChange > 0 && bStats.viewChange > 0) {
        return bStats.viewChange - aStats.viewChange;
      }
      
      // Otherwise sort by upload date (newest first)
      const aDate = a.uploadDate || a.dateSubmitted;
      const bDate = b.uploadDate || b.dateSubmitted;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    }).slice(0, 5); // Show top 5 videos
  };

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
                className="group relative cursor-pointer"
                style={{
                  animation: `raceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.12}s both`
                }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredVideo({
                    video,
                    x: rect.left + rect.width / 2,
                    y: rect.top
                  });
                }}
                onMouseLeave={() => setHoveredVideo(null)}
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
                  <div className="ml-14 flex-1 relative">
                    <div className="h-10 bg-gray-800 rounded-lg overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 via-purple-400 to-pink-400 relative transition-all duration-1000 ease-out group-hover:from-purple-600 group-hover:via-purple-500 group-hover:to-pink-500"
                        style={{
                          width: `${percentage}%`,
                          minWidth: '30%'
                        }}
                      >
                        {/* Metric Value - Center Right */}
                        <div className="absolute inset-0 flex items-center justify-end pr-4">
                          <span className="text-lg font-semibold text-white tabular-nums tracking-tight" style={{ fontFamily: 'Inter, SF Pro Display, system-ui, sans-serif' }}>
                            {formatNumber(value, videosMetric)}
                          </span>
                        </div>
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
                className="group relative cursor-pointer"
                style={{
                  animation: `raceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.12}s both`
                }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredAccount({
                    handle: account.handle,
                    x: rect.left + rect.width / 2,
                    y: rect.top
                  });
                }}
                onMouseLeave={() => setHoveredAccount(null)}
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
                  <div className="ml-14 flex-1 relative">
                    <div className="h-10 bg-gray-800 rounded-lg overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 via-purple-400 to-pink-400 relative transition-all duration-1000 ease-out group-hover:from-purple-600 group-hover:via-purple-500 group-hover:to-pink-500"
                        style={{
                          width: `${percentage}%`,
                          minWidth: '30%'
                        }}
                      >
                        {/* Metric Value - Center Right */}
                        <div className="absolute inset-0 flex items-center justify-end pr-4">
                          <span className="text-lg font-semibold text-white tabular-nums tracking-tight" style={{ fontFamily: 'Inter, SF Pro Display, system-ui, sans-serif' }}>
                            {formatNumber(value, accountsMetric)}
                          </span>
                        </div>
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

      {/* Video Tooltip */}
      {hoveredVideo && createPortal(
        <div
          className="fixed z-[999999] pointer-events-none"
          style={{
            left: `${hoveredVideo.x}px`,
            top: `${hoveredVideo.y - 10}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10 p-4 w-[320px]">
            {/* Header */}
            <div className="flex items-start gap-3 mb-3 pb-3 border-b border-white/10">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                {hoveredVideo.video.thumbnail ? (
                  <img 
                    src={hoveredVideo.video.thumbnail} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-5 h-5 text-gray-600" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight">
                  {hoveredVideo.video.title || 'Untitled Video'}
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-3.5 h-3.5">
                    <PlatformIcon platform={hoveredVideo.video.platform} size="sm" />
                  </div>
                  <span className="text-xs text-gray-400">
                    {hoveredVideo.video.uploaderHandle || hoveredVideo.video.platform}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats */}
            {(() => {
              const stats = getVideoStats(hoveredVideo.video);
              const formatNum = (num: number) => {
                if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
                if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
                return num.toLocaleString();
              };

              return (
                <div className="space-y-2.5">
                  {/* Current Views */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-gray-400">Current Views</span>
                    </div>
                    <span className="text-sm font-semibold text-white">
                      {formatNum(stats.currentViews)}
                    </span>
                  </div>

                  {/* View Change */}
                  {stats.viewChange !== 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {stats.viewChange > 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-400" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-400" />
                        )}
                        <span className="text-xs text-gray-400">View Change</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-semibold ${stats.viewChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {stats.viewChange > 0 ? '+' : ''}{formatNum(stats.viewChange)}
                        </span>
                        {stats.viewChangePercentage !== 0 && (
                          <span className={`text-xs ml-1 ${stats.viewChange > 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                            ({stats.viewChange > 0 ? '+' : ''}{stats.viewChangePercentage.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Engagement Rate */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Engagement Rate</span>
                    <span className="text-sm font-semibold text-purple-400">
                      {stats.engagementRate.toFixed(2)}%
                    </span>
                  </div>

                  {/* Dates */}
                  <div className="pt-2 mt-2 border-t border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs text-gray-500">Upload Date</span>
                      </div>
                      <span className="text-xs text-gray-300">
                        {stats.uploadDate ? new Date(stats.uploadDate).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        }) : 'Unknown'}
                      </span>
                    </div>
                    {stats.lastSnapshotDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 ml-5">Last Snapshot</span>
                        <span className="text-xs text-gray-300">
                          {stats.lastSnapshotDate.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* Account Tooltip */}
      {hoveredAccount && createPortal(
        <div
          className="fixed z-[999999] pointer-events-none"
          style={{
            left: `${hoveredAccount.x}px`,
            top: `${hoveredAccount.y - 10}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10 p-4 w-[380px] max-h-[500px] overflow-y-auto">
            {/* Header */}
            <div className="mb-3 pb-3 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">
                Top Videos by {hoveredAccount.handle}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Sorted by performance
              </p>
            </div>

            {/* Video List */}
            <div className="space-y-2.5">
              {getAccountVideos(hoveredAccount.handle).map((video, idx) => {
                const stats = getVideoStats(video);
                const formatNum = (num: number) => {
                  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
                  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
                  return num.toLocaleString();
                };

                return (
                  <div 
                    key={video.id} 
                    className="flex items-start gap-2.5 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                      {video.thumbnail ? (
                        <img 
                          src={video.thumbnail} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-4 h-4 text-gray-600" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium line-clamp-2 leading-tight mb-1">
                        {video.title || 'Untitled Video'}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400">
                          {formatNum(video.views || 0)} views
                        </span>
                        {stats.viewChange > 0 && (
                          <span className="text-green-400">
                            +{formatNum(stats.viewChange)}
                          </span>
                        )}
                      </div>
                      {stats.uploadDate && (
                        <span className="text-xs text-gray-500 mt-0.5 block">
                          {new Date(stats.uploadDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric'
                          })}
                        </span>
                      )}
                    </div>

                    {/* Rank Badge */}
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-white/60">
                        {idx + 1}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

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
