import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  increment,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import { CampaignResource, CampaignResourceType } from '../types/campaigns';

/**
 * Service for managing campaign resources (links, files, images)
 */
class CampaignResourcesService {
  
  /**
   * Get all resources for a campaign
   */
  static async getResources(
    orgId: string,
    projectId: string,
    campaignId: string
  ): Promise<CampaignResource[]> {
    try {
      const resourcesRef = collection(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'campaigns',
        campaignId,
        'resources'
      );

      const q = query(resourcesRef, orderBy('uploadedAt', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uploadedAt: doc.data().uploadedAt?.toDate() || new Date(),
      })) as CampaignResource[];
    } catch (error) {
      console.error('Error getting campaign resources:', error);
      throw error;
    }
  }

  /**
   * Add a link resource
   */
  static async addLinkResource(
    orgId: string,
    projectId: string,
    campaignId: string,
    userId: string,
    name: string,
    url: string,
    description?: string
  ): Promise<string> {
    try {
      const resourcesRef = collection(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'campaigns',
        campaignId,
        'resources'
      );

      const resourceData = {
        type: 'link' as CampaignResourceType,
        name,
        url,
        description: description || '',
        uploadedBy: userId,
        uploadedAt: serverTimestamp(),
        downloadCount: 0,
      };

      const docRef = await addDoc(resourcesRef, resourceData);
      console.log('✅ Link resource added:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error adding link resource:', error);
      throw error;
    }
  }

  /**
   * Upload a file resource
   */
  static async uploadFileResource(
    orgId: string,
    projectId: string,
    campaignId: string,
    userId: string,
    file: File,
    name: string,
    type: CampaignResourceType,
    description?: string
  ): Promise<string> {
    try {
      // Upload file to Storage
      const storagePath = `organizations/${orgId}/campaign-resources/${campaignId}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      
      console.log('📤 Uploading file to Storage:', storagePath);
      await uploadBytes(storageRef, file);
      
      // Get download URL
      const fileUrl = await getDownloadURL(storageRef);
      console.log('✅ File uploaded, URL:', fileUrl);

      // Create Firestore document
      const resourcesRef = collection(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'campaigns',
        campaignId,
        'resources'
      );

      const resourceData = {
        type,
        name,
        description: description || '',
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        storagePath,
        uploadedBy: userId,
        uploadedAt: serverTimestamp(),
        downloadCount: 0,
      };

      const docRef = await addDoc(resourcesRef, resourceData);
      console.log('✅ File resource document created:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error uploading file resource:', error);
      throw error;
    }
  }

  /**
   * Delete a resource
   */
  static async deleteResource(
    orgId: string,
    projectId: string,
    campaignId: string,
    resourceId: string,
    storagePath?: string
  ): Promise<void> {
    try {
      // Delete from Firestore
      const resourceRef = doc(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'campaigns',
        campaignId,
        'resources',
        resourceId
      );
      await deleteDoc(resourceRef);
      console.log('✅ Resource document deleted:', resourceId);

      // Delete from Storage if it's a file
      if (storagePath) {
        try {
          const storageRef = ref(storage, storagePath);
          await deleteObject(storageRef);
          console.log('✅ File deleted from Storage:', storagePath);
        } catch (error) {
          console.warn('Failed to delete file from Storage (may not exist):', error);
        }
      }
    } catch (error) {
      console.error('Error deleting resource:', error);
      throw error;
    }
  }

  /**
   * Increment download count
   */
  static async incrementDownloadCount(
    orgId: string,
    projectId: string,
    campaignId: string,
    resourceId: string
  ): Promise<void> {
    try {
      const resourceRef = doc(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'campaigns',
        campaignId,
        'resources',
        resourceId
      );

      await updateDoc(resourceRef, {
        downloadCount: increment(1),
      });
      console.log('✅ Download count incremented for resource:', resourceId);
    } catch (error) {
      console.error('Error incrementing download count:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Download a resource (tracks download count)
   */
  static async downloadResource(
    orgId: string,
    projectId: string,
    campaignId: string,
    resource: CampaignResource
  ): Promise<void> {
    try {
      // Increment download count
      await this.incrementDownloadCount(orgId, projectId, campaignId, resource.id);

      // Open in new tab
      const url = resource.type === 'link' ? resource.url : resource.fileUrl;
      if (url) {
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Error downloading resource:', error);
      throw error;
    }
  }

  /**
   * Get file icon based on type
   */
  static getFileIcon(resource: CampaignResource): string {
    if (resource.type === 'link') return '🔗';
    if (resource.type === 'image') return '🖼️';
    if (resource.type === 'video') return '🎥';
    
    // Document types
    const fileType = resource.fileType || '';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📈';
    if (fileType.includes('zip') || fileType.includes('archive')) return '📦';
    
    return '📎';
  }

  /**
   * Format file size
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

export default CampaignResourcesService;

