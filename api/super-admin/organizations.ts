import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
function initializeFirebase() {
  if (!getApps().length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      } as any),
    });
  }
  return getFirestore();
}

const SUPER_ADMIN_EMAILS = ['ernesto@maktubtechnologies.com'];

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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userEmail = req.query.email as string;
  if (!userEmail || !SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
  }

  try {
    const db = initializeFirebase();
    const startTime = Date.now();

    console.log('🔍 SuperAdmin API: Fetching all organizations (optimized)...');

    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`📊 Found ${orgsSnapshot.size} organizations`);

    // Process ALL orgs in parallel instead of sequentially
    const orgPromises = orgsSnapshot.docs.map(async (orgDoc) => {
      const orgData = orgDoc.data();
      const orgId = orgDoc.id;

      // Run all per-org queries in parallel
      const [ownerResult, membersSnapshot, subDoc, projectsSnapshot] = await Promise.all([
        // Owner info
        orgData.ownerId
          ? db.collection('organizations').doc(orgId).collection('members').doc(orgData.ownerId).get()
          : Promise.resolve(null),
        // Members count
        db.collection('organizations').doc(orgId).collection('members').get(),
        // Subscription
        db.collection('organizations').doc(orgId).collection('billing').doc('subscription').get(),
        // Projects
        db.collection('organizations').doc(orgId).collection('projects').get(),
      ]);

      // Extract owner info
      let ownerEmail = '';
      let ownerName = '';
      if (ownerResult?.exists) {
        const memberData = ownerResult.data();
        ownerEmail = memberData?.email || '';
        ownerName = memberData?.displayName || memberData?.email || '';
      }

      // Extract plan
      let plan = 'Free';
      let planTier: 'free' | 'basic' | 'pro' | 'enterprise' = 'free';
      if (subDoc.exists) {
        const subData = subDoc.data();
        planTier = subData?.planTier || subData?.tier || 'free';
        plan = planTier.charAt(0).toUpperCase() + planTier.slice(1);
        if (subData?.status === 'active' && planTier !== 'free') plan += ' (Active)';
        else if (subData?.status === 'canceled') plan += ' (Canceled)';
        else if (subData?.status === 'trialing') plan += ' (Trial)';
      }

      // Count accounts and videos across all projects — in parallel
      let totalTrackedAccounts = 0;
      let totalVideos = 0;

      if (projectsSnapshot.size > 0) {
        const projectCountPromises = projectsSnapshot.docs.map(async (projDoc) => {
          const pid = projDoc.id;
          const [accountsSnap, videosSnap] = await Promise.all([
            db.collection('organizations').doc(orgId)
              .collection('projects').doc(pid)
              .collection('trackedAccounts').get(),
            db.collection('organizations').doc(orgId)
              .collection('projects').doc(pid)
              .collection('videos').get(),
          ]);
          return { accounts: accountsSnap.size, videos: videosSnap.size };
        });

        const projectCounts = await Promise.all(projectCountPromises);
        for (const pc of projectCounts) {
          totalTrackedAccounts += pc.accounts;
          totalVideos += pc.videos;
        }
      }

      return {
        id: orgId,
        name: orgData.name || 'Unnamed Organization',
        createdAt: orgData.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
        ownerId: orgData.ownerId || '',
        ownerEmail,
        ownerName,
        memberCount: membersSnapshot.size,
        plan,
        planTier,
        projectCount: projectsSnapshot.size,
        totalTrackedAccounts,
        totalVideos,
      } as OrganizationSummary;
    });

    const organizations = await Promise.all(orgPromises);

    // Sort by createdAt descending
    organizations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate stats
    const planBreakdown = {
      free: organizations.filter((o) => o.planTier === 'free').length,
      basic: organizations.filter((o) => o.planTier === 'basic').length,
      pro: organizations.filter((o) => o.planTier === 'pro').length,
      enterprise: organizations.filter((o) => o.planTier === 'enterprise').length,
    };

    const stats = {
      totalOrganizations: organizations.length,
      totalPaidOrganizations: organizations.filter((o) => o.planTier !== 'free').length,
      totalFreeOrganizations: planBreakdown.free,
      totalUsers: new Set(organizations.map((o) => o.ownerId).filter(Boolean)).size,
      totalTrackedAccounts: organizations.reduce((sum, o) => sum + o.totalTrackedAccounts, 0),
      totalVideos: organizations.reduce((sum, o) => sum + o.totalVideos, 0),
      planBreakdown,
    };

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ SuperAdmin API: Returning ${organizations.length} orgs in ${duration}s`);

    return res.status(200).json({ organizations, stats });
  } catch (error) {
    console.error('❌ SuperAdmin API error:', error);
    return res.status(500).json({ error: 'Failed to fetch organizations', details: String(error) });
  }
}
