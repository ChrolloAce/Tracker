import { Timestamp } from 'firebase-admin/firestore';

/**
 * ValidationService
 * 
 * Purpose: Validate data structures and business logic
 * Responsibilities:
 * - Validate account data
 * - Validate video data
 * - Date range filtering for discovery
 * - Input validation for sync operations
 */
export class ValidationService {
  /**
   * Validate tracked account has required fields
   */
  static validateAccountData(account: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!account.id) errors.push('Account ID is required');
    if (!account.username) errors.push('Username is required');
    if (!account.platform) errors.push('Platform is required');
    
    const validPlatforms = ['instagram', 'tiktok', 'youtube', 'twitter'];
    if (account.platform && !validPlatforms.includes(account.platform)) {
      errors.push(`Invalid platform: ${account.platform}. Must be one of: ${validPlatforms.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate video data has required fields
   */
  static validateVideoData(video: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!video.videoId) errors.push('Video ID is required');
    if (!video.platform) errors.push('Platform is required');
    if (!video.videoTitle) errors.push('Video title is required');
    if (!video.videoUrl) errors.push('Video URL is required');
    if (!video.accountUsername) errors.push('Account username is required');
    
    // Validate metrics are numbers
    if (typeof video.views !== 'number') errors.push('Views must be a number');
    if (typeof video.likes !== 'number') errors.push('Likes must be a number');
    if (typeof video.comments !== 'number') errors.push('Comments must be a number');
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Check if a video should be skipped based on date filtering
   * Used during discovery to prevent backfilling old content
   * 
   * @param uploadDate - Video upload date
   * @param oldestExistingDate - Oldest video date we already have
   * @returns true if video should be skipped, false if it should be added
   */
  static shouldSkipVideoByDate(
    uploadDate: Date | Timestamp | null | undefined,
    oldestExistingDate: Date | Timestamp | null | undefined
  ): boolean {
    // If we have no existing videos, don't skip anything
    if (!oldestExistingDate) {
      return false;
    }
    
    // If video has no upload date, skip it (invalid)
    if (!uploadDate) {
      console.log(`   ⚠️  Video missing upload date - skipping`);
      return true;
    }
    
    // Convert to Date objects for comparison
    const videoDate = uploadDate instanceof Timestamp ? uploadDate.toDate() : uploadDate;
    const oldestDate = oldestExistingDate instanceof Timestamp ? oldestExistingDate.toDate() : oldestExistingDate;
    
    // Normalize to start of day for comparison (ignore time)
    const videoDay = new Date(videoDate.getFullYear(), videoDate.getMonth(), videoDate.getDate());
    const oldestDay = new Date(oldestDate.getFullYear(), oldestDate.getMonth(), oldestDate.getDate());
    
    // Skip if video is older than our oldest existing video
    if (videoDay < oldestDay) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Find the oldest upload date from a list of videos
   */
  static findOldestUploadDate(
    videos: Array<{ uploadDate?: Date | Timestamp | null }>
  ): Date | null {
    if (!videos || videos.length === 0) {
      return null;
    }
    
    let oldest: Date | null = null;
    
    for (const video of videos) {
      if (!video.uploadDate) continue;
      
      const date = video.uploadDate instanceof Timestamp 
        ? video.uploadDate.toDate() 
        : video.uploadDate;
      
      if (!oldest || date < oldest) {
        oldest = date;
      }
    }
    
    return oldest;
  }
  
  /**
   * Validate sync options
   */
  static validateSyncOptions(options: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (options.syncStrategy) {
      const validStrategies = ['progressive', 'refresh_only', 'discovery_only'];
      if (!validStrategies.includes(options.syncStrategy)) {
        errors.push(`Invalid sync strategy: ${options.syncStrategy}`);
      }
    }
    
    if (options.maxVideos && typeof options.maxVideos !== 'number') {
      errors.push('maxVideos must be a number');
    }
    
    if (options.maxVideos && options.maxVideos < 1) {
      errors.push('maxVideos must be at least 1');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

