import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { getFrontendUrl } from './utils/base-url.js';

/**
 * Create a Stripe Checkout session
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if Stripe is configured
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ 
      error: 'Stripe not configured',
      message: 'Please add STRIPE_SECRET_KEY to environment variables'
    });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-11-20.acacia',
  });

  const { orgId, planTier, billingCycle } = req.body;

  if (!orgId || !planTier || !billingCycle) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log('Creating checkout for:', { orgId, planTier, billingCycle });

    // Get price ID based on plan and billing cycle
    const priceId = getPriceId(planTier, billingCycle);
    console.log('Price ID:', priceId);

    if (!priceId) {
      const viteKey = `VITE_STRIPE_${planTier.toUpperCase()}_${billingCycle.toUpperCase()}`;
      const regularKey = `STRIPE_${planTier.toUpperCase()}_${billingCycle.toUpperCase()}`;
      console.error('No price ID found for:', planTier, billingCycle);
      console.error('Looked for env vars:', viteKey, 'or', regularKey);
      console.error('Available STRIPE env vars:', Object.keys(process.env).filter(k => k.includes('STRIPE')));
      return res.status(400).json({ 
        error: `Missing Stripe Price ID for ${planTier} ${billingCycle}`,
        details: `Please set ${viteKey} or ${regularKey} in environment variables`
      });
    }

    // Initialize Firebase Admin
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    if (getApps().length === 0) {
      // Handle private key - replace both \\n and literal \n with actual newlines
      let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
      
      // Remove quotes if they exist
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      
      // Replace escaped newlines with actual newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
      
      console.log('Firebase credentials check:', {
        hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        privateKeyLength: privateKey.length,
        privateKeyStart: privateKey.substring(0, 30),
      });

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

    // Get or create subscription doc
    const subRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('billing')
      .doc('subscription');
    
    const subDoc = await subRef.get();
    let customerId = subDoc.exists ? subDoc.data()?.stripeCustomerId : null;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const orgDoc = await db.collection('organizations').doc(orgId).get();
      const orgData = orgDoc.data();

      console.log('Creating Stripe customer for org:', orgId);
      const customer = await stripe.customers.create({
        email: orgData?.ownerEmail,
        metadata: {
          orgId,
        },
      });

      customerId = customer.id;
      console.log('Created customer:', customerId);

      // Save customer ID (create or update)
      if (subDoc.exists) {
        await subRef.update({ stripeCustomerId: customerId });
      } else {
        await subRef.set({ stripeCustomerId: customerId }, { merge: true });
      }
    }

    const baseUrl = getFrontendUrl();
    console.log('Using base URL:', baseUrl);

    // ==================== UPGRADE/DOWNGRADE: Stripe Customer Portal ====================
    // If the user already has an active subscription, send them to the
    // portal's confirmation screen so they can see the proration breakdown
    // and confirm the plan change themselves.
    const subData = subDoc.exists ? subDoc.data() : null;
    const existingSubscriptionId = subData?.stripeSubscriptionId;

    if (existingSubscriptionId) {
      try {
        const existingSub = await stripe.subscriptions.retrieve(existingSubscriptionId);

        if (existingSub.status === 'active' || existingSub.status === 'trialing') {
          // Already on this price — nothing to do
          if (existingSub.items.data[0].price.id === priceId) {
            console.log('Already on this plan/price, no change needed');
            return res.json({ alreadyCurrent: true });
          }

          console.log(`Redirecting to portal for plan change: ${existingSubscriptionId} → price ${priceId}`);

          const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${baseUrl}/settings?success=true`,
            flow_data: {
              type: 'subscription_update_confirm',
              subscription_update_confirm: {
                subscription: existingSubscriptionId,
                items: [{
                  id: existingSub.items.data[0].id,
                  price: priceId,
                  quantity: 1,
                }],
              },
            },
          });

          console.log(`Portal session created for plan change: ${portalSession.id}`);
          return res.json({ url: portalSession.url });
        }

        console.log(`Existing subscription ${existingSubscriptionId} is ${existingSub.status}, creating new checkout`);
      } catch (subErr: any) {
        // If the subscription exists but we hit a config error (e.g. portal not configured),
        // do NOT fall through to a new checkout — that would create a duplicate subscription.
        // Only fall through if the subscription itself is gone from Stripe (resource_missing).
        const isNotFound = subErr.code === 'resource_missing' || subErr.statusCode === 404;
        if (!isNotFound) {
          console.error(`Plan change failed for subscription ${existingSubscriptionId}: ${subErr.message}`);
          return res.status(400).json({
            error: 'Unable to change plan',
            message: subErr.message,
          });
        }
        console.log(`Subscription ${existingSubscriptionId} no longer exists in Stripe, creating new checkout`);
      }
    }

    // ==================== NEW SUBSCRIPTION: Stripe Checkout ====================

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/settings?success=true`,
      cancel_url: `${baseUrl}/settings?canceled=true`,
      metadata: {
        orgId,
        planTier,
      },
    });

    console.log('Checkout session created successfully:', session.id);
    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Failed to create checkout session',
      details: error.toString()
    });
  }
}

/**
 * Get Stripe price ID based on plan and billing cycle
 */
function getPriceId(planTier: string, billingCycle: string): string | null {
  // Try both with and without VITE_ prefix
  const viteKey = `VITE_STRIPE_${planTier.toUpperCase()}_${billingCycle.toUpperCase()}`;
  const regularKey = `STRIPE_${planTier.toUpperCase()}_${billingCycle.toUpperCase()}`;
  
  return process.env[viteKey] || process.env[regularKey] || null;
}

