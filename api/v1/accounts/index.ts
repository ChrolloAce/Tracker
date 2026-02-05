/**
 * Public API v1 - Tracked Accounts
 * GET /api/v1/accounts - List all tracked accounts
 * POST /api/v1/accounts - Add new tracked account
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../utils/firebase-admin';
import { withApiAuth, handleApiError } from '../../middleware/apiKeyAuth';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';

initializeFirebase();
const db = getFirestore();

async function handler(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  switch (req.method) {
    case 'GET':
      return await listAccounts(req, res, auth);
    case 'POST':
      return await addAccount(req, res, auth);
    default:
      return res.status(405).json({
        success: false,
        error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }
      });
  }
}

/**
 * List all tracked accounts for organization
 */
async function listAccounts(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const { projectId, platform, limit = '50', offset = '0' } = req.query;
  
  // Build query
  let query: FirebaseFirestore.Query = db
    .collectionGroup('trackedAccounts')
    .where('organizationId', '==', auth.organizationId);
  
  // Filter by project if specified (or if API key is scoped to project)
  const targetProjectId = auth.projectId || projectId;
  if (targetProjectId) {
    query = query.where('projectId', '==', targetProjectId);
  }
  
  // Filter by platform
  if (platform && typeof platform === 'string') {
    query = query.where('platform', '==', platform);
  }
  
  // Apply pagination
  const limitNum = Math.min(parseInt(limit as string) || 50, 100);
  const offsetNum = parseInt(offset as string) || 0;
  
  const snapshot = await query.limit(limitNum + offsetNum).get();
  
  // Skip offset docs and map results
  const accounts = snapshot.docs
    .slice(offsetNum)
    .slice(0, limitNum)
    .map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        username: data.username,
        platform: data.platform,
        profilePicture: data.profilePicture,
        followerCount: data.followerCount,
        totalVideos: data.totalVideos || 0,
        totalViews: data.totalViews || 0,
        totalLikes: data.totalLikes || 0,
        lastSyncedAt: data.lastSyncedAt?.toDate?.()?.toISOString(),
        createdAt: data.createdAt?.toDate?.()?.toISOString()
      };
    });
  
  return res.status(200).json({
    success: true,
    data: {
      accounts,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total: snapshot.size,
        hasMore: snapshot.size > offsetNum + limitNum
      }
    }
  });
}

/**
 * Add a new tracked account
 */
async function addAccount(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const { username, platform, projectId } = req.body;
  
  if (!username || !platform) {
    return res.status(400).json({
      success: false,
      error: { message: 'Username and platform are required', code: 'VALIDATION_ERROR' }
    });
  }
  
  if (!['instagram', 'tiktok', 'youtube', 'twitter'].includes(platform)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid platform. Use: instagram, tiktok, youtube, or twitter', code: 'VALIDATION_ERROR' }
    });
  }
  
  const targetProjectId = auth.projectId || projectId;
  if (!targetProjectId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Project ID required', code: 'VALIDATION_ERROR' }
    });
  }
  
  // Check if account already exists
  const existingQuery = await db
    .collection('organizations')
    .doc(auth.organizationId)
    .collection('projects')
    .doc(targetProjectId)
    .collection('trackedAccounts')
    .where('username', '==', username.toLowerCase())
    .where('platform', '==', platform)
    .limit(1)
    .get();
  
  if (!existingQuery.empty) {
    return res.status(409).json({
      success: false,
      error: { message: 'Account already being tracked', code: 'ALREADY_EXISTS' }
    });
  }
  
  // Create the tracked account
  const accountData = {
    username: username.toLowerCase(),
    platform,
    organizationId: auth.organizationId,
    projectId: targetProjectId,
    status: 'pending',
    syncStatus: 'pending',
    totalVideos: 0,
    totalViews: 0,
    totalLikes: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const docRef = await db
    .collection('organizations')
    .doc(auth.organizationId)
    .collection('projects')
    .doc(targetProjectId)
    .collection('trackedAccounts')
    .add(accountData);
  
  return res.status(201).json({
    success: true,
    data: {
      id: docRef.id,
      ...accountData,
      createdAt: accountData.createdAt.toISOString()
    },
    message: 'Account added. Data will be synced shortly.'
  });
}

// Export with authentication wrapper
export default withApiAuth(['accounts:read'], handler);
