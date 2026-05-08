import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Eye, Heart, MessageCircle, Share2, TrendingUp, Bookmark, ChevronDown, Calendar, Zap } from 'lucide-react';
import '../styles/no-select.css';

type TimeFrame = '7d' | '30d' | '90d' | 'all';

interface ChartDataPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
  timestamp: number;
  snapshotIndex: number;
}

interface VideoHistoricalMetricsChartProps {
  data: ChartDataPoint[];
  cumulativeTotals: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    engagementRate: number;
  };
  /** When set, the line/area is split: blue (organic) up to this point,
   *  pink/orange (ads) after. A vertical reference marker is drawn at
   *  the boundary with a ⚡ Sparked label. */
  sparkedAt?: Date;
  /** Ad-view total (organic + this = real total). When >0 AND the
   *  selected metric is views, the headline tile renders a small
   *  "⚡ +N ad" stat beneath the organic number. */
  sparkAdViews?: number;
}

type MetricKey = 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'engagementRate';

interface MetricConfig {
  key: MetricKey;
  label: string;
  icon: React.ElementType;
  color: string;
  formatValue: (value: number) => string;
}

const metrics: MetricConfig[] = [
  {
    key: 'views',
    label: 'Views',
    icon: Eye,
    color: '#22c55e', // Green for all
    formatValue: (value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'likes',
    label: 'Likes',
    icon: Heart,
    color: '#22c55e', // Green for all
    formatValue: (value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'comments',
    label: 'Comments',
    icon: MessageCircle,
    color: '#22c55e', // Green for all
    formatValue: (value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'shares',
    label: 'Shares',
    icon: Share2,
    color: '#22c55e', // Green for all
    formatValue: (value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'saves',
    label: 'Bookmarks',
    icon: Bookmark,
    color: '#22c55e', // Green for all
    formatValue: (value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'engagementRate',
    label: 'Engagement',
    icon: TrendingUp,
    color: '#22c55e', // Green for all
    formatValue: (value) => `${value.toFixed(1)}%`,
  },
];

const timeFrameOptions: { value: TimeFrame; label: string; days: number | null }[] = [
  { value: '7d', label: 'Last 7 Days', days: 7 },
  { value: '30d', label: 'Last 30 Days', days: 30 },
  { value: '90d', label: 'Last 90 Days', days: 90 },
  { value: 'all', label: 'All Time', days: null },
];

type Granularity = 'auto' | 'daily' | 'weekly' | 'monthly';
const granularityOptions: { value: Granularity; label: string }[] = [
  { value: 'auto',    label: 'Auto' },
  { value: 'daily',   label: 'Day' },
  { value: 'weekly',  label: 'Week' },
  { value: 'monthly', label: 'Month' },
];

type ViewMode = 'cumulative' | 'gained';
const viewModeOptions: { value: ViewMode; label: string }[] = [
  { value: 'cumulative', label: 'Cumulative' },
  { value: 'gained',     label: 'Gained' },
];

export const VideoHistoricalMetricsChart: React.FC<VideoHistoricalMetricsChartProps> = ({ data, cumulativeTotals, sparkedAt, sparkAdViews }) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('views');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('7d'); // Default to Last 7 Days instead of All Time
  const [granularity, setGranularity] = useState<Granularity>('auto');
  const [viewMode, setViewMode] = useState<ViewMode>('gained');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isTimeFrameDropdownOpen, setIsTimeFrameDropdownOpen] = useState(false);

  const currentMetric = metrics.find(m => m.key === selectedMetric) || metrics[0];
  const currentTimeFrame = timeFrameOptions.find(t => t.value === timeFrame) || timeFrameOptions[3];

  // Per-snapshot deltas, computed against the FULL data array so the
  // first in-window point still gets a real delta (against the
  // snapshot before the timeframe cutoff). Negative deltas — rare,
  // usually a platform recount glitch — clamp to 0. Engagement rate
  // is a ratio, not a count, so its "delta" stores the actual rate.
  const dataWithDeltas = useMemo(() => {
    return data.map((point, i) => {
      if (i === 0) {
        return {
          ...point,
          views_delta: 0,
          likes_delta: 0,
          comments_delta: 0,
          shares_delta: 0,
          saves_delta: 0,
          engagementRate_delta: point.engagementRate,
        };
      }
      const prev = data[i - 1];
      return {
        ...point,
        views_delta: Math.max(0, point.views - prev.views),
        likes_delta: Math.max(0, point.likes - prev.likes),
        comments_delta: Math.max(0, point.comments - prev.comments),
        shares_delta: Math.max(0, point.shares - prev.shares),
        saves_delta: Math.max(0, point.saves - prev.saves),
        engagementRate_delta: point.engagementRate,
      };
    });
  }, [data]);

  // Filter data based on time frame
  const filteredData = useMemo(() => {
    if (!currentTimeFrame.days || dataWithDeltas.length === 0) return dataWithDeltas;

    const cutoffDate = Date.now() - (currentTimeFrame.days * 24 * 60 * 60 * 1000);
    return dataWithDeltas.filter(d => d.timestamp >= cutoffDate);
  }, [dataWithDeltas, currentTimeFrame.days]);

  // Auto-transform data based on time frame (Daily, Weekly, or Monthly)
  const transformedData = useMemo(() => {
    if (filteredData.length === 0) return filteredData;

    // Manual granularity wins; otherwise auto-derive from the data span.
    let transformer: 'daily' | 'weekly' | 'monthly' = 'daily';
    if (granularity === 'auto') {
      const firstTimestamp = filteredData[0].timestamp;
      const lastTimestamp = filteredData[filteredData.length - 1].timestamp;
      const daySpan = (lastTimestamp - firstTimestamp) / (1000 * 60 * 60 * 24);
      if (daySpan > 180) transformer = 'monthly';
      else if (daySpan > 60) transformer = 'weekly';
    } else {
      transformer = granularity;
    }

    // If daily or not enough data points, return as-is
    if (transformer === 'daily' || filteredData.length <= 3) {
      return filteredData;
    }

    // Group data by week or month
    const grouped: Map<string, ChartDataPoint[]> = new Map();
    
    filteredData.forEach(point => {
      const date = new Date(point.timestamp);
      let key: string;
      
      if (transformer === 'weekly') {
        // Group by week (start of week)
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay()); // Sunday
        startOfWeek.setHours(0, 0, 0, 0);
        key = startOfWeek.toISOString().split('T')[0];
      } else {
        // Group by month
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(point);
    });

    // Aggregate grouped data: cumulative fields take the LAST snapshot
    // in the bucket (latest running total), but delta fields SUM across
    // the bucket so weekly/monthly bars show the period's full gain
    // rather than just the final day's gain.
    const aggregated: ChartDataPoint[] = Array.from(grouped.entries()).map(([key, points]) => {
      const lastPoint: any = points[points.length - 1];
      const sumKey = (k: string) => points.reduce((s, p: any) => s + (p[k] || 0), 0);

      return {
        ...lastPoint,
        views_delta: sumKey('views_delta'),
        likes_delta: sumKey('likes_delta'),
        comments_delta: sumKey('comments_delta'),
        shares_delta: sumKey('shares_delta'),
        saves_delta: sumKey('saves_delta'),
        engagementRate_delta: lastPoint.engagementRate,
        date: transformer === 'weekly'
          ? `Week of ${key}`
          : new Date(key + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        timestamp: lastPoint.timestamp,
        snapshotIndex: points[0].snapshotIndex
      };
    });

    // Sort by timestamp
    return aggregated.sort((a, b) => a.timestamp - b.timestamp);
  }, [filteredData, timeFrame, selectedMetric, granularity]);

  // Spark split: clone the metric's value into two parallel keys —
  // `<metric>_organic` populated up to and INCLUDING the boundary,
  // `<metric>_ad` populated FROM the boundary onward. Sharing the
  // boundary point in both keys is what makes the blue and pink
  // segments visually meet (otherwise recharts leaves a gap because
  // each series starts/ends at a different x). Pre-boundary points
  // are organic-only; post-boundary points are ad-only.
  const deltaKey = `${selectedMetric}_delta`;
  // Engagement rate is a ratio per snapshot — "gained per period" is
  // meaningless for it, so always plot the cumulative value regardless
  // of view mode. Other metrics honor the user's toggle.
  const valueKey =
    selectedMetric === 'engagementRate'
      ? selectedMetric
      : viewMode === 'gained' ? deltaKey : selectedMetric;

  const sparkData = useMemo(() => {
    if (!sparkedAt || transformedData.length === 0) return transformedData;
    const sparkTime = sparkedAt.getTime();
    let boundaryIdx = transformedData.findIndex(p => p.timestamp >= sparkTime);
    if (boundaryIdx === -1) boundaryIdx = transformedData.length - 1;

    // Walk forward accumulating the post-spark delta into adCumul so
    // each snapshot knows BOTH its organic and sparked cumulative
    // counts. Tooltip uses these to show a 3-row breakdown
    // (Organic / Sparked / Total) instead of a single number.
    let adCumul = 0;
    return transformedData.map((p, i) => {
      const v = (p as any)[valueKey];
      const periodDelta = (p as any)[deltaKey] || 0;
      const isPostSpark = i >= boundaryIdx;
      const adDelta = isPostSpark ? periodDelta : 0;
      const organicDelta = isPostSpark ? 0 : periodDelta;
      adCumul += adDelta;
      const totalCumul = (p as any)[selectedMetric] || 0;
      return {
        ...p,
        [`${valueKey}_organic`]: i <= boundaryIdx ? v : null,
        [`${valueKey}_ad`]: i >= boundaryIdx ? v : null,
        _adCumul: adCumul,
        _organicCumul: Math.max(0, totalCumul - adCumul),
        _adDelta: adDelta,
        _organicDelta: organicDelta,
      };
    });
  }, [transformedData, sparkedAt, valueKey, deltaKey, selectedMetric]);

  const isSparked = !!sparkedAt && transformedData.length > 0;
  const organicKey = `${valueKey}_organic`;
  const adKey = `${valueKey}_ad`;

  // Y-axis max — scales to whatever the chart actually plots
  // (deltas in 'gained' mode, cumulative totals in 'cumulative' mode).
  const maxValue = useMemo(() => {
    if (transformedData.length === 0) return 100;
    const values = transformedData.map((d: any) => d[valueKey] || 0);
    return Math.max(...values, 10);
  }, [transformedData, valueKey]);

  // Sum of deltas across the visible window — drives the
  // "+X gained in this period" subtitle so the headline tells you
  // both the running total AND what changed in the selected range.
  const gainedInPeriod = useMemo(() => {
    if (selectedMetric === 'engagementRate') return 0;
    return transformedData.reduce((s, d: any) => s + (d[deltaKey] || 0), 0);
  }, [transformedData, deltaKey, selectedMetric]);

  const formatNum = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  // Get cumulative total for selected metric
  const totalValue = useMemo(() => {
    return cumulativeTotals[selectedMetric];
  }, [cumulativeTotals, selectedMetric]);

  // Format total value for display
  const formattedTotal = useMemo(() => {
    if (selectedMetric === 'engagementRate') {
      return `${totalValue.toFixed(1)}%`;
    }
    if (totalValue >= 1000000) {
      return `${(totalValue / 1000000).toFixed(1)}M`;
    }
    if (totalValue >= 1000) {
      return `${(totalValue / 1000).toFixed(1)}K`;
    }
    return totalValue.toLocaleString();
  }, [totalValue, selectedMetric]);

  // Tooltip — in spark mode, shows a 3-row breakdown (Organic /
  // Sparked / Total) so the user sees exactly how much of the
  // value at this snapshot came from each source. Otherwise shows
  // the standard "primary value + secondary line" layout.
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dataPoint = payload[0].payload;
    const isRate = selectedMetric === 'engagementRate';
    const isGainedMode = viewMode === 'gained' && !isRate;

    const fmt = (v: number) =>
      isRate ? `${v.toFixed(1)}%` : v.toLocaleString();
    const fmtGain = (v: number) =>
      isRate ? `${v.toFixed(1)}%` : `+${v.toLocaleString()}`;

    // Spark mode: 3-row breakdown.
    if (isSparked && !isRate) {
      const organicVal = isGainedMode
        ? (dataPoint._organicDelta ?? 0)
        : (dataPoint._organicCumul ?? 0);
      const adVal = isGainedMode
        ? (dataPoint._adDelta ?? 0)
        : (dataPoint._adCumul ?? 0);
      const totalVal = organicVal + adVal;
      const formatter = isGainedMode ? fmtGain : fmt;

      return (
        <div className="rounded-lg border border-border shadow-xl p-3 min-w-[220px] bg-surface-tertiary">
          <div className="text-xs text-content-muted mb-2">{dataPoint.date}</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
                <span className="text-xs text-content-muted">Organic</span>
              </div>
              <span className="text-sm font-bold text-content tabular-nums">
                {formatter(organicVal)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ec4899' }} />
                <span className="text-xs text-content-muted">Sparked</span>
              </div>
              <span className="text-sm font-bold text-content tabular-nums">
                {formatter(adVal)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-border-subtle">
              <span className="text-[11px] text-content-muted font-semibold uppercase tracking-wider">Total</span>
              <span className="text-sm font-bold text-content tabular-nums">
                {formatter(totalVal)}
              </span>
            </div>
          </div>
        </div>
      );
    }

    // Non-spark mode: single-value layout with secondary line.
    const baseVal = dataPoint[valueKey] ?? 0;
    const cumulative = dataPoint[selectedMetric] ?? 0;
    const delta = dataPoint[deltaKey] ?? 0;
    const primaryDisplay = isGainedMode ? fmtGain(baseVal) : fmt(baseVal);
    const primaryLabel = isGainedMode ? `${currentMetric.label} gained` : currentMetric.label;
    const secondaryLabel = isGainedMode ? 'Total to date' : 'Gained this period';
    const secondaryValue = isGainedMode ? fmt(cumulative) : fmtGain(delta);

    return (
      <div className="rounded-lg border border-border shadow-xl p-3 min-w-[200px] bg-surface-tertiary">
        <div className="text-xs text-content-muted mb-2">{dataPoint.date}</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
              <span className="text-xs text-content-muted">{primaryLabel}</span>
            </div>
            <span className="text-sm font-bold text-content tabular-nums">
              {primaryDisplay}
            </span>
          </div>
          {!isRate && (
            <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-border-subtle">
              <span className="text-[11px] text-content-muted">{secondaryLabel}</span>
              <span className="text-xs font-semibold text-content-secondary tabular-nums">
                {secondaryValue}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className="relative rounded-2xl border border-border-subtle shadow-theme overflow-hidden bg-surface-secondary" style={{ height: '400px' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-content-muted text-sm mb-2">No historical data available</div>
            <div className="text-content-muted text-xs">Snapshots will appear as data is collected</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border border-border-subtle shadow-theme overflow-hidden select-none bg-surface-secondary" style={{ userSelect: 'none' }}>
      {/* Header with Title and Selectors */}
      <div className="relative px-6 pt-5 pb-3 flex items-center justify-between border-b border-border-subtle" style={{ zIndex: 100 }}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-surface-hover border border-border-subtle">
            <TrendingUp className="w-4 h-4 text-content-muted" />
          </div>
          <h3 className="text-base font-semibold text-content">
            Performance Over Time
          </h3>
        </div>

        {/* Selectors: Time Frame + Metric */}
        <div className="flex items-center gap-2.5">
          {/* Time Frame Selector */}
          <div className="relative z-30">
            <button
              onClick={() => setIsTimeFrameDropdownOpen(!isTimeFrameDropdownOpen)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border transition-all outline-none focus:outline-none ${isTimeFrameDropdownOpen ? 'bg-surface-tertiary border-border-strong' : 'bg-surface-hover border-border'}`}
            >
              <Calendar className="w-3.5 h-3.5 text-content-muted" />
              <span className="text-sm font-semibold text-content">{currentTimeFrame.label}</span>
              <ChevronDown
                className={`w-4 h-4 text-content-muted transition-transform duration-200 ${isTimeFrameDropdownOpen ? 'rotate-180' : ''}`} 
              />
            </button>

            {/* Time Frame Dropdown Menu */}
            {isTimeFrameDropdownOpen && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0"
                  style={{ zIndex: 9999 }}
                  onClick={() => setIsTimeFrameDropdownOpen(false)}
                />
                
                {/* Menu */}
                <div
                  className="absolute right-0 mt-2 w-48 rounded-xl border border-border shadow-2xl overflow-hidden bg-surface-secondary"
                  style={{
                    zIndex: 10000,
                  }}
                >
                  {timeFrameOptions.map((option) => {
                    const isSelected = timeFrame === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTimeFrame(option.value);
                          setIsTimeFrameDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-all outline-none focus:outline-none ${isSelected ? 'bg-surface-hover' : 'hover:bg-surface-hover'}`}
                      >
                        <span className="text-sm font-medium text-content flex-1 text-left">
                          {option.label}
                        </span>
                        {isSelected && (
                          <div className="w-1.5 h-1.5 rounded-full bg-content" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Metric Selector Dropdown */}
          <div className="relative z-30">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border transition-all outline-none focus:outline-none ${isDropdownOpen ? 'bg-surface-tertiary border-border-strong' : 'bg-surface-hover border-border'}`}
          >
            <span className="text-sm font-semibold text-content">{currentMetric.label}</span>
            <ChevronDown
              className={`w-4 h-4 text-content-muted transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0"
                style={{ zIndex: 9999 }}
                onClick={() => setIsDropdownOpen(false)}
              />
              
              {/* Menu */}
              <div
                className="absolute right-0 mt-2 w-48 rounded-xl border border-border shadow-2xl overflow-hidden bg-surface-secondary"
                style={{
                  zIndex: 10000,
                }}
              >
                {metrics.map((metric) => {
                  const isSelected = selectedMetric === metric.key;
                  return (
                    <button
                      key={metric.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMetric(metric.key);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-all outline-none focus:outline-none ${isSelected ? 'bg-surface-hover' : 'hover:bg-surface-hover'}`}
                    >
                      <span className="text-sm font-medium text-content flex-1 text-left">
                        {metric.label}
                      </span>
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-content" />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {/* Sub-controls strip — secondary display preferences as compact
          segmented pills. View mode toggles between cumulative running
          totals and per-period gains; granularity overrides the auto
          bucketing. Pulled out of the header so the top row stays
          readable when the modal narrows. */}
      <div className="px-6 py-2.5 flex items-center justify-end gap-2 flex-wrap border-b border-border-subtle">
        {selectedMetric !== 'engagementRate' && (
          <div className="inline-flex items-center bg-surface-hover rounded-lg p-0.5 border border-border-subtle">
            {viewModeOptions.map((opt) => {
              const isActive = viewMode === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setViewMode(opt.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    isActive
                      ? 'bg-surface text-content shadow-sm'
                      : 'text-content-muted hover:text-content'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
        <div className="inline-flex items-center bg-surface-hover rounded-lg p-0.5 border border-border-subtle">
          {granularityOptions.map((opt) => {
            const isActive = granularity === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setGranularity(opt.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  isActive
                    ? 'bg-surface text-content shadow-sm'
                    : 'text-content-muted hover:text-content'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Headline tile — right-aligned. Big number is the running
          total (Organic when Sparked, otherwise the metric total).
          Sparked amount sits as plain text to the LEFT of the big
          number — no pill, no background, just the number and label. */}
      <div className="px-6 pt-4 pb-3 flex items-end justify-end gap-4 border-b border-border-subtle">
        {selectedMetric === 'views' && sparkAdViews !== undefined && sparkAdViews > 0 && (
          <div className="inline-flex items-center gap-1 text-pink-400 text-xs font-semibold tabular-nums mb-1.5">
            <Zap className="w-3 h-3" />
            +{formatNum(sparkAdViews)} sparked
          </div>
        )}
        <div className="text-right">
          <div className="text-[10px] text-content-muted mb-0.5 font-semibold tracking-wider uppercase">
            {selectedMetric === 'views' && sparkAdViews !== undefined && sparkAdViews > 0
              ? 'Organic Views'
              : `Total ${currentMetric.label}`}
          </div>
          <div className="text-3xl font-bold tracking-tight text-content tabular-nums">
            {formattedTotal}
          </div>
          {gainedInPeriod > 0 && selectedMetric !== 'engagementRate' && (
            <div className="text-[11px] text-emerald-500 font-semibold mt-0.5 tabular-nums">
              +{formatNum(gainedInPeriod)} in {currentTimeFrame.label.toLowerCase()}
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="relative px-2 py-4" style={{ height: '420px' }}>
        {/* Empty-state overlay — when the selected timeframe has no
            snapshots, keep the chart shell visible (axes/grid render
            empty) and layer a friendly message on top so the user can
            tell their selection took effect and switch back. */}
        {transformedData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="text-center px-6 py-4 rounded-xl bg-surface-tertiary/80 border border-border-subtle backdrop-blur-sm">
              <div className="text-content text-sm font-semibold mb-1">No data in this period</div>
              <div className="text-content-muted text-xs">Try a wider time frame</div>
            </div>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={isSparked ? sparkData : transformedData}
            margin={{ top: 16, right: 32, left: 8, bottom: 5 }}
          >
            <defs>
              <linearGradient id={`gradient-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
              </linearGradient>
              {/* Pink gradient for the post-Spark (ads) segment. */}
              <linearGradient id={`gradient-${selectedMetric}-ad`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ec4899" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#ec4899" stopOpacity={0.05} />
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
              tick={{ fill: 'var(--content-secondary)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
              tickMargin={10}
              minTickGap={50}
              interval="preserveStartEnd"
            />
            
            <YAxis 
              stroke="var(--content-muted)"
              tick={{ fill: 'var(--content-secondary)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
              dx={-5}
              tickFormatter={(value) => {
                if (selectedMetric === 'engagementRate') {
                  return `${value.toFixed(0)}%`;
                }
                if (value >= 1000000) {
                  return `${(value / 1000000).toFixed(1)}M`;
                }
                if (value >= 1000) {
                  return `${(value / 1000).toFixed(1)}K`;
                }
                return value.toString();
              }}
              domain={[
                0,
                selectedMetric === 'engagementRate'
                  ? Math.max(maxValue * 1.2, 1)
                  : Math.ceil(maxValue * 1.1),
              ]}
            />
            
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ 
                stroke: '#3b82f6', 
                strokeWidth: 2, 
                strokeDasharray: '5 5',
                strokeOpacity: 0.8
              }}
              animationDuration={0}
              isAnimationActive={false}
              allowEscapeViewBox={{ x: false, y: true }}
              wrapperStyle={{ outline: 'none', pointerEvents: 'none' }}
            />
            
            {isSparked ? (
              <>
                {/* Organic segment — blue, up to (and including) sparkedAt. */}
                <Area
                  type="monotone"
                  dataKey={organicKey}
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fill={`url(#gradient-${selectedMetric})`}
                  fillOpacity={1}
                  connectNulls={false}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5, stroke: 'var(--surface-secondary)', style: { cursor: 'pointer' } }}
                  activeDot={{ r: 7, fill: '#3b82f6', stroke: 'var(--surface-secondary)', strokeWidth: 2, style: { cursor: 'pointer' } }}
                  isAnimationActive={true}
                  animationDuration={300}
                />
                {/* Ad segment — pink, after sparkedAt. */}
                <Area
                  type="monotone"
                  dataKey={adKey}
                  stroke="#ec4899"
                  strokeWidth={3}
                  fill={`url(#gradient-${selectedMetric}-ad)`}
                  fillOpacity={1}
                  connectNulls={false}
                  dot={{ fill: '#ec4899', strokeWidth: 2, r: 5, stroke: 'var(--surface-secondary)', style: { cursor: 'pointer' } }}
                  activeDot={{ r: 7, fill: '#ec4899', stroke: 'var(--surface-secondary)', strokeWidth: 2, style: { cursor: 'pointer' } }}
                  isAnimationActive={true}
                  animationDuration={300}
                />
                {/* Vertical marker at the Spark moment with a ⚡ Sparked label. */}
                <ReferenceLine
                  x={(() => {
                    // Find the closest data-point's `date` string so the
                    // marker lands on the X axis category recharts knows.
                    const sparkTime = sparkedAt!.getTime();
                    let closest = sparkData[0];
                    let minDelta = Math.abs(closest.timestamp - sparkTime);
                    for (const p of sparkData) {
                      const d = Math.abs(p.timestamp - sparkTime);
                      if (d < minDelta) { closest = p; minDelta = d; }
                    }
                    return closest.date;
                  })()}
                  stroke="#ec4899"
                  strokeDasharray="4 3"
                  strokeWidth={2}
                  label={{
                    value: '⚡ Sparked',
                    position: 'top',
                    fill: '#ec4899',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />
              </>
            ) : (
              <Area
                type="monotone"
                dataKey={valueKey}
                stroke="#3b82f6"
                strokeWidth={3}
                fill={`url(#gradient-${selectedMetric})`}
                fillOpacity={1}
                dot={{
                  fill: '#3b82f6',
                  strokeWidth: 2,
                  r: 5,
                  stroke: 'var(--surface-secondary)',
                  style: { cursor: 'pointer' }
                }}
                activeDot={{
                  r: 7,
                  fill: '#3b82f6',
                  stroke: 'var(--surface-secondary)',
                  strokeWidth: 2,
                  style: { cursor: 'pointer' }
                }}
                isAnimationActive={true}
                animationDuration={300}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Watermark */}
      <div 
        className="absolute bottom-4 right-6 text-xs font-semibold tracking-wider opacity-10 pointer-events-none text-content"
      >
        viewtrack.app
      </div>
    </div>
  );
};

