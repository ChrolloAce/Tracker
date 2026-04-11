/**
 * Gemini video analysis endpoint
 * POST /api/analyze-video
 *
 * Triggered manually by a user clicking the "Transcribe & analyze video"
 * button in the video detail modal. Uses Gemini 3 Flash Preview to ingest
 * the video natively and return a transcript + structured analysis.
 *
 * Platform support:
 * - YouTube: passes the URL directly to Gemini via file_data.file_uri
 *   (Gemini fetches the video itself — no download needed).
 * - TikTok / Instagram / Twitter: uses the bundled yt-dlp binary
 *   (scripts/install-yt-dlp.mjs fetches it at npm install / Vercel build
 *   time into api/_bin/yt-dlp) to download the video directly to /tmp.
 *   We let yt-dlp do the whole download itself rather than extracting a
 *   URL and fetching separately — platform CDNs (especially TikTok) gate
 *   downloads on cookies/sigs that are only valid inside yt-dlp's full
 *   flow. After download we read the /tmp file into a Buffer, delete it,
 *   upload to the Gemini Files API via resumable upload, wait for ACTIVE
 *   state, and call generateContent.
 *
 * Auth: Firebase ID token + org membership check.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { initializeFirebase } from './_utils/firebase-admin.js';
import {
  authenticateAndVerifyOrg,
  setCorsHeaders,
  handleCorsPreFlight,
} from './_middleware/auth.js';
import type { GeminiVideoAnalysis } from '../src/types/firestore';

const execFileAsync = promisify(execFile);

initializeFirebase();
const db = getFirestore();

// ─── Gemini config ──────────────────────────────────────
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';
const GEMINI_GENERATE_ENDPOINT = `${GEMINI_API_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_UPLOAD_ENDPOINT = `${GEMINI_API_BASE}/upload/v1beta/files`;

const GEMINI_CALL_TIMEOUT_MS = 150_000; // 2.5 min — video analysis can take a while
const FILE_ACTIVE_POLL_INTERVAL_MS = 2_000;
const FILE_ACTIVE_POLL_MAX_MS = 90_000; // up to 1.5 min for Gemini to process the upload
const MAX_MEDIA_BYTES = 500 * 1024 * 1024; // 500MB — well under the 2GB file limit

// ─── yt-dlp config ──────────────────────────────────────
// Binary is fetched by scripts/install-yt-dlp.mjs during `npm install`
// and bundled into the function via vercel.json `includeFiles`.
const __dirname_local = dirname(fileURLToPath(import.meta.url));
const YT_DLP_BIN = join(__dirname_local, '_bin', 'yt-dlp');
const YT_DLP_TIMEOUT_MS = 120_000; // 2 min — full download of the video, not just metadata
const YT_DLP_MAX_BUFFER_BYTES = 10 * 1024 * 1024; // 10MB — only used for stdout (the filepath line), not the video bytes

// ─── YouTube URL helpers ────────────────────────────────
function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function canonicalYouTubeUrl(url: string): string | null {
  const id = extractYouTubeVideoId(url);
  if (!id) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}

// ─── Prompt + schema ────────────────────────────────────
const ANALYSIS_PROMPT = `You are a short-form video analyst. Watch this video and return a structured analysis.

Produce:
1. A faithful transcript of the spoken audio. Include timestamps in MM:SS format for each segment (roughly one segment per sentence or scene change).
2. A 2-4 sentence plain-English summary of what the video is about.
3. The hook — what specifically grabs attention in the first ~3 seconds (visual, verbal, or both).
4. Key topics covered, as a short list.
5. Tone/style (e.g. "energetic, conversational, educational").
6. Pacing — one sentence on the edit style and pacing.
7. 3-5 bullet points explaining what's working about this video (why it might perform well).
8. 3-5 actionable suggestions the creator could use to improve future videos.

Be concrete and observational. Do not invent details you can't see or hear in the video. If the video has no spoken audio, say so in the transcript field and base the analysis on the visuals.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING' },
    transcriptSegments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          timestamp: { type: 'STRING' },
          text: { type: 'STRING' },
        },
        required: ['timestamp', 'text'],
      },
    },
    summary: { type: 'STRING' },
    hook: { type: 'STRING' },
    topics: { type: 'ARRAY', items: { type: 'STRING' } },
    tone: { type: 'STRING' },
    pacing: { type: 'STRING' },
    whatWorked: { type: 'ARRAY', items: { type: 'STRING' } },
    suggestions: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: [
    'transcript',
    'summary',
    'hook',
    'topics',
    'tone',
    'pacing',
    'whatWorked',
    'suggestions',
  ],
};

// ─── Gemini Files API (for non-YouTube platforms) ───────
interface GeminiFile {
  name: string;     // "files/<id>"
  uri: string;      // The file_uri to pass to generateContent
  mimeType: string;
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
}

// ─── yt-dlp native download ─────────────────────────────
interface YtDlpDownloadResult {
  buffer: Buffer;
  mimeType: string;
  filePath: string;
}

/**
 * Let yt-dlp do the whole download pipeline itself — extract the direct
 * URL, handle any CDN auth/cookies/signatures, write the file to /tmp.
 * We then read it into a Buffer and delete the temp file.
 *
 * This is much more reliable than extracting the direct URL and fetching
 * it separately with fetch(): platforms like TikTok gate their CDN on
 * session cookies and signed URLs that are only valid inside yt-dlp's
 * full request flow. Reproducing that outside yt-dlp gets 403s.
 *
 * Single-file mp4 format is forced so we never need ffmpeg to merge
 * separate video/audio streams.
 */
async function ytDlpDownloadToFile(pageUrl: string): Promise<YtDlpDownloadResult> {
  if (!existsSync(YT_DLP_BIN)) {
    throw new Error(
      `yt-dlp binary not found at ${YT_DLP_BIN}. The postinstall script (scripts/install-yt-dlp.mjs) should have downloaded it during npm install.`,
    );
  }

  const uniqueId = randomBytes(6).toString('hex');
  // Vercel functions have /tmp writable (512MB default).
  const outputTemplate = `/tmp/ytdlp-${uniqueId}.%(ext)s`;

  const args = [
    pageUrl,
    '-f',
    'best[ext=mp4][protocol^=http]/best[ext=mp4]/best[protocol^=http]/best',
    '-o',
    outputTemplate,
    '--no-playlist',
    '--no-warnings',
    '--no-check-certificates',
    '--no-progress',
    '--print',
    'after_move:filepath',
  ];

  let stdout: string;
  try {
    const result = await execFileAsync(YT_DLP_BIN, args, {
      timeout: YT_DLP_TIMEOUT_MS,
      maxBuffer: YT_DLP_MAX_BUFFER_BYTES,
    });
    stdout = result.stdout;
  } catch (err: any) {
    // execFile rejects with { stdout, stderr, code, signal, killed } on non-zero exit
    const stderr = (err?.stderr || '').toString().trim();
    const message = stderr || err?.message || 'yt-dlp exited with an error';
    throw new Error(`yt-dlp download failed: ${message.slice(0, 500)}`);
  }

  // After --print after_move:filepath, yt-dlp prints the final path once
  // the file has been fully written and moved to its final location.
  const filePath = stdout.trim().split('\n').pop() || '';
  if (!filePath || !existsSync(filePath)) {
    throw new Error(
      `yt-dlp did not produce an output file (stdout: ${stdout.trim().slice(0, 200)})`,
    );
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch (err: any) {
    throw new Error(`Failed to read yt-dlp output file: ${err.message}`);
  }

  if (buffer.length === 0) {
    throw new Error('yt-dlp output file is empty');
  }
  if (buffer.length > MAX_MEDIA_BYTES) {
    // Clean up before throwing
    unlink(filePath).catch(() => {});
    throw new Error(
      `Downloaded video is too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB, max ${MAX_MEDIA_BYTES / 1024 / 1024}MB)`,
    );
  }

  const extension = filePath.split('.').pop()?.toLowerCase() || 'mp4';
  const mimeType = extension === 'mp4' ? 'video/mp4' : `video/${extension}`;

  return { buffer, mimeType, filePath };
}

/**
 * Upload video bytes to the Gemini Files API using the resumable upload
 * protocol (start → upload+finalize). Returns the file metadata.
 */
async function uploadVideoToGemini(
  buffer: Buffer,
  mimeType: string,
  displayName: string,
  apiKey: string,
): Promise<GeminiFile> {
  // Step 1 — start resumable upload, get the upload URL
  const startResponse = await fetch(GEMINI_UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(buffer.length),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });

  if (!startResponse.ok) {
    const errText = await startResponse.text();
    throw new Error(
      `Gemini upload start failed (${startResponse.status}): ${errText.slice(0, 500)}`,
    );
  }

  const uploadUrl = startResponse.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error('Gemini upload start did not return x-goog-upload-url');
  }

  // Step 2 — upload the bytes and finalize in one shot
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(buffer.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    // Cast: Node 18+ fetch accepts Buffer as BodyInit
    body: buffer as unknown as BodyInit,
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(
      `Gemini upload finalize failed (${uploadResponse.status}): ${errText.slice(0, 500)}`,
    );
  }

  const data = (await uploadResponse.json()) as { file?: GeminiFile };
  if (!data.file?.uri || !data.file?.name) {
    throw new Error('Gemini upload response missing file.uri or file.name');
  }

  return data.file;
}

/**
 * Poll the file metadata endpoint until the file state is ACTIVE (ready to
 * be referenced in generateContent). Videos start as PROCESSING.
 */
async function waitForFileActive(fileName: string, apiKey: string): Promise<GeminiFile> {
  const startedAt = Date.now();
  let lastState: GeminiFile['state'] = 'PROCESSING';

  while (Date.now() - startedAt < FILE_ACTIVE_POLL_MAX_MS) {
    const response = await fetch(`${GEMINI_API_BASE}/v1beta/${fileName}`, {
      headers: { 'x-goog-api-key': apiKey },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Gemini file poll failed (${response.status}): ${errText.slice(0, 500)}`,
      );
    }

    const file = (await response.json()) as GeminiFile;
    lastState = file.state;

    if (file.state === 'ACTIVE') return file;
    if (file.state === 'FAILED') {
      throw new Error('Gemini reported file processing FAILED');
    }

    await new Promise(resolve => setTimeout(resolve, FILE_ACTIVE_POLL_INTERVAL_MS));
  }

  throw new Error(
    `Gemini file did not become ACTIVE within ${FILE_ACTIVE_POLL_MAX_MS / 1000}s (last state: ${lastState})`,
  );
}

/**
 * Best-effort delete — we don't block analysis on cleanup failures.
 */
async function deleteGeminiFile(fileName: string, apiKey: string): Promise<void> {
  try {
    await fetch(`${GEMINI_API_BASE}/v1beta/${fileName}`, {
      method: 'DELETE',
      headers: { 'x-goog-api-key': apiKey },
    });
  } catch (err) {
    console.warn(`⚠️ [analyze-video] Failed to delete Gemini file ${fileName}:`, err);
  }
}

// ─── Gemini generateContent call ────────────────────────
interface GeminiRawResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

type VideoPart =
  | { file_data: { file_uri: string; mime_type?: string } }
  | { text: string };

async function callGeminiGenerate(videoPart: VideoPart, apiKey: string): Promise<GeminiVideoAnalysis> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_CALL_TIMEOUT_MS);

  try {
    const response = await fetch(`${GEMINI_GENERATE_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [videoPart, { text: ANALYSIS_PROMPT }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.4,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API ${response.status}: ${errorText.slice(0, 500)}`);
    }

    const data = (await response.json()) as GeminiRawResponse;

    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the request: ${data.promptFeedback.blockReason}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini returned an empty response');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error(`Failed to parse Gemini JSON response: ${(err as Error).message}`);
    }

    return {
      transcript: String(parsed.transcript || ''),
      transcriptSegments: Array.isArray(parsed.transcriptSegments)
        ? parsed.transcriptSegments
            .filter((s: any) => s && typeof s.timestamp === 'string' && typeof s.text === 'string')
            .map((s: any) => ({ timestamp: s.timestamp, text: s.text }))
        : undefined,
      summary: String(parsed.summary || ''),
      hook: String(parsed.hook || ''),
      topics: Array.isArray(parsed.topics) ? parsed.topics.map(String) : [],
      tone: String(parsed.tone || ''),
      pacing: String(parsed.pacing || ''),
      whatWorked: Array.isArray(parsed.whatWorked) ? parsed.whatWorked.map(String) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [],
      modelVersion: GEMINI_MODEL,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Resolve the video part for Gemini ──────────────────
/**
 * Returns the `parts[0]` value that references the video, plus an optional
 * cleanup callback (for uploaded files that should be deleted after use).
 */
async function resolveVideoPart(
  videoData: any,
  apiKey: string,
): Promise<{ part: VideoPart; cleanup?: () => Promise<void> }> {
  const platform = videoData.platform as string;
  const rawUrl = videoData.videoUrl || videoData.url || '';

  // Fast path: YouTube — Gemini fetches the URL itself
  if (platform === 'youtube') {
    const youtubeUrl = canonicalYouTubeUrl(rawUrl);
    if (!youtubeUrl) {
      throw new Error(`Could not extract a valid YouTube video ID from URL: ${rawUrl}`);
    }
    return { part: { file_data: { file_uri: youtubeUrl } } };
  }

  // Slow path: TikTok / Instagram / Twitter — let yt-dlp do the whole
  // download itself (extract, auth, write). We then upload the bytes to
  // the Gemini Files API. Uses yt-dlp's full flow instead of extract-
  // then-fetch because platform CDNs (especially TikTok) gate their
  // downloads on cookies/sigs that aren't in yt-dlp's http_headers.
  if (!rawUrl) {
    throw new Error(`Video has no page URL stored — cannot run yt-dlp.`);
  }

  console.log(`🔎 [analyze-video] Running yt-dlp download on ${platform} URL: ${rawUrl}`);
  const { buffer, mimeType, filePath } = await ytDlpDownloadToFile(rawUrl);
  console.log(
    `⬇️  [analyze-video] yt-dlp downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB (${mimeType})`,
  );

  let file: GeminiFile;
  try {
    console.log(`⬆️  [analyze-video] Uploading to Gemini Files API…`);
    file = await uploadVideoToGemini(
      buffer,
      mimeType,
      `${platform}-${videoData.videoId || 'video'}`,
      apiKey,
    );
    console.log(`⬆️  [analyze-video] Upload complete: ${file.name} (state=${file.state})`);
  } finally {
    // Delete the /tmp file as soon as the bytes are uploaded. Frees the
    // 512MB /tmp budget for this function and avoids any leak on error.
    unlink(filePath).catch(() => {});
  }

  // Videos start as PROCESSING — wait for ACTIVE before using
  let activeFile = file;
  if (file.state !== 'ACTIVE') {
    console.log(`⏳ [analyze-video] Waiting for file to become ACTIVE…`);
    activeFile = await waitForFileActive(file.name, apiKey);
    console.log(`✅ [analyze-video] File is ACTIVE`);
  }

  return {
    part: {
      file_data: {
        file_uri: activeFile.uri,
        mime_type: activeFile.mimeType || mimeType,
      },
    },
    cleanup: () => deleteGeminiFile(file.name, apiKey),
  };
}

// ─── Handler ────────────────────────────────────────────
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

  // Auth: user must be an active member of the org
  let userId: string;
  try {
    const { user } = await authenticateAndVerifyOrg(req, orgId);
    userId = user.userId;
  } catch (err: any) {
    return res.status(401).json({ error: err.message || 'Unauthorized' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ [analyze-video] GEMINI_API_KEY not set');
    return res
      .status(500)
      .json({ error: 'Gemini is not configured on the server. Set GEMINI_API_KEY.' });
  }

  const videoRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(projectId)
    .collection('videos')
    .doc(videoDocId);

  let cleanup: (() => Promise<void>) | undefined;

  try {
    const videoSnap = await videoRef.get();
    if (!videoSnap.exists) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const data = videoSnap.data()!;

    // Prevent double-runs if a previous click is still in flight
    if (data.geminiAnalysisStatus === 'processing') {
      return res.status(409).json({
        error: 'Analysis already in progress for this video. Please wait.',
      });
    }

    // Mark as processing
    await videoRef.update({
      geminiAnalysisStatus: 'processing',
      geminiAnalysisRequestedAt: Timestamp.now(),
      geminiAnalysisRequestedBy: userId,
      geminiAnalysisError: null,
    });

    console.log(
      `🎬 [analyze-video] Analyzing ${videoDocId} (platform=${data.platform}) for user ${userId}`,
    );
    const startedAt = Date.now();

    // Resolve a Gemini-compatible video reference for this platform.
    // YouTube → pass URL directly. Others → download + upload via Files API.
    const resolved = await resolveVideoPart(data, apiKey);
    cleanup = resolved.cleanup;

    const analysis = await callGeminiGenerate(resolved.part, apiKey);

    const durationMs = Date.now() - startedAt;
    console.log(
      `✅ [analyze-video] Gemini returned analysis for ${videoDocId} in ${(durationMs / 1000).toFixed(1)}s (${analysis.transcript.length} chars transcript)`,
    );

    await videoRef.update({
      geminiAnalysis: analysis,
      geminiAnalysisStatus: 'completed',
      geminiAnalysisCompletedAt: Timestamp.now(),
      geminiAnalysisError: null,
    });

    return res.status(200).json({ success: true, analysis });
  } catch (error: any) {
    console.error(`❌ [analyze-video] Failed for ${videoDocId}:`, error);

    // Best-effort failure write
    try {
      await videoRef.update({
        geminiAnalysisStatus: 'failed',
        geminiAnalysisError: error.message || 'Unknown error',
      });
    } catch {}

    return res.status(500).json({
      error: error.message || 'Video analysis failed',
    });
  } finally {
    // Clean up any uploaded Gemini file, regardless of success/failure
    if (cleanup) {
      await cleanup();
    }
  }
}
