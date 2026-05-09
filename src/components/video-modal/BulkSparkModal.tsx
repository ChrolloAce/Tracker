import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Zap, X, Calendar, Snowflake, Clock } from 'lucide-react';
import SparkService from '../../services/firestore/SparkService';
import { VideoSubmission } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  projectId: string;
  /** Videos the admin selected before opening this dialog. Each one will be
   *  sparked with the same date + freeze setting. */
  videos: VideoSubmission[];
  /** Called once the writes commit. The parent should patch its local state
   *  for these video IDs so the table / chart reflect the new sparkedAt
   *  immediately without a full reload. `frozen` mirrors the freeze toggle. */
  onApplied: (sparkedVideoIds: string[], sparkedAt: Date, frozen: boolean) => void;
}

/**
 * Bulk Spark modal — applies the same sparkedAt timestamp (and optional
 * freeze flag) to every video the admin selected. The single-video popover
 * has a "Set views" mode for typing one ad-view total; we deliberately
 * exclude that here because a per-video number is meaningless in bulk —
 * admins running this flow want a "mark these N videos as Sparked from X"
 * action and per-video view-log tweaks happen later via the popover.
 */
export const BulkSparkModal: React.FC<Props> = ({
  isOpen,
  onClose,
  orgId,
  projectId,
  videos,
  onApplied,
}) => {
  // Two paths an admin reaches this dialog with — "now" matches the user's
  // request ("just spark from now") and is the default; "date" lets them
  // pin a moment in the past (e.g. when an ad campaign actually went live).
  const [mode, setMode] = useState<'now' | 'date'>('now');
  // Default: today at 09:00 local — a reasonable "this morning" anchor that
  // also avoids the future-time edge case of "now()" being a millisecond
  // after the slider's max.
  const [pickedDate, setPickedDate] = useState<string>(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [freeze, setFreeze] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Reset modal state when reopened with a new selection so we don't carry
  // a half-finished progress bar over.
  useEffect(() => {
    if (isOpen) {
      setProgress(null);
      setBusy(false);
      setMode('now');
      setFreeze(true);
    }
  }, [isOpen]);

  const count = videos.length;
  const sampleTitles = useMemo(
    () => videos.slice(0, 3).map(v => v.title || v.caption || `@${v.uploaderHandle || 'unknown'}`),
    [videos],
  );
  const remaining = count - sampleTitles.length;

  const submit = async () => {
    if (count === 0) return;
    setBusy(true);
    setProgress({ done: 0, total: count, failed: 0 });

    const when = mode === 'now' ? new Date() : new Date(pickedDate);
    if (Number.isNaN(when.getTime())) {
      alert('Pick a valid date.');
      setBusy(false);
      return;
    }

    let done = 0;
    let failed = 0;
    const successIds: string[] = [];

    // Sequential rather than Promise.all so the progress counter updates
    // smoothly and we don't slam Firestore with N parallel writes when N
    // could be large (selecting "all" is a real path).
    for (const v of videos) {
      try {
        await SparkService.markAsSparked(orgId, projectId, v.id, when);
        if (freeze) {
          await SparkService.setVideoFrozen(orgId, projectId, v.id, true);
        }
        done++;
        successIds.push(v.id);
      } catch (e) {
        console.error(`Bulk spark failed for video ${v.id}`, e);
        failed++;
      }
      setProgress({ done: done + failed, total: count, failed });
    }

    setBusy(false);
    onApplied(successIds, when, freeze);
    if (failed === 0) onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4"
      onClick={(e) => { e.stopPropagation(); if (!busy) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-surface-tertiary rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-content-muted" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-content leading-tight">Spark {count} video{count === 1 ? '' : 's'}</h2>
              <p className="text-xs text-content-muted mt-0.5">Same Spark moment will apply to every selected video</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5 text-content-muted" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Selection preview */}
          {count > 0 && (
            <div className="rounded-xl border border-border-subtle bg-surface-secondary p-3 text-xs text-content-muted">
              <div className="font-semibold text-content mb-1">Selected</div>
              {sampleTitles.map((t, i) => (
                <div key={i} className="truncate">• {t}</div>
              ))}
              {remaining > 0 && <div className="opacity-70 mt-0.5">+ {remaining} more</div>}
            </div>
          )}

          {/* Mode selector */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface-tertiary border border-border-subtle">
            {([
              { key: 'now',  label: 'Spark from now',  icon: Clock },
              { key: 'date', label: 'Pick a date',     icon: Calendar },
            ] as const).map(opt => {
              const active = mode === opt.key;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  onClick={() => setMode(opt.key)}
                  disabled={busy}
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

          {mode === 'date' && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                Spark moment
              </label>
              <input
                type="datetime-local"
                value={pickedDate}
                onChange={(e) => setPickedDate(e.target.value)}
                disabled={busy}
                className="w-full px-3 py-2 bg-surface-tertiary border border-border rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-content"
              />
              <p className="text-[10px] text-content-muted mt-1.5">
                Snapshot deltas captured AFTER this moment will count as ad-driven views for every selected video.
              </p>
            </div>
          )}

          {/* Freeze toggle */}
          <div className="rounded-xl border border-border bg-surface-secondary p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Snowflake className={`w-5 h-5 flex-shrink-0 mt-0.5 transition-colors ${freeze ? 'text-blue-500' : 'text-content-muted'}`} />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-content">Also freeze these videos</div>
                  <p className="text-[11px] text-content-muted mt-1 leading-relaxed">
                    Sparked videos grow on ad spend, so the cron skips them to save API quota. You can unfreeze any time.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFreeze(v => !v)}
                disabled={busy}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
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

          {/* Progress / errors */}
          {progress && (
            <div className="rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div className="flex items-center justify-between text-xs font-semibold text-content mb-2">
                <span>Sparking…</span>
                <span className="tabular-nums">{progress.done}/{progress.total}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-tertiary overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-200"
                  style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
                />
              </div>
              {progress.failed > 0 && (
                <p className="text-[11px] text-red-400 mt-2">
                  {progress.failed} video{progress.failed === 1 ? '' : 's'} failed — check console for details.
                </p>
              )}
            </div>
          )}

          <button
            onClick={submit}
            disabled={busy || count === 0}
            className="w-full px-4 py-2.5 text-sm font-bold text-white bg-orange-500 rounded-xl border-2 border-black shadow-[3px_3px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_0_#000]"
          >
            {busy
              ? `Sparking ${progress?.done ?? 0}/${count}…`
              : mode === 'now'
                ? `Spark ${count} video${count === 1 ? '' : 's'} from now`
                : `Spark ${count} video${count === 1 ? '' : 's'} from picked date`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default BulkSparkModal;
