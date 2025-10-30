import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Debug endpoint to check subscription data
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
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
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      return res.status(400).json({ error: 'orgId parameter required' });
    }

    const subDoc = await db
      .collection('organizations')
      .doc(orgId)
      .collection('billing')
      .doc('subscription')
      .get();

    if (!subDoc.exists) {
      return res.json({
        exists: false,
        message: 'No subscription document found',
        path: `organizations/${orgId}/billing/subscription`
      });
    }

    const data = subDoc.data();

    res.json({
      exists: true,
      path: `organizations/${orgId}/billing/subscription`,
      data: {
        planTier: data?.planTier,
        status: data?.status,
        stripeCustomerId: data?.stripeCustomerId,
        stripeSubscriptionId: data?.stripeSubscriptionId,
        stripePriceId: data?.stripePriceId,
        currentPeriodStart: data?.currentPeriodStart?.toDate?.()?.toISOString(),
        currentPeriodEnd: data?.currentPeriodEnd?.toDate?.()?.toISOString(),
        updatedAt: data?.updatedAt?.toDate?.()?.toISOString(),
        rawData: data
      }
    });

  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to check subscription',
      message: error.message 
    });
  }
}

