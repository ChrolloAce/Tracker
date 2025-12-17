import type { VercelRequest, VercelResponse } from '@vercel/node';
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

  const { email, orgId } = req.body;
  
  if (!email || !SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
  }

  if (!orgId) {
    return res.status(400).json({ error: 'Organization ID is required' });
  }

  try {
    console.log(`🔄 SuperAdmin: Triggering refresh for org ${orgId}`);
    
    // Check if org exists
    const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
    if (!orgDoc.exists) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get all projects for this organization
    const projectsSnapshot = await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .get();

    let totalAccountsQueued = 0;

    // For each project, queue all tracked accounts for refresh
    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id;
      
      // Get all tracked accounts
      const accountsSnapshot = await adminDb
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .get();

      // Queue each account for refresh
      for (const accountDoc of accountsSnapshot.docs) {
        const accountData = accountDoc.data();
        
        // Add to processing queue
        await adminDb.collection('processingQueue').add({
          type: 'refresh_account',
          organizationId: orgId,
          projectId: projectId,
          accountId: accountDoc.id,
          platform: accountData.platform,
          username: accountData.username,
          status: 'pending',
          priority: 1, // High priority for manual refresh
          createdAt: new Date(),
          updatedAt: new Date(),
          attempts: 0,
          triggeredBy: 'super-admin',
          triggeredByEmail: email,
        });
        
        totalAccountsQueued++;
      }
    }

    console.log(`✅ SuperAdmin: Queued ${totalAccountsQueued} accounts for refresh in org ${orgId}`);
    
    return res.status(200).json({ 
      success: true, 
      message: `Queued ${totalAccountsQueued} accounts for refresh`,
      accountsQueued: totalAccountsQueued
    });
  } catch (error) {
    console.error('❌ SuperAdmin trigger-refresh error:', error);
    return res.status(500).json({ error: 'Failed to trigger refresh', details: String(error) });
  }
}

