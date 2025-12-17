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

    const orgName = orgDoc.data()?.name || 'Unknown';
    console.log(`📋 Organization: ${orgName}`);

    // Get CRON_SECRET for authorization
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('❌ CRON_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error - CRON_SECRET missing' });
    }

    // Call process-organization directly - same as scheduled refresh
    const baseUrl = 'https://www.viewtrack.app';
    
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
    console.log(`✅ SuperAdmin: Refresh triggered for ${orgName}`, result);
    
    return res.status(200).json({ 
      success: true, 
      message: `Refresh triggered for ${orgName}`,
      sessionId: result.sessionId,
      stats: result.stats
    });
  } catch (error) {
    console.error('❌ SuperAdmin trigger-refresh error:', error);
    return res.status(500).json({ error: 'Failed to trigger refresh', details: String(error) });
  }
}
