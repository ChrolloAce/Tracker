/**
 * Public API v1 - Tracked Accounts
 * GET  /api/v1/accounts - List all tracked accounts
 * POST /api/v1/accounts - Add new tracked account (triggers sync queue)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../utils/firebase-admin.js';
import { withApiAuth } from '../../middleware/apiKeyAuth.js';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';

const JOB_PRIORITY_USER_INITIATED = 100;
const BASE_URL = 'https://www.viewtrack.app';
const DEFAULT_MAX_VIDEOS = 10;
const COLL_ORGS = 'organizations';
const COLL_PROJECTS = 'projects';
const COLL_ACCOUNTS = 'trackedAccounts';

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

// ─── POST: Add Account (or re-discover existing) ───────

async function addAccount(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const { username, platform, projectId, maxVideos } = req.body;

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

  const videoLimit = Math.min(Math.max(parseInt(maxVideos) || DEFAULT_MAX_VIDEOS, 1), 50);
  const cleanUsername = username.toLowerCase().replace(/^@/, '');

  const accountsCol = db
    .collection(COLL_ORGS).doc(auth.organizationId)
    .collection(COLL_PROJECTS).doc(targetProjectId)
    .collection(COLL_ACCOUNTS);

  const existingQuery = await accountsCol
    .where('username', '==', cleanUsername)
    .where('platform', '==', platform)
    .limit(1)
    .get();

  // ── Existing account → trigger re-discovery ────────────
  if (!existingQuery.empty) {
    return await triggerRediscovery(
      existingQuery.docs[0], cleanUsername, platform, videoLimit,
      auth.organizationId, targetProjectId, res
    );
  }

  // ── New account → create doc + update stats ────────────
  return await createNewAccount(
    cleanUsername, platform, videoLimit,
    auth.organizationId, targetProjectId, accountsCol, res
  );
}

// ─── Re-discover existing account ────────────────────────

async function triggerRediscovery(
  existingDoc: FirebaseFirestore.QueryDocumentSnapshot,
  username: string,
  platform: string,
  videoLimit: number,
  orgId: string,
  projectId: string,
  res: VercelResponse
) {
  const accountId = existingDoc.id;
  const accountData = existingDoc.data();
  console.log(`🔄 [API] Account @${username} already exists (${accountId}), triggering re-discovery`);

  // Update maxVideos if caller wants more
  if (videoLimit > (accountData.maxVideos || 0)) {
    await existingDoc.ref.update({ maxVideos: videoLimit, updatedAt: Timestamp.now() });
  }

  // Create sync job + dispatch
  const { jobId, processingStatus } = await createSyncJobAndDispatch(
    accountId, username, platform, videoLimit, orgId, projectId
  );

  return res.status(200).json({
    success: true,
    data: {
      id: accountId,
      username,
      platform,
      maxVideos: Math.max(videoLimit, accountData.maxVideos || 0),
      status: processingStatus,
      jobId,
      isExisting: true,
      message: `Re-discovery launched for @${username}. Up to ${videoLimit} newest videos will be checked.`,
      endpoints: { poll: `/api/v1/accounts/${accountId}?projectId=${projectId}` }
    }
  });
}

// ─── Create brand-new account ────────────────────────────

async function createNewAccount(
  username: string,
  platform: string,
  videoLimit: number,
  orgId: string,
  projectId: string,
  accountsCol: FirebaseFirestore.CollectionReference,
  res: VercelResponse
) {
  // Use deterministic ID (mirrors manual flow)
  const normalizedUser = username.replace(/[^a-z0-9_.-]/g, '_');
  const deterministicId = `${platform}_${normalizedUser}`;
  const accountRef = accountsCol.doc(deterministicId);

  const accountData = {
    id: deterministicId,
    username,
    platform,
    organizationId: orgId,
    projectId,
    status: 'processing',
    syncStatus: 'pending',
    maxVideos: videoLimit,
    creatorType: 'automatic',
    displayName: username,
    profilePicture: '',
    followerCount: 0,
    followingCount: 0,
    postCount: 0,
    bio: '',
    isVerified: false,
    totalVideos: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    isActive: true,
    isRead: false,
    addedBy: 'api',
    syncRequestedBy: 'api',
    syncRequestedAt: Timestamp.now(),
    syncRetryCount: 0,
    maxRetries: 3,
    syncProgress: { current: 0, total: 100, message: 'Queued for sync...' },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  // Batch: create account + increment project trackedAccountCount
  const projectRef = db
    .collection(COLL_ORGS).doc(orgId)
    .collection(COLL_PROJECTS).doc(projectId);

  const batch = db.batch();
  batch.set(accountRef, accountData);
  batch.update(projectRef, {
    trackedAccountCount: FieldValue.increment(1),
    updatedAt: Timestamp.now()
  });
  await batch.commit();
  console.log(`👤 [API] Account created: ${deterministicId}, project stats updated`);

  // Increment org usage counter (non-critical)
  try {
    const usageRef = db.collection(COLL_ORGS).doc(orgId).collection('billing').doc('usage');
    await usageRef.update({
      trackedAccounts: FieldValue.increment(1),
      lastUpdated: Timestamp.now()
    });
    console.log(`📊 [API] Org usage counter incremented for ${orgId}`);
  } catch (usageErr: any) {
    console.warn(`⚠️ [API] Usage counter update failed (non-critical): ${usageErr.message}`);
  }

  // Create sync job + dispatch
  const { jobId, processingStatus } = await createSyncJobAndDispatch(
    deterministicId, username, platform, videoLimit, orgId, projectId
  );

  return res.status(201).json({
    success: true,
    data: {
      id: deterministicId,
      username,
      platform,
      maxVideos: videoLimit,
      status: processingStatus,
      jobId,
      isExisting: false,
      message: processingStatus === 'processing'
        ? `Account @${username} created & dispatched. Up to ${videoLimit} videos will be fetched.`
        : `Account @${username} created & queued. Up to ${videoLimit} videos will be fetched shortly.`,
      endpoints: { poll: `/api/v1/accounts/${deterministicId}?projectId=${projectId}` }
    }
  });
}

// ─── Shared: create syncQueue job + dispatch ─────────────

async function createSyncJobAndDispatch(
  accountId: string,
  username: string,
  platform: string,
  maxVideos: number,
  orgId: string,
  projectId: string
): Promise<{ jobId: string; processingStatus: string }> {
  const jobRef = db.collection('syncQueue').doc();
  await jobRef.set({
    type: 'account_sync',
    status: 'pending',
    syncStrategy: 'direct',
    maxVideos,
    orgId,
    projectId,
    accountId,
    sessionId: null,
    accountUsername: username,
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
  console.log(`📋 [API] SyncQueue job: ${jobRef.id} (maxVideos=${maxVideos})`);

  let processingStatus = 'queued';
  const cronSecret = process.env.CRON_SECRET;

  try {
    const resp = await fetch(`${BASE_URL}/api/sync-single-account`, {
      method: 'POST',
      headers: { 'Authorization': cronSecret || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, projectId, accountId, sessionId: null, jobId: jobRef.id })
    });
    if (resp.ok) {
      await jobRef.update({ status: 'running', startedAt: Timestamp.now() });
      processingStatus = 'processing';
      console.log(`⚡ [API] Dispatch OK for @${username}`);
    } else {
      console.warn(`⚠️ [API] Dispatch returned ${resp.status}`);
    }
  } catch (err: any) {
    console.warn(`⚠️ [API] Dispatch failed: ${err.message}`);
    fetch(`${BASE_URL}/api/queue-worker`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cronSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'api_account_added' })
    }).catch(() => {});
  }

  return { jobId: jobRef.id, processingStatus };
}

// ─── Export ──────────────────────────────────────────────

export default withApiAuth(['accounts:read', 'accounts:write'], handler);
