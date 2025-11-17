import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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

// Plan-based refresh intervals (must match subscription.ts)
const PLAN_REFRESH_INTERVALS: Record<string, number> = {
  free: 48,         // 48 hours
  basic: 24,        // 24 hours
  pro: 24,          // 24 hours
  ultra: 12,        // 12 hours
  enterprise: 6,    // 6 hours
};

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
    const refreshIntervalHours = PLAN_REFRESH_INTERVALS[planTier];
    const refreshIntervalMs = refreshIntervalHours * 60 * 60 * 1000;
    
    console.log(`      📋 Plan: ${planTier} (refresh every ${refreshIntervalHours}h)`);
    
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
    
    // Filter accounts that need refresh (skip interval check for manual refreshes)
    const now = Date.now();
    const accountsToRefresh = accountsSnapshot.docs.filter(doc => {
      const accountData = doc.data();
      
      // Manual refreshes bypass time interval checks
      if (isManualRefresh) {
        console.log(`      ✅ @${accountData.username} [MANUAL - FORCE REFRESH]`);
        return true;
      }
      
      // Scheduled refreshes check time intervals
      const lastRefreshed = accountData.lastRefreshed?.toMillis() || 0;
      const timeSinceRefresh = now - lastRefreshed;
      
      if (timeSinceRefresh < refreshIntervalMs) {
        const hoursRemaining = ((refreshIntervalMs - timeSinceRefresh) / (1000 * 60 * 60)).toFixed(1);
        console.log(`      ⏭️  Skip @${accountData.username} (${hoursRemaining}h remaining)`);
        return false;
      }
      
      return true;
    });
    
    console.log(`      🎯 Accounts to refresh: ${accountsToRefresh.length}`);
    
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
    const baseUrl = 'https://www.viewtrack.app';
    
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
    
    // Queue all accounts as jobs in Firestore
    // This ensures jobs are persisted and won't be lost if Vercel times out
    console.log(`      📝 Queueing ${accountsToRefresh.length} accounts as jobs in Firestore...`);
    
    let batch = db.batch();
    let queuedCount = 0;
    let batchCount = 0;
    const jobIds: string[] = [];
    
    for (let i = 0; i < accountsToRefresh.length; i++) {
      const accountDoc = accountsToRefresh[i];
      const accountData = accountDoc.data();
      
      // Create job document in syncQueue collection
      const jobRef = db.collection('syncQueue').doc(); // Auto-generate ID
      const jobId = jobRef.id;
      jobIds.push(jobId);
      
      batch.set(jobRef, {
        type: 'account_sync',
        status: 'pending',
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
        priority: isManualRefresh ? 10 : 5, // Higher priority for manual refreshes
        error: null
      });
      
      console.log(`         📝 [${i + 1}/${accountsToRefresh.length}] Queued @${accountData.username} (job: ${jobId})`);
      queuedCount++;
      batchCount++;
      
      // Commit batch every 500 operations (Firestore limit)
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`         ✅ Committed ${queuedCount} jobs to queue (batch complete)`);
        batch = db.batch(); // Create new batch
        batchCount = 0; // Reset batch counter
      }
    }
    
    // Commit remaining jobs
    if (batchCount > 0) {
      await batch.commit();
      console.log(`         ✅ Committed final ${batchCount} jobs to queue`);
    }
    
    console.log(`\n      ✅ All ${queuedCount} accounts queued in Firestore`);
    
    // Immediately dispatch first 6 jobs (max concurrent Apify jobs)
    const APIFY_CONCURRENCY_LIMIT = 6;
    const immediateJobIds = jobIds.slice(0, APIFY_CONCURRENCY_LIMIT);
    
    if (immediateJobIds.length > 0) {
      console.log(`\n      🚀 Immediately starting first ${immediateJobIds.length} jobs...`);
      
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
            jobId // Include jobId so sync-single-account can update job status
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
      
      console.log(`      ✅ First ${immediateJobIds.length} jobs dispatched`);
    }
    
    // Trigger queue worker to start monitoring and processing remaining jobs
    console.log(`\n      🔔 Triggering queue worker to process remaining jobs...`);
    fetch(`${baseUrl}/api/queue-worker`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        trigger: 'project_complete',
        projectId,
        sessionId
      })
    }).catch(err => {
      console.error(`      ⚠️  Failed to trigger queue worker (non-critical):`, err.message);
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n      ========================================`);
    console.log(`      ✅ Project "${projectName}" Complete`);
    console.log(`      ========================================`);
    console.log(`      ⏱️  Duration: ${duration}s`);
    console.log(`      📊 Accounts queued: ${queuedCount}`);
    console.log(`      🚀 Immediate dispatches: ${immediateJobIds.length}`);
    console.log(`      ⏳ Pending in queue: ${queuedCount - immediateJobIds.length}`);
    console.log(`      🔄 Queue worker will process remaining jobs`);
    console.log(`      ========================================\n`);
    
    return res.status(200).json({
      success: true,
      projectId,
      projectName,
      sessionId,
      stats: {
        duration: parseFloat(duration),
        accountsChecked: accountsSnapshot.size,
        accountsQueued: queuedCount,
        immediateDispatches: immediateJobIds.length,
        pendingInQueue: queuedCount - immediateJobIds.length,
        note: 'Jobs queued for worker processing'
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

