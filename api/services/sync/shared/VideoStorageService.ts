import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { ImageUploadService } from './ImageUploadService.js';

// Helper: Timeout wrapper for thumbnail downloads (5 second max)
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
   * Save a batch of videos to Firestore
   * 
   * @param videos - Array of normalized video objects
   * @param account - The tracked account object
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param db - Firestore database instance
   * @returns Number of videos successfully processed
   */
  static async saveVideos(
    videos: any[],
    account: any,
    orgId: string,
    projectId: string,
    db: FirebaseFirestore.Firestore
  ): Promise<number> {
    let batch = db.batch();
    let savedCount = 0;
    let batchOperations = 0; // Track operations in current batch
    const accountId = account.id;
    const BATCH_COMMIT_THRESHOLD = 20; // Commit every 20 videos (more frequent = safer)
    const THUMBNAIL_TIMEOUT_MS = 8000; // 8 second timeout for thumbnail downloads

    console.log(`    📦 [SAVE] Starting to save ${videos.length} videos for @${account.username}...`);

    for (const video of videos) {
      // Download and upload thumbnail to Firebase Storage (REQUIRED - no fallback to direct URLs)
      let firebaseThumbnailUrl = '';
      
      // Check if it's already a Firebase Storage URL to avoid re-uploading
      const isFirebaseUrl = video.thumbnail && (
        video.thumbnail.includes('firebasestorage.googleapis.com') || 
        video.thumbnail.includes('storage.googleapis.com')
      );

      if (video.thumbnail && video.thumbnail.startsWith('http')) {
        if (!isFirebaseUrl) {
          try {
            // Use timeout wrapper to prevent hanging on slow downloads
            // IMPORTANT: On timeout/failure, use empty string - NEVER use CDN URLs (they expire!)
            firebaseThumbnailUrl = await withTimeout(
              ImageUploadService.downloadAndUpload(
                video.thumbnail,
                orgId,
                `${account.platform}_${video.videoId}_thumb.jpg`,
                'thumbnails'
              ),
              THUMBNAIL_TIMEOUT_MS,
              '' // EMPTY on timeout - CDN URLs expire, don't save them!
            );
            
            if (!firebaseThumbnailUrl) {
              console.log(`    ⚠️ [${account.platform.toUpperCase()}] Thumbnail timeout for ${video.videoId}, leaving empty (CDN URLs expire)`);
            }
          } catch (thumbError) {
            console.error(`    ❌ [${account.platform.toUpperCase()}] Thumbnail failed for ${video.videoId}:`, (thumbError as Error).message);
            firebaseThumbnailUrl = ''; // EMPTY on error - CDN URLs expire, don't save them!
          }
        } else {
          // Already a Firebase URL (e.g. from platform service)
          firebaseThumbnailUrl = video.thumbnail;
        }
      } else {
        // No valid URL provided
        firebaseThumbnailUrl = '';
      }

      // ==================== DETERMINISTIC IDs + NO DUPLICATES ====================
      // Use deterministic doc ID: {platform}_{accountId}_{videoId}
      // This prevents race conditions - if 2 jobs try to create same video, only one succeeds
      const videoDocId = `${account.platform}_${accountId}_${video.videoId}`;
      const videoRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('videos')
        .doc(videoDocId); // DETERMINISTIC ID

      const snapshotTime = Timestamp.now();
      const isManualTrigger = account.syncRequestedBy ? true : false;

      // Check if video already exists (fast doc.get instead of query)
      const existingVideo = await videoRef.get();
      const isRefreshOnly = video._isRefreshOnly === true;
        
      if (existingVideo.exists) {
        // VIDEO EXISTS - Update metrics only (and thumbnail if we have a new one)
        const updateData: any = {
          views: video.views || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          saves: video.saves || 0,
          lastRefreshed: snapshotTime
        };
        
        // Update thumbnail only if we have a new valid one
        if (firebaseThumbnailUrl) {
          updateData.thumbnail = firebaseThumbnailUrl;
        }
        
        // For non-refresh videos, also update title/date if provided
        // (Refresh-only videos should NEVER overwrite title/date)
        if (!isRefreshOnly) {
          if (video.videoTitle) {
            updateData.videoTitle = video.videoTitle;
          }
          if (video.uploadDate) {
            updateData.uploadDate = video.uploadDate;
          }
          if (video.media) { // For Twitter slideshows
            updateData.media = video.media;
          }
        }
        
        batch.update(videoRef, updateData);

        // ==================== CREATE REFRESH SNAPSHOT ====================
        // New architecture (REFRESH → DISCOVERY) prevents duplicate snapshots naturally
        // No deduplication check needed!
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
          // CRITICAL: Refresh-only videos should NEVER create new entries
          // If video doesn't exist, it was probably deleted - skip it
          console.log(`    ⏭️  Skipping refresh-only video ${video.videoId} - doesn't exist in DB (likely deleted)`);
          continue; // Skip to next video
        }
        
        // NEW VIDEO - Create with initial snapshot (only for discovery, not refresh)
        // Remove internal flags before saving
        const { _isRefreshOnly, ...cleanVideoData } = video;
        
        batch.set(videoRef, {
          ...cleanVideoData,
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

        // Create initial snapshot (no deduplication needed for new videos)
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
      }

      savedCount++;
      batchOperations += 2; // Each video = 1 update/set + 1 snapshot

      // Commit more frequently to avoid losing work on timeout
      // Firestore batch limit is 500, but we commit every 20 videos (40 operations) for safety
      if (batchOperations >= BATCH_COMMIT_THRESHOLD * 2) {
        try {
          await batch.commit();
          console.log(`    💾 Committed batch (${savedCount} videos saved so far)`);
          batch = db.batch();
          batchOperations = 0;
        } catch (commitError) {
          console.error(`    ❌ Batch commit failed:`, (commitError as Error).message);
          // Continue with new batch - don't lose remaining videos
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

