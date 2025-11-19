import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { authenticateAndVerifyOrg, setCorsHeaders, handleCorsPreFlight } from './middleware/auth.js';
import { JOB_PRIORITIES } from './constants/priorities.js';

// Initialize Firebase Admin
function initializeFirebase() {
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
      console.error('❌ Failed to initialize Firebase Admin:', error);
      throw new Error('Firebase initialization failed');
    }
  }
  return getFirestore();
}

/**
 * Queue Manual Account Sync
 * 
 * Creates a high-priority sync job for a newly added account.
 * Called when user manually adds an account and expects immediate scraping.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return handleCorsPreFlight(res);
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const db = initializeFirebase();
  
  try {
    // Extract orgId first for authentication
    const { orgId, projectId, accountId, sessionId } = req.body;
    
    if (!orgId || !projectId || !accountId) {
      return res.status(400).json({ 
        error: 'Missing required fields: orgId, projectId, accountId' 
      });
    }
    
    // Authenticate user and verify org access
    const { user } = await authenticateAndVerifyOrg(req, orgId);
    console.log(`🔒 Authenticated user ${user.userId} for manual account queue`);

    
    console.log(`🚀 [MANUAL-ACCOUNT] Queueing high-priority sync for account: ${accountId}`);
    
    // Get account details
    const accountDoc = await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('trackedAccounts')
      .doc(accountId)
      .get();
    
    if (!accountDoc.exists) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const accountData = accountDoc.data();
    
    // Create high-priority job in syncQueue
    const jobRef = db.collection('syncQueue').doc();
    await jobRef.set({
      type: 'account_sync',
      status: 'pending',
      syncStrategy: 'direct', // Direct fetch - no spiderweb for manual additions
      maxVideos: accountData?.maxVideos || 10, // Exact number user specified
      orgId,
      projectId,
      accountId,
      sessionId: sessionId || null,
      accountUsername: accountData?.username || 'unknown',
      accountPlatform: accountData?.platform || 'unknown',
      createdAt: Timestamp.now(),
      startedAt: null,
      completedAt: null,
      attempts: 0,
      maxAttempts: 3,
      priority: JOB_PRIORITIES.USER_INITIATED, // HIGHEST priority
      error: null,
      userInitiated: true // Flag for analytics/debugging
    });
    
    console.log(`✅ [MANUAL-ACCOUNT] Job ${jobRef.id} queued with priority ${JOB_PRIORITIES.USER_INITIATED}`);
    console.log(`   📊 Account: @${accountData?.username} (${accountData?.platform})`);
    
    const baseUrl = 'https://www.viewtrack.app';
    const cronSecret = process.env.CRON_SECRET;
    
    // Check current queue capacity
    const runningJobs = await db.collection('syncQueue').where('status', '==', 'running').get();
    const runningCount = runningJobs.size;
    const APIFY_CONCURRENCY_LIMIT = 6;
    const availableSlots = APIFY_CONCURRENCY_LIMIT - runningCount;
    
    console.log(`   📊 Queue capacity: ${runningCount}/${APIFY_CONCURRENCY_LIMIT} running, ${availableSlots} slots available`);
    
    if (availableSlots > 0) {
      // TRY immediate dispatch for instant feedback
      console.log(`   ⚡ Attempting immediate dispatch...`);
      
      try {
        // Dispatch with timeout (500ms) - if it fails, queue-worker will retry
        const dispatchPromise = fetch(`${baseUrl}/api/sync-single-account`, {
          method: 'POST',
          headers: {
            'Authorization': cronSecret,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            orgId,
            projectId,
            accountId,
            sessionId: sessionId || null,
            jobId: jobRef.id
          })
        });
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Dispatch timeout')), 500)
        );
        
        // Race between dispatch and timeout
        const response = await Promise.race([dispatchPromise, timeoutPromise]) as Response;
        
        if (response.ok) {
          // SUCCESS - Mark as running since dispatch succeeded
          await jobRef.update({
            status: 'running',
            startedAt: Timestamp.now()
          });
          
          console.log(`   ✅ Immediate dispatch successful - processing now`);
          
          return res.status(200).json({
            success: true,
            message: 'Account dispatched for immediate scraping',
            jobId: jobRef.id,
            priority: JOB_PRIORITIES.USER_INITIATED,
            status: 'processing',
            estimatedWaitTime: 'Processing now'
          });
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (dispatchError: any) {
        // FAILED - Leave as pending, trigger queue-worker for retry
        console.warn(`   ⚠️  Immediate dispatch failed: ${dispatchError.message}`);
        console.log(`   🔄 Left as pending - queue-worker will retry`);
      }
    }
    
    // Fallback: No capacity OR immediate dispatch failed
    // Trigger queue-worker to handle it
    console.log(`   🔔 Triggering queue-worker to process job...`);
    
    fetch(`${baseUrl}/api/queue-worker`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ trigger: 'manual_account_added' })
    }).catch(err => {
      console.warn(`   ⚠️  Queue worker trigger failed (non-critical):`, err.message);
    });
    
    return res.status(200).json({
      success: true,
      message: 'Account queued for high-priority scraping',
      jobId: jobRef.id,
      priority: JOB_PRIORITIES.USER_INITIATED,
      status: 'queued',
      estimatedWaitTime: availableSlots > 0 
        ? 'Will process within seconds (dispatch pending)' 
        : 'Will process when capacity available (typically within 1 minute)'
    });
    
  } catch (error: any) {
    console.error('❌ [MANUAL-ACCOUNT] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

