import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Clear test subscription data from Firebase
 * Use this when switching from test to live Stripe mode
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

    // Delete the subscription document
    await db
      .collection('organizations')
      .doc(orgId)
      .collection('billing')
      .doc('subscription')
      .delete();

    console.log(`✅ Cleared test subscription data for org: ${orgId}`);

    res.json({ 
      success: true, 
      message: 'Test subscription data cleared. You can now create a live subscription.' 
    });
  } catch (error: any) {
    console.error('Error clearing subscription:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to clear subscription data' 
    });
  }
}

