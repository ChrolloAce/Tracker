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

  // Update subscription
  await org.subRef.update({
    planTier,
    status: subscription.status,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId,
    stripeCustomerId: customerId,
    currentPeriodStart: Timestamp.fromMillis(subscription.current_period_start * 1000),
    currentPeriodEnd: Timestamp.fromMillis(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    trialEnd: subscription.trial_end ? Timestamp.fromMillis(subscription.trial_end * 1000) : null,
    updatedAt: Timestamp.now(),
  });

  console.log(`✅ SUCCESS: Updated subscription for org ${org.orgId} to ${planTier} (${subscription.status})`);
  console.log(`✅ Subscription expires: ${new Date(subscription.current_period_end * 1000).toISOString()}`);
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
