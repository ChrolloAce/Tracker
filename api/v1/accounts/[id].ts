/**
 * Public API v1 - Single Account Operations
 * GET /api/v1/accounts/:id - Get account details
 * DELETE /api/v1/accounts/:id - Remove tracked account
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../utils/firebase-admin.js';
import { withApiAuth, handleApiError, ApiAuthError } from '../../middleware/apiKeyAuth.js';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';

initializeFirebase();
const db = getFirestore();

function buildAccountUrl(platform: string, username: string): string {
  const platformUrls: Record<string, string> = {
    tiktok: `https://tiktok.com/@${username}`,
    instagram: `https://instagram.com/${username}`,
    youtube: `https://youtube.com/channel/${username}`,
    twitter: `https://x.com/${username}`,
  };
  return platformUrls[platform] || '';
}

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
    case 'PATCH':
      return await updateAccount(req, res, auth, id);
    case 'DELETE':
      return await deleteAccount(req, res, auth, id);
    default:
      return res.status(405).json({
        success: false,
        error: { message: 'Method not allowed. Use GET, PATCH, or DELETE.', code: 'METHOD_NOT_ALLOWED' }
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
      displayName: data.displayName || data.username,
      profilePicUrl: data.profilePicture || '',
      followerCount: data.followerCount || 0,
      followingCount: data.followingCount || 0,
      isVerified: data.isVerified || false,
      accountType: data.accountType || 'my',
      accountUrl: buildAccountUrl(data.platform, data.username),
      totalVideos: data.totalVideos || 0,
      totalViews: data.totalViews || 0,
      totalLikes: data.totalLikes || 0,
      totalComments: data.totalComments || 0,
      syncStatus: data.syncStatus || null,
      lastSynced: data.lastSyncedAt?.toDate?.()?.toISOString() || null,
      lastRefreshed: data.lastRefreshed?.toDate?.()?.toISOString() || data.updatedAt?.toDate?.()?.toISOString() || null,
      dateAdded: data.dateAdded?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString() || null,
      maxVideos: data.maxVideos || 100,
      videoCount: data.videoCount || data.totalVideos || 0,
      ...(includeVideos && { videos })
    }
  });
}

/**
 * Update a tracked account
 */
async function updateAccount(
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

  const { maxVideos, accountType, displayName } = req.body;
  const updates: Record<string, any> = { updatedAt: Timestamp.now() };

  if (maxVideos !== undefined) {
    const num = parseInt(maxVideos);
    if (isNaN(num) || num < 1) {
      return res.status(400).json({
        success: false,
        error: { message: 'maxVideos must be a positive number', code: 'VALIDATION_ERROR' }
      });
    }
    updates.maxVideos = num;
  }

  if (accountType && ['my', 'competitor'].includes(accountType)) {
    updates.accountType = accountType;
  }

  if (displayName && typeof displayName === 'string') {
    updates.displayName = displayName.trim();
  }

  await result.doc.ref.update(updates);

  const updatedDoc = await result.doc.ref.get();
  const data = updatedDoc.data()!;

  return res.status(200).json({
    success: true,
    data: {
      id: updatedDoc.id,
      username: data.username,
      platform: data.platform,
      maxVideos: data.maxVideos,
      accountType: data.accountType,
      displayName: data.displayName,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
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

// GET requires accounts:read, PATCH/DELETE require accounts:write
export default async function routeHandler(req: VercelRequest, res: VercelResponse) {
  const scopes = (req.method === 'DELETE' || req.method === 'PATCH') ? ['accounts:write'] : ['accounts:read'];
  return withApiAuth(scopes as any, handler)(req, res);
}
