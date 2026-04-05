/**
 * Public API v1 - Viral Content by ID
 * GET /api/v1/viral/:id - Get a single viral video
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../_utils/firebase-admin.js';
import { withApiAuth } from '../../_middleware/apiKeyAuth.js';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';

initializeFirebase();
const db = getFirestore();

async function handler(
  req: VercelRequest,
  res: VercelResponse,
  _auth: AuthenticatedApiRequest
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { message: 'Method not allowed. Use GET.', code: 'METHOD_NOT_ALLOWED' }
    });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Video ID is required', code: 'MISSING_ID' }
    });
  }

  try {
    const doc = await db.collection('viralContent').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: { message: 'Viral video not found', code: 'NOT_FOUND' }
      });
    }

    const d = doc.data()!;
    return res.status(200).json({
      success: true,
      data: {
        id: doc.id,
        url: d.url,
        platform: d.platform,
        title: d.title,
        description: d.description,
        thumbnail: d.thumbnail,
        contentType: d.contentType,
        category: d.category,
        tags: d.tags || [],
        uploaderHandle: d.uploaderHandle,
        followerCount: d.followerCount,
        monetization: d.monetization || null,
        productBrand: d.productBrand || null,
        metrics: {
          views: d.views || 0,
          likes: d.likes || 0,
          comments: d.comments || 0,
          shares: d.shares || 0,
          saves: d.saves || 0,
        },
        uploadDate: d.uploadDate?.toDate?.()?.toISOString() || null,
        addedAt: d.addedAt?.toDate?.()?.toISOString() || null,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to fetch viral video',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}

export default function routeHandler(req: VercelRequest, res: VercelResponse) {
  return withApiAuth(['analytics:read'] as any, handler)(req, res);
}
