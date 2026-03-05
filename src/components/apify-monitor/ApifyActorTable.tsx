import React from 'react';
import type { ActorBreakdown } from '../../services/ApifyMonitorService';

interface ApifyActorTableProps {
  actors: ActorBreakdown[];
}

/**
 * Table showing cost & run breakdown per Apify actor.
 * Sorted by total cost descending — the most expensive actors sit on top.
 */
const ApifyActorTable: React.FC<ApifyActorTableProps> = ({ actors }) => {
  if (actors.length === 0) {
    return (
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 text-center text-white/30 text-sm">
        No actor data
      </div>
    );
  }

  const totalCost = actors.reduce((s, a) => s + a.totalUsd, 0) || 1;

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">
          Actor Cost Breakdown
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/30 border-b border-white/5">
              <th className="text-left px-4 py-2 font-medium">Actor</th>
              <th className="text-right px-4 py-2 font-medium">Runs</th>
              <th className="text-right px-4 py-2 font-medium">Failed</th>
              <th className="text-right px-4 py-2 font-medium">Avg $/Run</th>
              <th className="text-right px-4 py-2 font-medium">Total $</th>
              <th className="text-right px-4 py-2 font-medium">% of Spend</th>
              <th className="text-left px-4 py-2 font-medium">Last Run</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {actors.map((actor) => {
              const pct = (actor.totalUsd / totalCost) * 100;
              return (
                <tr key={actor.actorId} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2.5 max-w-[220px]">
                    <div className="text-white/80 font-medium text-xs truncate">{actor.actorName}</div>
                    <div className="text-white/30 font-mono text-[10px] truncate">{actor.actorId}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-white/60">
                    {actor.runCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={actor.failedCount > 0 ? 'text-red-400' : 'text-white/30'}>
                      {actor.failedCount}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-white/60">
                    ${actor.avgCostPerRun.toFixed(4)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-white font-medium">
                    ${actor.totalUsd.toFixed(4)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white/40 rounded-full"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-white/50 w-10 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-white/40">
                    {actor.lastRunAt ? formatTimeAgo(actor.lastRunAt) : '—'}
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

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default ApifyActorTable;
