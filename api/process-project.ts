import { VercelRequest, VercelResponse } from '@vercel/node';
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
        console.log(`      ⚠️  All ${allAccountsSnapshot.size} accounts are inactive (isActive: false)`);
      } else {
        console.log(`      ℹ️  No accounts exist in this project`);
      }
      return res.status(200).json({
        success: true,
        message: 'No active accounts in project',
        projectId,
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
    
    // Dispatch account sync jobs
    const baseUrl = 'https://www.viewtrack.app';
    let dispatchedCount = 0;
    
    console.log(`      🚀 Starting dispatch of ${accountsToRefresh.length} accounts...`);
    
    for (const accountDoc of accountsToRefresh) {
      const accountData = accountDoc.data();
      
      const payload = {
        orgId,
        projectId,
        accountId: accountDoc.id,
        sessionId
      };
      
      console.log(`      ⚡ [${dispatchedCount + 1}/${accountsToRefresh.length}] Dispatching @${accountData.username}`);
      console.log(`         📦 Payload: ${JSON.stringify(payload)}`);
      
      try {
        // Fire-and-forget: dispatch but don't wait for response
        fetch(`${baseUrl}/api/sync-single-account`, {
          method: 'POST',
          headers: {
            'Authorization': cronSecret, // Direct secret, not Bearer
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }).then(() => {
          console.log(`         ✅ Dispatch sent for @${accountData.username}`);
        }).catch(err => {
          console.error(`         ❌ Dispatch failed for @${accountData.username}:`, err.message);
        });
        
        dispatchedCount++;
      } catch (err: any) {
        console.error(`         ❌ Dispatch error for @${accountData.username}:`, err.message);
      }
    }
    
    console.log(`      ✅ All ${dispatchedCount} dispatches initiated`);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`      ✅ Project complete: ${duration}s`);
    console.log(`      📤 Dispatched: ${dispatchedCount} account job(s)\n`);
    
    return res.status(200).json({
      success: true,
      projectId,
      sessionId,
      stats: {
        duration: parseFloat(duration),
        accountsChecked: accountsSnapshot.size,
        accountsDispatched: dispatchedCount
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

