/**
 * API v1 - Saved Viral Content
 * GET    /api/v1/saved           - List saved videos (optional ?folderId=xxx)
 * POST   /api/v1/saved           - Save a video (from URL or viral library ID)
 * DELETE /api/v1/saved?id=xxx    - Unsave a video
 *
 * Requires `saved:write` scope for POST/DELETE, `saved:read` for GET.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../_utils/firebase-admin.js';
import { withApiAuth } from '../../_middleware/apiKeyAuth.js';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';

initializeFirebase();
const db = getFirestore();

const SAVED_COLLECTION = 'savedViralContent';
const VIRAL_COLLECTION = 'viralContent';

// ─── Router ──────────────────────────────────────────────

async function handler(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  switch (req.method) {
    case 'GET':
      return await listSaved(req, res, auth);
    case 'POST':
      return await saveVideo(req, res, auth);
    case 'DELETE':
      return await unsaveVideo(req, res, auth);
    default:
      return res.status(405).json({
        success: false,
        error: { message: 'Method not allowed. Use GET, POST, or DELETE.', code: 'METHOD_NOT_ALLOWED' }
      });
  }
}

// ─── GET: List Saved Videos ─────────────────────────────

async function listSaved(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const { folderId } = req.query;
  const orgId = auth.organizationId;

  let query: FirebaseFirestore.Query = db
    .collection(`organizations/${orgId}/${SAVED_COLLECTION}`);

  if (folderId && typeof folderId === 'string' && folderId !== 'all') {
    query = query.where('folderId', '==', folderId);
  }

  const snap = await query.limit(200).get();

  // Sort client-side to avoid composite index requirement
  const sortedDocs = snap.docs.sort((a, b) => {
    const aTime = a.data().savedAt?.toMillis?.() || 0;
    const bTime = b.data().savedAt?.toMillis?.() || 0;
    return bTime - aTime;
  });

  const videos = sortedDocs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      videoId: data.videoId,
      folderId: data.folderId || 'default',
      savedAt: data.savedAt?.toDate?.()?.toISOString() || null,
      video: data.video || null,
    };
  });

  return res.status(200).json({
    success: true,
    data: { videos, total: videos.length },
  });
}

// ─── POST: Save a Video ────────────────────────────────

async function saveVideo(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const body = req.body || {};
  const orgId = auth.organizationId;

  if (!body.url || typeof body.url !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Field "url" is required.', code: 'VALIDATION_ERROR' }
    });
  }

  const validPlatforms = ['tiktok', 'instagram', 'youtube', 'twitter'];
  if (!body.platform || !validPlatforms.includes(body.platform)) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Field "platform" is required and must be one of: ${validPlatforms.join(', ')}`,
        code: 'VALIDATION_ERROR'
      }
    });
  }

  const folderId = body.folderId || 'default';

  // Build the video data snapshot
  const videoData: Record<string, any> = {
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
  };

  // Generate a stable ID from the URL so we don't save duplicates
  const docId = Buffer.from(body.url).toString('base64url').slice(0, 40);

  const savedDoc = {
    videoId: docId,
    folderId,
    savedAt: FieldValue.serverTimestamp(),
    video: videoData,
  };

  await db
    .collection(`organizations/${orgId}/${SAVED_COLLECTION}`)
    .doc(docId)
    .set(savedDoc);

  return res.status(201).json({
    success: true,
    data: {
      id: docId,
      folderId,
      video: videoData,
    },
  });
}

// ─── DELETE: Unsave a Video ─────────────────────────────

async function unsaveVideo(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const { id } = req.query;
  const orgId = auth.organizationId;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Query parameter "id" is required.', code: 'VALIDATION_ERROR' }
    });
  }

  const docRef = db
    .collection(`organizations/${orgId}/${SAVED_COLLECTION}`)
    .doc(id);

  const snap = await docRef.get();
  if (!snap.exists) {
    return res.status(404).json({
      success: false,
      error: { message: `Saved video with id "${id}" not found.`, code: 'NOT_FOUND' }
    });
  }

  await docRef.delete();

  return res.status(200).json({
    success: true,
    data: { id, deleted: true },
  });
}

// ─── Export ─────────────────────────────────────────────

// Accept saved:write OR viral:write (extensions may only have viral:write)
export default function routeHandler(req: VercelRequest, res: VercelResponse) {
  return withApiAuth([] as any, async (innerReq, innerRes, auth) => {
    const scopes = auth.apiKey.scopes;
    if (!scopes.includes('saved:write' as any) && !scopes.includes('viral:write' as any)) {
      return innerRes.status(403).json({
        success: false,
        error: {
          message: 'Missing required scope: saved:write or viral:write. Your key has: ' + scopes.join(', '),
          code: 'FORBIDDEN',
        },
      });
    }
    return handler(innerReq, innerRes, auth);
  })(req, res);
}
