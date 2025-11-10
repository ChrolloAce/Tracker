import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    };

    initializeApp({ 
      credential: cert(serviceAccount as any),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app'
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const db = getFirestore();

// Subscription plan refresh intervals (in hours)
const PLAN_REFRESH_INTERVALS: Record<string, number> = {
  free: 48,
  basic: 24,
  pro: 24,
  ultra: 12,
  enterprise: 6,
};

/**
 * Cron Orchestrator
 * Runs every 12 hours (00:00 and 12:00) 
 * Refreshes accounts based on their organization's subscription plan:
 * - Enterprise: every 6 hours
 * - Ultra: every 12 hours
 * - Pro/Basic: every 24 hours
 * - Free: every 48 hours
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret or Vercel Cron header
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  
  // Allow if:
  // 1. Authorization header matches CRON_SECRET
  // 2. Request is from Vercel Cron (x-vercel-cron header)
  if (!isVercelCron && authHeader !== cronSecret) {
    console.log('❌ Unauthorized cron request:', { 
      hasAuth: !!authHeader, 
      hasVercelCron: isVercelCron,
      headers: Object.keys(req.headers)
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  console.log(`🚀 Cron Orchestrator started at ${new Date().toISOString()}`);

  try {
    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`📊 Found ${orgsSnapshot.size} organization(s)`);

    let totalAccounts = 0;
    let dispatchedJobs = 0;
    let failedDispatches = 0;
    let skippedAccounts = 0;
    const dispatchPromises: Promise<any>[] = [];

    // For each organization
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      console.log(`📁 Processing organization: ${orgId}`);

      // Get organization's subscription to determine refresh interval
      let orgPlanTier = 'free'; // Default to free
      try {
        const subscriptionDoc = await db
          .collection('organizations')
          .doc(orgId)
          .collection('billing')
          .doc('subscription')
          .get();
        
        if (subscriptionDoc.exists()) {
          const subscriptionData = subscriptionDoc.data();
          orgPlanTier = subscriptionData?.planTier || 'free';
        }
        console.log(`  📋 Organization plan: ${orgPlanTier}`);
      } catch (error) {
        console.error(`  ⚠️ Failed to get subscription, defaulting to free plan:`, error);
      }

      const refreshIntervalHours = PLAN_REFRESH_INTERVALS[orgPlanTier] || 24;
      const refreshIntervalMs = refreshIntervalHours * 60 * 60 * 1000;
      console.log(`  ⏱️  Refresh interval: ${refreshIntervalHours} hours`);

      // Get all projects in this org
      const projectsSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .get();

      console.log(`  📂 Found ${projectsSnapshot.size} project(s)`);

      // For each project
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        const projectData = projectDoc.data();
        console.log(`  📦 Processing project: ${projectData?.name || projectId}`);

        // Refresh accounts based on plan's refresh interval
        console.log(`    🚀 Checking accounts for refresh (${refreshIntervalHours}h interval)...`);

        // Get all active tracked accounts
        const accountsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('trackedAccounts')
          .where('status', '==', 'active')
          .get();

        totalAccounts += accountsSnapshot.size;
        console.log(`    👥 Found ${accountsSnapshot.size} active account(s)`);

        // Dispatch refresh jobs for accounts that need refreshing
        const now = Date.now();
        for (const accountDoc of accountsSnapshot.docs) {
          const accountId = accountDoc.id;
          const accountData = accountDoc.data();

          // Check if enough time has passed since last refresh
          const lastRefreshed = accountData.lastRefreshed?.toMillis() || 0;
          const timeSinceRefresh = now - lastRefreshed;
          const needsRefresh = timeSinceRefresh >= refreshIntervalMs;

          if (!needsRefresh) {
            const hoursRemaining = ((refreshIntervalMs - timeSinceRefresh) / (1000 * 60 * 60)).toFixed(1);
            console.log(`      ⏭️  Skipping @${accountData.username} (refreshed ${(timeSinceRefresh / (1000 * 60 * 60)).toFixed(1)}h ago, ${hoursRemaining}h remaining)`);
            skippedAccounts++;
            continue;
          }

          console.log(`      ⚡ Dispatching @${accountData.username} (${accountData.platform}), last refresh: ${lastRefreshed ? new Date(lastRefreshed).toISOString() : 'never'}`);

          // Dispatch async refresh job
          const dispatchPromise = fetch(`${process.env.VERCEL_URL || 'https://www.viewtrack.app'}/api/refresh-account`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': cronSecret || ''
            },
            body: JSON.stringify({
              orgId,
              projectId,
              accountId
            })
          })
            .then(async (response) => {
              if (response.ok) {
                const data = await response.json();
                console.log(`        ✅ @${accountData.username}: ${data.videosUpdated} updated, ${data.videosAdded} added`);
                dispatchedJobs++;
                return { success: true, account: accountData.username };
              } else {
                const errorText = await response.text();
                console.error(`        ❌ @${accountData.username} failed: ${errorText}`);
                failedDispatches++;
                return { success: false, account: accountData.username, error: errorText };
              }
            })
            .catch((error) => {
              console.error(`        ❌ @${accountData.username} dispatch error:`, error.message);
              failedDispatches++;
              return { success: false, account: accountData.username, error: error.message };
            });

          dispatchPromises.push(dispatchPromise);

          // Small stagger to avoid overwhelming (50ms between dispatches)
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Check if project has Apple revenue integration and sync if enabled
        const revenueIntegrationsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('revenueIntegrations')
          .where('provider', '==', 'apple')
          .where('enabled', '==', true)
          .get();

        if (!revenueIntegrationsSnapshot.empty) {
          console.log(`    💰 Found Apple revenue integration, syncing...`);
          
          // Sync last 7 days to catch any new data (incremental sync)
          const dispatchPromise = fetch(`${process.env.VERCEL_URL || 'https://www.viewtrack.app'}/api/sync-apple-revenue`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': cronSecret || ''
            },
            body: JSON.stringify({
              organizationId: orgId,
              projectId: projectId,
              dateRange: '7', // Last 7 days for incremental sync
              manual: false
            })
          })
            .then(async (response) => {
              if (response.ok) {
                const data = await response.json();
                console.log(`      ✅ Revenue synced: $${data.data?.totalRevenue || 0}, ${data.data?.totalDownloads || 0} downloads`);
                return { success: true, type: 'revenue' };
              } else {
                const errorText = await response.text();
                console.error(`      ❌ Revenue sync failed: ${errorText}`);
                return { success: false, type: 'revenue', error: errorText };
              }
            })
            .catch((error) => {
              console.error(`      ❌ Revenue sync dispatch error:`, error.message);
              return { success: false, type: 'revenue', error: error.message };
            });

          dispatchPromises.push(dispatchPromise);
        }

        // Update project's lastGlobalRefresh timestamp
        await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .update({
            lastGlobalRefresh: Timestamp.now()
          });
        
        console.log(`    ✅ Updated lastGlobalRefresh for project`);
      }
    }

    // Wait for all dispatched jobs to complete
    console.log(`\n⏳ Waiting for ${dispatchPromises.length} dispatched jobs to complete...`);
    const results = await Promise.allSettled(dispatchPromises);

    // Count successes and failures
    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as any).success)).length;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n============================================================`);
    console.log(`🎉 Orchestrator completed!`);
    console.log(`============================================================`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Accounts found: ${totalAccounts}`);
    console.log(`⏭️  Skipped (not due yet): ${skippedAccounts}`);
    console.log(`🚀 Jobs dispatched: ${dispatchPromises.length}`);
    console.log(`✅ Jobs successful: ${successful}`);
    console.log(`❌ Jobs failed: ${failed}`);
    console.log(`============================================================\n`);

    return res.status(200).json({
      success: true,
      message: 'Orchestrator completed',
      stats: {
        totalAccounts,
        accountsSkipped: skippedAccounts,
        jobsDispatched: dispatchPromises.length,
        jobsSuccessful: successful,
        jobsFailed: failed,
        duration: parseFloat(duration)
      },
      results: results.map((r, i) => {
        if (r.status === 'fulfilled') {
          return r.value;
        } else {
          return { success: false, error: r.reason };
        }
      })
    });

  } catch (error: any) {
    console.error(`❌ Orchestrator error:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Orchestrator failed'
    });
  }
}

