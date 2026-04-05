/**
 * Admin API v1 - Viral Content Management
 * POST   /api/v1/viral/admin        - Add a new viral video (auto-enriches via Apify + AI)
 * DELETE /api/v1/viral/admin?id=xxx  - Remove a viral video
 *
 * Requires the `viral:write` scope.
 * See also: admin/cleanup.ts for the batch-cleanup endpoint.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../_utils/firebase-admin.js';
import { withApiAuth } from '../../_middleware/apiKeyAuth.js';
import { runApifyActor } from '../../apify-client.js';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';

initializeFirebase();
const db = getFirestore();

const VIRAL_COLLECTION = 'viralContent';

// ─── Router ──────────────────────────────────────────────

async function handler(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  switch (req.method) {
    case 'POST':
      return await addViralVideo(req, res, auth);
    case 'DELETE':
      return await removeViralVideo(req, res, auth);
    default:
      return res.status(405).json({
        success: false,
        error: { message: 'Method not allowed. Use POST or DELETE.', code: 'METHOD_NOT_ALLOWED' }
      });
  }
}

// ─── POST: Add Viral Video ──────────────────────────────

async function addViralVideo(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const body = req.body || {};

  // Validate required fields
  if (!body.url || typeof body.url !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Field "url" is required and must be a string.', code: 'VALIDATION_ERROR' }
    });
  }

  const validPlatforms = ['tiktok', 'instagram', 'youtube', 'twitter'];
  if (!body.platform || !validPlatforms.includes(body.platform)) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Field "platform" is required and must be one of: ${validPlatforms.join(', ')}`,
        code: 'VALIDATION_ERROR'
      }
    });
  }

  const validContentTypes = ['video', 'slideshow'];
  if (body.contentType && !validContentTypes.includes(body.contentType)) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Field "contentType" must be one of: ${validContentTypes.join(', ')}`,
        code: 'VALIDATION_ERROR'
      }
    });
  }

  if (body.tags && !Array.isArray(body.tags)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Field "tags" must be an array of strings.', code: 'VALIDATION_ERROR' }
    });
  }

  // Check for duplicate URL
  const existingSnap = await db
    .collection(VIRAL_COLLECTION)
    .where('url', '==', body.url)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    return res.status(409).json({
      success: false,
      error: { message: 'A viral video with this URL already exists.', code: 'ALREADY_EXISTS' }
    });
  }

  // Determine next order value
  const lastOrderSnap = await db
    .collection(VIRAL_COLLECTION)
    .orderBy('order', 'desc')
    .limit(1)
    .get();

  const nextOrder = lastOrderSnap.empty ? 1 : (lastOrderSnap.docs[0].data().order || 0) + 1;

  const now = Timestamp.now();

  const newVideo: Record<string, any> = {
    order: nextOrder,
    url: body.url,
    platform: body.platform,
    title: body.title || '',
    description: body.description || '',
    thumbnail: body.thumbnail || '',
    uploaderHandle: body.uploaderHandle || '',
    views: typeof body.views === 'number' ? body.views : 0,
    likes: typeof body.likes === 'number' ? body.likes : 0,
    comments: typeof body.comments === 'number' ? body.comments : 0,
    shares: typeof body.shares === 'number' ? body.shares : 0,
    saves: typeof body.saves === 'number' ? body.saves : 0,
    followerCount: typeof body.followerCount === 'number' ? body.followerCount : 0,
    contentType: body.contentType || 'video',
    category: body.category || '',
    tags: Array.isArray(body.tags) ? body.tags : [],
    monetization: body.monetization || null,
    productBrand: body.productBrand || null,
    uploadDate: now,
    addedAt: now,
    addedBy: auth.apiKey.id,
    isActive: true,
    // Enrichment status
    enrichmentStatus: 'pending',
  };

  const docRef = await db.collection(VIRAL_COLLECTION).add(newVideo);

  // If folderId is provided, also save to the org's saved collection
  const folderId = body.folderId || body.saveToFolder;
  if (folderId) {
    const orgId = auth.organizationId;
    const savedDoc = {
      videoId: docRef.id,
      folderId: typeof folderId === 'string' ? folderId : 'default',
      savedAt: now,
      video: { id: docRef.id, ...newVideo },
    };
    await db
      .collection(`organizations/${orgId}/savedViralContent`)
      .doc(docRef.id)
      .set(savedDoc);
  }

  // ── Background enrichment (don't await — respond immediately) ──
  const shouldEnrich = body.enrich !== false; // default true
  if (shouldEnrich) {
    enrichViralVideo(docRef.id, body.url, body.platform, body).catch((err) => {
      console.error(`❌ Enrichment failed for ${docRef.id}:`, err);
    });
  }

  return res.status(201).json({
    success: true,
    data: {
      id: docRef.id,
      ...newVideo,
      uploadDate: now.toDate().toISOString(),
      addedAt: now.toDate().toISOString(),
      ...(folderId ? { savedToFolder: folderId } : {}),
      enriching: shouldEnrich,
    },
  });
}

// ─── Background Enrichment ──────────────────────────────

async function enrichViralVideo(
  docId: string,
  url: string,
  platform: string,
  body: Record<string, any>,
) {
  console.log(`🔄 [ENRICH] Starting enrichment for ${docId} (${platform}): ${url}`);
  const docRef = db.collection(VIRAL_COLLECTION).doc(docId);

  try {
    await docRef.update({ enrichmentStatus: 'scraping' });

    // ── Step 1: Apify scrape for real metrics ──
    const scraped = await scrapeVideoMetrics(url, platform);

    if (scraped) {
      const updates: Record<string, any> = {
        enrichmentStatus: 'scraped',
        enrichedAt: Timestamp.now(),
      };

      // Only overwrite fields if they were empty/zero in the original submission
      if (!body.title && scraped.title) updates.title = scraped.title;
      if (!body.description && scraped.description) updates.description = scraped.description;
      if (!body.thumbnail && scraped.thumbnail) updates.thumbnail = scraped.thumbnail;
      if (!body.uploaderHandle && scraped.uploaderHandle) updates.uploaderHandle = scraped.uploaderHandle;
      if (scraped.followerCount) updates.followerCount = scraped.followerCount;

      // Always update metrics from scraper (they're the real numbers)
      if (scraped.views) updates.views = scraped.views;
      if (scraped.likes) updates.likes = scraped.likes;
      if (scraped.comments) updates.comments = scraped.comments;
      if (scraped.shares) updates.shares = scraped.shares;
      if (scraped.saves) updates.saves = scraped.saves;
      if (scraped.uploadDate) updates.uploadDate = scraped.uploadDate;
      if (scraped.duration) updates.duration = scraped.duration;
      if (scraped.mediaUrl) updates.mediaUrl = scraped.mediaUrl;

      await docRef.update(updates);
      console.log(`✅ [ENRICH] Metrics scraped for ${docId}: ${scraped.views} views, ${scraped.likes} likes`);
    } else {
      console.warn(`⚠️ [ENRICH] No scrape data returned for ${docId}`);
    }

    // ── Step 2: Transcription ──
    await docRef.update({ enrichmentStatus: 'transcribing' });
    const transcript = await transcribeVideo(url, platform, scraped?.mediaUrl);

    if (transcript) {
      await docRef.update({
        transcript: transcript.text,
        transcriptLanguage: transcript.language || 'en',
        transcriptSource: transcript.source,
        transcriptSegments: transcript.segments || [],
        transcriptWordCount: transcript.wordCount || 0,
      });
      console.log(`✅ [ENRICH] Transcribed ${docId}: ${transcript.wordCount} words`);
    }

    // ── Step 3: AI Analysis ──
    await docRef.update({ enrichmentStatus: 'analyzing' });
    const currentDoc = await docRef.get();
    const currentData = currentDoc.data() || {};
    const analysis = await analyzeVideo(currentData);

    if (analysis) {
      await docRef.update({
        aiAnalysis: analysis,
        enrichmentStatus: 'completed',
        enrichmentCompletedAt: Timestamp.now(),
      });
      console.log(`✅ [ENRICH] AI analysis complete for ${docId}`);
    } else {
      await docRef.update({ enrichmentStatus: 'completed', enrichmentCompletedAt: Timestamp.now() });
    }

  } catch (err: any) {
    console.error(`❌ [ENRICH] Error enriching ${docId}:`, err.message);
    await docRef.update({
      enrichmentStatus: 'failed',
      enrichmentError: err.message?.substring(0, 500),
    }).catch(() => {});
  }
}

// ─── Scrape Video Metrics via Apify ─────────────────────

interface ScrapedData {
  title?: string;
  description?: string;
  thumbnail?: string;
  uploaderHandle?: string;
  followerCount?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  uploadDate?: Timestamp;
  duration?: number;
  mediaUrl?: string;
}

async function scrapeVideoMetrics(url: string, platform: string): Promise<ScrapedData | null> {
  try {
    if (platform === 'tiktok') {
      const result = await runApifyActor({
        actorId: 'apidojo/tiktok-scraper-api',
        input: {
          startUrls: [url],
          maxItems: 1,
          includeSearchKeywords: false,
          proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
        },
      });
      const item = result.items?.[0];
      if (!item) return null;
      return {
        title: item.text || item.desc || '',
        description: item.text || item.desc || '',
        thumbnail: item.videoMeta?.coverUrl || item.covers?.default || '',
        uploaderHandle: item.authorMeta?.name || item.author?.uniqueId || '',
        followerCount: item.authorMeta?.fans || item.authorStats?.followerCount || 0,
        views: item.playCount || item.stats?.playCount || 0,
        likes: item.diggCount || item.stats?.diggCount || 0,
        comments: item.commentCount || item.stats?.commentCount || 0,
        shares: item.shareCount || item.stats?.shareCount || 0,
        saves: item.collectCount || 0,
        uploadDate: item.createTime ? Timestamp.fromDate(new Date(item.createTime * 1000)) : undefined,
        duration: item.videoMeta?.duration || item.video?.duration || 0,
        mediaUrl: item.videoMeta?.downloadAddr || item.video?.downloadAddr || '',
      };
    }

    if (platform === 'instagram') {
      const result = await runApifyActor({
        actorId: 'hpix~ig-reels-scraper',
        input: {
          post_urls: [url],
          target: 'reels_only',
          reels_count: 1,
          include_raw_data: true,
          proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'], apifyProxyCountry: 'US' },
          maxConcurrency: 1,
          maxRequestRetries: 3,
        },
      });
      const item = result.items?.[0];
      if (!item) return null;
      return {
        title: item.caption || '',
        description: item.caption || '',
        thumbnail: item.thumbnail_url || item.display_url || '',
        uploaderHandle: item.owner_username || item.user?.username || '',
        followerCount: item.owner_follower_count || 0,
        views: item.video_view_count || item.play_count || 0,
        likes: item.like_count || 0,
        comments: item.comment_count || 0,
        shares: item.share_count || 0,
        saves: item.save_count || 0,
        uploadDate: item.taken_at ? Timestamp.fromDate(new Date(item.taken_at * 1000)) : undefined,
        duration: item.video_duration || 0,
        mediaUrl: item.video_url || '',
      };
    }

    if (platform === 'youtube') {
      const youtubeApiKey = process.env.YOUTUBE_API_KEY;
      if (!youtubeApiKey) return null;

      let videoId = '';
      try {
        const u = new URL(url);
        if (u.pathname.includes('/shorts/')) videoId = u.pathname.split('/shorts/')[1]?.split('/')[0] || '';
        else if (u.hostname.includes('youtu.be')) videoId = u.pathname.substring(1).split('/')[0];
        else videoId = u.searchParams.get('v') || '';
      } catch { return null; }
      if (!videoId) return null;

      const ytUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${encodeURIComponent(videoId)}&key=${youtubeApiKey}`;
      const resp = await fetch(ytUrl);
      if (!resp.ok) return null;
      const data = await resp.json();
      const item = data.items?.[0];
      if (!item) return null;

      const stats = item.statistics || {};
      const snippet = item.snippet || {};
      return {
        title: snippet.title || '',
        description: snippet.description || '',
        thumbnail: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || '',
        uploaderHandle: snippet.channelTitle || '',
        views: parseInt(stats.viewCount || '0', 10),
        likes: parseInt(stats.likeCount || '0', 10),
        comments: parseInt(stats.commentCount || '0', 10),
        uploadDate: snippet.publishedAt ? Timestamp.fromDate(new Date(snippet.publishedAt)) : undefined,
      };
    }

    if (platform === 'twitter') {
      const result = await runApifyActor({
        actorId: 'gentle_cloud/twitter-tweets-scraper',
        input: {
          start_urls: [url],
          result_count: 1,
          proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
        },
      });
      const item = result.items?.[0];
      if (!item) return null;
      return {
        title: item.text || item.full_text || '',
        description: item.text || item.full_text || '',
        thumbnail: item.media?.[0]?.media_url_https || '',
        uploaderHandle: item.user?.screen_name || item.author?.userName || '',
        followerCount: item.user?.followers_count || item.author?.followers || 0,
        views: item.views || item.viewCount || 0,
        likes: item.favorite_count || item.likeCount || 0,
        comments: item.reply_count || item.replyCount || 0,
        shares: item.retweet_count || item.retweetCount || 0,
        saves: item.bookmark_count || item.bookmarkCount || 0,
        mediaUrl: item.media?.[0]?.video_info?.variants?.find((v: any) => v.content_type === 'video/mp4')?.url || '',
      };
    }

    return null;
  } catch (err: any) {
    console.error(`❌ [SCRAPE] Failed for ${platform}:`, err.message);
    return null;
  }
}

// ─── Transcription ──────────────────────────────────────

interface TranscriptResult {
  text: string;
  language?: string;
  source: string;
  segments?: { start: number; end: number; text: string }[];
  wordCount: number;
}

async function transcribeVideo(url: string, platform: string, mediaUrl?: string): Promise<TranscriptResult | null> {
  try {
    // YouTube: use free platform captions
    if (platform === 'youtube') {
      let videoId = '';
      try {
        const u = new URL(url);
        if (u.pathname.includes('/shorts/')) videoId = u.pathname.split('/shorts/')[1]?.split('/')[0] || '';
        else if (u.hostname.includes('youtu.be')) videoId = u.pathname.substring(1).split('/')[0];
        else videoId = u.searchParams.get('v') || '';
      } catch { return null; }
      if (!videoId) return null;

      // Fetch captions via innertube API
      const playerResp = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)' },
        body: JSON.stringify({
          videoId,
          context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', hl: 'en' } },
        }),
      });
      if (!playerResp.ok) return null;
      const playerData = await playerResp.json();
      const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!tracks?.length) return null;

      const track = tracks.find((t: any) => t.languageCode === 'en') || tracks[0];
      const captionResp = await fetch(track.baseUrl);
      if (!captionResp.ok) return null;
      const xml = await captionResp.text();

      // Parse caption XML
      const segments: { start: number; end: number; text: string }[] = [];
      const regex = /<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]*)<\/text>/g;
      let match;
      while ((match = regex.exec(xml)) !== null) {
        const start = parseFloat(match[1]);
        const dur = parseFloat(match[2]);
        const text = match[3].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
        if (text) segments.push({ start, end: start + dur, text });
      }

      const fullText = segments.map((s) => s.text).join(' ');
      return {
        text: fullText,
        language: track.languageCode || 'en',
        source: 'platform_captions',
        segments,
        wordCount: fullText.split(/\s+/).filter(Boolean).length,
      };
    }

    // Other platforms: use OpenAI Whisper if mediaUrl available
    if (mediaUrl) {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) return null;

      // Download media file
      const mediaResp = await fetch(mediaUrl, { signal: AbortSignal.timeout(30000) });
      if (!mediaResp.ok) return null;
      const mediaBuffer = Buffer.from(await mediaResp.arrayBuffer());

      if (mediaBuffer.length > 25 * 1024 * 1024) {
        console.warn('⚠️ Media file too large for Whisper (>25MB)');
        return null;
      }

      // Call Whisper API
      const formData = new FormData();
      formData.append('file', new Blob([mediaBuffer], { type: 'video/mp4' }), 'video.mp4');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');

      const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: formData,
        signal: AbortSignal.timeout(90000),
      });

      if (!whisperResp.ok) return null;
      const whisperData = await whisperResp.json();

      const segments = (whisperData.segments || []).map((s: any) => ({
        start: s.start,
        end: s.end,
        text: s.text?.trim() || '',
      }));

      return {
        text: whisperData.text || '',
        language: whisperData.language || 'en',
        source: 'whisper',
        segments,
        wordCount: (whisperData.text || '').split(/\s+/).filter(Boolean).length,
      };
    }

    return null;
  } catch (err: any) {
    console.error(`❌ [TRANSCRIBE] Failed:`, err.message);
    return null;
  }
}

// ─── AI Analysis ────────────────────────────────────────

async function analyzeVideo(videoData: Record<string, any>): Promise<Record<string, any> | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return null;

  const title = videoData.title || '';
  const description = videoData.description || '';
  const transcript = videoData.transcript || '';
  const handle = videoData.uploaderHandle || '';
  const category = videoData.category || '';

  // Skip if we have no content to analyze
  if (!title && !description && !transcript) return null;

  try {
    const prompt = `Analyze this viral social media video and return a JSON object with the following fields:

- "productDetected": boolean — is a specific product, service, app, or brand being promoted?
- "productName": string or null — the product/brand name if detected
- "productType": string or null — one of: "app", "saas", "physical_product", "digital_product", "service", "course", "supplement", "fashion", "food", "other", null
- "productCategory": string or null — more specific category (e.g. "fitness app", "AI writing tool", "skincare")
- "contentCategory": string — best category for this video: "Business & Finance", "Health & Wellness", "Fashion & Beauty", "Arts, Hobbies & Entertainment", "Food & Cooking", "Entertainment", "Education", "Lifestyle", "Comedy", "Music", "Sports", "Tech", "Relationships & Lifestyle", "Personal Development", "Spirituality & Beliefs"
- "hook": string — the hook/opening line strategy used (1 sentence)
- "viralFactors": string[] — 2-4 factors that likely made this go viral
- "targetAudience": string — who this video is targeting (1 sentence)
- "contentFormat": string — "talking_head", "tutorial", "storytime", "skit", "duet", "trend", "product_review", "lifestyle", "educational", "other"

Video data:
- Creator: @${handle}
- Title/Caption: ${(title || description).substring(0, 500)}
- Transcript: ${transcript.substring(0, 1500)}
- Category hint: ${category}

Return ONLY valid JSON, no markdown.`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      console.error(`❌ [AI] OpenAI error: ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(jsonStr);

    return analysis;
  } catch (err: any) {
    console.error(`❌ [AI] Analysis failed:`, err.message);
    return null;
  }
}

// ─── DELETE: Remove Viral Video ──────────────────────────

async function removeViralVideo(
  req: VercelRequest,
  res: VercelResponse,
  _auth: AuthenticatedApiRequest
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Query parameter "id" is required.', code: 'VALIDATION_ERROR' }
    });
  }

  const docRef = db.collection(VIRAL_COLLECTION).doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    return res.status(404).json({
      success: false,
      error: { message: `Viral video with id "${id}" not found.`, code: 'NOT_FOUND' }
    });
  }

  await docRef.delete();

  return res.status(200).json({
    success: true,
    data: {
      id,
      deleted: true,
    },
  });
}

// ─── Export ──────────────────────────────────────────────

export default withApiAuth(['viral:write'] as any, handler);
