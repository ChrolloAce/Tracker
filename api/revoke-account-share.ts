/**
 * Revoke Account Share Link
 * POST /api/revoke-account-share
 *
 * Soft-deletes one or more account share tokens. SUPER ADMIN ONLY.
 *
 * Body shapes (one of):
 *   { orgId, token }                          → revoke one specific token
 *   { orgId, accountId }                      → revoke ALL non-revoked tokens
 *                                                for that account
 *   { orgId, accountId, projectId }           → scoped to one project
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
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
    const { orgId, token, accountId, projectId } = req.body || {};

    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }
    if (!token && !accountId) {
      return res.status(400).json({ error: 'Either token or accountId must be provided' });
    }

    const user = await authenticateSuperAdmin(req);

    const now = Timestamp.now();
    const revokedTokens: Array<{ id: string; projectId: string; accountId: string }> = [];

    if (token) {
      const doc = await db.collection('accountShareLinks').doc(token).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Share link not found' });
      }
      const data = doc.data()!;
      if (data.orgId !== orgId) {
        return res.status(404).json({ error: 'Share link not found' });
      }
      if (!data.revoked) {
        await doc.ref.update({
          revoked: true,
          revokedAt: now,
          revokedBy: user.userId,
        });
      }
      revokedTokens.push({ id: doc.id, projectId: data.projectId, accountId: data.accountId });
    } else {
      const snap = await db.collection('accountShareLinks')
        .where('accountId', '==', accountId)
        .limit(50)
        .get();

      const batch = db.batch();
      let writeCount = 0;

      for (const doc of snap.docs) {
        const data = doc.data();
        if (data.orgId !== orgId) continue;
        if (projectId && data.projectId !== projectId) continue;
        if (data.revoked) continue;

        batch.update(doc.ref, {
          revoked: true,
          revokedAt: now,
          revokedBy: user.userId,
        });
        writeCount++;
        revokedTokens.push({ id: doc.id, projectId: data.projectId, accountId: data.accountId });
      }

      if (writeCount > 0) {
        await batch.commit();
      }
    }

    // Clear denormalized shareToken pointer on affected account docs
    for (const tok of revokedTokens) {
      try {
        const accountRef = db
          .collection('organizations').doc(orgId)
          .collection('projects').doc(tok.projectId)
          .collection('trackedAccounts').doc(tok.accountId);
        const accountDoc = await accountRef.get();
        if (accountDoc.exists && accountDoc.data()?.shareToken === tok.id) {
          await accountRef.update({ shareToken: null });
        }
      } catch (err) {
        console.warn(`Failed to clear shareToken on account ${tok.accountId}:`, err);
      }
    }

    console.log(`✅ Revoked ${revokedTokens.length} account share link(s) in org ${orgId}`);

    return res.status(200).json({
      success: true,
      revokedCount: revokedTokens.length,
      tokens: revokedTokens.map(t => t.id),
    });
  } catch (err: any) {
    console.error('❌ revoke-account-share error:', err);
    if (err.message?.includes('Unauthorized') || err.message?.includes('Super admin')) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
