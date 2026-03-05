import React from 'react';
import { DollarSign, Activity, CheckCircle2, XCircle, Cpu, TrendingUp } from 'lucide-react';
import type { ApifySummary } from '../../services/ApifyMonitorService';

interface ApifyStatsCardsProps {
  summary: ApifySummary;
}

const ApifyStatsCards: React.FC<ApifyStatsCardsProps> = ({ summary }) => {
  const cards = [
    {
      icon: DollarSign,
      label: 'Total Cost',
      value: `$${summary.totalCostUsd.toFixed(2)}`,
      sublabel: `Last ${summary.lookbackDays}d`,
      highlight: true,
    },
    {
      icon: TrendingUp,
      label: 'Avg Daily Cost',
      value: `$${summary.avgDailyCost.toFixed(2)}`,
      sublabel: 'Per day',
      highlight: summary.avgDailyCost > 5,
    },
    {
      icon: Activity,
      label: 'Total Runs',
      value: summary.totalRuns.toLocaleString(),
      sublabel: `${summary.lookbackDays} day window`,
    },
    {
      icon: CheckCircle2,
      label: 'Succeeded',
      value: summary.succeededRuns.toLocaleString(),
      sublabel: `${summary.totalRuns > 0 ? ((summary.succeededRuns / summary.totalRuns) * 100).toFixed(1) : 0}% rate`,
    },
    {
      icon: XCircle,
      label: 'Failed / Aborted',
      value: summary.failedRuns.toLocaleString(),
      sublabel: summary.failedRuns > 0 ? '⚠️ Check logs' : 'All good',
      highlight: summary.failedRuns > 10,
    },
    {
      icon: Cpu,
      label: 'Unique Actors',
      value: summary.uniqueActors.toLocaleString(),
      sublabel: 'Active actors',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`rounded-xl p-4 ${
              card.highlight
                ? 'bg-white/[0.04] border border-white/10'
                : 'bg-white/[0.02] border border-white/5'
            }`}
          >
            <Icon className="w-4 h-4 text-white/30 mb-2" />
            <div className="text-xl font-bold text-white">{card.value}</div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider">{card.label}</div>
            <div className="text-[10px] text-white/30 mt-1">{card.sublabel}</div>
          </div>
        );
      })}
    </div>
  );
};

export default ApifyStatsCards;
