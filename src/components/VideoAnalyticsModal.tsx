import React, { useMemo } from 'react';
import { X, ExternalLink, TrendingUp, TrendingDown, Calendar, Eye, Heart, MessageCircle } from 'lucide-react';
import { VideoSubmission } from '../types';
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import { PlatformIcon } from './ui/PlatformIcon';

interface VideoAnalyticsModalProps {
  video: VideoSubmission | null;
  isOpen: boolean;
  onClose: () => void;
}

interface ChartDataPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  timestamp: number;
}

const VideoAnalyticsModal: React.FC<VideoAnalyticsModalProps> = ({ video, isOpen, onClose }) => {
  if (!isOpen || !video) return null;

  // Prepare chart data from snapshots
  const chartData = useMemo((): ChartDataPoint[] => {
    // If no snapshots, create initial data point from current video stats
    if (!video.snapshots || video.snapshots.length === 0) {
      return [{
        date: new Date(video.timestamp || video.dateSubmitted).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        views: video.views,
        likes: video.likes,
        comments: video.comments,
        shares: video.shares || 0,
        timestamp: new Date(video.timestamp || video.dateSubmitted).getTime()
      }];
    }

    // Sort snapshots by date
    const sortedSnapshots = [...video.snapshots].sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );

    return sortedSnapshots.map(snapshot => ({
      date: new Date(snapshot.capturedAt).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      views: snapshot.views,
      likes: snapshot.likes,
      comments: snapshot.comments,
      shares: snapshot.shares || 0,
      timestamp: new Date(snapshot.capturedAt).getTime()
    }));
  }, [video.snapshots, video.views, video.likes, video.comments, video.shares, video.timestamp, video.dateSubmitted]);

  // Calculate total growth
  const totalGrowth = useMemo(() => {
    if (chartData.length < 2) {
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }

    const first = chartData[0];
    const last = chartData[chartData.length - 1];

    return {
      views: last.views - first.views,
      likes: last.likes - first.likes,
      comments: last.comments - first.comments,
      shares: last.shares - first.shares
    };
  }, [chartData]);

  // Calculate growth percentages
  const growthPercentages = useMemo(() => {
    if (chartData.length < 2) {
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }

    const first = chartData[0];
    const last = chartData[chartData.length - 1];

    return {
      views: first.views > 0 ? ((last.views - first.views) / first.views) * 100 : 0,
      likes: first.likes > 0 ? ((last.likes - first.likes) / first.likes) * 100 : 0,
      comments: first.comments > 0 ? ((last.comments - first.comments) / first.comments) * 100 : 0,
      shares: first.shares > 0 ? ((last.shares - first.shares) / first.shares) * 100 : 0
    };
  }, [chartData]);

  // Show current metrics when only one snapshot exists
  const showGrowth = chartData.length > 1;

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };


  const formatGrowth = (growth: number, percentage: number): string => {
    const sign = growth >= 0 ? '+' : '';
    const percentSign = percentage >= 0 ? '+' : '';
    return `${sign}${formatNumber(growth)} (${percentSign}${percentage.toFixed(1)}%)`;
  };

  const getGrowthColor = (growth: number): string => {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (growth < 0) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#161616] rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-4">
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-16 h-16 rounded-lg object-cover"
            />
            <div>
              <div className="flex items-center space-x-2">
                <PlatformIcon platform={video.platform} size="sm" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white line-clamp-2">
                  {video.title}
                </h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400">@{video.uploaderHandle}</p>
              <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span>Posted: {new Date(video.timestamp || video.dateSubmitted).toLocaleDateString()}</span>
                {video.lastRefreshed && (
                  <>
                    <span>•</span>
                    <span>Last updated: {new Date(video.lastRefreshed).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>


        {/* Performance Charts */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance Analytics</h3>
            {chartData.length === 1 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
                Initial Snapshot
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Total Views Chart */}
            <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">TOTAL VIEWS</p>
                  </div>
                </div>
              </div>
              
              <div className="mb-4">
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                  {formatNumber(video.views)}
                </div>
                {showGrowth && totalGrowth.views !== 0 && (
                  <div className={`flex items-center text-sm ${getGrowthColor(totalGrowth.views)}`}>
                    {getGrowthIcon(totalGrowth.views)}
                    <span className="ml-1">
                      {formatGrowth(totalGrowth.views, growthPercentages.views)}
                    </span>
                  </div>
                )}
                {!showGrowth && (
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <span>Starting point</span>
                  </div>
                )}
              </div>

              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-sm">
                              <p className="font-semibold">Views: {payload[0].value?.toLocaleString()}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '3 3' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="views" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      fill="url(#viewsGradient)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

              {/* Total Likes Chart */}
              <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                      <Heart className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">TOTAL LIKES</p>
                    </div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                    {formatNumber(video.likes)}
                  </div>
                  {showGrowth && totalGrowth.likes !== 0 && (
                    <div className={`flex items-center text-sm ${getGrowthColor(totalGrowth.likes)}`}>
                      {getGrowthIcon(totalGrowth.likes)}
                      <span className="ml-1">
                        {formatGrowth(totalGrowth.likes, growthPercentages.likes)}
                      </span>
                    </div>
                  )}
                  {!showGrowth && (
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <span>Starting point</span>
                    </div>
                  )}
                </div>

                <div className="h-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="likesGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area 
                        type="monotone" 
                        dataKey="likes" 
                        stroke="#10B981" 
                        strokeWidth={2}
                        fill="url(#likesGradient)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Total Comments Chart */}
              <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">TOTAL COMMENTS</p>
                    </div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                    {formatNumber(video.comments)}
                  </div>
                  {showGrowth && totalGrowth.comments !== 0 && (
                    <div className={`flex items-center text-sm ${getGrowthColor(totalGrowth.comments)}`}>
                      {getGrowthIcon(totalGrowth.comments)}
                      <span className="ml-1">
                        {formatGrowth(totalGrowth.comments, growthPercentages.comments)}
                      </span>
                    </div>
                  )}
                  {!showGrowth && (
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <span>Starting point</span>
                    </div>
                  )}
                </div>

                <div className="h-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="commentsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area 
                        type="monotone" 
                        dataKey="comments" 
                        stroke="#8B5CF6" 
                        strokeWidth={2}
                        fill="url(#commentsGradient)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Snapshot History */}
        {video.snapshots && video.snapshots.length > 0 && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Snapshot History</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-[#1A1A1A]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Views
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Likes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Comments
                    </th>
                    {video.platform === 'tiktok' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Shares
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-[#161616] divide-y divide-gray-200 dark:divide-gray-800">
                  {[...video.snapshots]
                    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
                    .map((snapshot, index) => (
                    <tr key={snapshot.id} className={index === 0 ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>
                            {new Date(snapshot.capturedAt).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {formatNumber(snapshot.views)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {formatNumber(snapshot.likes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {formatNumber(snapshot.comments)}
                      </td>
                      {video.platform === 'tiktok' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                          {formatNumber(snapshot.shares || 0)}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          snapshot.capturedBy === 'initial_upload' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {snapshot.capturedBy === 'initial_upload' ? 'Initial' : 'Refresh'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
  );
};

export default VideoAnalyticsModal;
