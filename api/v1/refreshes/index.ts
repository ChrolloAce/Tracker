/**
 * Public API v1 - Refresh History
 * GET /api/v1/refreshes - Get refresh session data for a time period
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../utils/firebase-admin';
import { withApiAuth } from '../../middleware/apiKeyAuth';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';

initializeFirebase();
const db = getFirestore();

async function handler(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }
    });
  }

  const {
    startDate,
    endDate,
    limit = '20',
    offset = '0',
  } = req.query;

  const orgRef = db.collection('organizations').doc(auth.organizationId);

  // Build sessions query
  let sessionsQuery: FirebaseFirestore.Query = orgRef
    .collection('refreshSessions')
    .orderBy('startedAt', 'desc');

  // Filter by date range if provided
  if (startDate && typeof startDate === 'string') {
    sessionsQuery = sessionsQuery.where('startedAt', '>=', new Date(startDate));
  }
  if (endDate && typeof endDate === 'string') {
    sessionsQuery = sessionsQuery.where('startedAt', '<=', new Date(endDate));
  }

  const limitNum = Math.min(parseInt(limit as string) || 20, 100);
  const offsetNum = parseInt(offset as string) || 0;

  const snapshot = await sessionsQuery.limit(limitNum + offsetNum).get();
  const docs = snapshot.docs.slice(offsetNum).slice(0, limitNum);

  const sessions = docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      status: data.status,
      startedAt: data.startedAt?.toDate?.()?.toISOString(),
      completedAt: data.completedAt?.toDate?.()?.toISOString(),
      durationMs: data.durationMs || null,
      totalAccounts: data.totalAccounts || 0,
      processedAccounts: data.processedAccounts || 0,
      failedAccounts: data.failedAccounts || 0,
      totalVideosRefreshed: data.totalVideosRefreshed || 0,
      totalNewVideosFound: data.totalNewVideosFound || 0,
      errors: data.errors || [],
      accountResults: data.accountResults || [],
    };
  });

  // Overall summary stats
  const allSessionsSnap = await orgRef
    .collection('refreshSessions')
    .orderBy('startedAt', 'desc')
    .limit(100)
    .get();

  let totalRefreshes = allSessionsSnap.size;
  let totalVideosRefreshed = 0;
  let totalNewVideos = 0;
  let totalFailures = 0;

  allSessionsSnap.docs.forEach((d) => {
    const data = d.data();
    totalVideosRefreshed += data.totalVideosRefreshed || 0;
    totalNewVideos += data.totalNewVideosFound || 0;
    totalFailures += data.failedAccounts || 0;
  });

  return res.status(200).json({
    success: true,
    data: {
      sessions,
      summary: {
        totalRefreshes,
        totalVideosRefreshed,
        totalNewVideos,
        totalFailures,
      },
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total: snapshot.size,
        hasMore: snapshot.size > offsetNum + limitNum,
      },
    },
  });
}

export default withApiAuth(['analytics:read'], handler);
