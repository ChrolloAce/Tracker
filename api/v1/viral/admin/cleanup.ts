/**
 * Admin API v1 - Viral Content Cleanup
 * POST /api/v1/viral/admin/cleanup - Remove all viral videos with 0 views AND 0 likes
 *
 * Requires the `viral:write` scope.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../../_utils/firebase-admin.js';
import { withApiAuth } from '../../../_middleware/apiKeyAuth.js';
import type { AuthenticatedApiRequest } from '../../../../src/types/apiKeys';

initializeFirebase();
const db = getFirestore();

const VIRAL_COLLECTION = 'viralContent';

// ─── POST: Cleanup Broken Videos ─────────────────────────

async function handler(
  req: VercelRequest,
  res: VercelResponse,
  _auth: AuthenticatedApiRequest
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: { message: 'Method not allowed. Use POST.', code: 'METHOD_NOT_ALLOWED' }
    });
  }

  // Query all viralContent docs where views == 0 AND likes == 0
  const snapshot = await db
    .collection(VIRAL_COLLECTION)
    .where('views', '==', 0)
    .where('likes', '==', 0)
    .get();

  if (snapshot.empty) {
    return res.status(200).json({
      success: true,
      data: {
        deletedCount: 0,
        message: 'No broken viral videos found.',
      },
    });
  }

  // Batch delete (Firestore batch limit is 500 per commit)
  const BATCH_LIMIT = 500;
  let deletedCount = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    batchCount++;
    deletedCount++;

    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit any remaining deletes
  if (batchCount > 0) {
    await batch.commit();
  }

  return res.status(200).json({
    success: true,
    data: {
      deletedCount,
      message: `Removed ${deletedCount} viral video(s) with 0 views and 0 likes.`,
    },
  });
}

// ─── Export ──────────────────────────────────────────────

export default withApiAuth(['viral:write'] as any, handler);
