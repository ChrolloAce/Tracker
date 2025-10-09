import React, { useMemo, useState } from 'react';
import { X, ExternalLink, TrendingUp, TrendingDown, Eye, Heart, MessageCircle, Share2, ChevronDown, Camera, RotateCcw } from 'lucide-react';
import { VideoSubmission } from '../types';
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
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

type MetricType = 'views' | 'likes' | 'comments' | 'shares';

const VideoAnalyticsModal: React.FC<VideoAnalyticsModalProps> = ({ video, isOpen, onClose }) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('views');
  const [secondaryMetric, setSecondaryMetric] = useState<MetricType | null>(null);

  // Reset function to restore original state
  const handleReset = () => {
    setSelectedMetric('views');
    setSecondaryMetric(null);
  };

  // Prepare chart data from snapshots - MUST be before early return
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!video) return [];
    
    // If no snapshots, create initial data point from current video stats
    if (!video.snapshots || video.snapshots.length === 0) {
      return [{
        date: new Date(video.timestamp || video.dateSubmitted).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric'
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
        day: 'numeric'
      }),
      views: snapshot.views,
      likes: snapshot.likes,
      comments: snapshot.comments,
      shares: snapshot.shares || 0,
      timestamp: new Date(snapshot.capturedAt).getTime()
    }));
  }, [video?.id, video?.snapshots?.length]);

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

  // Early return AFTER all hooks
  if (!isOpen || !video) return null;

  // Show current metrics when only one snapshot exists
  const showGrowth = chartData.length > 1;

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const formatGrowth = (growth: number, percentage: number): string => {
    const sign = growth >= 0 ? '+' : '';
    const percentSign = percentage >= 0 ? '+' : '';
    return `${sign}${formatNumber(growth)} (${percentSign}${percentage.toFixed(1)}%)`;
  };

  const getMetricColor = (metric: MetricType): string => {
    switch (metric) {
      case 'views': return '#B47CFF';
      case 'likes': return '#FF6B9D';
      case 'comments': return '#4ECDC4';
      case 'shares': return '#FFE66D';
      default: return '#B47CFF';
    }
  };

  const getMetricLabel = (metric: MetricType): string => {
    return metric.charAt(0).toUpperCase() + metric.slice(1);
  };

  const maxValue = Math.max(...chartData.map(d => d[selectedMetric]));
  const yAxisMax = Math.ceil(maxValue * 1.1);

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-[#151515] rounded-[14px] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-slideUp"
        style={{ padding: '24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-16 h-16 rounded-lg object-cover ring-2 ring-white/10"
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <PlatformIcon platform={video.platform} size="sm" />
                <h2 className="text-lg font-bold text-white line-clamp-1">
                  {video.title}
                </h2>
              </div>
              <p className="text-sm text-[#A1A1AA]">@{video.uploaderHandle}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-[#9B9B9B]">
                <span>Posted: {new Date(video.timestamp || video.dateSubmitted).toLocaleDateString()}</span>
                {video.lastRefreshed && (
                  <>
                    <span>•</span>
                    <span>Updated: {new Date(video.lastRefreshed).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              title="Reset to default view"
              className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Main Chart */}
        <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-6 mb-6">
          {/* Chart Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-white">Metrics</h3>
            <div className="flex items-center gap-3">
              {/* Primary Metric Selector */}
              <div className="relative">
                <select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
                  className="appearance-none pl-8 pr-10 py-2 bg-[#1E1E20] border border-gray-700/50 rounded-lg text-white text-sm font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ minWidth: '140px' }}
                >
                  <option value="views">Views</option>
                  <option value="likes">Likes</option>
                  <option value="comments">Comments</option>
                  <option value="shares">Shares</option>
                </select>
                <div 
                  className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3 h-3 rounded-sm pointer-events-none"
                  style={{ backgroundColor: getMetricColor(selectedMetric) }}
                />
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>

              {/* Secondary Metric Selector */}
              <div className="relative">
                <select
                  value={secondaryMetric || ''}
                  onChange={(e) => setSecondaryMetric(e.target.value ? e.target.value as MetricType : null)}
                  className="appearance-none pr-10 py-2 bg-[#1E1E20] border border-gray-700/50 rounded-lg text-sm font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ 
                    minWidth: '160px',
                    paddingLeft: secondaryMetric ? '32px' : '12px',
                    color: secondaryMetric ? '#ffffff' : '#9ca3af'
                  }}
                >
                  <option value="">+ Add comparison</option>
                  <option value="views">Views</option>
                  <option value="likes">Likes</option>
                  <option value="comments">Comments</option>
                  <option value="shares">Shares</option>
                </select>
                {secondaryMetric && (
                  <div 
                    className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3 h-3 rounded-sm pointer-events-none"
                    style={{ backgroundColor: getMetricColor(secondaryMetric) }}
                  />
                )}
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={getMetricColor(selectedMetric)} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={getMetricColor(selectedMetric)} stopOpacity={0}/>
                  </linearGradient>
                  {secondaryMetric && (
                    <linearGradient id="secondaryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={getMetricColor(secondaryMetric)} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={getMetricColor(secondaryMetric)} stopOpacity={0}/>
                    </linearGradient>
                  )}
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid 
                  strokeDasharray="0" 
                  stroke="rgba(255,255,255,0.03)" 
                  vertical={false}
                />
                <XAxis 
                  dataKey="date"
                  stroke="#CFCFCF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <YAxis 
                  stroke="#CFCFCF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickFormatter={(value) => formatNumber(value)}
                  domain={[0, yAxisMax]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-black/90 backdrop-blur-sm border border-white/10 px-3 py-2 rounded-lg shadow-xl">
                          {payload.map((entry, index) => (
                            <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
                              <div 
                                className="w-2 h-2 rounded-sm"
                                style={{ backgroundColor: entry.color }}
                              />
                              <p className="text-xs font-medium text-white">
                                {entry.name}: {entry.value?.toLocaleString()}
                              </p>
                            </div>
                          ))}
                          <p className="text-[10px] text-gray-400 mt-1">
                            {payload[0]?.payload?.date}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey={selectedMetric}
                  name={getMetricLabel(selectedMetric)}
                  stroke={getMetricColor(selectedMetric)}
                  strokeWidth={2.5}
                  fill="url(#primaryGradient)"
                  dot={{ 
                    r: 4, 
                    fill: getMetricColor(selectedMetric), 
                    strokeWidth: 2, 
                    stroke: '#151515'
                  }}
                  activeDot={{ 
                    r: 6, 
                    fill: getMetricColor(selectedMetric), 
                    strokeWidth: 2.5, 
                    stroke: '#fff',
                    filter: 'url(#glow)'
                  }}
                  animationDuration={800}
                  animationEasing="ease-in-out"
                />
                {secondaryMetric && (
                  <Area 
                    type="monotone" 
                    dataKey={secondaryMetric}
                    name={getMetricLabel(secondaryMetric)}
                    stroke={getMetricColor(secondaryMetric)}
                    strokeWidth={2}
                    fill="url(#secondaryGradient)"
                    dot={{ 
                      r: 3, 
                      fill: getMetricColor(secondaryMetric), 
                      strokeWidth: 1.5, 
                      stroke: '#151515'
                    }}
                    activeDot={{ 
                      r: 5, 
                      fill: getMetricColor(secondaryMetric), 
                      strokeWidth: 2, 
                      stroke: '#fff' 
                    }}
                    animationDuration={800}
                    animationEasing="ease-in-out"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Watermark */}
          <div className="text-right mt-4">
            <span className="text-xs text-white/20 font-medium">The Facecard App</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Views */}
          <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4 hover:border-[#B47CFF]/30 transition-all duration-300">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#B47CFF]/10 flex items-center justify-center">
                <Eye className="w-4 h-4 text-[#B47CFF]" />
              </div>
              <span className="text-xs text-[#A1A1AA] font-medium uppercase tracking-wider">Views</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {formatNumber(video.views)}
            </div>
            {showGrowth && totalGrowth.views !== 0 && (
              <div className={`flex items-center gap-1 text-xs ${totalGrowth.views > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalGrowth.views > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{formatGrowth(totalGrowth.views, growthPercentages.views)}</span>
              </div>
            )}
          </div>

          {/* Likes */}
          <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4 hover:border-[#FF6B9D]/30 transition-all duration-300">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#FF6B9D]/10 flex items-center justify-center">
                <Heart className="w-4 h-4 text-[#FF6B9D]" />
              </div>
              <span className="text-xs text-[#A1A1AA] font-medium uppercase tracking-wider">Likes</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {formatNumber(video.likes)}
            </div>
            {showGrowth && totalGrowth.likes !== 0 && (
              <div className={`flex items-center gap-1 text-xs ${totalGrowth.likes > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalGrowth.likes > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{formatGrowth(totalGrowth.likes, growthPercentages.likes)}</span>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4 hover:border-[#4ECDC4]/30 transition-all duration-300">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#4ECDC4]/10 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-[#4ECDC4]" />
              </div>
              <span className="text-xs text-[#A1A1AA] font-medium uppercase tracking-wider">Comments</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {formatNumber(video.comments)}
            </div>
            {showGrowth && totalGrowth.comments !== 0 && (
              <div className={`flex items-center gap-1 text-xs ${totalGrowth.comments > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalGrowth.comments > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{formatGrowth(totalGrowth.comments, growthPercentages.comments)}</span>
              </div>
            )}
          </div>

          {/* Shares */}
          <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4 hover:border-[#FFE66D]/30 transition-all duration-300">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#FFE66D]/10 flex items-center justify-center">
                <Share2 className="w-4 h-4 text-[#FFE66D]" />
              </div>
              <span className="text-xs text-[#A1A1AA] font-medium uppercase tracking-wider">Shares</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {formatNumber(video.shares || 0)}
            </div>
            {showGrowth && totalGrowth.shares !== 0 && (
              <div className={`flex items-center gap-1 text-xs ${totalGrowth.shares > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalGrowth.shares > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{formatGrowth(totalGrowth.shares, growthPercentages.shares)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Snapshots List */}
        {video.snapshots && video.snapshots.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="w-5 h-5 text-white/60" />
              <h3 className="text-base font-bold text-white">
                Snapshots ({video.snapshots.length})
              </h3>
            </div>
            <div className="bg-[#1A1A1A] border border-white/5 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">
                        Captured By
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">
                        Views
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">
                        Likes
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">
                        Comments
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">
                        Shares
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {video.snapshots
                      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
                      .map((snapshot, index) => {
                        const capturedByLabel = 
                          snapshot.capturedBy === 'initial_upload' ? 'Initial Upload' :
                          snapshot.capturedBy === 'manual_refresh' ? 'Manual Refresh' :
                          snapshot.capturedBy === 'scheduled_refresh' ? 'Scheduled Refresh' :
                          'System';
                        
                        return (
                          <tr 
                            key={snapshot.id || index}
                            className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-4 py-3 text-sm text-white/80">
                              {new Date(snapshot.capturedAt).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                snapshot.capturedBy === 'initial_upload' ? 'bg-blue-500/10 text-blue-400' :
                                snapshot.capturedBy === 'manual_refresh' ? 'bg-purple-500/10 text-purple-400' :
                                snapshot.capturedBy === 'scheduled_refresh' ? 'bg-green-500/10 text-green-400' :
                                'bg-gray-500/10 text-gray-400'
                              }`}>
                                {capturedByLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-white/90 text-right font-medium">
                              {formatNumber(snapshot.views)}
                            </td>
                            <td className="px-4 py-3 text-sm text-white/90 text-right font-medium">
                              {formatNumber(snapshot.likes)}
                            </td>
                            <td className="px-4 py-3 text-sm text-white/90 text-right font-medium">
                              {formatNumber(snapshot.comments)}
                            </td>
                            <td className="px-4 py-3 text-sm text-white/90 text-right font-medium">
                              {formatNumber(snapshot.shares || 0)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoAnalyticsModal;
