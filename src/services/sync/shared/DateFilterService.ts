/**
 * DateFilterService
 * 
 * Purpose: Handle date-based filtering logic for video discovery
 * Responsibilities:
 * - Determine if a video should be skipped based on upload date
 * - Compare video dates against oldest existing video
 * - Support same-day inclusion logic
 */
export class DateFilterService {
  
  /**
   * Check if a video should be skipped during discovery based on its upload date
   * 
   * Rules:
   * - If no oldestVideoDate exists, include all videos (new account)
   * - Skip videos older than oldestVideoDate
   * - Include videos on the same date as oldestVideoDate
   * 
   * @param videoUploadDate - The upload date of the video being checked
   * @param oldestVideoDate - The upload date of the oldest existing video (null if no videos exist)
   * @returns true if video should be skipped, false if it should be included
   */
  static shouldSkipVideo(videoUploadDate: Date | null, oldestVideoDate: Date | null): boolean {
    // If no oldest video date, this is a new account - include everything
    if (!oldestVideoDate) {
      return false;
    }
    
    // If video has no upload date, include it (better to have than miss)
    if (!videoUploadDate) {
      console.warn('⚠️ Video has no upload date - including by default');
      return false;
    }
    
    // Normalize dates to start of day for comparison
    const videoDate = this.normalizeToStartOfDay(videoUploadDate);
    const oldestDate = this.normalizeToStartOfDay(oldestVideoDate);
    
    // Skip if video is older than our oldest existing video
    // BUT include if it's on the same date
    if (videoDate < oldestDate) {
      console.log(`⏭️  Skipping video from ${videoDate.toLocaleDateString()} (older than oldest: ${oldestDate.toLocaleDateString()})`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Normalize a date to the start of the day (midnight) for accurate date-only comparison
   */
  private static normalizeToStartOfDay(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }
  
  /**
   * Find the oldest upload date from a list of videos
   */
  static findOldestUploadDate(videos: Array<{ uploadDate?: Date | null }>): Date | null {
    if (!videos || videos.length === 0) {
      return null;
    }
    
    const validDates = videos
      .map(v => v.uploadDate)
      .filter((date): date is Date => date != null);
    
    if (validDates.length === 0) {
      return null;
    }
    
    return new Date(Math.min(...validDates.map(d => d.getTime())));
  }
  
  /**
   * Log date filtering statistics for debugging
   */
  static logFilterStats(
    totalVideos: number,
    skippedCount: number,
    oldestVideoDate: Date | null,
    platform: string
  ): void {
    if (skippedCount > 0) {
      console.log(
        `📅 [${platform.toUpperCase()}] Date filter: ${skippedCount}/${totalVideos} videos skipped (older than ${oldestVideoDate?.toLocaleDateString() || 'N/A'})`
      );
    }
  }
}

