/**
 * Create Project Share Link
 * POST /api/create-project-share
 *
 * Generates a public share token for a project.
 * Requires authentication + org membership.
 *
 * Body: { orgId, projectId }
 * Returns: { shareUrl, token }
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { initializeFirebase } from './utils/firebase-admin.js';
import { authenticateAndVerifyOrg } from './middleware/auth.js';
import { setCorsHeaders, handleCorsPreFlight } from './middleware/auth.js';

initializeFirebase();
const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req);

  if (handleCorsPreFlight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orgId, projectId } = req.body || {};

    if (!orgId || !projectId) {
      return res.status(400).json({ error: 'orgId and projectId are required' });
    }

    // Verify auth + org access
    await authenticateAndVerifyOrg(req, orgId);

    // Check project exists
    const projectDoc = await db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .get();

    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if a share already exists for this project
    const existingShares = await db
      .collection('publicProjectShares')
      .where('orgId', '==', orgId)
      .where('projectId', '==', projectId)
      .limit(1)
      .get();

    if (!existingShares.empty) {
      const existingToken = existingShares.docs[0].id;
      const host = req.headers.host || 'viewtrack.app';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      return res.status(200).json({
        success: true,
        token: existingToken,
        shareUrl: `${protocol}://${host}/share/${existingToken}`,
        message: 'Share link already exists for this project',
      });
    }

    // Generate a random token
    const token = randomBytes(16).toString('hex');

    // Store the share mapping
    await db.collection('publicProjectShares').doc(token).set({
      orgId,
      projectId,
      createdAt: new Date(),
    });

    const host = req.headers.host || 'viewtrack.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    return res.status(201).json({
      success: true,
      token,
      shareUrl: `${protocol}://${host}/share/${token}`,
    });
  } catch (error: any) {
    console.error('Create share error:', error);

    if (error.message?.includes('authentication') || error.message?.includes('Access denied')) {
      return res.status(401).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
