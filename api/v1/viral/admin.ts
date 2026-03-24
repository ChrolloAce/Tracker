/**
 * Admin API v1 - Viral Content Management
 * POST   /api/v1/viral/admin        - Add a new viral video
 * DELETE /api/v1/viral/admin?id=xxx  - Remove a viral video
 *
 * Requires the `viral:write` scope.
 * See also: admin/cleanup.ts for the batch-cleanup endpoint.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../utils/firebase-admin.js';
import { withApiAuth } from '../../middleware/apiKeyAuth.js';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';

initializeFirebase();
const db = getFirestore();

const VIRAL_COLLECTION = 'viralContent';

// ─── Router ──────────────────────────────────────────────

async function handler(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  switch (req.method) {
    case 'POST':
      return await addViralVideo(req, res, auth);
    case 'DELETE':
      return await removeViralVideo(req, res, auth);
    default:
      return res.status(405).json({
        success: false,
        error: { message: 'Method not allowed. Use POST or DELETE.', code: 'METHOD_NOT_ALLOWED' }
      });
  }
}

// ─── POST: Add Viral Video ──────────────────────────────

async function addViralVideo(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const body = req.body || {};

  // Validate required fields
  if (!body.url || typeof body.url !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Field "url" is required and must be a string.', code: 'VALIDATION_ERROR' }
    });
  }

  const validPlatforms = ['tiktok', 'instagram', 'youtube'];
  if (!body.platform || !validPlatforms.includes(body.platform)) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Field "platform" is required and must be one of: ${validPlatforms.join(', ')}`,
        code: 'VALIDATION_ERROR'
      }
    });
  }

  const validContentTypes = ['video', 'slideshow'];
  if (body.contentType && !validContentTypes.includes(body.contentType)) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Field "contentType" must be one of: ${validContentTypes.join(', ')}`,
        code: 'VALIDATION_ERROR'
      }
    });
  }

  if (body.tags && !Array.isArray(body.tags)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Field "tags" must be an array of strings.', code: 'VALIDATION_ERROR' }
    });
  }

  // Check for duplicate URL
  const existingSnap = await db
    .collection(VIRAL_COLLECTION)
    .where('url', '==', body.url)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    return res.status(409).json({
      success: false,
      error: { message: 'A viral video with this URL already exists.', code: 'ALREADY_EXISTS' }
    });
  }

  // Determine next order value
  const lastOrderSnap = await db
    .collection(VIRAL_COLLECTION)
    .orderBy('order', 'desc')
    .limit(1)
    .get();

  const nextOrder = lastOrderSnap.empty ? 1 : (lastOrderSnap.docs[0].data().order || 0) + 1;

  const now = Timestamp.now();

  const newVideo: Record<string, any> = {
    order: nextOrder,
    url: body.url,
    platform: body.platform,
    title: body.title || '',
    description: body.description || '',
    thumbnail: body.thumbnail || '',
    uploaderHandle: body.uploaderHandle || '',
    views: typeof body.views === 'number' ? body.views : 0,
    likes: typeof body.likes === 'number' ? body.likes : 0,
    comments: typeof body.comments === 'number' ? body.comments : 0,
    shares: typeof body.shares === 'number' ? body.shares : 0,
    saves: typeof body.saves === 'number' ? body.saves : 0,
    followerCount: typeof body.followerCount === 'number' ? body.followerCount : 0,
    contentType: body.contentType || 'video',
    category: body.category || '',
    tags: Array.isArray(body.tags) ? body.tags : [],
    monetization: body.monetization || null,
    productBrand: body.productBrand || null,
    uploadDate: now,
    addedAt: now,
    addedBy: auth.apiKey.id,
    isActive: true,
  };

  const docRef = await db.collection(VIRAL_COLLECTION).add(newVideo);

  return res.status(201).json({
    success: true,
    data: {
      id: docRef.id,
      ...newVideo,
      uploadDate: now.toDate().toISOString(),
      addedAt: now.toDate().toISOString(),
    },
  });
}

// ─── DELETE: Remove Viral Video ──────────────────────────

async function removeViralVideo(
  req: VercelRequest,
  res: VercelResponse,
  _auth: AuthenticatedApiRequest
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Query parameter "id" is required.', code: 'VALIDATION_ERROR' }
    });
  }

  const docRef = db.collection(VIRAL_COLLECTION).doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    return res.status(404).json({
      success: false,
      error: { message: `Viral video with id "${id}" not found.`, code: 'NOT_FOUND' }
    });
  }

  await docRef.delete();

  return res.status(200).json({
    success: true,
    data: {
      id,
      deleted: true,
    },
  });
}

// ─── Export ──────────────────────────────────────────────

export default withApiAuth(['viral:write'] as any, handler);
