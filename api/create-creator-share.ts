/**
 * Create Creator Share Link
 * POST /api/create-creator-share
 *
 * Mints (or returns an existing) public share token for a single creator's
 * dashboard view. The token is the only credential — anyone who has the URL
 * can see that one creator's scoped stats. Authenticated admin-side call.
 *
 * Body:    { orgId, projectId, creatorId, acceptSubmissions? }
 * Returns: { success, token, shareUrl, existing? }
 *
 * Idempotent: if a non-revoked link already exists for this creator in this
 * project, returns it instead of creating a duplicate.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { initializeFirebase } from './_utils/firebase-admin.js';
import { authenticateAndVerifyOrg, setCorsHeaders, handleCorsPreFlight } from './_middleware/auth.js';

initializeFirebase();
const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req);
  if (handleCorsPreFlight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orgId, projectId, creatorId, acceptSubmissions } = req.body || {};

    if (!orgId || !projectId || !creatorId) {
      return res.status(400).json({ error: 'orgId, projectId, and creatorId are required' });
    }

    const { user, role } = await authenticateAndVerifyOrg(req, orgId);

    // Creators shouldn't be able to mint share links for themselves or others.
    if (role === 'creator') {
      return res.status(403).json({ error: 'Creators cannot create share links' });
    }

    // Verify the creator exists. The creator profile is project-scoped, but
    // the member doc (which makes them visible in the table) is org-level.
    // If two admins are on different projects, one might see the creator but
    // the profile doesn't exist in their project yet. Auto-create it from
    // the org member doc so portals work across projects.
    const creatorRef = db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('creators').doc(creatorId);

    let creatorDoc = await creatorRef.get();
    if (!creatorDoc.exists) {
      // Check if the creator exists as an org member
      const memberDoc = await db
        .collection('organizations').doc(orgId)
        .collection('members').doc(creatorId)
        .get();

      if (!memberDoc.exists || memberDoc.data()?.status !== 'active') {
        return res.status(404).json({ error: 'Creator not found' });
      }

      // Auto-create a minimal creator profile in this project
      const memberData = memberDoc.data()!;
      await creatorRef.set({
        orgId,
        projectId,
        displayName: memberData.displayName || memberData.email || 'Creator',
        email: memberData.email || '',
        linkedAccountsCount: 0,
        totalEarnings: 0,
        payoutsEnabled: true,
        addedWithoutInvite: true,
        createdAt: Timestamp.now(),
      });

      // Re-read so the rest of the function has the doc
      creatorDoc = await creatorRef.get();
      console.log(`✅ Auto-created creator profile for ${creatorId} in project ${projectId}`);
    }

    // Idempotency: look for an existing non-revoked link for this creator.
    // Single-field where + client-side projectId filter to avoid a composite index.
    const existingSnap = await db
      .collection('creatorShareLinks')
      .where('creatorId', '==', creatorId)
      .limit(10)
      .get();

    const existing = existingSnap.docs.find(d => {
      const data = d.data();
      return data.projectId === projectId && !data.revoked;
    });

    const host = req.headers.host || 'www.viewtrack.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    if (existing) {
      return res.status(200).json({
        success: true,
        token: existing.id,
        shareUrl: `${protocol}://${host}/c/${existing.id}`,
        existing: true,
      });
    }

    // Generate a new cryptographically random token (24 bytes → 48 hex chars)
    const token = randomBytes(24).toString('hex');
    const now = Timestamp.now();

    await db.collection('creatorShareLinks').doc(token).set({
      token,
      orgId,
      projectId,
      creatorId,
      createdAt: now,
      createdBy: user.userId,
      revoked: false,
      acceptSubmissions: acceptSubmissions !== false, // default true
      // Rate-limit counters (refreshed per hour/day bucket at submit time)
      submitCount: 0,
      submitCountHour: 0,
      submitCountHourBucket: '',
      submitCountToday: 0,
      submitCountDayBucket: '',
    });

    // Denormalize the token back onto the creator profile so the UI can show
    // "Copy share link" without a second query.
    await creatorRef.set({
      externalShareToken: token,
      isExternal: creatorDoc.data()?.addedWithoutInvite === true ? true : creatorDoc.data()?.isExternal || false,
    }, { merge: true });

    console.log(`✅ Created creator share link for creator ${creatorId} in project ${projectId} (token: ${token.slice(0, 8)}...)`);

    return res.status(201).json({
      success: true,
      token,
      shareUrl: `${protocol}://${host}/c/${token}`,
    });
  } catch (err: any) {
    console.error('❌ create-creator-share error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
