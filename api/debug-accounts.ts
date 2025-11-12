import { VercelRequest, VercelResponse } from '@vercel/node';
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
 * Debug endpoint to check what accounts actually exist
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const results: any = {};

    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      const orgData = orgDoc.data();
      
      results[orgId] = {
        name: orgData.name || 'Unknown',
        projects: {}
      };

      // Get all projects
      const projectsSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .get();

      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        const projectData = projectDoc.data();
        
        // Get ALL accounts (no filter)
        const allAccountsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('trackedAccounts')
          .get();

        // Get accounts with status == 'active'
        const activeAccountsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('trackedAccounts')
          .where('status', '==', 'active')
          .get();

        const accountsList = allAccountsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            username: data.username,
            platform: data.platform,
            status: data.status || 'NO STATUS FIELD',
            hasStatus: 'status' in data
          };
        });

        results[orgId].projects[projectId] = {
          name: projectData.name || projectId,
          totalAccounts: allAccountsSnapshot.size,
          activeAccounts: activeAccountsSnapshot.size,
          accounts: accountsList
        };
      }
    }

    return res.status(200).json({
      success: true,
      totalOrgs: orgsSnapshot.size,
      data: results
    });

  } catch (error: any) {
    console.error('Debug error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

