#!/usr/bin/env node
/**
 * Standalone smoke test for the Gemini video analysis pipeline.
 *
 * Runs the *exact same pipeline* as /api/analyze-video, minus Firebase,
 * auth, and Vercel — just yt-dlp + fetch + Gemini. Use this to verify
 * the pipeline works before deploying to Vercel.
 *
 * Usage:
 *   node scripts/test-analyze-video.mjs <video-url>
 *
 * Requires GEMINI_API_KEY in .env.local (or .env) at the repo root.
 *
 * The script uses the bundled yt-dlp binary at api/_bin/yt-dlp, which
 * the postinstall script (scripts/install-yt-dlp.mjs) downloads for your
 * current platform during `npm install`. On your Mac that's the macOS
 * universal binary; on Vercel it's the Linux x86-64 build.
 *
 * Example:
 *   node scripts/test-analyze-video.mjs "https://www.youtube.com/watch?v=jNQXAC9IVRw"
 *   node scripts/test-analyze-video.mjs "https://www.tiktok.com/@user/video/1234"
 *
 * NOTE: local success does not guarantee Vercel success for Instagram
 * specifically — Instagram tends to block Vercel datacenter IPs but not
 * residential IPs. For YouTube / TikTok / Twitter, local success is a
 * strong signal that production will also work.
 */

import { readFileSync, existsSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// ─── Load .env.local / .env ─────────────────────────────
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvFile(join(repoRoot, '.env.local'));
loadEnvFile(join(repoRoot, '.env'));

// ─── Config ─────────────────────────────────────────────
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';
const GEMINI_GENERATE_ENDPOINT = `${GEMINI_API_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_UPLOAD_ENDPOINT = `${GEMINI_API_BASE}/upload/v1beta/files`;

// Use the same binary the production endpoint uses. Postinstall downloads
// it for the current platform into api/_bin/yt-dlp.
const ytDlpPath = join(repoRoot, 'api', '_bin', 'yt-dlp');

function ensureYtDlp() {
  if (!existsSync(ytDlpPath)) {
    throw new Error(
      `yt-dlp binary not found at ${ytDlpPath}.\n` +
        `Run: node scripts/install-yt-dlp.mjs\n` +
        `(or just run \`npm install\` — it fires as a postinstall hook)`,
    );
  }
  return ytDlpPath;
}

// ─── yt-dlp native download ─────────────────────────────
/**
 * Let yt-dlp do the whole download itself (extraction + CDN auth + file
 * write). Writes to /tmp with a unique filename, reads the file into a
 * Buffer, and deletes the temp file. This is much more reliable than
 * extracting a URL and fetching separately — platforms like TikTok gate
 * their CDN on cookies and signatures that only yt-dlp's full flow has.
 */
async function ytDlpDownload(pageUrl) {
  const binPath = ensureYtDlp();
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

  console.log(`[test] running yt-dlp download on: ${pageUrl}`);
  let stdout;
  try {
    const result = await execFileAsync(binPath, args, {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    stdout = result.stdout;
  } catch (err) {
    const stderr = (err?.stderr || '').toString().trim();
    throw new Error(`yt-dlp download failed: ${(stderr || err?.message || 'unknown').slice(0, 500)}`);
  }

  const filePath = stdout.trim().split('\n').pop();
  if (!filePath || !existsSync(filePath)) {
    throw new Error(`yt-dlp did not produce an output file (stdout: ${stdout.trim()})`);
  }

  try {
    const buffer = await readFile(filePath);
    const ext = filePath.split('.').pop()?.toLowerCase() || 'mp4';
    const mimeType = ext === 'mp4' ? 'video/mp4' : `video/${ext}`;
    console.log(`[test] yt-dlp downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB (${mimeType})`);
    return { buffer, mimeType, filePath };
  } finally {
    unlink(filePath).catch(() => {});
  }
}

// ─── Gemini Files API: resumable upload ─────────────────
async function uploadToGemini(buffer, mimeType, displayName, apiKey) {
  console.log(`[test] uploading ${(buffer.length / 1024 / 1024).toFixed(1)}MB to Gemini Files API...`);
  const startRes = await fetch(GEMINI_UPLOAD_ENDPOINT, {
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
  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Gemini upload start failed ${startRes.status}: ${errText.slice(0, 500)}`);
  }

  const uploadUrl = startRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Gemini did not return x-goog-upload-url');

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(buffer.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: buffer,
  });
  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Gemini upload finalize failed ${uploadRes.status}: ${errText.slice(0, 500)}`);
  }

  const data = await uploadRes.json();
  if (!data.file?.uri || !data.file?.name) {
    throw new Error('Gemini upload response missing file.uri/name');
  }
  console.log(`[test] uploaded: ${data.file.name} (state=${data.file.state})`);
  return data.file;
}

async function waitForActive(fileName, apiKey) {
  const startedAt = Date.now();
  process.stdout.write('[test] polling for ACTIVE');
  while (Date.now() - startedAt < 90_000) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`${GEMINI_API_BASE}/v1beta/${fileName}`, {
      headers: { 'x-goog-api-key': apiKey },
    });
    if (!res.ok) throw new Error(`File poll failed: HTTP ${res.status}`);
    const file = await res.json();
    if (file.state === 'ACTIVE') {
      process.stdout.write(' done\n');
      return file;
    }
    if (file.state === 'FAILED') {
      process.stdout.write('\n');
      throw new Error('Gemini reported file state FAILED');
    }
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  throw new Error('Timed out waiting for file ACTIVE');
}

async function deleteGeminiFile(fileName, apiKey) {
  try {
    await fetch(`${GEMINI_API_BASE}/v1beta/${fileName}`, {
      method: 'DELETE',
      headers: { 'x-goog-api-key': apiKey },
    });
    console.log(`[test] cleaned up ${fileName}`);
  } catch (err) {
    console.warn(`[test] cleanup failed: ${err.message}`);
  }
}

// ─── Prompt + schema (must match api/analyze-video.ts) ──
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
        properties: { timestamp: { type: 'STRING' }, text: { type: 'STRING' } },
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

async function callGemini(videoPart, apiKey) {
  console.log(`[test] calling Gemini ${GEMINI_MODEL}...`);
  const startedAt = Date.now();
  const res = await fetch(`${GEMINI_GENERATE_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [videoPart, { text: ANALYSIS_PROMPT }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.4,
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 500)}`);
  }
  const data = await res.json();
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the request: ${data.promptFeedback.blockReason}`);
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response');
  const parsed = JSON.parse(text);
  console.log(`[test] Gemini responded in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  return parsed;
}

// ─── Platform detection ─────────────────────────────────
function extractYouTubeId(url) {
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

function detectPlatform(url) {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/tiktok\.com/.test(url)) return 'tiktok';
  if (/instagram\.com/.test(url)) return 'instagram';
  if (/twitter\.com|x\.com/.test(url)) return 'twitter';
  return 'unknown';
}

// ─── Pretty-print the analysis ──────────────────────────
function printAnalysis(analysis) {
  const hr = '='.repeat(72);
  console.log(`\n${hr}\nANALYSIS RESULT\n${hr}`);

  if (analysis.summary) console.log(`\nSummary:\n  ${analysis.summary}`);
  if (analysis.hook) console.log(`\nHook:\n  ${analysis.hook}`);
  if (analysis.tone) console.log(`\nTone: ${analysis.tone}`);
  if (analysis.pacing) console.log(`Pacing: ${analysis.pacing}`);

  if (analysis.topics?.length) {
    console.log(`\nTopics: ${analysis.topics.join(', ')}`);
  }

  if (analysis.whatWorked?.length) {
    console.log(`\nWhat's working:`);
    for (const item of analysis.whatWorked) console.log(`  - ${item}`);
  }

  if (analysis.suggestions?.length) {
    console.log(`\nSuggestions:`);
    for (const item of analysis.suggestions) console.log(`  - ${item}`);
  }

  if (analysis.transcriptSegments?.length) {
    console.log(`\nTranscript (${analysis.transcriptSegments.length} segments):`);
    const preview = analysis.transcriptSegments.slice(0, 8);
    for (const seg of preview) console.log(`  [${seg.timestamp}] ${seg.text}`);
    if (analysis.transcriptSegments.length > 8) {
      console.log(`  ... (${analysis.transcriptSegments.length - 8} more segments)`);
    }
  } else if (analysis.transcript) {
    const preview = analysis.transcript.slice(0, 600);
    console.log(`\nTranscript (first 600 chars):\n  ${preview}${analysis.transcript.length > 600 ? '...' : ''}`);
  }

  console.log(`\n${hr}\n`);
}

// ─── Main ───────────────────────────────────────────────
async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('usage: node scripts/test-analyze-video.mjs <video-url>');
    console.error('');
    console.error('examples:');
    console.error('  node scripts/test-analyze-video.mjs "https://www.youtube.com/watch?v=jNQXAC9IVRw"');
    console.error('  node scripts/test-analyze-video.mjs "https://www.tiktok.com/@user/video/1234"');
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set.');
    console.error('Add it to .env.local at the repo root:');
    console.error('  echo "GEMINI_API_KEY=your-key-here" >> .env.local');
    process.exit(1);
  }

  const platform = detectPlatform(url);
  console.log(`[test] platform: ${platform}`);
  console.log(`[test] url:      ${url}`);

  let videoPart;
  let cleanup;

  if (platform === 'youtube') {
    // Gemini fetches YouTube URLs directly — no download needed
    const id = extractYouTubeId(url);
    if (!id) throw new Error('Could not extract YouTube video ID from URL');
    const canonical = `https://www.youtube.com/watch?v=${id}`;
    console.log(`[test] using YouTube fast path: ${canonical}`);
    videoPart = { file_data: { file_uri: canonical } };
  } else {
    // TikTok / Instagram / Twitter: yt-dlp → download → upload → analyze
    const { buffer, mimeType } = await ytDlpDownload(url);

    const file = await uploadToGemini(
      buffer,
      mimeType,
      `test-${platform}-${Date.now()}`,
      apiKey,
    );

    let activeFile = file;
    if (file.state !== 'ACTIVE') {
      activeFile = await waitForActive(file.name, apiKey);
    }

    videoPart = {
      file_data: {
        file_uri: activeFile.uri,
        mime_type: activeFile.mimeType || mimeType,
      },
    };
    cleanup = () => deleteGeminiFile(file.name, apiKey);
  }

  try {
    const analysis = await callGemini(videoPart, apiKey);
    printAnalysis(analysis);
    console.log(`[test] SUCCESS — pipeline works end-to-end for ${platform}`);
  } finally {
    if (cleanup) {
      await cleanup();
    }
  }
}

main().catch(err => {
  console.error(`\n[test] FAILED: ${err.message}`);
  if (process.env.DEBUG && err.stack) console.error(err.stack);
  process.exit(1);
});
