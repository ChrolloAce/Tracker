import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
 * Queue Status Endpoint - Diagnostics for job queue
 * 
 * Returns current state of the job queue:
 * - Pending jobs
 * - Running jobs
 * - Completed jobs (last hour)
 * - Failed jobs
 * - Recent completions with results
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = initializeFirebase();
    
    // Get jobs by status
    const pendingSnapshot = await db.collection('syncQueue').where('status', '==', 'pending').get();
    const runningSnapshot = await db.collection('syncQueue').where('status', '==', 'running').get();
    const completedSnapshot = await db.collection('syncQueue').where('status', '==', 'completed').limit(50).get();
    const failedSnapshot = await db.collection('syncQueue').where('status', '==', 'failed').get();
    
    // Extract job details
    const pendingJobs = pendingSnapshot.docs.map(doc => ({
      id: doc.id,
      username: doc.data().accountUsername,
      platform: doc.data().accountPlatform,
      priority: doc.data().priority,
      createdAt: doc.data().createdAt?.toDate(),
      attempts: doc.data().attempts
    }));
    
    const runningJobs = runningSnapshot.docs.map(doc => ({
      id: doc.id,
      username: doc.data().accountUsername,
      platform: doc.data().accountPlatform,
      startedAt: doc.data().startedAt?.toDate(),
      runningFor: doc.data().startedAt 
        ? `${Math.round((Date.now() - doc.data().startedAt.toMillis()) / 1000)}s`
        : 'unknown'
    }));
    
    const completedJobs = completedSnapshot.docs.map(doc => ({
      id: doc.id,
      username: doc.data().accountUsername,
      platform: doc.data().accountPlatform,
      completedAt: doc.data().completedAt?.toDate(),
      videosSynced: doc.data().videosSynced || 0,
      result: doc.data().result || 'unknown'
    }));
    
    const failedJobs = failedSnapshot.docs.map(doc => ({
      id: doc.id,
      username: doc.data().accountUsername,
      platform: doc.data().accountPlatform,
      error: doc.data().error,
      attempts: doc.data().attempts,
      completedAt: doc.data().completedAt?.toDate()
    }));
    
    // Calculate totals
    const totalVideosSynced = completedJobs.reduce((sum, job) => sum + (job.videosSynced || 0), 0);
    
    const response = {
      timestamp: new Date().toISOString(),
      queue: {
        pending: pendingSnapshot.size,
        running: runningSnapshot.size,
        completed: completedSnapshot.size,
        failed: failedSnapshot.size,
        total: pendingSnapshot.size + runningSnapshot.size
      },
      capacity: {
        max: 6,
        available: 6 - runningSnapshot.size,
        utilizationPercent: Math.round((runningSnapshot.size / 6) * 100)
      },
      performance: {
        totalVideosSynced,
        completedJobsShown: completedJobs.length,
        avgVideosPerJob: completedJobs.length > 0 
          ? (totalVideosSynced / completedJobs.length).toFixed(1)
          : 0
      },
      jobs: {
        pending: pendingJobs,
        running: runningJobs,
        recentlyCompleted: completedJobs.slice(0, 10), // Show last 10
        failed: failedJobs
      }
    };
    
    return res.status(200).json(response);
    
  } catch (error: any) {
    console.error('❌ Queue status error:', error);
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

