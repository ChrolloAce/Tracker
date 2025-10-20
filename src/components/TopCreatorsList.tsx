import React, { useState, useMemo } from 'react';
import { VideoSubmission } from '../types';
import { PlatformIcon } from './ui/PlatformIcon';
import { ChevronDown, TrendingUp, TrendingDown, Eye, Heart, MessageCircle, Share2, Users } from 'lucide-react';

interface TopCreatorsListProps {
  submissions: VideoSubmission[];
  onCreatorClick?: (username: string) => void;
}

type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'videos' | 'followers';

const TopCreatorsList: React.FC<TopCreatorsListProps> = ({ submissions, onCreatorClick }) => {
  const [topCount, setTopCount] = useState(10);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('views');

  // Calculate aggregated creator stats
  const creatorStats = useMemo(() => {
    // First, deduplicate videos by ID
    const uniqueVideos = new Map<string, VideoSubmission>();
    submissions.forEach(video => {
      const key = video.id || video.url || `${video.platform}_${video.uploaderHandle}_${video.dateSubmitted.getTime()}`;
      if (!uniqueVideos.has(key)) {
        uniqueVideos.set(key, video);
      }
    });

    // Aggregate by creator (uploaderHandle + platform)
    const creatorMap = new Map<string, {
      handle: string;
      displayName: string;
      platform: VideoSubmission['platform'];
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      totalShares: number;
      videoCount: number;
      followerCount?: number;
      profileImage?: string;
      avgViews: number;
      avgLikes: number;
      avgEngagement: number;
    }>();

    uniqueVideos.forEach(video => {
      const handle = (video.uploaderHandle || 'unknown').trim().toLowerCase();
      const displayName = (video.uploader || handle).trim();
      const accountKey = `${video.platform}_${handle}`;

      if (!creatorMap.has(accountKey)) {
        creatorMap.set(accountKey, {
          handle,
          displayName,
          platform: video.platform,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          videoCount: 0,
          followerCount: video.followerCount,
          profileImage: video.uploaderProfilePicture,
          avgViews: 0,
          avgLikes: 0,
          avgEngagement: 0
        });
      }

      const creator = creatorMap.get(accountKey)!;
      creator.totalViews += video.views || 0;
      creator.totalLikes += video.likes || 0;
      creator.totalComments += video.comments || 0;
      creator.totalShares += video.shares || 0;
      creator.videoCount += 1;
    });

    // Calculate averages
    creatorMap.forEach(creator => {
      creator.avgViews = creator.videoCount > 0 ? creator.totalViews / creator.videoCount : 0;
      creator.avgLikes = creator.videoCount > 0 ? creator.totalLikes / creator.videoCount : 0;
      const totalEngagement = creator.totalLikes + creator.totalComments + creator.totalShares;
      creator.avgEngagement = creator.totalViews > 0 ? (totalEngagement / creator.totalViews) * 100 : 0;
    });

    return Array.from(creatorMap.values());
  }, [submissions]);

  // Sort creators by selected metric
  const sortedCreators = useMemo(() => {
    const getMetricValue = (creator: typeof creatorStats[0]): number => {
      switch (selectedMetric) {
        case 'views':
          return creator.totalViews;
        case 'likes':
          return creator.totalLikes;
        case 'comments':
          return creator.totalComments;
        case 'shares':
          return creator.totalShares;
        case 'engagement':
          return creator.avgEngagement;
        case 'videos':
          return creator.videoCount;
        case 'followers':
          return creator.followerCount || 0;
        default:
          return 0;
      }
    };

    return [...creatorStats]
      .sort((a, b) => getMetricValue(b) - getMetricValue(a))
      .slice(0, topCount);
  }, [creatorStats, selectedMetric, topCount]);

  // Format numbers
  const formatNumber = (num: number, metric?: MetricType): string => {
    if (metric === 'engagement') {
      return `${num.toFixed(1)}%`;
    }
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // Get metric icon
  const getMetricIcon = (metric: MetricType) => {
    switch (metric) {
      case 'views':
        return Eye;
      case 'likes':
        return Heart;
      case 'comments':
        return MessageCircle;
      case 'shares':
        return Share2;
      case 'followers':
        return Users;
      default:
        return TrendingUp;
    }
  };

  const MetricIcon = getMetricIcon(selectedMetric);

  // Get metric value for display
  const getDisplayValue = (creator: typeof creatorStats[0]): number => {
    switch (selectedMetric) {
      case 'views':
        return creator.totalViews;
      case 'likes':
        return creator.totalLikes;
      case 'comments':
        return creator.totalComments;
      case 'shares':
        return creator.totalShares;
      case 'engagement':
        return creator.avgEngagement;
      case 'videos':
        return creator.videoCount;
      case 'followers':
        return creator.followerCount || 0;
      default:
        return 0;
    }
  };

  return (
    <div className="relative rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg hover:shadow-xl transition-all duration-300 p-6 overflow-hidden">
      {/* Depth Gradient Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
        }}
      />

      {/* Header */}
      <div className="relative z-10 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">Top Creators</h3>
            <p className="text-sm text-gray-400 mt-1">Best performing content creators</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Count Selector */}
            <div className="relative">
              <select
                value={topCount}
                onChange={(e) => setTopCount(Number(e.target.value))}
                className="appearance-none bg-white/10 text-white rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all cursor-pointer"
              >
                <option value={5} className="bg-gray-900">Top 5</option>
                <option value={10} className="bg-gray-900">Top 10</option>
                <option value={15} className="bg-gray-900">Top 15</option>
                <option value={20} className="bg-gray-900">Top 20</option>
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
                <option value="videos" className="bg-gray-900">Videos Posted</option>
                <option value="followers" className="bg-gray-900">Followers</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Creators List */}
      <div className="relative z-10 space-y-3">
        {sortedCreators.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No creators found</p>
          </div>
        ) : (
          sortedCreators.map((creator, index) => {
            const value = getDisplayValue(creator);
            const maxValue = getDisplayValue(sortedCreators[0]);
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

            return (
              <div
                key={`${creator.platform}_${creator.handle}`}
                onClick={() => onCreatorClick?.(creator.handle)}
                className="group relative bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all duration-300 cursor-pointer"
              >
                {/* Rank Badge */}
                <div className="absolute -left-2 -top-2 w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                  {index + 1}
                </div>

                {/* Progress Bar Background */}
                <div
                  className="absolute inset-0 bg-gradient-to-r from-violet-500/10 to-transparent rounded-xl transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />

                {/* Content */}
                <div className="relative flex items-center gap-4">
                  {/* Profile Image */}
                  <div className="flex-shrink-0">
                    {creator.profileImage ? (
                      <img
                        src={creator.profileImage}
                        alt={creator.displayName}
                        className="w-12 h-12 rounded-full object-cover border-2 border-white/10"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        {creator.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Creator Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-white font-semibold truncate">
                        {creator.displayName}
                      </h4>
                      <PlatformIcon platform={creator.platform} size="sm" />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>@{creator.handle}</span>
                      <span>•</span>
                      <span>{creator.videoCount} videos</span>
                      {creator.followerCount && (
                        <>
                          <span>•</span>
                          <span>{formatNumber(creator.followerCount)} followers</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Metric Value */}
                  <div className="flex-shrink-0 text-right">
                    <div className="flex items-center gap-2 justify-end mb-1">
                      <MetricIcon className="w-4 h-4 text-violet-400" />
                      <span className="text-xl font-bold text-white">
                        {formatNumber(value, selectedMetric)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {selectedMetric === 'videos' ? 'posts' : selectedMetric}
                    </div>
                  </div>
                </div>

                {/* Hover indicator */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <TrendingUp className="w-5 h-5 text-violet-400" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TopCreatorsList;

