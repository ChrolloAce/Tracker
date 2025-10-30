import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * One-time fix script to correct subscription plan tier based on price ID
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore, Timestamp } = await import('firebase-admin/firestore');

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
    const { orgId } = req.body;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId required' });
    }

    const subRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('billing')
      .doc('subscription');

    const subDoc = await subRef.get();
    
    if (!subDoc.exists) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const data = subDoc.data();
    const priceId = data?.stripePriceId;
    
    console.log('Current data:', {
      planTier: data?.planTier,
      stripePriceId: priceId,
      status: data?.status
    });

    // Map price ID to correct plan
    const getPlanFromPriceId = (priceId: string): string | null => {
      const priceMap: Record<string, string> = {
        [process.env.VITE_STRIPE_BASIC_MONTHLY || 'price_basic']: 'basic',
        [process.env.VITE_STRIPE_BASIC_YEARLY || 'price_basic_y']: 'basic',
        [process.env.VITE_STRIPE_PRO_MONTHLY || 'price_pro']: 'pro',
        [process.env.VITE_STRIPE_PRO_YEARLY || 'price_pro_y']: 'pro',
        [process.env.VITE_STRIPE_ULTRA_MONTHLY || 'price_ultra']: 'ultra',
        [process.env.VITE_STRIPE_ULTRA_YEARLY || 'price_ultra_y']: 'ultra',
      };
      return priceMap[priceId] || null;
    };

    const correctPlan = getPlanFromPriceId(priceId);
    
    if (!correctPlan) {
      return res.status(400).json({ 
        error: 'Could not determine plan from price ID',
        priceId 
      });
    }

    // Update to correct plan
    await subRef.update({
      planTier: correctPlan,
      updatedAt: Timestamp.now()
    });

    console.log(`✅ Fixed subscription: ${data?.planTier} → ${correctPlan}`);

    res.json({
      success: true,
      message: `Subscription fixed: ${data?.planTier} → ${correctPlan}`,
      before: data?.planTier,
      after: correctPlan
    });

  } catch (error: any) {
    console.error('Error fixing subscription:', error);
    res.status(500).json({ error: error.message });
  }
}

