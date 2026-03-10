import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      } as any),
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const adminDb = getFirestore();

const SUPER_ADMIN_EMAILS = ['ernesto@maktubtechnologies.com'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, orgId, memberId, hardDelete } = req.body;

  if (!email || !SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (!orgId || !memberId) {
    return res.status(400).json({ error: 'orgId and memberId are required' });
  }

  try {
    const memberRef = adminDb
      .collection('organizations').doc(orgId)
      .collection('members').doc(memberId);

    const memberSnap = await memberRef.get();

    if (!memberSnap.exists) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const memberData = memberSnap.data();
    const orgRef = adminDb.collection('organizations').doc(orgId);

    if (hardDelete) {
      await memberRef.delete();
      console.log(`🗑️ Hard-deleted member ${memberId} from org ${orgId}`);
    } else {
      await memberRef.update({ status: 'removed' });
      console.log(`🚫 Soft-removed member ${memberId} from org ${orgId}`);
    }

    // Decrement member count only if member was active
    if (memberData?.status === 'active') {
      await orgRef.update({ memberCount: FieldValue.increment(-1) });
    }

    // Clear user's defaultOrgId if it points to this org
    try {
      const userRef = adminDb.collection('users').doc(memberId);
      const userDoc = await userRef.get();
      if (userDoc.exists && userDoc.data()?.defaultOrgId === orgId) {
        await userRef.update({ defaultOrgId: FieldValue.delete() });
      }
    } catch (_) { /* non-critical */ }

    return res.status(200).json({
      success: true,
      message: hardDelete ? 'Member permanently deleted' : 'Member removed',
      memberId,
      memberEmail: memberData?.email || 'unknown',
    });
  } catch (error: any) {
    console.error('❌ Delete member error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete member' });
  }
}
