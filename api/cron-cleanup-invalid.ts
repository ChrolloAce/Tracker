import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { CleanupService } from './services/CleanupService.js';

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

    initializeApp({ credential: cert(serviceAccount as any) });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const db = getFirestore();

/**
 * Cron job to automatically cleanup invalid videos/accounts
 * 
 * Schedule: Every 6 hours
 * 
 * This job:
 * 1. Finds all organizations/projects
 * 2. Runs cleanup for each project
 * 3. Deletes videos/accounts that have no username, no stats, no data
 * 4. Only deletes items older than 1 hour (grace period for sync)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret (optional security)
  const cronSecret = req.headers['x-vercel-cron-secret'] || req.query.secret;
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('🧹 [CRON CLEANUP] Starting automated cleanup job...');

  try {
    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    
    if (orgsSnapshot.empty) {
      console.log('⚠️ [CRON CLEANUP] No organizations found');
      return res.status(200).json({
        success: true,
        message: 'No organizations to clean up'
      });
    }

    let totalStats = {
      videosDeleted: 0,
      accountsDeleted: 0,
      snapshotsDeleted: 0,
      projectsProcessed: 0,
      errors: [] as string[]
    };

    // Process each organization
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      console.log(`🔍 [CRON CLEANUP] Processing organization: ${orgId}`);

      // Get all projects for this organization
      const projectsSnapshot = await orgDoc.ref.collection('projects').get();

      if (projectsSnapshot.empty) {
        console.log(`⚠️ [CRON CLEANUP] No projects found for org: ${orgId}`);
        continue;
      }

      // Process each project
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        console.log(`🧹 [CRON CLEANUP] Cleaning project: ${projectId}`);

        try {
          const stats = await CleanupService.runFullCleanup(orgId, projectId);
          
          totalStats.videosDeleted += stats.videosDeleted;
          totalStats.accountsDeleted += stats.accountsDeleted;
          totalStats.snapshotsDeleted += stats.snapshotsDeleted;
          totalStats.projectsProcessed++;
          totalStats.errors.push(...stats.errors);

          console.log(`✅ [CRON CLEANUP] Project ${projectId} cleaned: ${stats.videosDeleted} videos, ${stats.accountsDeleted} accounts`);
        } catch (cleanupError) {
          console.error(`❌ [CRON CLEANUP] Failed to clean project ${projectId}:`, cleanupError);
          totalStats.errors.push(`Project ${projectId}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
        }
      }
    }

    console.log(`✅ [CRON CLEANUP] Cleanup job complete:`);
    console.log(`   - Projects processed: ${totalStats.projectsProcessed}`);
    console.log(`   - Videos deleted: ${totalStats.videosDeleted}`);
    console.log(`   - Accounts deleted: ${totalStats.accountsDeleted}`);
    console.log(`   - Snapshots deleted: ${totalStats.snapshotsDeleted}`);
    console.log(`   - Errors: ${totalStats.errors.length}`);

    return res.status(200).json({
      success: true,
      message: 'Cleanup job completed',
      stats: totalStats
    });
  } catch (error) {
    console.error('❌ [CRON CLEANUP] Cleanup job failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

