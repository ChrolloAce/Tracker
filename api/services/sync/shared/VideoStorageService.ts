import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { ImageUploadService } from './ImageUploadService.js';

// Helper: Timeout wrapper for thumbnail downloads
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    return fallback;
  }
}

function isFirebaseStorageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com');
}

/**
 * VideoStorageService
 *
 * Responsibilities:
 * - Save videos to Firestore with deterministic IDs
 * - Upload thumbnails to Firebase Storage (if not already uploaded)
 * - Create deduplicated snapshots for metrics history
 * - Handle batch writes (chunking)
 */
export class VideoStorageService {

  /**
   * Process thumbnails in parallel batches.
   * Skips videos that already have a Firebase thumbnail in Firestore.
   * Returns a Map of videoDocId -> firebaseThumbnailUrl.
   */
  private static async processThumbnailsBatch(
    videos: any[],
    account: any,
    orgId: string,
    projectId: string,
    db: FirebaseFirestore.Firestore,
    existingDocs: Map<string, FirebaseFirestore.DocumentData>
  ): Promise<Map<string, string>> {
    const THUMBNAIL_TIMEOUT_MS = 8000;
    const BATCH_SIZE = 5; // Parallel downloads per batch (conservative for CDN rate limits)
    const thumbnailMap = new Map<string, string>();
    const accountId = account.id;

    // Separate videos into: already-have-thumbnail vs need-download
    const needsDownload: Array<{ docId: string; video: any }> = [];

    for (const video of videos) {
      const videoDocId = `${account.platform}_${accountId}_${video.videoId}`;

      // Already a Firebase URL from platform normalization? Use it directly.
      if (isFirebaseStorageUrl(video.thumbnail)) {
        thumbnailMap.set(videoDocId, video.thumbnail);
        continue;
      }

      // Existing video with a Firebase thumbnail? Skip download entirely.
      const existing = existingDocs.get(videoDocId);
      if (existing && isFirebaseStorageUrl(existing.thumbnail)) {
        thumbnailMap.set(videoDocId, existing.thumbnail);
        continue;
      }

      // Has a CDN URL that needs downloading
      if (video.thumbnail && video.thumbnail.startsWith('http')) {
        needsDownload.push({ docId: videoDocId, video });
      } else {
        thumbnailMap.set(videoDocId, '');
      }
    }

    if (needsDownload.length === 0) {
      console.log(`    ⚡ [THUMBS] All ${videos.length} thumbnails resolved from cache — 0 downloads needed`);
      return thumbnailMap;
    }

    console.log(`    📥 [THUMBS] ${needsDownload.length} thumbnails to download (${videos.length - needsDownload.length} skipped — already in Firebase)`);

    // Process in parallel batches
    for (let i = 0; i < needsDownload.length; i += BATCH_SIZE) {
      const batch = needsDownload.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(needsDownload.length / BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(({ video }) =>
          withTimeout(
            ImageUploadService.downloadAndUpload(
              video.thumbnail,
              orgId,
              `${account.platform}_${video.videoId}_thumb.jpg`,
              'thumbnails'
            ),
            THUMBNAIL_TIMEOUT_MS,
            '' // Empty on timeout — CDN URLs expire
          )
        )
      );

      // Store results
      let successCount = 0;
      for (let j = 0; j < batch.length; j++) {
        const result = results[j];
        const url = result.status === 'fulfilled' ? result.value : '';
        thumbnailMap.set(batch[j].docId, url);
        if (url) successCount++;
      }

      console.log(`    📥 [THUMBS] Batch ${batchNum}/${totalBatches}: ${successCount}/${batch.length} succeeded`);
    }

    return thumbnailMap;
  }

  /**
   * Save a batch of videos to Firestore
   */
  static async saveVideos(
    videos: any[],
    account: any,
    orgId: string,
    projectId: string,
    db: FirebaseFirestore.Firestore,
    maxNewVideos?: number
  ): Promise<number> {
    let batch = db.batch();
    let savedCount = 0;
    let newVideoCount = 0;
    let batchOperations = 0;
    const accountId = account.id;
    const BATCH_COMMIT_THRESHOLD = 20;

    console.log(`    📦 [SAVE] Starting to save ${videos.length} videos for @${account.username}...`);

    // ==================== PRE-FETCH existing docs in parallel ====================
    // This replaces the sequential videoRef.get() inside the loop
    const existingDocs = new Map<string, FirebaseFirestore.DocumentData>();
    const docIds = videos.map(v => `${account.platform}_${accountId}_${v.videoId}`);

    // Firestore getAll supports up to 100 refs at a time
    const videoRefs = docIds.map(id =>
      db.collection('organizations').doc(orgId)
        .collection('projects').doc(projectId)
        .collection('videos').doc(id)
    );

    // Batch read in chunks of 100
    for (let i = 0; i < videoRefs.length; i += 100) {
      const chunk = videoRefs.slice(i, i + 100);
      const snapshots = await db.getAll(...chunk);
      for (const snap of snapshots) {
        if (snap.exists) {
          existingDocs.set(snap.id, snap.data()!);
        }
      }
    }

    console.log(`    📋 [SAVE] Pre-fetched ${existingDocs.size} existing videos (${videos.length - existingDocs.size} new)`);

    // ==================== PARALLEL THUMBNAIL PROCESSING ====================
    const thumbnailMap = await this.processThumbnailsBatch(
      videos, account, orgId, projectId, db, existingDocs
    );

    // ==================== FIRESTORE BATCH WRITES ====================
    for (const video of videos) {
      const videoDocId = `${account.platform}_${accountId}_${video.videoId}`;
      const videoRef = db
        .collection('organizations').doc(orgId)
        .collection('projects').doc(projectId)
        .collection('videos').doc(videoDocId);

      const firebaseThumbnailUrl = thumbnailMap.get(videoDocId) || '';
      const snapshotTime = Timestamp.now();
      const isManualTrigger = account.syncRequestedBy ? true : false;
      const isRefreshOnly = video._isRefreshOnly === true;
      const existingData = existingDocs.get(videoDocId);

      if (existingData) {
        // VIDEO EXISTS - Update metrics only
        const updateData: any = {
          views: video.views || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          saves: video.saves || 0,
          lastRefreshed: snapshotTime
        };

        if (!existingData.uploaderHandle) {
          updateData.uploaderHandle = video.accountUsername || account.username;
          updateData.uploader = video.accountDisplayName || account.username;
        }

        if (firebaseThumbnailUrl) {
          updateData.thumbnail = firebaseThumbnailUrl;
        }

        if (!isRefreshOnly) {
          if (video.videoTitle) updateData.videoTitle = video.videoTitle;
          if (video.uploadDate) updateData.uploadDate = video.uploadDate;
          if (video.media) updateData.media = video.media;
        }

        batch.update(videoRef, updateData);

        const snapshotRef = videoRef.collection('snapshots').doc();
        batch.set(snapshotRef, {
          id: snapshotRef.id,
          videoId: video.videoId,
          views: video.views || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          saves: video.saves || 0,
          capturedAt: snapshotTime,
          timestamp: snapshotTime,
          capturedBy: isManualTrigger ? 'manual_refresh' : 'scheduled_refresh',
          isInitialSnapshot: false
        });
        console.log(`    🔄 Updated video ${video.videoId} + created refresh snapshot`);
      } else {
        // Video doesn't exist
        if (isRefreshOnly) {
          console.log(`    ⏭️  Skipping refresh-only video ${video.videoId} - doesn't exist in DB (likely deleted)`);
          continue;
        }

        if (typeof maxNewVideos === 'number' && newVideoCount >= maxNewVideos) {
          console.log(`    ⏭️  Skipping new video ${video.videoId} — plan video limit reached (${newVideoCount}/${maxNewVideos})`);
          continue;
        }

        const { _isRefreshOnly, ...cleanVideoData } = video;

        batch.set(videoRef, {
          ...cleanVideoData,
          uploaderHandle: video.accountUsername || account.username,
          uploader: video.accountDisplayName || account.username,
          thumbnail: firebaseThumbnailUrl,
          orgId: orgId,
          projectId: projectId,
          trackedAccountId: accountId,
          platform: account.platform,
          dateAdded: snapshotTime,
          addedBy: account.syncRequestedBy || account.addedBy || 'system',
          lastRefreshed: snapshotTime,
          status: 'active',
          isRead: false,
          isSingular: false
        });

        const snapshotRef = videoRef.collection('snapshots').doc();
        batch.set(snapshotRef, {
          id: snapshotRef.id,
          videoId: video.videoId,
          views: video.views || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          saves: video.saves || 0,
          capturedAt: snapshotTime,
          timestamp: snapshotTime,
          capturedBy: 'initial_sync',
          isInitialSnapshot: true
        });

        console.log(`    ✅ Created new video ${video.videoId} + initial snapshot`);
        newVideoCount++;
      }

      savedCount++;
      batchOperations += 2;

      if (batchOperations >= BATCH_COMMIT_THRESHOLD * 2) {
        try {
          await batch.commit();
          console.log(`    💾 Committed batch (${savedCount} videos saved so far)`);
          batch = db.batch();
          batchOperations = 0;
        } catch (commitError) {
          console.error(`    ❌ Batch commit failed:`, (commitError as Error).message);
          batch = db.batch();
          batchOperations = 0;
        }
      }
    }

    // Commit remaining
    if (batchOperations > 0) {
      try {
        console.log(`    💾 Committing final batch (${batchOperations / 2} videos)...`);
        await batch.commit();
        console.log(`    ✅ Final batch committed - Total: ${savedCount} videos saved`);
      } catch (commitError) {
        console.error(`    ❌ Final batch commit failed:`, (commitError as Error).message);
      }
    } else {
      console.log(`    ✅ All videos saved - Total: ${savedCount}`);
    }

    return savedCount;
  }
}
