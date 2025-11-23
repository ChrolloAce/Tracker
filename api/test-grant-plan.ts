import type { VercelRequest, VercelResponse} from '@vercel/node';

/**
 * TEST MODE ONLY - Grant subscription plan without Stripe
 * 
 * This endpoint bypasses Stripe and directly grants a subscription plan.
 * Used for testing pending accounts activation and other subscription features.
 * 
 * SECURITY: Only works for demo account (001ernestolopez@gmail.com)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Firebase Admin
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
    const { getAuth } = await import('firebase-admin/auth');

    // Initialize Firebase if not already initialized
    if (getApps().length === 0) {
      const serviceAccountKey = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 || '', 'base64').toString('utf-8')
      );

      initializeApp({
        credential: cert(serviceAccountKey),
      });
    }

    const db = getFirestore();
    const adminAuth = getAuth();

    // Get request body
    const { orgId, planTier = 'basic', userId } = req.body;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // SECURITY: Verify this is the demo account
    const userRecord = await adminAuth.getUser(userId);
    const userEmail = userRecord.email?.toLowerCase();

    if (userEmail !== '001ernestolopez@gmail.com') {
      console.error(`⚠️ [TEST GRANT] Unauthorized attempt by: ${userEmail}`);
      return res.status(403).json({ 
        error: 'Test mode only available for demo account (001ernestolopez@gmail.com)' 
      });
    }

    console.log('');
    console.log('🧪 [TEST GRANT] ========================================');
    console.log('🧪 [TEST GRANT] GRANTING TEST SUBSCRIPTION');
    console.log('🧪 [TEST GRANT] ========================================');
    console.log(`   User: ${userEmail}`);
    console.log(`   Org: ${orgId}`);
    console.log(`   Plan: ${planTier}`);

    // Set subscription period (30 days from now)
    const now = new Date();
    const periodStart = Timestamp.fromDate(now);
    const periodEnd = Timestamp.fromDate(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));

    // Update subscription document
    const subRef = db.collection('organizations').doc(orgId).collection('billing').doc('subscription');
    
    await subRef.set({
      planTier,
      status: 'active',
      stripeSubscriptionId: `test_${Date.now()}`,
      stripePriceId: `test_price_${planTier}`,
      stripeCustomerId: `test_customer_${orgId}`,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      trialEnd: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      testMode: true
    });

    console.log(`✅ [TEST GRANT] Subscription updated to ${planTier}`);
    console.log(`   Period: ${periodStart.toDate().toISOString()} → ${periodEnd.toDate().toISOString()}`);

    // Check for pending onboarding accounts and activate them
    console.log('');
    console.log('🎯 [TEST GRANT] Checking for pending onboarding accounts...');
    
    const pendingAccountsRef = db.collection('pendingOnboardingAccounts')
      .where('orgId', '==', orgId)
      .where('status', '==', 'pending');
    
    const pendingSnapshot = await pendingAccountsRef.get();
    
    if (pendingSnapshot.empty) {
      console.log('ℹ️ [TEST GRANT] No pending accounts found');
    } else {
      console.log(`📦 [TEST GRANT] Found ${pendingSnapshot.size} pending accounts to activate`);
      
      let activated = 0;
      let failed = 0;
      
      for (const doc of pendingSnapshot.docs) {
        const account = doc.data();
        
        try {
          console.log(`\n🔄 [TEST GRANT] Activating @${account.username} (${account.platform})`);
          console.log(`   Max videos: ${account.maxVideos}`);
          console.log(`   Project: ${account.projectId}`);
          
          // Create the tracked account in the main collection
          const accountRef = db.collection('organizations')
            .doc(orgId)
            .collection('projects')
            .doc(account.projectId)
            .collection('trackedAccounts')
            .doc();
          
          await accountRef.set({
            username: account.username,
            platform: account.platform,
            accountType: account.accountType || 'my',
            isActive: true,
            maxVideos: account.maxVideos || 100,
            creatorType: 'automatic',
            displayName: account.username,
            profilePicture: '',
            followerCount: 0,
            followingCount: 0,
            postCount: 0,
            bio: '',
            isVerified: false,
            syncStatus: 'pending',
            totalVideos: 0,
            totalViews: 0,
            totalLikes: 0,
            totalComments: 0,
            totalShares: 0,
            dateAdded: Timestamp.now(),
            addedBy: account.userId
          });
          
          console.log(`✅ [TEST GRANT] Account created with ID: ${accountRef.id}`);
          
          // Queue for sync
          const jobRef = db.collection('syncQueue').doc();
          await jobRef.set({
            accountId: accountRef.id,
            orgId: orgId,
            projectId: account.projectId,
            username: account.username,
            platform: account.platform,
            priority: 'high',
            syncStrategy: 'progressive',
            maxVideos: account.maxVideos,
            status: 'queued',
            createdAt: Timestamp.now(),
            createdBy: account.userId,
            capturedBy: 'test_mode_activation'
          });
          
          console.log(`✅ [TEST GRANT] Queued for sync (Job ID: ${jobRef.id})`);
          
          // Delete from pending collection
          await doc.ref.delete();
          console.log(`🗑️ [TEST GRANT] Removed from pending collection`);
          
          activated++;
          
        } catch (error: any) {
          console.error(`❌ [TEST GRANT] Failed to activate @${account.username}:`, error);
          failed++;
        }
      }
      
      console.log('');
      console.log('✅ [TEST GRANT] ========================================');
      console.log(`✅ [TEST GRANT] ACTIVATION COMPLETE`);
      console.log(`   ✓ Activated: ${activated}`);
      console.log(`   ✗ Failed: ${failed}`);
      console.log('✅ [TEST GRANT] ========================================');
      console.log('');
    }

    return res.status(200).json({
      success: true,
      message: `Test subscription granted: ${planTier}`,
      planTier,
      orgId,
      expiresAt: periodEnd.toDate().toISOString(),
      pendingAccountsActivated: pendingSnapshot.size,
      testMode: true
    });

  } catch (error: any) {
    console.error('❌ [TEST GRANT] Error:', error);
    return res.status(500).json({
      error: 'Failed to grant test subscription',
      message: error.message
    });
  }
}

