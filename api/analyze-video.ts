/**
 * Gemini video analysis endpoint
 * POST /api/analyze-video
 *
 * Triggered by the "Transcribe & analyze video" button in the dashboard
 * video detail modal. Core analysis logic lives in VideoAnalysisService —
 * this file is just the Firebase-auth wrapper. The API-key equivalent
 * lives at /api/v1/videos/[id]/analyze.
 *
 * Auth: Firebase ID token + org membership check.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeFirebase } from './_utils/firebase-admin.js';
import {
  authenticateAndVerifyOrg,
  setCorsHeaders,
  handleCorsPreFlight,
} from './_middleware/auth.js';
import {
  performVideoAnalysis,
  VideoAnalysisError,
} from './_services/VideoAnalysisService.js';

initializeFirebase();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req);
  if (handleCorsPreFlight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId, projectId, videoDocId } = req.body || {};
  if (!orgId || !projectId || !videoDocId) {
    return res
      .status(400)
      .json({ error: 'Missing required fields: orgId, projectId, videoDocId' });
  }

  let userId: string;
  try {
    const { user } = await authenticateAndVerifyOrg(req, orgId);
    userId = user.userId;
  } catch (err: any) {
    return res.status(401).json({ error: err.message || 'Unauthorized' });
  }

  try {
    // Dashboard always re-runs (matches pre-refactor behavior). The
    // "Re-analyze" button in the modal expects a fresh Gemini call every
    // time; caching is opt-in via the v1 API, not the dashboard endpoint.
    const { analysis } = await performVideoAnalysis({
      orgId,
      projectId,
      videoDocId,
      requestedBy: userId,
      force: true,
    });

    return res.status(200).json({ success: true, analysis });
  } catch (error: any) {
    if (error instanceof VideoAnalysisError) {
      const statusMap: Record<VideoAnalysisError['code'], number> = {
        NOT_FOUND: 404,
        ALREADY_PROCESSING: 409,
        CONFIG_ERROR: 500,
        ANALYSIS_FAILED: 500,
      };
      return res.status(statusMap[error.code]).json({ error: error.message });
    }
    console.error('❌ [analyze-video] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Video analysis failed' });
  }
}
