import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Sync actual resource counts to usage tracking
 * This script counts actual videos, accounts, links, and team members
 * and updates the usage document
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Firebase Admin
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore, Timestamp } = await import('firebase-admin/firestore');

    if (getApps().length === 0) {
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
      });
    }

    const db = getFirestore();
    const { orgId } = req.body;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }

    console.log(`🔄 Syncing usage counts for org: ${orgId}`);

    // Count tracked accounts across all projects
    let totalAccounts = 0;
    const projectsSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .get();

    for (const projectDoc of projectsSnapshot.docs) {
      const accountsSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectDoc.id)
        .collection('trackedAccounts')
        .where('isActive', '==', true)
        .get();
      
      totalAccounts += accountsSnapshot.size;
    }

    // Count tracked videos across all projects
    let totalVideos = 0;
    for (const projectDoc of projectsSnapshot.docs) {
      const videosSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectDoc.id)
        .collection('videos')
        .get();
      
      totalVideos += videosSnapshot.size;
    }

    // Count tracked links across all projects
    let totalLinks = 0;
    for (const projectDoc of projectsSnapshot.docs) {
      const linksSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectDoc.id)
        .collection('links')
        .where('isActive', '==', true)
        .get();
      
      totalLinks += linksSnapshot.size;
    }

    // Count team members
    const membersSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('members')
      .where('status', '==', 'active')
      .get();
    
    const totalMembers = membersSnapshot.size;

    console.log(`📊 Counts: ${totalAccounts} accounts, ${totalVideos} videos, ${totalLinks} links, ${totalMembers} members`);

    // Update usage document
    const usageRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('billing')
      .doc('usage');

    const usageDoc = await usageRef.get();
    const existingData = usageDoc.exists ? usageDoc.data() : {};

    await usageRef.set({
      trackedAccounts: totalAccounts,
      trackedVideos: totalVideos,
      trackedLinks: totalLinks,
      teamMembers: totalMembers,
      manualVideos: 0,
      manualCreators: 0,
      mcpCallsThisMonth: existingData?.mcpCallsThisMonth || 0,
      lastUpdated: Timestamp.now(),
      currentPeriodStart: existingData?.currentPeriodStart || Timestamp.now(),
      currentPeriodEnd: existingData?.currentPeriodEnd || Timestamp.fromDate(getNextMonthDate())
    }, { merge: true });

    console.log(`✅ Usage counts synced successfully`);

    res.json({
      success: true,
      counts: {
        trackedAccounts: totalAccounts,
        trackedVideos: totalVideos,
        trackedLinks: totalLinks,
        teamMembers: totalMembers
      }
    });

  } catch (error: any) {
    console.error('❌ Error syncing usage:', error);
    res.status(500).json({ 
      error: 'Failed to sync usage counts',
      message: error.message 
    });
  }
}

function getNextMonthDate(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date;
}

