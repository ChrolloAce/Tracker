import { Timestamp } from 'firebase/firestore';
import LocalStorageService from './LocalStorageService';
import FirestoreDataService from './FirestoreDataService';
import FirebaseStorageService from './FirebaseStorageService';
import { VideoDoc } from '../types/firestore';

/**
 * DataMigrationService - Migrates data from localStorage to Firestore
 */
class DataMigrationService {
  
  private static MIGRATION_KEY = 'viewtrack_migration_completed';
  
  /**
   * Check if migration has been completed
   */
  static isMigrationCompleted(): boolean {
    return localStorage.getItem(this.MIGRATION_KEY) === 'true';
  }
  
  /**
   * Mark migration as completed
   */
  private static markMigrationCompleted(): void {
    localStorage.setItem(this.MIGRATION_KEY, 'true');
    console.log('✅ Migration marked as completed');
  }
  
  /**
   * Migrate all data from localStorage to Firestore
   */
  static async migrateAllData(orgId: string, userId: string): Promise<void> {
    if (this.isMigrationCompleted()) {
      console.log('ℹ️ Migration already completed, skipping...');
      return;
    }
    
    console.log('🚀 Starting data migration from localStorage to Firestore and Firebase Storage...');
    
    try {
      // Migrate videos
      await this.migrateVideos(orgId, userId);
      
      // Migrate tracked accounts (with profile pictures)
      await this.migrateTrackedAccounts(orgId, userId);
      
      // Migrate tracked links
      await this.migrateTrackedLinks(orgId, userId);
      
      // Migrate thumbnails to Firebase Storage
      await this.migrateThumbnails(orgId);
      
      // Mark migration as completed
      this.markMigrationCompleted();
      
      console.log('✅ Data migration completed successfully!');
      console.log('💡 You can now safely clear localStorage by running: DataMigrationService.clearLocalStorageData()');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }
  
  /**
   * Migrate videos from localStorage to Firestore
   */
  private static async migrateVideos(orgId: string, userId: string): Promise<void> {
    const localVideos = LocalStorageService.loadSubmissions();
    
    if (localVideos.length === 0) {
      console.log('ℹ️ No videos to migrate');
      return;
    }
    
    console.log(`📹 Migrating ${localVideos.length} videos...`);
    
    for (const localVideo of localVideos) {
      try {
        // Convert localStorage video to Firestore format
        const videoData: Omit<VideoDoc, 'id' | 'orgId' | 'dateAdded' | 'addedBy'> = {
          platform: localVideo.platform,
          url: localVideo.url,
          videoId: this.extractVideoId(localVideo.url),
          title: localVideo.title,
          thumbnail: localVideo.thumbnail,
          uploadDate: this.toTimestamp(localVideo.uploadDate),
          lastRefreshed: this.toTimestamp(localVideo.lastRefreshed),
          views: localVideo.views,
          likes: localVideo.likes,
          comments: localVideo.comments,
          shares: localVideo.shares,
          status: 'active',
          isSingular: true // All localStorage videos are singular
        };
        
        await FirestoreDataService.addVideo(orgId, userId, videoData);
        console.log(`  ✓ Migrated video: ${localVideo.title || localVideo.url}`);
      } catch (error) {
        console.error(`  ✗ Failed to migrate video ${localVideo.id}:`, error);
      }
    }
    
    console.log('✅ Video migration completed');
  }
  
  /**
   * Migrate tracked accounts from localStorage to Firestore
   */
  private static async migrateTrackedAccounts(orgId: string, userId: string): Promise<void> {
    const localAccounts = LocalStorageService.loadAccounts();
    
    if (localAccounts.length === 0) {
      console.log('ℹ️ No tracked accounts to migrate');
      return;
    }
    
    console.log(`👤 Migrating ${localAccounts.length} tracked accounts...`);
    
    for (const localAccount of localAccounts) {
      try {
        // Migrate profile picture to Firebase Storage if it exists
        let profilePictureUrl = localAccount.profilePicture;
        if (profilePictureUrl && profilePictureUrl.startsWith('data:')) {
          console.log(`  📤 Uploading profile picture for @${localAccount.username}...`);
          try {
            profilePictureUrl = await FirebaseStorageService.uploadProfilePicture(
              orgId,
              localAccount.id,
              profilePictureUrl
            );
            console.log(`  ✓ Profile picture uploaded for @${localAccount.username}`);
          } catch (error) {
            console.error(`  ⚠️ Failed to upload profile picture for @${localAccount.username}:`, error);
            // Continue with original URL
          }
        }
        
        // Build account data without undefined fields
        const accountData: any = {
          platform: localAccount.platform,
          username: localAccount.username,
          displayName: localAccount.displayName,
          accountType: localAccount.accountType || 'my',
          followerCount: localAccount.followerCount,
          followingCount: localAccount.followingCount,
          bio: localAccount.bio,
          isVerified: localAccount.isVerified,
          isActive: true
        };
        
        // Only add optional fields if they exist
        if (profilePictureUrl) {
          accountData.profilePicture = profilePictureUrl;
        }
        if (localAccount.lastSynced) {
          accountData.lastSynced = this.toTimestamp(localAccount.lastSynced);
        }
        
        await FirestoreDataService.addTrackedAccount(orgId, userId, accountData);
        console.log(`  ✓ Migrated account: @${localAccount.username}`);
      } catch (error) {
        console.error(`  ✗ Failed to migrate account ${localAccount.id}:`, error);
      }
    }
    
    console.log('✅ Tracked account migration completed');
  }
  
  /**
   * Migrate tracked links from localStorage to Firestore
   */
  private static async migrateTrackedLinks(orgId: string, userId: string): Promise<void> {
    const localLinks = LocalStorageService.loadLinks();
    
    if (localLinks.length === 0) {
      console.log('ℹ️ No tracked links to migrate');
      return;
    }
    
    console.log(`🔗 Migrating ${localLinks.length} tracked links...`);
    
    for (const localLink of localLinks) {
      try {
        // Build link data without undefined fields
        const linkData: any = {
          shortCode: localLink.shortCode,
          originalUrl: localLink.originalUrl,
          title: localLink.title,
          isActive: true
        };
        
        // Only add optional fields if they exist
        if (localLink.description) {
          linkData.description = localLink.description;
        }
        if (localLink.tags) {
          linkData.tags = localLink.tags;
        }
        if (localLink.linkedVideoId) {
          linkData.linkedVideoId = localLink.linkedVideoId;
        }
        if (localLink.linkedAccountId) {
          linkData.linkedAccountId = localLink.linkedAccountId;
        }
        if (localLink.lastClickedAt) {
          linkData.lastClickedAt = this.toTimestamp(localLink.lastClickedAt);
        }
        
        await FirestoreDataService.createLink(orgId, userId, linkData);
        console.log(`  ✓ Migrated link: ${localLink.shortCode}`);
      } catch (error) {
        console.error(`  ✗ Failed to migrate link ${localLink.id}:`, error);
      }
    }
    
    console.log('✅ Tracked link migration completed');
  }
  
  /**
   * Helper: Extract video ID from URL
   */
  private static extractVideoId(url: string): string {
    // Simple extraction - you may want to make this more robust
    const match = url.match(/\/([^/?]+)\/?$/);
    return match ? match[1] : url;
  }
  
  /**
   * Helper: Convert Date to Firestore Timestamp
   */
  private static toTimestamp(date: Date | string | undefined): Timestamp {
    if (!date) return Timestamp.now();
    const dateObj = date instanceof Date ? date : new Date(date);
    return Timestamp.fromDate(dateObj);
  }

  /**
   * Migrate thumbnails from localStorage to Firebase Storage
   */
  private static async migrateThumbnails(orgId: string): Promise<void> {
    console.log('🖼️ Migrating thumbnails to Firebase Storage...');
    
    const keys = Object.keys(localStorage);
    const thumbnailKeys = keys.filter(key => key.startsWith('thumbnail_'));
    
    if (thumbnailKeys.length === 0) {
      console.log('ℹ️ No thumbnails to migrate');
      return;
    }
    
    console.log(`📤 Found ${thumbnailKeys.length} thumbnails to migrate...`);
    
    let migrated = 0;
    let failed = 0;
    
    for (const key of thumbnailKeys) {
      try {
        const dataUrl = localStorage.getItem(key);
        if (!dataUrl || !dataUrl.startsWith('data:')) {
          console.log(`  ⏭️ Skipping non-data URL: ${key}`);
          continue;
        }
        
        const videoId = key.replace('thumbnail_', '');
        
        // Upload to Firebase Storage
        await FirebaseStorageService.uploadThumbnail(orgId, videoId, dataUrl);
        console.log(`  ✓ Migrated thumbnail: ${videoId}`);
        migrated++;
      } catch (error) {
        console.error(`  ✗ Failed to migrate thumbnail ${key}:`, error);
        failed++;
      }
    }
    
    console.log(`✅ Thumbnail migration completed: ${migrated} migrated, ${failed} failed`);
  }
  
  /**
   * Clear all localStorage data (use with caution!)
   */
  static clearLocalStorageData(): void {
    if (window.confirm('⚠️ This will permanently delete all localStorage data. Are you sure?')) {
      LocalStorageService.clearAll();
      localStorage.removeItem(this.MIGRATION_KEY);
      console.log('🗑️ All localStorage data cleared');
      console.log('💡 Reload the page to see the migrated data from Firebase');
    }
  }
}

export default DataMigrationService;

