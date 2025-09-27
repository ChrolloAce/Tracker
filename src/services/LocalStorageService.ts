import { VideoSubmission } from '../types';

class LocalStorageService {
  private readonly SUBMISSIONS_KEY = 'instagram_submissions';
  private readonly THUMBNAILS_KEY_PREFIX = 'thumbnail_';

  // Save all submissions to localStorage
  saveSubmissions(submissions: VideoSubmission[]): void {
    try {
      console.log('💾 Saving submissions to localStorage:', submissions.length, 'items');
      const serializedData = JSON.stringify(submissions, (key, value) => {
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
        if (key === 'dateSubmitted' && typeof value === 'string') {
          return new Date(value);
        }
        return value;
      }) as VideoSubmission[];

      console.log('✅ Loaded submissions from localStorage:', submissions.length, 'items');
      return submissions;
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

  // Clear all saved data
  clearAllData(): void {
    try {
      // Remove submissions
      localStorage.removeItem(this.SUBMISSIONS_KEY);
      
      // Remove all thumbnails
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.THUMBNAILS_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('🧹 All local data cleared');
    } catch (error) {
      console.error('❌ Failed to clear data:', error);
    }
  }

  // Get storage usage info
  getStorageInfo(): { totalSubmissions: number; totalThumbnails: number; estimatedSize: string } {
    const submissions = this.loadSubmissions();
    const keys = Object.keys(localStorage);
    const thumbnailKeys = keys.filter(key => key.startsWith(this.THUMBNAILS_KEY_PREFIX));
    
    // Estimate storage size
    let totalSize = 0;
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += key.length + value.length;
      }
    });
    
    const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
    
    return {
      totalSubmissions: submissions.length,
      totalThumbnails: thumbnailKeys.length,
      estimatedSize: `${sizeInMB} MB`
    };
  }
}

export default new LocalStorageService();
