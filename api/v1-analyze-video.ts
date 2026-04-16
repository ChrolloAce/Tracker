// Public API v1 - Video Analysis
// POST /api/v1-analyze-video
//
// Runs (or returns cached) Gemini structured analysis for a tracked video:
// transcript with timestamps, summary, hook, topics, tone, pacing,
// whatWorked, suggestions.
//
// URL is at the root (not under /api/v1/) because Vercel's functions config
// can't have overlapping glob patterns without breaking dynamic [id] routes.
// Keeping this file at api/ root lets it have its own maxDuration: 180 and
// includeFiles override for the yt-dlp binary without affecting anything else.
//
// Scope: videos:analyze (separate from videos:write because this triggers
// paid Gemini API calls — lets customers gate the cost independently).
//
// Body: { videoId: string, projectId?: string, force?: boolean }
// Sync response, up to 3 min. Returns cached analysis instantly when
// present and force is not set.

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from './_utils/firebase-admin.js';
import { withApiAuth } from './_middleware/apiKeyAuth.js';
import {
  performVideoAnalysis,
  VideoAnalysisError,
} from './_services/VideoAnalysisService.js';
import type { AuthenticatedApiRequest } from '../src/types/apiKeys';

initializeFirebase();
const db = getFirestore();

/**
 * Find which project a video lives in so callers don't have to know.
 */
async function findVideoProjectId(
  orgId: string,
  videoId: string,
  hintProjectId?: string,
): Promise<string | null> {
  if (hintProjectId) {
    const doc = await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(hintProjectId)
      .collection('videos')
      .doc(videoId)
      .get();
    if (doc.exists) return hintProjectId;
  }

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
    if (videoDoc.exists) return projectDoc.id;
  }

  return null;
}

async function handler(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    });
  }

  const body = req.body || {};
  const videoId = typeof body.videoId === 'string' ? body.videoId : '';
  if (!videoId) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'videoId is required in the request body',
        code: 'VALIDATION_ERROR',
      },
    });
  }

  const hintProjectId =
    auth.projectId || (typeof body.projectId === 'string' ? body.projectId : undefined);

  const resolvedProjectId = await findVideoProjectId(
    auth.organizationId,
    videoId,
    hintProjectId,
  );

  if (!resolvedProjectId) {
    return res.status(404).json({
      success: false,
      error: { message: 'Video not found', code: 'NOT_FOUND' },
    });
  }

  try {
    const { analysis, cached, durationMs } = await performVideoAnalysis({
      orgId: auth.organizationId,
      projectId: resolvedProjectId,
      videoDocId: videoId,
      requestedBy: `apiKey:${auth.apiKey.id}`,
      force: body.force === true,
    });

    return res.status(200).json({
      success: true,
      data: {
        videoId,
        projectId: resolvedProjectId,
        analysis,
      },
      meta: { cached, durationMs },
    });
  } catch (error: any) {
    if (error instanceof VideoAnalysisError) {
      const statusMap: Record<VideoAnalysisError['code'], number> = {
        NOT_FOUND: 404,
        ALREADY_PROCESSING: 409,
        CONFIG_ERROR: 500,
        ANALYSIS_FAILED: 500,
      };
      return res.status(statusMap[error.code]).json({
        success: false,
        error: { message: error.message, code: error.code },
      });
    }
    console.error('❌ [v1-analyze-video] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Video analysis failed',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}

export default async function routeHandler(req: VercelRequest, res: VercelResponse) {
  return withApiAuth(['videos:analyze'] as any, handler)(req, res);
}
