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
  free: 0.0833,     // 5 minutes for testing (normally 48 hours)
  basic: 0.0833,    // 5 minutes for testing (normally 24 hours)
  pro: 0.0833,      // 5 minutes for testing (normally 24 hours)
  ultra: 0.0833,    // 5 minutes for testing (normally 12 hours)
  enterprise: 0.0833, // 5 minutes for testing (normally 12 hours)
};

/**
 * Refresh Organization
 * Processes a single organization's accounts and projects
 * Called by cron-orchestrator for parallel processing
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authorization
  let authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    authHeader = authHeader.substring(7);
  }
  
  const isAuthorized = authHeader === cronSecret;
  
  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { organizationId } = req.body;
  
  if (!organizationId) {
    return res.status(400).json({ error: 'organizationId is required' });
  }

  const startTime = Date.now();
  console.log(`📁 Processing organization: ${organizationId}`);

  try {
    const orgDoc = await db.collection('organizations').doc(organizationId).get();
    
    if (!orgDoc.exists) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get organization's subscription to determine refresh interval
    let orgPlanTier = 'free';
    try {
      const subscriptionDoc = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('billing')
        .doc('subscription')
        .get();
      
      if (subscriptionDoc.exists) {
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
      .doc(organizationId)
      .collection('projects')
      .get();

    console.log(`  📂 Found ${projectsSnapshot.size} project(s)`);

    let totalAccounts = 0;
    let dispatchedJobs = 0;
    let skippedAccounts = 0;
    let successful = 0;
    let failed = 0;
    let totalVideosRefreshed = 0;
    let totalVideosAdded = 0;
    const dispatchPromises: Promise<any>[] = [];

    // Process each project
    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id;
      const projectData = projectDoc.data();
      console.log(`  📦 Processing project: ${projectData.name || projectId}`);

      // Check last global refresh time
      const lastGlobalRefresh = projectData.lastGlobalRefresh?.toMillis() || 0;
      const timeSinceGlobalRefresh = Date.now() - lastGlobalRefresh;
      
      console.log(`    🚀 Checking accounts for refresh (${refreshIntervalHours}h interval)...`);

      // Get all tracked accounts for this project
      const accountsSnapshot = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .where('status', '==', 'active')
        .get();

      console.log(`    👥 Found ${accountsSnapshot.size} active account(s)`);
      totalAccounts += accountsSnapshot.size;

      // Process each account
      for (const accountDoc of accountsSnapshot.docs) {
        const accountId = accountDoc.id;
        const accountData = accountDoc.data();
        const lastRefreshed = accountData.lastRefreshed?.toMillis() || 0;
        const timeSinceRefresh = Date.now() - lastRefreshed;
        
        // Check if account needs refresh based on interval
        if (timeSinceRefresh < refreshIntervalMs) {
          const hoursRemaining = ((refreshIntervalMs - timeSinceRefresh) / (1000 * 60 * 60)).toFixed(1);
          console.log(`      ⏭️  Skipping @${accountData.username} (refreshed ${(timeSinceRefresh / (1000 * 60 * 60)).toFixed(1)}h ago, ${hoursRemaining}h remaining)`);
          skippedAccounts++;
          continue;
        }

        console.log(`      ⚡ Dispatching @${accountData.username} (${accountData.platform}), last refresh: ${lastRefreshed ? new Date(lastRefreshed).toISOString() : 'never'}`);

        // Dispatch async refresh job
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.viewtrack.app';
        const dispatchPromise = fetch(`${baseUrl}/api/refresh-account`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': cronSecret || ''
          },
          body: JSON.stringify({
            organizationId,
            projectId,
            accountId,
            platform: accountData.platform,
            username: accountData.username
          })
        })
          .then(async (response) => {
            if (response.ok) {
              const result = await response.json();
              successful++;
              totalVideosRefreshed += result.videosRefreshed || 0;
              totalVideosAdded += result.videosAdded || 0;
              console.log(`      ✅ @${accountData.username}: ${result.videosRefreshed || 0} refreshed, ${result.videosAdded || 0} new`);
            } else {
              failed++;
              const errorText = await response.text();
              console.error(`      ❌ @${accountData.username}: ${response.status} - ${errorText}`);
            }
          })
          .catch((error) => {
            failed++;
            console.error(`      ❌ @${accountData.username}: Dispatch failed - ${error.message}`);
          });

        dispatchPromises.push(dispatchPromise);
        dispatchedJobs++;
      }

      // Check for Apple revenue integration
      try {
        const revenueIntegrationsSnapshot = await db
          .collection('organizations')
          .doc(organizationId)
          .collection('projects')
          .doc(projectId)
          .collection('revenueIntegrations')
          .where('provider', '==', 'apple')
          .where('enabled', '==', true)
          .get();

        if (!revenueIntegrationsSnapshot.empty) {
          console.log(`    💰 Found Apple revenue integration, syncing...`);
          
          const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.viewtrack.app';
          const dispatchPromise = fetch(`${baseUrl}/api/sync-apple-revenue`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': cronSecret || ''
            },
            body: JSON.stringify({
              organizationId,
              projectId,
              dateRange: '7',
              manual: false
            })
          })
            .then(async (response) => {
              if (response.ok) {
                console.log(`    ✅ Apple revenue synced for project ${projectData.name}`);
              } else {
                const errorText = await response.text();
                console.error(`    ❌ Revenue sync failed: ${errorText}`);
              }
            })
            .catch((error) => {
              console.error(`    ❌ Revenue sync dispatch error: ${error.message}`);
            });

          dispatchPromises.push(dispatchPromise);
        }
      } catch (error: any) {
        console.error(`    ⚠️ Failed to check revenue integrations: ${error.message}`);
      }

      // Update lastGlobalRefresh for this project
      try {
        await db
          .collection('organizations')
          .doc(organizationId)
          .collection('projects')
          .doc(projectId)
          .update({
            lastGlobalRefresh: Timestamp.now()
          });
        console.log(`    ✅ Updated lastGlobalRefresh for project`);
      } catch (error: any) {
        console.error(`    ⚠️ Failed to update lastGlobalRefresh: ${error.message}`);
      }
    }

    // Wait for all dispatched jobs to complete
    if (dispatchPromises.length > 0) {
      console.log(`  ⏳ Waiting for ${dispatchPromises.length} dispatched jobs to complete...`);
      await Promise.all(dispatchPromises);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`  ✅ Organization ${organizationId} completed in ${duration}s`);
    console.log(`     - Accounts: ${totalAccounts}, Dispatched: ${dispatchedJobs}, Skipped: ${skippedAccounts}`);
    console.log(`     - Success: ${successful}, Failed: ${failed}`);
    console.log(`     - Videos: ${totalVideosRefreshed} refreshed, ${totalVideosAdded} new`);

    return res.status(200).json({
      success: true,
      organizationId,
      duration: parseFloat(duration),
      stats: {
        accountsFound: totalAccounts,
        accountsSkipped: skippedAccounts,
        jobsDispatched: dispatchedJobs,
        jobsSuccessful: successful,
        jobsFailed: failed,
        videosRefreshed: totalVideosRefreshed,
        videosAdded: totalVideosAdded
      }
    });

  } catch (error: any) {
    console.error(`❌ Failed to process organization ${organizationId}:`, error);
    return res.status(500).json({
      success: false,
      error: error.message,
      organizationId
    });
  }
}

