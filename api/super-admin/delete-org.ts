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

  const { email, orgId } = req.body;

  if (!email || !SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (!orgId) {
    return res.status(400).json({ error: 'orgId is required' });
  }

  try {
    const orgRef = adminDb.collection('organizations').doc(orgId);
    const orgDoc = await orgRef.get();

    if (!orgDoc.exists) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const orgName = orgDoc.data()?.name || 'Unknown';
    console.log(`🗑️ SuperAdmin deleting org: ${orgName} (${orgId})`);

    const counts = { projects: 0, accounts: 0, videos: 0, snapshots: 0, links: 0, members: 0 };

    const projectsSnap = await orgRef.collection('projects').get();
    for (const projectDoc of projectsSnap.docs) {
      const accountsSnap = await projectDoc.ref.collection('trackedAccounts').get();
      for (const acc of accountsSnap.docs) { await acc.ref.delete(); counts.accounts++; }

      const videosSnap = await projectDoc.ref.collection('videos').get();
      for (const vid of videosSnap.docs) {
        const snapsSnap = await vid.ref.collection('snapshots').get();
        for (const snap of snapsSnap.docs) { await snap.ref.delete(); counts.snapshots++; }
        await vid.ref.delete();
        counts.videos++;
      }

      const linksSnap = await projectDoc.ref.collection('trackedLinks').get();
      for (const link of linksSnap.docs) {
        const clicksSnap = await link.ref.collection('clicks').get();
        for (const click of clicksSnap.docs) { await click.ref.delete(); }
        await link.ref.delete();
        counts.links++;
      }

      await projectDoc.ref.delete();
      counts.projects++;
    }

    const membersSnap = await orgRef.collection('members').get();
    for (const member of membersSnap.docs) {
      try {
        const userRef = adminDb.collection('users').doc(member.id);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.defaultOrgId === orgId) {
            await userRef.update({ defaultOrgId: FieldValue.delete() });
          }
        }
      } catch (_) { /* non-critical */ }
      await member.ref.delete();
      counts.members++;
    }

    const invitesSnap = await orgRef.collection('invitations').get();
    for (const inv of invitesSnap.docs) { await inv.ref.delete(); }

    const billingSnap = await orgRef.collection('billing').get();
    for (const bill of billingSnap.docs) { await bill.ref.delete(); }

    await orgRef.delete();

    console.log(`✅ Deleted org ${orgName}:`, counts);
    return res.status(200).json({ success: true, orgName, deleted: counts });
  } catch (error: any) {
    console.error('❌ Delete org error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete organization' });
  }
}
