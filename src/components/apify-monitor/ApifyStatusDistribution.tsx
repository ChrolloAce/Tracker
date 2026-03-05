import React from 'react';

interface ApifyStatusDistributionProps {
  distribution: Record<string, number>;
  totalRuns: number;
}

const STATUS_COLORS: Record<string, string> = {
  SUCCEEDED: 'bg-emerald-500',
  FAILED: 'bg-red-500',
  ABORTED: 'bg-amber-500',
  'TIMED-OUT': 'bg-orange-500',
  RUNNING: 'bg-blue-500',
  READY: 'bg-white/20',
};

/**
 * Visual bar showing run-status distribution across all runs.
 */
const ApifyStatusDistribution: React.FC<ApifyStatusDistributionProps> = ({
  distribution,
  totalRuns,
}) => {
  if (totalRuns === 0) return null;

  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
      <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
        Status Distribution
      </h3>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px mb-3">
        {entries.map(([status, count]) => {
          const pct = (count / totalRuns) * 100;
          return (
            <div
              key={status}
              className={`${STATUS_COLORS[status] || 'bg-white/10'} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${status}: ${count} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {entries.map(([status, count]) => {
          const pct = ((count / totalRuns) * 100).toFixed(1);
          return (
            <div key={status} className="flex items-center gap-1.5 text-[10px]">
              <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status] || 'bg-white/10'}`} />
              <span className="text-white/50">{status}</span>
              <span className="text-white/70 font-medium">{count}</span>
              <span className="text-white/30">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ApifyStatusDistribution;
