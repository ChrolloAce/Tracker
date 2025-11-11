import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
// @ts-ignore
import { initializeApp, getApps } from 'firebase-admin/app';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Initialize Firebase Admin
    if (!getApps().length) {
      const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
      
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
    }

    const db = getFirestore();
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ 
        error: 'userId is required',
        usage: '/api/list-my-orgs?userId=YOUR_USER_ID'
      });
    }

    console.log('🔍 Finding all organizations for user:', userId);

    // Query all member documents for this user
    const membersQuery = await db
      .collectionGroup('members')
      .where('userId', '==', userId)
      .get();

    console.log(`📊 Found ${membersQuery.size} member records`);

    const organizations = [];

    for (const memberDoc of membersQuery.docs) {
      const memberData = memberDoc.data();
      const orgId = memberDoc.ref.parent.parent?.id;

      if (!orgId) continue;

      console.log(`📍 Processing org: ${orgId}, status: ${memberData.status}, role: ${memberData.role}`);

      // Get organization details
      const orgDoc = await db.collection('organizations').doc(orgId).get();
      
      if (!orgDoc.exists) {
        console.log(`  ⚠️ Org document doesn't exist: ${orgId}`);
        continue;
      }

      const orgData = orgDoc.data();

      // Get subscription details
      let subscription = null;
      try {
        const subDoc = await db
          .collection('organizations')
          .doc(orgId)
          .collection('billing')
          .doc('subscription')
          .get();

        if (subDoc.exists) {
          subscription = subDoc.data();
        }
      } catch (error) {
        console.log(`  ⚠️ Could not fetch subscription for ${orgId}`);
      }

      organizations.push({
        orgId,
        orgName: orgData?.name || 'Unnamed Organization',
        memberStatus: memberData.status,
        role: memberData.role,
        joinedAt: memberData.joinedAt?.toDate?.()?.toISOString() || null,
        subscription: subscription ? {
          planTier: subscription.planTier,
          status: subscription.status,
          stripeCustomerId: subscription.stripeCustomerId || null,
          stripeSubscriptionId: subscription.stripeSubscriptionId || null,
          currentPeriodEnd: subscription.currentPeriodEnd?.toDate?.()?.toISOString() || null,
        } : null,
        createdAt: orgData?.createdAt?.toDate?.()?.toISOString() || null,
      });
    }

    // Sort by creation date (newest first)
    organizations.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    console.log(`✅ Returning ${organizations.length} organizations`);

    return res.json({
      success: true,
      userId,
      organizationCount: organizations.length,
      organizations,
      help: {
        message: 'If you see multiple organizations, look for the one with your paid subscription.',
        paidOrg: organizations.find(o => o.subscription?.planTier !== 'free'),
        newestOrg: organizations[0],
      }
    });

  } catch (error: any) {
    console.error('❌ Error listing organizations:', error);
    return res.status(500).json({ 
      error: 'Failed to list organizations',
      message: error.message 
    });
  }
}

