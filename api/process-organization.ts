import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
function initializeFirebase() {
  if (!getApps().length) {
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
  }
  return getFirestore();
}

/**
 * Process Organization
 * 
 * Receives organization ID from orchestrator and:
 * 1. Creates a refresh session for tracking
 * 2. Finds all projects in the organization
 * 3. Counts total accounts across all projects
 * 4. Dispatches project jobs (fire-and-forget)
 * 5. Returns immediately
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  try {
    const db = initializeFirebase();
    
    // Verify authorization
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized organization processor request');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { orgId, manual } = req.body;
    
    if (!orgId) {
      return res.status(400).json({ error: 'Missing required field: orgId' });
    }
    
    console.log(`\n🏢 Processing organization: ${orgId}${manual ? ' [MANUAL]' : ' [SCHEDULED]'}`);
    
    // Get organization data
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    const orgData = orgDoc.data();
    const orgName = orgData?.name || 'Your Organization';
    
    // Get owner email for later email sending
    const membersSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('members')
      .where('role', '==', 'owner')
      .limit(1)
      .get();
    
    const ownerEmail = !membersSnapshot.empty 
      ? membersSnapshot.docs[0].data().email 
      : null;
    
    console.log(`  📧 Owner email: ${ownerEmail || 'Not found'}`);
    
    // Get all projects
    const projectsSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .get();
    
    console.log(`  📂 Found ${projectsSnapshot.size} project(s)`);
    
    if (projectsSnapshot.empty) {
      console.log(`  ⏭️  No projects to process`);
      return res.status(200).json({
        success: true,
        message: 'No projects in organization',
        orgId
      });
    }
    
      // Log project names and account counts for visibility
      console.log(`  📋 Projects with account counts:`);
      let totalAccounts = 0;
      const projectDetails: { name: string; id: string; accounts: number }[] = [];
      
      for (const projectDoc of projectsSnapshot.docs) {
        const projectData = projectDoc.data();
        const projectName = projectData.name || 'Unnamed Project';
        
        const accountsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectDoc.id)
          .collection('trackedAccounts')
          .where('isActive', '==', true)
          .get();
        
        const accountCount = accountsSnapshot.size;
        totalAccounts += accountCount;
        
        projectDetails.push({
          name: projectName,
          id: projectDoc.id,
          accounts: accountCount
        });
        
        console.log(`    - ${projectName} (${projectDoc.id}): ${accountCount} account(s)`);
      }
      
      console.log(`  👥 Total accounts: ${totalAccounts}`);
    
    // Create refresh session for tracking progress
    const sessionRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('refreshSessions')
      .doc();
    
    await sessionRef.set({
      id: sessionRef.id,
      orgId,
      orgName,
      startedAt: Timestamp.now(),
      status: 'dispatching',
      totalProjects: projectsSnapshot.size,
      completedProjects: 0,
      totalAccounts,
      completedAccounts: 0,
      totalVideos: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalLinkClicks: 0,
      accountStats: {},
      ownerEmail,
      emailSent: false
    });
    
    console.log(`  📝 Created session: ${sessionRef.id}`);
    
    // Dispatch project jobs (fire-and-forget)
    const baseUrl = 'https://www.viewtrack.app';
    let dispatchedCount = 0;
    
    console.log(`\n  🚀 Starting project dispatches...`);
    
    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id;
      const projectData = projectDoc.data();
      const projectName = projectData.name || 'Unnamed Project';
      
      // Find account count for this project
      const projectDetail = projectDetails.find(p => p.id === projectId);
      const accountCount = projectDetail?.accounts || 0;
      
      console.log(`  📤 [${dispatchedCount + 1}/${projectsSnapshot.size}] Dispatching "${projectName}" (${accountCount} accounts)`);
      
      fetch(`${baseUrl}/api/process-project`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orgId,
          projectId,
          sessionId: sessionRef.id,
          manual: manual || false // Pass manual flag
        })
      }).then(response => {
        if (response.ok) {
          console.log(`     ✅ "${projectName}" dispatched successfully (HTTP ${response.status})`);
        } else {
          console.error(`     ❌ "${projectName}" dispatch failed: ${response.status} ${response.statusText}`);
        }
      }).catch(err => {
        console.error(`     ❌ "${projectName}" dispatch error:`, err.message);
      });
      
      dispatchedCount++;
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`  ✅ Organization complete: ${duration}s`);
    console.log(`  📤 Dispatched: ${dispatchedCount} project job(s)\n`);
    
    return res.status(200).json({
      success: true,
      orgId,
      sessionId: sessionRef.id,
      stats: {
        duration: parseFloat(duration),
        projectsDispatched: dispatchedCount,
        totalAccounts
      }
    });
    
  } catch (error: any) {
    console.error(`❌ Organization processor error:`, error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

