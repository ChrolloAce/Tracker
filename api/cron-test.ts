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
 * Manual Cron Test Endpoint
 * Triggers a lightweight refresh by calling sync-single-account for a few accounts
 * 
 * Usage: GET https://your-app.vercel.app/api/cron-test
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🧪 Manual cron test triggered');
    
    const cronSecret = process.env.CRON_SECRET;
    const baseUrl = 'https://www.viewtrack.app';
    
    // Get the first organization with accounts
    const orgsSnapshot = await db.collection('organizations').limit(1).get();
    
    if (orgsSnapshot.empty) {
      return res.status(200).json({
        success: true,
        message: 'No organizations found to test',
        accountsTriggered: 0
      });
    }
    
    const orgDoc = orgsSnapshot.docs[0];
    const orgId = orgDoc.id;
    console.log(`📁 Testing with organization: ${orgId}`);
    
    // Get the first project
    const projectsSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .limit(1)
      .get();
    
    if (projectsSnapshot.empty) {
      return res.status(200).json({
        success: true,
        message: 'No projects found to test',
        accountsTriggered: 0
      });
    }
    
    const projectDoc = projectsSnapshot.docs[0];
    const projectId = projectDoc.id;
    console.log(`  📂 Testing with project: ${projectId}`);
    
    // Get up to 3 accounts to test
    const accountsSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('trackedAccounts')
      .where('isActive', '==', true)
      .limit(3)
      .get();
    
    if (accountsSnapshot.empty) {
      return res.status(200).json({
        success: true,
        message: 'No active accounts found to test',
        accountsTriggered: 0
      });
    }
    
    console.log(`  👥 Found ${accountsSnapshot.size} account(s) to refresh`);
    
    // Trigger refreshes
    const dispatchPromises = accountsSnapshot.docs.map(async (accountDoc) => {
      const accountData = accountDoc.data();
      console.log(`    ⚡ Dispatching @${accountData.username}`);
      
      try {
        const response = await fetch(`${baseUrl}/api/sync-single-account`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cronSecret}`
          },
          body: JSON.stringify({
            accountId: accountDoc.id,
            orgId: orgId,
            projectId: projectId
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`      ✅ @${accountData.username}: Success`);
          return { success: true, username: accountData.username };
        } else {
          console.error(`      ❌ @${accountData.username}: ${response.status}`);
          return { success: false, username: accountData.username, error: response.status };
        }
      } catch (error: any) {
        console.error(`      ❌ @${accountData.username}: ${error.message}`);
        return { success: false, username: accountData.username, error: error.message };
      }
    });
    
    const results = await Promise.all(dispatchPromises);
    const successful = results.filter(r => r.success).length;
    
    return res.status(200).json({
      success: true,
      message: 'Test refresh triggered',
      accountsTriggered: accountsSnapshot.size,
      accountsSuccessful: successful,
      results: results
    });
    
  } catch (error: any) {
    console.error('❌ Cron test failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Test failed',
      timestamp: new Date().toISOString()
    });
  }
}

