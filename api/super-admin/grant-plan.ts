import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  try {
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

    initializeApp({ credential: cert(serviceAccount as any) });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const adminDb = getFirestore();

// Super admin emails
const SUPER_ADMIN_EMAILS = [
  'ernesto@maktubtechnologies.com'
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, orgId, planTier } = req.body;
  
  if (!email || !SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
  }

  if (!orgId || !planTier) {
    return res.status(400).json({ error: 'Organization ID and plan tier are required' });
  }

  const validPlans = ['free', 'basic', 'pro', 'enterprise'];
  if (!validPlans.includes(planTier)) {
    return res.status(400).json({ error: 'Invalid plan tier' });
  }

  try {
    console.log(`🔧 SuperAdmin: Granting ${planTier} plan to org ${orgId}`);
    
    // Check if org exists
    const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
    if (!orgDoc.exists) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Calculate expiration (1 year from now for paid plans)
    const now = new Date();
    const expiresAt = planTier === 'free' 
      ? null 
      : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    // Update or create subscription document
    const subscriptionRef = adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('billing')
      .doc('subscription');

    await subscriptionRef.set({
      planTier,
      status: planTier === 'free' ? 'inactive' : 'active',
      stripeCustomerId: '',
      stripeSubscriptionId: '',
      currentPeriodStart: now,
      currentPeriodEnd: expiresAt,
      createdAt: now,
      updatedAt: now,
      grantedBy: email,
      grantedAt: now,
    }, { merge: true });

    console.log(`✅ SuperAdmin: Successfully granted ${planTier} to org ${orgId}`);
    
    return res.status(200).json({ 
      success: true, 
      message: `Granted ${planTier} plan to organization` 
    });
  } catch (error) {
    console.error('❌ SuperAdmin grant-plan error:', error);
    return res.status(500).json({ error: 'Failed to grant plan', details: String(error) });
  }
}

