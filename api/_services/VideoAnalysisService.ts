/**
 * VideoAnalysisService
 *
 * Core Gemini video analysis logic, shared between:
 * - /api/analyze-video (Firebase-auth dashboard endpoint)
 * - /api/v1/videos/[id]/analyze (API-key-auth public endpoint)
 *
 * Platform support:
 * - YouTube: passes the URL directly to Gemini via file_data.file_uri
 *   (Gemini fetches the video itself — no download needed).
 * - TikTok / Instagram / Twitter: uses the bundled yt-dlp binary
 *   (scripts/install-yt-dlp.mjs fetches it at npm install / Vercel build
 *   time into api/_bin/yt-dlp) to download the video to /tmp, then uploads
 *   to the Gemini Files API.
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { GeminiVideoAnalysis } from '../../src/types/firestore';

const execFileAsync = promisify(execFile);

// ─── Gemini config ──────────────────────────────────────
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';
const GEMINI_GENERATE_ENDPOINT = `${GEMINI_API_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_UPLOAD_ENDPOINT = `${GEMINI_API_BASE}/upload/v1beta/files`;

const GEMINI_CALL_TIMEOUT_MS = 150_000;
const FILE_ACTIVE_POLL_INTERVAL_MS = 2_000;
const FILE_ACTIVE_POLL_MAX_MS = 90_000;
const MAX_MEDIA_BYTES = 500 * 1024 * 1024;

// ─── yt-dlp config ──────────────────────────────────────
// process.cwd() is the function root on Vercel (/var/task). The binary is
// bundled via vercel.json `includeFiles: "api/_bin/**"`. Using cwd instead
// of import.meta.url makes the path stable regardless of which function
// is bundling this service.
const YT_DLP_BIN = join(process.cwd(), 'api', '_bin', 'yt-dlp');
const YT_DLP_TIMEOUT_MS = 120_000;
const YT_DLP_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

// ─── YouTube URL helpers ────────────────────────────────
function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

function canonicalYouTubeUrl(url: string): string | null {
  const id = extractYouTubeVideoId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
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

// ─── Typed errors (callers map these to HTTP status) ────
export class VideoAnalysisError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_FOUND'
      | 'ALREADY_PROCESSING'
      | 'CONFIG_ERROR'
      | 'ANALYSIS_FAILED',
  ) {
    super(message);
    this.name = 'VideoAnalysisError';
  }
}

interface GeminiFile {
  name: string;
  uri: string;
  mimeType: string;
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
}

interface YtDlpDownloadResult {
  buffer: Buffer;
  mimeType: string;
  filePath: string;
}

async function ytDlpDownloadToFile(pageUrl: string): Promise<YtDlpDownloadResult> {
  if (!existsSync(YT_DLP_BIN)) {
    throw new Error(
      `yt-dlp binary not found at ${YT_DLP_BIN}. The postinstall script (scripts/install-yt-dlp.mjs) should have downloaded it during npm install.`,
    );
  }

  const uniqueId = randomBytes(6).toString('hex');
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
    const stderr = (err?.stderr || '').toString().trim();
    const message = stderr || err?.message || 'yt-dlp exited with an error';
    throw new Error(`yt-dlp download failed: ${message.slice(0, 500)}`);
  }

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
    unlink(filePath).catch(() => {});
    throw new Error(
      `Downloaded video is too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB, max ${MAX_MEDIA_BYTES / 1024 / 1024}MB)`,
    );
  }

  const extension = filePath.split('.').pop()?.toLowerCase() || 'mp4';
  const mimeType = extension === 'mp4' ? 'video/mp4' : `video/${extension}`;

  return { buffer, mimeType, filePath };
}

async function uploadVideoToGemini(
  buffer: Buffer,
  mimeType: string,
  displayName: string,
  apiKey: string,
): Promise<GeminiFile> {
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

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(buffer.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
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

async function deleteGeminiFile(fileName: string, apiKey: string): Promise<void> {
  try {
    await fetch(`${GEMINI_API_BASE}/v1beta/${fileName}`, {
      method: 'DELETE',
      headers: { 'x-goog-api-key': apiKey },
    });
  } catch (err) {
    console.warn(`⚠️ [VideoAnalysisService] Failed to delete Gemini file ${fileName}:`, err);
  }
}

interface GeminiRawResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

type VideoPart =
  | { file_data: { file_uri: string; mime_type?: string } }
  | { text: string };

async function callGeminiGenerate(
  videoPart: VideoPart,
  apiKey: string,
): Promise<GeminiVideoAnalysis> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_CALL_TIMEOUT_MS);

  try {
    const response = await fetch(`${GEMINI_GENERATE_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [videoPart, { text: ANALYSIS_PROMPT }] }],
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

async function resolveVideoPart(
  videoData: any,
  apiKey: string,
): Promise<{ part: VideoPart; cleanup?: () => Promise<void> }> {
  const platform = videoData.platform as string;
  const rawUrl = videoData.videoUrl || videoData.url || '';

  if (platform === 'youtube') {
    const youtubeUrl = canonicalYouTubeUrl(rawUrl);
    if (!youtubeUrl) {
      throw new Error(`Could not extract a valid YouTube video ID from URL: ${rawUrl}`);
    }
    return { part: { file_data: { file_uri: youtubeUrl } } };
  }

  if (!rawUrl) {
    throw new Error(`Video has no page URL stored — cannot run yt-dlp.`);
  }

  console.log(`🔎 [VideoAnalysisService] Running yt-dlp download on ${platform} URL: ${rawUrl}`);
  const { buffer, mimeType, filePath } = await ytDlpDownloadToFile(rawUrl);
  console.log(
    `⬇️  [VideoAnalysisService] yt-dlp downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB (${mimeType})`,
  );

  let file: GeminiFile;
  try {
    console.log(`⬆️  [VideoAnalysisService] Uploading to Gemini Files API…`);
    file = await uploadVideoToGemini(
      buffer,
      mimeType,
      `${platform}-${videoData.videoId || 'video'}`,
      apiKey,
    );
    console.log(`⬆️  [VideoAnalysisService] Upload complete: ${file.name} (state=${file.state})`);
  } finally {
    unlink(filePath).catch(() => {});
  }

  let activeFile = file;
  if (file.state !== 'ACTIVE') {
    console.log(`⏳ [VideoAnalysisService] Waiting for file to become ACTIVE…`);
    activeFile = await waitForFileActive(file.name, apiKey);
    console.log(`✅ [VideoAnalysisService] File is ACTIVE`);
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

// ─── Public entry point ─────────────────────────────────

export interface PerformAnalysisOptions {
  orgId: string;
  projectId: string;
  videoDocId: string;
  requestedBy: string;
  force?: boolean;
}

export interface PerformAnalysisResult {
  analysis: GeminiVideoAnalysis;
  cached: boolean;
  durationMs: number;
}

/**
 * Run (or return cached) Gemini analysis for a video.
 *
 * Throws VideoAnalysisError with a code, or a plain Error for unexpected
 * failures. Callers are expected to translate these to their HTTP layer.
 */
export async function performVideoAnalysis(
  opts: PerformAnalysisOptions,
): Promise<PerformAnalysisResult> {
  const { orgId, projectId, videoDocId, requestedBy, force = false } = opts;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new VideoAnalysisError(
      'Gemini is not configured on the server. Set GEMINI_API_KEY.',
      'CONFIG_ERROR',
    );
  }

  const db = getFirestore();
  const videoRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(projectId)
    .collection('videos')
    .doc(videoDocId);

  const snap = await videoRef.get();
  if (!snap.exists) {
    throw new VideoAnalysisError('Video not found', 'NOT_FOUND');
  }

  const data = snap.data()!;

  // Return cached result unless force-refresh was requested
  if (!force && data.geminiAnalysis && data.geminiAnalysisStatus === 'completed') {
    return {
      analysis: data.geminiAnalysis as GeminiVideoAnalysis,
      cached: true,
      durationMs: 0,
    };
  }

  // Prevent double-runs if a previous call is still in flight
  if (data.geminiAnalysisStatus === 'processing') {
    throw new VideoAnalysisError(
      'Analysis already in progress for this video. Please wait.',
      'ALREADY_PROCESSING',
    );
  }

  await videoRef.update({
    geminiAnalysisStatus: 'processing',
    geminiAnalysisRequestedAt: Timestamp.now(),
    geminiAnalysisRequestedBy: requestedBy,
    geminiAnalysisError: null,
  });

  console.log(
    `🎬 [VideoAnalysisService] Analyzing ${videoDocId} (platform=${data.platform}) for ${requestedBy}`,
  );
  const startedAt = Date.now();
  let cleanup: (() => Promise<void>) | undefined;

  try {
    const resolved = await resolveVideoPart(data, apiKey);
    cleanup = resolved.cleanup;

    const analysis = await callGeminiGenerate(resolved.part, apiKey);
    const durationMs = Date.now() - startedAt;

    console.log(
      `✅ [VideoAnalysisService] Analysis complete for ${videoDocId} in ${(durationMs / 1000).toFixed(1)}s`,
    );

    await videoRef.update({
      geminiAnalysis: analysis,
      geminiAnalysisStatus: 'completed',
      geminiAnalysisCompletedAt: Timestamp.now(),
      geminiAnalysisError: null,
    });

    return { analysis, cached: false, durationMs };
  } catch (error: any) {
    console.error(`❌ [VideoAnalysisService] Failed for ${videoDocId}:`, error);
    try {
      await videoRef.update({
        geminiAnalysisStatus: 'failed',
        geminiAnalysisError: error.message || 'Unknown error',
      });
    } catch {}
    throw new VideoAnalysisError(
      error.message || 'Video analysis failed',
      'ANALYSIS_FAILED',
    );
  } finally {
    if (cleanup) await cleanup();
  }
}
