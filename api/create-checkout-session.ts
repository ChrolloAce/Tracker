import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

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
      console.error('No price ID found for:', planTier, billingCycle);
      console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('STRIPE')));
      return res.status(400).json({ 
        error: 'Invalid plan or billing cycle',
        debug: { planTier, billingCycle, envVarNeeded: `STRIPE_${planTier.toUpperCase()}_${billingCycle.toUpperCase()}` }
      });
    }

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

    // Create Checkout Session
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
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5173'}/settings?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5173'}/settings?canceled=true`,
      metadata: {
        orgId,
        planTier,
      },
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
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

