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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId, projectId, email } = req.query;
  
  if (!email || !SUPER_ADMIN_EMAILS.includes((email as string).toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
  }

  if (!orgId || !projectId) {
    return res.status(400).json({ error: 'Organization ID and Project ID are required' });
  }

  try {
    console.log(`🔍 SuperAdmin: Fetching dashboard data for org ${orgId}, project ${projectId}`);
    
    const orgIdStr = orgId as string;
    const projectIdStr = projectId as string;

    // Fetch all data in parallel
    const [
      videosSnapshot,
      accountsSnapshot,
      linksSnapshot,
      orgDoc,
      projectDoc,
      subscriptionDoc,
      allProjectsSnapshot
    ] = await Promise.all([
      // Videos
      adminDb
        .collection('organizations')
        .doc(orgIdStr)
        .collection('projects')
        .doc(projectIdStr)
        .collection('videos')
        .orderBy('dateAdded', 'desc')
        .limit(500)
        .get(),
      
      // Tracked Accounts
      adminDb
        .collection('organizations')
        .doc(orgIdStr)
        .collection('projects')
        .doc(projectIdStr)
        .collection('trackedAccounts')
        .get(),
      
      // Tracked Links
      adminDb
        .collection('organizations')
        .doc(orgIdStr)
        .collection('projects')
        .doc(projectIdStr)
        .collection('trackedLinks')
        .get(),
      
      // Organization
      adminDb.collection('organizations').doc(orgIdStr).get(),
      
      // Project
      adminDb
        .collection('organizations')
        .doc(orgIdStr)
        .collection('projects')
        .doc(projectIdStr)
        .get(),
      
      // Subscription
      adminDb
        .collection('organizations')
        .doc(orgIdStr)
        .collection('billing')
        .doc('subscription')
        .get(),
      
      // All Projects in org
      adminDb
        .collection('organizations')
        .doc(orgIdStr)
        .collection('projects')
        .get()
    ]);

    // Process videos with their snapshots
    const videos = await Promise.all(
      videosSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        
        // Get snapshots for this video
        const snapshotsSnapshot = await adminDb
          .collection('organizations')
          .doc(orgIdStr)
          .collection('projects')
          .doc(projectIdStr)
          .collection('videos')
          .doc(doc.id)
          .collection('snapshots')
          .orderBy('timestamp', 'desc')
          .limit(100)
          .get();
        
        const snapshots = snapshotsSnapshot.docs.map(s => ({
          id: s.id,
          ...s.data(),
          timestamp: s.data().timestamp?.toDate?.()?.toISOString() || null
        }));
        
        return {
          id: doc.id,
          ...data,
          dateAdded: data.dateAdded?.toDate?.()?.toISOString() || null,
          lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || null,
          uploadDate: data.uploadDate?.toDate?.()?.toISOString() || data.uploadDate || null,
          snapshots
        };
      })
    );

    // Process accounts
    const accounts = accountsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        dateAdded: data.dateAdded?.toDate?.()?.toISOString() || null,
        lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || null,
        lastSynced: data.lastSynced?.toDate?.()?.toISOString() || null
      };
    });

    // Process links
    const links = linksSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null
      };
    });

    // Organization data
    const organization = orgDoc.exists ? {
      id: orgDoc.id,
      ...orgDoc.data(),
      createdAt: orgDoc.data()?.createdAt?.toDate?.()?.toISOString() || null
    } : null;

    // Project data
    const project = projectDoc.exists ? {
      id: projectDoc.id,
      ...projectDoc.data(),
      createdAt: projectDoc.data()?.createdAt?.toDate?.()?.toISOString() || null
    } : null;

    // Subscription data
    const subscription = subscriptionDoc.exists ? {
      ...subscriptionDoc.data(),
      currentPeriodStart: subscriptionDoc.data()?.currentPeriodStart?.toDate?.()?.toISOString() || null,
      currentPeriodEnd: subscriptionDoc.data()?.currentPeriodEnd?.toDate?.()?.toISOString() || null
    } : { planTier: 'free', status: 'inactive' };

    // All projects in the organization
    const allProjects = allProjectsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data()?.name || 'Unnamed Project',
      ...doc.data(),
      createdAt: doc.data()?.createdAt?.toDate?.()?.toISOString() || null
    }));

    console.log(`✅ SuperAdmin: Loaded ${videos.length} videos, ${accounts.length} accounts, ${links.length} links, ${allProjects.length} projects`);
    
    return res.status(200).json({
      success: true,
      data: {
        videos,
        accounts,
        links,
        organization,
        project,
        subscription,
        allProjects
      }
    });
  } catch (error) {
    console.error('❌ SuperAdmin dashboard-data error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data', details: String(error) });
  }
}

