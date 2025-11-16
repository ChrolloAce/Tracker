import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin (with better error handling)
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
 * Cron Orchestrator - Hierarchical Dispatcher
 * Runs at 00:00 (midnight) and 12:00 (noon) UTC
 * 
 * SCHEDULE:
 * - Premium (Ultra/Enterprise): Refresh at 00:00 AND 12:00 (2x per day)
 * - Regular (Free/Basic/Pro): Refresh at 12:00 only (1x per day)
 * 
 * ARCHITECTURE:
 * Orchestrator → Organization Jobs → Project Jobs → Account Jobs
 * 
 * Each level dispatches the next level via fire-and-forget HTTP calls.
 * Completes in ~5-10 seconds regardless of org count.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Initialize Firebase and get db instance
    const db = initializeFirebase();
    
    // Verify authorization: Vercel Cron, Cron Secret, or Firebase User Token
    let authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    
    let isAuthorized = false;
    let authMethod = '';
    
    console.log(`🔍 Auth check - Header present: ${!!authHeader}, Vercel Cron: ${isVercelCron}, CRON_SECRET set: ${!!cronSecret}`);
    
    // Check 1: Vercel Cron header
    if (isVercelCron) {
      isAuthorized = true;
      authMethod = 'Vercel Cron';
      console.log('✅ Authorized via Vercel Cron header');
    }
    
    // Check 2: Cron Secret (strip "Bearer " prefix if present)
    if (!isAuthorized && authHeader && cronSecret) {
      let tokenToCheck = authHeader;
      if (authHeader.startsWith('Bearer ')) {
        tokenToCheck = authHeader.substring(7);
      }
      
      console.log(`🔑 Comparing tokens - Match: ${tokenToCheck === cronSecret}`);
      
      if (tokenToCheck === cronSecret) {
        isAuthorized = true;
        authMethod = 'Cron Secret';
        console.log('✅ Authorized via Cron Secret');
      } else {
        console.log('❌ Cron Secret mismatch');
      }
    }
    
    // Check 3: Firebase User Token (for manual testing via UI)
    if (!isAuthorized && authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        
        // Verify Firebase is properly initialized
        if (!getApps().length) {
          console.error('❌ Firebase not initialized when verifying token');
          return res.status(500).json({ 
            success: false,
            error: 'Server configuration error: Firebase not initialized',
            errorType: 'FIREBASE_NOT_INITIALIZED'
          });
        }
        
        console.log('🔐 Verifying Firebase user token...');
        const decodedToken = await getAuth().verifyIdToken(token);
        console.log(`🔒 Authenticated as Firebase user: ${decodedToken.uid}`);
        isAuthorized = true;
        authMethod = 'Firebase User';
      } catch (error: any) {
        console.error('❌ Firebase token verification failed:', error.message);
        console.error('Error details:', { code: error.code, stack: error.stack });
      }
    }
    
    if (!isAuthorized) {
      console.log('❌ Unauthorized orchestrator request');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'This endpoint requires Vercel Cron, CRON_SECRET, or valid Firebase user token'
      });
    }

    console.log(`✅ Authorized: ${authMethod}`);

    const startTime = Date.now();
    const currentHour = new Date().getUTCHours();
    console.log(`🚀 Cron Orchestrator started at ${new Date().toISOString()}`);
    console.log(`🕐 Current hour: ${currentHour}:00 UTC`);

    // Determine if this is a manual trigger (bypasses time restrictions)
    const isManualTrigger = authMethod === 'Cron Secret' || authMethod === 'Firebase User';
    
    if (isManualTrigger) {
      console.log(`⚡ Manual trigger detected - processing ALL organizations immediately\n`);
    } else {
      console.log(`⏰ Scheduled cron - processing based on plan tier and time\n`);
    }

    // Always use production URL
    const baseUrl = 'https://www.viewtrack.app';

    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`📊 Found ${orgsSnapshot.size} organization(s)\n`);

    let dispatchedCount = 0;
    let skippedCount = 0;

    // Process each organization
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      
      try {
        // Get organization's subscription to determine plan tier
        const subscriptionDoc = await db
          .collection('organizations')
          .doc(orgId)
          .collection('billing')
          .doc('subscription')
          .get();
        
        const planTier = subscriptionDoc.data()?.planTier || 'free';
        
        // Determine if this org should be processed
        let shouldProcess = true;
        
        // For scheduled cron (not manual), check time-based restrictions
        if (!isManualTrigger) {
          const isPremium = planTier === 'ultra' || planTier === 'enterprise';
          shouldProcess = isPremium || currentHour === 12;
          
          if (!shouldProcess) {
            console.log(`⏭️  Skip ${orgId} (${planTier} - not their refresh time)`);
            skippedCount++;
            continue;
          }
        }
        
        console.log(`✅ Dispatch ${orgId} (${planTier})`);
        
        // Fire-and-forget dispatch to organization processor
        fetch(`${baseUrl}/api/process-organization`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cronSecret}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ orgId })
        }).catch(err => {
          console.error(`  ❌ Failed to dispatch ${orgId}:`, err.message);
        });
        
        dispatchedCount++;
        
      } catch (error: any) {
        console.error(`  ❌ Error processing ${orgId}:`, error.message);
        skippedCount++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n============================================================`);
    console.log(`🎉 Orchestrator completed!`);
    console.log(`============================================================`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📤 Dispatched: ${dispatchedCount} organizations`);
    console.log(`⏭️  Skipped: ${skippedCount} organizations`);
    console.log(`\n🔄 Organization jobs are now processing in the background...`);
    console.log(`📧 Emails will be sent automatically when each org completes\n`);

    return res.status(200).json({
      success: true,
      stats: {
        duration: parseFloat(duration),
        dispatched: dispatchedCount,
        skipped: skippedCount,
        currentHour,
        timestamp: new Date().toISOString()
      },
      message: 'Organization refresh jobs dispatched successfully'
    });

  } catch (error: any) {
    console.error('❌ Orchestrator error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
