/**
 * Create Account Share Link
 * POST /api/create-account-share
 *
 * Mints (or returns existing) public share token for a single tracked
 * account's dashboard view. SUPER ADMIN ONLY — used for marketing/demo.
 *
 * Body:    { orgId, projectId, accountId }
 * Returns: { success, token, shareUrl, existing? }
 *
 * Idempotent: returns existing non-revoked link if one already exists.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { initializeFirebase } from './_utils/firebase-admin.js';
import { authenticateSuperAdmin, setCorsHeaders, handleCorsPreFlight } from './_middleware/auth.js';

initializeFirebase();
const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req);
  if (handleCorsPreFlight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orgId, projectId, accountId } = req.body || {};

    if (!orgId || !projectId || !accountId) {
      return res.status(400).json({ error: 'orgId, projectId, and accountId are required' });
    }

    const user = await authenticateSuperAdmin(req);

    // Verify the account exists in this project
    const accountRef = db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('trackedAccounts').doc(accountId);

    const accountDoc = await accountRef.get();
    if (!accountDoc.exists) {
      return res.status(404).json({ error: 'Account not found in this project' });
    }

    // Idempotency — check for existing non-revoked link
    const existingSnap = await db
      .collection('accountShareLinks')
      .where('accountId', '==', accountId)
      .limit(10)
      .get();

    const existing = existingSnap.docs.find(d => {
      const data = d.data();
      return data.projectId === projectId && data.orgId === orgId && !data.revoked;
    });

    const host = req.headers.host || 'www.viewtrack.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    if (existing) {
      return res.status(200).json({
        success: true,
        token: existing.id,
        shareUrl: `${protocol}://${host}/a/${existing.id}`,
        existing: true,
      });
    }

    // Generate new token
    const token = randomBytes(24).toString('hex');
    const now = Timestamp.now();

    await db.collection('accountShareLinks').doc(token).set({
      token,
      orgId,
      projectId,
      accountId,
      createdAt: now,
      createdBy: user.userId,
      revoked: false,
    });

    // Denormalize on the account doc for UI convenience
    await accountRef.set({ shareToken: token }, { merge: true });

    console.log(`✅ Created account share link for account ${accountId} in project ${projectId} (token: ${token.slice(0, 8)}...)`);

    return res.status(201).json({
      success: true,
      token,
      shareUrl: `${protocol}://${host}/a/${token}`,
    });
  } catch (err: any) {
    console.error('❌ create-account-share error:', err);
    if (err.message?.includes('Unauthorized') || err.message?.includes('Super admin')) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
