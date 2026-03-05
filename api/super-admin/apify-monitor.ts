import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Super Admin - Apify Monitor API
 * 
 * Fetches Apify actor-runs data server-side so the token
 * is NEVER exposed to the client. Returns aggregated cost
 * and run metrics for the monitoring dashboard.
 * 
 * Security: Super-admin email verification required.
 */

const SUPER_ADMIN_EMAILS = [
  'ernesto@maktubtechnologies.com'
];

interface ApifyRunItem {
  id: string;
  actId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  buildNumber: string;
  usageTotalUsd?: number;
  defaultDatasetId: string;
  meta?: { origin?: string };
}

/**
 * Resolve Apify internal actor IDs to human-readable names.
 * Fetches actor details from Apify API and caches for the request.
 */
async function resolveActorNames(
  actorIds: string[],
  token: string
): Promise<Record<string, string>> {
  const nameMap: Record<string, string> = {};

  await Promise.all(
    actorIds.map(async (actId) => {
      try {
        const resp = await fetch(
          `https://api.apify.com/v2/acts/${actId}?token=${token}`
        );
        if (resp.ok) {
          const json = await resp.json();
          const actorName = json.data?.name || json.data?.title || actId;
          const ownerUsername = json.data?.username || '';
          nameMap[actId] = ownerUsername ? `${ownerUsername}/${actorName}` : actorName;
        } else {
          nameMap[actId] = actId;
        }
      } catch {
        nameMap[actId] = actId;
      }
    })
  );

  return nameMap;
}

interface DailyCost {
  date: string;
  totalUsd: number;
  runCount: number;
  succeededCount: number;
  failedCount: number;
}

interface ActorBreakdown {
  actorId: string;
  totalUsd: number;
  runCount: number;
  avgCostPerRun: number;
  failedCount: number;
  lastRunAt: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, days, limit } = req.query;

  // ── Security: verify super admin ──
  if (!email || !SUPER_ADMIN_EMAILS.includes((email as string).toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
  }

  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: 'APIFY_TOKEN not configured on server' });
  }

  const lookbackDays = Math.min(parseInt(days as string) || 7, 30);
  const maxItems = Math.min(parseInt(limit as string) || 1000, 1000);

  try {
    console.log(`🔍 ApifyMonitor: Fetching runs (last ${lookbackDays} days, limit ${maxItems})`);

    // Fetch runs from Apify API (descending = most recent first)
    const runsUrl = `https://api.apify.com/v2/actor-runs?token=${APIFY_TOKEN}&limit=${maxItems}&desc=true`;
    const response = await fetch(runsUrl);

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ Apify API error:', response.status, errText);
      return res.status(502).json({ error: 'Failed to fetch Apify runs', status: response.status });
    }

    const json = await response.json();
    const allRuns: ApifyRunItem[] = json.data?.items || [];

    // Filter to lookback window
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);
    const filteredRuns = allRuns.filter(r => new Date(r.startedAt) >= cutoff);

    // ── Aggregate: daily costs ──
    const dailyMap = new Map<string, DailyCost>();
    for (const run of filteredRuns) {
      const day = run.startedAt.substring(0, 10); // YYYY-MM-DD
      const entry = dailyMap.get(day) || {
        date: day,
        totalUsd: 0,
        runCount: 0,
        succeededCount: 0,
        failedCount: 0,
      };
      entry.totalUsd += run.usageTotalUsd || 0;
      entry.runCount += 1;
      if (run.status === 'SUCCEEDED') entry.succeededCount += 1;
      if (run.status === 'FAILED' || run.status === 'ABORTED' || run.status === 'TIMED-OUT') entry.failedCount += 1;
      dailyMap.set(day, entry);
    }
    const dailyCosts: DailyCost[] = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // ── Aggregate: actor breakdown ──
    const actorMap = new Map<string, ActorBreakdown>();
    for (const run of filteredRuns) {
      const entry = actorMap.get(run.actId) || {
        actorId: run.actId,
        totalUsd: 0,
        runCount: 0,
        avgCostPerRun: 0,
        failedCount: 0,
        lastRunAt: null,
      };
      entry.totalUsd += run.usageTotalUsd || 0;
      entry.runCount += 1;
      if (run.status === 'FAILED' || run.status === 'ABORTED' || run.status === 'TIMED-OUT') entry.failedCount += 1;
      if (!entry.lastRunAt || run.startedAt > entry.lastRunAt) entry.lastRunAt = run.startedAt;
      actorMap.set(run.actId, entry);
    }
    // Resolve actor names from Apify API
    const uniqueActorIds = Array.from(actorMap.keys());
    const actorNames = await resolveActorNames(uniqueActorIds, APIFY_TOKEN);

    const actorBreakdown: (ActorBreakdown & { actorName: string })[] = Array.from(actorMap.values())
      .map(a => ({
        ...a,
        avgCostPerRun: a.runCount > 0 ? a.totalUsd / a.runCount : 0,
        actorName: actorNames[a.actorId] || a.actorId,
      }))
      .sort((a, b) => b.totalUsd - a.totalUsd);

    // ── Summary stats ──
    const totalCostUsd = filteredRuns.reduce((s, r) => s + (r.usageTotalUsd || 0), 0);
    const totalRuns = filteredRuns.length;
    const succeededRuns = filteredRuns.filter(r => r.status === 'SUCCEEDED').length;
    const failedRuns = filteredRuns.filter(r => r.status === 'FAILED' || r.status === 'ABORTED' || r.status === 'TIMED-OUT').length;
    const runningRuns = filteredRuns.filter(r => r.status === 'RUNNING' || r.status === 'READY').length;
    const avgDailyCost = dailyCosts.length > 0 ? totalCostUsd / dailyCosts.length : 0;
    const uniqueActors = actorBreakdown.length;

    // ── Status distribution ──
    const statusDistribution: Record<string, number> = {};
    for (const run of filteredRuns) {
      statusDistribution[run.status] = (statusDistribution[run.status] || 0) + 1;
    }

    // ── Recent runs (last 50 for table) ──
    const recentRuns = filteredRuns.slice(0, 50).map(r => ({
      id: r.id,
      actorId: r.actId,
      actorName: actorNames[r.actId] || r.actId,
      status: r.status,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      costUsd: r.usageTotalUsd || 0,
      buildNumber: r.buildNumber,
      origin: r.meta?.origin || 'unknown',
      datasetId: r.defaultDatasetId,
    }));

    console.log(`✅ ApifyMonitor: ${totalRuns} runs, $${totalCostUsd.toFixed(4)} total in ${lookbackDays}d`);

    return res.status(200).json({
      success: true,
      summary: {
        totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
        avgDailyCost: Math.round(avgDailyCost * 10000) / 10000,
        totalRuns,
        succeededRuns,
        failedRuns,
        runningRuns,
        uniqueActors,
        lookbackDays,
        statusDistribution,
      },
      dailyCosts,
      actorBreakdown,
      recentRuns,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ ApifyMonitor error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
