import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

/**
 * FirestoreService
 * 
 * Purpose: Centralized Firestore database operations for sync services
 * Responsibilities:
 * - Fetch tracked accounts
 * - Update tracked accounts (profile, lastSynced, locks)
 * - Fetch existing videos
 * - Save videos with deterministic IDs
 * - Create snapshots with deduplication
 */
export class FirestoreService {
  private static get db() {
    return getFirestore();
  }
  
  /**
   * Get a single tracked account by ID
   */
  static async getTrackedAccount(
    orgId: string,
    projectId: string,
    accountId: string
  ) {
    const accountRef = this.db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('trackedAccounts').doc(accountId);
    
    const accountDoc = await accountRef.get();
    
    if (!accountDoc.exists) {
      return null;
    }
    
    return {
      id: accountDoc.id,
      ref: accountRef,
      data: accountDoc.data()
    };
  }
  
  /**
   * Update tracked account fields
   */
  static async updateTrackedAccount(
    accountRef: FirebaseFirestore.DocumentReference,
    updates: Record<string, any>
  ) {
    await accountRef.update(updates);
  }
  
  /**
   * Get all existing videos for an account
   * Returns map of videoId -> video data
   */
  static async getExistingVideos(
    orgId: string,
    projectId: string,
    accountId: string
  ): Promise<Map<string, any>> {
    const videosRef = this.db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('videos');
    
    const videosSnapshot = await videosRef
      .where('accountId', '==', accountId)
      .get();
    
    const videosMap = new Map<string, any>();
    
    videosSnapshot.docs.forEach(doc => {
      const data = doc.data();
      // Extract platform-specific video ID from document ID
      // Format: {platform}_{accountId}_{videoId}
      const parts = doc.id.split('_');
      if (parts.length >= 3) {
        const videoId = parts.slice(2).join('_'); // Handle video IDs that contain underscores
        videosMap.set(videoId, {
          ...data,
          firestoreId: doc.id,
          ref: doc.ref
        });
      }
    });
    
    return videosMap;
  }
  
  /**
   * Save video to Firestore with deterministic ID
   * Returns the video document reference
   */
  static async saveVideo(
    orgId: string,
    projectId: string,
    accountId: string,
    videoData: {
      videoId: string;
      platform: string;
      videoTitle: string;
      videoUrl: string;
      thumbnail: string;
      accountUsername: string;
      accountDisplayName: string;
      uploadDate: FirebaseFirestore.Timestamp;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      caption: string;
      duration: number;
    },
    addedBy: string = 'system'
  ) {
    const { platform, videoId } = videoData;
    
    // Create deterministic document ID
    const deterministicId = `${platform}_${accountId}_${videoId}`;
    
    const videoRef = this.db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('videos').doc(deterministicId);
    
    const videoDoc = await videoRef.get();
    
    if (videoDoc.exists) {
      // Video exists - update it
      await videoRef.update({
        videoTitle: videoData.videoTitle,
        thumbnail: videoData.thumbnail,
        accountDisplayName: videoData.accountDisplayName,
        views: videoData.views,
        likes: videoData.likes,
        comments: videoData.comments,
        shares: videoData.shares,
        saves: videoData.saves,
        caption: videoData.caption,
        duration: videoData.duration,
        lastRefreshedAt: Timestamp.now()
      });
      
      return { ref: videoRef, isNew: false };
    } else {
      // New video - create it
      await videoRef.set({
        accountId: accountId,
        videoId: videoData.videoId,
        platform: videoData.platform,
        videoTitle: videoData.videoTitle,
        videoUrl: videoData.videoUrl,
        thumbnail: videoData.thumbnail,
        accountUsername: videoData.accountUsername,
        accountDisplayName: videoData.accountDisplayName,
        uploadDate: videoData.uploadDate,
        views: videoData.views,
        likes: videoData.likes,
        comments: videoData.comments,
        shares: videoData.shares,
        saves: videoData.saves,
        caption: videoData.caption,
        duration: videoData.duration,
        dateAdded: Timestamp.now(),
        lastRefreshedAt: Timestamp.now(),
        addedBy: addedBy,
        syncStatus: 'active',
        status: 'active',
        isSingular: false
      });
      
      return { ref: videoRef, isNew: true };
    }
  }
  
  /**
   * Create snapshot for a video
   * No deduplication - REFRESH→DISCOVERY architecture prevents duplicates naturally
   * Returns true if snapshot was created, false if skipped
   */
  static async createSnapshot(
    videoRef: FirebaseFirestore.DocumentReference,
    metrics: {
      views: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
    },
    capturedBy: 'manual_refresh' | 'scheduled_refresh' | 'initial_add' = 'scheduled_refresh'
  ): Promise<boolean> {
    const snapshotsRef = videoRef.collection('snapshots');
    
    // ✅ REMOVED: Deduplication check (new REFRESH→DISCOVERY architecture prevents duplicates)
    // The phase separation ensures snapshots are only created once per refresh cycle
    
    // Always create snapshot
    await snapshotsRef.add({
      views: metrics.views,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      saves: metrics.saves,
      capturedAt: Timestamp.now(),
      capturedBy: capturedBy
    });
    
    return true;
  }
  
  /**
   * Get snapshot count for a video
   */
  static async getSnapshotCount(videoRef: FirebaseFirestore.DocumentReference): Promise<number> {
    const snapshotsSnapshot = await videoRef.collection('snapshots').count().get();
    return snapshotsSnapshot.data().count;
  }
}

