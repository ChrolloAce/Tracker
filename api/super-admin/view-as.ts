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
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId, email } = req.query;
  
  if (!email || !SUPER_ADMIN_EMAILS.includes((email as string).toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
  }

  if (!orgId || typeof orgId !== 'string') {
    return res.status(400).json({ error: 'Organization ID is required' });
  }

  try {
    console.log(`🔍 SuperAdmin: Getting view-as data for org ${orgId}`);
    
    // Get org data
    const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
    if (!orgDoc.exists) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const orgData = orgDoc.data()!;
    const orgName = orgData.name || 'Unknown Organization';

    // Get first project
    const projectsSnapshot = await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .limit(1)
      .get();

    if (projectsSnapshot.empty) {
      return res.status(404).json({ error: 'Organization has no projects' });
    }

    const firstProject = projectsSnapshot.docs[0];
    const projectId = firstProject.id;
    const projectName = firstProject.data()?.name || 'Default Project';

    console.log(`✅ SuperAdmin: Found org "${orgName}" with project "${projectName}"`);
    
    return res.status(200).json({ 
      success: true,
      orgId,
      orgName,
      projectId,
      projectName
    });
  } catch (error) {
    console.error('❌ SuperAdmin view-as error:', error);
    return res.status(500).json({ error: 'Failed to get organization data', details: String(error) });
  }
}

