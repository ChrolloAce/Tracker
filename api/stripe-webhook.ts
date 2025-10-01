import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

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
    event = stripe.webhooks.constructEvent(
      req.body,
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
    const { getFirestore } = await import('firebase-admin/firestore');

    if (getApps().length === 0) {
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
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
        await handleSubscriptionUpdate(db, event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(db, event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(db, event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(db, event.data.object as Stripe.Invoice);
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
 * Handle subscription creation/update
 */
async function handleSubscriptionUpdate(db: any, subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  
  // Find org by Stripe customer ID
  const orgsSnapshot = await db
    .collectionGroup('subscription')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (orgsSnapshot.empty) {
    console.error('No organization found for customer:', customerId);
    return;
  }

  const subDoc = orgsSnapshot.docs[0];
  const orgId = subDoc.ref.parent.parent.id;

  // Get plan tier from price ID
  const priceId = subscription.items.data[0].price.id;
  const planTier = getPlanTierFromPriceId(priceId);
  
  if (!planTier) {
    console.error('Unknown price ID:', priceId);
    return;
  }

  // Update subscription
  await subDoc.ref.update({
    planTier,
    status: subscription.status,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    updatedAt: new Date(),
  });

  console.log(`✅ Updated subscription for org ${orgId}`);
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(db: any, subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  const orgsSnapshot = await db
    .collectionGroup('subscription')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (orgsSnapshot.empty) return;

  const subDoc = orgsSnapshot.docs[0];
  
  await subDoc.ref.update({
    status: 'canceled',
    planTier: 'basic', // Downgrade to basic
    updatedAt: new Date(),
  });

  console.log('✅ Subscription canceled');
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(db: any, invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  const orgsSnapshot = await db
    .collectionGroup('subscription')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (orgsSnapshot.empty) return;

  const subDoc = orgsSnapshot.docs[0];
  
  // Reset monthly usage counters on payment
  await subDoc.ref.update({
    status: 'active',
    'usage.mcpCalls': 0,
    'usage.lastReset': new Date(),
    updatedAt: new Date(),
  });

  console.log('✅ Payment succeeded, usage reset');
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(db: any, invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  const orgsSnapshot = await db
    .collectionGroup('subscription')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (orgsSnapshot.empty) return;

  const subDoc = orgsSnapshot.docs[0];
  
  await subDoc.ref.update({
    status: 'past_due',
    updatedAt: new Date(),
  });

  console.log('❌ Payment failed');
}

/**
 * Map Stripe price ID to plan tier
 */
function getPlanTierFromPriceId(priceId: string): string | null {
  // These should match your actual Stripe price IDs
  const priceMap: Record<string, string> = {
    [process.env.VITE_STRIPE_BASIC_MONTHLY || 'price_basic_monthly']: 'basic',
    [process.env.VITE_STRIPE_BASIC_YEARLY || 'price_basic_yearly']: 'basic',
    [process.env.VITE_STRIPE_PRO_MONTHLY || 'price_pro_monthly']: 'pro',
    [process.env.VITE_STRIPE_PRO_YEARLY || 'price_pro_yearly']: 'pro',
    [process.env.VITE_STRIPE_ULTRA_MONTHLY || 'price_ultra_monthly']: 'ultra',
    [process.env.VITE_STRIPE_ULTRA_YEARLY || 'price_ultra_yearly']: 'ultra',
  };

  return priceMap[priceId] || null;
}

// Disable body parsing for webhook
export const config = {
  api: {
    bodyParser: false,
  },
};

