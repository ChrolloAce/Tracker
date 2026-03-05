import React, { useState, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import type { AccountRefreshRow } from '../../services/RefreshMonitorService';

interface Props {
  accounts: AccountRefreshRow[];
}

type HealthFilter = 'all' | 'healthy' | 'stale' | 'failed' | 'never';
type PlatformFilter = 'all' | string;

function healthBadge(health: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    healthy: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Healthy' },
    stale: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Stale' },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
    never: { bg: 'bg-white/5', text: 'text-white/30', label: 'Never' },
  };
  const s = map[health] || { bg: 'bg-white/5', text: 'text-white/30', label: health };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

function timeAgo(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return `${Math.floor(diff / (1000 * 60))}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const AccountRefreshTable: React.FC<Props> = ({ accounts }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [showInactive, setShowInactive] = useState(false);

  const platforms = useMemo(() => {
    const set = new Set(accounts.map((a) => a.platform));
    return Array.from(set).sort();
  }, [accounts]);

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (!showInactive && !a.isActive) return false;
      if (healthFilter !== 'all' && a.health !== healthFilter) return false;
      if (platformFilter !== 'all' && a.platform !== platformFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          a.username.toLowerCase().includes(q) ||
          a.orgName.toLowerCase().includes(q) ||
          a.platform.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [accounts, searchQuery, healthFilter, platformFilter, showInactive]);

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-white/30" />
            <span className="text-sm font-medium text-white/70">
              Per-Account Health ({filtered.length})
            </span>
          </div>
          <label className="flex items-center gap-2 text-xs text-white/40 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={() => setShowInactive(!showInactive)}
              className="rounded border-white/20 bg-white/5"
            />
            Show inactive
          </label>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              placeholder="Search username, org…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/[0.02] border border-white/5 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/20 text-xs"
            />
          </div>

          {/* Health filter */}
          <div className="flex gap-1 bg-white/[0.02] border border-white/5 rounded-lg p-0.5">
            {(['all', 'healthy', 'stale', 'failed', 'never'] as const).map((h) => (
              <button
                key={h}
                onClick={() => setHealthFilter(h)}
                className={`px-2.5 py-1.5 rounded text-[10px] font-medium transition-colors ${
                  healthFilter === h
                    ? 'bg-white text-black'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                {h === 'all' ? 'All' : h.charAt(0).toUpperCase() + h.slice(1)}
              </button>
            ))}
          </div>

          {/* Platform filter */}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/[0.02] border border-white/5 rounded-lg text-xs text-white/70 focus:outline-none"
          >
            <option value="all">All Platforms</option>
            {platforms.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-left">
          <thead className="bg-white/[0.02] sticky top-0 z-10">
            <tr className="text-[10px] text-white/40 uppercase tracking-wider">
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-4 py-2 font-medium">Org</th>
              <th className="px-4 py-2 font-medium">Platform</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Health</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Last Refreshed</th>
              <th className="px-4 py-2 font-medium">Duration</th>
              <th className="px-4 py-2 font-medium">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((acc) => (
              <tr
                key={`${acc.orgId}-${acc.accountId}`}
                className={`hover:bg-white/[0.02] transition-colors ${!acc.isActive ? 'opacity-40' : ''}`}
              >
                <td className="px-4 py-2 text-sm text-white font-medium">
                  @{acc.username}
                </td>
                <td className="px-4 py-2 text-xs text-white/50 truncate max-w-[120px]">
                  {acc.orgName}
                </td>
                <td className="px-4 py-2 text-xs text-white/50 capitalize">
                  {acc.platform}
                </td>
                <td className="px-4 py-2 text-xs text-white/40 capitalize">
                  {acc.creatorType}
                </td>
                <td className="px-4 py-2">{healthBadge(acc.health)}</td>
                <td className="px-4 py-2 text-xs text-white/50">{acc.refreshStatus}</td>
                <td className="px-4 py-2 text-xs text-white/50">
                  {timeAgo(acc.lastRefreshed)}
                  {acc.hoursSinceRefresh != null && (
                    <span className="text-white/30 ml-1">({acc.hoursSinceRefresh}h)</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-white/40">
                  {formatDuration(acc.lastRefreshDuration)}
                </td>
                <td className="px-4 py-2 text-xs text-red-400/70 truncate max-w-[200px]">
                  {acc.lastRefreshError || '—'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-white/30 text-sm">
                  No accounts match filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccountRefreshTable;
