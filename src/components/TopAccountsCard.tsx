import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { VideoSubmission } from '../types';
import { PlatformIcon } from './ui/PlatformIcon';
import { ChevronDown } from 'lucide-react';

interface TopAccountsCardProps {
  submissions: VideoSubmission[];
  onAccountClick?: (username: string) => void;
}

type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'videos';

const TopAccountsCard: React.FC<TopAccountsCardProps> = ({ submissions, onAccountClick }) => {
  const [topCount, setTopCount] = useState(5);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('views');
  const [hoveredAccount, setHoveredAccount] = useState<{ handle: string; x: number; y: number } | null>(null);

  const topAccounts = useMemo(() => {
    const accountMap = new Map<string, {
      handle: string;
      platform: VideoSubmission['platform'];
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      totalShares: number;
      videoCount: number;
      profilePic?: string;
    }>();

    submissions.forEach(video => {
      const handle = video.uploaderHandle;
      if (!accountMap.has(handle)) {
        accountMap.set(handle, {
          handle,
          platform: video.platform,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          videoCount: 0,
          profilePic: video.uploaderProfilePicture,
        });
      }

      const account = accountMap.get(handle)!;
      account.totalViews += video.views || 0;
      account.totalLikes += video.likes || 0;
      account.totalComments += video.comments || 0;
      account.totalShares += video.shares || 0;
      account.videoCount++;
    });

    return Array.from(accountMap.values())
      .sort((a, b) => {
        switch (selectedMetric) {
          case 'views': return b.totalViews - a.totalViews;
          case 'likes': return b.totalLikes - a.totalLikes;
          case 'comments': return b.totalComments - a.totalComments;
          case 'shares': return b.totalShares - a.totalShares;
          case 'videos': return b.videoCount - a.videoCount;
          case 'engagement':
            const aEng = a.totalViews > 0 ? ((a.totalLikes + a.totalComments + a.totalShares) / a.totalViews) * 100 : 0;
            const bEng = b.totalViews > 0 ? ((b.totalLikes + b.totalComments + b.totalShares) / b.totalViews) * 100 : 0;
            return bEng - aEng;
          default: return 0;
        }
      })
      .slice(0, topCount);
  }, [submissions, selectedMetric, topCount]);

  const getMetricValue = (account: typeof topAccounts[0]): number => {
    switch (selectedMetric) {
      case 'views': return account.totalViews;
      case 'likes': return account.totalLikes;
      case 'comments': return account.totalComments;
      case 'shares': return account.totalShares;
      case 'videos': return account.videoCount;
      case 'engagement':
        return account.totalViews > 0 
          ? ((account.totalLikes + account.totalComments + account.totalShares) / account.totalViews) * 100 
          : 0;
      default: return 0;
    }
  };

  const maxMetricValue = topAccounts.length > 0 ? getMetricValue(topAccounts[0]) : 1;

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
      case 'videos': return 'from-violet-500 to-purple-500';
      case 'engagement': return 'from-orange-500 to-amber-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg shadow-lg border border-white/10 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Top Accounts</h2>
          <p className="text-sm text-white/60 mt-1">Best performing creators</p>
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
            <option value="videos">Videos</option>
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

      {/* Accounts List */}
      <div className="space-y-4">
        {topAccounts.map((account, index) => {
          const metricValue = getMetricValue(account);
          const percentage = maxMetricValue > 0 ? (metricValue / maxMetricValue) * 100 : 0;

          return (
            <div key={account.handle} className="group">
              <div className="flex items-center gap-3 mb-2">
                {/* Rank */}
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex-shrink-0">
                  <span className="text-sm font-bold text-white">#{index + 1}</span>
                </div>

                {/* Account Info */}
                <div className="flex-1 min-w-0">
                  <div 
                    className="relative h-12 bg-zinc-800/50 rounded-lg overflow-hidden cursor-pointer hover:bg-zinc-800/70 transition-colors"
                    onClick={() => onAccountClick?.(account.handle)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredAccount({
                        handle: account.handle,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 10,
                      });
                    }}
                    onMouseLeave={() => setHoveredAccount(null)}
                  >
                    {/* Progress Bar */}
                    <div
                      className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getMetricColor(selectedMetric)} transition-all duration-500 ease-out`}
                      style={{ width: `${percentage}%` }}
                    />
                    
                    {/* Content */}
                    <div className="absolute inset-0 flex items-center px-3 gap-3">
                      {/* Profile Picture / Platform Icon */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-white/10 flex items-center justify-center z-10">
                        {account.profilePic ? (
                          <img src={account.profilePic} alt={account.handle} className="w-full h-full object-cover" />
                        ) : (
                          <PlatformIcon platform={account.platform} className="w-5 h-5" />
                        )}
                      </div>

                      {/* Handle */}
                      <span className="text-sm font-semibold text-white z-10 truncate flex-1">
                        @{account.handle}
                      </span>

                      {/* Metric Value */}
                      <span className="text-sm font-bold text-white z-10 flex-shrink-0">
                        {formatNumber(metricValue, selectedMetric)}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                    <span>{account.videoCount} videos</span>
                    <span>•</span>
                    <span>{formatNumber(account.totalViews, 'views')} views</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {topAccounts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/40 text-sm">No accounts found</p>
        </div>
      )}

      {/* Tooltip */}
      {hoveredAccount && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: hoveredAccount.x,
            top: hoveredAccount.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-xs whitespace-nowrap">
            <div className="font-semibold">@{hoveredAccount.handle}</div>
            <div className="text-gray-300 mt-1">
              {topAccounts.find(a => a.handle === hoveredAccount.handle)?.videoCount} videos tracked
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TopAccountsCard;

