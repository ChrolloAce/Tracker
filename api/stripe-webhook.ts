import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Disable body parsing for webhook
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Stripe webhook handler for subscription events
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    // Get raw body for signature verification
    const rawBody = await buffer(req);
    
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      webhookSecret
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    // Initialize Firebase Admin
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore, Timestamp } = await import('firebase-admin/firestore');

    if (getApps().length === 0) {
      // Handle private key - replace both \\n and literal \n with actual newlines
      let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
      
      // Remove quotes if they exist
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      
      // Replace escaped newlines with actual newlines
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

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(db, event.data.object as Stripe.Subscription, Timestamp);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(db, event.data.object as Stripe.Subscription, Timestamp);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(db, event.data.object as Stripe.Invoice, Timestamp);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(db, event.data.object as Stripe.Invoice, Timestamp);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

/**
 * Helper: Find organization by Stripe customer ID
 */
async function findOrgByCustomerId(db: any, customerId: string): Promise<{ orgId: string; subRef: any } | null> {
  console.log(`🔍 Looking for org with Stripe customer ID: ${customerId}`);
  
  const orgsSnapshot = await db.collection('organizations').get();
  
  for (const orgDoc of orgsSnapshot.docs) {
    const subDoc = await db
      .collection('organizations')
      .doc(orgDoc.id)
      .collection('billing')
      .doc('subscription')
      .get();
    
    if (subDoc.exists && subDoc.data()?.stripeCustomerId === customerId) {
      console.log(`✅ Found organization: ${orgDoc.id}`);
      return {
        orgId: orgDoc.id,
        subRef: subDoc.ref
      };
    }
  }
  
  console.error(`❌ No organization found for customer: ${customerId}`);
  return null;
}

/**
 * Handle subscription creation/update
 */
async function handleSubscriptionUpdate(db: any, subscription: Stripe.Subscription, Timestamp: any) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  
  const org = await findOrgByCustomerId(db, customerId);
  if (!org) return;

  // Get plan tier from price ID
  const priceId = subscription.items.data[0].price.id;
  console.log(`🔍 Processing subscription update for customer ${customerId}, price ID: ${priceId}`);
  
  const planTier = getPlanTierFromPriceId(priceId);
  
  if (!planTier) {
    console.error('❌ CRITICAL: Unknown price ID:', priceId);
    console.error('❌ Subscription update FAILED - plan tier not recognized');
    return;
  }

  console.log(`📝 Updating Firebase for org ${org.orgId}: ${planTier} (${subscription.status})`);
  
  // Handle incomplete subscriptions (payment processing)
  if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') {
    console.log('⏳ Subscription is incomplete - payment still processing');
    
    // Check if org already has this subscription upgraded (webhooks can arrive out of order)
    const currentData = (await org.subRef.get()).data();
    const currentPlan = currentData?.planTier || 'free';
    const currentSubId = currentData?.stripeSubscriptionId;
    
    // If this is the SAME subscription and already upgraded, don't downgrade!
    if (currentSubId === subscriptionId && currentPlan !== 'free') {
      console.log(`⚠️ Subscription ${subscriptionId} already upgraded to ${currentPlan} - ignoring incomplete status (webhook out of order)`);
      await org.subRef.update({
        status: subscription.status,
        updatedAt: Timestamp.now(),
      });
      return;
    }
    
    // Otherwise, keep on free until payment completes
    await org.subRef.update({
      planTier: 'free',
      status: subscription.status,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      stripeCustomerId: customerId,
      updatedAt: Timestamp.now(),
    });
    console.log('⏳ Subscription marked as incomplete - will upgrade when payment completes');
    return;
  }
  
  // Get period timestamps - check both top level and items array
  let periodStartSeconds = subscription.current_period_start;
  let periodEndSeconds = subscription.current_period_end;
  
  // If not at top level, check in items array
  if (!periodStartSeconds && subscription.items?.data?.[0]) {
    periodStartSeconds = subscription.items.data[0].current_period_start;
    periodEndSeconds = subscription.items.data[0].current_period_end;
    console.log('📅 Using period from subscription item');
  }
  
  console.log(`📅 Period: ${periodStartSeconds} -> ${periodEndSeconds}`);
  
  // Validate we have timestamps
  if (!periodStartSeconds || !periodEndSeconds) {
    console.error('❌ Missing period timestamps in both subscription and items');
    console.error('Subscription status:', subscription.status);
    console.error('Has items:', !!subscription.items?.data?.[0]);
    return;
  }

  // Create timestamps safely - Stripe gives Unix timestamps in SECONDS
  const periodStart = Timestamp.fromDate(new Date(periodStartSeconds * 1000));
  const periodEnd = Timestamp.fromDate(new Date(periodEndSeconds * 1000));
  const trialEnd = subscription.trial_end ? Timestamp.fromDate(new Date(subscription.trial_end * 1000)) : null;

  // Update subscription
  await org.subRef.update({
    planTier,
    status: subscription.status,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId,
    stripeCustomerId: customerId,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    trialEnd: trialEnd,
    updatedAt: Timestamp.now(),
  });

  console.log(`✅ SUCCESS: Updated subscription for org ${org.orgId} to ${planTier} (${subscription.status})`);
  console.log(`✅ Subscription expires: ${periodEnd.toDate().toISOString()}`);
  
  // If subscription is now active, activate any pending onboarding accounts
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    console.log('');
    console.log('🎯 [PENDING ACCOUNTS] Checking for pending onboarding accounts...');
    try {
      await activatePendingAccountsAfterPayment(db, org.orgId, Timestamp);
    } catch (activationError) {
      console.error('❌ [PENDING ACCOUNTS] Failed to activate pending accounts:', activationError);
      // Don't fail the webhook - subscription is still updated
    }
  }
}

/**
 * Activate pending accounts after successful payment
 */
async function activatePendingAccountsAfterPayment(db: any, orgId: string, Timestamp: any) {
  try {
    console.log(`🔍 [PENDING ACCOUNTS] Looking for pending accounts in org: ${orgId}`);
    
    // Get all pending accounts for this org
    const pendingAccountsRef = db.collection('pendingOnboardingAccounts')
      .where('orgId', '==', orgId)
      .where('status', '==', 'pending');
    
    const pendingSnapshot = await pendingAccountsRef.get();
    
    if (pendingSnapshot.empty) {
      console.log('ℹ️ [PENDING ACCOUNTS] No pending accounts found');
      return;
    }
    
    console.log(`📦 [PENDING ACCOUNTS] Found ${pendingSnapshot.size} pending accounts to activate`);
    
    let activated = 0;
    let failed = 0;
    
    for (const doc of pendingSnapshot.docs) {
      const account = doc.data();
      
      try {
        console.log(`\n🔄 [PENDING ACCOUNTS] Activating @${account.username} (${account.platform})`);
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
        
        console.log(`✅ [PENDING ACCOUNTS] Account created with ID: ${accountRef.id}`);
        
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
          capturedBy: 'post_payment_activation'
        });
        
        console.log(`✅ [PENDING ACCOUNTS] Queued for sync (Job ID: ${jobRef.id})`);
        
        // Delete from pending collection
        await doc.ref.delete();
        console.log(`🗑️ [PENDING ACCOUNTS] Removed from pending collection`);
        
        activated++;
        
      } catch (error) {
        console.error(`❌ [PENDING ACCOUNTS] Failed to activate @${account.username}:`, error);
        failed++;
      }
    }
    
    console.log('');
    console.log('✅ [PENDING ACCOUNTS] ========================================');
    console.log(`✅ [PENDING ACCOUNTS] ACTIVATION COMPLETE`);
    console.log(`   ✓ Activated: ${activated}`);
    console.log(`   ✗ Failed: ${failed}`);
    console.log('✅ [PENDING ACCOUNTS] ========================================');
    console.log('');
    
  } catch (error) {
    console.error('❌ [PENDING ACCOUNTS] Failed during activation:', error);
    throw error;
  }
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(db: any, subscription: Stripe.Subscription, Timestamp: any) {
  const customerId = subscription.customer as string;
  
  const org = await findOrgByCustomerId(db, customerId);
  if (!org) return;
  
  await org.subRef.update({
    status: 'canceled',
    planTier: 'basic', // Downgrade to basic
    updatedAt: Timestamp.now(),
  });

  console.log('✅ Subscription canceled');
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(db: any, invoice: Stripe.Invoice, Timestamp: any) {
  const customerId = invoice.customer as string;
  
  const org = await findOrgByCustomerId(db, customerId);
  if (!org) return;
  
  // Reset monthly usage counters on payment
  await org.subRef.update({
    status: 'active',
    'usage.mcpCalls': 0,
    'usage.lastReset': Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  console.log('✅ Payment succeeded, usage reset');
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(db: any, invoice: Stripe.Invoice, Timestamp: any) {
  const customerId = invoice.customer as string;
  
  const org = await findOrgByCustomerId(db, customerId);
  if (!org) return;
  
  await org.subRef.update({
    status: 'past_due',
    updatedAt: Timestamp.now(),
  });

  console.log('❌ Payment failed');
}

/**
 * Map Stripe price ID to plan tier
 */
function getPlanTierFromPriceId(priceId: string): string | null {
  // Try both with and without VITE_ prefix (for backend compatibility)
  const priceMap: Record<string, string> = {
    // Basic plan
    [process.env.VITE_STRIPE_BASIC_MONTHLY || process.env.STRIPE_BASIC_MONTHLY || 'price_basic_monthly']: 'basic',
    [process.env.VITE_STRIPE_BASIC_YEARLY || process.env.STRIPE_BASIC_YEARLY || 'price_basic_yearly']: 'basic',
    // Pro plan
    [process.env.VITE_STRIPE_PRO_MONTHLY || process.env.STRIPE_PRO_MONTHLY || 'price_pro_monthly']: 'pro',
    [process.env.VITE_STRIPE_PRO_YEARLY || process.env.STRIPE_PRO_YEARLY || 'price_pro_yearly']: 'pro',
    // Ultra plan
    [process.env.VITE_STRIPE_ULTRA_MONTHLY || process.env.STRIPE_ULTRA_MONTHLY || 'price_ultra_monthly']: 'ultra',
    [process.env.VITE_STRIPE_ULTRA_YEARLY || process.env.STRIPE_ULTRA_YEARLY || 'price_ultra_yearly']: 'ultra',
  };

  const tier = priceMap[priceId];
  
  if (!tier) {
    console.error('❌ Unknown price ID:', priceId);
    console.error('📋 Available price IDs:', Object.keys(priceMap).filter(k => k !== 'price_basic_monthly' && k !== 'price_basic_yearly' && k !== 'price_pro_monthly' && k !== 'price_pro_yearly' && k !== 'price_ultra_monthly' && k !== 'price_ultra_yearly'));
  }
  
  return tier || null;
}
