import { VideoSubmission } from '../types';
import StorageManager from './StorageManager';

class LocalStorageService {
  private readonly SUBMISSIONS_KEY = 'instagram_submissions';
  private readonly THUMBNAILS_KEY_PREFIX = 'thumbnail_';
  private readonly PROFILE_PICS_KEY_PREFIX = 'profile_pic_';
  private readonly ACCOUNT_VIDEOS_KEY_PREFIX = 'account_videos_';

  // Save all submissions to localStorage
  saveSubmissions(submissions: VideoSubmission[]): void {
    try {
      console.log('💾 Saving submissions to localStorage:', submissions.length, 'items');
      const serializedData = JSON.stringify(submissions, (_key, value) => {
        // Convert Date objects to ISO strings for serialization
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      });
      
      localStorage.setItem(this.SUBMISSIONS_KEY, serializedData);
      console.log('✅ Submissions saved successfully');
    } catch (error) {
      console.error('❌ Failed to save submissions:', error);
    }
  }

  // Load all submissions from localStorage
  loadSubmissions(): VideoSubmission[] {
    try {
      console.log('📱 Loading submissions from localStorage...');
      const data = localStorage.getItem(this.SUBMISSIONS_KEY);
      
      if (!data) {
        console.log('📭 No saved submissions found');
        return [];
      }

      const submissions = JSON.parse(data, (key, value) => {
        // Convert ISO strings back to Date objects
        if ((key === 'dateSubmitted' || key === 'uploadDate') && typeof value === 'string') {
          return new Date(value);
        }
        return value;
      }) as VideoSubmission[];

      // Migrate existing data that doesn't have uploadDate
      const migratedSubmissions = submissions.map(submission => {
        if (!submission.uploadDate) {
          // Use timestamp if available, otherwise fall back to dateSubmitted
          const fallbackDate = submission.timestamp 
            ? new Date(submission.timestamp) 
            : submission.dateSubmitted;
          return {
            ...submission,
            uploadDate: fallbackDate
          };
        }
        return submission;
      });

      console.log('✅ Loaded submissions from localStorage:', migratedSubmissions.length, 'items');
      return migratedSubmissions;
    } catch (error) {
      console.error('❌ Failed to load submissions:', error);
      return [];
    }
  }

  // Save a single submission (add to existing data)
  addSubmission(submission: VideoSubmission): void {
    const existingSubmissions = this.loadSubmissions();
    
    // Check if submission already exists (by ID)
    const existingIndex = existingSubmissions.findIndex(s => s.id === submission.id);
    
    if (existingIndex >= 0) {
      // Update existing submission
      existingSubmissions[existingIndex] = submission;
      console.log('🔄 Updated existing submission:', submission.id);
    } else {
      // Add new submission to the beginning of the array
      existingSubmissions.unshift(submission);
      console.log('➕ Added new submission:', submission.id);
    }
    
    this.saveSubmissions(existingSubmissions);
  }

  // Remove a submission by ID
  removeSubmission(submissionId: string): void {
    const existingSubmissions = this.loadSubmissions();
    const filteredSubmissions = existingSubmissions.filter(s => s.id !== submissionId);
    
    if (filteredSubmissions.length < existingSubmissions.length) {
      this.saveSubmissions(filteredSubmissions);
      console.log('🗑️ Removed submission:', submissionId);
      
      // Also remove associated thumbnail
      this.removeThumbnail(submissionId);
    }
  }

  // Update submission status
  updateSubmissionStatus(submissionId: string, status: VideoSubmission['status']): void {
    const existingSubmissions = this.loadSubmissions();
    const submissionIndex = existingSubmissions.findIndex(s => s.id === submissionId);
    
    if (submissionIndex >= 0) {
      existingSubmissions[submissionIndex].status = status;
      this.saveSubmissions(existingSubmissions);
      console.log('📝 Updated submission status:', submissionId, '→', status);
    }
  }

  // Save thumbnail data
  saveThumbnail(videoId: string, thumbnailData: string): void {
    try {
      const key = `${this.THUMBNAILS_KEY_PREFIX}${videoId}`;
      localStorage.setItem(key, thumbnailData);
      console.log('🖼️ Thumbnail saved for video:', videoId);
    } catch (error) {
      console.warn('⚠️ Could not save thumbnail (probably too large):', error);
    }
  }

  // Load thumbnail data
  loadThumbnail(videoId: string): string | null {
    try {
      const key = `${this.THUMBNAILS_KEY_PREFIX}${videoId}`;
      const thumbnail = localStorage.getItem(key);
      if (thumbnail) {
        console.log('📱 Loaded thumbnail from localStorage for:', videoId);
        return thumbnail;
      }
    } catch (error) {
      console.warn('⚠️ Could not load thumbnail from localStorage:', error);
    }
    return null;
  }

  // Remove thumbnail data
  removeThumbnail(videoId: string): void {
    try {
      const key = `${this.THUMBNAILS_KEY_PREFIX}${videoId}`;
      localStorage.removeItem(key);
      console.log('🗑️ Removed thumbnail for video:', videoId);
    } catch (error) {
      console.warn('⚠️ Could not remove thumbnail:', error);
    }
  }

  // Save profile picture data
  saveProfilePicture(accountId: string, profilePicData: string): void {
    try {
      const key = `${this.PROFILE_PICS_KEY_PREFIX}${accountId}`;
      localStorage.setItem(key, profilePicData);
      console.log('👤 Profile picture saved for account:', accountId);
    } catch (error) {
      console.warn('⚠️ Could not save profile picture (probably too large):', error);
    }
  }

  // Load profile picture data
  loadProfilePicture(accountId: string): string | null {
    try {
      const key = `${this.PROFILE_PICS_KEY_PREFIX}${accountId}`;
      const profilePic = localStorage.getItem(key);
      if (profilePic) {
        console.log('📱 Loaded profile picture from localStorage for:', accountId);
        return profilePic;
      }
    } catch (error) {
      console.warn('⚠️ Could not load profile picture from localStorage:', error);
    }
    return null;
  }

  // Remove profile picture data
  removeProfilePicture(accountId: string): void {
    try {
      const key = `${this.PROFILE_PICS_KEY_PREFIX}${accountId}`;
      localStorage.removeItem(key);
      console.log('🗑️ Removed profile picture for account:', accountId);
    } catch (error) {
      console.warn('⚠️ Could not remove profile picture:', error);
    }
  }

  // Save account videos data
  saveAccountVideos(accountId: string, videos: any[]): void {
    try {
      const key = `${this.ACCOUNT_VIDEOS_KEY_PREFIX}${accountId}`;
      
      // Limit to most recent 50 videos to save space
      const limitedVideos = StorageManager.limitAccountVideos(videos, 50);
      
      // Add metadata for tracking last access
      const dataWithMetadata = StorageManager.wrapWithMetadata(limitedVideos);
      
      const serializedData = JSON.stringify(dataWithMetadata, (_key, value) => {
        // Convert Date objects to ISO strings for serialization
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      });
      
      // Use safe storage method with quota management
      const success = StorageManager.safeSetItem(key, serializedData, { isAccountVideos: true });
      
      if (success) {
        console.log('💾 Account videos saved for:', accountId, '(', limitedVideos.length, 'videos)');
      } else {
        console.error('❌ Failed to save account videos - storage quota exceeded');
        // Show user-friendly message
        this.showStorageWarning();
      }
    } catch (error) {
      console.error('❌ Failed to save account videos:', error);
    }
  }
  
  // Show storage warning to user
  private showStorageWarning(): void {
    // You can emit an event or show a notification here
    const { usedMB, percentUsed } = StorageManager.getStorageUsage();
    console.warn(`
⚠️ STORAGE WARNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your browser storage is ${percentUsed.toFixed(1)}% full (${usedMB.toFixed(2)} MB used).
We're keeping the most recent 50 videos per account to save space.
Consider clearing old data or downloading important analytics.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  }

  // Load account videos data
  loadAccountVideos(accountId: string): any[] {
    try {
      const key = `${this.ACCOUNT_VIDEOS_KEY_PREFIX}${accountId}`;
      const data = localStorage.getItem(key);
      
      if (!data) {
        console.log('📭 No saved videos found for account:', accountId);
        return [];
      }

      const parsed = JSON.parse(data, (key, value) => {
        // Convert ISO strings back to Date objects
        if (key === 'uploadDate' && typeof value === 'string') {
          return new Date(value);
        }
        return value;
      });
      
      // Extract videos from metadata wrapper
      const videos = Array.isArray(parsed) ? parsed : (parsed._metadata ? parsed.slice(0, -1) : []);
      
      // Update last accessed time
      if (parsed._metadata) {
        parsed._metadata.lastAccessed = Date.now();
        localStorage.setItem(key, JSON.stringify(parsed));
      }

      console.log('✅ Loaded account videos from localStorage:', accountId, '(', videos.length, 'videos)');
      return videos;
    } catch (error) {
      console.error('❌ Failed to load account videos:', error);
      return [];
    }
  }

  // Remove account videos data
  removeAccountVideos(accountId: string): void {
    try {
      const key = `${this.ACCOUNT_VIDEOS_KEY_PREFIX}${accountId}`;
      localStorage.removeItem(key);
      console.log('🗑️ Removed videos for account:', accountId);
    } catch (error) {
      console.warn('⚠️ Could not remove account videos:', error);
    }
  }

  // Clear all saved data
  clearAllData(): void {
    try {
      // Remove submissions
      localStorage.removeItem(this.SUBMISSIONS_KEY);
      
      // Remove all thumbnails, profile pictures, and account videos
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.THUMBNAILS_KEY_PREFIX) || 
            key.startsWith(this.PROFILE_PICS_KEY_PREFIX) ||
            key.startsWith(this.ACCOUNT_VIDEOS_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('🧹 All local data cleared');
    } catch (error) {
      console.error('❌ Failed to clear data:', error);
    }
  }

  // Get storage usage info
  getStorageInfo(): { totalSubmissions: number; totalThumbnails: number; estimatedSize: string; percentUsed: number } {
    const submissions = this.loadSubmissions();
    const keys = Object.keys(localStorage);
    const thumbnailKeys = keys.filter(key => key.startsWith(this.THUMBNAILS_KEY_PREFIX));
    
    const { usedMB, percentUsed } = StorageManager.getStorageUsage();
    
    // Log detailed stats
    StorageManager.logStorageStats();
    
    return {
      totalSubmissions: submissions.length,
      totalThumbnails: thumbnailKeys.length,
      estimatedSize: `${usedMB.toFixed(2)} MB`,
      percentUsed
    };
  }
}

export default new LocalStorageService();
