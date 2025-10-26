import React, { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, BarChart2, Activity, Info } from 'lucide-react';
import { VideoSubmission } from '../types';
import DataAggregationService, { IntervalType } from '../services/DataAggregationService';

interface ComparisonGraphProps {
  submissions: VideoSubmission[];
  granularity?: 'day' | 'week' | 'month' | 'year';
  dateRange?: { startDate: Date; endDate: Date }; // Optional: use filter's date range instead of deriving from submissions
}

type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'videos';
type ChartType = 'line' | 'area' | 'bar';

const ComparisonGraph: React.FC<ComparisonGraphProps> = ({ submissions, granularity = 'week', dateRange }) => {
  console.log('🎨 ComparisonGraph rendering with', submissions.length, 'submissions', 'granularity:', granularity, 'dateRange:', dateRange);
  
  const [metric1, setMetric1] = useState<MetricType>('views');
  const [metric2, setMetric2] = useState<MetricType>('likes');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [showTooltipInfo, setShowTooltipInfo] = useState(false);

  // Format number for display
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  // Get metric value from video
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
      case 'videos':
        return 1;
      default:
        return 0;
    }
  };

  // Get metric label
  const getMetricLabel = (metric: MetricType): string => {
    switch (metric) {
      case 'views': return 'Views';
      case 'likes': return 'Likes';
      case 'comments': return 'Comments';
      case 'shares': return 'Shares';
      case 'engagement': return 'Engagement %';
      case 'videos': return 'Video Count';
    }
  };

  // Aggregate data by selected granularity
  const chartData = useMemo(() => {
    if (submissions.length === 0 && !dateRange) return [];
    
    // Determine date range: use provided dateRange or derive from submissions
    let startDate: Date;
    let endDate: Date;
    
    if (dateRange) {
      // Use the filter's date range to show full range even if no data
      startDate = new Date(dateRange.startDate);
      endDate = new Date(dateRange.endDate);
      console.log('📅 Using provided dateRange:', startDate.toLocaleDateString(), 'to', endDate.toLocaleDateString());
    } else {
      // Fallback: derive from submissions (old behavior)
      if (submissions.length === 0) return [];
      const dates = submissions.map(v => new Date(v.uploadDate || v.dateSubmitted).getTime());
      startDate = new Date(Math.min(...dates));
      endDate = new Date(Math.max(...dates));
      console.log('📅 Derived dateRange from submissions:', startDate.toLocaleDateString(), 'to', endDate.toLocaleDateString());
    }
    
    // Use granularity as interval type
    const intervalType = granularity as IntervalType;
    
    // Generate intervals using DataAggregationService
    const intervals = DataAggregationService.generateIntervals(
      { startDate, endDate },
      intervalType
    );
    
    // Aggregate data for each interval
    const data = intervals.map(interval => {
      let metric1Value = 0;
      let metric2Value = 0;
      
      submissions.forEach(video => {
        const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
        
        // Check if video is in this interval
        if (DataAggregationService.isDateInInterval(uploadDate, interval)) {
          metric1Value += getMetricValue(video, metric1);
          metric2Value += getMetricValue(video, metric2);
        }
      });
      
      // Format date label based on granularity
      const dateLabel = DataAggregationService.formatIntervalLabel(interval.startDate, intervalType);
      
      return {
        date: dateLabel,
        metric1: metric1Value,
        metric2: metric2Value,
        timestamp: interval.timestamp
      };
    });
    
    return data;
  }, [submissions, metric1, metric2, granularity, dateRange]);

  // Metric colors - matching your theme
  const metric1Color = '#10b981'; // Emerald green for metric 1 (matches activity theme)
  const metric2Color = '#6b7280'; // Subtle gray for metric 2

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div 
          className="backdrop-blur-xl text-white rounded-xl border shadow-2xl"
          style={{
            backgroundColor: 'rgba(26, 26, 26, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            padding: '12px 16px'
          }}
        >
          <p className="text-sm font-semibold text-white mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-sm" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs text-gray-300">
                    {entry.dataKey === 'metric1' ? getMetricLabel(metric1) : getMetricLabel(metric2)}:
                  </span>
                </div>
                <span className="text-sm font-bold text-white">{formatNumber(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Render chart based on type
  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 40, left: 0, bottom: 5 }
    };

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <defs>
              <linearGradient id="barGradient1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric1Color} stopOpacity={1} />
                <stop offset="100%" stopColor={metric1Color} stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric2Color} stopOpacity={1} />
                <stop offset="100%" stopColor={metric2Color} stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(255, 255, 255, 0.05)" 
              vertical={false}
            />
            <XAxis 
              dataKey="date" 
              stroke="rgba(255, 255, 255, 0.15)" 
              tick={{ fill: 'rgba(255, 255, 255, 0.4)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
            />
            <YAxis 
              yAxisId="left"
              stroke={metric1Color}
              tick={{ fill: metric1Color, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatNumber}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke={metric2Color}
              tick={{ fill: metric2Color, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatNumber}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }} />
            <Bar
              yAxisId="left"
              dataKey="metric1"
              fill="url(#barGradient1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
            <Bar
              yAxisId="right"
              dataKey="metric2"
              fill="url(#barGradient2)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        );
      
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(255, 255, 255, 0.05)" 
              vertical={false}
            />
            <XAxis 
              dataKey="date" 
              stroke="rgba(255, 255, 255, 0.15)" 
              tick={{ fill: 'rgba(255, 255, 255, 0.4)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
            />
            <YAxis 
              yAxisId="left"
              stroke={metric1Color}
              tick={{ fill: metric1Color, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatNumber}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke={metric2Color}
              tick={{ fill: metric2Color, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatNumber}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="metric1"
              stroke={metric1Color}
              strokeWidth={2.5}
              dot={{ fill: metric1Color, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: metric1Color, stroke: '#fff', strokeWidth: 2 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="metric2"
              stroke={metric2Color}
              strokeWidth={2.5}
              dot={{ fill: metric2Color, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: metric2Color, stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        );
      
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="gradient-metric1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric1Color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={metric1Color} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradient-metric2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric2Color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={metric2Color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(255, 255, 255, 0.05)" 
              vertical={false}
            />
            <XAxis 
              dataKey="date" 
              stroke="rgba(255, 255, 255, 0.15)" 
              tick={{ fill: 'rgba(255, 255, 255, 0.4)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
            />
            <YAxis 
              yAxisId="left"
              stroke={metric1Color}
              tick={{ fill: metric1Color, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatNumber}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke={metric2Color}
              tick={{ fill: metric2Color, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatNumber}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="metric1"
              stroke={metric1Color}
              strokeWidth={2.5}
              fill="url(#gradient-metric1)"
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="metric2"
              stroke={metric2Color}
              strokeWidth={2.5}
              fill="url(#gradient-metric2)"
            />
          </AreaChart>
        );
    }
  };

  return (
    <div 
      className="relative rounded-2xl backdrop-blur border shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
      style={{ 
        backgroundColor: 'rgba(18, 18, 20, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.05)'
      }}
    >
      {/* Subtle inner glow */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse at top, rgba(139, 92, 246, 0.03) 0%, transparent 50%)',
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 p-5">
        {/* Header - "Metrics" with Info Icon + Dropdowns on Right */}
        <div className="flex items-center justify-between mb-6">
          {/* Title with Info Icon */}
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white">Metrics</h3>
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltipInfo(true)}
                onMouseLeave={() => setShowTooltipInfo(false)}
                className="text-gray-500 hover:text-gray-400 transition-colors"
              >
                <Info className="w-4 h-4" style={{ opacity: 0.5 }} />
              </button>
              
              {/* Info Tooltip */}
              {showTooltipInfo && (
                <div 
                  className="absolute left-0 top-full mt-2 w-64 p-3 rounded-lg border shadow-xl z-50"
                  style={{
                    backgroundColor: 'rgba(26, 26, 26, 0.98)',
                    borderColor: 'rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Compare two metrics side-by-side to analyze correlations and trends over time.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Metric Selectors + Chart Type Icons */}
          <div className="flex items-center gap-2">
            {/* Metric 1 Dropdown */}
            <div 
              className="relative rounded-lg border transition-all cursor-pointer hover:border-emerald-500/40"
              style={{
                backgroundColor: 'rgba(18, 18, 20, 0.6)',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                padding: '6px 10px 6px 8px'
              }}
            >
              <div className="flex items-center gap-2">
                {/* Color indicator */}
                <div 
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: metric1Color }}
                />
                <select
                  value={metric1}
                  onChange={(e) => setMetric1(e.target.value as MetricType)}
                  className="appearance-none bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer pr-2"
                  style={{ minWidth: '100px' }}
                >
                  <option value="views">Views</option>
                  <option value="likes">Likes</option>
                  <option value="comments">Comments</option>
                  <option value="shares">Shares</option>
                  <option value="engagement">Engagement %</option>
                  <option value="videos">Video Count</option>
                </select>
              </div>
            </div>

            {/* Metric 2 Dropdown */}
            <div 
              className="relative rounded-lg border transition-all cursor-pointer hover:border-gray-500/40"
              style={{
                backgroundColor: 'rgba(18, 18, 20, 0.6)',
                borderColor: 'rgba(107, 114, 128, 0.3)',
                padding: '6px 10px 6px 8px'
              }}
            >
              <div className="flex items-center gap-2">
                {/* Color indicator */}
                <div 
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: metric2Color }}
                />
                <select
                  value={metric2}
                  onChange={(e) => setMetric2(e.target.value as MetricType)}
                  className="appearance-none bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer pr-2"
                  style={{ minWidth: '100px' }}
                >
                  <option value="views">Views</option>
                  <option value="likes">Likes</option>
                  <option value="comments">Comments</option>
                  <option value="shares">Shares</option>
                  <option value="engagement">Engagement %</option>
                  <option value="videos">Video Count</option>
                </select>
              </div>
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-white/10 mx-1" />

            {/* Chart Type Icons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setChartType('bar')}
                className={`p-1.5 rounded-md transition-all ${
                  chartType === 'bar' 
                    ? 'bg-white/15 text-white' 
                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-400'
                }`}
                title="Bar Chart"
              >
                <BarChart2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`p-1.5 rounded-md transition-all ${
                  chartType === 'line' 
                    ? 'bg-white/15 text-white' 
                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-400'
                }`}
                title="Line Chart"
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setChartType('area')}
                className={`p-1.5 rounded-md transition-all ${
                  chartType === 'area' 
                    ? 'bg-white/15 text-white' 
                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-400'
                }`}
                title="Area Chart"
              >
                <Activity className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Chart Area */}
        <div 
          className="rounded-xl overflow-hidden"
          style={{ 
            backgroundColor: 'rgba(10, 10, 12, 0.4)',
            minHeight: '320px'
          }}
        >
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              {renderChart()}
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-gray-500 text-sm">
              No data available for comparison
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComparisonGraph;
