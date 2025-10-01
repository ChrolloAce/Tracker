import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

/**
 * Create a Stripe Customer Portal session
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

  const { orgId } = req.body;

  if (!orgId) {
    return res.status(400).json({ error: 'Missing orgId' });
  }

  try {
    console.log('Creating portal session for org:', orgId);
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

    // Get customer ID
    const subDoc = await db
      .collection('organizations')
      .doc(orgId)
      .collection('billing')
      .doc('subscription')
      .get();

    const customerId = subDoc.data()?.stripeCustomerId;

    if (!customerId) {
      console.error('No Stripe customer found for org:', orgId);
      return res.status(400).json({ error: 'No Stripe customer found. Please subscribe to a plan first.' });
    }

    console.log('Found customer:', customerId);

    // Get base URL - fallback to Vercel URL if NEXT_PUBLIC_BASE_URL not set
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173');

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/settings`,
    });

    console.log('Portal session created successfully:', session.id);
    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Failed to create portal session',
      details: error.toString()
    });
  }
}

