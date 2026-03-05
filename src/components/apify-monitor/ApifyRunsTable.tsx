import React from 'react';
import { CheckCircle2, XCircle, Clock, Loader2, AlertTriangle } from 'lucide-react';
import type { RecentRun } from '../../services/ApifyMonitorService';

interface ApifyRunsTableProps {
  runs: RecentRun[];
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  SUCCEEDED: { icon: CheckCircle2, color: 'text-emerald-400' },
  FAILED: { icon: XCircle, color: 'text-red-400' },
  ABORTED: { icon: AlertTriangle, color: 'text-amber-400' },
  'TIMED-OUT': { icon: Clock, color: 'text-orange-400' },
  RUNNING: { icon: Loader2, color: 'text-blue-400' },
  READY: { icon: Clock, color: 'text-white/40' },
};

/**
 * Table of recent Apify runs with status, cost, and timing.
 */
const ApifyRunsTable: React.FC<ApifyRunsTableProps> = ({ runs }) => {
  if (runs.length === 0) {
    return (
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 text-center text-white/30 text-sm">
        No recent runs
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">
          Recent Runs
        </h3>
        <span className="text-[10px] text-white/30">{runs.length} shown</span>
      </div>

      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0a0a0a]">
            <tr className="text-white/30 border-b border-white/5">
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Run ID</th>
              <th className="text-left px-4 py-2 font-medium">Actor</th>
              <th className="text-right px-4 py-2 font-medium">Cost</th>
              <th className="text-left px-4 py-2 font-medium">Started</th>
              <th className="text-left px-4 py-2 font-medium">Duration</th>
              <th className="text-left px-4 py-2 font-medium">Origin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {runs.map((run) => {
              const cfg = STATUS_CONFIG[run.status] || STATUS_CONFIG.READY;
              const StatusIcon = cfg.icon;
              const duration = computeDuration(run.startedAt, run.finishedAt);

              return (
                <tr key={run.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <StatusIcon
                        className={`w-3.5 h-3.5 ${cfg.color} ${run.status === 'RUNNING' ? 'animate-spin' : ''}`}
                      />
                      <span className={`${cfg.color} font-medium`}>{run.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-white/50 font-mono truncate max-w-[120px]">
                    {run.id}
                  </td>
                  <td className="px-4 py-2.5 max-w-[160px]">
                    <div className="text-white/60 text-xs truncate">{run.actorName}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-white/70">
                    ${run.costUsd.toFixed(4)}
                  </td>
                  <td className="px-4 py-2.5 text-white/40">
                    {formatTimestamp(run.startedAt)}
                  </td>
                  <td className="px-4 py-2.5 text-white/40">{duration}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-white/50">
                      {run.origin}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function computeDuration(start: string, end: string | null): string {
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}m ${remainSecs}s`;
}

export default ApifyRunsTable;
