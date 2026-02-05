/**
 * Public API v1 - Single Account Operations
 * GET /api/v1/accounts/:id - Get account details
 * DELETE /api/v1/accounts/:id - Remove tracked account
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../utils/firebase-admin';
import { withApiAuth, handleApiError, ApiAuthError } from '../../middleware/apiKeyAuth';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';

initializeFirebase();
const db = getFirestore();

async function handler(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Account ID required', code: 'VALIDATION_ERROR' }
    });
  }

  switch (req.method) {
    case 'GET':
      return await getAccount(req, res, auth, id);
    case 'DELETE':
      return await deleteAccount(req, res, auth, id);
    default:
      return res.status(405).json({
        success: false,
        error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }
      });
  }
}

/**
 * Find account across all projects in organization
 */
async function findAccount(orgId: string, accountId: string, projectId?: string) {
  // If we have a specific project, search there first
  if (projectId) {
    const docRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('trackedAccounts')
      .doc(accountId);
    
    const doc = await docRef.get();
    if (doc.exists) {
      return { doc, projectId };
    }
  }
  
  // Search across all projects
  const projectsSnapshot = await db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .get();
  
  for (const projectDoc of projectsSnapshot.docs) {
    const accountDoc = await projectDoc.ref
      .collection('trackedAccounts')
      .doc(accountId)
      .get();
    
    if (accountDoc.exists) {
      return { doc: accountDoc, projectId: projectDoc.id };
    }
  }
  
  return null;
}

/**
 * Get account details with videos
 */
async function getAccount(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest,
  accountId: string
) {
  const result = await findAccount(auth.organizationId, accountId, auth.projectId);
  
  if (!result) {
    return res.status(404).json({
      success: false,
      error: { message: 'Account not found', code: 'NOT_FOUND' }
    });
  }
  
  const { doc, projectId } = result;
  const data = doc.data()!;
  
  // Optionally include videos
  const includeVideos = req.query.includeVideos === 'true';
  let videos: any[] = [];
  
  if (includeVideos) {
    const videosSnapshot = await db
      .collection('organizations')
      .doc(auth.organizationId)
      .collection('projects')
      .doc(projectId)
      .collection('videos')
      .where('uploaderHandle', '==', data.username)
      .orderBy('uploadDate', 'desc')
      .limit(50)
      .get();
    
    videos = videosSnapshot.docs.map(vDoc => {
      const vData = vDoc.data();
      return {
        id: vDoc.id,
        url: vData.url,
        thumbnail: vData.thumbnail,
        title: vData.title,
        views: vData.views,
        likes: vData.likes,
        comments: vData.comments,
        uploadDate: vData.uploadDate?.toDate?.()?.toISOString()
      };
    });
  }
  
  return res.status(200).json({
    success: true,
    data: {
      id: doc.id,
      username: data.username,
      platform: data.platform,
      profilePicture: data.profilePicture,
      followerCount: data.followerCount,
      totalVideos: data.totalVideos || 0,
      totalViews: data.totalViews || 0,
      totalLikes: data.totalLikes || 0,
      totalComments: data.totalComments || 0,
      syncStatus: data.syncStatus,
      lastSyncedAt: data.lastSyncedAt?.toDate?.()?.toISOString(),
      createdAt: data.createdAt?.toDate?.()?.toISOString(),
      ...(includeVideos && { videos })
    }
  });
}

/**
 * Delete a tracked account
 */
async function deleteAccount(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest,
  accountId: string
) {
  const result = await findAccount(auth.organizationId, accountId, auth.projectId);
  
  if (!result) {
    return res.status(404).json({
      success: false,
      error: { message: 'Account not found', code: 'NOT_FOUND' }
    });
  }
  
  // Delete the account
  await result.doc.ref.delete();
  
  return res.status(200).json({
    success: true,
    message: 'Account removed from tracking'
  });
}

// GET requires accounts:read, DELETE requires accounts:write
export default async function routeHandler(req: VercelRequest, res: VercelResponse) {
  const scopes = req.method === 'DELETE' ? ['accounts:write'] : ['accounts:read'];
  return withApiAuth(scopes as any, handler)(req, res);
}
