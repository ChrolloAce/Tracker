import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

/**
 * Cleanup stuck processing videos and syncing accounts
 * - Videos stuck in "processing" status for > 5 minutes → set to "error"
 * - Accounts stuck in "pending" or "syncing" status for > 10 minutes → reset to idle
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🧹 [CLEANUP] Starting cleanup of stuck items...');
  
  try {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    const tenMinutesAgo = now - (10 * 60 * 1000);
    
    let stuckVideosCount = 0;
    let stuckAccountsCount = 0;
    
    // 🔥 CLEANUP STUCK VIDEOS
    console.log('🔍 [CLEANUP] Scanning for stuck videos...');
    
    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      const projectsSnapshot = await db.collection('organizations').doc(orgId).collection('projects').get();
      
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        
        // Find videos stuck in "processing" status
        const videosRef = db.collection('organizations').doc(orgId).collection('projects').doc(projectId).collection('videos');
        const stuckVideosQuery = await videosRef
          .where('status', '==', 'processing')
          .get();
        
        for (const videoDoc of stuckVideosQuery.docs) {
          const videoData = videoDoc.data();
          const syncRequestedAt = videoData.syncRequestedAt?.toMillis?.() || videoData.syncRequestedAt || 0;
          
          // If older than 5 minutes, mark as error
          if (syncRequestedAt && syncRequestedAt < fiveMinutesAgo) {
            console.log(`  ⚠️ [CLEANUP] Stuck video found: ${videoDoc.id} (requested ${Math.floor((now - syncRequestedAt) / 1000 / 60)} mins ago)`);
            
            await videoDoc.ref.update({
              status: 'active', // Set back to active
              syncStatus: 'error',
              syncError: 'Video processing timed out after 5 minutes',
              syncCompletedAt: FieldValue.serverTimestamp()
            });
            
            stuckVideosCount++;
          }
        }
      }
    }
    
    // 🔥 CLEANUP STUCK ACCOUNTS
    console.log('🔍 [CLEANUP] Scanning for stuck accounts...');
    
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      const projectsSnapshot = await db.collection('organizations').doc(orgId).collection('projects').get();
      
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        
        // Find accounts stuck in "pending" or "syncing" status
        const accountsRef = db.collection('organizations').doc(orgId).collection('projects').doc(projectId).collection('trackedAccounts');
        const stuckAccountsQuery = await accountsRef
          .where('isActive', '==', true)
          .get();
        
        for (const accountDoc of stuckAccountsQuery.docs) {
          const accountData = accountDoc.data();
          const lastSyncStarted = accountData.lastSyncStarted?.toMillis?.() || accountData.lastSyncStarted || 0;
          const syncStatus = accountData.syncStatus;
          
          // If stuck in pending/syncing for > 10 minutes, reset
          if ((syncStatus === 'pending' || syncStatus === 'syncing') && lastSyncStarted && lastSyncStarted < tenMinutesAgo) {
            console.log(`  ⚠️ [CLEANUP] Stuck account found: ${accountData.username} (syncing for ${Math.floor((now - lastSyncStarted) / 1000 / 60)} mins)`);
            
            await accountDoc.ref.update({
              syncStatus: 'idle',
              syncProgress: FieldValue.delete(),
              syncError: 'Account sync timed out after 10 minutes',
              lastSyncCompleted: FieldValue.serverTimestamp()
            });
            
            stuckAccountsCount++;
          }
        }
      }
    }
    
    console.log(`✅ [CLEANUP] Cleanup complete: ${stuckVideosCount} videos, ${stuckAccountsCount} accounts reset`);
    
    return res.status(200).json({
      success: true,
      cleaned: {
        videos: stuckVideosCount,
        accounts: stuckAccountsCount
      }
    });
    
  } catch (error: any) {
    console.error('❌ [CLEANUP] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

