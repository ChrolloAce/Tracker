import React from 'react';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users,
  Building2,
} from 'lucide-react';
import type { SystemOverview } from '../../services/RefreshMonitorService';

interface Props {
  overview: SystemOverview;
}

const CARDS = (o: SystemOverview) => [
  { icon: Building2, label: 'Organizations', value: o.totalOrganizations, color: 'text-white/60' },
  { icon: Users, label: 'Active Accounts', value: o.totalActiveAccounts, color: 'text-white/60' },
  { icon: CheckCircle, label: 'Healthy', value: o.healthyAccounts, color: 'text-emerald-400' },
  { icon: AlertTriangle, label: 'Stale / Never', value: o.staleAccounts, color: 'text-amber-400' },
  { icon: XCircle, label: 'Failed', value: o.failedAccounts, color: 'text-red-400' },
];

const RefreshOverviewCards: React.FC<Props> = ({ overview }) => {
  const cards = CARDS(overview);
  const healthPercent = overview.totalActiveAccounts
    ? Math.round((overview.healthyAccounts / overview.totalActiveAccounts) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Health bar */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-white/40" />
            <span className="text-xs text-white/50 uppercase tracking-wider font-medium">System Health</span>
          </div>
          <span className="text-sm font-medium text-white">{healthPercent}%</span>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden flex">
          {overview.healthyAccounts > 0 && (
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${(overview.healthyAccounts / overview.totalActiveAccounts) * 100}%` }}
            />
          )}
          {overview.staleAccounts > 0 && (
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${(overview.staleAccounts / overview.totalActiveAccounts) * 100}%` }}
            />
          )}
          {overview.failedAccounts > 0 && (
            <div
              className="h-full bg-red-500 transition-all"
              style={{ width: `${(overview.failedAccounts / overview.totalActiveAccounts) * 100}%` }}
            />
          )}
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-white/40">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Healthy</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Stale</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Failed</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <Icon className={`w-4 h-4 ${card.color} mb-2`} />
              <div className="text-xl font-medium text-white">{card.value.toLocaleString()}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* Platform breakdown */}
      {Object.keys(overview.platformBreakdown).length > 0 && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <span className="text-xs text-white/50 uppercase tracking-wider font-medium">Platform Breakdown</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(overview.platformBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([platform, count]) => (
                <div key={platform} className="bg-white/5 rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <span className="text-xs text-white/50 capitalize">{platform}</span>
                  <span className="text-sm font-medium text-white">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RefreshOverviewCards;
