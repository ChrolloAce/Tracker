/**
 * ApifyMonitorService
 * 
 * Client-side service that calls our secure server-side API
 * to fetch Apify monitoring data. The Apify token is NEVER
 * exposed to the browser — all requests go through
 * /api/super-admin/apify-monitor.
 */

export interface ApifySummary {
  totalCostUsd: number;
  avgDailyCost: number;
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
  runningRuns: number;
  uniqueActors: number;
  lookbackDays: number;
  statusDistribution: Record<string, number>;
}

export interface DailyCost {
  date: string;
  totalUsd: number;
  runCount: number;
  succeededCount: number;
  failedCount: number;
}

export interface ActorBreakdown {
  actorId: string;
  actorName: string;
  totalUsd: number;
  runCount: number;
  avgCostPerRun: number;
  failedCount: number;
  lastRunAt: string | null;
}

export interface RecentRun {
  id: string;
  actorId: string;
  actorName: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  costUsd: number;
  buildNumber: string;
  origin: string;
  datasetId: string;
}

export interface ApifyMonitorData {
  summary: ApifySummary;
  dailyCosts: DailyCost[];
  actorBreakdown: ActorBreakdown[];
  recentRuns: RecentRun[];
  fetchedAt: string;
}

class ApifyMonitorService {
  /**
   * Fetch Apify monitoring data from our secure backend.
   * Token never leaves the server.
   */
  async fetchMonitorData(userEmail: string, days: number = 7): Promise<ApifyMonitorData> {
    const params = new URLSearchParams({
      email: userEmail,
      days: String(days),
      limit: '1000',
    });

    const response = await fetch(`/api/super-admin/apify-monitor?${params}`);

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Failed to fetch Apify data (${response.status})`);
    }

    const data = await response.json();
    return {
      summary: data.summary,
      dailyCosts: data.dailyCosts,
      actorBreakdown: data.actorBreakdown,
      recentRuns: data.recentRuns,
      fetchedAt: data.fetchedAt,
    };
  }

  /**
   * Trigger manual orchestrator refresh (all orgs).
   * Requires Firebase user token for auth.
   */
  async triggerManualRefresh(firebaseToken: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch('/api/cron-orchestrator', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Refresh trigger failed (${response.status})`);
    }

    return response.json();
  }
}

export default new ApifyMonitorService();
