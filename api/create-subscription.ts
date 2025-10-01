import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Manually create a subscription for an existing organization
 * Only call this once for existing orgs that don't have a subscription
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId } = req.body;

  if (!orgId) {
    return res.status(400).json({ error: 'Missing orgId' });
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

    // Check if subscription already exists
    const subDoc = await db
      .collection('organizations')
      .doc(orgId)
      .collection('billing')
      .doc('subscription')
      .get();

    if (subDoc.exists) {
      return res.json({ message: 'Subscription already exists', subscription: subDoc.data() });
    }

    // Create default subscription
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7); // 7-day trial

    const subscription = {
      orgId,
      planTier: 'basic',
      status: 'trialing',
      stripeCustomerId: '',
      stripeSubscriptionId: '',
      stripePriceId: '',
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEnd,
      cancelAtPeriodEnd: false,
      trialEnd,
      usage: {
        accounts: 0,
        videos: 0,
        teamMembers: 1,
        mcpCalls: 0,
        links: 0,
        lastReset: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db
      .collection('organizations')
      .doc(orgId)
      .collection('billing')
      .doc('subscription')
      .set(subscription);

    res.json({ message: 'Subscription created', subscription });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: error.message });
  }
}

