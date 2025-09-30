import { ref, uploadString, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
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
      // Return original URL as fallback
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
   * Delete all thumbnails for a specific account
   * @param orgId Organization ID
   * @param accountId Account identifier
   */
  static async deleteAccountThumbnails(orgId: string, accountId: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting all thumbnails for account: ${accountId}`);
      
      // List all thumbnails starting with the account ID prefix
      const thumbnailsRef = ref(storage, `organizations/${orgId}/thumbnails/`);
      const listResult = await listAll(thumbnailsRef);
      
      // Filter and delete thumbnails for this account
      const deletePromises = listResult.items
        .filter(item => item.name.startsWith(accountId))
        .map(item => deleteObject(item));
      
      await Promise.all(deletePromises);
      console.log(`✅ Deleted ${deletePromises.length} thumbnails for account: ${accountId}`);
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

