import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { VideoSubmission } from '../types';
import { PlatformIcon } from './ui/PlatformIcon';
import { ChevronDown, Play } from 'lucide-react';

interface TopPerformersRaceChartProps {
  submissions: VideoSubmission[];
  onVideoClick?: (video: VideoSubmission) => void;
  onAccountClick?: (username: string) => void;
}

type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'engagement';

const TopPerformersRaceChart: React.FC<TopPerformersRaceChartProps> = ({ submissions, onVideoClick, onAccountClick }) => {
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
    // Deduplicate videos by ID first
    const uniqueVideos = new Map<string, VideoSubmission>();
    submissions.forEach(video => {
      const key = video.id || video.url || `${video.platform}_${video.uploaderHandle}_${video.dateSubmitted.getTime()}`;
      if (!uniqueVideos.has(key)) {
        uniqueVideos.set(key, video);
      }
    });
    
    return Array.from(uniqueVideos.values())
      .sort((a, b) => getMetricValue(b, videosMetric) - getMetricValue(a, videosMetric))
      .slice(0, topVideosCount);
  }, [submissions, videosMetric, topVideosCount]);

  // Get top accounts (aggregate by uploader handle + platform)
  const topAccounts = useMemo(() => {
    // First, deduplicate submissions by video ID to prevent double counting
    const uniqueVideos = new Map<string, VideoSubmission>();
    const skippedDuplicates: string[] = [];
    
    submissions.forEach(video => {
      if (video.id) {
        if (!uniqueVideos.has(video.id)) {
          uniqueVideos.set(video.id, video);
        } else {
          skippedDuplicates.push(`${video.platform}:${video.uploaderHandle}:${video.id}`);
        }
      } else if (!video.id) {
        // If no ID, use URL as primary key if available
        const tempKey = video.url || `${video.platform}_${video.uploaderHandle}_${video.dateSubmitted.getTime()}`;
        if (!uniqueVideos.has(tempKey)) {
          uniqueVideos.set(tempKey, video);
        } else {
          skippedDuplicates.push(`${video.platform}:${video.uploaderHandle}:NO_ID`);
        }
      }
    });
    
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

    uniqueVideos.forEach(video => {
      const handle = (video.uploaderHandle || 'unknown').trim().toLowerCase();
      const displayName = (video.uploader || handle).trim();
      // Use both platform and handle to uniquely identify accounts
      const accountKey = `${video.platform}_${handle}`;
      
      if (!accountMap.has(accountKey)) {
        accountMap.set(accountKey, {
          handle,
          displayName,
          platform: video.platform,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          videoCount: 0,
          profileImage: video.uploaderProfilePicture
        });
      }

      const account = accountMap.get(accountKey)!;
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

    const sortedAccounts = Array.from(accountMap.values())
      .sort((a, b) => getAccountMetric(b) - getAccountMetric(a))
      .slice(0, topAccountsCount);
    
    return sortedAccounts;
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
      <div className="relative rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg hover:shadow-xl transition-all duration-300 p-6 overflow-hidden">
        {/* Depth Gradient Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
          }}
        />
        
        {/* Content Layer */}
        <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-semibold text-white">Top Videos</h2>
          <div className="flex items-center gap-3">
            {/* Count Selector */}
            <div className="relative">
              <select
                value={topVideosCount}
                onChange={(e) => setTopVideosCount(Number(e.target.value))}
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
                value={videosMetric}
                onChange={(e) => setVideosMetric(e.target.value as MetricType)}
                className="appearance-none bg-white/10 text-white rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all cursor-pointer"
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
                key={video.id || `${video.platform}_${video.uploaderHandle}_${index}`} 
                className="group relative cursor-pointer"
                style={{
                  animation: `raceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.12}s both`
                }}
                onClick={() => onVideoClick?.(video)}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredVideo({
                    video,
                    x: rect.left + rect.width / 2,
                    y: rect.top
                  });
                  const barElement = e.currentTarget.querySelector('.race-bar') as HTMLElement;
                  if (barElement) {
                    barElement.style.background = 'linear-gradient(to right, #E5E7EB, #F9FAFB)';
                  }
                }}
                onMouseLeave={(e) => {
                  setHoveredVideo(null);
                  const barElement = e.currentTarget.querySelector('.race-bar') as HTMLElement;
                  if (barElement) {
                    barElement.style.background = 'linear-gradient(to right, #52525B, #3F3F46)';
                  }
                }}
              >
                {/* Bar Container */}
                <div className="relative h-10 flex items-center">
                  {/* Profile Icon (Spearhead) */}
                  <div className="absolute left-0 z-10 flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-gray-800/50 backdrop-blur-sm relative">
                      {video.thumbnail ? (
                        <>
                          <img 
                            src={video.thumbnail} 
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {/* Platform Logo Badge */}
                          <div className="absolute bottom-0 right-0 w-4 h-4 bg-black/80 backdrop-blur-sm rounded-tl-md flex items-center justify-center">
                            <PlatformIcon platform={video.platform} size="sm" className="w-3 h-3" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700/50 to-gray-800/50">
                          <PlatformIcon platform={video.platform} className="w-5 h-5 opacity-60" />
                        </div>
                      )}
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
                        {formatNumber(value, videosMetric)}
                      </span>
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
      </div>

      {/* Top Accounts */}
      <div className="relative rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg hover:shadow-xl transition-all duration-300 p-6 overflow-hidden">
        {/* Depth Gradient Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
          }}
        />
        
        {/* Content Layer */}
        <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-semibold text-white">Top Accounts</h2>
          <div className="flex items-center gap-3">
            {/* Count Selector */}
            <div className="relative">
              <select
                value={topAccountsCount}
                onChange={(e) => setTopAccountsCount(Number(e.target.value))}
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
                value={accountsMetric}
                onChange={(e) => setAccountsMetric(e.target.value as MetricType)}
                className="appearance-none bg-white/10 text-white rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all cursor-pointer"
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
                key={`${account.platform}_${account.handle}_${index}`} 
                className="group relative cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  animation: `raceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.12}s both`
                }}
                onClick={() => {
                  onAccountClick?.(account.handle);
                }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredAccount({
                    handle: account.handle,
                    x: rect.left + rect.width / 2,
                    y: rect.top
                  });
                  const barElement = e.currentTarget.querySelector('.race-bar') as HTMLElement;
                  if (barElement) {
                    barElement.style.background = 'linear-gradient(to right, #E5E7EB, #F9FAFB)';
                  }
                }}
                onMouseLeave={(e) => {
                  setHoveredAccount(null);
                  const barElement = e.currentTarget.querySelector('.race-bar') as HTMLElement;
                  if (barElement) {
                    barElement.style.background = 'linear-gradient(to right, #52525B, #3F3F46)';
                  }
                }}
              >
                {/* Bar Container */}
                <div className="relative h-10 flex items-center">
                  {/* Profile Icon (Spearhead) */}
                  <div className="absolute left-0 z-10 flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-gray-800/50 backdrop-blur-sm relative">
                      {account.profileImage ? (
                        <>
                          <img 
                            src={account.profileImage} 
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {/* Platform Logo Badge */}
                          <div className="absolute bottom-0 right-0 w-4 h-4 bg-black/80 backdrop-blur-sm rounded-tl-md flex items-center justify-center">
                            <PlatformIcon platform={account.platform} size="sm" className="w-3 h-3" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700/50 to-gray-800/50 text-white/70 font-semibold text-sm">
                            {account.displayName.charAt(0).toUpperCase()}
                          </div>
                          {/* Platform Logo Badge */}
                          <div className="absolute bottom-0 right-0 w-4 h-4 bg-black/80 backdrop-blur-sm rounded-tl-md flex items-center justify-center">
                            <PlatformIcon platform={account.platform} size="sm" className="w-3 h-3" />
                          </div>
                        </>
                      )}
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
                        {formatNumber(value, accountsMetric)}
                      </span>
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
          <div className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10 w-[320px]">
            {(() => {
              const stats = getVideoStats(hoveredVideo.video);
              const formatNum = (num: number) => {
                if (num >= 1000000) return `${(num / 1000000).toFixed(1)} M`;
                if (num >= 1000) return `${(num / 1000).toFixed(1)} k`;
                return num.toLocaleString();
              };

              const uploadDate = stats.uploadDate ? new Date(stats.uploadDate) : null;
              const dateStr = uploadDate ? uploadDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              }) : 'Unknown Date';

              return (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-3">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                      {dateStr}
                    </p>
                    <div className="flex items-baseline gap-3">
                      <p className="text-2xl font-bold text-white">
                        {formatNum(getMetricValue(hoveredVideo.video, videosMetric))}
                      </p>
                      {stats.viewChange !== 0 && (
                        <span className={`text-xs font-semibold ${stats.viewChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {stats.viewChange > 0 ? '↑' : '↓'} {Math.abs(stats.viewChangePercentage).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-white/10 mx-5"></div>
                  
                  {/* Video Info */}
                  <div className="px-5 py-3">
                    <div className="flex items-center gap-3 py-2.5">
                      {/* Thumbnail */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-800">
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

                      {/* Metadata */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate leading-tight mb-1">
                          {hoveredVideo.video.title || hoveredVideo.video.caption || '(No caption)'}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4">
                            <PlatformIcon platform={hoveredVideo.video.platform} size="sm" />
                          </div>
                          <span className="text-xs text-gray-400 lowercase">
                            {hoveredVideo.video.uploaderHandle || hoveredVideo.video.platform}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Click to Expand */}
                    <div className="mt-2 pt-3 border-t border-white/10">
                      <button className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-white transition-colors">
                        <span>Click to expand data</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
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
          <div className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10 w-[380px]">
            {(() => {
              // Find the account data
              const account = topAccounts.find(acc => acc.handle === hoveredAccount.handle);
              if (!account) return null;

              const formatNum = (num: number) => {
                if (num >= 1000000) return `${(num / 1000000).toFixed(1)} M`;
                if (num >= 1000) return `${(num / 1000).toFixed(1)} k`;
                return num.toLocaleString();
              };

              // Calculate total views for this account
              const totalViews = account.totalViews;
              
              // Calculate PP comparison (you can add this logic based on your data)
              // For now, we'll show growth if view change data is available
              const accountVideos = getAccountVideos(hoveredAccount.handle);
              let totalGrowth = 0;
              let hasGrowthData = false;
              accountVideos.forEach(video => {
                const stats = getVideoStats(video);
                if (stats.viewChange !== 0) {
                  totalGrowth += stats.viewChangePercentage;
                  hasGrowthData = true;
                }
              });
              const avgGrowth = hasGrowthData ? totalGrowth / accountVideos.filter(v => getVideoStats(v).viewChange !== 0).length : 0;

              return (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-3">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                      @{hoveredAccount.handle}
                    </p>
                    <div className="flex items-baseline gap-3">
                      <p className="text-2xl font-bold text-white">
                        {formatNum(totalViews)}
                      </p>
                      {hasGrowthData && avgGrowth !== 0 && (
                        <span className={`text-xs font-semibold ${avgGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {avgGrowth >= 0 ? '↑' : '↓'} {Math.abs(avgGrowth).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-white/10 mx-5"></div>
                  
                  {/* Video List */}
                  <div className="overflow-y-auto px-5 py-3" style={{ maxHeight: '400px' }}>
                    {accountVideos.map((video, _idx) => {
                      const stats = getVideoStats(video);

                      return (
                        <div 
                          key={video.id} 
                          className="flex items-center gap-3 py-2.5 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
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
                              <span className="text-xs text-gray-400">
                                {stats.uploadDate ? new Date(stats.uploadDate).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric'
                                }) : 'Unknown'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Metric Value */}
                          <div className="flex-shrink-0 text-right">
                            <p className="text-sm font-bold text-white">
                              {formatNum(video.views || 0)}
                            </p>
                            <p className="text-xs text-gray-500">Views</p>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Click to Expand */}
                    <div className="mt-2 pt-3 border-t border-white/10">
                      <button className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-white transition-colors">
                        <span>Click to expand data</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
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
