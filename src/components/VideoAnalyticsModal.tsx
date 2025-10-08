import React, { useMemo, useState, useEffect, useRef } from 'react';
import { X, ExternalLink, TrendingUp, TrendingDown, Eye, Heart, MessageCircle, Share2, ChevronDown } from 'lucide-react';
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
  const modalRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !video) return null;

  // Prepare chart data from snapshots
  const chartData = useMemo((): ChartDataPoint[] => {
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div 
        ref={modalRef}
        className="bg-[#151515] rounded-[14px] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-slideUp"
        style={{ padding: '24px' }}
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
        <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-6 mb-6 relative">
          {/* Chart Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">Metrics</h3>
            <div className="flex items-center gap-3">
              {/* Primary Metric Selector */}
              <div className="relative">
                <div 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-2.5 h-2.5 rounded-sm pointer-events-none z-10"
                  style={{ backgroundColor: getMetricColor(selectedMetric) }}
                />
                <select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
                  className="appearance-none pl-7 pr-8 py-2 bg-[#1E1E20] border border-gray-700/50 rounded-full text-white text-sm font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/20 shadow-inner"
                  style={{ minWidth: '110px' }}
                >
                  <option value="views">Views</option>
                  <option value="likes">Likes</option>
                  <option value="comments">Comments</option>
                  <option value="shares">Shares</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>

              {/* Secondary Metric Selector */}
              <div className="relative">
                {secondaryMetric && (
                  <div 
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-2.5 h-2.5 rounded-sm pointer-events-none z-10"
                    style={{ backgroundColor: getMetricColor(secondaryMetric) }}
                  />
                )}
                <select
                  value={secondaryMetric || ''}
                  onChange={(e) => setSecondaryMetric(e.target.value ? e.target.value as MetricType : null)}
                  className={`appearance-none ${secondaryMetric ? 'pl-7' : 'pl-3'} pr-8 py-2 bg-[#1E1E20] border border-gray-700/50 rounded-full text-sm font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/20 shadow-inner ${secondaryMetric ? 'text-white' : 'text-gray-400'}`}
                  style={{ minWidth: '140px' }}
                >
                  <option value="">Add secondary</option>
                  <option value="views">Views</option>
                  <option value="likes">Likes</option>
                  <option value="comments">Comments</option>
                  <option value="shares">Shares</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-80 relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={getMetricColor(selectedMetric)} stopOpacity={0.5}/>
                    <stop offset="50%" stopColor={getMetricColor(selectedMetric)} stopOpacity={0.2}/>
                    <stop offset="100%" stopColor={getMetricColor(selectedMetric)} stopOpacity={0}/>
                  </linearGradient>
                  {secondaryMetric && (
                    <linearGradient id="secondaryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={getMetricColor(secondaryMetric)} stopOpacity={0.4}/>
                      <stop offset="50%" stopColor={getMetricColor(secondaryMetric)} stopOpacity={0.15}/>
                      <stop offset="100%" stopColor={getMetricColor(secondaryMetric)} stopOpacity={0}/>
                    </linearGradient>
                  )}
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <filter id="lineGlow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid 
                  strokeDasharray="0" 
                  stroke="rgba(255,255,255,0.04)" 
                  vertical={false}
                  horizontal={true}
                />
                <XAxis 
                  dataKey="date"
                  stroke="#6B7280"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tick={{ fill: '#9CA3AF' }}
                />
                <YAxis 
                  stroke="#6B7280"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickFormatter={(value) => formatNumber(value)}
                  domain={[0, yAxisMax]}
                  tick={{ fill: '#CFCFCF' }}
                  width={45}
                />
                <Tooltip
                  cursor={{ stroke: getMetricColor(selectedMetric), strokeWidth: 1.5, strokeOpacity: 0.3, strokeDasharray: '4 4' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-black/95 backdrop-blur-md border border-white/20 px-3 py-2.5 rounded-lg shadow-2xl">
                          {payload.map((entry, index) => (
                            <div key={index} className="flex items-center gap-2 mb-1.5 last:mb-0">
                              <div 
                                className="w-2.5 h-2.5 rounded-sm shadow-lg"
                                style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}` }}
                              />
                              <p className="text-xs font-semibold text-white">
                                {entry.name}: <span className="font-bold">{entry.value?.toLocaleString()}</span>
                              </p>
                            </div>
                          ))}
                          <p className="text-[10px] text-gray-400 mt-1.5 pt-1.5 border-t border-white/10">
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
                  dot={false}
                  activeDot={{ 
                    r: 6, 
                    fill: getMetricColor(selectedMetric), 
                    strokeWidth: 3, 
                    stroke: '#fff',
                    filter: 'url(#glow)',
                    style: { cursor: 'pointer' }
                  }}
                  animationDuration={1000}
                  animationEasing="ease-in-out"
                  style={{ filter: 'url(#lineGlow)' }}
                />
                {secondaryMetric && (
                  <Area 
                    type="monotone" 
                    dataKey={secondaryMetric}
                    name={getMetricLabel(secondaryMetric)}
                    stroke={getMetricColor(secondaryMetric)}
                    strokeWidth={2}
                    fill="url(#secondaryGradient)"
                    dot={false}
                    activeDot={{ 
                      r: 5, 
                      fill: getMetricColor(secondaryMetric), 
                      strokeWidth: 2.5, 
                      stroke: '#fff',
                      filter: 'url(#glow)',
                      style: { cursor: 'pointer' }
                    }}
                    animationDuration={1000}
                    animationEasing="ease-in-out"
                    style={{ filter: 'url(#lineGlow)' }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
            
            {/* Watermark - positioned over chart area */}
            <div className="absolute bottom-4 right-8 pointer-events-none">
              <span className="text-xs text-white/15 font-medium tracking-wider">viral.app</span>
            </div>
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
      </div>
    </div>
  );
};

export default VideoAnalyticsModal;
