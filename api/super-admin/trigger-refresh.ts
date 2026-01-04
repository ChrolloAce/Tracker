import type { VercelRequest, VercelResponse } from '@vercel/node';
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

    initializeApp({ credential: cert(serviceAccount as any) });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const adminDb = getFirestore();

// Super admin emails
const SUPER_ADMIN_EMAILS = [
  'ernesto@maktubtechnologies.com'
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, orgId, projectId, accountId } = req.body;
  
  if (!email || !SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
  }

  if (!orgId) {
    return res.status(400).json({ error: 'Organization ID is required' });
  }

  // Get CRON_SECRET for authorization
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('❌ CRON_SECRET not configured');
    return res.status(500).json({ error: 'Server configuration error - CRON_SECRET missing' });
  }

  const baseUrl = 'https://www.viewtrack.app';

  try {
    // Check if org exists
    const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
    if (!orgDoc.exists) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const orgName = orgDoc.data()?.name || 'Unknown';

    // ========================================
    // SINGLE ACCOUNT REFRESH
    // ========================================
    if (accountId && projectId) {
      console.log(`🎯 SuperAdmin: Triggering SINGLE ACCOUNT refresh`);
      console.log(`   Org: ${orgId}`);
      console.log(`   Project: ${projectId}`);
      console.log(`   Account: ${accountId}`);

      // Verify account exists
      const accountDoc = await adminDb
        .collection('organizations').doc(orgId)
        .collection('projects').doc(projectId)
        .collection('trackedAccounts').doc(accountId)
        .get();
      
      if (!accountDoc.exists) {
        return res.status(404).json({ error: 'Account not found' });
      }
      
      const accountData = accountDoc.data();
      const username = accountData?.username || 'unknown';
      const platform = accountData?.platform || 'unknown';
      
      console.log(`   Username: @${username} (${platform})`);
      
      // Check if account is active
      if (accountData?.isActive === false) {
        console.warn(`   ⚠️ Account is INACTIVE - will still process but this may be why it wasn't refreshing`);
    }

      // Create a job directly in syncQueue for this single account
      const jobRef = adminDb.collection('syncQueue').doc();
      const isStaticAccount = accountData?.creatorType === 'static' || accountData?.creatorType === 'manual';
      
      await jobRef.set({
        type: 'account_sync',
        status: 'pending',
        syncStrategy: isStaticAccount ? 'refresh_only' : 'progressive',
        orgId,
        projectId,
        accountId,
        sessionId: null, // No session for single account refresh
        accountUsername: username,
        accountPlatform: platform,
        createdAt: Timestamp.now(),
        startedAt: null,
        completedAt: null,
        attempts: 0,
        maxAttempts: 3,
        priority: 100, // High priority for manual refresh
        error: null,
        triggeredBy: 'super_admin_single'
      });
      
      console.log(`   ✅ Created job: ${jobRef.id}`);
      console.log(`   ⏳ Job will be picked up by queue-worker within 1 minute`);
      
      return res.status(200).json({ 
        success: true, 
        message: `Single account refresh queued for @${username}`,
        mode: 'single_account',
        jobId: jobRef.id,
        account: {
          id: accountId,
          username,
          platform,
          isActive: accountData?.isActive,
          creatorType: accountData?.creatorType
        }
      });
    }

    // ========================================
    // FULL ORGANIZATION REFRESH (existing behavior)
    // ========================================
    console.log(`🔄 SuperAdmin: Triggering FULL ORG refresh for ${orgId}`);
    console.log(`📋 Organization: ${orgName}`);
    console.log(`🚀 Dispatching to process-organization...`);
    
    const response = await fetch(`${baseUrl}/api/process-organization`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orgId,
        manual: true // Mark as manual trigger from super admin
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ process-organization failed: ${response.status} - ${errorText}`);
      return res.status(500).json({ 
        error: 'Failed to trigger refresh', 
        details: `HTTP ${response.status}` 
      });
    }

    const result = await response.json();
    console.log(`✅ SuperAdmin: Full org refresh triggered for ${orgName}`, result);
    
    return res.status(200).json({ 
      success: true, 
      message: `Full org refresh triggered for ${orgName}`,
      mode: 'full_org',
      sessionId: result.sessionId,
      stats: result.stats
    });
  } catch (error) {
    console.error('❌ SuperAdmin trigger-refresh error:', error);
    return res.status(500).json({ error: 'Failed to trigger refresh', details: String(error) });
  }
}
