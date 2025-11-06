import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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
 * Runs every 12 hours (00:00 and 12:00) and refreshes ALL accounts simultaneously
 * 
 * All accounts across all organizations refresh at the same time.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret or Vercel Cron header
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  
  // Allow if:
  // 1. Authorization header matches CRON_SECRET
  // 2. Request is from Vercel Cron (x-vercel-cron header)
  if (!isVercelCron && authHeader !== cronSecret) {
    console.log('❌ Unauthorized cron request:', { 
      hasAuth: !!authHeader, 
      hasVercelCron: isVercelCron,
      headers: Object.keys(req.headers)
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  console.log(`🚀 Cron Orchestrator started at ${new Date().toISOString()}`);

  try {
    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`📊 Found ${orgsSnapshot.size} organization(s)`);

    let totalAccounts = 0;
    let dispatchedJobs = 0;
    let failedDispatches = 0;
    const dispatchPromises: Promise<any>[] = [];

    // For each organization
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      console.log(`📁 Processing organization: ${orgId}`);

      // Get all projects in this org
      const projectsSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .get();

      console.log(`  📂 Found ${projectsSnapshot.size} project(s)`);

      // For each project
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        const projectData = projectDoc.data();
        console.log(`  📦 Processing project: ${projectData?.name || projectId}`);

        // Refresh ALL accounts every time the cron runs (every 12 hours)
        console.log(`    🚀 Refreshing ALL accounts in project...`);

        // Get all active tracked accounts
        const accountsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('trackedAccounts')
          .where('status', '==', 'active')
          .get();

        totalAccounts += accountsSnapshot.size;
        console.log(`    👥 Found ${accountsSnapshot.size} active account(s)`);

        // Dispatch refresh jobs for ALL accounts simultaneously
        for (const accountDoc of accountsSnapshot.docs) {
          const accountId = accountDoc.id;
          const accountData = accountDoc.data();

          console.log(`      ⚡ Dispatching @${accountData.username} (${accountData.platform})`);

          // Dispatch async refresh job
          const dispatchPromise = fetch(`${process.env.VERCEL_URL || 'https://www.viewtrack.app'}/api/refresh-account`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': cronSecret || ''
            },
            body: JSON.stringify({
              orgId,
              projectId,
              accountId
            })
          })
            .then(async (response) => {
              if (response.ok) {
                const data = await response.json();
                console.log(`        ✅ @${accountData.username}: ${data.videosUpdated} updated, ${data.videosAdded} added`);
                dispatchedJobs++;
                return { success: true, account: accountData.username };
              } else {
                const errorText = await response.text();
                console.error(`        ❌ @${accountData.username} failed: ${errorText}`);
                failedDispatches++;
                return { success: false, account: accountData.username, error: errorText };
              }
            })
            .catch((error) => {
              console.error(`        ❌ @${accountData.username} dispatch error:`, error.message);
              failedDispatches++;
              return { success: false, account: accountData.username, error: error.message };
            });

          dispatchPromises.push(dispatchPromise);

          // Small stagger to avoid overwhelming (50ms between dispatches)
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Update project's lastGlobalRefresh timestamp
        await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .update({
            lastGlobalRefresh: Timestamp.now()
          });
        
        console.log(`    ✅ Updated lastGlobalRefresh for project`);
      }
    }

    // Wait for all dispatched jobs to complete
    console.log(`\n⏳ Waiting for ${dispatchPromises.length} dispatched jobs to complete...`);
    const results = await Promise.allSettled(dispatchPromises);

    // Count successes and failures
    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as any).success)).length;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n============================================================`);
    console.log(`🎉 Orchestrator completed!`);
    console.log(`============================================================`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Accounts found: ${totalAccounts}`);
    console.log(`✅ Jobs successful: ${successful}`);
    console.log(`❌ Jobs failed: ${failed}`);
    console.log(`⏭️  Jobs skipped: ${totalAccounts - dispatchPromises.length}`);
    console.log(`============================================================\n`);

    return res.status(200).json({
      success: true,
      message: 'Orchestrator completed',
      stats: {
        totalAccounts,
        jobsDispatched: dispatchPromises.length,
        jobsSuccessful: successful,
        jobsFailed: failed,
        jobsSkipped: totalAccounts - dispatchPromises.length,
        duration: parseFloat(duration)
      },
      results: results.map((r, i) => {
        if (r.status === 'fulfilled') {
          return r.value;
        } else {
          return { success: false, error: r.reason };
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

