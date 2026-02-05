import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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
    const baseUrl = 'https://www.viewtrack.app';
    
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
    
    // If no jobs exist, stop
    if (pendingCount === 0 && runningCount === 0) {
      console.log(`\n✨ No pending or running jobs found - queue is empty`);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Queue worker complete: ${duration}s - worker stopped\n`);
      
      return res.status(200).json({
        success: true,
        message: 'Queue empty - worker stopped',
        stats: {
          duration: parseFloat(duration),
          pendingJobs: 0,
          runningJobs: 0,
          dispatchedJobs: 0
        }
      });
    }
    
    // Validate running jobs (check if they're actually still running)
    console.log(`\n🔍 Validating ${runningCount} running jobs...`);
    
    const JOB_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes (reduced from 10)
    const now = Date.now();
    let validatedCount = 0;
    let markedFailedCount = 0;
    let accountDeletedCount = 0;
    
    for (const jobDoc of runningJobsSnapshot.docs) {
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
            accountDeletedCount++;
            continue;
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
        
        // Mark as failed and reset to pending for retry if attempts < maxAttempts
        if (job.attempts < job.maxAttempts) {
          await jobDoc.ref.update({
            status: 'pending',
            attempts: job.attempts + 1,
            error: 'Job timed out after 3 minutes',
            startedAt: null
          });
          console.log(`   🔄 Reset to pending for retry (attempt ${job.attempts + 1}/${job.maxAttempts})`);
        } else {
          await jobDoc.ref.update({
            status: 'failed',
            completedAt: Timestamp.now(),
            error: 'Job timed out after 3 minutes - max retries exceeded'
          });
          console.log(`   ❌ Marked as failed (max retries exceeded)`);
          markedFailedCount++;
        }
        continue;
      }
      
      // Job is still running and not timed out - consider it valid
      validatedCount++;
    }
    
    if (accountDeletedCount > 0) {
      console.log(`🗑️  Cleaned up ${accountDeletedCount} job(s) for deleted accounts`);
    }
    console.log(`✅ Validated ${validatedCount} running jobs, marked ${markedFailedCount} failed`);
    
    // Calculate available slots for new jobs
    const APIFY_CONCURRENCY_LIMIT = 10;
    const actualRunningCount = runningCount - markedFailedCount - accountDeletedCount;
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
        const jobType = job.type || 'account_sync';
        
        // Log based on job type
        if (jobType === 'single_video') {
          console.log(`   ⚡ Dispatching video job ${jobId}: ${job.videoUrl}`);
        } else {
          console.log(`   ⚡ Dispatching account job ${jobId}: @${job.accountUsername} (${job.accountPlatform})`);
        }
        
        // Update job status to running
        await jobDoc.ref.update({
          status: 'running',
          startedAt: Timestamp.now()
        });
        
        // Dispatch based on job type
        if (jobType === 'single_video') {
          // Dispatch to process-single-video for video jobs
          fetch(`${baseUrl}/api/process-single-video`, {
            method: 'POST',
            headers: {
              'Authorization': cronSecret, // Raw secret (no Bearer prefix)
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              videoId: job.videoUrl, // process-single-video expects videoId (which is the URL)
              orgId: job.orgId,
              projectId: job.projectId,
              jobId: jobId,
              addedBy: job.addedBy // Pass through the user who submitted the video
            })
          }).then(response => {
            if (response.ok) {
              console.log(`      ✅ Video job started`);
            } else {
              console.error(`      ❌ Video job failed: HTTP ${response.status}`);
            }
          }).catch(err => {
            console.error(`      ❌ Video job error:`, err.message);
          });
        } else {
          // Dispatch to sync-single-account for account sync jobs
          fetch(`${baseUrl}/api/sync-single-account`, {
            method: 'POST',
            headers: {
              'Authorization': cronSecret, // Raw secret (no Bearer prefix)
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
        }
        
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

