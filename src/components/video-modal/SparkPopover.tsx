import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Zap, X, Power, Calendar, Hash, Snowflake } from 'lucide-react';
import SparkService from '../../services/firestore/SparkService';
import { VideoSnapshot } from '../../types';
import { formatNumber } from '../../utils/formatters';

/**
 * Pretty range slider — replaces the boring native bar with:
 *  - a gradient-filled track (organic blue → spark pink) that grows
 *    LEFT→RIGHT as the thumb moves
 *  - a custom circular thumb with a content-colored ring + shadow
 *  - a floating value bubble above the thumb showing the current label
 *  - a transparent native <input type="range"> overlay so all the
 *    keyboard / drag / a11y behavior comes for free
 */
const FancySlider: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  bubbleLabel: string;
  leftLabel: string;
  rightLabel: string;
}> = ({ value, min, max, step, onChange, bubbleLabel, leftLabel, rightLabel }) => {
  const pct = ((value - min) / Math.max(1, max - min)) * 100;
  const clampedPct = Math.max(0, Math.min(100, pct));
  return (
    <div className="space-y-2">
      <div className="relative h-14">
        {/* Floating value bubble — anchored to the thumb position. */}
        <div
          className="absolute top-0 transition-all duration-75 pointer-events-none z-10"
          style={{ left: `${clampedPct}%`, transform: 'translateX(-50%)' }}
        >
          <div className="relative">
            <div className="px-2.5 py-1 text-[11px] font-bold text-white bg-content rounded-md shadow-lg whitespace-nowrap tabular-nums">
              {bubbleLabel}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-content rotate-45" />
          </div>
        </div>

        {/* Track */}
        <div className="absolute inset-x-0 top-9 h-2 rounded-full bg-surface-tertiary border border-border-subtle overflow-visible">
          {/* Filled portion — gradient organic → sparked. */}
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${clampedPct}%`,
              background: 'linear-gradient(to right, #3b82f6, #ec4899)',
            }}
          />
          {/* Custom thumb */}
          <div
            className="absolute top-1/2 w-5 h-5 rounded-full bg-surface border-[3px] border-content shadow-lg pointer-events-none"
            style={{
              left: `${clampedPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>

        {/* Native input — transparent overlay captures interaction so
            we get keyboard/drag/a11y behavior for free, while the
            visuals above render the styled track + thumb. */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-x-0 top-7 w-full h-6 opacity-0 cursor-pointer m-0 z-20"
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-content-muted px-1">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
};

interface SparkLog {
  id: string;
  date: string;
  views: number;
  note?: string;
}

interface SparkPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  /** Anchor point — popover renders below the trigger button. */
  anchorEl?: HTMLElement | null;
  orgId: string;
  projectId: string;
  videoId: string;
  sparkedAt: Date | undefined;
  sparkViewLogs: SparkLog[] | undefined;
  /** Earliest moment the Spark slider can land on — usually the video's
   *  uploadDate. Anything earlier doesn't make sense. */
  uploadDate: Date | undefined;
  /** Snapshots powers the live "≈ N views Sparked" preview as the user
   *  drags the slider — same algorithm SparkService uses. */
  snapshots: VideoSnapshot[] | undefined;
  totalViews: number;
  /** Current freeze state of the video. When true, the cron skips
   *  refreshing it. Sparked + frozen is the recommended combo. */
  isStale?: boolean;
  /** Local-state callback so the parent UI updates immediately while
   *  the Firestore write is in flight. */
  onLocalChange: (patch: { sparkedAt?: Date | undefined; sparkViewLogs?: SparkLog[]; isStale?: boolean }) => void;
}

export const SparkPopover: React.FC<SparkPopoverProps> = ({
  isOpen,
  onClose,
  orgId,
  projectId,
  videoId,
  sparkedAt,
  sparkViewLogs,
  uploadDate,
  snapshots,
  totalViews,
  isStale,
  onLocalChange,
}) => {
  // Slider bounds — earliest = upload (so 100% organic if the slider sits
  // all the way left), latest = now (so 0 ad views at the right edge).
  // Falls back to "30 days ago" when uploadDate is missing.
  const minTime = useMemo(() => {
    if (uploadDate) return uploadDate.getTime();
    return Date.now() - 30 * 86400000;
  }, [uploadDate]);
  const maxTime = useMemo(() => Date.now(), [isOpen]); // freeze "now" while the popover is open

  // Slider value is the timestamp the user has dragged to. Default lands
  // on the existing sparkedAt if the video is already Sparked, otherwise
  // 25% from the right (a reasonable "recent" starting point).
  const [sliderTime, setSliderTime] = useState<number>(() => {
    if (sparkedAt) return Math.min(maxTime, Math.max(minTime, sparkedAt.getTime()));
    return minTime + (maxTime - minTime) * 0.75;
  });
  useEffect(() => {
    if (sparkedAt) setSliderTime(Math.min(maxTime, Math.max(minTime, sparkedAt.getTime())));
  }, [sparkedAt, minTime, maxTime]);

  // Two modes:
  //  - 'date'  → snapshots after sparkedAt are inferred as ad views
  //  - 'views' → user types a single number; that's the ad-view total
  // Default to whichever the video already uses (presence of logs ⇒ views).
  const initialMode: 'date' | 'views' = (sparkViewLogs && sparkViewLogs.length > 0) ? 'views' : 'date';
  const [mode, setMode] = useState<'date' | 'views'>(initialMode);
  useEffect(() => { setMode(initialMode); }, [videoId]); // reset when video changes

  // Manual ad-view total for "Set views" mode. Pre-filled from the
  // existing log total so editing feels like editing one field.
  const initialManual = (sparkViewLogs || []).reduce((s, l) => s + (l.views || 0), 0);
  const [manualViews, setManualViews] = useState(initialManual ? String(initialManual) : '');
  useEffect(() => { setManualViews(initialManual ? String(initialManual) : ''); }, [videoId]);

  // Freeze toggle — defaults ON when sparking a video that isn't already
  // frozen (the recommended combo). Sticky to the existing isStale once
  // the video already has a state set.
  const [freeze, setFreeze] = useState<boolean>(() => !!isStale || !sparkedAt);
  useEffect(() => {
    setFreeze(!!isStale || (!sparkedAt && !isStale));
  }, [videoId, isStale, sparkedAt]);

  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Live preview — how the split would look if the user committed the
  // current form state. In 'date' mode, the preview is snapshot-inferred
  // from the slider position. In 'views' mode, it's whatever number the
  // user typed (clamped to total) — slider position becomes purely the
  // visual marker for the chart.
  const preview = useMemo(() => {
    if (mode === 'views') {
      const n = Math.max(0, Math.min(totalViews, Number(manualViews) || 0));
      return { organic: Math.max(0, totalViews - n), ad: n };
    }
    return SparkService.splitViewsBySpark(snapshots, new Date(sliderTime), totalViews, undefined);
  }, [mode, manualViews, snapshots, sliderTime, totalViews]);

  // Display helpers for the slider rail labels.
  const sliderDate = new Date(sliderTime);
  const sliderLabel = sliderDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const minLabel = new Date(minTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const maxLabel = 'Now';

  // Close on Esc — the backdrop handles outside-click.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSparked = !!sparkedAt;

  const submit = async () => {
    setBusy(true);
    try {
      const when = new Date(sliderTime);
      await SparkService.markAsSparked(orgId, projectId, videoId, when);
      const patch: { sparkedAt: Date; sparkViewLogs?: any[] } = { sparkedAt: when };

      if (mode === 'views') {
        // Replace any prior log entries with one override matching the
        // typed total. splitViewsBySpark prefers logs over snapshot
        // inference, so this becomes the source of truth for ad views.
        const n = Math.max(0, Math.min(totalViews, Number(manualViews) || 0));
        await SparkService.setManualAdViewsTotal(orgId, projectId, videoId, n);
        patch.sparkViewLogs = n > 0 ? [{
          id: `local_${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          views: n,
        }] : [];
      } else {
        // Date mode — clear any stale override so the snapshot inference
        // takes over. (No-op when there's nothing to clear.)
        if ((sparkViewLogs || []).length > 0) {
          await SparkService.setManualAdViewsTotal(orgId, projectId, videoId, 0);
          patch.sparkViewLogs = [];
        }
      }

      // Freeze flag — written alongside the spark mark so a single
      // confirmation handles both. Only writes when the value
      // actually changed, to avoid an unnecessary roundtrip.
      if (freeze !== !!isStale) {
        await SparkService.setVideoFrozen(orgId, projectId, videoId, freeze);
        (patch as any).isStale = freeze;
      }

      onLocalChange(patch);
    } finally { setBusy(false); }
  };

  const disableSpark = async () => {
    if (!confirm('Disable Spark on this video? Snapshot deltas after the Spark moment will revert to organic. Manual ad-view logs are kept.')) return;
    setBusy(true);
    try {
      await SparkService.unmarkSparked(orgId, projectId, videoId);
      onLocalChange({ sparkedAt: undefined });
    } finally { setBusy(false); }
  };

  const inp = 'w-full px-3 py-2 bg-surface-tertiary border border-border rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-content';

  // Portal to body so the popover floats above EVERY other layer in the
  // app (parent modal z-50, delete modal z-[9999], etc.) and doesn't get
  // clipped by overflow:hidden on the parent. Backdrop also acts as a
  // dismiss target — click anywhere outside the card to close.
  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden"
      >
        {/* Header — monotone, matches VideoDeleteModal / other dialogs. */}
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-surface-tertiary rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-content-muted" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-content leading-tight">Spark ads</h2>
                <p className="text-xs text-content-muted mt-0.5">
                  {isSparked
                    ? `Sparked since ${sparkedAt!.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : 'Mark when paid views started'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-content-muted" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Mode switcher — pick how the user wants to define the ad
              window. "From date" infers ad views from snapshots after the
              picked date. "Set views" lets them type one ad-view total
              directly (overrides the snapshot inference). */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface-tertiary border border-border-subtle">
            {([
              { key: 'date',  label: 'From date',  icon: Calendar },
              { key: 'views', label: 'Set views', icon: Hash },
            ] as const).map(opt => {
              const active = mode === opt.key;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  onClick={() => setMode(opt.key)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    active ? 'bg-surface text-content shadow-sm' : 'text-content-muted hover:text-content'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* ── Spark window picker ───────────────────────────────────── */}
          <section className="space-y-3">
            {/* Header row — label + the live value being picked. In date
                mode the value is the slider's date; in views mode it's
                the ad-view count. */}
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
                {mode === 'views'
                  ? 'Ad views'
                  : (isSparked ? 'Sparked from' : 'Spark from')}
              </label>
              <span className="text-xs font-bold text-content tabular-nums">
                {mode === 'views'
                  ? `${formatNumber(Number(manualViews) || 0)} / ${formatNumber(totalViews)}`
                  : sliderLabel}
              </span>
            </div>

            {/* Slider — fancy custom UI replaces the native bar. Date
                mode: position along the upload→now timeline. Views mode:
                0 → totalViews (coarse picker that stays in sync with the
                manual number input below). */}
            {mode === 'views' ? (
              <FancySlider
                min={0}
                max={Math.max(1, totalViews)}
                step={Math.max(1, Math.round(totalViews / 200))}
                value={Math.min(totalViews, Math.max(0, Number(manualViews) || 0))}
                onChange={v => setManualViews(String(v))}
                bubbleLabel={formatNumber(Number(manualViews) || 0)}
                leftLabel="0"
                rightLabel={formatNumber(totalViews)}
              />
            ) : (
              <FancySlider
                min={minTime}
                max={maxTime}
                step={3600 * 1000}
                value={sliderTime}
                onChange={v => setSliderTime(v)}
                bubbleLabel={sliderLabel}
                leftLabel={minLabel}
                rightLabel={maxLabel}
              />
            )}

            {/* Manual number input — only in views mode. Sliding the
                rail above writes into this field; typing here moves the
                slider. Both edit the same `manualViews` state. */}
            {mode === 'views' && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                  Ad views (manual)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 50000"
                  value={manualViews}
                  onChange={e => setManualViews(e.target.value)}
                  className={inp}
                />
              </div>
            )}

            {/* Combined preview — Organic / Sparked / Total in one row so
                the math reads left-to-right (organic + sparked = total). */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-secondary border border-border">
              <div className="text-center flex-1">
                <p className="text-[9px] uppercase tracking-wider text-content-muted font-semibold">Organic</p>
                <p className="text-base font-bold text-content tabular-nums">{formatNumber(preview.organic)}</p>
              </div>
              <span className="text-content-muted font-light">+</span>
              <div className="text-center flex-1">
                <p className="text-[9px] uppercase tracking-wider text-content-muted font-semibold">Sparked</p>
                <p className="text-base font-bold text-content tabular-nums">{formatNumber(preview.ad)}</p>
              </div>
              <span className="text-content-muted font-light">=</span>
              <div className="text-center flex-1">
                <p className="text-[9px] uppercase tracking-wider text-content-muted font-semibold">Total</p>
                <p className="text-base font-bold text-content tabular-nums">{formatNumber(preview.organic + preview.ad)}</p>
              </div>
            </div>

            {/* Freeze toggle — Sparked videos run on ad spend, so the
                view count is being driven by the user's campaign rather
                than organic discovery. Refreshing burns API quota
                tracking numbers the user is already controlling
                manually via sparkViewLogs. Default ON when sparking. */}
            <div className="rounded-xl border border-border bg-surface-secondary p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Snowflake className={`w-5 h-5 flex-shrink-0 mt-0.5 transition-colors ${freeze ? 'text-blue-500' : 'text-content-muted'}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-content">Freeze this video</div>
                    <p className="text-[11px] text-content-muted mt-1 leading-relaxed">
                      Sparked videos grow on ad spend, not organic reach. Freezing skips this video on automatic syncs so you don't burn API quota tracking numbers your campaign is already driving. You can unfreeze any time.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFreeze(v => !v)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    freeze ? 'bg-blue-500' : 'bg-surface-tertiary'
                  }`}
                  aria-pressed={freeze}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      freeze ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              onClick={submit}
              disabled={busy || (mode === 'views' && (!manualViews || Number(manualViews) < 0))}
              className="w-full px-4 py-2.5 text-sm font-bold text-white bg-orange-500 rounded-xl border-2 border-black shadow-[3px_3px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_0_#000]"
            >
              {mode === 'views'
                ? (isSparked ? 'Update Spark' : 'Spark with these views')
                : (isSparked ? 'Update window' : 'Spark from this date')}
            </button>
          </section>

          {/* ── Unspark CTA ────────────────────────────────────────── */}
          {isSparked && (
            <section className="border-t border-border-subtle pt-4">
              <button
                onClick={disableSpark}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-red-500 bg-red-500/10 rounded-xl border-2 border-red-500/40 hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                <Power className="w-3.5 h-3.5" />
                Unspark this video
              </button>
              <p className="text-[10px] text-content-muted mt-2 text-center">
                Snapshot deltas after the Spark moment will revert to organic. Logged ad views are kept.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SparkPopover;
