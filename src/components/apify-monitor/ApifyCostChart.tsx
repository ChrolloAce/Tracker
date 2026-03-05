import React from 'react';
import type { DailyCost } from '../../services/ApifyMonitorService';

interface ApifyCostChartProps {
  dailyCosts: DailyCost[];
}

/**
 * Minimal bar-chart for daily Apify costs.
 * Pure CSS — no chart library dependency.
 */
const ApifyCostChart: React.FC<ApifyCostChartProps> = ({ dailyCosts }) => {
  if (dailyCosts.length === 0) {
    return (
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 text-center text-white/30 text-sm">
        No cost data available
      </div>
    );
  }

  const maxCost = Math.max(...dailyCosts.map((d) => d.totalUsd), 0.01);
  const maxRuns = Math.max(...dailyCosts.map((d) => d.runCount), 1);

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">
          Daily Cost & Runs
        </h3>
        <div className="flex items-center gap-4 text-[10px] text-white/40">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-white/60" /> Cost
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-white/20" /> Runs
          </span>
        </div>
      </div>

      {/* Chart body */}
      <div className="flex items-end gap-1 h-40">
        {dailyCosts.map((day) => {
          const costPct = (day.totalUsd / maxCost) * 100;
          const runsPct = (day.runCount / maxRuns) * 100;
          const dayLabel = day.date.substring(5); // MM-DD

          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center gap-0.5 group relative"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 bg-[#1a1a1a] border border-white/10 rounded-lg p-2 text-[10px] text-white whitespace-nowrap shadow-xl">
                <div className="font-medium">{day.date}</div>
                <div className="text-white/60">Cost: ${day.totalUsd.toFixed(4)}</div>
                <div className="text-white/60">Runs: {day.runCount}</div>
                <div className="text-white/60">
                  ✓ {day.succeededCount} | ✗ {day.failedCount}
                </div>
              </div>

              {/* Bars */}
              <div className="w-full flex gap-px items-end h-32">
                <div
                  className="flex-1 bg-white/60 rounded-t transition-all duration-300"
                  style={{ height: `${Math.max(costPct, 2)}%` }}
                />
                <div
                  className="flex-1 bg-white/20 rounded-t transition-all duration-300"
                  style={{ height: `${Math.max(runsPct, 2)}%` }}
                />
              </div>

              {/* Date label */}
              <div className="text-[8px] text-white/30 mt-1 rotate-0">{dayLabel}</div>
            </div>
          );
        })}
      </div>

      {/* Summary row */}
      <div className="flex justify-between mt-3 pt-3 border-t border-white/5 text-[10px] text-white/40">
        <span>
          Peak: ${Math.max(...dailyCosts.map((d) => d.totalUsd)).toFixed(2)} / day
        </span>
        <span>
          Peak: {Math.max(...dailyCosts.map((d) => d.runCount))} runs / day
        </span>
      </div>
    </div>
  );
};

export default ApifyCostChart;
