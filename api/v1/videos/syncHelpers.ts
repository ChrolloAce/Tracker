/**
 * Sync mode helpers for the Videos API
 * Handles polling, dispatching, platform detection, and response formatting.
 */

import { Timestamp } from 'firebase-admin/firestore';
import { getBaseUrl } from '../../utils/base-url.js';

const BASE_URL = getBaseUrl();

// ─── Platform Detection ──────────────────────────────────

export function detectPlatform(url: string): string | null {
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  return null;
}

// ─── Dispatch Processing ─────────────────────────────────

/**
 * Dispatch the video for immediate Apify processing.
 * Returns true if dispatch was successful.
 */
export async function dispatchProcessing(
  url: string,
  orgId: string,
  projectId: string,
  jobRef: FirebaseFirestore.DocumentReference
): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  try {
    const dispatchResponse = await fetch(`${BASE_URL}/api/process-single-video`, {
      method: 'POST',
      headers: {
        'Authorization': cronSecret || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        videoId: url,
        orgId,
        projectId,
        jobId: jobRef.id,
        addedBy: 'api'
      })
    });

    if (dispatchResponse.ok) {
      await jobRef.update({ status: 'running', startedAt: Timestamp.now() });
      console.log(`⚡ [API] Immediate dispatch successful for ${url}`);
      return true;
    }
    console.warn(`⚠️ [API] Dispatch returned ${dispatchResponse.status}, falling back to queue`);
    return false;
  } catch (dispatchError: any) {
    console.warn(`⚠️ [API] Immediate dispatch failed: ${dispatchError.message}, job stays queued`);
    // Fire-and-forget queue-worker fallback
    fetch(`${BASE_URL}/api/queue-worker`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cronSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'api_video_added' })
    }).catch(() => {});
    return false;
  }
}

// ─── Polling ─────────────────────────────────────────────

export interface PollResult {
  ready: boolean;
  errored: boolean;
  data?: FirebaseFirestore.DocumentData;
  errorMessage?: string;
  elapsed: number;
}

/**
 * Poll Firestore at a fixed interval until:
 * - status becomes 'active' or syncStatus becomes 'synced' → ready
 * - status becomes 'error' or syncStatus becomes 'error'   → errored
 * - title & views are populated                            → ready (fallback)
 * - maxWaitMs is exceeded                                  → timed out
 */
export async function pollVideoUntilReady(
  docRef: FirebaseFirestore.DocumentReference,
  maxWaitMs: number,
  pollIntervalMs: number
): Promise<PollResult> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await sleep(pollIntervalMs);

    const snap = await docRef.get();
    if (!snap.exists) {
      return { ready: false, errored: true, errorMessage: 'Video document was deleted', elapsed: Date.now() - startTime };
    }

    const data = snap.data()!;
    const status = data.status as string;
    const syncStatus = data.syncStatus as string;

    // Fully processed
    if (status === 'active' || syncStatus === 'synced') {
      return { ready: true, errored: false, data, elapsed: Date.now() - startTime };
    }

    // Errored out
    if (status === 'error' || syncStatus === 'error') {
      return {
        ready: false, errored: true, data,
        errorMessage: data.syncError || data.error || 'Processing error',
        elapsed: Date.now() - startTime
      };
    }

    // Fallback: title populated + views > 0 means data arrived
    if (data.title && data.title !== 'Processing...' && data.views > 0) {
      return { ready: true, errored: false, data, elapsed: Date.now() - startTime };
    }

    console.log(`⏳ [API] Still processing… (${Math.round((Date.now() - startTime) / 1000)}s, status=${status}, syncStatus=${syncStatus})`);
  }

  return { ready: false, errored: false, elapsed: Date.now() - startTime };
}

// ─── Response Formatting ─────────────────────────────────

/**
 * Extract the raw platform video ID from a Firestore doc ID or videoId field.
 * Doc IDs follow the pattern: {platform}_{accountId}_{rawVideoId}
 * The videoId field itself may already be the raw ID.
 */
function extractRawVideoId(docId: string, videoIdField?: string, platform?: string, username?: string): string {
  // If videoIdField is set and doesn't contain the platform prefix pattern, use it directly
  if (videoIdField && !videoIdField.startsWith('temp-')) {
    return videoIdField;
  }
  // Try to strip the prefix from the doc ID: platform_username_rawId
  if (platform && username) {
    const prefix = `${platform}_${username}_`;
    if (docId.startsWith(prefix)) {
      return docId.slice(prefix.length);
    }
  }
  // Fallback: try to get everything after the second underscore
  const parts = docId.split('_');
  if (parts.length >= 3) {
    return parts.slice(2).join('_');
  }
  return docId;
}

/**
 * Construct the video URL for a given platform, username, and raw video ID.
 */
function constructVideoUrl(platform: string, username: string, rawVideoId: string): string {
  switch (platform) {
    case 'tiktok':
      return `https://tiktok.com/@${username}/video/${rawVideoId}`;
    case 'instagram':
      return `https://instagram.com/reel/${rawVideoId}`;
    case 'youtube':
      return `https://youtube.com/shorts/${rawVideoId}`;
    case 'twitter':
      return `https://x.com/${username}/status/${rawVideoId}`;
    default:
      return '';
  }
}

/**
 * Construct the account profile URL for a given platform and username.
 */
function constructAccountUrl(platform: string, username: string): string | null {
  if (!username) return null;
  switch (platform) {
    case 'tiktok':
      return `https://tiktok.com/@${username}`;
    case 'instagram':
      return `https://instagram.com/${username}`;
    case 'youtube':
      return `https://youtube.com/@${username}`;
    case 'twitter':
      return `https://x.com/${username}`;
    default:
      return null;
  }
}

/**
 * Format a Firestore video document into a clean API response object
 * with ALL available fields.
 */
export function formatVideoResponse(
  id: string,
  data: FirebaseFirestore.DocumentData,
  projectId: string
) {
  const platform = data.platform || '';
  const username = data.uploaderHandle || data.accountUsername || '';
  const rawVideoId = extractRawVideoId(id, data.videoId, platform, username);
  const url = data.url || data.videoUrl || constructVideoUrl(platform, username, rawVideoId);

  return {
    id,
    projectId,
    videoId: rawVideoId,
    url,
    platform,
    title: data.videoTitle || data.title || null,
    caption: data.caption || data.description || null,
    thumbnail: data.thumbnail || null,
    views: data.views || 0,
    likes: data.likes || 0,
    comments: data.comments || 0,
    shares: data.shares || 0,
    saves: data.saves || 0,
    uploadDate: data.uploadDate?.toDate?.()?.toISOString() || null,
    duration: data.duration || null,
    accountUsername: username || null,
    accountDisplayName: data.uploader || data.accountDisplayName || username || null,
    downloadUrl: data.mediaUrl || data.downloadUrl || null,
    mediaUrl: data.mediaUrl || data.downloadUrl || null,
    accountUrl: constructAccountUrl(platform, username),
    status: data.status || null,
    dateSubmitted: data.dateSubmitted?.toDate?.()?.toISOString() || data.dateAdded?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString() || null,
    lastRefreshed: data.lastRefreshed?.toDate?.()?.toISOString() || null,
    snapshots: data.snapshots || [],
  };
}

// ─── Utilities ───────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
