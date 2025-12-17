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

interface OrganizationSummary {
  id: string;
  name: string;
  createdAt: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  memberCount: number;
  plan: string;
  planTier: 'free' | 'basic' | 'pro' | 'enterprise';
  projectCount: number;
  totalTrackedAccounts: number;
  totalVideos: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get user email from query param (in production, verify with Firebase Auth token)
  const userEmail = req.query.email as string;
  
  if (!userEmail || !SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
  }

  try {
    console.log('🔍 SuperAdmin API: Fetching all organizations...');
    
    const orgsSnapshot = await adminDb.collection('organizations').get();
    console.log('📊 Found', orgsSnapshot.size, 'organizations');
    
    const organizations: OrganizationSummary[] = [];
    
    for (const orgDoc of orgsSnapshot.docs) {
      const orgData = orgDoc.data();
      const orgId = orgDoc.id;
      
      // Get owner info
      let ownerEmail = '';
      let ownerName = '';
      if (orgData.ownerId) {
        try {
          const memberDoc = await adminDb
            .collection('organizations')
            .doc(orgId)
            .collection('members')
            .doc(orgData.ownerId)
            .get();
          
          if (memberDoc.exists) {
            const memberData = memberDoc.data();
            ownerEmail = memberData?.email || '';
            ownerName = memberData?.displayName || memberData?.email || '';
          }
        } catch (e) {
          console.warn(`Failed to get owner info for org ${orgId}`);
        }
      }
      
      // Get member count
      let memberCount = 0;
      try {
        const membersSnapshot = await adminDb
          .collection('organizations')
          .doc(orgId)
          .collection('members')
          .get();
        memberCount = membersSnapshot.size;
      } catch (e) {
        console.warn(`Failed to get member count for org ${orgId}`);
      }
      
      // Get subscription/plan info
      let plan = 'Free';
      let planTier: 'free' | 'basic' | 'pro' | 'enterprise' = 'free';
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
          if (subData?.status === 'active' && planTier !== 'free') {
            plan += ' (Active)';
          } else if (subData?.status === 'canceled') {
            plan += ' (Canceled)';
          }
        }
      } catch (e) {
        console.warn(`Failed to get subscription for org ${orgId}`);
      }
      
      // Get project count and totals
      let projectCount = 0;
      let totalTrackedAccounts = 0;
      let totalVideos = 0;
      try {
        const projectsSnapshot = await adminDb
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .get();
        projectCount = projectsSnapshot.size;
        
        // For each project, count accounts and videos
        for (const projectDoc of projectsSnapshot.docs) {
          const projectId = projectDoc.id;
          
          // Count tracked accounts
          const accountsSnapshot = await adminDb
            .collection('organizations')
            .doc(orgId)
            .collection('projects')
            .doc(projectId)
            .collection('trackedAccounts')
            .get();
          totalTrackedAccounts += accountsSnapshot.size;
          
          // Count videos
          const videosSnapshot = await adminDb
            .collection('organizations')
            .doc(orgId)
            .collection('projects')
            .doc(projectId)
            .collection('videos')
            .get();
          totalVideos += videosSnapshot.size;
        }
      } catch (e) {
        console.warn(`Failed to get projects for org ${orgId}`);
      }
      
      organizations.push({
        id: orgId,
        name: orgData.name || 'Unnamed Organization',
        createdAt: orgData.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
        ownerId: orgData.ownerId || '',
        ownerEmail,
        ownerName,
        memberCount,
        plan,
        planTier,
        projectCount,
        totalTrackedAccounts,
        totalVideos,
      });
    }
    
    // Sort by createdAt descending (newest first)
    organizations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Calculate stats
    const planBreakdown = {
      free: organizations.filter(o => o.planTier === 'free').length,
      basic: organizations.filter(o => o.planTier === 'basic').length,
      pro: organizations.filter(o => o.planTier === 'pro').length,
      enterprise: organizations.filter(o => o.planTier === 'enterprise').length,
    };
    
    const stats = {
      totalOrganizations: organizations.length,
      totalPaidOrganizations: organizations.filter(o => o.planTier !== 'free').length,
      totalFreeOrganizations: planBreakdown.free,
      totalUsers: new Set(organizations.map(o => o.ownerId).filter(Boolean)).size,
      totalTrackedAccounts: organizations.reduce((sum, o) => sum + o.totalTrackedAccounts, 0),
      totalVideos: organizations.reduce((sum, o) => sum + o.totalVideos, 0),
      planBreakdown,
    };
    
    console.log('✅ SuperAdmin API: Returning', organizations.length, 'organizations');
    
    return res.status(200).json({ organizations, stats });
  } catch (error) {
    console.error('❌ SuperAdmin API error:', error);
    return res.status(500).json({ error: 'Failed to fetch organizations', details: String(error) });
  }
}

