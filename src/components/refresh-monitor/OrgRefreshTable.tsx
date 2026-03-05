import React, { useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import type { OrgRefreshSummary } from '../../services/RefreshMonitorService';

interface Props {
  organizations: OrgRefreshSummary[];
}

function timeAgo(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return `${Math.floor(diff / (1000 * 60))}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusBadge(status: string) {
  const map: Record<string, { color: string; label: string }> = {
    completed: { color: 'bg-emerald-500/20 text-emerald-400', label: 'Completed' },
    dispatching: { color: 'bg-blue-500/20 text-blue-400', label: 'Dispatching' },
    processing: { color: 'bg-yellow-500/20 text-yellow-400', label: 'Processing' },
    failed: { color: 'bg-red-500/20 text-red-400', label: 'Failed' },
    never: { color: 'bg-white/5 text-white/30', label: 'Never' },
  };
  const s = map[status] || { color: 'bg-white/5 text-white/40', label: status };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${s.color}`}>
      {s.label}
    </span>
  );
}

const OrgRefreshTable: React.FC<Props> = ({ organizations }) => {
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-white/30" />
        <span className="text-sm font-medium text-white/70">Organizations ({organizations.length})</span>
      </div>

      <div className="divide-y divide-white/5">
        {organizations.map((org) => {
          const isExpanded = expandedOrg === org.orgId;
          return (
            <div key={org.orgId}>
              <button
                onClick={() => setExpandedOrg(isExpanded ? null : org.orgId)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors text-left"
              >
                <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-white/50 text-xs font-medium flex-shrink-0">
                  {org.orgName.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{org.orgName}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-white/5 text-white/40">
                      {org.planTier}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-white/40 mt-0.5">
                    <span>{org.totalAccounts} accounts</span>
                    <span>•</span>
                    <span>Last: {timeAgo(org.lastRefreshAt)}</span>
                  </div>
                </div>

                {/* Health indicators */}
                <div className="hidden md:flex items-center gap-3 text-xs flex-shrink-0">
                  {org.healthyAccounts > 0 && (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" /> {org.healthyAccounts}
                    </span>
                  )}
                  {org.staleAccounts > 0 && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" /> {org.staleAccounts}
                    </span>
                  )}
                  {org.failedAccounts > 0 && (
                    <span className="flex items-center gap-1 text-red-400">
                      <XCircle className="w-3.5 h-3.5" /> {org.failedAccounts}
                    </span>
                  )}
                </div>

                {statusBadge(org.lastRefreshStatus)}

                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-white/30 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/30 flex-shrink-0" />
                )}
              </button>

              {/* Expanded: recent sessions */}
              {isExpanded && org.recentSessions.length > 0 && (
                <div className="bg-white/[0.01] border-t border-white/5 px-4 py-3">
                  <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Recent Sessions</span>
                  <div className="mt-2 space-y-2">
                    {org.recentSessions.map((s) => (
                      <div key={s.sessionId} className="flex items-center gap-3 text-xs">
                        {statusBadge(s.status)}
                        <span className="text-white/50 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {s.startedAt ? new Date(s.startedAt).toLocaleString() : '—'}
                        </span>
                        <span className="text-white/40">
                          {s.completedAccounts}/{s.totalAccounts} accounts
                        </span>
                        <span className="text-white/40">{s.totalVideos} videos</span>
                        {s.manualTrigger && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px]">Manual</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {organizations.length === 0 && (
          <div className="px-4 py-8 text-center text-white/30 text-sm">No organizations found</div>
        )}
      </div>
    </div>
  );
};

export default OrgRefreshTable;
