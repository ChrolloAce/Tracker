/**
 * Public API v1 - Videos
 * GET /api/v1/videos - List all tracked videos
 * POST /api/v1/videos - Add video to track (supports sync mode)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../utils/firebase-admin.js';
import { withApiAuth } from '../../middleware/apiKeyAuth.js';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';
import {
  detectPlatform,
  dispatchProcessing,
  pollVideoUntilReady,
  formatVideoResponse,
} from './syncHelpers.js';

const JOB_PRIORITY_USER_INITIATED = 100;

// Sync mode constants
const SYNC_POLL_INTERVAL_MS = 5_000;   // poll every 5 seconds
const SYNC_MAX_WAIT_MS = 90_000;       // max wait 90 seconds
const SYNC_RETRY_AFTER_SECS = 30;      // tell client to retry after 30s

initializeFirebase();
const db = getFirestore();

// ─── Router ──────────────────────────────────────────────

async function handler(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  switch (req.method) {
    case 'GET':
      return await listVideos(req, res, auth);
    case 'POST':
      return await addVideo(req, res, auth);
    default:
      return res.status(405).json({
        success: false,
        error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }
      });
  }
}

// ─── GET: List Videos ────────────────────────────────────

async function listVideos(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const {
    projectId,
    platform,
    status,
    sortBy = 'uploadDate',
    sortOrder = 'desc',
    limit = '50',
    offset = '0'
  } = req.query;

  const targetProjectId = auth.projectId || projectId;

  if (targetProjectId && typeof targetProjectId === 'string') {
    return await listVideosFromProject(req, res, auth, targetProjectId);
  }

  // Aggregate across all projects
  const projectsSnapshot = await db
    .collection('organizations')
    .doc(auth.organizationId)
    .collection('projects')
    .get();

  const allVideos: any[] = [];

  for (const projectDoc of projectsSnapshot.docs) {
    let query: FirebaseFirestore.Query = projectDoc.ref.collection('videos');

    if (platform && typeof platform === 'string') {
      query = query.where('platform', '==', platform);
    }
    if (status && typeof status === 'string') {
      query = query.where('status', '==', status);
    }

    const videosSnapshot = await query.limit(100).get();

    videosSnapshot.docs.forEach(vDoc => {
      const data = vDoc.data();
      allVideos.push({
        id: vDoc.id,
        projectId: projectDoc.id,
        url: data.url,
        platform: data.platform,
        thumbnail: data.thumbnail,
        title: data.title,
        caption: data.caption,
        uploaderHandle: data.uploaderHandle,
        views: data.views || 0,
        likes: data.likes || 0,
        comments: data.comments || 0,
        shares: data.shares || 0,
        status: data.status,
        uploadDate: data.uploadDate?.toDate?.()?.toISOString(),
        lastRefreshed: data.lastRefreshed?.toDate?.()?.toISOString()
      });
    });
  }

  // Sort
  const sortField = sortBy as string;
  const order = sortOrder === 'asc' ? 1 : -1;
  allVideos.sort((a, b) => {
    const aVal = a[sortField] || 0;
    const bVal = b[sortField] || 0;
    if (typeof aVal === 'string') return aVal.localeCompare(bVal) * order;
    return (aVal - bVal) * order;
  });

  // Paginate
  const limitNum = Math.min(parseInt(limit as string) || 50, 100);
  const offsetNum = parseInt(offset as string) || 0;
  const paginatedVideos = allVideos.slice(offsetNum, offsetNum + limitNum);

  return res.status(200).json({
    success: true,
    data: {
      videos: paginatedVideos,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total: allVideos.length,
        hasMore: allVideos.length > offsetNum + limitNum
      }
    }
  });
}

async function listVideosFromProject(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest,
  projectId: string
) {
  const { platform, status, limit = '50', offset = '0' } = req.query;

  let query: FirebaseFirestore.Query = db
    .collection('organizations')
    .doc(auth.organizationId)
    .collection('projects')
    .doc(projectId)
    .collection('videos');

  if (platform && typeof platform === 'string') {
    query = query.where('platform', '==', platform);
  }
  if (status && typeof status === 'string') {
    query = query.where('status', '==', status);
  }

  query = query.orderBy('uploadDate', 'desc');

  const limitNum = Math.min(parseInt(limit as string) || 50, 100);
  const offsetNum = parseInt(offset as string) || 0;
  const snapshot = await query.limit(limitNum + offsetNum).get();

  const videos = snapshot.docs
    .slice(offsetNum)
    .slice(0, limitNum)
    .map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        projectId,
        url: data.url,
        platform: data.platform,
        thumbnail: data.thumbnail,
        title: data.title,
        caption: data.caption,
        uploaderHandle: data.uploaderHandle,
        views: data.views || 0,
        likes: data.likes || 0,
        comments: data.comments || 0,
        shares: data.shares || 0,
        status: data.status,
        uploadDate: data.uploadDate?.toDate?.()?.toISOString(),
        lastRefreshed: data.lastRefreshed?.toDate?.()?.toISOString()
      };
    });

  return res.status(200).json({
    success: true,
    data: {
      videos,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total: snapshot.size,
        hasMore: snapshot.size > offsetNum + limitNum
      }
    }
  });
}

// ─── POST: Add Video (async or sync) ────────────────────

async function addVideo(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const { url, projectId, sync } = req.body;
  const isSyncMode = sync === true || sync === 'true';

  if (!url) {
    return res.status(400).json({
      success: false,
      error: { message: 'Video URL is required', code: 'VALIDATION_ERROR' }
    });
  }

  const targetProjectId = auth.projectId || projectId;
  if (!targetProjectId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Project ID required', code: 'VALIDATION_ERROR' }
    });
  }

  const platform = detectPlatform(url);
  if (!platform) {
    return res.status(400).json({
      success: false,
      error: { message: 'Unsupported platform. Use TikTok, Instagram, YouTube, or Twitter URLs', code: 'VALIDATION_ERROR' }
    });
  }

  // Check duplicate
  const videosCol = db
    .collection('organizations')
    .doc(auth.organizationId)
    .collection('projects')
    .doc(targetProjectId)
    .collection('videos');

  const existingQuery = await videosCol.where('url', '==', url).limit(1).get();

  if (!existingQuery.empty) {
    if (isSyncMode) {
      const doc = existingQuery.docs[0];
      return res.status(200).json({
        success: true,
        data: formatVideoResponse(doc.id, doc.data(), targetProjectId),
        meta: { alreadyTracked: true }
      });
    }
    return res.status(409).json({
      success: false,
      error: { message: 'Video already being tracked', code: 'ALREADY_EXISTS' }
    });
  }

  // Create pending video document
  const docRef = await videosCol.add({
    url, platform,
    videoId: `temp-${Date.now()}`,
    thumbnail: '', title: 'Processing...', description: '',
    uploadDate: Timestamp.now(),
    views: 0, likes: 0, comments: 0, shares: 0,
    status: 'processing', isSingular: false,
    syncStatus: 'pending', syncRequestedAt: Timestamp.now(), syncRetryCount: 0,
    organizationId: auth.organizationId, projectId: targetProjectId,
    dateSubmitted: Timestamp.now(), createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    addedBy: 'api'
  });
  console.log(`📹 [API] Video doc created: ${docRef.id} for ${url}`);

  // Create high-priority syncQueue job
  const jobRef = db.collection('syncQueue').doc();
  await jobRef.set({
    type: 'single_video', status: 'pending',
    orgId: auth.organizationId, projectId: targetProjectId,
    videoUrl: url, addedBy: 'api',
    createdAt: Timestamp.now(), startedAt: null, completedAt: null,
    attempts: 0, maxAttempts: 3,
    priority: JOB_PRIORITY_USER_INITIATED,
    error: null, userInitiated: true
  });
  console.log(`📋 [API] SyncQueue job created: ${jobRef.id}`);

  // Dispatch for immediate Apify processing
  const dispatchOk = await dispatchProcessing(url, auth.organizationId, targetProjectId, jobRef);

  // ── ASYNC MODE (default) ────────────────────────────────
  if (!isSyncMode) {
    return res.status(201).json({
      success: true,
      data: {
        id: docRef.id, url, platform,
        status: dispatchOk ? 'processing' : 'queued',
        jobId: jobRef.id,
        message: dispatchOk
          ? 'Video dispatched for immediate processing. Metrics typically available within 30-60 seconds.'
          : 'Video queued for processing. Metrics will be available shortly.',
        endpoints: { poll: `/api/v1/videos/${docRef.id}?projectId=${targetProjectId}` }
      }
    });
  }

  // ── SYNC MODE ───────────────────────────────────────────
  console.log(`🔄 [API] Sync mode — polling for up to ${SYNC_MAX_WAIT_MS / 1000}s`);
  const poll = await pollVideoUntilReady(docRef, SYNC_MAX_WAIT_MS, SYNC_POLL_INTERVAL_MS);

  if (poll.ready) {
    console.log(`✅ [API] Sync complete — video ${docRef.id} is ready`);
    return res.status(201).json({
      success: true,
      data: formatVideoResponse(docRef.id, poll.data!, targetProjectId),
      meta: { sync: true, processingTimeMs: poll.elapsed }
    });
  }

  if (poll.errored) {
    console.log(`❌ [API] Sync — video ${docRef.id} errored`);
    return res.status(202).json({
      success: true,
      data: {
        id: docRef.id, url, platform, status: 'error',
        error: poll.errorMessage || 'Processing failed',
        jobId: jobRef.id,
        message: 'Video processing failed. Check the error and retry if needed.',
      },
      meta: { sync: true, processingTimeMs: poll.elapsed }
    });
  }

  // Timed out — still processing
  console.log(`⏱️ [API] Sync timeout — ${docRef.id} still processing after ${poll.elapsed}ms`);
  res.setHeader('Retry-After', String(SYNC_RETRY_AFTER_SECS));
  return res.status(202).json({
    success: true,
    data: {
      id: docRef.id, url, platform,
      status: 'processing', jobId: jobRef.id,
      message: `Video is still processing. Poll GET /api/v1/videos/${docRef.id}?projectId=${targetProjectId} for the final result.`,
      retryAfter: SYNC_RETRY_AFTER_SECS,
      endpoints: { poll: `/api/v1/videos/${docRef.id}?projectId=${targetProjectId}` }
    },
    meta: { sync: true, processingTimeMs: poll.elapsed, timedOut: true }
  });
}

// ─── Export ──────────────────────────────────────────────

export default withApiAuth(['videos:read'], handler);
