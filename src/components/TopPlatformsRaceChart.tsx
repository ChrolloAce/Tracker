import React, { useState, useMemo } from 'react';
import { VideoSubmission } from '../types';
import { PlatformIcon } from './ui/PlatformIcon';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface TopPlatformsRaceChartProps {
  submissions: VideoSubmission[];
}

type SortColumn = 'platform' | 'videos' | 'views' | 'likes' | 'comments' | 'shares' | 'avgViews';
type SortDirection = 'asc' | 'desc';

const TopPlatformsRaceChart: React.FC<TopPlatformsRaceChartProps> = ({ submissions }) => {
  const [sortColumn, setSortColumn] = useState<SortColumn>('views');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

  // Sort platform data
  const sortedPlatforms = useMemo(() => {
    const sorted = [...platformData];
    
    sorted.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortColumn) {
        case 'platform':
          aValue = a.platform;
          bValue = b.platform;
          break;
        case 'videos':
          aValue = a.videoCount;
          bValue = b.videoCount;
          break;
        case 'views':
          aValue = a.totalViews;
          bValue = b.totalViews;
          break;
        case 'likes':
          aValue = a.totalLikes;
          bValue = b.totalLikes;
          break;
        case 'comments':
          aValue = a.totalComments;
          bValue = b.totalComments;
          break;
        case 'shares':
          aValue = a.totalShares;
          bValue = b.totalShares;
          break;
        case 'avgViews':
          aValue = a.videoCount > 0 ? a.totalViews / a.videoCount : 0;
          bValue = b.videoCount > 0 ? b.totalViews / b.videoCount : 0;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return sorted;
  }, [platformData, sortColumn, sortDirection]);

  // Format number with proper units
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
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

  // Handle column sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Render sort icon
  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-emerald-400" />
      : <ArrowDown className="w-4 h-4 text-emerald-400" />;
  };

  return (
    <div className="bg-zinc-900 rounded-lg shadow-lg border border-white/10 overflow-hidden">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Top Platforms</h2>
            <p className="text-sm text-white/60 mt-1">Performance across all platforms</p>
          </div>
          <div className="text-sm text-white/60">
            {platformData.length} platform{platformData.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('platform')}
              >
                <div className="flex items-center gap-2">
                  Platform
                  {renderSortIcon('platform')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-right text-xs font-medium text-white/60 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('videos')}
              >
                <div className="flex items-center justify-end gap-2">
                  Videos
                  {renderSortIcon('videos')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-right text-xs font-medium text-white/60 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('views')}
              >
                <div className="flex items-center justify-end gap-2">
                  Total Views
                  {renderSortIcon('views')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-right text-xs font-medium text-white/60 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('avgViews')}
              >
                <div className="flex items-center justify-end gap-2">
                  Avg Views
                  {renderSortIcon('avgViews')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-right text-xs font-medium text-white/60 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('likes')}
              >
                <div className="flex items-center justify-end gap-2">
                  Likes
                  {renderSortIcon('likes')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-right text-xs font-medium text-white/60 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('comments')}
              >
                <div className="flex items-center justify-end gap-2">
                  Comments
                  {renderSortIcon('comments')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-right text-xs font-medium text-white/60 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('shares')}
              >
                <div className="flex items-center justify-end gap-2">
                  Shares
                  {renderSortIcon('shares')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedPlatforms.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-white/40">
                  No platform data available
                </td>
              </tr>
            ) : (
              sortedPlatforms.map((platform) => {
                const avgViews = platform.videoCount > 0 ? platform.totalViews / platform.videoCount : 0;
                
                return (
                  <tr 
                    key={platform.platform}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5">
                          <PlatformIcon platform={platform.platform} className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-medium text-white">
                          {getPlatformName(platform.platform)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white/80">
                      {platform.videoCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-white">
                      {formatNumber(platform.totalViews)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white/80">
                      {formatNumber(avgViews)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white/80">
                      {formatNumber(platform.totalLikes)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white/80">
                      {formatNumber(platform.totalComments)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white/80">
                      {formatNumber(platform.totalShares)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TopPlatformsRaceChart;
