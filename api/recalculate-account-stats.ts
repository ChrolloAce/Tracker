import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { setCorsHeaders, handleCorsPreFlight } from './utils/cors.js';
import { authenticateAndVerifyOrg } from './utils/auth.js';

function initializeFirebase() {
  if (require('firebase-admin').apps.length === 0) {
    require('firebase-admin').initializeApp({
      credential: require('firebase-admin').credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
  }
  return getFirestore();
}

/**
 * Recalculate Account Stats
 * 
 * Manually recalculates totalVideos, totalViews, totalLikes, totalComments, totalShares
 * for one or all accounts by querying actual video data.
 * 
 * Use this when account stats are out of sync.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return handleCorsPreFlight(res);
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const db = initializeFirebase();
  const startTime = Date.now();
  
  try {
    const { orgId, projectId, accountId } = req.body;
    
    if (!orgId || !projectId) {
      return res.status(400).json({ error: 'Missing required fields: orgId, projectId' });
    }
    
    // Authenticate
    const { user } = await authenticateAndVerifyOrg(req, orgId);
    console.log(`🔒 Authenticated user ${user.userId} for stats recalculation`);
    
    let accountsToRecalculate: any[] = [];
    
    // If specific accountId provided, only recalculate that one
    if (accountId) {
      console.log(`📊 Recalculating stats for single account: ${accountId}`);
      const accountDoc = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .doc(accountId)
        .get();
      
      if (!accountDoc.exists) {
        return res.status(404).json({ error: 'Account not found' });
      }
      
      accountsToRecalculate = [{ id: accountDoc.id, ...accountDoc.data() }];
    } else {
      // Recalculate ALL accounts in project
      console.log(`📊 Recalculating stats for ALL accounts in project ${projectId}`);
      const accountsSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .get();
      
      accountsToRecalculate = accountsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }
    
    console.log(`📊 Processing ${accountsToRecalculate.length} account(s)...`);
    
    const results: any[] = [];
    
    for (const account of accountsToRecalculate) {
      try {
        console.log(`\n📊 Recalculating stats for @${account.username} (${account.platform})...`);
        
        // Get all videos for this account
        const videosSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('videos')
          .where('trackedAccountId', '==', account.id)
          .get();
        
        const videos = videosSnapshot.docs.map(doc => doc.data());
        
        // Calculate totals
        const totalVideos = videos.length;
        const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
        const totalLikes = videos.reduce((sum, v) => sum + (v.likes || 0), 0);
        const totalComments = videos.reduce((sum, v) => sum + (v.comments || 0), 0);
        const totalShares = videos.reduce((sum, v) => sum + (v.shares || 0), 0);
        
        // Update account
        await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('trackedAccounts')
          .doc(account.id)
          .update({
            totalVideos,
            totalViews,
            totalLikes,
            totalComments,
            totalShares
          });
        
        console.log(`   ✅ Updated @${account.username}: ${totalVideos} videos, ${totalViews.toLocaleString()} views`);
        
        results.push({
          accountId: account.id,
          username: account.username,
          platform: account.platform,
          before: {
            totalVideos: account.totalVideos || 0,
            totalViews: account.totalViews || 0
          },
          after: {
            totalVideos,
            totalViews,
            totalLikes,
            totalComments,
            totalShares
          }
        });
        
      } catch (error: any) {
        console.error(`❌ Failed to recalculate stats for account ${account.id}:`, error.message);
        results.push({
          accountId: account.id,
          username: account.username,
          error: error.message
        });
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Stats recalculation complete: ${results.length} accounts in ${duration}s`);
    
    return res.status(200).json({
      success: true,
      message: `Recalculated stats for ${results.length} account(s)`,
      duration: parseFloat(duration),
      results
    });
    
  } catch (error: any) {
    console.error('❌ Stats recalculation failed:', error);
    return res.status(500).json({
      error: 'Failed to recalculate stats',
      message: error.message
    });
  }
}

