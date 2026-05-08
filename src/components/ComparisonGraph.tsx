import React, { useState, useMemo, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, BarChart2, Activity, Info } from 'lucide-react';
import { VideoSubmission } from '../types';
import DataAggregationService, { IntervalType } from '../services/DataAggregationService';
import DayVideosModal from './DayVideosModal';
import { generateSparklineData } from './kpi/kpiDataProcessing';
import { DateFilterType } from './DateRangeFilter';

interface ComparisonGraphProps {
  submissions: VideoSubmission[];
  granularity?: 'hour' | 'day' | 'week' | 'month' | 'year';
  dateRange?: { startDate: Date; endDate: Date }; // Optional: use filter's date range instead of deriving from submissions
  dateFilter?: DateFilterType; // Date filter type, used by generateSparklineData for PP comparisons
  onVideoClick?: (video: VideoSubmission) => void;
}

type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'videos';
type ChartType = 'line' | 'area' | 'bar';

// Metrics natively supported by generateSparklineData. 'engagement' is derived
// from per-interval likes/comments/views (matching UnifiedMetricsChart).
type SparkMetric = 'views' | 'likes' | 'comments' | 'shares' | 'videos';

const toSparkMetric = (m: MetricType): SparkMetric | null => {
  if (m === 'engagement') return null;
  return m;
};

const ComparisonGraph = React.memo<ComparisonGraphProps>(({ submissions, granularity = 'week', dateRange, dateFilter = 'all', onVideoClick }) => {
  const [metric1, setMetric1] = useState<MetricType>('views');
  const [metric2, setMetric2] = useState<MetricType>('likes');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [showTooltipInfo, setShowTooltipInfo] = useState(false);
  
  // Day Videos Modal state
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayVideos, setSelectedDayVideos] = useState<VideoSubmission[]>([]);

  // Format number for display
  const formatNumber = useCallback((num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  }, []);

  // Get metric label
  const getMetricLabel = useCallback((metric: MetricType): string => {
    switch (metric) {
      case 'views': return 'Views';
      case 'likes': return 'Likes';
      case 'comments': return 'Comments';
      case 'shares': return 'Shares';
      case 'engagement': return 'Engagement %';
      case 'videos': return 'Video Count';
    }
  }, []);

  // Handle clicking on a chart bar/point to see videos
  const handleChartClick = useCallback((data: any) => {
    if (!data || !data.activePayload || !data.activePayload[0]) return;

    const payload = data.activePayload[0].payload;
    const clickedDate = payload.date;
    const interval = payload.interval;

    if (!interval) return;

    // Filter videos for this interval
    const videosForInterval = submissions.filter(video => {
      const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
      return DataAggregationService.isDateInInterval(uploadDate, interval);
    });

    console.log('📊 Clicked chart interval:', {
      date: clickedDate,
      intervalType: interval.intervalType,
      videosCount: videosForInterval.length
    });

    setSelectedDate(clickedDate);
    setSelectedDayVideos(videosForInterval);
    setIsDayModalOpen(true);
  }, [submissions]);

  // Aggregate data by selected granularity using the SAME pipeline as the
  // unified chart / KPI cards (generateSparklineData). This handles snapshot-
  // delta growth per interval, new uploads in the period, and per-video caps —
  // far more accurate than summing lifetime video.views.
  const chartData = useMemo(() => {
    if (submissions.length === 0 && !dateRange) return [];

    const dateRangeStart = dateRange ? new Date(dateRange.startDate) : null;
    const dateRangeEnd = dateRange ? new Date(dateRange.endDate) : new Date();
    const intervalType = granularity as IntervalType;

    // Determine which underlying spark metrics we need. 'engagement' is derived
    // from likes+comments / views (matching UnifiedMetricsChart's formula).
    const needed = new Set<SparkMetric>();
    [metric1, metric2].forEach(m => {
      const sm = toSparkMetric(m);
      if (sm) needed.add(sm);
    });
    if (metric1 === 'engagement' || metric2 === 'engagement') {
      needed.add('views');
      needed.add('likes');
      needed.add('comments');
    }
    // Need *something* to provide the interval skeleton.
    if (needed.size === 0) needed.add('videos');

    const sparkResults: Partial<Record<SparkMetric, ReturnType<typeof generateSparklineData>>> = {};
    needed.forEach(metric => {
      sparkResults[metric] = generateSparklineData(
        metric,
        submissions,
        undefined,
        dateRangeStart,
        dateRangeEnd,
        dateFilter,
        intervalType
      );
    });

    const reference =
      sparkResults.views ||
      sparkResults.likes ||
      sparkResults.comments ||
      sparkResults.shares ||
      sparkResults.videos;
    if (!reference) return [];

    // Build a per-timestamp lookup for each metric so we can merge into the
    // recharts row shape. Match by timestamp (intervals share the same
    // skeleton, so this is a straight join).
    const valueAt = (m: MetricType, idx: number): number => {
      if (m === 'engagement') {
        const v = sparkResults.views?.data[idx]?.value || 0;
        const e = (sparkResults.likes?.data[idx]?.value || 0) + (sparkResults.comments?.data[idx]?.value || 0);
        return v > 0 ? (e / v) * 100 : 0;
      }
      const sm = toSparkMetric(m);
      if (!sm) return 0;
      return sparkResults[sm]?.data[idx]?.value || 0;
    };

    const data = reference.data.map((point, idx) => {
      const dateLabel = DataAggregationService.formatIntervalLabel(point.interval.startDate, intervalType);
      return {
        date: dateLabel,
        metric1: valueAt(metric1, idx),
        metric2: valueAt(metric2, idx),
        timestamp: point.timestamp,
        interval: point.interval,
      };
    });

    // For large date ranges (like "all time" or "ytd"), trim leading and trailing empty intervals
    // but keep empty intervals in between to show gaps in data
    if (data.length > 12) { // Only trim if we have more than 12 intervals (e.g., 12+ months)
      const firstDataIndex = data.findIndex(d => d.metric1 > 0 || d.metric2 > 0);
      const lastDataIndex = data.length - 1 - [...data].reverse().findIndex(d => d.metric1 > 0 || d.metric2 > 0);

      if (firstDataIndex !== -1 && lastDataIndex !== -1) {
        return data.slice(firstDataIndex, lastDataIndex + 1);
      }
    }

    return data;
  }, [submissions, metric1, metric2, granularity, dateRange, dateFilter]);

  // Metric colors - matching your theme
  const metric1Color = '#10b981'; // Emerald green for metric 1 (matches activity theme)
  const metric2Color = '#6b7280'; // Subtle gray for metric 2

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="backdrop-blur-xl text-content rounded-xl border border-border shadow-2xl"
          style={{
            backgroundColor: 'var(--surface-tertiary)',
            padding: '12px 16px'
          }}
        >
          <p className="text-sm font-semibold text-content mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs text-content-secondary">
                    {entry.dataKey === 'metric1' ? getMetricLabel(metric1) : getMetricLabel(metric2)}:
                  </span>
                </div>
                <span className="text-sm font-bold text-content">{formatNumber(entry.value)}</span>
              </div>
            ))}
          </div>
          {/* Click to expand hint */}
          <div className="mt-3 pt-3 border-t border-border-subtle text-center">
            <span className="text-[10px] text-content-muted uppercase tracking-wider">
              Click to view details
            </span>
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
      onClick: handleChartClick,
      style: { cursor: 'pointer' },
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
              stroke="var(--border)" 
              vertical={false}
            />
            <XAxis 
              dataKey="date" 
              stroke="var(--content-muted)" 
              tick={{ fill: 'var(--content-secondary)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
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
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ fill: 'var(--surface-hover)' }}
              wrapperStyle={{ zIndex: 9999, pointerEvents: 'none' }}
              position={{ y: -10 }}
              offset={20}
              isAnimationActive={false}
            />
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
              stroke="var(--border)" 
              vertical={false}
            />
            <XAxis 
              dataKey="date" 
              stroke="var(--content-muted)" 
              tick={{ fill: 'var(--content-secondary)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
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
            <Tooltip 
              content={<CustomTooltip />}
              wrapperStyle={{ zIndex: 9999, pointerEvents: 'none' }}
              position={{ y: -10 }}
              offset={20}
              isAnimationActive={false}
            />
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
              stroke="var(--border)" 
              vertical={false}
            />
            <XAxis 
              dataKey="date" 
              stroke="var(--content-muted)" 
              tick={{ fill: 'var(--content-secondary)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
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
            <Tooltip 
              content={<CustomTooltip />}
              wrapperStyle={{ zIndex: 9999, pointerEvents: 'none' }}
              position={{ y: -10 }}
              offset={20}
              isAnimationActive={false}
            />
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
      className="relative rounded-2xl backdrop-blur border border-border-subtle shadow-theme transition-all duration-300 overflow-hidden bg-surface-secondary"
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-6">
          {/* Title with Info Icon */}
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-content">Metrics</h3>
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltipInfo(true)}
                onMouseLeave={() => setShowTooltipInfo(false)}
                className="text-content-muted hover:text-content-secondary transition-colors"
              >
                <Info className="w-4 h-4" style={{ opacity: 0.5 }} />
              </button>
              
              {/* Info Tooltip */}
              {showTooltipInfo && (
                <div
                  className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] p-3 rounded-lg bg-surface-tertiary border border-border shadow-xl z-50"
                >
                  <p className="text-xs text-content-secondary leading-relaxed">
                    Compare two metrics side-by-side to analyze correlations and trends over time.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Metric Selectors + Chart Type Icons */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Metric 1 Dropdown */}
            <div 
              className="relative rounded-lg border border-emerald-500/30 transition-all cursor-pointer hover:border-emerald-500/40 bg-surface-tertiary"
              style={{
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
                  className="appearance-none bg-transparent text-content text-sm font-medium focus:outline-none cursor-pointer pr-2"
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
              className="relative rounded-lg border border-border transition-all cursor-pointer hover:border-border-strong bg-surface-tertiary"
              style={{
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
                  className="appearance-none bg-transparent text-content text-sm font-medium focus:outline-none cursor-pointer pr-2"
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
            <div className="h-6 w-px bg-border-subtle mx-1" />

            {/* Chart Type Icons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setChartType('bar')}
                className={`p-1.5 rounded-md transition-all ${
                  chartType === 'bar' 
                    ? 'bg-surface-hover text-content' 
                    : 'text-gray-500 hover:bg-surface-hover hover:text-content-secondary'
                }`}
                title="Bar Chart"
              >
                <BarChart2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`p-1.5 rounded-md transition-all ${
                  chartType === 'line' 
                    ? 'bg-surface-hover text-content' 
                    : 'text-gray-500 hover:bg-surface-hover hover:text-content-secondary'
                }`}
                title="Line Chart"
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setChartType('area')}
                className={`p-1.5 rounded-md transition-all ${
                  chartType === 'area' 
                    ? 'bg-surface-hover text-content' 
                    : 'text-gray-500 hover:bg-surface-hover hover:text-content-secondary'
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
          className="rounded-xl overflow-hidden bg-surface-secondary"
          style={{
            minHeight: '320px'
          }}
        >
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              {renderChart()}
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-content-muted text-sm">
              No data available for comparison
            </div>
          )}
        </div>
      </div>

      {/* Day Videos Modal */}
      {selectedDate && (
        <DayVideosModal
          isOpen={isDayModalOpen}
          onClose={() => {
            setIsDayModalOpen(false);
            setSelectedDate(null);
            setSelectedDayVideos([]);
          }}
          date={selectedDate}
          videos={selectedDayVideos}
          metricLabel={getMetricLabel(metric1)}
          onVideoClick={onVideoClick}
        />
      )}
    </div>
  );
});

ComparisonGraph.displayName = 'ComparisonGraph';

export default ComparisonGraph;
