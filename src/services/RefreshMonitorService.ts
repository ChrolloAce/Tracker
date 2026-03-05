/**
 * RefreshMonitorService
 *
 * Client-side service for fetching refresh health data from
 * /api/super-admin/refresh-monitor.
 */

export interface SystemOverview {
  totalOrganizations: number;
  totalActiveAccounts: number;
  healthyAccounts: number;
  staleAccounts: number;
  failedAccounts: number;
  platformBreakdown: Record<string, number>;
}

export interface SessionSummary {
  sessionId: string;
  orgId: string;
  orgName: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  totalAccounts: number;
  completedAccounts: number;
  totalVideos: number;
  manualTrigger: boolean;
  emailSent: boolean;
}

export interface OrgRefreshSummary {
  orgId: string;
  orgName: string;
  planTier: string;
  totalAccounts: number;
  healthyAccounts: number;
  staleAccounts: number;
  failedAccounts: number;
  lastRefreshAt: string | null;
  lastRefreshStatus: string;
  recentSessions: SessionSummary[];
}

export interface AccountRefreshRow {
  orgId: string;
  orgName: string;
  projectId: string;
  projectName: string;
  accountId: string;
  username: string;
  platform: string;
  creatorType: string;
  isActive: boolean;
  refreshStatus: string;
  lastRefreshed: string | null;
  lastRefreshDuration: number | null;
  lastRefreshError: string | null;
  hoursSinceRefresh: number | null;
  health: 'healthy' | 'stale' | 'failed' | 'never';
  followerCount: number;
}

export interface RefreshMonitorData {
  systemOverview: SystemOverview;
  organizations: OrgRefreshSummary[];
  accounts: AccountRefreshRow[];
  fetchedAt: string;
}

class RefreshMonitorService {
  async fetchMonitorData(userEmail: string): Promise<RefreshMonitorData> {
    const params = new URLSearchParams({ email: userEmail });
    const response = await fetch(`/api/super-admin/refresh-monitor?${params}`);

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Failed to fetch refresh data (${response.status})`);
    }

    return response.json();
  }
}

export default new RefreshMonitorService();
