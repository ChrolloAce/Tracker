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
  updateDoc,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import { ViralVideo } from '../types/viralContent';
import { VIRAL_SEED_DATA } from '../data/viralSeedData';

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
   * Seed curated viral content if the collection is empty.
   * Data lives in src/data/viralSeedData.ts (12 entries from genviral_top12).
   */
  static async seedInitialContentIfEmpty(): Promise<boolean> {
    const videosRef = collection(db, this.COLLECTION);
    const checkQuery = query(videosRef, limit(1));
    const checkSnapshot = await getDocs(checkQuery);

    if (!checkSnapshot.empty) return false;

    for (const entry of VIRAL_SEED_DATA) {
      const videoRef = doc(collection(db, this.COLLECTION));
      const video: ViralVideo = {
        id: videoRef.id,
        url: entry.url,
        platform: entry.platform,
        title: entry.title,
        description: entry.description,
        thumbnail: entry.thumbnail,
        views: entry.views,
        likes: entry.likes,
        comments: entry.comments,
        shares: entry.shares,
        saves: entry.saves,
        followerCount: entry.followerCount,
        uploaderHandle: entry.uploaderHandle,
        uploaderName: entry.uploaderName,
        category: entry.category,
        contentType: entry.contentType,
        tags: entry.tags,
        uploadDate: Timestamp.fromDate(new Date(entry.uploadDateISO)),
        addedAt: Timestamp.now(),
        addedBy: 'system',
        isActive: true,
      };
      await setDoc(videoRef, video);
    }

    console.log(`✅ Seeded ${VIRAL_SEED_DATA.length} curated viral videos`);
    return true;
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
