import { useState, useEffect, useMemo, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Users, Repeat, AlertCircle, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import SuperwallService, {
  SUPERWALL_METRICS,
  SuperwallMetricKey,
  SuperwallDataPoint,
} from '../services/SuperwallService';
import RevenueCatService from '../services/RevenueCatService';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

type RevenueProvider = 'superwall' | 'revenuecat' | null;

// ─── Types ───────────────────────────────────────────────────────────

type RevenueTimeRange = '7d' | '30d' | '90d' | '180d' | '1y' | '2y';

const TIME_RANGE_OPTIONS: { key: RevenueTimeRange; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '180d', label: '180D' },
  { key: '1y', label: '1Y' },
  { key: '2y', label: '2Y' },
];

interface TrialCohortRow {
  date: string;
  started: number;
  converted: number;
  cancelled: number;
  expired: number;
  billing: number;
  pending: number;
}

interface VideoDelta {
  title: string;
  handle: string;
  thumbnail: string;
  views: number;
}

interface MergedDataPoint {
  date: string;
  views: number;
  metric: number;
  trialStarts: number;
  trialConverted: number;
  trialCancelled: number;
  trialBilling: number;
  videoBreakdown: VideoDelta[];
}

type OverlayKey = 'views' | 'metric' | 'trialStarts' | 'trialConverted' | 'trialCancelled' | 'trialBilling';

const OVERLAY_SERIES: { key: OverlayKey; label: string; color: string; axis: 'left' | 'right' | 'trials' }[] = [
  { key: 'metric',          label: 'Revenue',         color: '#3b82f6', axis: 'left' },
  { key: 'views',           label: 'Views',           color: '#10b981', axis: 'right' },
  { key: 'trialStarts',     label: 'Trial Starts',    color: '#8b5cf6', axis: 'trials' },
  { key: 'trialConverted',  label: 'Converted',       color: '#22c55e', axis: 'trials' },
  { key: 'trialCancelled',  label: 'Cancelled',       color: '#ef4444', axis: 'trials' },
  { key: 'trialBilling',    label: 'Billing Issues',  color: '#f59e0b', axis: 'trials' },
];

// ─── Helpers ─────────────────────────────────────────────────────────

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

function formatCurrency(num: number): string {
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

function formatPercent(num: number): string {
  return `${(num * 100).toFixed(1)}%`;
}

function formatMetricValue(value: number, valueType: string): string {
  if (valueType === 'currency') return formatCurrency(value);
  if (valueType === 'percentage') return formatPercent(value);
  return formatNumber(value);
}

type Granularity = 'day' | 'week' | 'month' | 'year';

// ─── Component ───────────────────────────────────────────────────────

export default function RevenuePage() {
  const { currentOrgId, currentProjectId } = useAuth();
  const navigate = useNavigate();

  // Layout
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filters
  const [timeRange, setTimeRange] = useState<RevenueTimeRange>('30d');
  const [selectedMetric, setSelectedMetric] = useState<SuperwallMetricKey>('grossRevenue');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [visibleSeries, setVisibleSeries] = useState<Set<OverlayKey>>(new Set(['metric', 'views']));

  const toggleSeries = useCallback((key: OverlayKey) => {
    setVisibleSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Data
  const [superwallData, setSuperwallData] = useState<SuperwallDataPoint[]>([]);
  const [viewsByDate, setViewsByDate] = useState<Map<string, number>>(new Map());
  const [videosByDate, setVideosByDate] = useState<Map<string, VideoDelta[]>>(new Map());
  const [trialCohorts, setTrialCohorts] = useState<TrialCohortRow[]>([]);
  const [loadingTrials, setLoadingTrials] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  // Provider detection
  const [provider, setProvider] = useState<RevenueProvider>(null);
  const [superwallAppId, setSuperwallAppId] = useState<string | null>(null);

  // ─── Detect which revenue provider is configured ─────────────────
  useEffect(() => {
    if (!currentOrgId) return;
    (async () => {
      try {
        const settingsSnap = await getDocs(
          query(collection(db, 'organizations', currentOrgId, 'settings'))
        );
        const general = settingsSnap.docs.find(d => d.id === 'general');
        const data = general?.data();

        const swAppId = data?.integrations?.superwall?.applicationId;
        const rcProjectId = data?.integrations?.revenuecat?.projectId;

        if (swAppId) {
          setProvider('superwall');
          setSuperwallAppId(swAppId);
          setNotConfigured(false);
        } else if (rcProjectId) {
          setProvider('revenuecat');
          setNotConfigured(false);
        } else {
          setNotConfigured(true);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load revenue settings:', err);
        setNotConfigured(true);
        setLoading(false);
      }
    })();
  }, [currentOrgId]);

  // ─── Fetch chart data (Superwall or RevenueCat) ──────────────────
  useEffect(() => {
    if (!currentOrgId || !provider) return;
    if (provider === 'superwall' && !superwallAppId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (provider === 'superwall') {
          // ── Superwall path ──
          const { xAxis, dimension } = SuperwallService.getMetricAxis(selectedMetric);
          const dateFilterObj: any = { dimension };

          if (timeRange === '2y') {
            const now = new Date();
            const twoYearsAgo = new Date(now);
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
            dateFilterObj.preset = 'custom';
            dateFilterObj.range = {
              from: twoYearsAgo.toISOString().split('.')[0],
              to: now.toISOString().split('.')[0],
            };
          } else {
            const presetMap: Record<string, string> = {
              '7d': 'last_7_days',
              '30d': 'last_30_days',
              '90d': 'last_90_days',
              '180d': 'last_180_days',
              '1y': 'last_365_days',
            };
            dateFilterObj.preset = presetMap[timeRange] || 'last_30_days';
          }

          const res = await SuperwallService.fetchChartData({
            orgId: currentOrgId,
            applicationId: superwallAppId!,
            yAxis: selectedMetric,
            xAxis,
            dateFilter: dateFilterObj,
            dateInterval: granularity,
          });

          if (!cancelled) setSuperwallData(res.data || []);

        } else {
          // ── RevenueCat path ──
          const resolution = RevenueCatService.getResolution(granularity);
          const { startDate, endDate } = RevenueCatService.getTimeRange(timeRange);
          const points = await RevenueCatService.fetchMetricData(
            currentOrgId, selectedMetric, resolution, startDate, endDate
          );

          // Convert to Superwall-compatible format so the rest of the page works unchanged
          if (!cancelled) {
            setSuperwallData(points.map(p => ({
              x: p.x,
              incomplete: p.incomplete,
              values: { [selectedMetric]: { y: p.value } },
            })));
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          if (err.message?.includes('NOT_CONFIGURED')) {
            setNotConfigured(true);
          } else {
            setError(err.message || 'Failed to load revenue data');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [currentOrgId, provider, superwallAppId, timeRange, selectedMetric, granularity]);

  // ─── Fetch views data from snapshot deltas ─────────────────────────
  // Loads all snapshots from subcollections, groups by videoId,
  // diffs consecutive snapshots, and buckets view gains by date.
  useEffect(() => {
    if (!currentOrgId || !currentProjectId) return;

    (async () => {
      try {
        // Fetch all snapshots for every video in this project via individual video queries
        // (collectionGroup would pull snapshots from ALL orgs/projects)
        const videosRef = collection(
          db, 'organizations', currentOrgId,
          'projects', currentProjectId, 'videos'
        );
        const videosSnap = await getDocs(query(videosRef));

        // For each video, fetch its snapshots subcollection + store metadata
        const videoMeta = new Map<string, { title: string; handle: string; thumbnail: string }>();
        const snapshotsByVideo = new Map<string, any[]>();

        const fetchPromises = videosSnap.docs.map(async (videoDoc) => {
          const vData = videoDoc.data();
          videoMeta.set(videoDoc.id, {
            title: vData.videoTitle || vData.caption || vData.title || 'Untitled',
            handle: vData.uploaderHandle || vData.uploader || '',
            thumbnail: vData.thumbnail || '',
          });

          const snapsRef = collection(
            db, 'organizations', currentOrgId,
            'projects', currentProjectId,
            'videos', videoDoc.id, 'snapshots'
          );
          const snapsSnap = await getDocs(query(snapsRef, orderBy('capturedAt', 'asc')));
          if (snapsSnap.size >= 2) {
            snapshotsByVideo.set(videoDoc.id, snapsSnap.docs.map(d => d.data()));
          }
        });
        await Promise.all(fetchPromises);

        // Compute deltas — both aggregate and per-video
        const viewsMap = new Map<string, number>();
        const videosMap = new Map<string, VideoDelta[]>();

        snapshotsByVideo.forEach((snapshots, videoId) => {
          const meta = videoMeta.get(videoId) || { title: 'Untitled', handle: '', thumbnail: '' };

          for (let i = 1; i < snapshots.length; i++) {
            const prev = snapshots[i - 1];
            const curr = snapshots[i];

            const prevViews = prev.views || 0;
            const currViews = curr.views || 0;
            const delta = currViews - prevViews;

            if (delta <= 0) continue;

            const currDate = curr.capturedAt?.toDate?.() ?? (curr.capturedAt ? new Date(curr.capturedAt) : null);
            if (!currDate) continue;

            const dateKey = currDate.toISOString().split('T')[0];
            viewsMap.set(dateKey, (viewsMap.get(dateKey) || 0) + delta);

            // Track per-video breakdown
            const existing = videosMap.get(dateKey) || [];
            const videoEntry = existing.find(v => v.title === meta.title && v.handle === meta.handle);
            if (videoEntry) {
              videoEntry.views += delta;
            } else {
              existing.push({ ...meta, views: delta });
            }
            videosMap.set(dateKey, existing);
          }
        });

        setViewsByDate(viewsMap);
        setVideosByDate(videosMap);
      } catch (err) {
        console.error('Failed to load views data:', err);
      }
    })();
  }, [currentOrgId, currentProjectId]);

  // ─── Fetch trial cohort data ──────────────────────────────────────
  useEffect(() => {
    if (!currentOrgId || !provider) return;
    if (provider === 'superwall' && !superwallAppId) return;
    let cancelled = false;

    (async () => {
      setLoadingTrials(true);
      try {
        let rows: TrialCohortRow[] = [];

        // Build Superwall preset from timeRange
        let swPreset: string;
        if (timeRange === '2y') {
          swPreset = 'custom';
        } else {
          const presetMap: Record<string, string> = {
            '7d': 'last_7_days', '30d': 'last_30_days', '90d': 'last_90_days',
            '180d': 'last_180_days', '1y': 'last_365_days',
          };
          swPreset = presetMap[timeRange] || 'last_30_days';
        }

        if (provider === 'superwall') {
          // ── Superwall: 6 separate metric calls ──
          const buildDateFilter = (dim: 'purchaseDate' | 'installDate' | 'firstPurchaseDate' | 'tsDate' | 'mrrDate') => {
            if (timeRange === '2y') {
              const now = new Date();
              const twoYearsAgo = new Date(now);
              twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
              return { dimension: dim, preset: 'custom' as const, range: { from: twoYearsAgo.toISOString().split('.')[0], to: now.toISOString().split('.')[0] } };
            }
            return { dimension: dim, preset: swPreset };
          };

          const fetchMetric = (yAxis: string, xAxis: string, dim: 'purchaseDate' | 'installDate' | 'firstPurchaseDate' | 'tsDate' | 'mrrDate') =>
            SuperwallService.fetchChartData({
              orgId: currentOrgId,
              applicationId: superwallAppId!,
              yAxis, xAxis,
              dateFilter: buildDateFilter(dim),
              dateInterval: 'day' as const,
            });

          const [starts, conversions, cancellations, expirations, billing, pending] =
            await Promise.all([
              fetchMetric('trialStarts', 'purchaseDate', 'purchaseDate'),
              fetchMetric('trialConversions', 'installDate', 'installDate'),
              fetchMetric('trialCancellations', 'purchaseDate', 'purchaseDate'),
              fetchMetric('trialExpirations', 'purchaseDate', 'purchaseDate'),
              fetchMetric('trialBillingIssues', 'purchaseDate', 'purchaseDate'),
              fetchMetric('trialPendings', 'purchaseDate', 'purchaseDate'),
            ]);

          if (cancelled) return;

          const toMap = (res: any): Map<string, number> => {
            const m = new Map<string, number>();
            for (const p of res.data || []) {
              const dateKey = p.x?.split('T')[0] || p.x;
              const keys = Object.keys(p.values || {});
              const entry = keys.length > 0 ? p.values[keys[0]] : undefined;
              const val = entry && typeof entry === 'object' && 'y' in entry ? (entry as any).y : 0;
              m.set(dateKey, val);
            }
            return m;
          };

          const startsMap = toMap(starts);
          const convMap = toMap(conversions);
          const cancelMap = toMap(cancellations);
          const expireMap = toMap(expirations);
          const billingMap = toMap(billing);
          const pendingMap = toMap(pending);

          const dates = [...startsMap.keys()].sort();
          for (const date of dates) {
            const s = startsMap.get(date) || 0;
            if (s === 0) continue;
            rows.push({
              date,
              started: s,
              converted: convMap.get(date) || 0,
              cancelled: cancelMap.get(date) || 0,
              expired: expireMap.get(date) || 0,
              billing: billingMap.get(date) || 0,
              pending: pendingMap.get(date) || 0,
            });
          }
        } else {
          // ── RevenueCat: single call, trial_conversion_rate has all measures ──
          const { startDate: rcStart, endDate: rcEnd } = RevenueCatService.getTimeRange(timeRange);
          const cohorts = await RevenueCatService.fetchTrialCohorts(
            currentOrgId, 'day', rcStart, rcEnd
          );

          if (cancelled) return;

          for (const [date, data] of [...cohorts.entries()].sort()) {
            if (data.started === 0) continue;
            rows.push({
              date,
              started: data.started,
              converted: data.converted,
              cancelled: 0,
              expired: data.expired,
              billing: 0,
              pending: data.pending,
            });
          }
        }

        setTrialCohorts(rows.reverse());
      } catch (err) {
        console.error('Failed to load trial cohort data:', err);
      } finally {
        if (!cancelled) setLoadingTrials(false);
      }
    })();

    return () => { cancelled = true; };
  }, [currentOrgId, provider, superwallAppId, timeRange]);

  // Build a quick trial cohort lookup by date
  const trialByDate = useMemo(() => {
    const m = new Map<string, TrialCohortRow>();
    for (const row of trialCohorts) m.set(row.date, row);
    return m;
  }, [trialCohorts]);

  // ─── Merge Superwall data + views into chart data ────────────────
  // Superwall buckets data by the selected granularity (day/week/month/year).
  // Views are stored as daily deltas. When granularity > day, we need to sum
  // all daily view deltas that fall within each Superwall bucket.
  const chartData = useMemo<MergedDataPoint[]>(() => {
    if (superwallData.length === 0) return [];

    // Build sorted bucket start dates for range matching
    const bucketStarts = superwallData.map(p => new Date((p.x?.split('T')[0] || p.x) + 'T00:00:00').getTime());

    return superwallData.map((point, idx) => {
      const dateKey = point.x?.split('T')[0] || point.x;
      const bucketStart = bucketStarts[idx];
      const bucketEnd = idx < bucketStarts.length - 1
        ? bucketStarts[idx + 1]
        : bucketStart + (granularity === 'year' ? 366 : granularity === 'month' ? 31 : granularity === 'week' ? 7 : 1) * 86400000;

      // Extract Superwall metric value
      let metricValue = 0;
      if (point.values) {
        const keys = Object.keys(point.values);
        const entry = keys.length > 0 ? point.values[keys[0]] : undefined;
        if (entry && typeof entry === 'object' && 'y' in entry) {
          metricValue = (entry as any).y;
        } else if (typeof entry === 'number') {
          metricValue = entry;
        }
      }

      // Sum view deltas + collect video breakdowns that fall within this bucket
      let views = 0;
      const breakdown: VideoDelta[] = [];

      if (granularity === 'day') {
        views = viewsByDate.get(dateKey) || 0;
        const vids = videosByDate.get(dateKey);
        if (vids) breakdown.push(...vids);
      } else {
        viewsByDate.forEach((delta, vDateKey) => {
          const vTime = new Date(vDateKey + 'T00:00:00').getTime();
          if (vTime >= bucketStart && vTime < bucketEnd) {
            views += delta;
            const vids = videosByDate.get(vDateKey);
            if (vids) {
              // Merge into breakdown, combining duplicates
              for (const v of vids) {
                const existing = breakdown.find(b => b.title === v.title && b.handle === v.handle);
                if (existing) {
                  existing.views += v.views;
                } else {
                  breakdown.push({ ...v });
                }
              }
            }
          }
        });
      }

      // Sort by views descending
      breakdown.sort((a, b) => b.views - a.views);

      // Sum trial cohort data for this bucket
      let trialStarts = 0, trialConverted = 0, trialCancelled = 0, trialBilling = 0;
      if (granularity === 'day') {
        const t = trialByDate.get(dateKey);
        if (t) { trialStarts = t.started; trialConverted = t.converted; trialCancelled = t.cancelled; trialBilling = t.billing; }
      } else {
        trialByDate.forEach((t, tDate) => {
          const tTime = new Date(tDate + 'T00:00:00').getTime();
          if (tTime >= bucketStart && tTime < bucketEnd) {
            trialStarts += t.started; trialConverted += t.converted;
            trialCancelled += t.cancelled; trialBilling += t.billing;
          }
        });
      }

      return { date: dateKey, views, metric: metricValue, trialStarts, trialConverted, trialCancelled, trialBilling, videoBreakdown: breakdown };
    });
  }, [superwallData, viewsByDate, videosByDate, trialByDate]);

  // ─── KPI summaries ───────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalMetric = chartData.reduce((sum, d) => sum + d.metric, 0);
    const totalViews = chartData.reduce((sum, d) => sum + d.views, 0);
    return { totalMetric, totalViews };
  }, [chartData]);

  const activeMetricDef = SUPERWALL_METRICS.find(m => m.key === selectedMetric)!;

  // ─── Format date labels ──────────────────────────────────────────
  const formatDateLabel = useCallback((dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    if (granularity === 'year') {
      return d.toLocaleDateString('en-US', { year: 'numeric' });
    }
    if (granularity === 'month') {
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, [granularity]);

  // ─── Chart tooltip ───────────────────────────────────────────────
  const seriesLabelMap: Record<string, string> = {
    metric: activeMetricDef.label,
    views: 'Views',
    trialStarts: 'Trial Starts',
    trialConverted: 'Converted',
    trialCancelled: 'Cancelled',
    trialBilling: 'Billing Issues',
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const dataPoint: MergedDataPoint | undefined = payload[0]?.payload;
    const videos = dataPoint?.videoBreakdown || [];
    const topVideos = videos.slice(0, 5);
    const remaining = videos.length - topVideos.length;

    return (
      <div
        className="backdrop-blur-xl text-content rounded-xl border border-border shadow-2xl max-w-xs"
        style={{ backgroundColor: 'var(--surface-tertiary)', padding: '12px 16px' }}
      >
        <p className="text-sm font-semibold text-content mb-2">{label}</p>

        {/* All visible series */}
        <div className="space-y-1.5">
          {payload.map((entry: any, i: number) => {
            const isCurrency = entry.dataKey === 'metric' && (activeMetricDef.valueType === 'currency');
            const isPct = entry.dataKey === 'metric' && (activeMetricDef.valueType === 'percentage');
            return (
              <div key={i} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs text-content-secondary">
                    {seriesLabelMap[entry.dataKey] || entry.dataKey}
                  </span>
                </div>
                <span className="text-sm font-bold text-content">
                  {isCurrency ? formatCurrency(entry.value)
                    : isPct ? formatPercent(entry.value)
                    : formatNumber(entry.value)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Video breakdown */}
        {topVideos.length > 0 && visibleSeries.has('views') && (
          <div className="mt-3 pt-3 border-t border-border-subtle">
            <p className="text-[10px] text-content-muted uppercase tracking-wider mb-2">
              Top videos
            </p>
            <div className="space-y-2">
              {topVideos.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  {v.thumbnail ? (
                    <img
                      src={v.thumbnail}
                      alt=""
                      className="w-7 h-7 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded bg-surface-hover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-content truncate leading-tight">
                      {v.title.length > 40 ? v.title.slice(0, 40) + '...' : v.title}
                    </p>
                    {v.handle && (
                      <p className="text-[10px] text-content-muted leading-tight">@{v.handle.replace('@', '')}</p>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-500 flex-shrink-0">
                    +{formatNumber(v.views)}
                  </span>
                </div>
              ))}
            </div>
            {remaining > 0 && (
              <p className="text-[10px] text-content-muted mt-1.5">
                +{remaining} more video{remaining > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar
        onCollapsedChange={setSidebarCollapsed}
        isMobileOpen={mobileMenuOpen}
        onMobileToggle={setMobileMenuOpen}
      />

      <main
        className="flex-1 transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? '4rem' : '16rem' }}
      >
        <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-content">Revenue</h1>
              <p className="text-sm text-content-muted mt-1">
                Compare your tracked views against revenue metrics from Superwall
              </p>
            </div>
            {/* Time range selector */}
            <div className="flex items-center bg-surface-secondary rounded-lg border border-border-subtle p-0.5">
              {TIME_RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setTimeRange(opt.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    timeRange === opt.key
                      ? 'bg-content text-content-inverse shadow-sm'
                      : 'text-content-muted hover:text-content-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Not configured state */}
          {notConfigured && (
            <div className="rounded-2xl border border-border-subtle bg-surface-secondary p-8 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-surface-tertiary flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-content-muted" />
              </div>
              <h3 className="text-lg font-semibold text-content mb-2">Connect a Revenue Provider</h3>
              <p className="text-sm text-content-muted max-w-md mx-auto mb-6">
                Connect Superwall or RevenueCat in Settings to start
                seeing revenue data alongside your tracked views.
              </p>
              <button
                onClick={() => navigate('/settings/organization')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-content text-content-inverse rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Settings className="w-4 h-4" />
                Go to Settings
              </button>
            </div>
          )}

          {/* KPI Cards */}
          {!notConfigured && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
              <KPICard
                label={activeMetricDef.label}
                value={formatMetricValue(kpis.totalMetric, activeMetricDef.valueType)}
                icon={<DollarSign className="w-4 h-4" />}
                color="#3b82f6"
                loading={loading}
              />
              <KPICard
                label="Total Views"
                value={formatNumber(kpis.totalViews)}
                icon={<TrendingUp className="w-4 h-4" />}
                color="#10b981"
                loading={loading}
              />
              <KPICard
                label="Trial Starts"
                value={formatNumber(chartData.reduce((s, d) => s + d.trialStarts, 0))}
                icon={<Users className="w-4 h-4" />}
                color="#8b5cf6"
                loading={loading}
              />
              <KPICard
                label="Cancelled"
                value={formatNumber(chartData.reduce((s, d) => s + d.trialCancelled, 0))}
                icon={<Repeat className="w-4 h-4" />}
                color="#ef4444"
                loading={loading}
              />
            </div>
          )}

          {/* Main Chart */}
          {!notConfigured && (
            <div className="relative rounded-2xl backdrop-blur border border-border-subtle shadow-theme bg-surface-secondary overflow-hidden">
              <div className="relative z-10 p-5">
                {/* Row 1: Title + Revenue metric selector */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                  <h3 className="text-lg font-bold text-content">Revenue Dashboard</h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-content-muted uppercase tracking-wider mr-1">Revenue metric:</span>
                    {SUPERWALL_METRICS.map(m => (
                      <button
                        key={m.key}
                        onClick={() => setSelectedMetric(m.key)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                          selectedMetric === m.key
                            ? 'bg-blue-500/15 text-blue-500 border border-blue-500/30'
                            : 'bg-surface-tertiary text-content-muted border border-transparent hover:text-content-secondary hover:border-border-subtle'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Row 2: Series toggles + Granularity */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {OVERLAY_SERIES.map(s => {
                      const isOn = visibleSeries.has(s.key);
                      // For the revenue metric label, show the currently selected metric name
                      const label = s.key === 'metric' ? activeMetricDef.label : s.label;
                      return (
                        <button
                          key={s.key}
                          onClick={() => toggleSeries(s.key)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                            isOn
                              ? 'border-border-strong bg-surface-tertiary text-content'
                              : 'border-transparent bg-transparent text-content-muted hover:bg-surface-hover'
                          }`}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-sm transition-opacity"
                            style={{ backgroundColor: s.color, opacity: isOn ? 1 : 0.3 }}
                          />
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Granularity selector */}
                  <div className="flex items-center bg-surface-tertiary rounded-lg border border-border-subtle p-0.5">
                    {([['day', 'D'], ['week', 'W'], ['month', 'M'], ['year', 'Y']] as [Granularity, string][]).map(([g, label]) => (
                      <button
                        key={g}
                        onClick={() => setGranularity(g)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                          granularity === g
                            ? 'bg-surface-active text-content shadow-sm'
                            : 'text-content-muted hover:text-content-secondary'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chart */}
                <div className="rounded-xl overflow-hidden" style={{ minHeight: '380px' }}>
                  {loading ? (
                    <div className="h-[380px] flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-border border-t-blue-500 rounded-full animate-spin" />
                    </div>
                  ) : error ? (
                    <div className="h-[380px] flex items-center justify-center text-sm text-red-400">
                      {error}
                    </div>
                  ) : chartData.length === 0 ? (
                    <div className="h-[380px] flex items-center justify-center text-sm text-content-muted">
                      No data for this period
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={380}>
                      <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 40, left: 0, bottom: 5 }}
                      >
                        <defs>
                          {OVERLAY_SERIES.map(s => (
                            <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                            </linearGradient>
                          ))}
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
                          tickFormatter={formatDateLabel}
                        />
                        {/* Left axis: currency metric */}
                        <YAxis
                          yAxisId="left"
                          stroke="#3b82f6"
                          tick={{ fill: '#3b82f6', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => formatMetricValue(v, activeMetricDef.valueType)}
                          hide={!visibleSeries.has('metric')}
                        />
                        {/* Right axis: views (large scale) */}
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#10b981"
                          tick={{ fill: '#10b981', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={formatNumber}
                          hide={!visibleSeries.has('views')}
                        />
                        {/* Third axis: trial counts (small scale, independent) */}
                        {(() => {
                          const anyTrialOn = ['trialStarts', 'trialConverted', 'trialCancelled', 'trialBilling'].some(k => visibleSeries.has(k as OverlayKey));
                          return (
                            <YAxis
                              yAxisId="trials"
                              orientation="right"
                              stroke="#8b5cf6"
                              tick={{ fill: '#8b5cf6', fontSize: 11 }}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={formatNumber}
                              hide={!anyTrialOn}
                              width={anyTrialOn && visibleSeries.has('views') ? 50 : undefined}
                            />
                          );
                        })()}
                        <Tooltip
                          content={<CustomTooltip />}
                          wrapperStyle={{ zIndex: 9999, pointerEvents: 'none' }}
                          isAnimationActive={false}
                        />
                        {/* Render each visible series */}
                        {OVERLAY_SERIES.map(s => visibleSeries.has(s.key) && (
                          <Area
                            key={s.key}
                            yAxisId={s.axis}
                            type="monotone"
                            dataKey={s.key}
                            stroke={s.color}
                            strokeWidth={2}
                            fill={`url(#gradient-${s.key})`}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Trial Cohorts */}
          {!notConfigured && (
            <div className="rounded-2xl border border-border-subtle bg-surface-secondary overflow-hidden">
              <div className="p-5 pb-3">
                <h3 className="text-lg font-bold text-content">Trial Cohorts</h3>
                <p className="text-xs text-content-muted mt-1">
                  Each row is a day's trial batch. Rows older than 3 days show the final outcome.
                </p>
              </div>

              {loadingTrials ? (
                <div className="p-8 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-border border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : trialCohorts.length === 0 ? (
                <div className="p-8 text-center text-sm text-content-muted">
                  No trial data available
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-t border-b border-border-subtle">
                        <th className="text-left text-[10px] font-semibold text-content-muted uppercase tracking-wider px-5 py-2.5">Cohort</th>
                        <th className="text-right text-[10px] font-semibold text-content-muted uppercase tracking-wider px-3 py-2.5">Started</th>
                        <th className="text-right text-[10px] font-semibold text-content-muted uppercase tracking-wider px-3 py-2.5">Converted</th>
                        <th className="text-right text-[10px] font-semibold text-content-muted uppercase tracking-wider px-3 py-2.5">Cancelled</th>
                        <th className="text-right text-[10px] font-semibold text-content-muted uppercase tracking-wider px-3 py-2.5">Billing</th>
                        <th className="text-right text-[10px] font-semibold text-content-muted uppercase tracking-wider px-3 py-2.5">Expired</th>
                        <th className="text-right text-[10px] font-semibold text-content-muted uppercase tracking-wider px-3 py-2.5">Pending</th>
                        <th className="text-left text-[10px] font-semibold text-content-muted uppercase tracking-wider px-5 py-2.5">Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialCohorts.map((row) => {
                        const d = new Date(row.date + 'T00:00:00');
                        const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                        const daysAgo = Math.round((Date.now() - d.getTime()) / 86400000);
                        const isMature = daysAgo >= 3;
                        const statusLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`;

                        const convPct = row.started > 0 ? (row.converted / row.started) * 100 : 0;
                        const cancelPct = row.started > 0 ? (row.cancelled / row.started) * 100 : 0;
                        const billingPct = row.started > 0 ? (row.billing / row.started) * 100 : 0;
                        const pendingPct = row.started > 0 ? (row.pending / row.started) * 100 : 0;
                        const expiredPct = row.started > 0 ? (row.expired / row.started) * 100 : 0;

                        // The cohort from 3 days ago is converting today
                        const isConvertingToday = daysAgo === 3;

                        return (
                          <tr
                            key={row.date}
                            className={`group/row border-b transition-colors ${
                              isConvertingToday
                                ? 'bg-emerald-500/8 border-emerald-500/20 hover:bg-emerald-500/12'
                                : isMature
                                ? 'border-border-subtle/50 hover:bg-surface-hover/50'
                                : 'border-border-subtle/50 opacity-60 hover:opacity-80'
                            }`}
                          >
                            {/* Date + status badge */}
                            <td className="px-5 py-3 whitespace-nowrap">
                              <span className="font-medium text-content">{dateLabel}</span>
                              <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                isConvertingToday
                                  ? 'bg-emerald-500/15 text-emerald-500'
                                  : isMature
                                  ? 'bg-surface-tertiary text-content-secondary'
                                  : 'bg-blue-500/10 text-blue-400'
                              }`}>
                                {isConvertingToday ? 'Converting today' : isMature ? statusLabel : `In trial · ${statusLabel}`}
                              </span>
                            </td>

                            <td className="text-right px-3 py-3 font-semibold text-content tabular-nums">
                              {row.started}
                            </td>

                            {/* Converted */}
                            <td className="text-right px-3 py-3 tabular-nums">
                              <span className={`font-semibold ${row.converted > 0 ? 'text-emerald-500' : 'text-content-muted'}`}>
                                {row.converted}
                              </span>
                              {isMature && row.started > 0 && (
                                <span className="text-[10px] text-content-muted ml-1 hidden group-hover/row:inline">{convPct.toFixed(0)}%</span>
                              )}
                            </td>

                            {/* Cancelled */}
                            <td className="text-right px-3 py-3 tabular-nums">
                              <span className={`font-semibold ${row.cancelled > 0 ? 'text-red-400' : 'text-content-muted'}`}>
                                {row.cancelled}
                              </span>
                              {isMature && row.started > 0 && (
                                <span className="text-[10px] text-content-muted ml-1 hidden group-hover/row:inline">{cancelPct.toFixed(0)}%</span>
                              )}
                            </td>

                            {/* Billing */}
                            <td className="text-right px-3 py-3 tabular-nums">
                              <span className={`font-semibold ${row.billing > 0 ? 'text-amber-400' : 'text-content-muted'}`}>
                                {row.billing}
                              </span>
                              {isMature && row.billing > 0 && (
                                <span className="text-[10px] text-content-muted ml-1 hidden group-hover/row:inline">{billingPct.toFixed(0)}%</span>
                              )}
                            </td>

                            {/* Expired */}
                            <td className="text-right px-3 py-3 tabular-nums">
                              <span className={`font-semibold ${row.expired > 0 ? 'text-content-secondary' : 'text-content-muted'}`}>
                                {row.expired}
                              </span>
                              {isMature && row.expired > 0 && (
                                <span className="text-[10px] text-content-muted ml-1 hidden group-hover/row:inline">{expiredPct.toFixed(0)}%</span>
                              )}
                            </td>

                            {/* Pending */}
                            <td className="text-right px-3 py-3 tabular-nums">
                              {row.pending > 0 ? (
                                <span className="font-semibold text-blue-400">{row.pending}</span>
                              ) : (
                                <span className="text-content-muted">0</span>
                              )}
                            </td>

                            {/* Outcome bar + summary */}
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-tertiary w-28 flex-shrink-0">
                                  {convPct > 0 && (
                                    <div className="bg-emerald-500 transition-all" style={{ width: `${convPct}%` }} />
                                  )}
                                  {cancelPct > 0 && (
                                    <div className="bg-red-400 transition-all" style={{ width: `${cancelPct}%` }} />
                                  )}
                                  {billingPct > 0 && (
                                    <div className="bg-amber-400 transition-all" style={{ width: `${billingPct}%` }} />
                                  )}
                                  {expiredPct > 0 && (
                                    <div className="bg-gray-500 transition-all" style={{ width: `${expiredPct}%` }} />
                                  )}
                                  {pendingPct > 0 && (
                                    <div className="bg-blue-400 transition-all" style={{ width: `${pendingPct}%` }} />
                                  )}
                                </div>
                                {/* Quick verdict for mature cohorts */}
                                {isMature && row.started > 0 && (
                                  <span className={`text-[10px] font-semibold whitespace-nowrap ${
                                    convPct >= 10 ? 'text-emerald-500'
                                      : cancelPct >= 50 ? 'text-red-400'
                                      : 'text-content-muted'
                                  }`}>
                                    {convPct >= 10
                                      ? `${convPct.toFixed(0)}% converted`
                                      : cancelPct >= 50
                                      ? `${cancelPct.toFixed(0)}% lost`
                                      : billingPct >= 30
                                      ? `${billingPct.toFixed(0)}% billing`
                                      : `${cancelPct.toFixed(0)}% lost`}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Legend */}
              {trialCohorts.length > 0 && (
                <div className="px-5 py-3 border-t border-border-subtle flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-[10px] text-content-muted">Converted</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-red-400" />
                    <span className="text-[10px] text-content-muted">Cancelled</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                    <span className="text-[10px] text-content-muted">Billing Issues</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-gray-500" />
                    <span className="text-[10px] text-content-muted">Expired</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-blue-400" />
                    <span className="text-[10px] text-content-muted">Pending (in trial)</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  icon,
  color,
  loading,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-secondary p-4 md:p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-content-muted uppercase tracking-wider">{label}</span>
        <div style={{ color }} className="opacity-60">
          {icon}
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-surface-tertiary rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-bold text-content">{value}</p>
      )}
    </div>
  );
}
