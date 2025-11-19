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
    const ownerId = orgData?.ownerId || null; // Use null instead of undefined for Firestore
    
    // Get owner email for later email sending
    // CRITICAL: Must be scoped to THIS organization only
    let ownerEmail = null;
    
    if (ownerId) {
      // Method 1: Get email from members collection using ownerId
      const ownerMemberDoc = await db
        .collection('organizations')
        .doc(orgId)
        .collection('members')
        .doc(ownerId)
        .get();
      
      if (ownerMemberDoc.exists) {
        ownerEmail = ownerMemberDoc.data()?.email;
      }
    }
    
    // Fallback: Query by role if ownerId not found
    if (!ownerEmail) {
      const membersSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('members')
        .where('role', '==', 'owner')
        .limit(1)
        .get();
      
      ownerEmail = !membersSnapshot.empty 
        ? membersSnapshot.docs[0].data().email 
        : null;
    }
    
    console.log(`  👤 Owner ID: ${ownerId || 'Not found'}`);
    console.log(`  📧 Owner email: ${ownerEmail || 'Not found'}`);
    console.log(`  🏢 Org name: ${orgName}`);
    
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
    
    // Get previous completed session to calculate deltas
    console.log(`  🔍 Looking for previous refresh session...`);
    const previousSessionsSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('refreshSessions')
      .where('status', '==', 'completed')
      .orderBy('completedAt', 'desc')
      .limit(1)
      .get();
    
    let previousSession: any = null;
    let previousRefreshTimestamp: any = null;
    
    if (!previousSessionsSnapshot.empty) {
      previousSession = previousSessionsSnapshot.docs[0].data();
      previousRefreshTimestamp = previousSession.completedAt || previousSession.startedAt;
      const timeSinceLastRefresh = previousRefreshTimestamp 
        ? Math.round((Date.now() - previousRefreshTimestamp.toMillis()) / (1000 * 60))
        : null;
      console.log(`  ✅ Found previous session from ${timeSinceLastRefresh} minutes ago`);
    } else {
      console.log(`  ℹ️  No previous completed session found (first refresh)`);
    }
    
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
      ownerId,
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
      emailSent: false,
      manualTrigger: manual || false,
      // Store previous session data for delta calculations
      previousRefreshTimestamp: previousRefreshTimestamp || null,
      previousTotalViews: previousSession?.totalViews || 0,
      previousTotalLikes: previousSession?.totalLikes || 0,
      previousTotalComments: previousSession?.totalComments || 0,
      previousTotalShares: previousSession?.totalShares || 0,
      previousTotalLinkClicks: previousSession?.totalLinkClicks || 0
    });
    
    console.log(`  📝 Created session: ${sessionRef.id}`);
    
    // Dispatch project jobs - collect all promises to ensure they all fire
    const baseUrl = 'https://www.viewtrack.app';
    const dispatchPromises: Promise<void>[] = [];
    
    console.log(`\n  🚀 Starting project dispatches...`);
    
    for (let i = 0; i < projectsSnapshot.docs.length; i++) {
      const projectDoc = projectsSnapshot.docs[i];
      const projectId = projectDoc.id;
      const projectData = projectDoc.data();
      const projectName = projectData.name || 'Unnamed Project';
      
      // Find account count for this project
      const projectDetail = projectDetails.find(p => p.id === projectId);
      const accountCount = projectDetail?.accounts || 0;
      
      console.log(`  📤 [${i + 1}/${projectsSnapshot.size}] Dispatching "${projectName}" (${accountCount} accounts)`);
      
      // Create promise for this dispatch
      const dispatchPromise = fetch(`${baseUrl}/api/process-project`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orgId,
          projectId,
          sessionId: sessionRef.id,
          manual: manual || false
        })
      })
      .then(response => {
        if (response.ok) {
          console.log(`     ✅ "${projectName}" dispatched (HTTP ${response.status})`);
        } else {
          console.error(`     ❌ "${projectName}" failed: HTTP ${response.status}`);
        }
      })
      .catch(err => {
        console.error(`     ❌ "${projectName}" error:`, err.message);
      });
      
      dispatchPromises.push(dispatchPromise);
    }
    
    // Wait for all dispatches to be accepted (not completed, just accepted)
    console.log(`\n  ⏳ Ensuring all ${dispatchPromises.length} project dispatches fire...`);
    await Promise.allSettled(dispatchPromises);
    console.log(`  ✅ All project dispatches initiated`);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`  ✅ Organization complete: ${duration}s`);
    console.log(`  📤 Dispatched: ${dispatchPromises.length} project job(s)\n`);
    
    return res.status(200).json({
      success: true,
      orgId,
      sessionId: sessionRef.id,
      stats: {
        duration: parseFloat(duration),
        projectsDispatched: dispatchPromises.length,
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

