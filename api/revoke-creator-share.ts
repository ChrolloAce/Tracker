/**
 * Revoke Creator Share Link(s)
 * POST /api/revoke-creator-share
 *
 * Sets revoked: true on creator share tokens so subsequent public reads
 * return 410 and subsequent submits are blocked. Soft-delete semantics —
 * the token doc itself is preserved for audit.
 *
 * Body shapes (one of):
 *   { orgId, token }                           → revoke one specific token
 *   { orgId, creatorId }                       → revoke ALL non-revoked tokens
 *                                                 for that creator across all
 *                                                 projects in the org
 *   { orgId, creatorId, projectId }            → revoke all non-revoked tokens
 *                                                 for that creator in one project
 *
 * Also clears the denormalized `externalShareToken` pointer on any creator
 * profile docs that referenced the revoked tokens, so the "Copy share link"
 * row action re-mints a fresh one on next use.
 *
 * Authenticated admin-side call (same auth + role gate as create).
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
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
    const { orgId, token, creatorId, projectId } = req.body || {};

    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }
    if (!token && !creatorId) {
      return res.status(400).json({ error: 'Either token or creatorId must be provided' });
    }

    const { user, role } = await authenticateAndVerifyOrg(req, orgId);
    if (role === 'creator') {
      return res.status(403).json({ error: 'Creators cannot revoke share links' });
    }

    const now = Timestamp.now();
    const revokedTokenDocs: Array<{ id: string; projectId: string; creatorId: string }> = [];

    if (token) {
      // Single-token revoke path
      const doc = await db.collection('creatorShareLinks').doc(token).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Share link not found' });
      }
      const data = doc.data()!;
      if (data.orgId !== orgId) {
        // Cross-tenant guard — don't leak existence of other orgs' tokens
        return res.status(404).json({ error: 'Share link not found' });
      }
      if (!data.revoked) {
        await doc.ref.update({
          revoked: true,
          revokedAt: now,
          revokedBy: user.userId,
        });
      }
      revokedTokenDocs.push({ id: doc.id, projectId: data.projectId, creatorId: data.creatorId });
    } else {
      // Bulk revoke by creatorId (optionally scoped to one project)
      const query = db.collection('creatorShareLinks').where('creatorId', '==', creatorId);
      const snap = await query.limit(50).get();

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
        revokedTokenDocs.push({ id: doc.id, projectId: data.projectId, creatorId: data.creatorId });
      }

      if (writeCount > 0) {
        await batch.commit();
      }
    }

    // Clear the denormalized externalShareToken pointer on affected creator profiles
    // so the "Copy share link" action re-mints a fresh token next time.
    for (const tok of revokedTokenDocs) {
      try {
        const creatorRef = db
          .collection('organizations').doc(orgId)
          .collection('projects').doc(tok.projectId)
          .collection('creators').doc(tok.creatorId);
        const creatorDoc = await creatorRef.get();
        if (creatorDoc.exists && creatorDoc.data()?.externalShareToken === tok.id) {
          await creatorRef.update({
            externalShareToken: null,
          });
        }
      } catch (err) {
        // Non-critical — the revoke is what matters. Profile cleanup is hygiene.
        console.warn(`Failed to clear externalShareToken on creator ${tok.creatorId}:`, err);
      }
    }

    console.log(`✅ Revoked ${revokedTokenDocs.length} creator share link(s) in org ${orgId}`);

    return res.status(200).json({
      success: true,
      revokedCount: revokedTokenDocs.length,
      tokens: revokedTokenDocs.map(t => t.id),
    });
  } catch (err: any) {
    console.error('❌ revoke-creator-share error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
