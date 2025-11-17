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
 * Queue Worker - Processes account sync jobs from Firestore queue
 * 
 * This worker:
 * 1. Fetches pending jobs from Firestore (max 6 at a time for Apify concurrency)
 * 2. Dispatches each job to sync-single-account
 * 3. Waits for completion before processing next batch
 * 4. Updates job status and handles retries
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const db = initializeFirebase();
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  // Authenticate
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ Unauthorized request to queue-worker');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  console.log(`\n🔄 Queue Worker Started at ${new Date().toISOString()}`);
  const startTime = Date.now();
  
  const APIFY_CONCURRENCY_LIMIT = 6; // Max concurrent Apify jobs
  const baseUrl = 'https://www.viewtrack.app';
  
  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;
  let batchNumber = 0;
  
  try {
    // Keep processing batches until no more pending jobs
    while (true) {
      batchNumber++;
      
      // Fetch next batch of pending jobs (sorted by priority, then created time)
      const pendingJobs = await db
        .collection('syncQueue')
        .where('status', '==', 'pending')
        .where('attempts', '<', 3) // Max 3 attempts
        .orderBy('priority', 'desc')
        .orderBy('createdAt', 'asc')
        .limit(APIFY_CONCURRENCY_LIMIT)
        .get();
      
      if (pendingJobs.empty) {
        console.log(`✅ No more pending jobs - queue is empty`);
        break;
      }
      
      console.log(`\n📦 Batch ${batchNumber}: Processing ${pendingJobs.size} jobs`);
      
      // Mark jobs as processing
      const batch = db.batch();
      pendingJobs.docs.forEach(doc => {
        batch.update(doc.ref, {
          status: 'processing',
          startedAt: Timestamp.now(),
          attempts: (doc.data().attempts || 0) + 1
        });
      });
      await batch.commit();
      
      // Process all jobs in this batch in parallel
      const jobPromises = pendingJobs.docs.map(async (jobDoc) => {
        const job = jobDoc.data();
        
        console.log(`   ⚡ Processing @${job.accountUsername} (${job.accountPlatform})`);
        
        try {
          const response = await fetch(`${baseUrl}/api/sync-single-account`, {
            method: 'POST',
            headers: {
              'Authorization': cronSecret,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              orgId: job.orgId,
              projectId: job.projectId,
              accountId: job.accountId,
              sessionId: job.sessionId
            })
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const result = await response.json();
          
          // Mark job as completed
          await jobDoc.ref.update({
            status: 'completed',
            completedAt: Timestamp.now(),
            result: result,
            error: null
          });
          
          console.log(`      ✅ @${job.accountUsername}: ${result.videosCount || 0} videos synced`);
          totalSuccessful++;
          
          return { success: true, job };
          
        } catch (error: any) {
          console.error(`      ❌ @${job.accountUsername}: ${error.message}`);
          
          // Mark job as failed (or retry if attempts < maxAttempts)
          const shouldRetry = job.attempts < job.maxAttempts;
          
          await jobDoc.ref.update({
            status: shouldRetry ? 'pending' : 'failed',
            error: error.message,
            lastAttemptAt: Timestamp.now(),
            ...(shouldRetry ? {} : { failedAt: Timestamp.now() })
          });
          
          if (!shouldRetry) {
            totalFailed++;
          }
          
          return { success: false, job, error: error.message };
        }
      });
      
      // Wait for all jobs in this batch to complete
      await Promise.allSettled(jobPromises);
      totalProcessed += pendingJobs.size;
      
      console.log(`   ✅ Batch ${batchNumber} complete`);
      
      // Small delay before next batch
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Prevent infinite loops - max 100 batches per run (600 jobs)
      if (batchNumber >= 100) {
        console.log(`⚠️  Reached batch limit (100) - stopping for now`);
        break;
      }
      
      // Timeout protection - stop after 4 minutes (leave 1 min buffer for 5 min timeout)
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > 240) {
        console.log(`⚠️  Approaching timeout (${elapsed.toFixed(0)}s) - stopping for now`);
        break;
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n========================================`);
    console.log(`✅ Queue Worker Complete`);
    console.log(`========================================`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📦 Batches: ${batchNumber}`);
    console.log(`📊 Jobs processed: ${totalProcessed}`);
    console.log(`✅ Successful: ${totalSuccessful}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`========================================\n`);
    
    return res.status(200).json({
      success: true,
      stats: {
        duration: parseFloat(duration),
        batches: batchNumber,
        processed: totalProcessed,
        successful: totalSuccessful,
        failed: totalFailed
      }
    });
    
  } catch (error: any) {
    console.error(`❌ Queue worker error:`, error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stats: {
        processed: totalProcessed,
        successful: totalSuccessful,
        failed: totalFailed
      }
    });
  }
}

