import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

/**
 * Check team member limit for an organization
 * Returns current usage (active members + pending invitations) and the limit
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId } = req.query;

  if (!orgId || typeof orgId !== 'string') {
    return res.status(400).json({ error: 'orgId is required' });
  }

  try {
    console.log(`🔍 Checking team limit for org: ${orgId}`);

    // Get organization's subscription/plan
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    
    if (!orgDoc.exists) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get plan tier (default to 'free' if not set)
    const billingDoc = await db.collection('organizations').doc(orgId).collection('billing').doc('subscription').get();
    const planTier = billingDoc.exists ? (billingDoc.data()?.planTier || 'free') : 'free';

    // Define plan limits (matching your subscription plans)
    const planLimits: Record<string, number> = {
      free: 1,
      basic: 2,
      pro: 5,
      ultra: 15,
      enterprise: -1 // unlimited
    };

    const limit = planLimits[planTier] ?? 1;

    // Count active members
    const membersSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('members')
      .where('status', '==', 'active')
      .get();

    const activeMembers = membersSnapshot.size;

    // Count pending invitations
    const invitationsSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('teamInvitations')
      .where('status', '==', 'pending')
      .get();

    const pendingInvitations = invitationsSnapshot.size;

    const current = activeMembers + pendingInvitations;
    const isAtLimit = limit !== -1 && current >= limit;

    console.log(`✅ Team limit check: ${current}/${limit} (${activeMembers} active + ${pendingInvitations} pending)`);

    return res.status(200).json({
      current,
      limit,
      active: activeMembers,
      pending: pendingInvitations,
      isAtLimit,
      planTier
    });

  } catch (error: any) {
    console.error('❌ Failed to check team limit:', error);
    return res.status(500).json({ 
      error: 'Failed to check team limit',
      message: error.message 
    });
  }
}

