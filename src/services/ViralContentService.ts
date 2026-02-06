import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  updateDoc 
} from 'firebase/firestore';
import { db } from './firebase';
import { ViralVideo, ViralVideoInput } from '../types/viralContent';

// Super admin email that can manage viral content
const SUPER_ADMIN_EMAIL = 'ernesto@maktubtechnologies.com';

/**
 * Service for managing viral content discovery
 */
class ViralContentService {
  private static COLLECTION = 'viralContent';

  /**
   * Check if user is super admin
   */
  static isSuperAdmin(email: string | null | undefined): boolean {
    if (!email) return false;
    return email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  }

  /**
   * Get all active viral videos
   */
  static async getViralVideos(): Promise<ViralVideo[]> {
    const videosRef = collection(db, this.COLLECTION);
    const q = query(
      videosRef,
      where('isActive', '==', true),
      orderBy('addedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ViralVideo));
  }

  /**
   * Get viral videos by platform
   */
  static async getViralVideosByPlatform(platform: string): Promise<ViralVideo[]> {
    const videosRef = collection(db, this.COLLECTION);
    const q = query(
      videosRef,
      where('isActive', '==', true),
      where('platform', '==', platform),
      orderBy('addedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ViralVideo));
  }

  /**
   * Add a viral video (super admin only)
   */
  static async addViralVideo(
    input: ViralVideoInput,
    addedByEmail: string
  ): Promise<string> {
    if (!this.isSuperAdmin(addedByEmail)) {
      throw new Error('Only super admin can add viral videos');
    }

    const videoRef = doc(collection(db, this.COLLECTION));
    
    const video: ViralVideo = {
      id: videoRef.id,
      ...input,
      addedAt: Timestamp.now(),
      addedBy: addedByEmail,
      isActive: true
    };

    await setDoc(videoRef, video);
    console.log(`✅ Added viral video: ${video.title}`);
    
    return videoRef.id;
  }

  /**
   * Update a viral video (super admin only)
   */
  static async updateViralVideo(
    videoId: string,
    updates: Partial<ViralVideoInput>,
    userEmail: string
  ): Promise<void> {
    if (!this.isSuperAdmin(userEmail)) {
      throw new Error('Only super admin can update viral videos');
    }

    const videoRef = doc(db, this.COLLECTION, videoId);
    await updateDoc(videoRef, updates);
    console.log(`✅ Updated viral video: ${videoId}`);
  }

  /**
   * Delete a viral video (super admin only)
   */
  static async deleteViralVideo(videoId: string, userEmail: string): Promise<void> {
    if (!this.isSuperAdmin(userEmail)) {
      throw new Error('Only super admin can delete viral videos');
    }

    const videoRef = doc(db, this.COLLECTION, videoId);
    await deleteDoc(videoRef);
    console.log(`✅ Deleted viral video: ${videoId}`);
  }

  /**
   * Toggle viral video active status (super admin only)
   */
  static async toggleVideoActive(
    videoId: string, 
    isActive: boolean, 
    userEmail: string
  ): Promise<void> {
    if (!this.isSuperAdmin(userEmail)) {
      throw new Error('Only super admin can toggle viral videos');
    }

    const videoRef = doc(db, this.COLLECTION, videoId);
    await updateDoc(videoRef, { isActive });
    console.log(`✅ Toggled viral video ${videoId} to ${isActive ? 'active' : 'inactive'}`);
  }
}

export default ViralContentService;
