/**
 * Test script for the transcription service.
 * Tests YouTube captions (via Android innertube API) and Whisper API.
 *
 * Usage: node scripts/test-transcription.mjs <youtube|whisper> [url]
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually (no dotenv dependency)
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    let value = trimmed.substring(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
} catch {}

const WHISPER_FETCH_TIMEOUT_MS = 90_000;
const MEDIA_DOWNLOAD_TIMEOUT_MS = 30_000;

// ─── YouTube Caption Test ───────────────────────────────

async function testYouTube(videoUrl) {
  console.log(`\n🎬 Testing YouTube captions for: ${videoUrl}\n`);

  const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (!match) {
    console.error('❌ Could not extract YouTube video ID from URL');
    return;
  }
  const videoId = match[1];
  console.log(`📎 Video ID: ${videoId}`);

  // Step 1: Get caption tracks via Android innertube player API
  console.log(`📡 Fetching caption tracks via Android innertube API...`);
  const playerResponse = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
    },
    body: JSON.stringify({
      context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
      videoId,
    }),
  });

  if (!playerResponse.ok) {
    console.error(`❌ Player API failed: ${playerResponse.status}`);
    return;
  }

  const playerData = await playerResponse.json();
  const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captionTracks || captionTracks.length === 0) {
    console.error('❌ No caption tracks found');
    return;
  }

  console.log(`🎤 Found ${captionTracks.length} caption track(s):`);
  captionTracks.forEach((t, i) => console.log(`   ${i + 1}. ${t.name?.simpleText || t.languageCode} (${t.languageCode})`));

  // Step 2: Fetch caption XML
  const track = captionTracks.find(t => t.languageCode === 'en') || captionTracks[0];
  const captionResponse = await fetch(track.baseUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36' },
  });
  const xml = await captionResponse.text();
  console.log(`📄 Caption XML fetched (${xml.length} bytes)`);

  // Step 3: Parse — try <p t="ms" d="ms"> format first, then <text> fallback
  const segments = [];
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = pRegex.exec(xml)) !== null) {
    let text = m[3].replace(/<[^>]+>/g, '');
    text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/\n/g, ' ').trim();
    if (text) segments.push(text);
  }
  if (segments.length === 0) {
    const textRegex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
    while ((m = textRegex.exec(xml)) !== null) {
      const text = m[3].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/\n/g, ' ').trim();
      if (text) segments.push(text);
    }
  }

  const fullText = segments.join(' ');
  const wordCount = fullText.split(/\s+/).length;

  console.log(`\n✅ SUCCESS — YouTube Captions`);
  console.log(`   Language: ${track.languageCode}`);
  console.log(`   Segments: ${segments.length}`);
  console.log(`   Words: ${wordCount}`);
  console.log(`   Source: platform_captions (FREE)`);
  console.log(`\n📝 First 500 chars of transcript:`);
  console.log(`   "${fullText.substring(0, 500)}..."\n`);
}

// ─── Whisper Test ───────────────────────────────────────

async function testWhisper(mediaUrl) {
  console.log(`\n🎙️ Testing OpenAI Whisper for: ${mediaUrl}\n`);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not set in .env.local');
    return;
  }
  console.log(`🔑 API key loaded (${apiKey.substring(0, 12)}...)`);

  console.log(`📥 Downloading media...`);
  const dlController = new AbortController();
  const dlTimeout = setTimeout(() => dlController.abort(), MEDIA_DOWNLOAD_TIMEOUT_MS);
  const dlResponse = await fetch(mediaUrl, { signal: dlController.signal });
  clearTimeout(dlTimeout);

  if (!dlResponse.ok) {
    console.error(`❌ Media download failed: ${dlResponse.status}`);
    return;
  }

  const arrayBuffer = await dlResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = dlResponse.headers.get('content-type') || 'video/mp4';
  console.log(`   Size: ${(buffer.length / 1024).toFixed(0)}KB (${contentType})`);

  if (buffer.length > 25 * 1024 * 1024) {
    console.error(`❌ File too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB, max 25MB)`);
    return;
  }

  console.log(`📤 Sending to Whisper API...`);
  const ext = contentType.includes('mp4') ? 'mp4' : contentType.includes('webm') ? 'webm' : contentType.includes('wav') ? 'wav' : contentType.includes('mpeg') ? 'mp3' : 'mp4';
  const blob = new Blob([buffer], { type: contentType });
  const formData = new FormData();
  formData.append('file', blob, `audio.${ext}`);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');

  const whisperController = new AbortController();
  const whisperTimeout = setTimeout(() => whisperController.abort(), WHISPER_FETCH_TIMEOUT_MS);
  const startTime = Date.now();
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
    signal: whisperController.signal,
  });
  clearTimeout(whisperTimeout);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Whisper API error ${response.status}: ${errorText}`);
    return;
  }

  const result = await response.json();
  const fullText = result.text;
  const wordCount = fullText.split(/\s+/).length;
  const segmentCount = result.segments?.length || 0;

  console.log(`\n✅ SUCCESS — Whisper API (${elapsed}s)`);
  console.log(`   Language: ${result.language}`);
  console.log(`   Segments: ${segmentCount}`);
  console.log(`   Words: ${wordCount}`);
  console.log(`   Duration: ${result.duration?.toFixed(1)}s`);
  console.log(`   Source: whisper (PAID)`);
  console.log(`\n📝 First 500 chars of transcript:`);
  console.log(`   "${fullText.substring(0, 500)}..."\n`);
}

// ─── Main ───────────────────────────────────────────────

const mode = process.argv[2];
const url = process.argv[3];

if (!mode || !url) {
  console.log('Usage: node scripts/test-transcription.mjs <youtube|whisper> <url>');
  process.exit(1);
}

try {
  if (mode === 'youtube') {
    await testYouTube(url);
  } else if (mode === 'whisper') {
    await testWhisper(url);
  } else {
    console.error(`Unknown mode: ${mode}. Use 'youtube' or 'whisper'.`);
  }
} catch (error) {
  console.error('💥 Test failed:', error);
}
