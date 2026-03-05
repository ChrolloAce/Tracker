import React, { useState, useCallback } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { parseViralCSV, ParsedViralEntry } from '../../utils/csvParser';
import { useAuth } from '../../contexts/AuthContext';

const BATCH_SIZE = 400;
const API_BASE = '/api/super-admin/seed-viral-content';

interface SeedProgress {
  phase: 'idle' | 'parsing' | 'uploading' | 'done' | 'error';
  totalEntries: number;
  sentEntries: number;
  message: string;
}

const SeedViralButton: React.FC = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<SeedProgress>({
    phase: 'idle',
    totalEntries: 0,
    sentEntries: 0,
    message: '',
  });

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user?.email) return;

      // Phase 1 — parse CSV
      setProgress({ phase: 'parsing', totalEntries: 0, sentEntries: 0, message: 'Parsing CSV…' });
      const text = await file.text();

      let entries: ParsedViralEntry[];
      try {
        entries = parseViralCSV(text);
      } catch {
        setProgress({ phase: 'error', totalEntries: 0, sentEntries: 0, message: 'Failed to parse CSV' });
        return;
      }

      if (entries.length === 0) {
        setProgress({ phase: 'error', totalEntries: 0, sentEntries: 0, message: 'No rows found in CSV' });
        return;
      }

      setProgress({ phase: 'uploading', totalEntries: entries.length, sentEntries: 0, message: `Uploading ${entries.length} entries…` });

      // Phase 2 — send in batches
      let totalSent = 0;
      const batches = chunkArray(entries, BATCH_SIZE);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        try {
          const resp = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              entries: batch,
              clearFirst: i === 0, // clear collection only on first batch
            }),
          });

          if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error || `HTTP ${resp.status}`);
          }

          totalSent += batch.length;
          setProgress((prev) => ({
            ...prev,
            sentEntries: totalSent,
            message: `Uploaded ${totalSent} / ${entries.length}…`,
          }));
        } catch (error) {
          setProgress({
            phase: 'error',
            totalEntries: entries.length,
            sentEntries: totalSent,
            message: `Error on batch ${i + 1}: ${error instanceof Error ? error.message : String(error)}`,
          });
          return;
        }
      }

      setProgress({
        phase: 'done',
        totalEntries: entries.length,
        sentEntries: totalSent,
        message: `Successfully seeded ${totalSent} entries!`,
      });

      // Reset file input
      e.target.value = '';
    },
    [user],
  );

  const pct =
    progress.totalEntries > 0
      ? Math.round((progress.sentEntries / progress.totalEntries) * 100)
      : 0;

  return (
    <div className="flex items-center gap-3">
      {/* Upload button */}
      <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-all text-sm font-medium cursor-pointer">
        <Upload className="w-4 h-4" />
        Seed from CSV
        <input
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileSelect}
          disabled={progress.phase === 'uploading' || progress.phase === 'parsing'}
        />
      </label>

      {/* Status indicator */}
      {progress.phase === 'parsing' && (
        <span className="flex items-center gap-1.5 text-xs text-yellow-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Parsing…
        </span>
      )}

      {progress.phase === 'uploading' && (
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
          <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-blue-400">{pct}%</span>
        </div>
      )}

      {progress.phase === 'done' && (
        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle className="w-3.5 h-3.5" /> {progress.message}
        </span>
      )}

      {progress.phase === 'error' && (
        <span className="flex items-center gap-1.5 text-xs text-red-400 max-w-xs truncate">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {progress.message}
        </span>
      )}
    </div>
  );
};

// ─── Utility ─────────────────────────────────────────────
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export default SeedViralButton;
