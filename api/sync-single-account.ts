import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { authenticateAndVerifyOrg, setCorsHeaders, handleCorsPreFlight, validateRequiredFields } from './middleware/auth.js';

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
 * Trigger Sync API - Immediately queues account for sync and triggers cron
 * 
 * Strategy:
 * 1. Mark account as 'pending' with high priority
 * 2. Return 200 OK immediately (no timeout)
 * 3. Trigger cron job asynchronously (fire-and-forget)
 * 4. Cron job does the actual work (has 60s timeout vs 10s for HTTP)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  setCorsHeaders(res);
  
  // Handle preflight requests
  if (handleCorsPreFlight(req, res)) {
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, orgId, projectId } = req.body;

  // Validate required fields
  const validation = validateRequiredFields(req.body, ['accountId', 'orgId', 'projectId']);
  if (!validation.valid) {
    return res.status(400).json({ 
      error: 'Missing required parameters', 
      missing: validation.missing 
    });
  }

  // 🔒 Authenticate - either user (manual) or cron secret (automated)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isCronRequest = authHeader === `Bearer ${cronSecret}`;
  
  if (isCronRequest) {
    console.log(`🔒 Authenticated as CRON job for sync request`);
  } else {
    // Regular user authentication
    try {
      const { user } = await authenticateAndVerifyOrg(req, orgId);
      console.log(`🔒 Authenticated user ${user.userId} for sync request`);
    } catch (authError: any) {
      console.error('❌ Authentication failed:', authError.message);
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: authError.message 
      });
    }
  }

  console.log(`⚡ Queuing immediate sync for account: ${accountId}`);

  try {
    const accountRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('trackedAccounts')
      .doc(accountId);

    const accountDoc = await accountRef.get();

    if (!accountDoc.exists) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = accountDoc.data();

    // Mark account as pending for immediate processing
    await accountRef.update({
      syncStatus: 'pending',
      syncRequestedAt: Timestamp.now(),
      syncRetryCount: 0,
      lastSyncError: null,
      syncProgress: {
        current: 0,
        total: 100,
        message: 'Queued for immediate sync...'
      }
    });

    console.log(`✅ Account @${account?.username} queued for sync`);

    // Respond immediately (don't wait for sync to complete)
    res.status(200).json({
      success: true,
      message: 'Account queued for immediate sync',
      accountId,
      username: account?.username
    });

    // 🔥 Fire-and-forget: Trigger cron job asynchronously (don't await)
    // This ensures the HTTP request doesn't timeout waiting for the sync
    const cronUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/cron-sync-accounts`
      : 'http://localhost:3000/api/cron-sync-accounts';

    console.log(`🚀 Triggering cron job asynchronously: ${cronUrl}`);

    // Don't await - let it run in background
    fetch(cronUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    }).then(cronRes => {
      if (cronRes.ok) {
        console.log(`✅ Cron job triggered successfully`);
      } else {
        console.warn(`⚠️ Cron job trigger failed (${cronRes.status}), will be picked up on next scheduled run`);
      }
    }).catch(err => {
      console.warn(`⚠️ Could not trigger cron job:`, err.message);
    });

  } catch (error: any) {
    console.error('❌ Failed to queue sync:', error);
    return res.status(500).json({
      error: 'Failed to queue sync',
      message: error.message
    });
  }
}
