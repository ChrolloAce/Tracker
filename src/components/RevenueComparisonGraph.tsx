import React, { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { TrendingUp, BarChart2, Activity, Info, DollarSign } from 'lucide-react';
import { RevenueTransaction } from '../types/revenue';
import { VideoSubmission } from '../types';
import DataAggregationService, { IntervalType } from '../services/DataAggregationService';

interface RevenueComparisonGraphProps {
  transactions: RevenueTransaction[];
  submissions?: VideoSubmission[];
  granularity?: 'day' | 'week' | 'month' | 'year';
  dateRange?: { startDate: Date; endDate: Date };
}

type RevenueMetric = 'revenue' | 'newSubs' | 'renewals' | 'churned' | 'trials' | 'refunds';
type EngagementMetric = 'views' | 'likes' | 'comments' | 'shares' | 'videos';
type MetricType = RevenueMetric | EngagementMetric;
type ChartType = 'line' | 'area' | 'bar';

const REVENUE_METRICS: { value: RevenueMetric; label: string }[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'newSubs', label: 'New Subscriptions' },
  { value: 'renewals', label: 'Renewals' },
  { value: 'churned', label: 'Cancellations' },
  { value: 'trials', label: 'Trials' },
  { value: 'refunds', label: 'Refunds' },
];

const ENGAGEMENT_METRICS: { value: EngagementMetric; label: string }[] = [
  { value: 'views', label: 'Views' },
  { value: 'likes', label: 'Likes' },
  { value: 'comments', label: 'Comments' },
  { value: 'shares', label: 'Shares' },
  { value: 'videos', label: 'Video Count' },
];

const RevenueComparisonGraph = React.memo<RevenueComparisonGraphProps>(({
  transactions,
  submissions = [],
  granularity = 'week',
  dateRange,
}) => {
  const [metric1, setMetric1] = useState<RevenueMetric>('revenue');
  const [metric2, setMetric2] = useState<MetricType>('views');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [showTooltipInfo, setShowTooltipInfo] = useState(false);

  const isRevenueMetric = (m: MetricType): m is RevenueMetric =>
    REVENUE_METRICS.some(rm => rm.value === m);

  const formatNumber = useCallback((num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  }, []);

  const formatCurrency = useCallback((cents: number): string => {
    const dollars = cents / 100;
    if (dollars >= 1000000) return `$${(dollars / 1000000).toFixed(1)}M`;
    if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}K`;
    if (dollars >= 1) return `$${dollars.toFixed(0)}`;
    return `$${dollars.toFixed(2)}`;
  }, []);

  const getMetricLabel = useCallback((metric: MetricType): string => {
    const all = [...REVENUE_METRICS, ...ENGAGEMENT_METRICS];
    return all.find(m => m.value === metric)?.label || metric;
  }, []);

  const formatMetricValue = useCallback((metric: MetricType, value: number): string => {
    if (metric === 'revenue' || metric === 'refunds') return formatCurrency(value);
    return formatNumber(value);
  }, [formatCurrency, formatNumber]);

  const getRevenueValue = useCallback((tx: RevenueTransaction, metric: RevenueMetric): number => {
    switch (metric) {
      case 'revenue':
        return (tx.type === 'refund') ? 0 : (tx.amount || 0);
      case 'newSubs':
        return (!tx.isRenewal && tx.type !== 'refund' && tx.type !== 'trial') ? 1 : 0;
      case 'renewals':
        return tx.isRenewal ? 1 : 0;
      case 'churned':
        return (tx.status === 'cancelled' || tx.status === 'expired') ? 1 : 0;
      case 'trials':
        return tx.isTrial ? 1 : 0;
      case 'refunds':
        return tx.type === 'refund' ? (tx.amount || 0) : 0;
      default:
        return 0;
    }
  }, []);

  const getEngagementValue = useCallback((video: VideoSubmission, metric: EngagementMetric): number => {
    switch (metric) {
      case 'views': return video.views || 0;
      case 'likes': return video.likes || 0;
      case 'comments': return video.comments || 0;
      case 'shares': return video.shares || 0;
      case 'videos': return 1;
      default: return 0;
    }
  }, []);

  const chartData = useMemo(() => {
    if (transactions.length === 0 && !dateRange) return [];

    let startDate: Date;
    let endDate: Date;

    if (dateRange) {
      startDate = new Date(dateRange.startDate);
      endDate = new Date(dateRange.endDate);
    } else {
      const txDates = transactions.map(t => new Date(t.purchaseDate).getTime());
      startDate = new Date(Math.min(...txDates));
      endDate = new Date(Math.max(...txDates));
    }

    const intervalType = granularity as IntervalType;
    const intervals = DataAggregationService.generateIntervals(
      { startDate, endDate },
      intervalType
    );

    const data = intervals.map(interval => {
      // Aggregate left metric (always revenue)
      let metric1Value = 0;
      transactions.forEach(tx => {
        const txDate = new Date(tx.purchaseDate);
        if (DataAggregationService.isDateInInterval(txDate, interval)) {
          metric1Value += getRevenueValue(tx, metric1);
        }
      });

      // Aggregate right metric (revenue or engagement)
      let metric2Value = 0;
      if (isRevenueMetric(metric2)) {
        transactions.forEach(tx => {
          const txDate = new Date(tx.purchaseDate);
          if (DataAggregationService.isDateInInterval(txDate, interval)) {
            metric2Value += getRevenueValue(tx, metric2);
          }
        });
      } else {
        submissions.forEach(video => {
          const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
          if (DataAggregationService.isDateInInterval(uploadDate, interval)) {
            metric2Value += getEngagementValue(video, metric2);
          }
        });
      }

      const dateLabel = DataAggregationService.formatIntervalLabel(interval.startDate, intervalType);

      return {
        date: dateLabel,
        metric1: metric1Value,
        metric2: metric2Value,
        timestamp: interval.timestamp,
      };
    });

    // Trim leading/trailing empty intervals for large ranges
    if (data.length > 12) {
      const firstDataIndex = data.findIndex(d => d.metric1 > 0 || d.metric2 > 0);
      const lastDataIndex = data.length - 1 - [...data].reverse().findIndex(d => d.metric1 > 0 || d.metric2 > 0);

      if (firstDataIndex !== -1 && lastDataIndex !== -1) {
        return data.slice(firstDataIndex, lastDataIndex + 1);
      }
    }

    return data;
  }, [transactions, submissions, metric1, metric2, granularity, dateRange, getRevenueValue, getEngagementValue]);

  // Colors
  const metric1Color = '#10b981'; // Emerald
  const metric2Color = '#6b7280'; // Gray

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="backdrop-blur-xl text-content rounded-xl border border-border shadow-2xl"
          style={{
            backgroundColor: 'var(--surface-tertiary)',
            padding: '12px 16px',
          }}
        >
          <p className="text-sm font-semibold text-content mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => {
              const metricKey = entry.dataKey === 'metric1' ? metric1 : metric2;
              return (
                <div key={index} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-xs text-content-secondary">
                      {getMetricLabel(metricKey)}:
                    </span>
                  </div>
                  <span className="text-sm font-bold text-content">
                    {formatMetricValue(metricKey, entry.value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  const formatYAxis = useCallback(
    (metric: MetricType) => (value: number) => {
      if (metric === 'revenue' || metric === 'refunds') return formatCurrency(value);
      return formatNumber(value);
    },
    [formatCurrency, formatNumber]
  );

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      style: { cursor: 'default' },
      margin: { top: 10, right: 40, left: 0, bottom: 5 },
    };

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <defs>
              <linearGradient id="revBarGradient1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric1Color} stopOpacity={1} />
                <stop offset="100%" stopColor={metric1Color} stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="revBarGradient2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric2Color} stopOpacity={1} />
                <stop offset="100%" stopColor={metric2Color} stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
              tickFormatter={formatYAxis(metric1)}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={metric2Color}
              tick={{ fill: metric2Color, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis(metric2)}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'var(--surface-hover)' }}
              wrapperStyle={{ zIndex: 9999, pointerEvents: 'none' }}
              position={{ y: -10 }}
              offset={20}
              isAnimationActive={false}
            />
            <Bar yAxisId="left" dataKey="metric1" fill="url(#revBarGradient1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar yAxisId="right" dataKey="metric2" fill="url(#revBarGradient2)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
              tickFormatter={formatYAxis(metric1)}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={metric2Color}
              tick={{ fill: metric2Color, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis(metric2)}
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
              <linearGradient id="revAreaGradient1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric1Color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={metric1Color} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="revAreaGradient2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric2Color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={metric2Color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
              tickFormatter={formatYAxis(metric1)}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={metric2Color}
              tick={{ fill: metric2Color, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis(metric2)}
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
              fill="url(#revAreaGradient1)"
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="metric2"
              stroke={metric2Color}
              strokeWidth={2.5}
              fill="url(#revAreaGradient2)"
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
          background: 'radial-gradient(ellipse at top, rgba(16, 185, 129, 0.03) 0%, transparent 50%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-6">
          {/* Title */}
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <h3 className="text-lg font-bold text-content">Revenue</h3>
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltipInfo(true)}
                onMouseLeave={() => setShowTooltipInfo(false)}
                className="text-content-muted hover:text-content-secondary transition-colors"
              >
                <Info className="w-4 h-4" style={{ opacity: 0.5 }} />
              </button>

              {showTooltipInfo && (
                <div
                  className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] p-3 rounded-lg bg-surface-tertiary border border-border shadow-xl z-50"
                >
                  <p className="text-xs text-content-secondary leading-relaxed">
                    Compare revenue metrics with content engagement to see how your videos drive subscriptions and revenue over time.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Dropdowns + Chart Type */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Left metric (Revenue) */}
            <div
              className="relative rounded-lg border border-emerald-500/30 transition-all cursor-pointer hover:border-emerald-500/40 bg-surface-tertiary"
              style={{
                padding: '6px 10px 6px 8px',
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: metric1Color }} />
                <select
                  value={metric1}
                  onChange={(e) => setMetric1(e.target.value as RevenueMetric)}
                  className="appearance-none bg-transparent text-content text-sm font-medium focus:outline-none cursor-pointer pr-2"
                  style={{ minWidth: '100px' }}
                >
                  {REVENUE_METRICS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right metric (Revenue or Engagement) */}
            <div
              className="relative rounded-lg border border-border transition-all cursor-pointer hover:border-border-strong bg-surface-tertiary"
              style={{
                padding: '6px 10px 6px 8px',
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: metric2Color }} />
                <select
                  value={metric2}
                  onChange={(e) => setMetric2(e.target.value as MetricType)}
                  className="appearance-none bg-transparent text-content text-sm font-medium focus:outline-none cursor-pointer pr-2"
                  style={{ minWidth: '100px' }}
                >
                  <optgroup label="Revenue">
                    {REVENUE_METRICS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </optgroup>
                  {submissions.length > 0 && (
                    <optgroup label="Engagement">
                      {ENGAGEMENT_METRICS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </optgroup>
                  )}
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
            minHeight: '320px',
          }}
        >
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              {renderChart()}
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px] flex flex-col items-center justify-center text-content-muted text-sm gap-2">
              <DollarSign className="w-8 h-8 text-content-muted/30" />
              <p>No revenue data available yet</p>
              <p className="text-xs text-content-muted">Transactions will appear here as they come in via webhooks</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

RevenueComparisonGraph.displayName = 'RevenueComparisonGraph';

export default RevenueComparisonGraph;
