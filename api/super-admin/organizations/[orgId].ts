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

  const { orgId } = req.query;
  const userEmail = req.query.email as string;
  
  if (!userEmail || !SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
  }

  if (!orgId || typeof orgId !== 'string') {
    return res.status(400).json({ error: 'Organization ID is required' });
  }

  try {
    console.log('🔍 SuperAdmin API: Fetching org details for', orgId);
    
    // Get org basic info
    const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
    
    if (!orgDoc.exists) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const orgData = orgDoc.data()!;
    
    // Get members
    const members: any[] = [];
    const membersSnapshot = await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('members')
      .get();
    
    membersSnapshot.forEach(doc => {
      members.push({ id: doc.id, ...doc.data() });
    });
    
    // Get subscription
    let planTier: 'free' | 'basic' | 'pro' | 'enterprise' = 'free';
    let plan = 'Free';
    try {
      const subDoc = await adminDb
        .collection('organizations')
        .doc(orgId)
        .collection('billing')
        .doc('subscription')
        .get();
      
      if (subDoc.exists) {
        const subData = subDoc.data();
        planTier = subData?.tier || 'free';
        plan = planTier.charAt(0).toUpperCase() + planTier.slice(1);
      }
    } catch (e) {
      console.warn(`Failed to get subscription for org ${orgId}`);
    }
    
    // Get tracked accounts and videos from all projects
    const trackedAccounts: any[] = [];
    const videos: any[] = [];
    
    const projectsSnapshot = await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .get();
    
    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id;
      const projectName = projectDoc.data().name || 'Default Project';
      
      // Get tracked accounts
      const accountsSnapshot = await adminDb
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .get();
      
      accountsSnapshot.forEach(doc => {
        trackedAccounts.push({ 
          id: doc.id, 
          projectId,
          projectName,
          ...doc.data() 
        });
      });
      
      // Get videos (limit to most recent 50 per project for performance)
      const videosSnapshot = await adminDb
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('videos')
        .orderBy('dateAdded', 'desc')
        .limit(50)
        .get();
      
      videosSnapshot.forEach(doc => {
        videos.push({ 
          id: doc.id, 
          projectId,
          projectName,
          ...doc.data() 
        });
      });
    }
    
    // Find owner info
    const owner = members.find(m => m.id === orgData.ownerId);
    
    const organization = {
      id: orgId,
      name: orgData.name || 'Unnamed Organization',
      createdAt: orgData.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
      ownerId: orgData.ownerId || '',
      ownerEmail: owner?.email || '',
      ownerName: owner?.displayName || owner?.email || '',
      memberCount: members.length,
      plan,
      planTier,
      projectCount: projectsSnapshot.size,
      totalTrackedAccounts: trackedAccounts.length,
      totalVideos: videos.length,
    };
    
    console.log('✅ SuperAdmin API: Returning org details');
    
    return res.status(200).json({ organization, trackedAccounts, videos, members });
  } catch (error) {
    console.error('❌ SuperAdmin API error:', error);
    return res.status(500).json({ error: 'Failed to fetch organization details', details: String(error) });
  }
}

