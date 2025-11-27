import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { ImageUploadService } from './ImageUploadService.js';

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
    const accountId = account.id;

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
            console.log(`    📸 [${account.platform.toUpperCase()}] Downloading thumbnail for video ${video.videoId}...`);
            firebaseThumbnailUrl = await ImageUploadService.downloadAndUpload(
              video.thumbnail,
              orgId,
              `${account.platform}_${video.videoId}_thumb.jpg`,
              'thumbnails'
            );
            console.log(`    ✅ [${account.platform.toUpperCase()}] Thumbnail uploaded: ${firebaseThumbnailUrl}`);
          } catch (thumbError) {
            console.error(`    ❌ [${account.platform.toUpperCase()}] Thumbnail upload failed for ${video.videoId}:`, thumbError);
            console.warn(`    ⚠️ [${account.platform.toUpperCase()}] Using original URL as fallback`);
            firebaseThumbnailUrl = video.thumbnail; // Fallback to original URL
          }
        } else {
          // Already a Firebase URL (e.g. from platform service)
          firebaseThumbnailUrl = video.thumbnail;
        }
      } else {
        console.warn(`    ⚠️ [${account.platform.toUpperCase()}] No valid thumbnail URL for video ${video.videoId}`);
        firebaseThumbnailUrl = video.thumbnail || ''; // Use whatever we have
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

      // Commit in batches of 500 (Firestore limit)
      if (savedCount % 500 === 0) {
        await batch.commit();
        console.log(`    💾 Committed batch of 500 videos`);
        batch = db.batch();
      }
    }

    // Commit remaining
    if (savedCount % 500 !== 0) {
      console.log(`    💾 Committing final batch of ${savedCount % 500} videos...`);
      await batch.commit();
      console.log(`    ✅ Final batch committed`);
    }

    return savedCount;
  }
}

