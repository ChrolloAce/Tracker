/**
 * Public API v1 - Single Video Operations
 * GET /api/v1/videos/:id - Get video details with snapshots
 * DELETE /api/v1/videos/:id - Remove tracked video
 *
 * Transcription: On GET, if no transcript exists, triggers background
 * transcription and long-polls Firestore until the transcript is ready
 * (up to 25 seconds). Agents get the transcript in a single call.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../utils/firebase-admin.js';
import { withApiAuth } from '../../middleware/apiKeyAuth.js';
import { getBaseUrl } from '../../utils/base-url.js';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';

initializeFirebase();
const db = getFirestore();

const BASE_URL = getBaseUrl();

// Long-poll constants for transcription
const TRANSCRIPT_POLL_INTERVAL_MS = 2_000;  // check every 2 seconds
const TRANSCRIPT_MAX_WAIT_MS = 25_000;      // max wait 25 seconds

async function handler(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Video ID required', code: 'VALIDATION_ERROR' }
    });
  }

  switch (req.method) {
    case 'GET':
      return await getVideo(req, res, auth, id);
    case 'DELETE':
      return await deleteVideo(req, res, auth, id);
    default:
      return res.status(405).json({
        success: false,
        error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }
      });
  }
}

/**
 * Find video across all projects in organization
 */
async function findVideo(orgId: string, videoId: string, projectId?: string) {
  if (projectId) {
    const docRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('videos')
      .doc(videoId);

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
    const videoDoc = await projectDoc.ref
      .collection('videos')
      .doc(videoId)
      .get();

    if (videoDoc.exists) {
      return { doc: videoDoc, projectId: projectDoc.id };
    }
  }

  return null;
}

// ─── Transcription Helpers ──────────────────────────────

/**
 * Fire-and-forget: dispatch background transcription.
 * Does NOT await the result — the long-poll handles that.
 */
function dispatchTranscription(orgId: string, projectId: string, videoDocId: string) {
  const cronSecret = process.env.CRON_SECRET;
  fetch(`${BASE_URL}/api/transcribe-video`, {
    method: 'POST',
    headers: {
      'Authorization': cronSecret || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orgId, projectId, videoDocId }),
  }).catch((err) => {
    console.warn(`⚠️ [API] Transcription dispatch failed:`, err.message);
  });
}

/**
 * Long-poll Firestore until transcriptStatus becomes 'completed', 'failed', or 'unavailable'.
 */
async function pollTranscriptUntilReady(
  docRef: FirebaseFirestore.DocumentReference,
  maxWaitMs: number,
  pollIntervalMs: number,
): Promise<{ ready: boolean; data?: FirebaseFirestore.DocumentData }> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    // Check first, then sleep (avoids 2s delay on fast transcriptions like YouTube captions)
    const snap = await docRef.get();
    if (!snap.exists) return { ready: false };

    const data = snap.data()!;
    const status = data.transcriptStatus;

    if (status === 'completed' || status === 'failed' || status === 'unavailable') {
      return { ready: true, data };
    }

    console.log(`⏳ [API] Transcript still processing… (${Math.round((Date.now() - startTime) / 1000)}s)`);
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return { ready: false };
}

/**
 * Build the transcription block for the API response.
 */
function buildTranscriptionResponse(data: FirebaseFirestore.DocumentData) {
  const status = data.transcriptStatus || 'none';

  if (status === 'completed' && data.transcript) {
    return {
      status: 'completed',
      transcript: data.transcript.text,
      language: data.transcript.language || null,
      source: data.transcript.source || null,
      segments: data.transcript.segments || null,
      wordCount: data.transcript.wordCount || null,
      completedAt: data.transcriptCompletedAt?.toDate?.()?.toISOString() || null,
    };
  }

  if (status === 'failed') {
    return {
      status: 'failed',
      transcript: null,
      error: data.transcriptError || 'Transcription failed',
      message: 'Transcription could not be completed for this video.',
    };
  }

  if (status === 'unavailable') {
    return {
      status: 'unavailable',
      transcript: null,
      error: data.transcriptError || null,
      message: 'No transcript available — the video media could not be accessed for transcription.',
    };
  }

  if (status === 'processing' || status === 'pending') {
    return {
      status: 'processing',
      transcript: null,
      retryAfterSeconds: 10,
      message: 'Transcript is being generated. Retry this same request in 10 seconds.',
    };
  }

  // status === 'none' or undefined — should not reach here in normal flow
  return {
    status: 'none',
    transcript: null,
    message: 'No transcript has been requested yet.',
  };
}

/**
 * Get video details with optional snapshots history.
 * Automatically triggers transcription on first access and long-polls for result.
 */
async function getVideo(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest,
  videoId: string
) {
  const result = await findVideo(auth.organizationId, videoId, auth.projectId);

  if (!result) {
    return res.status(404).json({
      success: false,
      error: { message: 'Video not found', code: 'NOT_FOUND' }
    });
  }

  const { doc, projectId } = result;
  let data = doc.data()!;

  // ─── Transcription: trigger + long-poll ─────────────────
  const transcriptStatus = data.transcriptStatus;
  const needsTranscription = !transcriptStatus || transcriptStatus === 'none';

  // Detect stale 'processing' status (worker crashed or timed out)
  const STALE_PROCESSING_MS = 5 * 60 * 1000; // 5 minutes
  const MAX_TRANSCRIPT_RETRIES = 3;
  const retryCount = data.transcriptRetryCount || 0;

  const isStaleProcessing = transcriptStatus === 'processing'
    && data.transcriptRequestedAt
    && (Date.now() - data.transcriptRequestedAt.toDate().getTime()) > STALE_PROCESSING_MS;

  // Give up after MAX_TRANSCRIPT_RETRIES to avoid infinite retry loops
  if (isStaleProcessing && retryCount >= MAX_TRANSCRIPT_RETRIES) {
    await doc.ref.update({
      transcriptStatus: 'failed',
      transcriptError: `Transcription failed after ${MAX_TRANSCRIPT_RETRIES} attempts.`,
    });
    data.transcriptStatus = 'failed';
    data.transcriptError = `Transcription failed after ${MAX_TRANSCRIPT_RETRIES} attempts.`;
  } else if (needsTranscription || isStaleProcessing) {
    // Mark as pending immediately so concurrent requests don't re-trigger
    const updateData: Record<string, any> = {
      transcriptStatus: 'pending',
      transcriptRequestedAt: Timestamp.now(),
    };
    if (isStaleProcessing) {
      updateData.transcriptRetryCount = retryCount + 1;
    }
    await doc.ref.update(updateData);

    // Update local data so timeout fallback returns correct status
    data.transcriptStatus = 'pending';

    // Fire-and-forget the background transcription job
    dispatchTranscription(auth.organizationId, projectId, doc.id);

    // Long-poll: wait for the transcript to appear in Firestore
    console.log(`🎙️ [API] Transcription triggered for ${doc.id} (retry ${isStaleProcessing ? retryCount + 1 : 0}), long-polling up to ${TRANSCRIPT_MAX_WAIT_MS / 1000}s`);
    const pollResult = await pollTranscriptUntilReady(
      doc.ref,
      TRANSCRIPT_MAX_WAIT_MS,
      TRANSCRIPT_POLL_INTERVAL_MS
    );

    if (pollResult.ready && pollResult.data) {
      data = pollResult.data;
    }
  }

  // ─── Snapshots ──────────────────────────────────────────
  const includeSnapshots = req.query.includeSnapshots === 'true';
  let snapshots: any[] = [];

  if (includeSnapshots) {
    const snapshotsSnapshot = await doc.ref
      .collection('snapshots')
      .orderBy('capturedAt', 'desc')
      .limit(100)
      .get();

    snapshots = snapshotsSnapshot.docs.map(sDoc => {
      const sData = sDoc.data();
      return {
        id: sDoc.id,
        views: sData.views,
        likes: sData.likes,
        comments: sData.comments,
        shares: sData.shares,
        capturedAt: sData.capturedAt?.toDate?.()?.toISOString()
      };
    });
  }

  // ─── Growth metrics ─────────────────────────────────────
  let growth = null;
  if (data.snapshots && data.snapshots.length >= 2) {
    const sorted = [...data.snapshots].sort((a: any, b: any) =>
      new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
    );
    const latest = sorted[0];
    const previous = sorted[1];

    growth = {
      views: latest.views - previous.views,
      likes: latest.likes - previous.likes,
      comments: latest.comments - previous.comments,
      period: {
        from: previous.capturedAt,
        to: latest.capturedAt
      }
    };
  }

  return res.status(200).json({
    success: true,
    data: {
      id: doc.id,
      projectId,
      url: data.url,
      platform: data.platform,
      thumbnail: data.thumbnail,
      title: data.title,
      caption: data.caption,
      uploaderHandle: data.uploaderHandle,
      uploaderProfilePicture: data.uploaderProfilePicture,
      metrics: {
        views: data.views || 0,
        likes: data.likes || 0,
        comments: data.comments || 0,
        shares: data.shares || 0,
        saves: data.saves || 0
      },
      growth,
      transcription: buildTranscriptionResponse(data),
      status: data.status,
      syncStatus: data.syncStatus,
      uploadDate: data.uploadDate?.toDate?.()?.toISOString(),
      lastRefreshed: data.lastRefreshed?.toDate?.()?.toISOString(),
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.dateSubmitted?.toDate?.()?.toISOString(),
      ...(includeSnapshots && { snapshots })
    }
  });
}

/**
 * Delete a tracked video
 */
async function deleteVideo(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest,
  videoId: string
) {
  const result = await findVideo(auth.organizationId, videoId, auth.projectId);

  if (!result) {
    return res.status(404).json({
      success: false,
      error: { message: 'Video not found', code: 'NOT_FOUND' }
    });
  }

  // Delete the video
  await result.doc.ref.delete();

  return res.status(200).json({
    success: true,
    message: 'Video removed from tracking'
  });
}

// Dynamic scopes based on method
export default async function routeHandler(req: VercelRequest, res: VercelResponse) {
  const scopes = req.method === 'DELETE' ? ['videos:write'] : ['videos:read'];
  return withApiAuth(scopes as any, handler)(req, res);
}
