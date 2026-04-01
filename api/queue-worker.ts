import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getBaseUrl } from './utils/base-url.js';

// Initialize Firebase Admin
function initializeFirebase() {
  if (!getApps().length) {
    try {
      // Debug: Check which env vars are present
      const hasProjectId = !!process.env.FIREBASE_PROJECT_ID;
      const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
      const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY;
      
      console.log(`🔧 Firebase env check: PROJECT_ID=${hasProjectId}, CLIENT_EMAIL=${hasClientEmail}, PRIVATE_KEY=${hasPrivateKey}`);
      
      if (!hasProjectId || !hasClientEmail || !hasPrivateKey) {
        throw new Error(`Missing Firebase env vars: PROJECT_ID=${hasProjectId}, CLIENT_EMAIL=${hasClientEmail}, PRIVATE_KEY=${hasPrivateKey}`);
      }
      
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
      console.log('✅ Firebase Admin initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin:', error);
      throw new Error('Firebase initialization failed');
    }
  }
  return getFirestore();
}

/**
 * Queue Worker - Processes jobs in batches of 10 (max Apify concurrency)
 * 
 * Runs every 1 minute via Vercel cron
 * 
 * Responsibilities:
 * 1. Find all pending/running jobs
 * 2. If no jobs exist, delete completed jobs and stop
 * 3. Count currently running jobs
 * 4. Dispatch new jobs to fill available slots (max 10 concurrent)
 * 5. Validate running jobs against account sync status
 * 6. Mark stale jobs as failed and retry
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  try {
    const db = initializeFirebase();
    const cronSecret = process.env.CRON_SECRET;
    const baseUrl = getBaseUrl();
    
    // Authenticate
    const authHeader = req.headers.authorization;
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    
    // Allow both GET (cron) and POST (manual trigger) requests
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed - use GET or POST' });
    }
    
    // Authenticate: Allow Vercel cron (GET with x-vercel-cron header) or POST with Bearer token
    const isAuthenticated = (authHeader === `Bearer ${cronSecret}`) || isVercelCron;
    
    if (!isAuthenticated) {
      console.error('❌ Unauthorized request to queue-worker');
      console.error(`   Method: ${req.method}, Has auth: ${!!authHeader}, Is cron: ${isVercelCron}`);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.log(`\n🔄 [QUEUE-WORKER] Starting at ${new Date().toISOString()}`);
    
    // Get all pending and running jobs
    const pendingJobsSnapshot = await db
      .collection('syncQueue')
      .where('status', '==', 'pending')
      .orderBy('priority', 'desc')
      .orderBy('createdAt', 'asc')
      .get();
    
    const runningJobsSnapshot = await db
      .collection('syncQueue')
      .where('status', '==', 'running')
      .get();
    
    const pendingCount = pendingJobsSnapshot.size;
    const runningCount = runningJobsSnapshot.size;
    
    console.log(`📊 Job status: ${pendingCount} pending, ${runningCount} running`);
    
    // If no active jobs exist, auto-cleanup stale jobs and stop
    if (pendingCount === 0 && runningCount === 0) {
      console.log(`\n✨ No pending or running jobs - checking for stale jobs to purge...`);
      
      // Auto-purge failed/completed jobs older than 24 hours (in batches of 500)
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      let totalPurged = 0;
      
      for (const status of ['failed', 'completed'] as const) {
        let hasMore = true;
        while (hasMore) {
          const staleSnapshot = await db.collection('syncQueue')
            .where('status', '==', status)
            .where('completedAt', '<', cutoff)
            .limit(500)
            .get();
          
          if (staleSnapshot.empty) { hasMore = false; break; }
          
          const purgeBatch = db.batch();
          staleSnapshot.docs.forEach(doc => purgeBatch.delete(doc.ref));
          await purgeBatch.commit();
          totalPurged += staleSnapshot.size;
          console.log(`   🗑️  Purged ${staleSnapshot.size} stale ${status} jobs (${totalPurged} total)`);
          
          if (staleSnapshot.size < 500) hasMore = false;
        }
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Queue worker complete: ${duration}s - ${totalPurged > 0 ? `purged ${totalPurged} stale jobs` : 'queue clean'}\n`);
      
      return res.status(200).json({
        success: true,
        message: totalPurged > 0 ? `Queue empty - purged ${totalPurged} stale jobs` : 'Queue empty - worker stopped',
        stats: {
          duration: parseFloat(duration),
          pendingJobs: 0,
          runningJobs: 0,
          dispatchedJobs: 0,
          purgedStaleJobs: totalPurged
        }
      });
    }
    
    // Validate running jobs in parallel (check if they're actually still running)
    console.log(`\n🔍 Validating ${runningCount} running jobs...`);
    
    const JOB_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes (matches sync-single-account maxDuration)
    const now = Date.now();
    let validatedCount = 0;
    let markedFailedCount = 0;
    let accountDeletedCount = 0;
    let retriedCount = 0;
    
    // Validate all running jobs in parallel instead of sequentially
    const validationResults = await Promise.allSettled(
      runningJobsSnapshot.docs.map(async (jobDoc) => {
        const job = jobDoc.data();
        const jobId = jobDoc.id;
        const jobType = job.type || 'account_sync';
        
        // Check if account still exists (may have been deleted) - ONLY for account jobs
        if (jobType === 'account_sync' && job.accountId) {
          try {
            const accountRef = db
              .collection('organizations').doc(job.orgId)
              .collection('projects').doc(job.projectId)
              .collection('trackedAccounts').doc(job.accountId);
            
            const accountDoc = await accountRef.get();
            
            if (!accountDoc.exists) {
              console.log(`   🗑️  Job ${jobId}: Account deleted - removing job`);
              await jobDoc.ref.delete();
              return 'deleted' as const;
            }
          } catch (error: any) {
            console.error(`   ⚠️  Error checking account for job ${jobId}:`, error.message);
          }
        }
        
        // Check if job has been running for too long
        const startedAt = job.startedAt?.toMillis() || 0;
        const runningTime = now - startedAt;
        
        if (runningTime > JOB_TIMEOUT_MS) {
          console.log(`   ⚠️  Job ${jobId} (@${job.accountUsername}) timed out after ${Math.round(runningTime / 60000)}min`);
          
          if (job.attempts < job.maxAttempts) {
            await jobDoc.ref.update({
              status: 'pending',
              attempts: job.attempts + 1,
              error: 'Job timed out after 5 minutes',
              startedAt: null
            });
            console.log(`   🔄 Reset to pending for retry (attempt ${job.attempts + 1}/${job.maxAttempts})`);
            return 'retried' as const;
          } else {
            await jobDoc.ref.update({
              status: 'failed',
              completedAt: Timestamp.now(),
              error: 'Job timed out after 5 minutes - max retries exceeded'
            });
            console.log(`   ❌ Marked as failed (max retries exceeded)`);
            return 'failed' as const;
          }
        }
        
        return 'valid' as const;
      })
    );
    
    for (const result of validationResults) {
      if (result.status === 'fulfilled') {
        switch (result.value) {
          case 'valid': validatedCount++; break;
          case 'failed': markedFailedCount++; break;
          case 'deleted': accountDeletedCount++; break;
          case 'retried': retriedCount++; break;
        }
      }
    }
    
    if (accountDeletedCount > 0) {
      console.log(`🗑️  Cleaned up ${accountDeletedCount} job(s) for deleted accounts`);
    }
    console.log(`✅ Validated ${validatedCount} running jobs, marked ${markedFailedCount} failed`);
    
    // Calculate available slots for new jobs
    const { APIFY_CONCURRENCY_LIMIT } = await import('./constants/priorities.js');
    const actualRunningCount = runningCount - markedFailedCount - accountDeletedCount;
    const availableSlots = APIFY_CONCURRENCY_LIMIT - actualRunningCount;
    
    console.log(`\n📊 Capacity: ${actualRunningCount}/${APIFY_CONCURRENCY_LIMIT} running, ${availableSlots} slots available`);
    
    // Dispatch new jobs to fill available slots
    let dispatchedCount = 0;
    
    if (availableSlots > 0 && pendingCount > 0) {
      const jobsToDispatch = pendingJobsSnapshot.docs.slice(0, availableSlots);
      console.log(`\n🚀 Dispatching ${jobsToDispatch.length} new jobs...`);
      
      // Step 1: Batch-update all job statuses to 'running' in one Firestore write
      const statusBatch = db.batch();
      const startedTimestamp = Timestamp.now();
      
      for (const jobDoc of jobsToDispatch) {
        statusBatch.update(jobDoc.ref, {
          status: 'running',
          startedAt: startedTimestamp
        });
      }
      
      await statusBatch.commit();
      console.log(`   📝 Marked ${jobsToDispatch.length} jobs as running (single batch write)`);
      
      // Step 2: Fire all HTTP dispatches in parallel (fire-and-forget)
      const dispatchPromises = jobsToDispatch.map(jobDoc => {
        const job = jobDoc.data();
        const jobId = jobDoc.id;
        const jobType = job.type || 'account_sync';
        
        if (jobType === 'single_video') {
          console.log(`   ⚡ Dispatching video job ${jobId}: ${job.videoUrl}`);
          return fetch(`${baseUrl}/api/process-single-video`, {
            method: 'POST',
            headers: {
              'Authorization': cronSecret,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              videoId: job.videoUrl,
              orgId: job.orgId,
              projectId: job.projectId,
              jobId: jobId,
              addedBy: job.addedBy,
              ...(job.batchId && { batchId: job.batchId }),
              ...(job.assignedCreatorId && { assignedCreatorId: job.assignedCreatorId }),
            })
          });
        } else {
          console.log(`   ⚡ Dispatching account job ${jobId}: @${job.accountUsername} (${job.accountPlatform})`);
          return fetch(`${baseUrl}/api/sync-single-account`, {
            method: 'POST',
            headers: {
              'Authorization': cronSecret,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              orgId: job.orgId,
              projectId: job.projectId,
              accountId: job.accountId,
              sessionId: job.sessionId,
              jobId: jobId
            })
          });
        }
      });
      
      // Wait for all dispatches to be accepted (not completed)
      const results = await Promise.allSettled(dispatchPromises);
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const job = jobsToDispatch[i].data();
        const label = job.type === 'single_video' ? `video ${job.videoUrl}` : `@${job.accountUsername}`;
        
        if (result.status === 'fulfilled' && result.value.ok) {
          dispatchedCount++;
        } else {
          const reason = result.status === 'rejected' 
            ? result.reason?.message 
            : `HTTP ${result.value.status}`;
          console.error(`      ❌ ${label}: ${reason}`);
          dispatchedCount++; // Still count — job is marked running, will timeout if truly failed
        }
      }
      
      console.log(`✅ Dispatched ${dispatchedCount} new jobs (parallel)`);
    } else if (availableSlots <= 0) {
      console.log(`⏸️  No available slots - all ${APIFY_CONCURRENCY_LIMIT} slots occupied`);
    } else {
      console.log(`ℹ️  No pending jobs to dispatch`);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n========================================`);
    console.log(`✅ Queue Worker Complete`);
    console.log(`========================================`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Pending: ${pendingCount - dispatchedCount}`);
    console.log(`🔄 Running: ${actualRunningCount + dispatchedCount}`);
    console.log(`🚀 Dispatched: ${dispatchedCount}`);
    console.log(`✅ Validated: ${validatedCount}`);
    console.log(`========================================\n`);
    
    const remainingJobs = pendingCount - dispatchedCount;
    
    // Log status
    if (remainingJobs > 0) {
      console.log(`\n⏳ ${remainingJobs} jobs still pending - will be processed by next worker cycle (Vercel cron every 1min)`);
    } else {
      console.log(`\n✅ Queue empty - all jobs processed`);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Queue worker processed successfully',
      stats: {
        duration: parseFloat(duration),
        pendingJobs: remainingJobs,
        runningJobs: actualRunningCount + dispatchedCount,
        dispatchedJobs: dispatchedCount,
        validatedJobs: validatedCount,
        accountsDeleted: accountDeletedCount,
        markedFailed: markedFailedCount
      }
    });
    
  } catch (error: any) {
    console.error(`❌ Queue worker error:`, error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

