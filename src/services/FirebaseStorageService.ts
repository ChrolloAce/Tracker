import { ref, uploadString, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

/**
 * FirebaseStorageService - Manages image uploads to Firebase Storage
 * 
 * Purpose: Replace localStorage-based image storage with Firebase Storage
 * Responsibilities:
 * - Upload thumbnails and profile pictures to Firebase Storage
 * - Retrieve download URLs for images
 * - Delete images when no longer needed
 * - Organize images in structured folders
 */
class FirebaseStorageService {
  
  /**
   * Upload a thumbnail image to Firebase Storage
   * @param orgId Organization ID
   * @param videoId Video identifier
   * @param dataUrl Base64 data URL of the image
   * @returns Download URL of the uploaded image
   */
  static async uploadThumbnail(orgId: string, videoId: string, dataUrl: string): Promise<string> {
    try {
      console.log(`📤 Uploading thumbnail to Firebase Storage: ${videoId}`);
      
      // Create a reference to the thumbnail location
      const thumbnailRef = ref(storage, `organizations/${orgId}/thumbnails/${videoId}.jpg`);
      
      // Upload the data URL
      await uploadString(thumbnailRef, dataUrl, 'data_url');
      
      // Get the download URL
      const downloadURL = await getDownloadURL(thumbnailRef);
      
      console.log(`✅ Thumbnail uploaded successfully: ${videoId}`);
      return downloadURL;
    } catch (error) {
      console.error(`❌ Failed to upload thumbnail ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Upload a profile picture to Firebase Storage
   * @param orgId Organization ID
   * @param accountId Account identifier
   * @param dataUrl Base64 data URL of the image
   * @returns Download URL of the uploaded image
   */
  static async uploadProfilePicture(orgId: string, accountId: string, dataUrl: string): Promise<string> {
    try {
      console.log(`📤 Uploading profile picture to Firebase Storage: ${accountId}`);
      
      // Create a reference to the profile picture location
      const profileRef = ref(storage, `organizations/${orgId}/profiles/${accountId}.jpg`);
      
      // Upload the data URL
      await uploadString(profileRef, dataUrl, 'data_url');
      
      // Get the download URL
      const downloadURL = await getDownloadURL(profileRef);
      
      console.log(`✅ Profile picture uploaded successfully: ${accountId}`);
      return downloadURL;
    } catch (error) {
      console.error(`❌ Failed to upload profile picture ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Upload an organization logo to Firebase Storage
   * @param userId User ID (for path organization)
   * @param imageFile File object of the image
   * @returns Download URL of the uploaded image
   */
  static async uploadOrganizationLogo(userId: string, imageFile: File): Promise<string> {
    try {
      console.log(`📤 Uploading organization logo to Firebase Storage`);
      
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}-${imageFile.name}`;
      
      // Create a reference to the org logo location
      const imageRef = ref(storage, `users/${userId}/org-logos/${filename}`);
      
      // Upload the file
      await uploadBytes(imageRef, imageFile);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(imageRef);
      
      console.log(`✅ Organization logo uploaded successfully`);
      return downloadURL;
    } catch (error) {
      console.error(`❌ Failed to upload organization logo:`, error);
      throw error;
    }
  }

  /**
   * Upload a project image to Firebase Storage
   * @param orgId Organization ID
   * @param imageFile File object of the image
   * @returns Download URL of the uploaded image
   */
  static async uploadProjectImage(orgId: string, imageFile: File): Promise<string> {
    try {
      console.log(`📤 Uploading project image to Firebase Storage`);
      
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}-${imageFile.name}`;
      
      // Create a reference to the project image location
      const imageRef = ref(storage, `organizations/${orgId}/projects/${filename}`);
      
      // Upload the file
      await uploadBytes(imageRef, imageFile);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(imageRef);
      
      console.log(`✅ Project image uploaded successfully`);
      return downloadURL;
    } catch (error) {
      console.error(`❌ Failed to upload project image:`, error);
      throw error;
    }
  }

  /**
   * Upload campaign cover image
   */
  static async uploadCampaignImage(orgId: string, campaignId: string, imageFile: File): Promise<string> {
    try {
      console.log(`📤 Uploading campaign image to Firebase Storage: ${campaignId}`);
      
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}-${imageFile.name}`;
      
      // Create a reference to the campaign image location
      const imageRef = ref(storage, `organizations/${orgId}/campaigns/${campaignId}/${filename}`);
      
      // Upload the file
      await uploadBytes(imageRef, imageFile);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(imageRef);
      
      console.log(`✅ Campaign image uploaded successfully: ${campaignId}`);
      return downloadURL;
    } catch (error) {
      console.error('❌ Failed to upload campaign image:', error);
      throw error;
    }
  }

  /**
   * Download an image from URL and upload to Firebase Storage
   * @param orgId Organization ID
   * @param imageUrl Original image URL
   * @param identifier Unique identifier for the image
   * @param type Type of image (thumbnail or profile)
   * @returns Download URL of the uploaded image
   */
  static async downloadAndUpload(
    orgId: string, 
    imageUrl: string, 
    identifier: string, 
    type: 'thumbnail' | 'profile'
  ): Promise<string> {
    try {
      console.log(`📥 Downloading and uploading ${type}: ${identifier}`);
      
      // Use our image proxy to download the image
      const proxyUrl = `${window.location.origin}/api/image-proxy`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageUrl,
          identifier: identifier
        })
      });

      if (!response.ok) {
        throw new Error(`Proxy failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success || !result.dataUrl) {
        throw new Error(result.error || 'Proxy download failed');
      }

      // Upload to Firebase Storage
      const uploadedUrl = type === 'thumbnail' 
        ? await this.uploadThumbnail(orgId, identifier, result.dataUrl)
        : await this.uploadProfilePicture(orgId, identifier, result.dataUrl);

      console.log(`✅ Downloaded and uploaded ${type}: ${identifier}`);
      return uploadedUrl;
    } catch (error) {
      console.warn(`⚠️ Failed to download and upload ${type} ${identifier}:`, error);
      // For Instagram profile pictures, don't return the original URL as it expires
      // Return empty string instead
      if (type === 'profile' && imageUrl.includes('instagram')) {
        console.log(`⚠️ Instagram ${type} download failed for ${identifier}, returning empty (URL expires)`);
        return '';
      }
      // For other images, return original URL as fallback
      console.log(`📷 Using original URL as fallback: ${identifier}`);
      return imageUrl;
    }
  }

  /**
   * Delete a thumbnail from Firebase Storage
   * @param orgId Organization ID
   * @param videoId Video identifier
   */
  static async deleteThumbnail(orgId: string, videoId: string): Promise<void> {
    try {
      const thumbnailRef = ref(storage, `organizations/${orgId}/thumbnails/${videoId}.jpg`);
      await deleteObject(thumbnailRef);
      console.log(`🗑️ Deleted thumbnail: ${videoId}`);
    } catch (error: any) {
      // Ignore if file doesn't exist
      if (error.code !== 'storage/object-not-found') {
        console.error(`❌ Failed to delete thumbnail ${videoId}:`, error);
      }
    }
  }

  /**
   * Delete a profile picture from Firebase Storage
   * @param orgId Organization ID
   * @param accountId Account identifier
   */
  static async deleteProfilePicture(orgId: string, accountId: string): Promise<void> {
    try {
      const profileRef = ref(storage, `organizations/${orgId}/profiles/${accountId}.jpg`);
      await deleteObject(profileRef);
      console.log(`🗑️ Deleted profile picture: ${accountId}`);
    } catch (error: any) {
      // Ignore if file doesn't exist
      if (error.code !== 'storage/object-not-found') {
        console.error(`❌ Failed to delete profile picture ${accountId}:`, error);
      }
    }
  }

  /**
   * Delete a single video thumbnail
   * @param orgId Organization ID
   * @param videoId Video identifier (used in filename patterns like tiktok_{videoId}_thumb.jpg)
   */
  static async deleteVideoThumbnail(
    orgId: string, 
    videoId: string, 
    platform?: string, 
    platformVideoId?: string
  ): Promise<void> {
    try {
      // Build ONLY the most likely thumbnail filenames to minimize 404s
      const possibleFilenames: string[] = [];
      
      // If platform is known, only try that platform
      if (platform && platformVideoId) {
        possibleFilenames.push(`${platform}_${platformVideoId}_thumb.jpg`);
        possibleFilenames.push(`${platform}_${videoId}_thumb.jpg`);
      } else if (platform) {
        possibleFilenames.push(`${platform}_${videoId}_thumb.jpg`);
      } else if (platformVideoId) {
        // Try all platforms but only with the platformVideoId
        const platforms = ['tiktok', 'instagram', 'youtube', 'twitter'];
        platforms.forEach(p => possibleFilenames.push(`${p}_${platformVideoId}_thumb.jpg`));
      } else {
        // Last resort: try common patterns with videoId
        const platforms = ['tiktok', 'instagram', 'youtube', 'twitter'];
        platforms.forEach(p => possibleFilenames.push(`${p}_${videoId}_thumb.jpg`));
      }
      
      // Try to delete each possible thumbnail (silently)
      let deleted = 0;
      for (const filename of possibleFilenames) {
        try {
          const thumbnailRef = ref(storage, `organizations/${orgId}/thumbnails/${filename}`);
          await deleteObject(thumbnailRef);
          deleted++;
          console.log(`  ✅ [STORAGE] Deleted: ${filename}`);
          break; // Stop after first successful deletion
        } catch (error: any) {
          // Silently ignore - 404s are expected
          if (error.code !== 'storage/object-not-found') {
            console.error(`  ⚠️ [STORAGE] Unexpected error deleting ${filename}:`, error.message);
          }
        }
      }
      
      if (deleted === 0) {
        // This is normal - thumbnails might be CDN URLs that were never uploaded to Storage
        console.log(`ℹ️ [STORAGE] No Firebase Storage thumbnail found for video ${videoId} (likely using CDN URL)`);
      }
    } catch (error) {
      // Don't let thumbnail deletion errors block the entire video deletion
      console.warn(`⚠️ Non-critical: Failed to delete thumbnail for video ${videoId}`);
    }
  }

  /**
   * Delete all thumbnails for a specific account
   * NOTE: This function is deprecated in favor of deleting thumbnails per-video
   * @param _orgId Organization ID (unused - kept for backwards compatibility)
   * @param accountId Account identifier
   */
  static async deleteAccountThumbnails(_orgId: string, accountId: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting all thumbnails for account: ${accountId}`);
      
      // This function is now redundant since we delete thumbnails per-video
      // in deleteAccountVideos, but keeping it for backwards compatibility
      
      // Since thumbnails are named {platform}_{videoId}_thumb.jpg,
      // we can't easily filter by accountId
      // This is handled by deleteAccountVideos now
      
      console.log(`ℹ️ Account thumbnails are now deleted per-video (handled by deleteAccountVideos)`);
    } catch (error) {
      console.error(`❌ Failed to delete account thumbnails:`, error);
    }
  }

  /**
   * Get download URL for an existing thumbnail
   * @param orgId Organization ID
   * @param videoId Video identifier
   * @returns Download URL or null if not found
   */
  static async getThumbnailUrl(orgId: string, videoId: string): Promise<string | null> {
    try {
      const thumbnailRef = ref(storage, `organizations/${orgId}/thumbnails/${videoId}.jpg`);
      const downloadURL = await getDownloadURL(thumbnailRef);
      return downloadURL;
    } catch (error: any) {
      if (error.code === 'storage/object-not-found') {
        return null;
      }
      console.error(`❌ Failed to get thumbnail URL ${videoId}:`, error);
      return null;
    }
  }

  /**
   * Get download URL for an existing profile picture
   * @param orgId Organization ID
   * @param accountId Account identifier
   * @returns Download URL or null if not found
   */
  static async getProfilePictureUrl(orgId: string, accountId: string): Promise<string | null> {
    try {
      const profileRef = ref(storage, `organizations/${orgId}/profiles/${accountId}.jpg`);
      const downloadURL = await getDownloadURL(profileRef);
      return downloadURL;
    } catch (error: any) {
      if (error.code === 'storage/object-not-found') {
        return null;
      }
      console.error(`❌ Failed to get profile picture URL ${accountId}:`, error);
      return null;
    }
  }
}

export default FirebaseStorageService;

