import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Check subscription status (for debugging)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId } = req.query;

  if (!orgId || typeof orgId !== 'string') {
    return res.status(400).json({ error: 'Missing orgId parameter' });
  }

  try {
    // Initialize Firebase Admin
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    if (getApps().length === 0) {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
      
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      
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

    // Get subscription document
    const subDoc = await db
      .collection('organizations')
      .doc(orgId)
      .collection('billing')
      .doc('subscription')
      .get();

    if (!subDoc.exists) {
      return res.status(404).json({ 
        error: 'Subscription document not found',
        orgId,
        path: `organizations/${orgId}/billing/subscription`
      });
    }

    const data = subDoc.data();

    // Check environment variables for debugging
    const envCheck = {
      VITE_STRIPE_BASIC_MONTHLY: process.env.VITE_STRIPE_BASIC_MONTHLY || 'NOT SET',
      VITE_STRIPE_PRO_MONTHLY: process.env.VITE_STRIPE_PRO_MONTHLY || 'NOT SET',
      VITE_STRIPE_ULTRA_MONTHLY: process.env.VITE_STRIPE_ULTRA_MONTHLY || 'NOT SET',
    };

    return res.json({
      subscription: {
        planTier: data?.planTier || 'NOT SET',
        status: data?.status || 'NOT SET',
        stripeCustomerId: data?.stripeCustomerId || 'NOT SET',
        stripeSubscriptionId: data?.stripeSubscriptionId || 'NOT SET',
        stripePriceId: data?.stripePriceId || 'NOT SET',
        currentPeriodEnd: data?.currentPeriodEnd?.toDate() || 'NOT SET',
        cancelAtPeriodEnd: data?.cancelAtPeriodEnd || false,
      },
      environmentVariables: envCheck,
      diagnosis: {
        hasCustomerId: !!data?.stripeCustomerId,
        hasPlanTier: !!data?.planTier && data?.planTier !== 'free',
        isActive: data?.status === 'active',
        webhookWorked: !!data?.stripeSubscriptionId && !!data?.planTier && data?.planTier !== 'free',
      }
    });
  } catch (error: any) {
    console.error('Error checking subscription:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}

