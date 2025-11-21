import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * DeduplicationService
 * 
 * Purpose: Prevent duplicate videos and snapshots
 * Responsibilities:
 * - Check for duplicate snapshots within time window
 * - Check for duplicate videos
 * - Generate deterministic video IDs
 */
export class DeduplicationService {
  private static db = getFirestore();
  
  /**
   * Create deterministic video ID
   * Format: {platform}_{accountId}_{videoId}
   */
  static createDeterministicVideoId(
    platform: string,
    accountId: string,
    videoId: string
  ): string {
    return `${platform}_${accountId}_${videoId}`;
  }
  
  /**
   * Check if a snapshot already exists within the time window
   * Returns true if duplicate exists, false if safe to create
   */
  static async checkDuplicateSnapshot(
    videoRef: FirebaseFirestore.DocumentReference,
    timeWindowMinutes: number = 5,
    capturedBy: 'manual_refresh' | 'scheduled_refresh' | 'initial_add' = 'scheduled_refresh'
  ): Promise<boolean> {
    const snapshotsRef = videoRef.collection('snapshots');
    
    const cutoffTime = Timestamp.fromMillis(Date.now() - timeWindowMinutes * 60 * 1000);
    
    const recentSnapshotsQuery = await snapshotsRef
      .where('capturedAt', '>=', cutoffTime)
      .where('capturedBy', '==', capturedBy)
      .limit(1)
      .get();
    
    return !recentSnapshotsQuery.empty;
  }
  
  /**
   * Check if a video already exists in Firestore
   * Returns the video document reference if it exists, null otherwise
   */
  static async checkDuplicateVideo(
    orgId: string,
    projectId: string,
    platform: string,
    accountId: string,
    videoId: string
  ): Promise<FirebaseFirestore.DocumentReference | null> {
    const deterministicId = this.createDeterministicVideoId(platform, accountId, videoId);
    
    const videoRef = this.db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('videos').doc(deterministicId);
    
    const videoDoc = await videoRef.get();
    
    return videoDoc.exists ? videoRef : null;
  }
  
  /**
   * Extract video ID from deterministic document ID
   * Format: {platform}_{accountId}_{videoId}
   * Returns the videoId portion
   */
  static extractVideoIdFromDocId(docId: string): string | null {
    const parts = docId.split('_');
    if (parts.length < 3) {
      return null;
    }
    // Handle video IDs that contain underscores
    return parts.slice(2).join('_');
  }
  
  /**
   * Parse platform and accountId from deterministic document ID
   */
  static parseDocumentId(docId: string): {
    platform: string;
    accountId: string;
    videoId: string;
  } | null {
    const parts = docId.split('_');
    if (parts.length < 3) {
      return null;
    }
    
    return {
      platform: parts[0],
      accountId: parts[1],
      videoId: parts.slice(2).join('_')
    };
  }
}

