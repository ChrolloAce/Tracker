import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { JOB_PRIORITIES } from './_constants/priorities.js';
import { getBaseUrl } from './_utils/base-url.js';

// Refresh interval per plan tier (in hours)
// Mirrors dataRefreshHours from src/types/subscription.ts
const REFRESH_HOURS: Record<string, number> = {
  free: 48,
  basic: 24,
  pro: 24,
  ultra: 12,
  enterprise: 6
};

// Initialize Firebase Admin
function initializeFirebase() {
  if (!getApps().length) {
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
  }
  return getFirestore();
}

// Accounts are filtered by plan-tier refresh interval (dataRefreshHours)
// Free users sync every 48h, basic/pro every 24h, ultra every 12h, enterprise every 6h
// Manual refreshes bypass the filter and sync everything

/**
 * Process Project
 * 
 * Receives project details from organization processor and:
 * 1. Finds all active accounts in the project
 * 2. Filters accounts that need refresh (based on plan interval)
 * 3. Dispatches account sync jobs (fire-and-forget)
 * 4. Returns immediately
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  try {
    const db = initializeFirebase();
    
    // Verify authorization
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized project processor request');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { orgId, projectId, sessionId, manual } = req.body;
    
    if (!orgId || !projectId || !sessionId) {
      return res.status(400).json({ 
        error: 'Missing required fields: orgId, projectId, sessionId' 
      });
    }
    
    const isManualRefresh = manual === true;
    
    // Get project data
    const projectDoc = await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .get();
    
    const projectData = projectDoc.data();
    const projectName = projectData?.name || 'Default Project';
    
    console.log(`    📦 Processing project: ${projectName} (${projectId})${isManualRefresh ? ' [MANUAL]' : ' [SCHEDULED]'}`);
    
    // Get organization's plan tier to determine refresh interval
    const subscriptionDoc = await db
      .collection('organizations')
      .doc(orgId)
      .collection('billing')
      .doc('subscription')
      .get();
    
    const planTier = subscriptionDoc.data()?.planTier || 'free';
    
    console.log(`      📋 Plan: ${planTier}`);
    
    // Get ALL accounts first to see what we have
    const allAccountsSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('trackedAccounts')
      .get();
    
    console.log(`      📊 Total accounts in project: ${allAccountsSnapshot.size}`);
    
    // Get only active accounts
    const accountsSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('trackedAccounts')
      .where('isActive', '==', true)
      .get();
    
    console.log(`      👥 Active accounts: ${accountsSnapshot.size}`);
    
    if (accountsSnapshot.empty) {
      if (allAccountsSnapshot.size > 0) {
        console.log(`      ⚠️  Project "${projectName}" has ${allAccountsSnapshot.size} accounts but ALL are inactive (isActive: false)`);
        // List the inactive accounts
        allAccountsSnapshot.docs.forEach(doc => {
          const acc = doc.data();
          console.log(`         - @${acc.username} (${acc.platform}) - inactive`);
        });
      } else {
        console.log(`      ℹ️  Project "${projectName}" has NO accounts`);
      }
      return res.status(200).json({
        success: true,
        message: 'No active accounts in project',
        projectId,
        projectName,
        totalAccounts: allAccountsSnapshot.size,
        activeAccounts: 0
      });
    }
    
    // Filter accounts by plan-tier refresh interval
    const refreshIntervalHours = REFRESH_HOURS[planTier] || 48;
    const now = Date.now();

    const accountsToRefresh = isManualRefresh
      ? accountsSnapshot.docs  // manual refresh always syncs everything
      : accountsSnapshot.docs.filter(doc => {
          const data = doc.data();
          const lastRefreshed = data.lastRefreshed?.toDate();
          if (!lastRefreshed) return true; // never synced — always include
          const hoursSinceRefresh = (now - lastRefreshed.getTime()) / (1000 * 60 * 60);
          return hoursSinceRefresh >= refreshIntervalHours;
        });

    console.log(`      📝 Will queue ${accountsToRefresh.length}/${accountsSnapshot.size} active accounts (plan: ${planTier}, interval: ${refreshIntervalHours}h${isManualRefresh ? ', MANUAL' : ''})`);
    
    if (accountsToRefresh.length === 0) {
      console.log(`      ✅ Project complete: No accounts need refresh\n`);
      return res.status(200).json({
        success: true,
        message: 'No accounts need refresh',
        projectId,
        accountsChecked: accountsSnapshot.size,
        accountsToRefresh: 0
      });
    }
    
    // Dispatch account sync jobs with ensured initiation
    const baseUrl = getBaseUrl();
    
    console.log(`      🚀 Starting dispatch of ${accountsToRefresh.length} accounts...`);
    
    // Log account details before dispatching
    accountsToRefresh.forEach((accountDoc, index) => {
      const accountData = accountDoc.data();
      const lastRefreshed = accountData.lastRefreshed?.toDate();
      const lastRefreshedStr = lastRefreshed 
        ? `${Math.round((Date.now() - lastRefreshed.getTime()) / (1000 * 60 * 60))}h ago`
        : 'Never';
      
      console.log(`      📋 [${index + 1}/${accountsToRefresh.length}] @${accountData.username} (${accountData.platform}) - Last: ${lastRefreshedStr}`);
    });
    
    // Queue all accounts as jobs in Firestore with deduplication
    // This ensures jobs are persisted and won't be lost if Vercel times out
    console.log(`      📝 Queueing ${accountsToRefresh.length} accounts as jobs in Firestore...`);
    
    // STEP 1: Check for existing jobs to prevent duplicates
    console.log(`      🔍 Checking for existing pending/running jobs...`);
    const existingJobsSnapshot = await db
      .collection('syncQueue')
      .where('status', 'in', ['pending', 'running'])
      .where('type', '==', 'account_sync')
      // TODO: SPIDERWEB - Re-enable later (multi-phase discovery)
      // .where('isSpiderwebPhase', '==', false) // Only check initial jobs, not spiderweb phases
      .get();
    
    const existingJobsByAccount = new Map<string, string>();
    existingJobsSnapshot.docs.forEach(doc => {
      const job = doc.data();
      const key = `${job.orgId}_${job.projectId}_${job.accountId}`;
      existingJobsByAccount.set(key, doc.id);
    });
    
    console.log(`      📊 Found ${existingJobsByAccount.size} existing jobs for accounts in this project`);
    
    let batch = db.batch();
    let queuedCount = 0;
    let skippedCount = 0;
    let batchCount = 0;
    const jobIds: string[] = [];
    
    for (let i = 0; i < accountsToRefresh.length; i++) {
      const accountDoc = accountsToRefresh[i];
      const accountData = accountDoc.data();
      const accountKey = `${orgId}_${projectId}_${accountDoc.id}`;
      
      // Check if job already exists
      if (existingJobsByAccount.has(accountKey)) {
        const existingJobId = existingJobsByAccount.get(accountKey);
        console.log(`         ⏭️  [${i + 1}/${accountsToRefresh.length}] Skipped @${accountData.username} (already queued: ${existingJobId})`);
        skippedCount++;
        jobIds.push(existingJobId!); // Add existing job ID to track
        continue;
      }
      
      // Create job document in syncQueue collection
      const jobRef = db.collection('syncQueue').doc(); // Auto-generate ID
      const jobId = jobRef.id;
      jobIds.push(jobId);
      
      // Determine sync strategy based on account type
      // automatic accounts: progressive discovery (single 20-video fetch)
      // static/manual accounts: refresh_only (no new video discovery)
      // Note: 'manual' is used when creating accounts from single video URLs
      const isStaticAccount = accountData.creatorType === 'static' || accountData.creatorType === 'manual';
      const syncStrategy = isStaticAccount ? 'refresh_only' : 'progressive';
      
      batch.set(jobRef, {
        type: 'account_sync',
        status: 'pending',
        syncStrategy: syncStrategy,
        // TODO: SPIDERWEB - Re-enable later (multi-phase discovery)
        // isSpiderwebPhase: false, // Initial job - spiderweb phases will be spawned
        // spiderwebPhase: syncStrategy === 'progressive' ? 1 : null, // Start at phase 1 (fetch 5)
        orgId,
        projectId,
        accountId: accountDoc.id,
        sessionId,
        accountUsername: accountData.username,
        accountPlatform: accountData.platform,
        createdAt: Timestamp.now(),
        startedAt: null,
        completedAt: null,
        attempts: 0,
        maxAttempts: 3,
        priority: isManualRefresh ? JOB_PRIORITIES.MANUAL_REFRESH : JOB_PRIORITIES.SCHEDULED_REFRESH,
        error: null
      });
      
      console.log(`         📝 [${i + 1}/${accountsToRefresh.length}] Queued @${accountData.username} (job: ${jobId})`);
      queuedCount++;
      batchCount++;
      
      // Commit batch every 500 operations (Firestore limit)
      if (batchCount >= 500) {
        try {
          await batch.commit();
          console.log(`         ✅ Committed ${queuedCount} jobs to queue (batch complete)`);
        } catch (commitError: any) {
          console.error(`         ❌ Failed to commit batch:`, commitError.message);
          throw commitError;
        }
        batch = db.batch(); // Create new batch
        batchCount = 0; // Reset batch counter
      }
    }
    
    console.log(`      📊 Deduplication results: ${queuedCount} new jobs, ${skippedCount} skipped (already queued)`);
    
    // Commit remaining jobs
    if (batchCount > 0) {
      try {
        await batch.commit();
        console.log(`         ✅ Committed final ${batchCount} jobs to queue`);
      } catch (commitError: any) {
        console.error(`         ❌ Failed to commit final batch:`, commitError.message);
        throw commitError; // Rethrow to trigger error handler
      }
    }
    
    console.log(`\n      ✅ Job queueing complete`);
    console.log(`      📊 New jobs created: ${queuedCount}`);
    console.log(`      ⏭️  Skipped (already queued): ${skippedCount}`);
    console.log(`      📋 Total jobs tracked: ${jobIds.length}`);
    
    // Conditional dispatch based on manual vs scheduled refresh
    const { APIFY_CONCURRENCY_LIMIT } = await import('./_constants/priorities.js');
    let immediatelyDispatched = 0;
    
    if (isManualRefresh) {
      // 🚀 MANUAL TRIGGER: Dispatch immediately for instant user feedback
      console.log(`\n      ⚡ MANUAL REFRESH: Checking global capacity for immediate dispatch...`);
      
      // Check global capacity first
      const runningJobsSnapshot = await db.collection('syncQueue')
        .where('status', '==', 'running')
        .get();
      
      const runningCount = runningJobsSnapshot.size;
      const availableSlots = Math.max(0, APIFY_CONCURRENCY_LIMIT - runningCount);
      
      console.log(`      📊 Global capacity: ${runningCount}/${APIFY_CONCURRENCY_LIMIT} running, ${availableSlots} slots available`);
      
      if (availableSlots > 0) {
        const immediateJobIds = jobIds.slice(0, availableSlots); // Only dispatch what fits
        
        console.log(`      🚀 Immediately starting first ${immediateJobIds.length} jobs...`);
        
        for (let i = 0; i < immediateJobIds.length; i++) {
          const jobId = immediateJobIds[i];
          const accountDoc = accountsToRefresh[i];
          const accountData = accountDoc.data();
          
          console.log(`         ⚡ [${i + 1}/${immediateJobIds.length}] Starting @${accountData.username}`);
          
          // Update job status to running
          await db.collection('syncQueue').doc(jobId).update({
            status: 'running',
            startedAt: Timestamp.now()
          });
          
          // Dispatch to sync-single-account
          fetch(`${baseUrl}/api/sync-single-account`, {
            method: 'POST',
            headers: {
              'Authorization': cronSecret,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              orgId,
              projectId,
              accountId: accountDoc.id,
              sessionId,
              jobId
            })
          }).then(response => {
            if (response.ok) {
              console.log(`            ✅ @${accountData.username}: Started`);
            } else {
              console.error(`            ❌ @${accountData.username}: HTTP ${response.status}`);
            }
          }).catch(err => {
            console.error(`            ❌ @${accountData.username}: ${err.message}`);
          });
        }
        
        immediatelyDispatched = immediateJobIds.length;
        console.log(`      ✅ First ${immediatelyDispatched} jobs dispatched immediately`);
      } else {
        console.log(`      ⏸️  No available slots (all ${APIFY_CONCURRENCY_LIMIT} occupied) - queue-worker will pick up when ready`);
      }
    } else {
      // 📅 SCHEDULED REFRESH: Just queue, let queue-worker dispatch based on global capacity
      console.log(`\n      📅 SCHEDULED REFRESH: All jobs queued - queue-worker will dispatch based on global capacity`);
    }
    
    // Always trigger queue-worker (for both manual and scheduled)
    console.log(`\n      🔔 Triggering queue worker to process ${isManualRefresh ? 'remaining' : 'all'} jobs...`);
    fetch(`${baseUrl}/api/queue-worker`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        trigger: isManualRefresh ? 'manual_refresh' : 'scheduled_refresh',
        projectId,
        sessionId
      })
    }).then(response => {
      if (response.ok) {
        console.log(`      ✅ Queue worker triggered (HTTP ${response.status})`);
      } else {
        console.error(`      ⚠️  Queue worker failed: HTTP ${response.status}`);
      }
    }).catch(err => {
      console.error(`      ⚠️  Queue worker trigger failed:`, err.message);
    });
    
    // Small delay to ensure fetch initiates before function returns
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n      ========================================`);
    console.log(`      ✅ Project "${projectName}" Complete`);
    console.log(`      ========================================`);
    console.log(`      ⏱️  Duration: ${duration}s`);
    console.log(`      📊 New jobs created: ${queuedCount}`);
    console.log(`      ⏭️  Skipped (duplicates): ${skippedCount}`);
    console.log(`      🚀 Immediate dispatches: ${immediatelyDispatched}`);
    console.log(`      ⏳ Pending in queue: ${queuedCount - immediatelyDispatched}`);
    console.log(`      ${isManualRefresh ? '⚡ Manual refresh - immediate feedback enabled' : '📅 Scheduled refresh - queue worker handles all dispatching'}`);
    console.log(`      ========================================\n`);
    
    return res.status(200).json({
      success: true,
      projectId,
      projectName,
      sessionId,
      stats: {
        duration: parseFloat(duration),
        accountsChecked: accountsSnapshot.size,
        newJobsQueued: queuedCount,
        skippedDuplicates: skippedCount,
        immediateDispatches: immediatelyDispatched,
        pendingInQueue: queuedCount - immediatelyDispatched,
        refreshType: isManualRefresh ? 'manual' : 'scheduled'
      }
    });
    
  } catch (error: any) {
    console.error(`❌ Project processor error:`, error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

