/**
 * Background transcription endpoint
 * POST /api/transcribe-video
 *
 * Called internally (fire-and-forget) when an API GET request
 * encounters a video without a transcript.
 *
 * Auth: CRON_SECRET (internal only, not public API)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeFirebase } from './_utils/firebase-admin.js';
import { transcribeVideo } from './_services/TranscriptionService.js';

initializeFirebase();
const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: internal calls only via CRON_SECRET
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { orgId, projectId, videoDocId } = req.body;

  if (!orgId || !projectId || !videoDocId) {
    return res.status(400).json({ error: 'Missing orgId, projectId, or videoDocId' });
  }

  const videoRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(projectId)
    .collection('videos')
    .doc(videoDocId);

  try {
    const videoSnap = await videoRef.get();
    if (!videoSnap.exists) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const data = videoSnap.data()!;

    // Prevent duplicate work (allow 'pending' through since we're the worker that should process it)
    if (data.transcriptStatus === 'completed' || data.transcriptStatus === 'processing') {
      console.log(`⏭️ [Transcription] Skipping ${videoDocId} — already ${data.transcriptStatus}`);
      return res.status(200).json({ skipped: true, reason: data.transcriptStatus });
    }

    // Mark as processing (don't overwrite transcriptRequestedAt — that's set by the API GET)
    await videoRef.update({
      transcriptStatus: 'processing',
      transcriptProcessingStartedAt: Timestamp.now(),
    });

    const platform = data.platform as string;
    const videoUrl = data.url || data.videoUrl || '';

    // Try to find a media URL from raw data (Apify scrapers sometimes store this)
    const mediaUrl = data.mediaUrl || data.downloadUrl || null;

    // Run transcription
    const result = await transcribeVideo(platform, videoUrl, mediaUrl);

    if (result.success && result.transcript) {
      await videoRef.update({
        transcript: {
          text: result.transcript.text,
          language: result.transcript.language,
          source: result.transcript.source,
          segments: result.transcript.segments || null,
          wordCount: result.transcript.wordCount || null,
          generatedAt: Timestamp.now(),
        },
        transcriptStatus: 'completed',
        transcriptCompletedAt: Timestamp.now(),
        transcriptError: null,
      });

      console.log(`✅ [Transcription] Complete for ${videoDocId} (${result.transcript.wordCount} words)`);
      return res.status(200).json({ success: true, wordCount: result.transcript.wordCount });
    }

    // Transcription failed or unavailable
    const finalStatus = result.error?.includes('No media URL') ? 'unavailable' : 'failed';
    await videoRef.update({
      transcriptStatus: finalStatus,
      transcriptError: result.error || 'Unknown error',
    });

    console.log(`❌ [Transcription] ${finalStatus} for ${videoDocId}: ${result.error}`);
    return res.status(200).json({ success: false, status: finalStatus, error: result.error });

  } catch (error: any) {
    console.error(`❌ [Transcription] Unexpected error for ${videoDocId}:`, error);

    // Best-effort update to mark failure
    try {
      await videoRef.update({
        transcriptStatus: 'failed',
        transcriptError: error.message || 'Unexpected error',
      });
    } catch {}

    return res.status(500).json({ error: error.message });
  }
}
