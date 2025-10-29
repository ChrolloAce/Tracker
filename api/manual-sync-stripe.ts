import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

/**
 * Manual endpoint to sync a Stripe subscription to Firebase
 * Use this to debug when webhooks aren't working
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subscriptionId } = req.body;

  if (!subscriptionId) {
    return res.status(400).json({ error: 'Missing subscriptionId' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-11-20.acacia',
    });

    // Fetch subscription from Stripe
    console.log('📡 Fetching subscription from Stripe:', subscriptionId);
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    console.log('✅ Subscription retrieved:', {
      id: subscription.id,
      customer: subscription.customer,
      status: subscription.status,
      priceId: subscription.items.data[0].price.id,
    });

    // Initialize Firebase
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    if (getApps().length === 0) {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');

      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        } as any),
      });
    }

    const db = getFirestore();
    const customerId = subscription.customer as string;

    // Find organization
    console.log('🔍 Finding organization for customer:', customerId);
    const orgsSnapshot = await db
      .collectionGroup('subscription')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();

    if (orgsSnapshot.empty) {
      return res.status(404).json({ 
        error: 'No organization found for customer',
        customerId 
      });
    }

    const subDoc = orgsSnapshot.docs[0];
    const orgId = subDoc.ref.parent.parent!.id;
    
    console.log('✅ Found organization:', orgId);

    // Get plan tier from price ID
    const priceId = subscription.items.data[0].price.id;
    const planTier = getPlanTierFromPriceId(priceId);

    if (!planTier) {
      return res.status(400).json({
        error: 'Unknown price ID',
        priceId,
        availablePriceIds: {
          basicMonthly: process.env.VITE_STRIPE_BASIC_MONTHLY || process.env.STRIPE_BASIC_MONTHLY,
          proMonthly: process.env.VITE_STRIPE_PRO_MONTHLY || process.env.STRIPE_PRO_MONTHLY,
          ultraMonthly: process.env.VITE_STRIPE_ULTRA_MONTHLY || process.env.STRIPE_ULTRA_MONTHLY,
        }
      });
    }

    console.log('📝 Updating Firebase with plan:', planTier);

    // Update subscription
    await subDoc.ref.update({
      planTier,
      status: subscription.status,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      updatedAt: new Date(),
    });

    console.log('✅ Firebase updated successfully!');

    res.json({
      success: true,
      orgId,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        planTier,
        priceId,
      }
    });
  } catch (error: any) {
    console.error('❌ Manual sync failed:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}

function getPlanTierFromPriceId(priceId: string): string | null {
  const priceMap: Record<string, string> = {
    [process.env.VITE_STRIPE_BASIC_MONTHLY || process.env.STRIPE_BASIC_MONTHLY || '']: 'basic',
    [process.env.VITE_STRIPE_BASIC_YEARLY || process.env.STRIPE_BASIC_YEARLY || '']: 'basic',
    [process.env.VITE_STRIPE_PRO_MONTHLY || process.env.STRIPE_PRO_MONTHLY || '']: 'pro',
    [process.env.VITE_STRIPE_PRO_YEARLY || process.env.STRIPE_PRO_YEARLY || '']: 'pro',
    [process.env.VITE_STRIPE_ULTRA_MONTHLY || process.env.STRIPE_ULTRA_MONTHLY || '']: 'ultra',
    [process.env.VITE_STRIPE_ULTRA_YEARLY || process.env.STRIPE_ULTRA_YEARLY || '']: 'ultra',
  };

  return priceMap[priceId] || null;
}

