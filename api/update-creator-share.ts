/**
 * Update Creator Share Link Settings
 * POST /api/update-creator-share
 *
 * Updates settings on an existing share link (e.g. toggle acceptSubmissions).
 * Authenticated admin-side call.
 *
 * Body: { orgId, token, acceptSubmissions?: boolean }
 * Returns: { success }
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
    const { orgId, token, acceptSubmissions } = req.body || {};

    if (!orgId || !token) {
      return res.status(400).json({ error: 'orgId and token are required' });
    }

    const { role } = await authenticateAndVerifyOrg(req, orgId);
    if (role === 'creator') {
      return res.status(403).json({ error: 'Creators cannot update share links' });
    }

    const shareRef = db.collection('creatorShareLinks').doc(token);
    const shareDoc = await shareRef.get();

    if (!shareDoc.exists || shareDoc.data()?.orgId !== orgId) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    const updates: any = { updatedAt: Timestamp.now() };
    if (typeof acceptSubmissions === 'boolean') {
      updates.acceptSubmissions = acceptSubmissions;
    }

    await shareRef.update(updates);

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('❌ update-creator-share error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
