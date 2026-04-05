/**
 * Create/Get Folder Share Link
 * POST /api/create-folder-share
 *
 * Generates a public share token for a saved viral folder.
 * Requires authentication + org membership.
 *
 * Body: { orgId, folderId, folderName }
 * Returns: { shareUrl, token }
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
    const { orgId, folderId, folderName } = req.body || {};

    if (!orgId || !folderId) {
      return res.status(400).json({ error: 'orgId and folderId are required' });
    }

    await authenticateAndVerifyOrg(req, orgId);

    // Check if share already exists — single field query to avoid composite index
    const allShares = await db
      .collection('publicFolderShares')
      .where('folderId', '==', folderId)
      .limit(10)
      .get();

    // Filter by orgId client-side
    const existing = {
      empty: !allShares.docs.some((d) => d.data().orgId === orgId),
      docs: allShares.docs.filter((d) => d.data().orgId === orgId),
    };

    if (!existing.empty) {
      const token = existing.docs[0].id;
      const host = req.headers.host || 'viewtrack.app';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      return res.status(200).json({
        success: true,
        token,
        shareUrl: `${protocol}://${host}/shared/${token}`,
        existing: true,
      });
    }

    // Generate new token
    const token = randomBytes(16).toString('hex');

    await db.collection('publicFolderShares').doc(token).set({
      orgId,
      folderId,
      folderName: folderName || 'Shared Collection',
      createdAt: Timestamp.now(),
    });

    const host = req.headers.host || 'viewtrack.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    return res.status(201).json({
      success: true,
      token,
      shareUrl: `${protocol}://${host}/shared/${token}`,
    });
  } catch (err: any) {
    console.error('Failed to create folder share:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
