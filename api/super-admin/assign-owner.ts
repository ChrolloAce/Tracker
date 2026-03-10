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

  const { email, orgId, targetEmail } = req.body;

  if (!email || !SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (!orgId || !targetEmail) {
    return res.status(400).json({ error: 'orgId and targetEmail are required' });
  }

  try {
    const orgRef = adminDb.collection('organizations').doc(orgId);
    const orgDoc = await orgRef.get();

    if (!orgDoc.exists) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const normalizedEmail = targetEmail.toLowerCase().trim();

    const usersSnap = await adminDb.collection('users')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();

    if (usersSnap.empty) {
      return res.status(404).json({
        error: `No user found with email: ${normalizedEmail}. They must sign in at least once first.`
      });
    }

    const targetUser = usersSnap.docs[0];
    const targetUserId = targetUser.id;
    const targetUserData = targetUser.data();

    console.log(`👤 Assigning ${normalizedEmail} (${targetUserId}) as owner of org ${orgId}`);

    const batch = adminDb.batch();

    // Demote current owner to admin (if one exists)
    const currentOwnerId = orgDoc.data()?.ownerUserId;
    if (currentOwnerId && currentOwnerId !== targetUserId) {
      const currentOwnerMemberRef = orgRef.collection('members').doc(currentOwnerId);
      const currentOwnerSnap = await currentOwnerMemberRef.get();
      if (currentOwnerSnap.exists) {
        batch.update(currentOwnerMemberRef, { role: 'admin' });
        console.log(`   ↓ Demoted previous owner ${currentOwnerId} to admin`);
      }
    }

    // Upsert new owner as member
    const newOwnerMemberRef = orgRef.collection('members').doc(targetUserId);
    const existingMemberSnap = await newOwnerMemberRef.get();

    if (existingMemberSnap.exists) {
      batch.update(newOwnerMemberRef, {
        role: 'owner',
        status: 'active',
        email: normalizedEmail,
        displayName: targetUserData?.displayName || normalizedEmail,
      });
    } else {
      batch.set(newOwnerMemberRef, {
        userId: targetUserId,
        role: 'owner',
        status: 'active',
        joinedAt: FieldValue.serverTimestamp(),
        email: normalizedEmail,
        displayName: targetUserData?.displayName || normalizedEmail,
      });
      batch.update(orgRef, { memberCount: FieldValue.increment(1) });
    }

    // Update org doc
    batch.update(orgRef, {
      ownerUserId: targetUserId,
      ownerEmail: normalizedEmail,
    });

    // Set as default org for the user
    const userRef = adminDb.collection('users').doc(targetUserId);
    batch.update(userRef, { defaultOrgId: orgId });

    await batch.commit();

    console.log(`✅ ${normalizedEmail} is now owner of org ${orgId}`);
    return res.status(200).json({
      success: true,
      message: `${normalizedEmail} is now the owner`,
      userId: targetUserId,
      displayName: targetUserData?.displayName || normalizedEmail,
    });
  } catch (error: any) {
    console.error('❌ Assign owner error:', error);
    return res.status(500).json({ error: error.message || 'Failed to assign owner' });
  }
}
