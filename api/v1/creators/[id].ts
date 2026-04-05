/**
 * Public API v1 - Single Creator
 * GET /api/v1/creators/:id - Get creator details with stats and linked accounts
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../_utils/firebase-admin.js';
import { withApiAuth } from '../../_middleware/apiKeyAuth.js';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';
import { getCreatorById } from './statsHelper.js';

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

  const { id, projectId, includeVideos } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Creator ID required', code: 'VALIDATION_ERROR' }
    });
  }

  const targetProjectId = auth.projectId || projectId;

  if (!targetProjectId || typeof targetProjectId !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Project ID is required. Provide it as a query parameter or use a project-scoped API key.',
        code: 'VALIDATION_ERROR'
      }
    });
  }

  // Fetch single creator with stats (avoids loading all creators)
  const creator = await getCreatorById(auth.organizationId, targetProjectId, id);

  if (!creator) {
    return res.status(404).json({
      success: false,
      error: { message: 'Creator not found', code: 'NOT_FOUND' }
    });
  }

  // Optionally include recent videos from linked accounts
  let recentVideos: any[] | undefined;

  if (includeVideos === 'true' && creator.linkedAccounts.length > 0) {
    const videosRef = db
      .collection('organizations').doc(auth.organizationId)
      .collection('projects').doc(targetProjectId)
      .collection('videos');

    // Fetch videos per linked account — single-field where avoids composite index requirement.
    // Batch in groups of 5 to avoid overwhelming Firestore.
    const allVideos: any[] = [];
    const seen = new Set<string>();
    const BATCH_SIZE = 5;

    for (let i = 0; i < creator.linkedAccounts.length; i += BATCH_SIZE) {
      const batch = creator.linkedAccounts.slice(i, i + BATCH_SIZE);
      const videoSnapshots = await Promise.all(
        batch.map(account =>
          videosRef
            .where('trackedAccountId', '==', account.id)
            .orderBy('uploadDate', 'desc')
            .limit(20)
            .get()
        )
      );

      for (const snap of videoSnapshots) {
        for (const doc of snap.docs) {
          if (seen.has(doc.id)) continue;
          seen.add(doc.id);
          const data = doc.data();
          allVideos.push({
            id: doc.id,
            platform: data.platform || '',
            title: data.videoTitle || data.title || '',
            url: data.videoUrl || data.url || '',
            thumbnail: data.thumbnail || '',
            views: data.views || 0,
            likes: data.likes || 0,
            comments: data.comments || 0,
            shares: data.shares || 0,
            uploadDate: data.uploadDate?.toDate?.()?.toISOString() || null,
          });
        }
      }
    }

    // Sort by views descending in memory, cap at 50
    recentVideos = allVideos
      .sort((a, b) => b.views - a.views)
      .slice(0, 50);
  }

  return res.status(200).json({
    success: true,
    data: {
      ...creator,
      ...(recentVideos !== undefined && { recentVideos })
    }
  });
}

export default withApiAuth(['creators:read'], handler);
