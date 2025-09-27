import React, { useMemo } from 'react';
import { X, ExternalLink, TrendingUp, TrendingDown, Calendar, Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import { VideoSubmission } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
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
    if (!video.snapshots || video.snapshots.length === 0) {
      return [];
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
  }, [video.snapshots]);

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

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const formatNumberForChart = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
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
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-16 h-16 rounded-lg object-cover"
            />
            <div>
              <div className="flex items-center space-x-2">
                <PlatformIcon platform={video.platform} size="sm" />
                <h2 className="text-xl font-semibold text-gray-900 line-clamp-2">
                  {video.title}
                </h2>
              </div>
              <p className="text-gray-600">@{video.uploaderHandle}</p>
              <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                <span>Posted: {new Date(video.timestamp || video.dateSubmitted).toLocaleDateString()}</span>
                <span>•</span>
                <span>Snapshots: {video.snapshots?.length || 0}</span>
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

        {/* Current Metrics */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Performance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Eye className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">Views</span>
              </div>
              <p className="text-2xl font-bold text-blue-900 mt-1">{formatNumber(video.views)}</p>
              {totalGrowth.views !== 0 && (
                <div className={`flex items-center space-x-1 mt-1 ${getGrowthColor(totalGrowth.views)}`}>
                  {getGrowthIcon(totalGrowth.views)}
                  <span className="text-sm font-medium">
                    {formatGrowth(totalGrowth.views, growthPercentages.views)}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Heart className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium text-red-600">Likes</span>
              </div>
              <p className="text-2xl font-bold text-red-900 mt-1">{formatNumber(video.likes)}</p>
              {totalGrowth.likes !== 0 && (
                <div className={`flex items-center space-x-1 mt-1 ${getGrowthColor(totalGrowth.likes)}`}>
                  {getGrowthIcon(totalGrowth.likes)}
                  <span className="text-sm font-medium">
                    {formatGrowth(totalGrowth.likes, growthPercentages.likes)}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-600">Comments</span>
              </div>
              <p className="text-2xl font-bold text-green-900 mt-1">{formatNumber(video.comments)}</p>
              {totalGrowth.comments !== 0 && (
                <div className={`flex items-center space-x-1 mt-1 ${getGrowthColor(totalGrowth.comments)}`}>
                  {getGrowthIcon(totalGrowth.comments)}
                  <span className="text-sm font-medium">
                    {formatGrowth(totalGrowth.comments, growthPercentages.comments)}
                  </span>
                </div>
              )}
            </div>

            {video.platform === 'tiktok' && (
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Share2 className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-600">Shares</span>
                </div>
                <p className="text-2xl font-bold text-purple-900 mt-1">{formatNumber(video.shares || 0)}</p>
                {totalGrowth.shares !== 0 && (
                  <div className={`flex items-center space-x-1 mt-1 ${getGrowthColor(totalGrowth.shares)}`}>
                    {getGrowthIcon(totalGrowth.shares)}
                    <span className="text-sm font-medium">
                      {formatGrowth(totalGrowth.shares, growthPercentages.shares)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Performance Charts */}
        {chartData.length > 1 && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Over Time</h3>
            
            {/* Views Chart */}
            <div className="mb-8">
              <h4 className="text-md font-medium text-gray-700 mb-3">Views Growth</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={formatNumberForChart}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatNumber(value), 'Views']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="views" 
                      stroke="#3B82F6" 
                      fill="#3B82F6" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Engagement Chart */}
            <div className="mb-8">
              <h4 className="text-md font-medium text-gray-700 mb-3">Engagement Growth</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={formatNumberForChart}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [formatNumber(value), name]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="likes" 
                      stroke="#EF4444" 
                      strokeWidth={2}
                      name="Likes"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="comments" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      name="Comments"
                    />
                    {video.platform === 'tiktok' && (
                      <Line 
                        type="monotone" 
                        dataKey="shares" 
                        stroke="#8B5CF6" 
                        strokeWidth={2}
                        name="Shares"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Snapshot History */}
        {video.snapshots && video.snapshots.length > 0 && (
          <div className="p-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Snapshot History</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Views
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Likes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comments
                    </th>
                    {video.platform === 'tiktok' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Shares
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {[...video.snapshots]
                    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
                    .map((snapshot, index) => (
                    <tr key={snapshot.id} className={index === 0 ? 'bg-blue-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>
                            {new Date(snapshot.capturedAt).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(snapshot.views)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(snapshot.likes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(snapshot.comments)}
                      </td>
                      {video.platform === 'tiktok' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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

        {/* No Data State */}
        {(!video.snapshots || video.snapshots.length === 0) && (
          <div className="p-6 text-center">
            <div className="text-gray-400 mb-4">
              <Calendar className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Historical Data</h3>
            <p className="text-gray-600">
              This video doesn't have any snapshots yet. Click "Refresh All" to start tracking performance over time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoAnalyticsModal;
