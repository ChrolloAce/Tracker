import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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
      console.log('✅ Firebase Admin initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin:', error);
      throw new Error('Firebase initialization failed');
    }
  }
  return getFirestore();
}

/**
 * Queue Worker - Processes jobs in batches of 6 (max Apify concurrency)
 * 
 * Runs every 1 minute via Vercel cron
 * 
 * Responsibilities:
 * 1. Find all pending/running jobs
 * 2. If no jobs exist, delete completed jobs and stop
 * 3. Count currently running jobs
 * 4. Dispatch new jobs to fill available slots (max 6 concurrent)
 * 5. Validate running jobs against account sync status
 * 6. Mark stale jobs as failed and retry
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  try {
    const db = initializeFirebase();
    const cronSecret = process.env.CRON_SECRET;
    const baseUrl = 'https://www.viewtrack.app';
    
    // Authenticate
    const authHeader = req.headers.authorization;
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    
    // Handle GET requests (health checks, monitoring)
    if (req.method === 'GET') {
      return res.status(200).json({
        status: 'ok',
        message: 'Queue worker is running',
        timestamp: new Date().toISOString()
      });
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed - use POST' });
    }
    
    if (authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
      console.error('❌ Unauthorized request to queue-worker');
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
    
    // If no jobs exist, cleanup and stop
    if (pendingCount === 0 && runningCount === 0) {
      console.log(`\n✨ No pending or running jobs found`);
      console.log(`🧹 Deleting all completed jobs...`);
      
      // Delete all completed jobs
      const completedJobsSnapshot = await db
        .collection('syncQueue')
        .where('status', '==', 'completed')
        .get();
      
      if (!completedJobsSnapshot.empty) {
        const batch = db.batch();
        let deleteCount = 0;
        
        completedJobsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deleteCount++;
        });
        
        await batch.commit();
        console.log(`✅ Deleted ${deleteCount} completed jobs`);
      } else {
        console.log(`ℹ️  No completed jobs to delete`);
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ Queue worker complete: ${duration}s - Queue is empty, worker stopped\n`);
      
      return res.status(200).json({
        success: true,
        message: 'Queue empty - worker stopped and cleaned up',
        stats: {
          duration: parseFloat(duration),
          pendingJobs: 0,
          runningJobs: 0,
          deletedJobs: completedJobsSnapshot.size,
          dispatchedJobs: 0
        }
      });
    }
    
    // Validate running jobs (check if they're actually still running)
    console.log(`\n🔍 Validating ${runningCount} running jobs...`);
    
    const JOB_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();
    let validatedCount = 0;
    let markedFailedCount = 0;
    let markedCompletedCount = 0;
    
    for (const jobDoc of runningJobsSnapshot.docs) {
      const job = jobDoc.data();
      const jobId = jobDoc.id;
      
      // Check if job has been running for too long
      const startedAt = job.startedAt?.toMillis() || 0;
      const runningTime = now - startedAt;
      
      if (runningTime > JOB_TIMEOUT_MS) {
        console.log(`   ⚠️  Job ${jobId} (@${job.accountUsername}) timed out after ${Math.round(runningTime / 60000)}min`);
        
        // Mark as failed and reset to pending for retry if attempts < maxAttempts
        if (job.attempts < job.maxAttempts) {
          await jobDoc.ref.update({
            status: 'pending',
            attempts: job.attempts + 1,
            error: 'Job timed out after 10 minutes',
            startedAt: null
          });
          console.log(`   🔄 Reset to pending for retry (attempt ${job.attempts + 1}/${job.maxAttempts})`);
        } else {
          await jobDoc.ref.update({
            status: 'failed',
            completedAt: Timestamp.now(),
            error: 'Job timed out after 10 minutes - max retries exceeded'
          });
          console.log(`   ❌ Marked as failed (max retries exceeded)`);
          markedFailedCount++;
        }
        continue;
      }
      
      // Check account sync status to validate job status
      try {
        const accountDoc = await db
          .collection('organizations')
          .doc(job.orgId)
          .collection('projects')
          .doc(job.projectId)
          .collection('trackedAccounts')
          .doc(job.accountId)
          .get();
        
        if (accountDoc.exists) {
          const accountData = accountDoc.data();
          
          // If account shows completed but job is still running, mark job as completed
          if (accountData?.syncStatus === 'completed') {
            await jobDoc.ref.update({
              status: 'completed',
              completedAt: Timestamp.now()
            });
            console.log(`   ✅ Job ${jobId} (@${job.accountUsername}) validated as completed via account status`);
            markedCompletedCount++;
            continue;
          }
        }
        
        validatedCount++;
        
      } catch (error: any) {
        console.error(`   ⚠️  Error validating job ${jobId}:`, error.message);
      }
    }
    
    console.log(`✅ Validated ${validatedCount} running jobs, marked ${markedCompletedCount} complete, ${markedFailedCount} failed`);
    
    // Calculate available slots for new jobs
    const APIFY_CONCURRENCY_LIMIT = 6;
    const actualRunningCount = runningCount - markedCompletedCount - markedFailedCount;
    const availableSlots = APIFY_CONCURRENCY_LIMIT - actualRunningCount;
    
    console.log(`\n📊 Capacity: ${actualRunningCount}/${APIFY_CONCURRENCY_LIMIT} running, ${availableSlots} slots available`);
    
    // Dispatch new jobs to fill available slots
    let dispatchedCount = 0;
    
    if (availableSlots > 0 && pendingCount > 0) {
      console.log(`\n🚀 Dispatching up to ${availableSlots} new jobs...`);
      
      const jobsToDispatch = pendingJobsSnapshot.docs.slice(0, availableSlots);
      
      for (const jobDoc of jobsToDispatch) {
        const job = jobDoc.data();
        const jobId = jobDoc.id;
        
        console.log(`   ⚡ Dispatching job ${jobId}: @${job.accountUsername} (${job.accountPlatform})`);
        
        // Update job status to running
        await jobDoc.ref.update({
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
            orgId: job.orgId,
            projectId: job.projectId,
            accountId: job.accountId,
            sessionId: job.sessionId,
            jobId: jobId
          })
        }).then(response => {
          if (response.ok) {
            console.log(`      ✅ @${job.accountUsername}: Started`);
          } else {
            console.error(`      ❌ @${job.accountUsername}: HTTP ${response.status}`);
          }
        }).catch(err => {
          console.error(`      ❌ @${job.accountUsername}:`, err.message);
        });
        
        dispatchedCount++;
      }
      
      console.log(`✅ Dispatched ${dispatchedCount} new jobs`);
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
        markedCompleted: markedCompletedCount,
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

