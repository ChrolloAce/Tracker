/**
 * Sync mode helpers for the Videos API
 * Handles polling, dispatching, platform detection, and response formatting.
 */

import { Timestamp } from 'firebase-admin/firestore';

const BASE_URL = 'https://www.viewtrack.app';

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
 * Format a Firestore video document into a clean API response object.
 */
export function formatVideoResponse(
  id: string,
  data: FirebaseFirestore.DocumentData,
  projectId: string
) {
  return {
    id,
    projectId,
    url: data.url,
    platform: data.platform,
    thumbnail: data.thumbnail || null,
    title: data.title || null,
    caption: data.caption || data.description || null,
    uploaderHandle: data.uploaderHandle || null,
    views: data.views || 0,
    likes: data.likes || 0,
    comments: data.comments || 0,
    shares: data.shares || 0,
    saves: data.saves || 0,
    status: data.status,
    syncStatus: data.syncStatus || null,
    uploadDate: data.uploadDate?.toDate?.()?.toISOString() || null,
    lastRefreshed: data.lastRefreshed?.toDate?.()?.toISOString() || null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
  };
}

// ─── Utilities ───────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
