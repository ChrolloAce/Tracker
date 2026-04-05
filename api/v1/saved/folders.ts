/**
 * API v1 - Saved Content Folders
 * GET    /api/v1/saved/folders           - List folders
 * POST   /api/v1/saved/folders           - Create a folder
 * PATCH  /api/v1/saved/folders?id=xxx    - Rename a folder
 * DELETE /api/v1/saved/folders?id=xxx    - Delete a folder (moves videos to default)
 *
 * Requires `saved:write` scope.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../_utils/firebase-admin.js';
import { withApiAuth } from '../../_middleware/apiKeyAuth.js';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';

initializeFirebase();
const db = getFirestore();

const FOLDERS_COLLECTION = 'savedViralFolders';
const SAVED_COLLECTION = 'savedViralContent';

// ─── Router ──────────────────────────────────────────────

async function handler(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  switch (req.method) {
    case 'GET':
      return await listFolders(req, res, auth);
    case 'POST':
      return await createFolder(req, res, auth);
    case 'PATCH':
      return await renameFolder(req, res, auth);
    case 'DELETE':
      return await deleteFolder(req, res, auth);
    default:
      return res.status(405).json({
        success: false,
        error: { message: 'Method not allowed. Use GET, POST, PATCH, or DELETE.', code: 'METHOD_NOT_ALLOWED' }
      });
  }
}

// ─── GET: List Folders ──────────────────────────────────

async function listFolders(
  _req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const orgId = auth.organizationId;
  const snap = await db
    .collection(`organizations/${orgId}/${FOLDERS_COLLECTION}`)
    .orderBy('createdAt', 'asc')
    .get();

  const folders = snap.docs.map((d) => ({
    id: d.id,
    name: d.data().name,
    createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null,
  }));

  return res.status(200).json({
    success: true,
    data: { folders },
  });
}

// ─── POST: Create Folder ────────────────────────────────

async function createFolder(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const { name } = req.body || {};
  const orgId = auth.organizationId;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Field "name" is required.', code: 'VALIDATION_ERROR' }
    });
  }

  const ref = await db
    .collection(`organizations/${orgId}/${FOLDERS_COLLECTION}`)
    .add({ name: name.trim(), createdAt: FieldValue.serverTimestamp() });

  return res.status(201).json({
    success: true,
    data: { id: ref.id, name: name.trim() },
  });
}

// ─── PATCH: Rename Folder ───────────────────────────────

async function renameFolder(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const { id } = req.query;
  const { name } = req.body || {};
  const orgId = auth.organizationId;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Query parameter "id" is required.', code: 'VALIDATION_ERROR' }
    });
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Field "name" is required.', code: 'VALIDATION_ERROR' }
    });
  }

  const ref = db.collection(`organizations/${orgId}/${FOLDERS_COLLECTION}`).doc(id as string);
  const snap = await ref.get();

  if (!snap.exists) {
    return res.status(404).json({
      success: false,
      error: { message: `Folder "${id}" not found.`, code: 'NOT_FOUND' }
    });
  }

  await ref.update({ name: name.trim() });

  return res.status(200).json({
    success: true,
    data: { id, name: name.trim() },
  });
}

// ─── DELETE: Delete Folder ──────────────────────────────

async function deleteFolder(
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

  const folderRef = db.collection(`organizations/${orgId}/${FOLDERS_COLLECTION}`).doc(id as string);
  const folderSnap = await folderRef.get();

  if (!folderSnap.exists) {
    return res.status(404).json({
      success: false,
      error: { message: `Folder "${id}" not found.`, code: 'NOT_FOUND' }
    });
  }

  // Move all videos in this folder to 'default'
  const videosInFolder = await db
    .collection(`organizations/${orgId}/${SAVED_COLLECTION}`)
    .where('folderId', '==', id)
    .get();

  const batch = db.batch();
  videosInFolder.docs.forEach((d) => {
    batch.update(d.ref, { folderId: 'default' });
  });
  batch.delete(folderRef);
  await batch.commit();

  return res.status(200).json({
    success: true,
    data: { id, deleted: true, videosMoved: videosInFolder.size },
  });
}

// ─── Export ─────────────────────────────────────────────

export default withApiAuth(['saved:write'] as any, handler);
