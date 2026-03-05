import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
function initializeFirebase() {
  if (!getApps().length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      } as any),
    });
  }
  return getFirestore();
}

const SUPER_ADMIN_EMAILS = ['ernesto@maktubtechnologies.com'];

/**
 * Refresh Monitor API
 * 
 * Returns per-organization & per-account refresh data:
 *  - Recent refresh sessions with status, duration, account breakdown
 *  - Per-account health: last refreshed, status, platform, video counts
 *  - System overview: total orgs, active accounts, refresh cadence
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userEmail = req.query.email as string;
  if (!userEmail || !SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const db = initializeFirebase();
    const now = Date.now();

    // 1. Fetch all organizations (lightweight — just org docs)
    const orgsSnapshot = await db.collection('organizations').get();

    const orgSummaries: OrgRefreshSummary[] = [];
    const allAccountRows: AccountRefreshRow[] = [];
    let totalAccounts = 0;
    let healthyAccounts = 0;
    let staleAccounts = 0;
    let failedAccounts = 0;

    // Process each org in parallel
    const orgPromises = orgsSnapshot.docs.map(async (orgDoc) => {
      const orgId = orgDoc.id;
      const orgData = orgDoc.data();
      const orgName = orgData.name || 'Unnamed';

      // Get projects
      const projectsSnap = await db
        .collection('organizations').doc(orgId)
        .collection('projects').get();

      // Get latest refresh session
      const sessionsSnap = await db
        .collection('organizations').doc(orgId)
        .collection('refreshSessions')
        .orderBy('startedAt', 'desc')
        .limit(3)
        .get();

      const latestSession = sessionsSnap.docs[0]?.data() || null;

      // Gather accounts across projects (in parallel)
      const projectAccountPromises = projectsSnap.docs.map(async (projDoc) => {
        const projectId = projDoc.id;
        const projectName = projDoc.data().name || 'Default Project';

        const accountsSnap = await db
          .collection('organizations').doc(orgId)
          .collection('projects').doc(projectId)
          .collection('trackedAccounts').get();

        return accountsSnap.docs.map((accDoc) => {
          const acc = accDoc.data();
          const lastRefreshedMs = acc.lastRefreshed?.toMillis?.() || 0;
          const hoursSinceRefresh = lastRefreshedMs
            ? (now - lastRefreshedMs) / (1000 * 60 * 60)
            : Infinity;

          // Health classification
          let health: 'healthy' | 'stale' | 'failed' | 'never' = 'healthy';
          if (acc.refreshStatus === 'failed') health = 'failed';
          else if (!lastRefreshedMs) health = 'never';
          else if (hoursSinceRefresh > 36) health = 'stale';

          return {
            orgId,
            orgName,
            projectId,
            projectName,
            accountId: accDoc.id,
            username: acc.username || acc.displayName || 'unknown',
            platform: acc.platform || 'unknown',
            creatorType: acc.creatorType || 'automatic',
            isActive: acc.isActive !== false,
            refreshStatus: acc.refreshStatus || 'unknown',
            lastRefreshed: acc.lastRefreshed?.toDate?.()?.toISOString() || null,
            lastRefreshDuration: acc.lastRefreshDuration || null,
            lastRefreshError: acc.lastRefreshError || null,
            hoursSinceRefresh: lastRefreshedMs ? Math.round(hoursSinceRefresh * 10) / 10 : null,
            health,
            followerCount: acc.followerCount || 0,
          } as AccountRefreshRow;
        });
      });

      const nestedAccounts = await Promise.all(projectAccountPromises);
      const accounts = nestedAccounts.flat();

      const activeAccounts = accounts.filter((a) => a.isActive);
      const orgHealthy = activeAccounts.filter((a) => a.health === 'healthy').length;
      const orgStale = activeAccounts.filter((a) => a.health === 'stale' || a.health === 'never').length;
      const orgFailed = activeAccounts.filter((a) => a.health === 'failed').length;

      totalAccounts += activeAccounts.length;
      healthyAccounts += orgHealthy;
      staleAccounts += orgStale;
      failedAccounts += orgFailed;

      allAccountRows.push(...accounts);

      // Parse recent sessions
      const recentSessions: SessionSummary[] = sessionsSnap.docs.map((sDoc) => {
        const s = sDoc.data();
        return {
          sessionId: sDoc.id,
          orgId,
          orgName,
          status: s.status || 'unknown',
          startedAt: s.startedAt?.toDate?.()?.toISOString() || null,
          completedAt: s.completedAt?.toDate?.()?.toISOString() || null,
          totalAccounts: s.totalAccounts || 0,
          completedAccounts: s.completedAccounts || 0,
          totalVideos: s.totalVideos || 0,
          manualTrigger: s.manualTrigger || false,
          emailSent: s.emailSent || false,
        };
      });

      orgSummaries.push({
        orgId,
        orgName,
        planTier: 'free', // will be enriched below
        totalAccounts: activeAccounts.length,
        healthyAccounts: orgHealthy,
        staleAccounts: orgStale,
        failedAccounts: orgFailed,
        lastRefreshAt: latestSession?.startedAt?.toDate?.()?.toISOString() || null,
        lastRefreshStatus: latestSession?.status || 'never',
        recentSessions,
      });
    });

    await Promise.all(orgPromises);

    // Enrich plan tiers in parallel
    const planPromises = orgSummaries.map(async (org) => {
      try {
        const subDoc = await db
          .collection('organizations').doc(org.orgId)
          .collection('billing').doc('subscription').get();
        org.planTier = subDoc.data()?.planTier || 'free';
      } catch {
        org.planTier = 'free';
      }
    });
    await Promise.all(planPromises);

    // Sort orgs by most accounts first
    orgSummaries.sort((a, b) => b.totalAccounts - a.totalAccounts);

    // Sort account rows: failed first, then stale, then healthy
    const healthOrder = { failed: 0, stale: 1, never: 2, healthy: 3 };
    allAccountRows.sort(
      (a, b) => (healthOrder[a.health] ?? 9) - (healthOrder[b.health] ?? 9)
    );

    // Platform breakdown
    const platformCounts: Record<string, number> = {};
    allAccountRows.filter((a) => a.isActive).forEach((a) => {
      platformCounts[a.platform] = (platformCounts[a.platform] || 0) + 1;
    });

    return res.status(200).json({
      systemOverview: {
        totalOrganizations: orgsSnapshot.size,
        totalActiveAccounts: totalAccounts,
        healthyAccounts,
        staleAccounts,
        failedAccounts,
        platformBreakdown: platformCounts,
      },
      organizations: orgSummaries,
      accounts: allAccountRows,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Refresh Monitor API error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}

// ── Types ──

interface OrgRefreshSummary {
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

interface SessionSummary {
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

interface AccountRefreshRow {
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
