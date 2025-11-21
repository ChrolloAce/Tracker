import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { authenticateAndVerifyOrg, setCorsHeaders, handleCorsPreFlight, validateRequiredFields } from '../middleware/auth.js';
import { SyncCoordinator } from '../services/sync/SyncCoordinator.js';

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

/**
 * Sync Handler - Modular version that uses SyncCoordinator
 * 
 * Purpose: Handle single account sync requests
 * Responsibilities:
 * - Authentication (cron secret or user auth)
 * - Parse request params
 * - Update job status in syncQueue
 * - Delegate to SyncCoordinator
 * - Handle errors and mark jobs as failed/completed
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const startTime = Date.now();
  
  // Set CORS headers
  setCorsHeaders(res);
  
  // Handle preflight requests
  if (handleCorsPreFlight(req, res)) {
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, orgId, projectId } = req.body;
  const sessionId = req.body.sessionId || null;
  const jobId = req.body.jobId || null;

  console.log(`\n🎯 [SYNC-HANDLER] Received request for account: ${accountId}`);
  console.log(`   📦 Org: ${orgId}, Project: ${projectId}, Session: ${sessionId || 'none'}, Job: ${jobId || 'none'}`);

  // Validate required fields
  const validation = validateRequiredFields(req.body, ['accountId', 'orgId', 'projectId']);
  if (!validation.valid) {
    console.error(`❌ [SYNC-HANDLER] Validation failed: ${validation.missing.join(', ')}`);
    return res.status(400).json({ 
      error: 'Missing required parameters', 
      missing: validation.missing 
    });
  }

  // 🔒 Authenticate - either user (manual) or cron secret (automated)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isCronRequest = authHeader === cronSecret;
  const isManualSync = !isCronRequest;
  
  console.log(`   🔐 Auth: ${isCronRequest ? 'CRON' : 'USER'} | Manual: ${isManualSync}`);
  
  if (isCronRequest) {
    console.log(`🔒 Authenticated as CRON job for sync request (SCHEDULED REFRESH)`);
  } else {
    // Regular user authentication
    try {
      const { user } = await authenticateAndVerifyOrg(req, orgId);
      console.log(`🔒 Authenticated user ${user.userId} for sync request (MANUAL ADD)`);
    } catch (authError: any) {
      console.error('❌ Authentication failed:', authError.message);
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: authError.message 
      });
    }
  }

  console.log(`⚡ Sync started for account: ${accountId} [${isManualSync ? 'MANUAL' : 'SCHEDULED'}]`);

  try {
    // Read job metadata to determine sync strategy
    let syncStrategy: 'progressive' | 'refresh_only' | 'discovery_only' = 'progressive';
    let capturedBy: 'manual_refresh' | 'scheduled_refresh' | 'initial_add' = isManualSync ? 'manual_refresh' : 'scheduled_refresh';
    
    if (jobId) {
      try {
        const jobDoc = await db.collection('syncQueue').doc(jobId).get();
        if (jobDoc.exists) {
          const jobData = jobDoc.data();
          syncStrategy = jobData?.syncStrategy || 'progressive';
          
          console.log(`   📋 Job strategy: ${syncStrategy}`);
        }
        
        // Update job status to running
        await db.collection('syncQueue').doc(jobId).update({
          status: 'running',
          startedAt: Timestamp.now()
        });
        console.log(`   📝 Job ${jobId} marked as running`);
      } catch (jobError: any) {
        console.warn(`   ⚠️  Failed to read/update job (non-critical):`, jobError.message);
      }
    }
    
    // Verify account exists
    const accountRef = db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('trackedAccounts').doc(accountId);

    const accountDoc = await accountRef.get();

    if (!accountDoc.exists) {
      console.error(`❌ Account ${accountId} not found in Firestore!`);
      console.log(`   ℹ️  Account may have been deleted - cleaning up job if it exists...`);
      
      // If job exists, delete it (account was deleted)
      if (jobId) {
        try {
          await db.collection('syncQueue').doc(jobId).delete();
          console.log(`   ✅ Job ${jobId} deleted (account no longer exists)`);
        } catch (jobError: any) {
          console.warn(`   ⚠️  Failed to delete job (non-critical):`, jobError.message);
        }
      }
      
      return res.status(404).json({ 
        error: 'Account not found',
        message: 'Account may have been deleted'
      });
    }

    // Delegate to SyncCoordinator
    const result = await SyncCoordinator.syncAccount(orgId, projectId, accountId, {
      syncStrategy,
      capturedBy,
      isManualSync
    });

    // Update job status
    if (jobId) {
      try {
        if (result.success) {
          await db.collection('syncQueue').doc(jobId).update({
            status: 'completed',
            completedAt: Timestamp.now(),
            videosAdded: result.videosAdded,
            videosUpdated: result.videosUpdated,
            snapshotsCreated: result.snapshotsCreated
          });
          console.log(`   ✅ Job ${jobId} marked as completed`);
        } else {
          await db.collection('syncQueue').doc(jobId).update({
            status: 'failed',
            completedAt: Timestamp.now(),
            error: result.error || 'Unknown error'
          });
          console.log(`   ❌ Job ${jobId} marked as failed`);
        }
      } catch (jobError: any) {
        console.warn(`   ⚠️  Failed to update job status (non-critical):`, jobError.message);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n========================================`);
    console.log(`✅ Sync Handler Complete`);
    console.log(`========================================`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`➕ Added: ${result.videosAdded} videos`);
    console.log(`🔄 Updated: ${result.videosUpdated} videos`);
    console.log(`📸 Snapshots: ${result.snapshotsCreated}`);
    console.log(`========================================\n`);

    return res.status(200).json({
      success: result.success,
      videosAdded: result.videosAdded,
      videosUpdated: result.videosUpdated,
      snapshotsCreated: result.snapshotsCreated,
      duration: parseFloat(duration),
      error: result.error
    });
    
  } catch (error: any) {
    console.error(`❌ Sync handler error:`, error);
    
    // Mark job as failed
    if (jobId) {
      try {
        await db.collection('syncQueue').doc(jobId).update({
          status: 'failed',
          completedAt: Timestamp.now(),
          error: error.message
        });
        console.log(`   ❌ Job ${jobId} marked as failed due to error`);
      } catch (jobError: any) {
        console.warn(`   ⚠️  Failed to mark job as failed (non-critical):`, jobError.message);
      }
    }
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

