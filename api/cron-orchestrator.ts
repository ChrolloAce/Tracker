import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
 * Cron Orchestrator
 * 
 * Main cron job that runs every 5 minutes (for testing)
 * 
 * Architecture:
 * 1. Finds all organizations
 * 2. Dispatches parallel jobs to /api/refresh-organization for each org
 * 3. Each org job handles its own accounts, projects, and email notifications
 * 4. Aggregates and reports final stats
 * 
 * This approach ensures:
 * - Fast orchestrator execution (< 2 seconds)
 * - Parallel processing of organizations
 * - Isolated failures (one org failing doesn't affect others)
 * - Scalability (can handle 100+ orgs without timeout)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret or Vercel Cron header
  let authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  
  // Strip "Bearer " prefix if present
  if (authHeader && authHeader.startsWith('Bearer ')) {
    authHeader = authHeader.substring(7);
  }
  
  console.log('🔐 Auth check:', {
    isVercelCron,
    hasAuth: !!authHeader,
    authMatches: authHeader === cronSecret,
    hasCronSecret: !!cronSecret,
    authHeaderLength: authHeader?.length || 0,
    cronSecretLength: cronSecret?.length || 0,
    authFirst10: authHeader?.substring(0, 10) || 'none',
    secretFirst10: cronSecret?.substring(0, 10) || 'none',
  });
  
  // Allow if:
  // 1. Request is from Vercel Cron (x-vercel-cron header) - MOST RELIABLE
  // 2. Authorization header matches CRON_SECRET
  const isAuthorized = isVercelCron || authHeader === cronSecret;
  
  if (!isAuthorized) {
    console.log('❌ Unauthorized cron request - auth check failed');
    console.log('💡 Tip: Wait for Vercel Cron to auto-trigger (will have x-vercel-cron header)');
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'This endpoint is only accessible by Vercel Cron or with valid CRON_SECRET',
      debug: {
        isVercelCron,
        hasAuth: !!authHeader,
        hasCronSecret: !!cronSecret,
        authMatches: authHeader === cronSecret
      }
    });
  }
  
  console.log('✅ Authorized:', isVercelCron ? 'Vercel Cron' : 'Auth Header');

  const startTime = Date.now();
  console.log(`🚀 Cron Orchestrator started at ${new Date().toISOString()}`);

  try {
    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`📊 Found ${orgsSnapshot.size} organization(s) - dispatching parallel jobs...\n`);

    const orgDispatchPromises: Promise<any>[] = [];

    // Dispatch parallel jobs for each organization
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      console.log(`📁 Dispatching job for organization: ${orgId}`);

      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.viewtrack.app';
      
      const dispatchPromise = fetch(`${baseUrl}/api/refresh-organization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': cronSecret || ''
        },
        body: JSON.stringify({
          organizationId: orgId
        })
      })
        .then(async (response) => {
          if (response.ok) {
            const result = await response.json();
            console.log(`  ✅ Organization ${orgId} completed: ${result.stats.jobsSuccessful} accounts refreshed`);
            return { success: true, orgId, result };
          } else {
            const errorText = await response.text();
            console.error(`  ❌ Organization ${orgId} failed: ${errorText}`);
            return { success: false, orgId, error: errorText };
          }
        })
        .catch((error) => {
          console.error(`  ❌ Organization ${orgId} dispatch error:`, error.message);
          return { success: false, orgId, error: error.message };
        });

      orgDispatchPromises.push(dispatchPromise);
      
      // Small stagger to avoid overwhelming (100ms between org dispatches)
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Wait for all organization jobs to complete
    console.log(`\n⏳ Waiting for ${orgDispatchPromises.length} organization jobs to complete...`);
    const results = await Promise.allSettled(orgDispatchPromises);

    // Aggregate stats from all organization results
    let successfulOrgs = 0;
    let failedOrgs = 0;
    let totalAccountsFound = 0;
    let totalAccountsRefreshed = 0;
    let totalVideosRefreshed = 0;
    let totalVideosAdded = 0;
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success && result.value.result) {
        successfulOrgs++;
        const stats = result.value.result.stats;
        totalAccountsFound += stats.accountsFound || 0;
        totalAccountsRefreshed += stats.jobsSuccessful || 0;
        totalVideosRefreshed += stats.videosRefreshed || 0;
        totalVideosAdded += stats.videosAdded || 0;
      } else {
        failedOrgs++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n============================================================`);
    console.log(`🎉 Orchestrator completed!`);
    console.log(`============================================================`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Organizations processed: ${orgsSnapshot.size}`);
    console.log(`✅ Organizations successful: ${successfulOrgs}`);
    console.log(`❌ Organizations failed: ${failedOrgs}`);
    console.log(`👥 Total accounts found: ${totalAccountsFound}`);
    console.log(`⚡ Total accounts refreshed: ${totalAccountsRefreshed}`);
    console.log(`🎬 Total videos refreshed: ${totalVideosRefreshed}`);
    console.log(`➕ Total new videos added: ${totalVideosAdded}`);
    console.log(`============================================================\n`);

    // Note: Email notifications are handled by individual organization jobs
    console.log(`ℹ️  Email notifications sent by individual organization jobs\n`);

    return res.status(200).json({
      success: true,
      message: 'Orchestrator completed',
      stats: {
        duration: parseFloat(duration),
        orgsProcessed: orgsSnapshot.size,
        orgsSuccessful: successfulOrgs,
        orgsFailed: failedOrgs,
        totalAccountsFound,
        totalAccountsRefreshed,
        totalVideosRefreshed,
        totalVideosAdded
      },
      results: results.map((r) => {
        if (r.status === 'fulfilled') {
          return r.value;
        } else {
          return { success: false, error: (r.reason as any)?.message || 'Unknown error' };
        }
      })
    });

  } catch (error: any) {
    console.error(`❌ Orchestrator error:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Orchestrator failed'
    });
  }
}
