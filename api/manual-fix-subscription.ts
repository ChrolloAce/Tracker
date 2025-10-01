import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * MANUAL FIX: Set subscription to PRO
 * This is a temporary fix while webhook is being configured
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId, planTier, stripePriceId } = req.body;

  if (!orgId || !planTier) {
    return res.status(400).json({ error: 'Missing orgId or planTier' });
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

    // Calculate period dates (30 days from now for monthly)
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    // Update subscription document
    const subRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('billing')
      .doc('subscription');

    await subRef.update({
      planTier: planTier,
      status: 'active',
      stripePriceId: stripePriceId || 'manual_override',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      updatedAt: now,
    });

    console.log(`✅ Manually updated subscription for org ${orgId} to ${planTier}`);

    return res.json({ 
      success: true,
      message: `Subscription updated to ${planTier}`,
      expiresAt: periodEnd,
    });
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}

