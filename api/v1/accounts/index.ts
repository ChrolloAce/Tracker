/**
 * Public API v1 - Tracked Accounts
 * GET  /api/v1/accounts - List all tracked accounts
 * POST /api/v1/accounts - Add new tracked account (triggers sync queue)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../utils/firebase-admin.js';
import { withApiAuth } from '../../middleware/apiKeyAuth.js';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';

const JOB_PRIORITY_USER_INITIATED = 100;
const BASE_URL = 'https://www.viewtrack.app';
const DEFAULT_MAX_VIDEOS = 10;

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

// ─── GET: List Accounts ──────────────────────────────────

async function listAccounts(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const { projectId, platform, limit = '50', offset = '0' } = req.query;

  let query: FirebaseFirestore.Query = db
    .collectionGroup('trackedAccounts')
    .where('organizationId', '==', auth.organizationId);

  const targetProjectId = auth.projectId || projectId;
  if (targetProjectId) {
    query = query.where('projectId', '==', targetProjectId);
  }

  if (platform && typeof platform === 'string') {
    query = query.where('platform', '==', platform);
  }

  const limitNum = Math.min(parseInt(limit as string) || 50, 100);
  const offsetNum = parseInt(offset as string) || 0;
  const snapshot = await query.limit(limitNum + offsetNum).get();

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
        maxVideos: data.maxVideos || DEFAULT_MAX_VIDEOS,
        status: data.status,
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

// ─── POST: Add Account ──────────────────────────────────

async function addAccount(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const { username, platform, projectId, maxVideos } = req.body;

  // ── Validate inputs ───────────────────────────────────
  if (!username || !platform) {
    return res.status(400).json({
      success: false,
      error: { message: 'Username and platform are required', code: 'VALIDATION_ERROR' }
    });
  }

  const validPlatforms = ['instagram', 'tiktok', 'youtube', 'twitter'];
  if (!validPlatforms.includes(platform)) {
    return res.status(400).json({
      success: false,
      error: { message: `Invalid platform. Use: ${validPlatforms.join(', ')}`, code: 'VALIDATION_ERROR' }
    });
  }

  const targetProjectId = auth.projectId || projectId;
  if (!targetProjectId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Project ID required', code: 'VALIDATION_ERROR' }
    });
  }

  // Sanitize & clamp maxVideos
  const videoLimit = Math.min(Math.max(parseInt(maxVideos) || DEFAULT_MAX_VIDEOS, 1), 50);
  const cleanUsername = username.toLowerCase().replace(/^@/, '');

  // ── Check for duplicate ───────────────────────────────
  const accountsCol = db
    .collection('organizations')
    .doc(auth.organizationId)
    .collection('projects')
    .doc(targetProjectId)
    .collection('trackedAccounts');

  const existingQuery = await accountsCol
    .where('username', '==', cleanUsername)
    .where('platform', '==', platform)
    .limit(1)
    .get();

  if (!existingQuery.empty) {
    return res.status(409).json({
      success: false,
      error: { message: 'Account already being tracked', code: 'ALREADY_EXISTS' }
    });
  }

  // ── Step 1: Create tracked account document ───────────
  const accountData = {
    username: cleanUsername,
    platform,
    organizationId: auth.organizationId,
    projectId: targetProjectId,
    status: 'processing',
    syncStatus: 'pending',
    maxVideos: videoLimit,
    totalVideos: 0,
    totalViews: 0,
    totalLikes: 0,
    isActive: true,
    addedBy: 'api',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  const docRef = await accountsCol.add(accountData);
  console.log(`👤 [API] Account doc created: ${docRef.id} for @${cleanUsername} (${platform})`);

  // ── Step 2: Create high-priority syncQueue job ────────
  const jobRef = db.collection('syncQueue').doc();
  await jobRef.set({
    type: 'account_sync',
    status: 'pending',
    syncStrategy: 'direct',
    maxVideos: videoLimit,
    orgId: auth.organizationId,
    projectId: targetProjectId,
    accountId: docRef.id,
    sessionId: null,
    accountUsername: cleanUsername,
    accountPlatform: platform,
    createdAt: Timestamp.now(),
    startedAt: null,
    completedAt: null,
    attempts: 0,
    maxAttempts: 3,
    priority: JOB_PRIORITY_USER_INITIATED,
    error: null,
    userInitiated: true,
    addedBy: 'api'
  });
  console.log(`📋 [API] SyncQueue job created: ${jobRef.id} (maxVideos=${videoLimit})`);

  // ── Step 3: Dispatch for immediate processing ─────────
  let processingStatus = 'queued';
  const cronSecret = process.env.CRON_SECRET;

  try {
    const dispatchResponse = await fetch(`${BASE_URL}/api/sync-single-account`, {
      method: 'POST',
      headers: {
        'Authorization': cronSecret || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orgId: auth.organizationId,
        projectId: targetProjectId,
        accountId: docRef.id,
        sessionId: null,
        jobId: jobRef.id
      })
    });

    if (dispatchResponse.ok) {
      await jobRef.update({ status: 'running', startedAt: Timestamp.now() });
      processingStatus = 'processing';
      console.log(`⚡ [API] Immediate dispatch successful for @${cleanUsername}`);
    } else {
      console.warn(`⚠️ [API] Dispatch returned ${dispatchResponse.status}, falling back to queue`);
    }
  } catch (dispatchError: any) {
    console.warn(`⚠️ [API] Immediate dispatch failed: ${dispatchError.message}, job stays queued`);

    // Fire-and-forget queue-worker fallback
    fetch(`${BASE_URL}/api/queue-worker`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cronSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'api_account_added' })
    }).catch(() => {});
  }

  return res.status(201).json({
    success: true,
    data: {
      id: docRef.id,
      username: cleanUsername,
      platform,
      maxVideos: videoLimit,
      status: processingStatus,
      jobId: jobRef.id,
      message: processingStatus === 'processing'
        ? `Account @${cleanUsername} dispatched for immediate sync. Up to ${videoLimit} videos will be fetched.`
        : `Account @${cleanUsername} queued for sync. Up to ${videoLimit} videos will be fetched shortly.`,
      endpoints: {
        poll: `/api/v1/accounts/${docRef.id}?projectId=${targetProjectId}`,
      }
    }
  });
}

// ─── Export ──────────────────────────────────────────────

export default withApiAuth(['accounts:read'], handler);
