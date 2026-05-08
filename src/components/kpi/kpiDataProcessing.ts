import { VideoSubmission, VideoSnapshot } from '../../types';
import DataAggregationService, { IntervalType, TimeInterval } from '../../services/DataAggregationService';
import { DateFilterType } from '../DateRangeFilter';

/**
 * KPI Data Processing
 * Handles sparkline generation and metric calculations
 */

export interface KPITotals {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  /** Count of videos uploaded inside the period. */
  videos: number;
  /** Unique uploader handles active in the period. */
  accounts: number;
  /** (likes + comments) / views * 100 for the period. */
  engagement: number;
}

/**
 * Return the video's snapshots, augmented with a synthetic snapshot at
 * `video.lastRefreshed` reflecting current lifetime values WHEN those
 * differ from the most recent stored snapshot.
 *
 * The scrape-on-demand refresh button (and several ingestion paths)
 * update `video.views` / `video.likes` / etc. on the doc directly without
 * writing a corresponding snapshot. Without this synthetic snapshot, the
 * snapshot-based math in `computeKPITotals`, `computeIntervalBreakdown`,
 * `computePerVideoMetricInRange`, and `generateSparklineData` will under-
 * credit periods because the latest stored snapshot can be stale (e.g.
 * snapshot says 14k from yesterday's scrape, video.views is 300k from
 * today's manual refresh — the helper returns 14k).
 *
 * Mirrors the synthetic-snapshot trick the old `DayVideosModal` did
 * inline before that math was centralized. Returns the input array
 * unchanged when no augmentation is needed.
 */
function getEffectiveSnapshots(video: VideoSubmission): VideoSnapshot[] {
  const stored = video.snapshots ? [...video.snapshots] : [];
  const lastRefreshedRaw = (video as any).lastRefreshed;

  // Resolve the synthesis timestamp. Prefer `video.lastRefreshed` (set by the
  // scraper / refresh paths). When it's missing — common for legacy docs and
  // for videos updated by ingestion paths that don't write the field — fall
  // back to "now". The card UI displays `video.views` as the current value
  // anyway, so synthesizing at "now" lets the snapshot-aware math agree with
  // what the user already sees on screen instead of collapsing to a stale
  // upload-time snapshot.
  let lastRefreshed: Date;
  if (lastRefreshedRaw) {
    lastRefreshed =
      lastRefreshedRaw instanceof Date
        ? lastRefreshedRaw
        : (lastRefreshedRaw as any)?.toDate?.() instanceof Date
          ? (lastRefreshedRaw as any).toDate()
          : new Date(lastRefreshedRaw);
    if (isNaN(lastRefreshed.getTime())) lastRefreshed = new Date();
  } else {
    lastRefreshed = new Date();
  }

  // Most recent stored snapshot (by capturedAt).
  const sortedDesc = [...stored].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  );
  const latest = sortedDesc[0];

  const differs =
    !latest ||
    (latest.views || 0) !== (video.views || 0) ||
    (latest.likes || 0) !== (video.likes || 0) ||
    (latest.comments || 0) !== (video.comments || 0) ||
    (latest.shares || 0) !== (video.shares || 0);

  if (!differs) return stored;

  // Don't synthesize a snapshot dated BEFORE the latest stored one — that
  // would inject a back-dated point that breaks monotone-from-below
  // assumptions elsewhere. If lastRefreshed pre-dates the latest snap,
  // trust the snapshot.
  if (latest && lastRefreshed.getTime() < new Date(latest.capturedAt).getTime()) {
    return stored;
  }

  stored.push({
    id: `${video.id}-current`,
    videoId: video.id,
    views: video.views || 0,
    likes: video.likes || 0,
    comments: video.comments || 0,
    shares: video.shares || 0,
    saves: (video as any).saves || 0,
    capturedAt: lastRefreshed as any,
    capturedBy: 'manual_refresh',
    isInitialSnapshot: false,
  } as VideoSnapshot);
  return stored;
}

/**
 * Sparked-views event extractor — flat list of `{ ts, views }` events
 * representing every paid view a creator earned through Spark. Used
 * to subtract paid views from the headline KPI when the dashboard is
 * in `'organic'` reporting view (matches what the unified chart
 * already does per-bar). Sourced from the same fields the chart uses
 * (`sparkViewLogs` overrides `sparkedAt`-derived snapshot deltas) so
 * headline and bars use identical event lists.
 */
export function collectSparkEvents(
  submissions: VideoSubmission[],
): Array<{ ts: number; views: number }> {
  const events: Array<{ ts: number; views: number }> = [];
  for (const sub of submissions) {
    const logs = (sub as any).sparkViewLogs as Array<{ date: string; views: number }> | undefined;
    if (logs && logs.length > 0) {
      for (const l of logs) {
        const [y, mo, d] = (l.date || '').split('-').map(n => Number(n));
        if (!y || !mo || !d) continue;
        events.push({ ts: new Date(y, mo - 1, d).getTime(), views: l.views || 0 });
      }
      continue; // logs override snapshot inference for this submission
    }
    const sparkedAtRaw = (sub as any).sparkedAt as Date | { toDate: () => Date } | undefined;
    if (!sparkedAtRaw) continue;
    const sparkTime = (sparkedAtRaw instanceof Date ? sparkedAtRaw : sparkedAtRaw.toDate()).getTime();
    const snaps = getEffectiveSnapshots(sub).slice().sort(
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
}

/**
 * Sum sparked views that fall inside a date range. Used to subtract
 * paid views from headline totals in `'organic'` mode.
 */
export function sumSparkedViewsInRange(
  submissions: VideoSubmission[],
  dateRangeStart: Date | null,
  dateRangeEnd: Date,
): number {
  if (!dateRangeStart) return 0;
  const events = collectSparkEvents(submissions);
  const start = dateRangeStart.getTime();
  const end = dateRangeEnd.getTime();
  let total = 0;
  for (const ev of events) {
    if (ev.ts >= start && ev.ts <= end) total += ev.views;
  }
  return total;
}

/**
 * Compute the totals shown on the KPI cards for a given date range.
 * Mirrors the snapshot-delta math inside `generateKPICardData` exactly so the
 * unified chart's totals strip lines up with the headline KPI numbers.
 *
 * Pass `dateRangeStart = null` for "all time" — totals collapse to a simple
 * sum of current `video[metric]` values.
 *
 * `reportingView` controls spark-views handling, mirroring the chart:
 * - `'organic'` (default): subtract sparked (paid) views from totalViews
 * - `'total'` / `'split'`: include sparked views in totalViews
 *
 * Without this, the headline KPI included sparked views while the chart
 * bars excluded them in `'organic'` mode — a fixed mismatch on every
 * surface that calls this function.
 */
export function computeKPITotals(
  submissions: VideoSubmission[],
  dateRangeStart: Date | null,
  dateRangeEnd: Date,
  reportingView: 'organic' | 'total' | 'split' = 'organic',
): KPITotals {
  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalSaves = 0;

  if (dateRangeStart) {
    submissions.forEach(video => {
      const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
      const effectiveSnaps = getEffectiveSnapshots(video);

      if (effectiveSnaps.length > 0) {
        const snapshotBeforeOrAtStart = effectiveSnaps
          .filter(s => new Date(s.capturedAt) <= dateRangeStart)
          .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];

        const snapshotBeforeOrAtEnd = effectiveSnaps
          .filter(s => new Date(s.capturedAt) <= dateRangeEnd)
          .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];

        const snapshotsInRange = effectiveSnaps.filter(s => {
          const capturedDate = new Date(s.capturedAt);
          return capturedDate >= dateRangeStart && capturedDate <= dateRangeEnd;
        });

        if (snapshotBeforeOrAtStart && snapshotBeforeOrAtEnd && snapshotBeforeOrAtStart !== snapshotBeforeOrAtEnd) {
          totalViews += Math.max(0, (snapshotBeforeOrAtEnd.views || 0) - (snapshotBeforeOrAtStart.views || 0));
          totalLikes += Math.max(0, (snapshotBeforeOrAtEnd.likes || 0) - (snapshotBeforeOrAtStart.likes || 0));
          totalComments += Math.max(0, (snapshotBeforeOrAtEnd.comments || 0) - (snapshotBeforeOrAtStart.comments || 0));
          totalShares += Math.max(0, (snapshotBeforeOrAtEnd.shares || 0) - (snapshotBeforeOrAtStart.shares || 0));
          totalSaves += Math.max(0, (snapshotBeforeOrAtEnd.saves || 0) - (snapshotBeforeOrAtStart.saves || 0));
        } else if (snapshotBeforeOrAtStart && snapshotBeforeOrAtEnd && snapshotBeforeOrAtStart === snapshotBeforeOrAtEnd && snapshotsInRange.length > 0) {
          const sortedSnapshotsInRange = snapshotsInRange.sort((a, b) =>
            new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
          );
          const lastSnapshotInRange = sortedSnapshotsInRange[sortedSnapshotsInRange.length - 1];

          totalViews += Math.max(0, (lastSnapshotInRange.views || 0) - (snapshotBeforeOrAtStart.views || 0));
          totalLikes += Math.max(0, (lastSnapshotInRange.likes || 0) - (snapshotBeforeOrAtStart.likes || 0));
          totalComments += Math.max(0, (lastSnapshotInRange.comments || 0) - (snapshotBeforeOrAtStart.comments || 0));
          totalShares += Math.max(0, (lastSnapshotInRange.shares || 0) - (snapshotBeforeOrAtStart.shares || 0));
          totalSaves += Math.max(0, (lastSnapshotInRange.saves || 0) - (snapshotBeforeOrAtStart.saves || 0));
        } else if (!snapshotBeforeOrAtStart && snapshotsInRange.length > 0) {
          const sortedSnapshotsInRange = snapshotsInRange.sort((a, b) =>
            new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
          );
          const firstSnapshotInRange = sortedSnapshotsInRange[0];
          const lastSnapshotInRange = sortedSnapshotsInRange[sortedSnapshotsInRange.length - 1];

          if (uploadDate >= dateRangeStart && uploadDate <= dateRangeEnd) {
            totalViews += lastSnapshotInRange.views || 0;
            totalLikes += lastSnapshotInRange.likes || 0;
            totalComments += lastSnapshotInRange.comments || 0;
            totalShares += lastSnapshotInRange.shares || 0;
            totalSaves += lastSnapshotInRange.saves || 0;
          } else {
            totalViews += Math.max(0, (lastSnapshotInRange.views || 0) - (firstSnapshotInRange.views || 0));
            totalLikes += Math.max(0, (lastSnapshotInRange.likes || 0) - (firstSnapshotInRange.likes || 0));
            totalComments += Math.max(0, (lastSnapshotInRange.comments || 0) - (firstSnapshotInRange.comments || 0));
            totalShares += Math.max(0, (lastSnapshotInRange.shares || 0) - (firstSnapshotInRange.shares || 0));
            totalSaves += Math.max(0, (lastSnapshotInRange.saves || 0) - (firstSnapshotInRange.saves || 0));
          }
        } else if (!snapshotBeforeOrAtStart && !snapshotBeforeOrAtEnd) {
          // Video has snapshots but ALL of them land AFTER the date
          // range — meaning the video's growth happened post-range.
          // Adding `video.views` (current lifetime) here would credit
          // post-range growth to this period, inflating the headline
          // above the chart (which correctly attributes 0 to a video
          // with no snapshot inside the range). Leave at 0 to match.
        }
      } else {
        if (uploadDate >= dateRangeStart && uploadDate <= dateRangeEnd) {
          totalViews += video.views || 0;
          totalLikes += video.likes || 0;
          totalComments += video.comments || 0;
          totalShares += video.shares || 0;
          totalSaves += video.saves || 0;
        }
      }
    });
  } else {
    totalViews = submissions.reduce((sum, v) => sum + (v.views || 0), 0);
    totalLikes = submissions.reduce((sum, v) => sum + (v.likes || 0), 0);
    totalComments = submissions.reduce((sum, v) => sum + (v.comments || 0), 0);
    totalShares = submissions.reduce((sum, v) => sum + (v.shares || 0), 0);
    totalSaves = submissions.reduce((sum, v) => sum + (v.saves || 0), 0);
  }

  let videosInRange = submissions;
  if (dateRangeStart) {
    videosInRange = submissions.filter(v => {
      const uploadDate = new Date(v.uploadDate || v.dateSubmitted);
      return uploadDate >= dateRangeStart && uploadDate <= dateRangeEnd;
    });
  }
  const accounts = new Set(videosInRange.map(v => v.uploaderHandle)).size;
  const videos = videosInRange.length;

  // Subtract sparked (paid) views in 'organic' mode so the headline
  // KPI matches the chart bars (the chart already excludes sparks
  // per-bar in this mode). Floor at 0 — manual `sparkViewLogs` totals
  // can sometimes exceed the snapshot-derived gain for a video, which
  // would otherwise produce a negative headline.
  if (reportingView === 'organic') {
    const sparkedInRange = sumSparkedViewsInRange(submissions, dateRangeStart, dateRangeEnd);
    totalViews = Math.max(0, totalViews - sparkedInRange);
  }

  const engagement = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;

  return {
    views: totalViews,
    likes: totalLikes,
    comments: totalComments,
    shares: totalShares,
    saves: totalSaves,
    videos,
    accounts,
    engagement,
  };
}

/**
 * Per-video metric value over a date range — the SINGLE-VIDEO equivalent of
 * `computeKPITotals`. Use this anywhere code asks "how many views did THIS
 * video earn between X and Y?" — leaderboards, payouts, creator totals,
 * accounts table, anywhere a per-video number lands in the UI.
 *
 * Math (mirrors the per-video logic inside `computeKPITotals` and
 * `computeIntervalBreakdown` — they MUST stay in lockstep):
 *  - All-time (dateRangeStart === null): return current lifetime `video[metric]`.
 *  - Has snapshots:
 *      Uploaded inside the range → snapshot-at-or-before range END (no growth
 *        outside range). Falls back to lifetime if NO snapshots exist at all,
 *        else 0 if snapshots exist but none landed by range end yet.
 *      Uploaded before the range → max(0, snapshotAtEnd − snapshotAtStart),
 *        falling back to the first snapshot inside the range as baseline when
 *        no pre-range snapshot exists.
 *  - No snapshots at all + uploaded inside range: lifetime metric (only path
 *    where lifetime is correct because there's no snapshot timeline to delta).
 *
 * `excludeSparked: true` on `metric === 'views'` subtracts this video's
 * sparked (paid) views inside the range, matching the dashboard's `organic`
 * reporting mode. Spark events are derived from `sparkViewLogs` overrides
 * or `sparkedAt`-anchored snapshot deltas (same source as `collectSparkEvents`).
 *
 * Result is non-negative.
 */
export function computePerVideoMetricInRange(
  video: VideoSubmission,
  metric: 'views' | 'likes' | 'comments' | 'shares' | 'saves',
  dateRangeStart: Date | null,
  dateRangeEnd: Date,
  options?: { excludeSparked?: boolean },
): number {
  if (!dateRangeStart) {
    let v = ((video as any)[metric] as number) || 0;
    if (options?.excludeSparked && metric === 'views') {
      const sparked = sumSparkedViewsInRange([video], null, dateRangeEnd);
      v = Math.max(0, v - sparked);
    }
    return v;
  }

  const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
  const effectiveSnaps = getEffectiveSnapshots(video);
  let value = 0;

  if (effectiveSnaps.length > 0) {
    const snapshotBeforeOrAtStart = effectiveSnaps
      .filter(s => new Date(s.capturedAt) <= dateRangeStart)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];

    const snapshotBeforeOrAtEnd = effectiveSnaps
      .filter(s => new Date(s.capturedAt) <= dateRangeEnd)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];

    const snapshotsInRange = effectiveSnaps.filter(s => {
      const t = new Date(s.capturedAt);
      return t >= dateRangeStart && t <= dateRangeEnd;
    });

    if (snapshotBeforeOrAtStart && snapshotBeforeOrAtEnd && snapshotBeforeOrAtStart !== snapshotBeforeOrAtEnd) {
      value = Math.max(0, ((snapshotBeforeOrAtEnd as any)[metric] || 0) - ((snapshotBeforeOrAtStart as any)[metric] || 0));
    } else if (snapshotBeforeOrAtStart && snapshotBeforeOrAtEnd && snapshotBeforeOrAtStart === snapshotBeforeOrAtEnd && snapshotsInRange.length > 0) {
      const sortedInRange = snapshotsInRange.sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
      const last = sortedInRange[sortedInRange.length - 1];
      value = Math.max(0, ((last as any)[metric] || 0) - ((snapshotBeforeOrAtStart as any)[metric] || 0));
    } else if (!snapshotBeforeOrAtStart && snapshotsInRange.length > 0) {
      const sortedInRange = snapshotsInRange.sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
      const first = sortedInRange[0];
      const last = sortedInRange[sortedInRange.length - 1];
      if (uploadDate >= dateRangeStart && uploadDate <= dateRangeEnd) {
        value = (last as any)[metric] || 0;
      } else {
        value = Math.max(0, ((last as any)[metric] || 0) - ((first as any)[metric] || 0));
      }
    }
    // else: snapshots exist but all land AFTER the range — credit 0 (post-range
    // growth doesn't belong to this period; matches computeKPITotals).
  } else if (uploadDate >= dateRangeStart && uploadDate <= dateRangeEnd) {
    // No snapshots at all + uploaded in range: fall back to lifetime.
    value = ((video as any)[metric] as number) || 0;
  }

  if (options?.excludeSparked && metric === 'views') {
    const sparked = sumSparkedViewsInRange([video], dateRangeStart, dateRangeEnd);
    value = Math.max(0, value - sparked);
  }

  return value;
}

interface SparklineDataPoint {
  value: number;
  timestamp: number;
  interval: TimeInterval;
  ppValue?: number;
}

interface SparklineResult {
  data: SparklineDataPoint[];
  intervalType: IntervalType;
}

/**
 * Per-interval, per-video breakdown of metric contributions.
 *
 * This is the SHARED math used by both:
 *  - The unified chart bars (`generateSparklineData`)
 *  - The day-click popup (`DayVideosModal.cpKPIMetrics`)
 *
 * Both surfaces must agree on the value attributed to a single bucket. A bar
 * that says 2.4M MUST open a popup that says 2.4M for the same date — anything
 * else is a contract violation and looks like a bug to the user.
 *
 * The math (one pass over `videos`):
 *
 *   For each video, compute a per-metric cap = `valueAtRangeEnd(video, metric,
 *   rangeEndDate)` — the snapshot value at-or-before the OVERALL period end.
 *   This cap is what `computeKPITotals` credits to that video for the headline,
 *   so by clamping every per-bucket contribution to it we guarantee no single
 *   bucket can exceed the headline total.
 *
 *   - If the video was UPLOADED inside `[intervalStart, intervalEnd]`:
 *       new-upload bucket. Contributes `min(snapshotAtOrBefore(intervalEnd)[metric], cap)`.
 *       If snapshots exist but none have landed by interval end yet, contributes 0
 *       (a later bucket will pick the views up via the refreshed branch). If no
 *       snapshots exist at all, falls back to lifetime `video[metric]`.
 *
 *   - Otherwise the video is REFRESHED:
 *       startValue = `min(snapshotAtOrBefore(intervalStart)[metric], cap)`,
 *         falling back to the initial / first snapshot capped at cap when no
 *         pre-interval snapshot exists. If even the earliest snapshot is after
 *         interval end, startValue = endValue (delta = 0).
 *       endValue   = `min(snapshotAtOrBefore(intervalEnd)[metric], cap)`
 *       delta      = max(0, endValue - startValue)
 *
 * Returns counts of new uploads vs refreshed videos and the set of unique
 * accounts active in the bucket (uploaded OR refreshed with positive delta).
 */
export interface IntervalBreakdownResult {
  newViews: number; newLikes: number; newComments: number; newShares: number;
  refViews: number; refLikes: number; refComments: number; refShares: number;
  newUploadCount: number;
  refreshedCount: number;
  activeAccounts: Set<string>;
}

const _valueAtRangeEnd = (
  video: VideoSubmission,
  metricKey: 'views' | 'likes' | 'comments' | 'shares',
  asOf: Date,
): number => {
  const stored = video.snapshots || [];
  const lifetime = ((video as any)[metricKey] as number) || 0;

  if (stored.length === 0) return lifetime;

  // If `asOf` is at-or-after the latest stored snapshot, the cap should
  // reflect the latest KNOWN value of the video — which is whichever is
  // larger between the latest snapshot and the current lifetime field on
  // the doc. The card UI displays `video.views`, so the cap MUST track
  // that or the badges and cards will visibly disagree (the bug Ernesto
  // hit: card shows 557K, badge shows 10K because snapshots are stale).
  const latestStored = [...stored].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  )[0];

  if (new Date(latestStored.capturedAt) <= asOf) {
    return Math.max(lifetime, ((latestStored as any)[metricKey] as number) || 0);
  }

  // `asOf` is strictly BEFORE the latest stored snapshot — return the
  // latest snapshot at-or-before `asOf` (looking back in time).
  const snap = [...stored]
    .filter(s => new Date(s.capturedAt) <= asOf)
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
  return ((snap as any)?.[metricKey] as number) || 0;
};

export function computeIntervalBreakdown(
  videos: VideoSubmission[],
  intervalStart: Date,
  intervalEnd: Date,
  rangeEndDate: Date,
  options?: { excludeSparked?: boolean; rangeStartDate?: Date | null },
): IntervalBreakdownResult {
  const result: IntervalBreakdownResult = {
    newViews: 0, newLikes: 0, newComments: 0, newShares: 0,
    refViews: 0, refLikes: 0, refComments: 0, refShares: 0,
    newUploadCount: 0,
    refreshedCount: 0,
    activeAccounts: new Set<string>(),
  };

  const metrics: Array<'views' | 'likes' | 'comments' | 'shares'> = ['views', 'likes', 'comments', 'shares'];

  // Bucket-level attribution rule:
  //   - "New" = videos uploaded INSIDE this bucket → full at-period-end
  //     value credited. A video posted today with 557K lifetime puts the
  //     full 557K into today's "New" bucket.
  //   - "Refreshed" = videos uploaded BEFORE the broader period, with
  //     snapshot delta during this bucket.
  //   - Videos uploaded inside the broader period but in a DIFFERENT bucket
  //     are SKIPPED here — already fully credited at their upload-day's
  //     "New" bucket. This is the "those should count as new views, not
  //     refreshed" rule the user wants.
  //
  // When `rangeStartDate` is null/undefined the broader period collapses to
  // the bucket itself (legacy behavior), so any video uploaded before the
  // bucket counts as refreshed.
  const periodStart = options?.rangeStartDate ?? intervalStart;

  for (const video of videos) {
    const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
    const isNewUpload = uploadDate >= intervalStart && uploadDate <= intervalEnd;
    const uploadedInPeriodBeforeBucket =
      uploadDate >= periodStart && uploadDate < intervalStart;

    const caps = {
      views: _valueAtRangeEnd(video, 'views', rangeEndDate),
      likes: _valueAtRangeEnd(video, 'likes', rangeEndDate),
      comments: _valueAtRangeEnd(video, 'comments', rangeEndDate),
      shares: _valueAtRangeEnd(video, 'shares', rangeEndDate),
    };

    const effectiveSnaps = getEffectiveSnapshots(video);

    if (isNewUpload) {
      result.newUploadCount += 1;
      if (video.uploaderHandle) result.activeAccounts.add(video.uploaderHandle);
      // Credit the video's CURRENT lifetime metrics directly. This is the
      // exact value rendered on the card in the popup, so the badge will
      // never disagree with the cards. Verified against Firebase data:
      // Prayer Lock May 1 has 22 uploads summing to ~1.1M lifetime — the
      // previous cap-based path was returning ~10K per video because the
      // range-end was somewhere the latest snapshot hadn't yet landed.
      // Lifetime is the source of truth for "what these new videos earned".
      result.newViews += (video.views || 0);
      result.newLikes += (video.likes || 0);
      result.newComments += (video.comments || 0);
      result.newShares += (video.shares || 0);
      continue;
    }

    // Uploaded inside the broader period but in a different bucket —
    // already credited at that bucket's "New" total. Skip so it doesn't
    // also show up here as refreshed.
    if (uploadedInPeriodBeforeBucket) continue;

    // REFRESHED branch — uploaded BEFORE the period, snapshot delta in bucket.
    if (effectiveSnaps.length === 0) continue;

    const sorted = [...effectiveSnaps].sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );
    const snapshotAtEnd = sorted.filter(s => new Date(s.capturedAt) <= intervalEnd).pop();
    if (!snapshotAtEnd) continue;

    const snapshotAtStart = sorted.filter(s => new Date(s.capturedAt) <= intervalStart).pop();
    const initialFallback = sorted.find(s => (s as any).isInitialSnapshot) || sorted[0];

    let videoContributed = false;
    for (const m of metrics) {
      const cap = caps[m];
      const endValue = Math.min(((snapshotAtEnd as any)[m] || 0), cap);

      let startValue: number;
      if (snapshotAtStart) {
        startValue = Math.min(((snapshotAtStart as any)[m] || 0), cap);
      } else if (initialFallback && new Date((initialFallback as any).capturedAt) <= intervalEnd) {
        startValue = Math.min(((initialFallback as any)[m] || 0), cap);
      } else {
        startValue = endValue; // delta will be 0
      }

      const delta = Math.max(0, endValue - startValue);
      if (delta > 0) {
        videoContributed = true;
        if (m === 'views') result.refViews += delta;
        else if (m === 'likes') result.refLikes += delta;
        else if (m === 'comments') result.refComments += delta;
        else if (m === 'shares') result.refShares += delta;
      }
    }

    if (videoContributed) {
      result.refreshedCount += 1;
      if (video.uploaderHandle) result.activeAccounts.add(video.uploaderHandle);
    }
  }

  // Subtract bucket sparked-views in 'organic' mode. The unified chart does
  // this exact subtraction per-bar (UnifiedMetricsChart chartData memo:
  // `Math.max(0, raw - sparkedInInterval)` for the views series). Without
  // it, the popup headline = bucket value while the chart bar = bucket
  // value − sparked, which is the exact discrepancy users see when they
  // click a bar (e.g. chart 2.4M, popup 2.7M = 0.3M of sparked views in
  // that bucket). Apply only to views — likes/comments/shares aren't
  // separated organic-vs-sparked in the data model.
  //
  // Distribute the subtraction so badges still sum to the headline:
  // refreshed first (sparks come from snapshot deltas after `sparkedAt`),
  // then spill the remainder into newViews. Both floored at 0.
  if (options?.excludeSparked) {
    const sparkedInBucket = sumSparkedViewsInRange(videos, intervalStart, intervalEnd);
    if (sparkedInBucket > 0) {
      const fromRef = Math.min(result.refViews, sparkedInBucket);
      result.refViews -= fromRef;
      const remainder = sparkedInBucket - fromRef;
      if (remainder > 0) {
        result.newViews = Math.max(0, result.newViews - remainder);
      }
    }
  }

  return result;
}

export const generateSparklineData = (
  metric: 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'videos' | 'accounts',
  submissions: VideoSubmission[],
  allSubmissions: VideoSubmission[] | undefined,
  dateRangeStart: Date | null,
  dateRangeEnd: Date,
  dateFilter: DateFilterType,
  granularity: IntervalType
): SparklineResult => {
  // Calculate the actual date range
  let actualStartDate: Date;
  let actualEndDate: Date = new Date();
  
  if (dateRangeStart) {
    actualStartDate = new Date(dateRangeStart);
    actualEndDate = new Date(dateRangeEnd);
  } else {
    // For 'all' time filter, find the earliest date from data
    // If no data, default to 30 days
    let minTime = new Date().getTime();
    let hasData = false;
    
    if (submissions && submissions.length > 0) {
      submissions.forEach(s => {
        const uploadTime = new Date(s.uploadDate || s.dateSubmitted).getTime();
        if (!isNaN(uploadTime) && uploadTime < minTime) {
          minTime = uploadTime;
          hasData = true;
        }
        if (s.snapshots) {
          s.snapshots.forEach(sn => {
            const snTime = new Date(sn.capturedAt).getTime();
            if (!isNaN(snTime) && snTime < minTime) {
              minTime = snTime;
              hasData = true;
            }
          });
        }
      });
    }

    if (hasData) {
      actualStartDate = new Date(minTime);
    } else {
    actualStartDate = new Date();
    actualStartDate.setDate(actualStartDate.getDate() - 30);
    }
  }
  
  // Use the granularity prop
  const intervalType = granularity as IntervalType;
  
  // Generate intervals for current period (CP)
  const intervals = DataAggregationService.generateIntervals(
    { startDate: actualStartDate, endDate: actualEndDate },
    intervalType
  );
  
  // Generate intervals for previous period (PP) - same length as CP
  let ppIntervals: typeof intervals = [];
  let ppRangeEndDate: Date | null = null;
  let ppRangeStartDate: Date | null = null;

  if (dateRangeStart && dateFilter !== 'all') {
    const periodLength = actualEndDate.getTime() - actualStartDate.getTime();
    const tempPPEndDate = new Date(actualStartDate.getTime() - 1);
    const tempPPStartDate = new Date(tempPPEndDate.getTime() - periodLength);
    ppRangeEndDate = tempPPEndDate;
    ppRangeStartDate = tempPPStartDate;

    ppIntervals = DataAggregationService.generateIntervals(
      { startDate: tempPPStartDate, endDate: tempPPEndDate },
      intervalType
    );
  }

  // Per-video cap for per-interval values: the snapshot value at the
  // END of the date range. computeKPITotals attributes this much to
  // the video for the headline; capping snapshotAtEnd here means no
  // single bar can claim more than the headline does. Without this,
  // a video that PEAKED inside the range and then DROPPED (TikTok/IG
  // recounts, removed videos, etc.) shows the peak in one bar while
  // the headline only credits the final value — a single bar can
  // exceed the entire-period total. The cap forces sum-of-bars to
  // equal the headline by clamping per-interval values to the
  // monotone-from-below "final value" baseline.
  const valueAtRangeEnd = (
    video: VideoSubmission,
    metricKey: 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'videos' | 'accounts',
    asOf: Date,
  ): number => {
    const snaps = getEffectiveSnapshots(video);
    if (snaps.length === 0) return ((video as any)[metricKey] as number) || 0;
    const snap = [...snaps]
      .filter(s => new Date(s.capturedAt) <= asOf)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
    return ((snap as any)?.[metricKey] as number) || 0;
  };

  let data: SparklineDataPoint[] = [];
  
  // Process each interval
  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    const ppInterval = ppIntervals[i]; // Corresponding previous period interval
    const timestamp = interval.timestamp;
    
    if (metric === 'videos') {
      // For published videos: count how many videos were published IN THIS INTERVAL
      const videosPublishedInInterval = submissions.filter(v => {
        const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        return DataAggregationService.isDateInInterval(uploadDate, interval);
      });
      
      // Calculate PP value if available - use ALL submissions, not filtered
      let ppValue = 0;
      if (ppInterval) {
        const ppVideosPublished = (allSubmissions || submissions).filter(v => {
          const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
          return DataAggregationService.isDateInInterval(uploadDate, ppInterval);
        });
        ppValue = ppVideosPublished.length;
      }
      
      data.push({ 
        value: videosPublishedInInterval.length, 
        timestamp,
        interval,
        ppValue
      });
    } else if (metric === 'accounts') {
      // For active accounts: count unique accounts that were active IN THIS INTERVAL
      const videosInInterval = submissions.filter(v => {
        const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        return DataAggregationService.isDateInInterval(uploadDate, interval);
      });
      const uniqueAccountsInInterval = new Set(videosInInterval.map(v => v.uploaderHandle)).size;
      
      // Calculate PP value if available - use ALL submissions, not filtered
      let ppValue = 0;
      if (ppInterval) {
        const ppVideosInInterval = (allSubmissions || submissions).filter(v => {
          const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
          return DataAggregationService.isDateInInterval(uploadDate, ppInterval);
        });
        ppValue = new Set(ppVideosInInterval.map(v => v.uploaderHandle)).size;
      }
      
      data.push({ 
        value: uniqueAccountsInInterval, 
        timestamp,
        interval,
        ppValue
      });
    } else {
      // Show per-interval values (NOT cumulative)
      let intervalValue = 0;
      let ppIntervalValue = 0;
      
      // Use filtered submissions for CP, all submissions for PP calculation
      const submissionsForCP = submissions;
      const submissionsForPP = allSubmissions || submissions;
      
      // SIMPLIFIED LOGIC: Calculate like the tooltip does
      // 1. New uploads = videos uploaded in this interval
      // 2. Refreshed videos = videos with growth in this interval
      //
      // KEEP IN SYNC with `computeIntervalBreakdown` above. The day-click
      // popup (DayVideosModal) calls that helper to produce the value the
      // user sees when they click a bar; if these two diverge the popup
      // will disagree with the bar it opened from. Any change to the math
      // here MUST also be made in computeIntervalBreakdown.
      submissionsForCP.forEach(video => {
        const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
        // Materialize effective snapshots ONCE per video — augments stored
        // snapshots with a synthetic point at video.lastRefreshed when the
        // doc's lifetime metrics differ (e.g. a manual refresh updated
        // video.views without writing a snapshot). All snapshot reads in
        // this loop use this list so caps and deltas reflect the latest
        // known data, not stale snapshot rows.
        const effectiveSnaps = getEffectiveSnapshots(video);

        // Per-video cap = value at end of CP range. Snapshots that
        // PEAKED above this (e.g. a metric was later corrected down)
        // get clamped so no single bar exceeds the headline total.
        const cpCap = valueAtRangeEnd(video, metric, actualEndDate);

        // === CURRENT PERIOD (CP) CALCULATION ===
        if (DataAggregationService.isDateInInterval(uploadDate, interval)) {
          // NEW UPLOAD: credit the video's CURRENT lifetime metric. This is
          // what the cards display in the day-click popup, so bars and badges
          // are always visibly consistent. The previous cap-based credit
          // collapsed to early-day snapshot values when the range-end was
          // before the latest stored snapshot.
          intervalValue += (video[metric] || 0);
        } else if (uploadDate >= actualStartDate) {
          // Uploaded inside the broader period but in a different bucket —
          // already credited at that bucket's "New". Skip so we don't also
          // count it here as refreshed.
        } else {
          // REFRESHED VIDEO: Video was uploaded before this interval - calculate growth IN this interval
          if (effectiveSnaps.length > 0) {
            const sortedSnapshots = [...effectiveSnaps].sort((a, b) =>
              new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
            );
            
            // Find snapshot at or before interval START (baseline)
            const snapshotAtStart = sortedSnapshots
              .filter(s => new Date(s.capturedAt) <= interval.startDate)
              .pop();
            
            // Find snapshot at or before interval END (current value)
            const snapshotAtEnd = sortedSnapshots
              .filter(s => new Date(s.capturedAt) <= interval.endDate)
              .pop();
            
            if (snapshotAtEnd) {
              // If we have a start snapshot, calculate delta from there
              // If NOT (e.g. added during interval), use initial snapshot or first available as baseline
              // This matches the tooltip logic which falls back to initial snapshot
              let startValue = 0;
              
              if (snapshotAtStart) {
                // Cap startValue at cpCap too (symmetric with endValue)
                // — if the metric peaked before the interval and got
                // corrected down later, the uncapped baseline would be
                // higher than the cap, which combined with a capped
                // endValue produces a negative delta that Math.max
                // silently zeros. Capping both keeps the math
                // monotone-from-below with the period-end value.
                startValue = Math.min(snapshotAtStart[metric] || 0, cpCap);
              } else {
                // Fallback: try to find initial snapshot or just use the very first snapshot
                const initialSnapshot = sortedSnapshots.find(s => s.isInitialSnapshot) || sortedSnapshots[0];
                if (initialSnapshot && new Date(initialSnapshot.capturedAt) <= interval.endDate) {
                  startValue = Math.min(initialSnapshot[metric] || 0, cpCap);
                } else {
                  // If even the first snapshot is after the interval end, then no growth in this interval
                  startValue = snapshotAtEnd[metric] || 0; // Resulting delta will be 0
                }
              }

              // Cap end value at the period-end value so peaks that
              // were later corrected down don't inflate a single bar
              // beyond what the headline total credits this video.
              const endValue = Math.min(snapshotAtEnd[metric] || 0, cpCap);

              // Simple delta: End - Start. If Start is from before
              // interval, delta is growth IN interval. If Start is
              // from DURING interval (fallback), delta is growth FROM
              // start of tracking TO now.
              const delta = Math.max(0, endValue - startValue);
              if (delta > 0) {
                intervalValue += delta;
              }
            }
          }
        }
      });
      
      // === PREVIOUS PERIOD (PP) CALCULATION ===
      // Use ALL submissions (not filtered) for PP calculation
      if (ppInterval) {
        submissionsForPP.forEach(video => {
          const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
          const effectiveSnaps = getEffectiveSnapshots(video);

          // Per-video cap = value at end of PP range (mirror of CP
          // cap). Keeps each PP bar ≤ what the PP headline credits
          // this video, even when its metric peaked then dropped.
          const ppCap = ppRangeEndDate
            ? valueAtRangeEnd(video, metric, ppRangeEndDate)
            : (video[metric] || 0);

          if (DataAggregationService.isDateInInterval(uploadDate, ppInterval)) {
            // NEW UPLOAD in PP: credit the lifetime metric directly.
            ppIntervalValue += (video[metric] || 0);
          } else if (ppRangeStartDate && uploadDate >= ppRangeStartDate) {
            // Uploaded inside the broader PP period but in a different PP
            // bucket — already credited there. Skip.
          } else {
            // REFRESHED VIDEO in PP: Video was uploaded before PP interval - calculate growth IN PP interval
            if (effectiveSnaps.length > 0) {
              const sortedSnapshots = [...effectiveSnaps].sort((a, b) =>
                new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
              );
              
              const snapshotAtStart = sortedSnapshots
                .filter(s => new Date(s.capturedAt) <= ppInterval.startDate)
                .pop();
              
              const snapshotAtEnd = sortedSnapshots
                .filter(s => new Date(s.capturedAt) <= ppInterval.endDate)
                .pop();
              
              if (snapshotAtEnd) {
                // Same fallback logic as CP
                let startValue = 0;
                
                if (snapshotAtStart) {
                  // Symmetric cap with endValue (mirror of CP refresh
                  // branch). Stops a pre-PP peak from creating a
                  // negative implied delta.
                  startValue = Math.min(snapshotAtStart[metric] || 0, ppCap);
                } else {
                  const initialSnapshot = sortedSnapshots.find(s => s.isInitialSnapshot) || sortedSnapshots[0];
                  if (initialSnapshot && new Date(initialSnapshot.capturedAt) <= ppInterval.endDate) {
                    startValue = Math.min(initialSnapshot[metric] || 0, ppCap);
                  } else {
                    startValue = snapshotAtEnd[metric] || 0;
                  }
                }

                // Cap end value at PP-end value — same reason as CP
                // refresh: drops within the period mustn't let a single
                // bar exceed what the PP headline credits.
                const endValue = Math.min(snapshotAtEnd[metric] || 0, ppCap);
                const delta = Math.max(0, endValue - startValue);

                if (delta > 0) {
                  ppIntervalValue += delta;
                }
              }
            }
          }
        });
      }
      
      const finalPPValue = ppInterval ? ppIntervalValue : 0;
      
      data.push({ 
        value: intervalValue, 
        timestamp,
        interval,
        ppValue: finalPPValue
      });
    }
  }
  
  // Debug: Log PP sparkline data
  const ppDataPoints = data.filter(d => typeof d.ppValue === 'number' && d.ppValue > 0).length;
  if (ppDataPoints > 0) {
    console.log(`✨ Generated ${ppDataPoints} PP sparkline points for metric: ${metric}`);
  }
  
  // If only one data point exists, add padding points to create a flat line
  if (data.length === 1) {
    const singlePoint = data[0];
    const paddingLeft = {
      value: singlePoint.value,
      timestamp: singlePoint.timestamp - 1,
      interval: singlePoint.interval,
      ppValue: singlePoint.ppValue
    };
    const paddingRight = {
      value: singlePoint.value,
      timestamp: singlePoint.timestamp + 1,
      interval: singlePoint.interval,
      ppValue: singlePoint.ppValue
    };
    // Add padding points before and after to create a flat line
    data = [paddingLeft, singlePoint, paddingRight];
  }
  
  return { data, intervalType };
};

export const calculateDateRanges = (dateFilter: DateFilterType, customRange?: { startDate: Date; endDate: Date }) => {
  let dateRangeStart: Date | null = null;
  let dateRangeEnd: Date = new Date();
  let ppDateRangeStart: Date | null = null;
  let ppDateRangeEnd: Date | null = null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (dateFilter) {
    case 'today':
      dateRangeStart = new Date(today);
      dateRangeEnd = new Date(today);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Yesterday
      ppDateRangeStart = new Date(today);
      ppDateRangeStart.setDate(ppDateRangeStart.getDate() - 1);
      ppDateRangeEnd = new Date(ppDateRangeStart);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      dateRangeStart = new Date(today);
      dateRangeStart.setDate(dateRangeStart.getDate() - 1);
      dateRangeEnd = new Date(dateRangeStart);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Day before yesterday
      ppDateRangeStart = new Date(dateRangeStart);
      ppDateRangeStart.setDate(ppDateRangeStart.getDate() - 1);
      ppDateRangeEnd = new Date(ppDateRangeStart);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'last7days':
      dateRangeStart = new Date(today);
      dateRangeStart.setDate(dateRangeStart.getDate() - 6);
      dateRangeEnd = new Date(today);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Previous 7 days
      ppDateRangeStart = new Date(dateRangeStart);
      ppDateRangeStart.setDate(ppDateRangeStart.getDate() - 7);
      ppDateRangeEnd = new Date(dateRangeStart);
      ppDateRangeEnd.setDate(ppDateRangeEnd.getDate() - 1);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'last14days':
      dateRangeStart = new Date(today);
      dateRangeStart.setDate(dateRangeStart.getDate() - 13);
      dateRangeEnd = new Date(today);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Previous 14 days
      ppDateRangeStart = new Date(dateRangeStart);
      ppDateRangeStart.setDate(ppDateRangeStart.getDate() - 14);
      ppDateRangeEnd = new Date(dateRangeStart);
      ppDateRangeEnd.setDate(ppDateRangeEnd.getDate() - 1);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'last30days':
      dateRangeStart = new Date(today);
      dateRangeStart.setDate(dateRangeStart.getDate() - 29);
      dateRangeEnd = new Date(today);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Previous 30 days
      ppDateRangeStart = new Date(dateRangeStart);
      ppDateRangeStart.setDate(ppDateRangeStart.getDate() - 30);
      ppDateRangeEnd = new Date(dateRangeStart);
      ppDateRangeEnd.setDate(ppDateRangeEnd.getDate() - 1);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'last90days':
      dateRangeStart = new Date(today);
      dateRangeStart.setDate(dateRangeStart.getDate() - 89);
      dateRangeEnd = new Date(today);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Previous 90 days
      ppDateRangeStart = new Date(dateRangeStart);
      ppDateRangeStart.setDate(ppDateRangeStart.getDate() - 90);
      ppDateRangeEnd = new Date(dateRangeStart);
      ppDateRangeEnd.setDate(ppDateRangeEnd.getDate() - 1);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'mtd':
      dateRangeStart = new Date(today.getFullYear(), today.getMonth(), 1);
      dateRangeEnd = new Date(today);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Last month (same day range)
      ppDateRangeStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      ppDateRangeEnd = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'ytd':
      dateRangeStart = new Date(today.getFullYear(), 0, 1);
      dateRangeEnd = new Date(today);
      dateRangeEnd.setHours(23, 59, 59, 999);
      // PP: Last year (same date range)
      ppDateRangeStart = new Date(today.getFullYear() - 1, 0, 1);
      ppDateRangeEnd = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      ppDateRangeEnd.setHours(23, 59, 59, 999);
      break;
    case 'custom':
      if (customRange) {
        dateRangeStart = new Date(customRange.startDate);
        dateRangeEnd = new Date(customRange.endDate);
        dateRangeEnd.setHours(23, 59, 59, 999);
        // PP: Same length period before custom range
        const customLength = dateRangeEnd.getTime() - dateRangeStart.getTime();
        ppDateRangeEnd = new Date(dateRangeStart);
        ppDateRangeEnd.setDate(ppDateRangeEnd.getDate() - 1);
        ppDateRangeEnd.setHours(23, 59, 59, 999);
        ppDateRangeStart = new Date(ppDateRangeEnd.getTime() - customLength);
      }
      break;
    case 'all':
    default:
      dateRangeStart = null;
      dateRangeEnd = new Date();
      ppDateRangeStart = null;
      ppDateRangeEnd = null;
  }

  return {
    dateRangeStart,
    dateRangeEnd,
    ppDateRangeStart,
    ppDateRangeEnd
  };
};

