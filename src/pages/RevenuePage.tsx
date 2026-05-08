import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Users, AlertCircle, Settings, ChevronDown, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import { PlatformIcon } from '../components/ui/PlatformIcon';
import { useAuth } from '../contexts/AuthContext';
import SuperwallService, {
  SUPERWALL_METRICS,
  SuperwallMetricKey,
  SuperwallDataPoint,
} from '../services/SuperwallService';
import RevenueCatService from '../services/RevenueCatService';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import UnifiedMetricsChart from '../components/UnifiedMetricsChart';
import type { VideoSubmission, VideoSnapshot } from '../types';
import DateRangeFilter, { type DateFilterType } from '../components/DateRangeFilter';
import DateFilterService from '../services/DateFilterService';

type RevenueProvider = 'superwall' | 'revenuecat' | null;

// ─── Types ───────────────────────────────────────────────────────────

interface DateRange {
  startDate: Date;
  endDate: Date;
}

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
  platform?: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  uploaderName?: string;
  uploaderProfilePic?: string;
}

type Granularity = 'day' | 'week' | 'month' | 'year';

// ─── Component ───────────────────────────────────────────────────────

export default function RevenuePage() {
  const { currentOrgId, currentProjectId } = useAuth();
  const navigate = useNavigate();

  // Layout
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filters — date filter (with optional custom calendar range) drives every
  // fetch; the sticky header's calendar surfaces both presets and custom ranges
  // so the page works exactly like the Dashboard's date selector.
  const [dateFilter, setDateFilter] = useState<DateFilterType>('last30days');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedMetric, setSelectedMetric] = useState<SuperwallMetricKey>('grossRevenue');
  // Multi-select: which revenue types are stacked on the chart at once. The
  // single `selectedMetric` above stays as the "primary" (drives KPIs, trial
  // cohort downstream stuff), and is always present in this set.
  const [selectedRevenueOptions, setSelectedRevenueOptions] = useState<SuperwallMetricKey[]>(['grossRevenue']);
  const [granularity, setGranularity] = useState<Granularity>('day');

  // Stable date range — recomputed when filter / custom range changes. Every
  // fetch effect reads from this so they all stay in sync.
  const { startDate: rangeStart, endDate: rangeEnd } = useMemo(
    () => DateFilterService.getDateRange(dateFilter, customDateRange),
    [dateFilter, customDateRange],
  );

  const handleDateFilterChange = useCallback((filter: DateFilterType, custom?: DateRange) => {
    setDateFilter(filter);
    setCustomDateRange(custom);
  }, []);

  // Format range as ISO date strings for service callers that need YYYY-MM-DD.
  const isoRange = useMemo(() => ({
    from: rangeStart.toISOString().split('.')[0],
    to: rangeEnd.toISOString().split('.')[0],
    fromDate: rangeStart.toISOString().split('T')[0],
    toDate: rangeEnd.toISOString().split('T')[0],
  }), [rangeStart, rangeEnd]);

  // Data
  const [superwallData, setSuperwallData] = useState<SuperwallDataPoint[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_viewsByDate, setViewsByDate] = useState<Map<string, number>>(new Map());
  const [videosByDate, setVideosByDate] = useState<Map<string, VideoDelta[]>>(new Map());
  // Downloads/newUsers daily map — fetched below for future reuse but no
  // longer consumed by the chart (the unified chart handles its own metric
  // pipeline). Kept as state so the existing fetch effect keeps populating it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_downloadsByDate, setDownloadsByDate] = useState<Map<string, number>>(new Map());
  const [trialCohorts, setTrialCohorts] = useState<TrialCohortRow[]>([]);
  /** Per-revenue-option daily series. Populated by the parallel multi-fetch
   *  effect, then forwarded to UnifiedMetricsChart so each toggled-on option
   *  becomes its own series. */
  const [revenueByDateByOption, setRevenueByDateByOption] = useState<Record<string, Record<string, number>>>({});
  /** Real VideoSubmission objects (with snapshots) — fed straight into
   *  UnifiedMetricsChart so the canonical sparkline/aggregation logic runs the
   *  same way it does on the Dashboard. Built from the same per-video query
   *  that already loads snapshots for the views deltas. */
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [selectedCreators, setSelectedCreators] = useState<Set<string>>(new Set());
  const [creatorDropdownOpen, setCreatorDropdownOpen] = useState(false);

  const toggleCreator = useCallback((handle: string) => {
    setSelectedCreators(prev => {
      const next = new Set(prev);
      if (next.has(handle)) next.delete(handle);
      else next.add(handle);
      return next;
    });
  }, []);
  const creatorDropdownRef = useRef<HTMLDivElement>(null);

  // Close creator dropdown when clicking outside
  useEffect(() => {
    if (!creatorDropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (creatorDropdownRef.current && !creatorDropdownRef.current.contains(e.target as Node)) {
        setCreatorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [creatorDropdownOpen]);
  const [loadingTrials, setLoadingTrials] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  // Provider detection
  const [provider, setProvider] = useState<RevenueProvider>(null);
  const [superwallAppId, setSuperwallAppId] = useState<string | null>(null);
  const [orgDefaultReportingView, setOrgDefaultReportingView] = useState<'organic' | 'total' | 'split' | undefined>(undefined);

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
        setOrgDefaultReportingView(data?.defaultReportingView);

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
          // ── Superwall path. Always use the custom range derived from the
          //    page-level date filter so any calendar selection works. ──
          const { xAxis, dimension } = SuperwallService.getMetricAxis(selectedMetric);
          const res = await SuperwallService.fetchChartData({
            orgId: currentOrgId,
            applicationId: superwallAppId!,
            yAxis: selectedMetric,
            xAxis,
            dateFilter: {
              dimension,
              preset: 'custom',
              range: { from: isoRange.from, to: isoRange.to },
            } as any,
            dateInterval: granularity,
          });

          if (!cancelled) setSuperwallData(res.data || []);

        } else {
          // ── RevenueCat path ──
          const resolution = RevenueCatService.getResolution(granularity);
          const points = await RevenueCatService.fetchMetricData(
            currentOrgId, selectedMetric, resolution, isoRange.fromDate, isoRange.toDate
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
  }, [currentOrgId, provider, superwallAppId, isoRange.from, isoRange.to, isoRange.fromDate, isoRange.toDate, selectedMetric, granularity]);

  // ─── Fetch ALL selected revenue options in parallel ──────────────
  // Powers the multi-revenue overlay on the chart. We always include the
  // primary `selectedMetric` so KPIs + the chart agree, then any extra
  // options the user has toggled on get their own daily series.
  // Tracks per-option in-flight state so newly-added chips show the chart
  // skeleton + their own shimmer until their fetch returns.
  const [pendingRevenueKeys, setPendingRevenueKeys] = useState<string[]>([]);
  useEffect(() => {
    if (!currentOrgId || !provider) return;
    if (provider === 'superwall' && !superwallAppId) return;
    if (selectedRevenueOptions.length === 0) return;
    let cancelled = false;
    // Mark every requested key as pending so the chip shimmer + chart
    // skeleton fire immediately on toggle (not after the await resolves).
    const requested = [...selectedRevenueOptions];
    setPendingRevenueKeys(requested);

    (async () => {
      try {
        const results = await Promise.all(selectedRevenueOptions.map(async (key) => {
          if (provider === 'superwall') {
            const { xAxis, dimension } = SuperwallService.getMetricAxis(key);
            const res = await SuperwallService.fetchChartData({
              orgId: currentOrgId,
              applicationId: superwallAppId!,
              yAxis: key,
              xAxis,
              dateFilter: { dimension, preset: 'custom', range: { from: isoRange.from, to: isoRange.to } } as any,
              dateInterval: granularity,
            });
            return { key, points: res.data || [] };
          } else {
            const resolution = RevenueCatService.getResolution(granularity);
            const points = await RevenueCatService.fetchMetricData(
              currentOrgId, key, resolution, isoRange.fromDate, isoRange.toDate
            );
            return {
              key,
              points: points.map(p => ({ x: p.x, incomplete: p.incomplete, values: { [key]: { y: p.value } } })) as SuperwallDataPoint[],
            };
          }
        }));

        if (cancelled) return;

        const next: Record<string, Record<string, number>> = {};
        for (const { key, points } of results) {
          const map: Record<string, number> = {};
          for (const point of points) {
            const dateKey = point.x?.split('T')[0] || point.x;
            let v = 0;
            if (point.values) {
              const ks = Object.keys(point.values);
              const entry = ks.length > 0 ? point.values[ks[0]] : undefined;
              if (entry && typeof entry === 'object' && 'y' in entry) v = (entry as any).y;
              else if (typeof entry === 'number') v = entry;
            }
            if (dateKey) map[dateKey] = (map[dateKey] || 0) + v;
          }
          next[key] = map;
        }
        setRevenueByDateByOption(next);
      } catch {
        // Silently ignore — primary fetch above surfaces any real config error.
      } finally {
        if (!cancelled) setPendingRevenueKeys([]);
      }
    })();

    return () => { cancelled = true; };
  }, [currentOrgId, provider, superwallAppId, isoRange.from, isoRange.to, isoRange.fromDate, isoRange.toDate, selectedRevenueOptions, granularity]);

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

        // For each video, fetch its snapshots subcollection + store metadata.
        // We build TWO things from the same data: (a) a metadata + raw-snapshots
        // map for the existing per-day delta calculation that powers KPIs +
        // creator filtering, and (b) the VideoSubmission[] needed by
        // UnifiedMetricsChart so the canonical chart logic runs unchanged.
        const videoMeta = new Map<string, { title: string; handle: string; thumbnail: string; platform?: any; uploaderName?: string; uploaderProfilePic?: string }>();
        const snapshotsByVideo = new Map<string, any[]>();
        const submissionAccum: VideoSubmission[] = [];

        const fetchPromises = videosSnap.docs.map(async (videoDoc) => {
          const vData = videoDoc.data();
          videoMeta.set(videoDoc.id, {
            title: vData.videoTitle || vData.caption || vData.title || 'Untitled',
            handle: vData.uploaderHandle || vData.uploader || '',
            thumbnail: vData.thumbnail || '',
            platform: vData.platform,
            uploaderName: vData.uploader || vData.uploaderHandle,
            uploaderProfilePic: vData.uploaderProfilePicture,
          });

          const snapsRef = collection(
            db, 'organizations', currentOrgId,
            'projects', currentProjectId,
            'videos', videoDoc.id, 'snapshots'
          );
          const snapsSnap = await getDocs(query(snapsRef, orderBy('capturedAt', 'asc')));
          const rawSnaps = snapsSnap.docs.map(d => d.data());
          if (snapsSnap.size >= 2) {
            snapshotsByVideo.set(videoDoc.id, rawSnaps);
          }

          // Build a VideoSubmission for the unified chart. Skip videos with
          // zero usable signal (no snapshots AND no current views) — they
          // contribute nothing to the chart and only dilute aggregation.
          if (rawSnaps.length > 0 || (vData.views || 0) > 0) {
            const snapshots: VideoSnapshot[] = rawSnaps.map((s: any, i: number) => ({
              id: `${videoDoc.id}_${i}`,
              videoId: videoDoc.id,
              views: s.views || 0,
              likes: s.likes || 0,
              comments: s.comments || 0,
              shares: s.shares || 0,
              saves: s.saves || 0,
              capturedAt: s.capturedAt?.toDate?.() ?? (s.capturedAt ? new Date(s.capturedAt) : new Date()),
              capturedBy: s.capturedBy || 'scheduled_refresh',
              isInitialSnapshot: i === 0,
            }));
            submissionAccum.push({
              id: videoDoc.id,
              url: vData.videoUrl || vData.url || '',
              platform: (vData.platform as VideoSubmission['platform']) || 'instagram',
              thumbnail: vData.thumbnail || '',
              title: vData.videoTitle || vData.caption || vData.title || 'Untitled',
              caption: vData.caption,
              uploader: vData.uploader || vData.uploaderHandle || '',
              uploaderHandle: vData.uploaderHandle || vData.uploader || '',
              uploaderProfilePicture: vData.uploaderProfilePicture,
              followerCount: vData.followerCount,
              trackedAccountId: vData.trackedAccountId,
              status: vData.status === 'archived' ? 'rejected' : 'approved',
              views: vData.views || 0,
              likes: vData.likes || 0,
              comments: vData.comments || 0,
              shares: vData.shares || 0,
              saves: vData.saves || 0,
              duration: vData.duration || 0,
              dateSubmitted: vData.dateAdded?.toDate?.() ?? new Date(),
              uploadDate: vData.uploadDate?.toDate?.() ?? new Date(),
              lastRefreshed: vData.lastRefreshed?.toDate?.(),
              isStale: vData.isStale || false,
              sparkedAt: vData.sparkedAt?.toDate?.() || undefined,
              sparkViewLogs: vData.sparkViewLogs || undefined,
              snapshots,
            });
          }
        });
        await Promise.all(fetchPromises);
        setSubmissions(submissionAccum);

        // Compute deltas — store per-video breakdown only (totals derived later for creator filtering)
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

            // Track per-video breakdown — combine same video on same day
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

        setVideosByDate(videosMap);

        // Derive aggregate viewsMap from videosMap (will be re-derived per creator filter)
        const viewsMap = new Map<string, number>();
        videosMap.forEach((vids, date) => {
          viewsMap.set(date, vids.reduce((s, v) => s + v.views, 0));
        });
        setViewsByDate(viewsMap);
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

        if (provider === 'superwall') {
          // ── Superwall: 6 separate metric calls — all use the page-level
          //    custom date range so calendar selections flow through. ──
          const buildDateFilter = (dim: 'purchaseDate' | 'installDate' | 'firstPurchaseDate' | 'tsDate' | 'mrrDate') => ({
            dimension: dim,
            preset: 'custom' as const,
            range: { from: isoRange.from, to: isoRange.to },
          });

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
          const cohorts = await RevenueCatService.fetchTrialCohorts(
            currentOrgId, 'day', isoRange.fromDate, isoRange.toDate
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
  }, [currentOrgId, provider, superwallAppId, isoRange.from, isoRange.to, isoRange.fromDate, isoRange.toDate]);

  // ─── Fetch downloads data (newUsers / customers_new) ──────────────
  useEffect(() => {
    if (!currentOrgId || !provider) return;
    if (provider === 'superwall' && !superwallAppId) return;
    let cancelled = false;

    (async () => {
      try {
        if (provider === 'superwall') {
          const res = await SuperwallService.fetchChartData({
            orgId: currentOrgId,
            applicationId: superwallAppId!,
            yAxis: 'newUsers',
            xAxis: 'installDate',
            dateFilter: {
              dimension: 'installDate',
              preset: 'custom',
              range: { from: isoRange.from, to: isoRange.to },
            } as any,
            dateInterval: granularity,
          });

          if (cancelled) return;
          const m = new Map<string, number>();
          for (const p of res.data || []) {
            const dateKey = p.x?.split('T')[0] || p.x;
            const keys = Object.keys(p.values || {});
            const entry = keys.length > 0 ? p.values[keys[0]] : undefined;
            const val = entry && typeof entry === 'object' && 'y' in entry ? (entry as any).y : 0;
            m.set(dateKey, val);
          }
          setDownloadsByDate(m);
        } else {
          const resolution = RevenueCatService.getResolution(granularity);
          const points = await RevenueCatService.fetchMetricData(
            currentOrgId, 'newUsers', resolution, isoRange.fromDate, isoRange.toDate
          );
          if (cancelled) return;
          const m = new Map<string, number>();
          for (const p of points) m.set(p.x, p.value);
          setDownloadsByDate(m);
        }
      } catch (err) {
        console.error('Failed to load downloads data:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [currentOrgId, provider, superwallAppId, isoRange.from, isoRange.to, isoRange.fromDate, isoRange.toDate, granularity]);

  // List of unique creators with platform/name/pic from all video snapshots
  const creatorList = useMemo(() => {
    const map = new Map<string, { handle: string; platform?: string; name?: string; profilePic?: string }>();
    videosByDate.forEach(vids => vids.forEach(v => {
      if (!v.handle || map.has(v.handle)) return;
      map.set(v.handle, {
        handle: v.handle,
        platform: v.platform,
        name: v.uploaderName || v.handle,
        profilePic: v.uploaderProfilePic,
      });
    }));
    return [...map.values()].sort((a, b) => a.handle.localeCompare(b.handle));
  }, [videosByDate]);

  // ─── Revenue map for UnifiedMetricsChart ─────────────────────────
  // Flattens superwallData into the simple { 'YYYY-MM-DD' → revenue } shape
  // the unified chart expects. The chart sums per-interval internally so it
  // stays correct across granularity changes.
  const revenueByDate = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const point of superwallData) {
      const dateKey = point.x?.split('T')[0] || point.x;
      let value = 0;
      if (point.values) {
        const keys = Object.keys(point.values);
        const entry = keys.length > 0 ? point.values[keys[0]] : undefined;
        if (entry && typeof entry === 'object' && 'y' in entry) value = (entry as any).y;
        else if (typeof entry === 'number') value = entry;
      }
      if (dateKey) out[dateKey] = (out[dateKey] || 0) + value;
    }
    return out;
  }, [superwallData]);

  // Submissions filtered by the page-level creator multi-select. Empty set
  // means "all", so we just return the full list to skip the work.
  const filteredSubmissions = useMemo(() => {
    if (selectedCreators.size === 0) return submissions;
    return submissions.filter(s => {
      const handle = (s.uploaderHandle || s.uploader || '').replace(/^@/, '');
      // RevenuePage tracks creators by raw handle (with or without @) — match
      // both forms so filter applies regardless of how the handle was stored.
      return selectedCreators.has(s.uploaderHandle) || selectedCreators.has(handle) || selectedCreators.has(`@${handle}`);
    });
  }, [submissions, selectedCreators]);

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
        {/* Fixed top bar — title on the left, calendar + granularity on the right.
            Same pattern as the other primary pages so navigating in feels uniform.
            Sits above the page content; body padding-top below makes room for it. */}
        <div
          className="fixed top-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border-subtle transition-all duration-300"
          style={{ left: sidebarCollapsed ? '4rem' : '16rem' }}
        >
          <div className="px-4 md:px-6 lg:px-8 py-3 max-w-[1400px] mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-content truncate">Revenue</h1>
              <p className="text-[11px] text-content-muted truncate hidden sm:block">
                Tracked views vs revenue metrics
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Granularity dropdown — same control the Dashboard uses, so
                  Daily/Weekly/Monthly/Yearly all read the same. */}
              <div className="relative hidden md:block">
                <select
                  value={granularity}
                  onChange={(e) => setGranularity(e.target.value as Granularity)}
                  className="appearance-none pl-3 pr-8 py-2 bg-surface-secondary text-content rounded-lg text-sm font-medium border border-border hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-border-strong transition-all cursor-pointer"
                >
                  <option value="day">Daily</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-content-muted pointer-events-none" />
              </div>
              {/* Calendar — same component the Dashboard uses, so presets +
                  custom range work identically. */}
              <DateRangeFilter
                selectedFilter={dateFilter}
                customRange={customDateRange}
                onFilterChange={handleDateFilterChange}
              />
            </div>
          </div>
        </div>

        <div
          className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6"
          style={{ paddingTop: '5.5rem' }}
        >
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

          {/* KPI cards removed — the unified chart's metric strip carries the
              same totals (Revenue, Views, Trial Starts, etc.) as draggable
              chips, so this top row was redundant. */}

          {/* Main Chart */}
          {!notConfigured && (
            <div className="relative rounded-2xl backdrop-blur border border-border-subtle shadow-theme bg-surface-secondary overflow-hidden">
              <div className="relative z-10 p-5">
                {/* Single toolbar row: just the creator filter, right-aligned.
                    Title + date + granularity all live in the sticky page header
                    now; revenue-type selection lives in the chart's hover popover
                    on the Revenue chip. */}
                <div className="flex items-center justify-end mb-4">
                  <div className="flex items-center gap-2">
                    {/* Creator filter — multi-select with profile pic, platform, name */}
                    {creatorList.length > 0 && (
                      <div className="relative" ref={creatorDropdownRef}>
                        <button
                          onClick={() => setCreatorDropdownOpen(o => !o)}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium bg-surface-tertiary border border-border-subtle text-content hover:border-border-strong transition-colors min-w-[200px] max-w-[280px]"
                        >
                          {(() => {
                            const count = selectedCreators.size;
                            if (count === 0) {
                              return (
                                <>
                                  <Users className="w-3.5 h-3.5 text-content-muted flex-shrink-0" />
                                  <span className="flex-1 text-left truncate">All creators ({creatorList.length})</span>
                                </>
                              );
                            }
                            if (count === 1) {
                              const handle = [...selectedCreators][0];
                              const sel = creatorList.find(c => c.handle === handle);
                              return (
                                <>
                                  {sel?.profilePic ? (
                                    <img src={sel.profilePic} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-surface-hover flex-shrink-0" />
                                  )}
                                  <span className="flex-1 text-left truncate">@{(sel?.handle || handle).replace('@', '')}</span>
                                  {sel?.platform && (
                                    <PlatformIcon platform={sel.platform as any} size="xs" className="flex-shrink-0" />
                                  )}
                                </>
                              );
                            }
                            // Multiple selected — show stacked avatars + count
                            const selected = [...selectedCreators].slice(0, 3).map(h => creatorList.find(c => c.handle === h)).filter(Boolean);
                            return (
                              <>
                                <div className="flex -space-x-1.5 flex-shrink-0">
                                  {selected.map((c, i) => (
                                    c?.profilePic ? (
                                      <img key={i} src={c.profilePic} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-surface-tertiary" />
                                    ) : (
                                      <div key={i} className="w-5 h-5 rounded-full bg-surface-hover ring-1 ring-surface-tertiary" />
                                    )
                                  ))}
                                </div>
                                <span className="flex-1 text-left truncate">{count} creators selected</span>
                              </>
                            );
                          })()}
                          <ChevronDown className={`w-3.5 h-3.5 text-content-muted flex-shrink-0 transition-transform ${creatorDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {creatorDropdownOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-72 max-h-96 rounded-xl bg-surface-secondary border border-border shadow-2xl z-50 flex flex-col">
                            {/* Header with clear */}
                            <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
                              <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">
                                {selectedCreators.size > 0 ? `${selectedCreators.size} selected` : `${creatorList.length} creators`}
                              </span>
                              {selectedCreators.size > 0 && (
                                <button
                                  onClick={() => setSelectedCreators(new Set())}
                                  className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                  Clear all
                                </button>
                              )}
                            </div>

                            {/* List */}
                            <div className="overflow-y-auto flex-1">
                              {creatorList.map(c => {
                                const isSelected = selectedCreators.has(c.handle);
                                return (
                                  <button
                                    key={c.handle}
                                    onClick={() => toggleCreator(c.handle)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover ${
                                      isSelected ? 'bg-surface-active' : ''
                                    }`}
                                  >
                                    {/* Checkbox */}
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                      isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-border-strong'
                                    }`}>
                                      {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                    </div>

                                    {/* Avatar */}
                                    {c.profilePic ? (
                                      <img src={c.profilePic} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-surface-tertiary flex items-center justify-center flex-shrink-0">
                                        <span className="text-xs text-content-muted font-semibold">
                                          {c.handle.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                    )}

                                    {/* Name + handle */}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-content truncate">@{c.handle.replace('@', '')}</p>
                                      {c.name && c.name !== c.handle && (
                                        <p className="text-[10px] text-content-muted truncate">{c.name}</p>
                                      )}
                                    </div>

                                    {/* Platform */}
                                    {c.platform && (
                                      <PlatformIcon platform={c.platform as any} size="sm" className="flex-shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>

                {/* Chart — same component the Dashboard uses, so the inner
                    aggregation, metric picker, chart-style switcher, day-drill
                    modal, and tooltip vocabulary all match exactly. Submissions
                    are filtered by the page-level creator selector before being
                    passed in; revenueByDate is built from the active Superwall /
                    RevenueCat fetch. */}
                <div className="rounded-xl overflow-hidden" style={{ minHeight: '380px' }}>
                  {error ? (
                    <div className="h-[380px] flex items-center justify-center text-sm text-red-400">
                      {error}
                    </div>
                  ) : (
                    <UnifiedMetricsChart
                      initialMetrics={['revenue', 'views']}
                      submissions={filteredSubmissions}
                      allSubmissions={submissions}
                      revenueByDate={revenueByDate}
                      revenueByDateByOption={revenueByDateByOption}
                      pendingRevenueKeys={pendingRevenueKeys}
                      revenueOptions={SUPERWALL_METRICS.map(m => ({ key: m.key, label: m.label, valueType: m.valueType }))}
                      selectedRevenueOptions={selectedRevenueOptions}
                      onRevenueOptionsChange={(keys) => {
                        const next = (keys.length > 0 ? keys : ['grossRevenue']) as SuperwallMetricKey[];
                        setSelectedRevenueOptions(next);
                        // Keep page-level KPIs / trial cohorts wired to the
                        // first toggled-on option so the rest of the page
                        // stays in sync with the chart's primary series.
                        setSelectedMetric(next[0]);
                      }}
                      dateFilter={dateFilter}
                      granularity={granularity}
                      dateRange={{ startDate: rangeStart, endDate: rangeEnd }}
                      isLoading={loading}
                      orgDefaultReportingView={orgDefaultReportingView}
                    />
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

