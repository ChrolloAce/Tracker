import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Info, Plus, X, Settings as SettingsIcon, BarChart2, TrendingUp, Activity, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { VideoSubmission } from '../types';
import { LinkClick } from '../services/LinkClicksService';
import DataAggregationService from '../services/DataAggregationService';
import { DateFilterType } from './DateRangeFilter';
import { generateSparklineData, computeKPITotals } from './kpi/kpiDataProcessing';
import DayVideosModal from './DayVideosModal';

export type UnifiedMetricId =
  | 'videos'
  | 'accounts'
  | 'views'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'saves'
  | 'linkClicks'
  | 'revenue'
  | 'engagement';

interface UnifiedMetricsChartProps {
  submissions: VideoSubmission[];
  /** All submissions (unfiltered) — used for previous-period comparison, matches KPI cards. */
  allSubmissions?: VideoSubmission[];
  /** Tracked-link clicks, used for the Link Clicks metric. */
  linkClicks?: LinkClick[];
  /** Per-date revenue (key = YYYY-MM-DD). When provided, the Revenue metric
   *  shows up in the picker — typically wired to Superwall / RevenueCat. Use
   *  this for single-revenue-type setups; use `revenueByDateByOption` to wire
   *  multiple revenue series at once. */
  revenueByDate?: Record<string, number>;
  /** Per-option, per-date revenue maps. When provided alongside multi-select
   *  state, the chart renders one series per selected option (each with its
   *  own line/bar + own color + own row in the tooltip). */
  revenueByDateByOption?: Record<string, Record<string, number>>;
  /** Optional revenue-type submenu. When provided, hovering the Revenue chip in
   *  the metric strip reveals a popover listing these options (gross/net/MRR/etc.).
   *  `valueType` controls how the value is rendered in the tooltip / chip / axis:
   *  currency → "$1.2K", percentage → "12.5%", number → "1.2K". Defaults to
   *  currency when omitted (back-compat). */
  revenueOptions?: { key: string; label: string; valueType?: 'currency' | 'percentage' | 'number' }[];
  /** Single-select revenue API (back-compat). The popover behaves like a
   *  radio when only this is wired. */
  selectedRevenueOption?: string;
  onRevenueOptionChange?: (key: string) => void;
  /** Multi-select revenue API. Wire this (alongside `revenueByDateByOption`)
   *  to let the user toggle multiple revenue types on at once — each becomes
   *  its own series in the chart. Takes precedence over the single-select
   *  props when provided. */
  selectedRevenueOptions?: string[];
  onRevenueOptionsChange?: (keys: string[]) => void;
  /** Subset of revenue keys whose data is currently being fetched. Each
   *  matching chip shimmers + the chart skeleton fires while the list is
   *  non-empty. Lets a freshly-toggled option avoid the "shows $0 for a
   *  beat" gap before its parallel fetch lands. */
  pendingRevenueKeys?: string[];
  /** Active date filter — drives the same KPI sparkline aggregation logic. */
  dateFilter: DateFilterType;
  granularity?: 'day' | 'week' | 'month' | 'year';
  dateRange?: { startDate: Date; endDate: Date };
  onVideoClick?: (video: VideoSubmission) => void;
  /** When true, the chart performs an extra "merge in" entrance animation. */
  isMerging?: boolean;
  /** When true, the chart body is replaced with an animated bar-shimmer
   *  skeleton that sits inside the chart container (metric strip + toolbar
   *  stay visible). Use this for partial reloads — e.g. swapping the active
   *  Revenue type — so the page doesn't feel like it's reloading whole. */
  isLoading?: boolean;
  /** Brand text rendered as a faint watermark behind the chart. */
  watermark?: string;
  /** Initial chip selection (uncontrolled). Defaults to videos + views.
   *  RevenuePage overrides to revenue + views so the chart opens already
   *  showing what the page is about. */
  initialMetrics?: UnifiedMetricId[];
  /** Org's default reporting view from settings/general. Drives the
   *  initial state of the inline Organic / Total pill. 'split' falls
   *  back to 'total' here since this aggregate chart can't render two
   *  view series cleanly without a redesign — the per-video chart still
   *  honors the split default. */
  orgDefaultReportingView?: 'organic' | 'total' | 'split';
}

type ChartType = 'bar-line' | 'line' | 'area' | 'bars-only';

const METRIC_ORDER: UnifiedMetricId[] = [
  'videos',
  'accounts',
  'views',
  'likes',
  'comments',
  'shares',
  'saves',
  'linkClicks',
  'revenue',
  'engagement',
];

const METRIC_LABELS: Record<UnifiedMetricId, string> = {
  videos: 'Posted Videos',
  accounts: 'Active Accounts',
  views: 'Views',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  saves: 'Saves',
  linkClicks: 'Link Clicks',
  revenue: 'Revenue',
  engagement: 'Engagement %',
};

// Reference design palette: coral primary + sky-blue secondary, then a clean
// rotation for additional metrics.
const SERIES_COLORS = [
  '#fb8a4a', // coral / orange — bars (primary)
  '#5fa8f5', // sky blue — line  (secondary)
  '#10b981', // emerald
  '#a78bfa', // violet
  '#f472b6', // pink
  '#f59e0b', // amber
  '#22d3ee', // cyan
  '#facc15', // yellow
  '#fb7185', // rose
];

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

function formatCurrency(num: number): string {
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

type SparkMetric = 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'videos' | 'accounts';

/**
 * Map a unified-chart metric to the metric understood by `generateSparklineData`
 * (the same helper KPI cards use). Engagement and linkClicks are derived
 * separately — engagement from likes/comments/views, linkClicks from a
 * different data source.
 */
function toSparkMetric(m: UnifiedMetricId): SparkMetric | null {
  if (m === 'engagement') return null;
  if (m === 'linkClicks') return null;
  if (m === 'revenue') return null;
  return m;
}

/**
 * Animated chart-shaped skeleton. A row of bars rises from the baseline with
 * staggered shimmer + a soft pulse on each, then a thin animated line draws
 * across the top — gives the user a "chart is loading" feel inside the chart
 * container itself instead of a generic spinner that makes the page feel like
 * it's reloading whole.
 *
 * Heights are deterministic (seeded from index) so the silhouette stays stable
 * across re-renders rather than jumping around between frames.
 */
const ChartSkeleton: React.FC<{ height?: number; bars?: number }> = ({ height = 380, bars = 28 }) => {
  // Deterministic pseudo-random heights. Stable across renders so the skeleton
  // doesn't reshuffle while loading.
  const seeded = (i: number) => {
    const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  const heights = Array.from({ length: bars }, (_, i) => {
    const r = seeded(i);
    // Bias toward the middle 30%–90% of the chart height so it reads as a chart
    // silhouette, not a flatline.
    return 30 + r * 60;
  });

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height }}
      aria-label="Chart loading"
      role="status"
    >
      {/* Bars — flex row across the bottom. Each bar pulses on its own stagger
          via inline animationDelay so the shimmer reads as a wave. */}
      <div className="absolute inset-x-0 bottom-0 top-0 flex items-end gap-[2px] px-4 pb-6">
        {heights.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-orange-500/15 dark:bg-orange-500/20 chart-skeleton-bar"
            style={{
              height: `${h}%`,
              animationDelay: `${(i * 60) % 1800}ms`,
            }}
          />
        ))}
      </div>

      {/* Drawn line on top — a thin orange path that sweeps left-to-right. */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d={(() => {
            const pts = heights.map((h, i) => {
              const x = (i / (heights.length - 1)) * 100;
              const y = 100 - h * 0.85 - 8;
              return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
            });
            return pts.join(' ');
          })()}
          fill="none"
          stroke="rgb(251, 138, 74)"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="chart-skeleton-line"
        />
      </svg>

      {/* Subtle "Loading" label — small, centered, low priority. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="px-3 py-1.5 rounded-full bg-surface/80 backdrop-blur-sm border border-border-subtle text-[11px] font-semibold text-content-muted flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          Loading chart…
        </div>
      </div>

      <style>{`
        @keyframes chartSkelBar {
          0%, 100% { opacity: 0.55; transform: scaleY(1); }
          50%      { opacity: 1;    transform: scaleY(1.08); }
        }
        .chart-skeleton-bar {
          transform-origin: bottom;
          animation: chartSkelBar 1.6s ease-in-out infinite;
        }
        @keyframes chartSkelLine {
          0%   { stroke-dasharray: 0 1000; opacity: 0; }
          15%  { opacity: 1; }
          100% { stroke-dasharray: 1000 0; opacity: 1; }
        }
        .chart-skeleton-line {
          animation: chartSkelLine 2.4s ease-out infinite;
        }
      `}</style>
    </div>
  );
};

const UnifiedMetricsChart = React.memo<UnifiedMetricsChartProps>(
  ({
    submissions,
    allSubmissions,
    linkClicks,
    revenueByDate,
    revenueByDateByOption,
    revenueOptions,
    selectedRevenueOption,
    onRevenueOptionChange,
    selectedRevenueOptions,
    onRevenueOptionsChange,
    pendingRevenueKeys,
    dateFilter,
    granularity = 'day',
    dateRange,
    onVideoClick,
    isMerging = false,
    isLoading = false,
    watermark = 'viewtrack.app',
    initialMetrics,
    orgDefaultReportingView,
  }) => {
    const [selectedMetrics, setSelectedMetrics] = useState<UnifiedMetricId[]>(
      initialMetrics ?? ['videos', 'views']
    );
    // Reporting view — session-only override of the org default. 'split' is
    // not a meaningful state for this aggregate chart, so it falls back to
    // 'organic' here (matches the org-wide default). Initialized once from
    // props; subsequent org-default changes don't clobber a user's manual flip.
    const [reportingView, setReportingView] = useState<'organic' | 'total'>(
      orgDefaultReportingView === 'total' ? 'total' : 'organic'
    );
    const [chartType, setChartType] = useState<ChartType>('bar-line');
    const [aggregation, setAggregation] = useState<'daily' | 'cumulative'>('daily');
    // 'normalized' (default): each series scaled to 0–100% of its own max so
    // every metric tells its story regardless of magnitude.
    // 'absolute': raw values, dual y-axes (large metrics dominate).
    const [chartScale, setChartScale] = useState<'normalized' | 'absolute'>('normalized');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showInfoTip, setShowInfoTip] = useState(false);

    const [isDayModalOpen, setIsDayModalOpen] = useState(false);
    const [selectedInterval, setSelectedInterval] = useState<any | null>(null);

    const addMenuRef = useRef<HTMLDivElement | null>(null);
    const settingsMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      const onClick = (e: MouseEvent) => {
        if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
          setIsAddOpen(false);
        }
        if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
          setIsSettingsOpen(false);
        }
      };
      document.addEventListener('mousedown', onClick);
      return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const availableToAdd = useMemo(
      () =>
        METRIC_ORDER.filter(m => !selectedMetrics.includes(m)).filter(m => {
          // Hide Revenue from the picker unless a revenue source is connected.
          if (m === 'revenue') return !!revenueByDate;
          return true;
        }),
      [selectedMetrics, revenueByDate]
    );

    // Resolved revenue selections. Multi-select API takes precedence; if only
    // single-select props are wired, we wrap into a 1-element array so the
    // rest of the component treats them uniformly.
    const effectiveRevenueKeys: string[] = useMemo(() => {
      if (selectedRevenueOptions && selectedRevenueOptions.length > 0) return selectedRevenueOptions;
      if (selectedRevenueOption) return [selectedRevenueOption];
      return [];
    }, [selectedRevenueOptions, selectedRevenueOption]);
    const isMultiRevenueMode = !!selectedRevenueOptions;

    // First active option, used for back-compat formatting when revenue is
    // selected as a single chip (not yet expanded into N composite series).
    const primaryRevenueOpt = useMemo(
      () => revenueOptions?.find(o => o.key === effectiveRevenueKeys[0]),
      [revenueOptions, effectiveRevenueKeys],
    );

    // Per-key option lookup, used by formatters and labels.
    const revenueOptByKey = useMemo(() => {
      const m = new Map<string, { key: string; label: string; valueType?: 'currency' | 'percentage' | 'number' }>();
      for (const opt of revenueOptions ?? []) m.set(opt.key, opt);
      return m;
    }, [revenueOptions]);

    /** Format a metric's value. Revenue ids are either plain `'revenue'` (the
     *  single-mode chip) or composite `'revenue:<key>'` (one per option in
     *  multi-mode). Both routes resolve a valueType so percentages/counts
     *  don't get rendered as dollars. */
    const formatMetric = useCallback((id: string, value: number): string => {
      if (id === 'engagement') return `${value.toFixed(1)}%`;
      if (id === 'revenue' || id.startsWith('revenue:')) {
        const key = id.startsWith('revenue:') ? id.slice('revenue:'.length) : effectiveRevenueKeys[0];
        const opt = key ? revenueOptByKey.get(key) : undefined;
        const vt = opt?.valueType ?? primaryRevenueOpt?.valueType ?? 'currency';
        if (vt === 'percentage') return `${value.toFixed(1)}%`;
        if (vt === 'number')     return formatNumber(value);
        return formatCurrency(value);
      }
      return formatNumber(value);
    }, [primaryRevenueOpt, revenueOptByKey, effectiveRevenueKeys]);

    /** Resolve the human-readable label for an id, including composite revenue ids. */
    const labelFor = useCallback((id: string): string => {
      if (id.startsWith('revenue:')) {
        const key = id.slice('revenue:'.length);
        return revenueOptByKey.get(key)?.label ?? 'Revenue';
      }
      return METRIC_LABELS[id as UnifiedMetricId] ?? id;
    }, [revenueOptByKey]);

    const addMetric = (m: UnifiedMetricId) => {
      if (selectedMetrics.length >= 6) return;
      setSelectedMetrics(prev => [...prev, m]);
      // Re-adding Revenue after the user removed all of its option chips:
      // restore at least one option so the chip strip has something to show.
      if (m === 'revenue' && isMultiRevenueMode && effectiveRevenueKeys.length === 0 && onRevenueOptionsChange) {
        const fallback = revenueOptions?.[0]?.key ?? 'grossRevenue';
        onRevenueOptionsChange([fallback]);
      }
      setIsAddOpen(false);
    };

    const removeMetric = (m: UnifiedMetricId) => {
      setSelectedMetrics(prev => (prev.length > 1 ? prev.filter(x => x !== m) : prev));
    };

    /** Flat list of chip IDs in render order. In multi-revenue mode, the
     *  single 'revenue' entry in selectedMetrics expands into one composite
     *  id per selected option ('revenue:grossRevenue', 'revenue:newUsers',
     *  etc.) so each becomes its own draggable card. */
    const expandedChips = useMemo<string[]>(() => {
      const out: string[] = [];
      for (const m of selectedMetrics) {
        if (m === 'revenue' && isMultiRevenueMode && effectiveRevenueKeys.length > 0) {
          for (const k of effectiveRevenueKeys) out.push(`revenue:${k}`);
        } else {
          out.push(m);
        }
      }
      return out;
    }, [selectedMetrics, isMultiRevenueMode, effectiveRevenueKeys]);

    /** Decode a reorder of the flat chip list back into the (metrics, revenue
     *  keys) split. Position of the first 'revenue:*' chip in the new order
     *  becomes the position of 'revenue' in selectedMetrics. */
    const handleChipReorder = useCallback((next: string[]) => {
      const newMetrics: UnifiedMetricId[] = [];
      const newRevKeys: string[] = [];
      let revenueInserted = false;
      for (const id of next) {
        if (id.startsWith('revenue:')) {
          newRevKeys.push(id.slice('revenue:'.length));
          if (!revenueInserted) {
            newMetrics.push('revenue');
            revenueInserted = true;
          }
        } else {
          newMetrics.push(id as UnifiedMetricId);
        }
      }
      setSelectedMetrics(newMetrics);
      if (isMultiRevenueMode && onRevenueOptionsChange && newRevKeys.length > 0) {
        onRevenueOptionsChange(newRevKeys);
      }
    }, [isMultiRevenueMode, onRevenueOptionsChange]);

    /** Remove a single revenue option chip. If it was the last one, the
     *  whole Revenue metric drops out of the strip — re-add via the +Add
     *  picker, which restores 'grossRevenue' (or whatever the parent picks). */
    const removeRevenueOption = useCallback((key: string) => {
      const remaining = effectiveRevenueKeys.filter(k => k !== key);
      if (remaining.length === 0) {
        setSelectedMetrics(prev => prev.filter(x => x !== 'revenue'));
      } else if (onRevenueOptionsChange) {
        onRevenueOptionsChange(remaining);
      }
    }, [effectiveRevenueKeys, onRevenueOptionsChange]);

    /** Toggle a revenue option on/off from the popover. Called from any
     *  revenue chip's hover submenu. Adding from an empty state also pushes
     *  'revenue' back into selectedMetrics. */
    const toggleRevenueOption = useCallback((key: string) => {
      if (!onRevenueOptionsChange) return;
      const next = effectiveRevenueKeys.includes(key)
        ? effectiveRevenueKeys.filter(k => k !== key)
        : [...effectiveRevenueKeys, key];
      if (next.length === 0) {
        // Removing the last one collapses the Revenue metric entirely.
        setSelectedMetrics(prev => prev.filter(x => x !== 'revenue'));
        return;
      }
      onRevenueOptionsChange(next);
      if (!selectedMetrics.includes('revenue')) {
        setSelectedMetrics(prev => [...prev, 'revenue']);
      }
    }, [effectiveRevenueKeys, onRevenueOptionsChange, selectedMetrics]);

    // Per-submission sparked-view events. Computed once per submissions
    // change and reused per interval. Two paths to a sparked event:
    //  1. Manual sparkViewLogs — each entry has a YYYY-MM-DD `date` and a
    //     `views` count. Logs are the source of truth when present.
    //  2. Snapshot delta inference — for videos with `sparkedAt` and no
    //     manual logs, every snapshot delta whose endpoint is at-or-after
    //     sparkedAt is treated as ad-driven (mirrors SparkService.splitViewsBySpark).
    // The result is a flat list of `{ timestamp, views }` events that the
    // chartData memo buckets into the visible intervals.
    const sparkEvents = useMemo(() => {
      const events: { ts: number; views: number }[] = [];
      for (const sub of submissions) {
        const logs = (sub as any).sparkViewLogs as Array<{ date: string; views: number }> | undefined;
        if (logs && logs.length > 0) {
          for (const l of logs) {
            // Parse YYYY-MM-DD as local midnight so it lands on the same
            // calendar day the user sees on the X axis.
            const [y, mo, d] = (l.date || '').split('-').map(n => Number(n));
            if (!y || !mo || !d) continue;
            events.push({ ts: new Date(y, mo - 1, d).getTime(), views: l.views || 0 });
          }
          continue; // logs override snapshot inference for this submission
        }
        const sparkedAtRaw = (sub as any).sparkedAt as Date | { toDate: () => Date } | undefined;
        if (!sparkedAtRaw) continue;
        const sparkTime = (sparkedAtRaw instanceof Date ? sparkedAtRaw : sparkedAtRaw.toDate()).getTime();
        const snaps = (sub.snapshots || []).slice().sort(
          (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
        );
        for (let i = 1; i < snaps.length; i++) {
          const prev = snaps[i - 1];
          const curr = snaps[i];
          const delta = (curr.views || 0) - (prev.views || 0);
          if (delta <= 0) continue;
          const currTs = new Date(curr.capturedAt).getTime();
          if (currTs >= sparkTime) events.push({ ts: currTs, views: delta });
        }
      }
      return events;
    }, [submissions]);

    const chartData = useMemo(() => {
      // Use the SAME pipeline as KPI cards so values match exactly.
      // generateSparklineData handles snapshot-delta growth per interval, new
      // uploads in the period, etc. — far more accurate than summing video.views.
      const dateRangeStart = dateRange ? new Date(dateRange.startDate) : null;
      const dateRangeEnd = dateRange ? new Date(dateRange.endDate) : new Date();

      // Run the helper for each underlying spark metric we'll need (always
      // include views/likes/comments when engagement is selected so we can
      // derive the ratio).
      const needed = new Set<SparkMetric>();
      selectedMetrics.forEach(m => {
        const sm = toSparkMetric(m);
        if (sm) needed.add(sm);
      });
      if (selectedMetrics.includes('engagement')) {
        needed.add('views');
        needed.add('likes');
        needed.add('comments');
      }
      // We need *something* to provide the interval skeleton even if every
      // selected metric is derived (engagement) or external (linkClicks).
      if (needed.size === 0) needed.add('videos');

      const sparkResults: Partial<Record<SparkMetric, ReturnType<typeof generateSparklineData>>> = {};
      needed.forEach(metric => {
        sparkResults[metric] = generateSparklineData(
          metric,
          submissions,
          allSubmissions,
          dateRangeStart,
          dateRangeEnd,
          dateFilter,
          granularity
        );
      });

      const reference =
        sparkResults.views ||
        sparkResults.likes ||
        sparkResults.comments ||
        sparkResults.shares ||
        sparkResults.saves ||
        sparkResults.videos ||
        sparkResults.accounts;
      if (!reference) return [];

      const data = reference.data.map((point, idx) => {
        // For week/month intervals, the bucket can straddle a calendar
        // boundary (e.g. Mar 30 → Apr 28 on Last 30 Days + monthly). Label
        // by the interval's MIDPOINT so a span dominated by April reads
        // "April 2026" rather than "March 2026". Daily intervals are 1-day
        // so the midpoint == the start date, no behavior change there.
        const labelDate = (reference.intervalType === 'month' || reference.intervalType === 'week')
          ? new Date((point.interval.startDate.getTime() + point.interval.endDate.getTime()) / 2)
          : point.interval.startDate;
        let label = DataAggregationService.formatIntervalLabel(labelDate, reference.intervalType);

        // Annotate partial buckets with their visible day count so a user on
        // Last 30 Days + monthly can see "March (2 days)" / "April (28 days)"
        // and not confuse them with full-month totals.
        if (reference.intervalType === 'month' || reference.intervalType === 'week') {
          // Day count = midnight-to-midnight days inclusive. ceil of the
          // ms span / 86400000 handles end-of-day timestamps cleanly.
          const visibleDays = Math.max(
            1,
            Math.round((point.interval.endDate.getTime() - point.interval.startDate.getTime()) / 86400000)
          );
          const fullDays = reference.intervalType === 'week'
            ? 7
            : new Date(labelDate.getFullYear(), labelDate.getMonth() + 1, 0).getDate();
          if (visibleDays < fullDays) {
            label += ` (${visibleDays} day${visibleDays === 1 ? '' : 's'})`;
          }
        }

        const row: Record<string, any> = {
          date: label,
          timestamp: point.timestamp,
          interval: point.interval,
        };

        // Sparked-views total for THIS interval — sum of every event whose
        // timestamp lands inside the bucket. Used to back out paid views
        // when the chart is in 'organic' mode. Computed once per row.
        const sparkedInInterval = (() => {
          if (reportingView !== 'organic') return 0;
          const start = point.interval.startDate.getTime();
          const end = point.interval.endDate.getTime();
          let total = 0;
          for (const ev of sparkEvents) {
            if (ev.ts >= start && ev.ts <= end) total += ev.views;
          }
          return total;
        })();

        const valueAt = (m: SparkMetric) => {
          const raw = sparkResults[m]?.data[idx]?.value || 0;
          // Only the views series actually has a Spark/organic distinction —
          // likes/comments/shares aren't separated in the data model. Floor
          // at 0 in case manual log totals exceed the snapshot-derived gain
          // for an interval (rare, but possible if the user logs lifetime
          // ad views into a single day).
          if (m === 'views' && reportingView === 'organic') {
            return Math.max(0, raw - sparkedInInterval);
          }
          return raw;
        };

        // Link clicks aren't in submissions — count clicks per interval directly.
        const clicksInInterval = (() => {
          if (!selectedMetrics.includes('linkClicks') || !linkClicks?.length) return 0;
          let count = 0;
          for (const c of linkClicks) {
            const ts = new Date(c.timestamp).getTime();
            if (ts >= point.interval.startDate.getTime() && ts <= point.interval.endDate.getTime()) {
              count += 1;
            }
          }
          return count;
        })();

        // Revenue: sum every map entry whose date falls inside this interval.
        // Granularity-agnostic on purpose — Superwall returns one bucket per
        // requested interval (daily / weekly / monthly), and the bucket key
        // lands on the interval's start day (e.g. "2026-04-01" for April when
        // dateInterval=month). Iterating the map keys (instead of cursoring
        // day-by-day and matching exact strings) means we pick those bucketed
        // values up regardless of whether the chart's local interval start
        // happens to align with the API bucket's start.
        const sumRevenueMap = (map: Record<string, number> | undefined): number => {
          if (!map) return 0;
          const start = point.interval.startDate.getTime();
          const end = point.interval.endDate.getTime();
          let total = 0;
          for (const k of Object.keys(map)) {
            // Parse "YYYY-MM-DD" or "YYYY-MM" (month-only) as a local date so
            // it sits on the same calendar day the user sees on the axis.
            const iso = k.length === 7 ? `${k}-01` : k;
            const [y, mo, d] = iso.split('-').map(n => Number(n));
            if (!y || !mo || !d) continue;
            const t = new Date(y, mo - 1, d).getTime();
            if (t >= start && t <= end) total += map[k] || 0;
          }
          return total;
        };
        const revenueInInterval = selectedMetrics.includes('revenue')
          ? sumRevenueMap(revenueByDate)
          : 0;
        const revenueByKeyInInterval: Record<string, number> = {};
        if (selectedMetrics.includes('revenue') && isMultiRevenueMode && revenueByDateByOption) {
          for (const key of effectiveRevenueKeys) {
            revenueByKeyInInterval[key] = sumRevenueMap(revenueByDateByOption[key]);
          }
        }

        selectedMetrics.forEach(m => {
          if (m === 'engagement') {
            const v = valueAt('views');
            const e = valueAt('likes') + valueAt('comments');
            row[m] = v > 0 ? (e / v) * 100 : 0;
          } else if (m === 'linkClicks') {
            row[m] = clicksInInterval;
          } else if (m === 'revenue') {
            row[m] = revenueInInterval;
            // Also stash per-option values for multi-mode rendering.
            for (const k of Object.keys(revenueByKeyInInterval)) {
              row[`revenue:${k}`] = revenueByKeyInInterval[k];
            }
          } else {
            const sm = toSparkMetric(m);
            if (sm) row[m] = valueAt(sm);
          }
        });
        return row;
      });

      // Expanded series keys — for non-revenue metrics, the same id; for
      // 'revenue' in multi-mode, one composite key per selected option. This
      // is the canonical list used everywhere geometry needs to iterate
      // (cumulative, normalize, recharts, tooltip).
      const expandedKeys: string[] = [];
      for (const m of selectedMetrics) {
        if (m === 'revenue' && isMultiRevenueMode && effectiveRevenueKeys.length > 0) {
          for (const k of effectiveRevenueKeys) expandedKeys.push(`revenue:${k}`);
        } else {
          expandedKeys.push(m);
        }
      }

      // Trim leading zero-buckets only — never trim the trailing edge so
      // today shows on the chart even when its revenue / metric value is
      // still 0 (incomplete day, no events yet, etc.). Previously this
      // also trimmed trailing zeros, which made "today" disappear when
      // Superwall hadn't logged anything for it yet.
      let trimmed = data;
      if (data.length > 12) {
        const hasData = (d: Record<string, any>) => expandedKeys.some(k => (d[k] || 0) > 0);
        const first = data.findIndex(hasData);
        if (first > 0) trimmed = data.slice(first);
      }

      // Cumulative mode: running total per metric across intervals.
      // Engagement stays as a per-interval ratio (cumulative ratio is meaningless).
      if (aggregation === 'cumulative') {
        const running: Record<string, number> = {};
        expandedKeys.forEach(k => {
          if (k !== 'engagement') running[k] = 0;
        });
        trimmed = trimmed.map(row => {
          const next: Record<string, any> = { ...row };
          expandedKeys.forEach(k => {
            if (k === 'engagement') return;
            running[k] = (running[k] || 0) + (row[k] || 0);
            next[k] = running[k];
          });
          return next;
        });
      }

      // Always preserve raw values under `${k}_raw` so the tooltip can show
      // absolute numbers even when the chart is rendering normalized 0–100.
      // Then, in normalized mode, replace `k` with the scaled value so
      // every series fills its own vertical range.
      const maxByMetric: Record<string, number> = {};
      expandedKeys.forEach(k => {
        let max = 0;
        trimmed.forEach(row => {
          const v = (row[k] as number) || 0;
          if (v > max) max = v;
        });
        maxByMetric[k] = max;
      });

      trimmed = trimmed.map(row => {
        const next: Record<string, any> = { ...row };
        expandedKeys.forEach(k => {
          const raw = (row[k] as number) || 0;
          next[`${k}_raw`] = raw;
          if (chartScale === 'normalized') {
            const max = maxByMetric[k];
            next[k] = max > 0 ? (raw / max) * 100 : 0;
          }
        });
        return next;
      });
      return trimmed;
    }, [submissions, allSubmissions, linkClicks, revenueByDate, revenueByDateByOption, selectedMetrics, isMultiRevenueMode, effectiveRevenueKeys, granularity, dateRange, dateFilter, aggregation, chartScale, reportingView, sparkEvents]);

    // Open the day modal from any of: ComposedChart-level click, individual
    // Bar / Line / Area click, or empty-area click (via the hover-tracking
    // fallback below).
    const openDayModal = useCallback((interval: any) => {
      if (!interval) return;
      setSelectedInterval(interval);
      setIsDayModalOpen(true);
    }, []);

    // Track the most recently hovered interval so a click anywhere on the
    // chart — even on empty space between bars — falls back to whichever
    // interval the mouse cursor is closest to. Recharts populates
    // `activePayload` on mousemove even outside the bars themselves.
    const lastHoveredIntervalRef = useRef<any | null>(null);
    const handleChartMouseMove = useCallback((state: any) => {
      const payload = state?.activePayload?.[0]?.payload;
      if (payload?.interval) lastHoveredIntervalRef.current = payload.interval;
    }, []);
    const handleChartMouseLeave = useCallback(() => {
      lastHoveredIntervalRef.current = null;
    }, []);

    const handleChartClick = useCallback((data: any) => {
      const interval =
        data?.activePayload?.[0]?.payload?.interval ??
        lastHoveredIntervalRef.current;
      openDayModal(interval);
    }, [openDayModal]);

    // Recharts hands the full row as the first arg of a Bar/Line/Area onClick.
    const handleShapeClick = useCallback((rowOrData: any) => {
      const interval = rowOrData?.interval ?? rowOrData?.payload?.interval;
      openDayModal(interval);
    }, [openDayModal]);

    const CustomTooltip = ({ active, payload, label }: any) => {
      if (!active || !payload || !payload.length) return null;
      // Top videos posted in the hovered interval (for the rich preview)
      const interval = payload[0]?.payload?.interval;
      const videosInInterval = interval
        ? submissions
            .filter(v => {
              const uploadDate = new Date(v.uploadDate || v.dateSubmitted);
              return uploadDate >= interval.startDate && uploadDate <= interval.endDate;
            })
            .sort((a, b) => (b.views || 0) - (a.views || 0))
            .slice(0, 5)
        : [];

      return (
        <div
          className="backdrop-blur-xl text-content rounded-xl border border-border shadow-2xl"
          style={{ backgroundColor: 'var(--surface-tertiary)', padding: '12px 14px', minWidth: 240, maxWidth: 320 }}
        >
          <p className="text-sm font-semibold text-content mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, i: number) => {
              const id = entry.dataKey as string;
              const swatchColor = series.find(s => s.id === id)?.color || entry.color;
              const rawValue = entry.payload?.[`${id}_raw`];
              const displayValue =
                typeof rawValue === 'number' ? rawValue : entry.value || 0;
              const displayLabel = labelFor(id);
              return (
                <div key={i} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-[3px] flex-shrink-0"
                      style={{ backgroundColor: swatchColor }}
                    />
                    <span className="text-xs text-content-secondary truncate">{displayLabel}:</span>
                  </div>
                  <span className="text-sm font-bold text-content tabular-nums">
                    {formatMetric(id, displayValue)}
                  </span>
                </div>
              );
            })}
          </div>

          {videosInInterval.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <p className="text-[10px] text-content-muted uppercase tracking-wider mb-2">
                Top {videosInInterval.length === 1 ? 'video' : `${videosInInterval.length} videos`} posted
              </p>
              <div className="space-y-1.5">
                {videosInInterval.map(v => (
                  <div key={v.id} className="flex items-center gap-2 min-w-0">
                    {v.thumbnail ? (
                      <img
                        src={v.thumbnail}
                        alt=""
                        className="w-7 h-9 rounded object-cover flex-shrink-0 bg-surface-hover"
                      />
                    ) : (
                      <div className="w-7 h-9 rounded bg-surface-hover flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-content truncate font-medium">
                        @{v.uploaderHandle || 'unknown'}
                      </p>
                      <p className="text-[10px] text-content-muted truncate">
                        {(v.caption || v.title || '').slice(0, 48) || 'No caption'}
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-content tabular-nums flex-shrink-0">
                      {formatNumber(v.views || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 pt-2 border-t border-border-subtle text-center">
            <span className="text-[10px] text-content-muted uppercase tracking-wider">
              Click to view details
            </span>
          </div>
        </div>
      );
    };

    // Totals per metric — these MUST line up with the KPI cards. We pull
    // them from the same `computeKPITotals` helper that powers the KPI cards
    // instead of summing the per-interval sparkline rows (which uses a
    // different snapshot algorithm and would disagree). Link Clicks / Revenue
    // aren't KPI metrics, so for those we still sum the chart rows (their
    // raw values are stable across scale modes via `${m}_raw`).
    const kpiTotals = useMemo(() => {
      const dateRangeStart = dateRange ? new Date(dateRange.startDate) : null;
      const dateRangeEnd = dateRange ? new Date(dateRange.endDate) : new Date();
      // Pass the chart's current reportingView so the totals strip
      // matches the bars (chart subtracts sparked views per-bar in
      // 'organic' mode; the totals must do the same to agree).
      return computeKPITotals(submissions, dateRangeStart, dateRangeEnd, reportingView);
    }, [submissions, dateRange, reportingView]);

    const totals = useMemo(() => {
      const out: Record<string, number> = {};
      const raw = (row: any, m: string) =>
        (row[`${m}_raw`] as number | undefined) ?? ((row[m] as number) || 0);

      const sumKey = (key: string): number => {
        if (aggregation === 'cumulative') {
          const last = chartData[chartData.length - 1];
          return last ? raw(last, key) : 0;
        }
        return chartData.reduce((s, row) => s + raw(row, key), 0);
      };

      selectedMetrics.forEach(m => {
        switch (m) {
          case 'views':
            out[m] = kpiTotals.views;
            break;
          case 'likes':
            out[m] = kpiTotals.likes;
            break;
          case 'comments':
            out[m] = kpiTotals.comments;
            break;
          case 'shares':
            out[m] = kpiTotals.shares;
            break;
          case 'saves':
            out[m] = kpiTotals.saves;
            break;
          case 'videos':
            out[m] = kpiTotals.videos;
            break;
          case 'accounts':
            out[m] = kpiTotals.accounts;
            break;
          case 'engagement':
            out[m] = kpiTotals.engagement;
            break;
          default:
            // Link clicks / revenue / future metrics — sum chart rows.
            out[m] = sumKey(m);
        }
      });
      // Per-revenue-key totals (only meaningful in multi-mode). Each composite
      // id is treated as its own metric for chip + tooltip display.
      if (selectedMetrics.includes('revenue') && isMultiRevenueMode) {
        for (const k of effectiveRevenueKeys) {
          out[`revenue:${k}`] = sumKey(`revenue:${k}`);
        }
      }
      return out;
    }, [kpiTotals, chartData, selectedMetrics, aggregation, isMultiRevenueMode, effectiveRevenueKeys]);

    // Series — one per visible chart geometry. In multi-revenue mode the
    // single 'revenue' chip in selectedMetrics expands into N entries (one
    // per selected option) so the chart renders one series per option with
    // its own color and tooltip row.
    const series = useMemo(() => {
      const out: { id: string; label: string; color: string; yAxisId: 'left' | 'right' }[] = [];
      selectedMetrics.forEach((m) => {
        if (m === 'revenue' && isMultiRevenueMode && effectiveRevenueKeys.length > 0) {
          for (const k of effectiveRevenueKeys) {
            const idx = out.length;
            out.push({
              id: `revenue:${k}`,
              label: revenueOptByKey.get(k)?.label ?? 'Revenue',
              color: SERIES_COLORS[idx % SERIES_COLORS.length],
              yAxisId: idx === 0 ? 'left' : 'right',
            });
          }
        } else {
          const idx = out.length;
          out.push({
            id: m,
            label: METRIC_LABELS[m],
            color: SERIES_COLORS[idx % SERIES_COLORS.length],
            yAxisId: idx === 0 ? 'left' : 'right',
          });
        }
      });
      return out;
    }, [selectedMetrics, isMultiRevenueMode, effectiveRevenueKeys, revenueOptByKey]);

    const gradientId = (id: string) => `unifiedGrad_${id.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Chart entrance animation — bars/line ease in + slight scale-up. Recharts
    // already animates the geometry on mount; this wrapper handles the framing.
    const chartContainerVariants = {
      hidden: { opacity: 0, scale: isMerging ? 0.92 : 0.98, y: isMerging ? 16 : 6 },
      shown: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
          duration: isMerging ? 0.55 : 0.35,
          ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
        },
      },
    };

    return (
      <motion.div
        layout
        initial={isMerging ? { opacity: 0, scale: 0.94, y: 24 } : false}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl border border-border-subtle shadow-theme overflow-hidden bg-surface-secondary"
      >
        {/* Container background — flat, no orange glow. */}

        <div className="relative z-10 p-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-content">Metrics</h3>
                <div className="relative">
                  <button
                    onMouseEnter={() => setShowInfoTip(true)}
                    onMouseLeave={() => setShowInfoTip(false)}
                    className="text-content-muted hover:text-content-secondary transition-colors"
                  >
                    <Info className="w-4 h-4" style={{ opacity: 0.5 }} />
                  </button>
                  {showInfoTip && (
                    <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] p-3 rounded-lg bg-surface-tertiary border border-border shadow-xl z-50">
                      <p className="text-xs text-content-secondary leading-relaxed">
                        Pick the metrics you care about. The first metric draws as bars, the rest overlay as smooth lines.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Daily / Cumulative aggregation toggle */}
              <div className="inline-flex rounded-lg bg-surface-tertiary border border-border-subtle p-0.5">
                {(['daily', 'cumulative'] as const).map(opt => {
                  const active = aggregation === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setAggregation(opt)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all capitalize ${
                        active
                          ? 'bg-surface text-content shadow-sm'
                          : 'text-content-muted hover:text-content'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {/* Organic / Total reporting view — session-only override of
                  the org default. Only surfaces when Views is selected AND
                  there's at least one sparked event in the data, so the
                  pill stays out of the way for orgs that don't run ads. */}
              {selectedMetrics.includes('views') && sparkEvents.length > 0 && (
                <div
                  className="inline-flex rounded-lg bg-surface-tertiary border border-border-subtle p-0.5"
                  title="Switch between organic-only and total (organic + Spark) views"
                >
                  {(['organic', 'total'] as const).map(opt => {
                    const active = reportingView === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => setReportingView(opt)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all capitalize ${
                          active
                            ? 'bg-surface text-content shadow-sm'
                            : 'text-content-muted hover:text-content'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Header right: just Settings — pills + Add moved into the metric strip below */}
            <div ref={settingsMenuRef} className="relative">
              <button
                onClick={() => setIsSettingsOpen(o => !o)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-content-secondary hover:text-content hover:bg-surface-hover transition-colors"
                title="Chart settings"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
              <AnimatePresence>
                {isSettingsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute right-0 top-full mt-2 w-56 rounded-lg bg-surface-tertiary border border-border shadow-xl z-50 overflow-hidden"
                  >
                    <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-content-muted border-b border-border-subtle">
                      Chart style
                    </div>
                    {[
                      { id: 'bar-line' as ChartType, label: 'Bars + Lines', icon: BarChart2 },
                      { id: 'bars-only' as ChartType, label: 'All bars (grouped)', icon: BarChart2 },
                      { id: 'line' as ChartType, label: 'Lines only', icon: TrendingUp },
                      { id: 'area' as ChartType, label: 'Areas', icon: Activity },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setChartType(opt.id);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${
                          chartType === opt.id
                            ? 'bg-surface-hover text-content'
                            : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                        }`}
                      >
                        <opt.icon className="w-3.5 h-3.5" />
                        {opt.label}
                      </button>
                    ))}
                    <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-content-muted border-y border-border-subtle">
                      Scale
                    </div>
                    {[
                      {
                        id: 'normalized' as const,
                        label: 'Normalized (% of max)',
                        hint: 'Each metric fills its own range',
                      },
                      {
                        id: 'absolute' as const,
                        label: 'Absolute',
                        hint: 'Shared axis — large metrics dominate',
                      },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setChartScale(opt.id)}
                        className={`w-full flex flex-col items-start gap-0.5 px-3 py-2 text-sm text-left ${
                          chartScale === opt.id
                            ? 'bg-surface-hover text-content'
                            : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                        }`}
                      >
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-[10px] text-content-muted">{opt.hint}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Unified metric strip — each metric is a compact card with a colored
              square, label, total, and a hover-only × to remove. Drag any chip
              to reorder; the first metric drives the bar series and gets the
              left axis in absolute mode. Add button sits at the end. */}
          <Reorder.Group
            axis="x"
            values={expandedChips}
            onReorder={handleChipReorder}
            as="div"
            className="flex flex-wrap items-stretch gap-2 mb-5"
          >
            {expandedChips.map((id, idx) => {
              const isRevenueOption = id.startsWith('revenue:');
              const revKey = isRevenueOption ? id.slice('revenue:'.length) : null;
              const m = (isRevenueOption ? 'revenue' : id) as UnifiedMetricId;
              const canRemove = expandedChips.length > 1;
              const hasRevenueSubmenu = isRevenueOption && !!revenueOptions && revenueOptions.length > 0;

              // Each chip's color matches the recharts series color so the
              // strip and the chart agree at a glance.
              const seriesIdx = series.findIndex(s => s.id === id);
              const color = seriesIdx >= 0 ? series[seriesIdx].color : SERIES_COLORS[idx % SERIES_COLORS.length];

              // Total + label resolution. For revenue chips we read the
              // composite total + the per-option label so each card shows
              // its own number ("Gross Revenue $X", "Trial Conversion Y%").
              const value = totals[id] || 0;
              const display = formatMetric(id, value);
              const label = isRevenueOption
                ? (revenueOptByKey.get(revKey!)?.label ?? 'Revenue')
                : (m === 'revenue' && !isMultiRevenueMode && hasRevenueSubmenu
                    ? (revenueOptions!.find(o => o.key === selectedRevenueOption)?.label ?? METRIC_LABELS[m])
                    : METRIC_LABELS[m]);

              const onChipRemove = () => {
                if (isRevenueOption && revKey) removeRevenueOption(revKey);
                else removeMetric(m);
              };

              // Show shimmer when (a) the page is broadly loading, or (b)
              // this specific revenue chip's data is still being fetched.
              const chipLoading = isLoading || (
                isRevenueOption && !!revKey && !!pendingRevenueKeys?.includes(revKey)
              );

              // Single-mode revenue chips show the submenu (swap type);
              // multi-mode revenue chips also show the submenu (toggle more
              // on); other metric chips don't have a submenu at all.
              const showRevenueSubmenu = isRevenueOption || (m === 'revenue' && !isMultiRevenueMode && hasRevenueSubmenu);

              return (
                <Reorder.Item
                  key={id}
                  value={id}
                  as="div"
                  layout
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  whileDrag={{ scale: 1.04, zIndex: 20, cursor: 'grabbing' }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="group/chip relative flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface-tertiary/60 hover:bg-surface-tertiary px-3 py-2 min-w-[120px] transition-colors cursor-grab active:cursor-grabbing select-none"
                >
                  <span
                    className="w-3 h-3 rounded-[4px] flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex flex-col leading-tight min-w-0">
                    <span className="text-[10px] uppercase tracking-wider text-content-muted truncate">
                      {label}
                    </span>
                    {chipLoading ? (
                      <span className="block h-5 w-16 mt-0.5 rounded bg-content/10 animate-pulse" />
                    ) : (
                      <span className="text-base font-bold text-content tabular-nums truncate">
                        {display}
                      </span>
                    )}
                  </div>
                  {showRevenueSubmenu && (
                    <ChevronDown className="w-3 h-3 text-content-muted flex-shrink-0 transition-transform group-hover/chip:rotate-180" />
                  )}

                  {/* Revenue-type submenu — single-mode = radio swap, multi-mode
                      = checkboxes (toggle each on/off). Multi-mode submenu
                      hangs off every revenue chip so adding more is one hover
                      away from any of them. */}
                  {showRevenueSubmenu && (
                    <div
                      onPointerDown={e => e.stopPropagation()}
                      className="absolute left-0 top-full pt-2 w-64 z-50 hidden group-hover/chip:block"
                    >
                      <div className="rounded-xl bg-surface-secondary border border-border shadow-2xl overflow-hidden">
                        <div className="px-3 py-2 border-b border-border-subtle">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
                            {isMultiRevenueMode ? 'Revenue types' : 'Revenue type'}
                          </p>
                        </div>
                        <div className="max-h-72 overflow-y-auto py-1">
                          {revenueOptions!.map(opt => {
                            const isActive = isMultiRevenueMode
                              ? effectiveRevenueKeys.includes(opt.key)
                              : opt.key === selectedRevenueOption;
                            return (
                              <button
                                key={opt.key}
                                onPointerDown={e => e.stopPropagation()}
                                onClick={() => {
                                  if (isMultiRevenueMode) toggleRevenueOption(opt.key);
                                  else onRevenueOptionChange?.(opt.key);
                                }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${isActive ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold' : 'text-content hover:bg-surface-tertiary'}`}
                              >
                                <div className={`w-3.5 h-3.5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${isActive ? 'bg-orange-500 border-orange-500' : 'border-border-strong'}`}>
                                  {isActive && (isMultiRevenueMode ? <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} /> : <span className="w-1.5 h-1.5 rounded-sm bg-white" />)}
                                </div>
                                <span className="truncate">{opt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {canRemove && (
                    <button
                      // Stop pointerdown so clicking the × doesn't initiate drag
                      onPointerDown={e => e.stopPropagation()}
                      onClick={onChipRemove}
                      title="Remove metric"
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-surface border border-border text-content-muted hover:text-content hover:bg-surface-hover shadow-sm flex items-center justify-center opacity-0 group-hover/chip:opacity-100 transition-opacity"
                    >
                      <X className="w-2.5 h-2.5" strokeWidth={2.5} />
                    </button>
                  )}
                </Reorder.Item>
              );
            })}

            {/* Add — sits at the end of the strip (not a Reorder.Item — not draggable) */}
            {availableToAdd.length > 0 && selectedMetrics.length < 6 && (
              <div ref={addMenuRef} className="relative">
                <button
                  onClick={() => setIsAddOpen(o => !o)}
                  className="h-full flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-content-secondary border border-dashed border-border hover:text-content hover:border-content-secondary hover:bg-surface-tertiary/60 transition-colors min-w-[80px]"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Add
                </button>
                <AnimatePresence>
                  {isAddOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute left-0 top-full mt-2 w-48 rounded-lg bg-surface-tertiary border border-border shadow-xl z-50 overflow-hidden"
                    >
                      {availableToAdd.map((m, i) => {
                        const color =
                          SERIES_COLORS[(selectedMetrics.length + i) % SERIES_COLORS.length];
                        return (
                          <button
                            key={m}
                            onClick={() => addMetric(m)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content hover:bg-surface-hover text-left"
                          >
                            <span
                              className="w-3 h-3 rounded-[3px] flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            {METRIC_LABELS[m]}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </Reorder.Group>

          {/* Chart with watermark + faded geometric pattern */}
          <motion.div
            variants={chartContainerVariants}
            initial="hidden"
            animate="shown"
            className="relative rounded-xl overflow-hidden bg-surface-secondary"
            style={{ minHeight: '380px' }}
          >
            {/* Faded grid geometry — sits behind the watermark / chart, very
                subtle. Mirrors the texture viral.app puts in their overview. */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(var(--content) 1px, transparent 1px), linear-gradient(90deg, var(--content) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
                opacity: 0.025,
              }}
            />

            {/* Watermark */}
            {watermark && (
              <div
                aria-hidden
                className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                style={{
                  fontSize: 'clamp(28px, 4.5vw, 56px)',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'var(--content)',
                  opacity: 0.05,
                }}
              >
                {watermark}
              </div>
            )}

            {(isLoading || (pendingRevenueKeys && pendingRevenueKeys.length > 0)) ? (
              <ChartSkeleton />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={380}>
                <ComposedChart
                  data={chartData}
                  onClick={handleChartClick}
                  onMouseMove={handleChartMouseMove}
                  onMouseLeave={handleChartMouseLeave}
                  style={{ cursor: 'pointer' }}
                  margin={{ top: 16, right: 40, left: 0, bottom: 5 }}
                >
                  <defs>
                    {series.map(s => (
                      <linearGradient key={s.id} id={gradientId(s.id)} x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={s.color}
                          stopOpacity={chartType === 'area' ? 0.5 : 0.85}
                        />
                        <stop
                          offset="100%"
                          stopColor={s.color}
                          stopOpacity={chartType === 'area' ? 0 : 0.45}
                        />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    strokeDasharray="2 6"
                    stroke="var(--border)"
                    vertical={false}
                    opacity={0.6}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="transparent"
                    tick={{ fill: 'var(--content-secondary)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="transparent"
                    tick={chartScale === 'absolute'
                      ? { fill: 'var(--content-muted)', fontSize: 11 }
                      : false}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={chartScale === 'absolute' ? formatNumber : (v: number) => `${v}%`}
                    width={chartScale === 'absolute' ? 50 : 0}
                    domain={chartScale === 'normalized' ? [0, 100] : undefined}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="transparent"
                    tick={chartScale === 'absolute'
                      ? { fill: 'var(--content-muted)', fontSize: 11 }
                      : false}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={chartScale === 'absolute' ? formatNumber : (v: number) => `${v}%`}
                    width={chartScale === 'absolute' ? 40 : 0}
                    domain={chartScale === 'normalized' ? [0, 100] : undefined}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: 'rgba(251, 138, 74, 0.08)' }}
                    wrapperStyle={{ zIndex: 9999, pointerEvents: 'none' }}
                    position={{ y: -10 }}
                    offset={20}
                    isAnimationActive={false}
                  />
                  {series.map((s, idx) => {
                    const animBegin = isMerging ? 250 + idx * 80 : idx * 60;
                    const animDur = isMerging ? 900 : 700;
                    // All-bars mode: every metric is a thin grouped bar — like
                    // viral.app's overview chart.
                    if (chartType === 'bars-only') {
                      return (
                        <Bar
                          key={s.id}
                          yAxisId={s.yAxisId}
                          dataKey={s.id}
                          fill={`url(#${gradientId(s.id)})`}
                          stroke={s.color}
                          strokeWidth={1.5}
                          radius={[6, 6, 0, 0]}
                          maxBarSize={32}
                          animationBegin={animBegin}
                          animationDuration={animDur}
                          animationEasing="ease-out"
                          onClick={handleShapeClick}
                          style={{ cursor: 'pointer' }}
                        />
                      );
                    }
                    if (chartType === 'bar-line' && idx === 0) {
                      return (
                        <Bar
                          key={s.id}
                          yAxisId={s.yAxisId}
                          dataKey={s.id}
                          fill={`url(#${gradientId(s.id)})`}
                          stroke={s.color}
                          strokeWidth={1.75}
                          radius={[10, 10, 0, 0]}
                          maxBarSize={68}
                          animationBegin={animBegin}
                          animationDuration={animDur}
                          animationEasing="ease-out"
                          onClick={handleShapeClick}
                          style={{ cursor: 'pointer' }}
                        />
                      );
                    }
                    if (chartType === 'area') {
                      return (
                        <Area
                          key={s.id}
                          yAxisId={s.yAxisId}
                          type="monotone"
                          dataKey={s.id}
                          stroke={s.color}
                          strokeWidth={4}
                          fill={`url(#${gradientId(s.id)})`}
                          animationBegin={animBegin}
                          animationDuration={animDur}
                          animationEasing="ease-out"
                          onClick={handleShapeClick}
                          style={{ cursor: 'pointer' }}
                          activeDot={{ r: 6, fill: s.color, stroke: '#fff', strokeWidth: 2, onClick: handleShapeClick, style: { cursor: 'pointer' } }}
                        />
                      );
                    }
                    return (
                      <Line
                        key={s.id}
                        yAxisId={s.yAxisId}
                        type="monotone"
                        dataKey={s.id}
                        stroke={s.color}
                        strokeWidth={4.5}
                        dot={false}
                        activeDot={{ r: 7, fill: s.color, stroke: '#fff', strokeWidth: 2, onClick: handleShapeClick, style: { cursor: 'pointer' } }}
                        animationBegin={animBegin}
                        animationDuration={animDur}
                        animationEasing="ease-out"
                        onClick={handleShapeClick}
                        style={{ cursor: 'pointer' }}
                      />
                    );
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[380px] flex items-center justify-center text-content-muted text-sm">
                No data available
              </div>
            )}
          </motion.div>
        </div>

        {selectedInterval && (
          <DayVideosModal
            isOpen={isDayModalOpen}
            onClose={() => {
              setIsDayModalOpen(false);
              setSelectedInterval(null);
            }}
            date={selectedInterval.startDate}
            // Pass the full submission set — the modal filters by interval
            // itself to surface New Uploads + Refreshed Videos correctly.
            videos={submissions}
            interval={selectedInterval}
            linkClicks={linkClicks}
            revenueByDate={revenueByDate}
            selectedPeriodRange={dateRange}
            metricLabel={METRIC_LABELS[selectedMetrics[0]]}
            onVideoClick={onVideoClick}
          />
        )}
      </motion.div>
    );
  }
);

UnifiedMetricsChart.displayName = 'UnifiedMetricsChart';

export default UnifiedMetricsChart;
