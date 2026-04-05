/**
 * TranscriptionService
 *
 * Handles video transcription using:
 * 1. Platform captions (YouTube auto-captions) — free, instant
 * 2. OpenAI Whisper API — fallback for platforms without native captions
 */

import { Timestamp } from 'firebase-admin/firestore';
import type { VideoTranscript, TranscriptSegment } from '../../src/types/firestore';

const YOUTUBE_FETCH_TIMEOUT_MS = 15_000;   // 15s for YouTube page/caption fetches
const WHISPER_FETCH_TIMEOUT_MS = 90_000;   // 90s for Whisper transcription (file download + processing)
const MEDIA_DOWNLOAD_TIMEOUT_MS = 30_000;  // 30s for downloading the media file

// ─── YouTube Caption Extraction ─────────────────────────

const YT_ANDROID_UA = 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)';
const YT_WEB_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)';

/**
 * Decode common HTML entities in caption text.
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/\n/g, ' ')
    .trim();
}

/**
 * Attempt to fetch YouTube auto-generated or manual captions.
 * Uses the Android innertube player API to get caption track URLs,
 * which is more reliable from server environments than web scraping.
 */
async function fetchYouTubeCaptions(videoId: string): Promise<VideoTranscript | null> {
  try {
    // Step 1: Get caption tracks via YouTube's Android innertube player API
    const playerController = new AbortController();
    const playerTimeout = setTimeout(() => playerController.abort(), YOUTUBE_FETCH_TIMEOUT_MS);
    const playerResponse = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': YT_ANDROID_UA,
      },
      body: JSON.stringify({
        context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
        videoId,
      }),
      signal: playerController.signal,
    });
    clearTimeout(playerTimeout);

    if (!playerResponse.ok) return null;

    const playerData = await playerResponse.json() as any;
    const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!Array.isArray(captionTracks) || captionTracks.length === 0) return null;

    // Prefer English, fall back to first available
    const track = captionTracks.find((t: any) => t.languageCode === 'en') || captionTracks[0];
    const captionUrl = track.baseUrl;
    const language = track.languageCode || 'en';

    if (!captionUrl) return null;

    // Step 2: Fetch the caption XML
    const captionController = new AbortController();
    const captionTimeout = setTimeout(() => captionController.abort(), YOUTUBE_FETCH_TIMEOUT_MS);
    const captionResponse = await fetch(captionUrl, {
      headers: { 'User-Agent': YT_WEB_UA },
      signal: captionController.signal,
    });
    clearTimeout(captionTimeout);
    if (!captionResponse.ok) return null;

    const xml = await captionResponse.text();
    if (!xml) return null;

    // Step 3: Parse caption segments (supports both <p> and <text> formats)
    const segments: TranscriptSegment[] = [];

    // Try <p t="ms" d="ms"> format first (Android innertube response)
    const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
    let match;
    while ((match = pRegex.exec(xml)) !== null) {
      const startMs = parseInt(match[1], 10);
      const durMs = parseInt(match[2], 10);
      // Strip inner <s> tags and HTML tags, then decode entities
      let text = match[3].replace(/<[^>]+>/g, '');
      text = decodeEntities(text);
      if (text) {
        segments.push({ start: startMs / 1000, end: (startMs + durMs) / 1000, text });
      }
    }

    // Fallback: try <text start="s" dur="s"> format (legacy web response)
    if (segments.length === 0) {
      const textRegex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
      while ((match = textRegex.exec(xml)) !== null) {
        const start = parseFloat(match[1]);
        const dur = parseFloat(match[2]);
        const text = decodeEntities(match[3]);
        if (text) {
          segments.push({ start, end: start + dur, text });
        }
      }
    }

    if (segments.length === 0) return null;

    const fullText = segments.map(s => s.text).join(' ');

    return {
      text: fullText,
      language,
      source: 'platform_captions',
      segments,
      wordCount: fullText.split(/\s+/).length,
      generatedAt: Timestamp.now(),
    };
  } catch (error) {
    console.warn(`⚠️ [Transcription] YouTube caption fetch failed for ${videoId}:`, error);
    return null;
  }
}

// ─── OpenAI Whisper Transcription ────────────────────────

/**
 * Download a media file from a URL and return it as a Buffer.
 */
async function downloadMedia(mediaUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MEDIA_DOWNLOAD_TIMEOUT_MS);
    const response = await fetch(mediaUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`❌ [Transcription] Media download failed: ${response.status} from ${mediaUrl}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'video/mp4';
    return { buffer: Buffer.from(arrayBuffer), contentType };
  } catch (error: any) {
    console.error(`❌ [Transcription] Media download error:`, error.message);
    return null;
  }
}

/**
 * Transcribe audio/video using the OpenAI Whisper API.
 * Downloads the media file first, then sends it as multipart form data.
 */
async function transcribeWithWhisper(mediaUrl: string): Promise<VideoTranscript | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ [Transcription] OPENAI_API_KEY not set');
    return null;
  }

  try {
    // Step 1: Download the media file
    console.log(`🎙️ [Transcription] Downloading media for Whisper...`);
    const media = await downloadMedia(mediaUrl);
    if (!media) return null;

    // Whisper accepts up to 25MB
    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    if (media.buffer.length > MAX_FILE_SIZE) {
      console.error(`❌ [Transcription] Media file too large (${(media.buffer.length / 1024 / 1024).toFixed(1)}MB, max 25MB)`);
      return null;
    }

    // Step 2: Build multipart form data
    const ext = media.contentType.includes('mp4') ? 'mp4'
      : media.contentType.includes('webm') ? 'webm'
      : media.contentType.includes('mpeg') ? 'mp3'
      : 'mp4';

    const blob = new Blob([media.buffer], { type: media.contentType });
    const formData = new FormData();
    formData.append('file', blob, `audio.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    // Step 3: Call Whisper API
    console.log(`🎙️ [Transcription] Sending ${(media.buffer.length / 1024).toFixed(0)}KB to Whisper API...`);
    const whisperController = new AbortController();
    const whisperTimeout = setTimeout(() => whisperController.abort(), WHISPER_FETCH_TIMEOUT_MS);
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
      signal: whisperController.signal,
    });
    clearTimeout(whisperTimeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Transcription] Whisper API error ${response.status}:`, errorText);
      return null;
    }

    const result = await response.json() as any;

    if (!result.text) {
      console.warn('⚠️ [Transcription] Whisper returned empty transcript');
      return null;
    }

    const fullText = result.text;
    const detectedLanguage = result.language || 'en';

    // Build timestamped segments from Whisper's verbose_json response
    const segments: TranscriptSegment[] = [];
    if (result.segments && Array.isArray(result.segments)) {
      for (const seg of result.segments) {
        segments.push({
          start: seg.start,
          end: seg.end,
          text: seg.text?.trim() || '',
        });
      }
    }

    return {
      text: fullText,
      language: detectedLanguage,
      source: 'whisper',
      segments: segments.length > 0 ? segments : undefined,
      wordCount: fullText.split(/\s+/).length,
      generatedAt: Timestamp.now(),
    };
  } catch (error: any) {
    console.error('❌ [Transcription] Whisper request failed:', error.message);
    return null;
  }
}

// ─── Platform-Specific Media URL Extraction ─────────────

/**
 * Extract a platform-specific video ID from a URL.
 */
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ─── Main Transcription Logic ───────────────────────────

export interface TranscriptionResult {
  success: boolean;
  transcript?: VideoTranscript;
  error?: string;
}

/**
 * Transcribe a video. Tries platform captions first, falls back to Whisper.
 *
 * @param platform - The video platform (youtube, tiktok, instagram, twitter)
 * @param videoUrl - The video page URL (e.g. https://youtube.com/watch?v=...)
 * @param mediaUrl - Optional direct media file URL (for Whisper fallback)
 */
export async function transcribeVideo(
  platform: string,
  videoUrl: string,
  mediaUrl?: string | null,
): Promise<TranscriptionResult> {
  console.log(`🎙️ [Transcription] Starting for ${platform} video: ${videoUrl}`);

  // Layer 1: Try platform captions (free, instant)
  if (platform === 'youtube') {
    const ytId = extractYouTubeVideoId(videoUrl);
    if (ytId) {
      console.log(`🎙️ [Transcription] Trying YouTube captions for ${ytId}`);
      const caption = await fetchYouTubeCaptions(ytId);
      if (caption) {
        console.log(`✅ [Transcription] Got YouTube captions (${caption.wordCount} words)`);
        return { success: true, transcript: caption };
      }
      console.log(`⚠️ [Transcription] No YouTube captions available, trying Whisper`);
    }
  }

  // Layer 2: OpenAI Whisper audio transcription (paid fallback)
  if (mediaUrl) {
    console.log(`🎙️ [Transcription] Using Whisper for media URL`);
    const whisperResult = await transcribeWithWhisper(mediaUrl);
    if (whisperResult) {
      console.log(`✅ [Transcription] Whisper transcription complete (${whisperResult.wordCount} words)`);
      return { success: true, transcript: whisperResult };
    }
  }

  // No transcription method succeeded
  if (!mediaUrl && platform !== 'youtube') {
    return {
      success: false,
      error: `No media URL available for ${platform} video. Transcription requires a direct video file URL.`,
    };
  }

  return {
    success: false,
    error: 'Transcription failed — no captions found and audio transcription unsuccessful.',
  };
}
