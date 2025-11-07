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
 * API endpoint to manually trigger cleanup of invalid videos/accounts
 * 
 * POST /api/cleanup-invalid-data
 * Body: { orgId, projectId, type?: 'videos' | 'accounts' | 'all' }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orgId, projectId, type = 'all' } = req.body;

    if (!orgId || !projectId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: orgId, projectId'
      });
    }

    console.log(`🧹 [CLEANUP API] Starting ${type} cleanup for org: ${orgId}, project: ${projectId}`);

    let stats;

    switch (type) {
      case 'videos':
        stats = await CleanupService.cleanupInvalidVideos(orgId, projectId);
        break;
      case 'accounts':
        stats = await CleanupService.cleanupInvalidAccounts(orgId, projectId);
        break;
      case 'all':
      default:
        stats = await CleanupService.runFullCleanup(orgId, projectId);
        break;
    }

    return res.status(200).json({
      success: true,
      message: 'Cleanup completed successfully',
      stats: {
        videosDeleted: stats.videosDeleted,
        accountsDeleted: stats.accountsDeleted,
        snapshotsDeleted: stats.snapshotsDeleted,
        errors: stats.errors
      }
    });
  } catch (error) {
    console.error('❌ [CLEANUP API] Cleanup failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

