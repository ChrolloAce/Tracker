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
   * Seed initial curated viral content if the collection is empty
   */
  static async seedInitialContentIfEmpty(): Promise<boolean> {
    const videosRef = collection(db, this.COLLECTION);
    const checkQuery = query(videosRef, limit(1));
    const checkSnapshot = await getDocs(checkQuery);

    if (!checkSnapshot.empty) return false;

    const seedVideos: Omit<ViralVideo, 'id'>[] = [
      {
        url: 'https://www.tiktok.com/@amanda.saves/video/7603219066978979085',
        platform: 'tiktok',
        title: 'YieldClub helping me money do more',
        description: 'YieldClub helping me money do more #yield #earninganimation #tryyieldclub #tiktok',
        thumbnail: 'https://cdn.vireel.io/viral-content/slideshows/amanda-saves-https---www-tiktok-com--amanda-saves-video-7603219066978979085-7603219066978979085/slide-1.jpg',
        views: 715800,
        likes: 10100,
        comments: 184,
        shares: 162,
        saves: 421,
        followerCount: 153,
        uploaderHandle: 'amanda.saves',
        uploaderName: 'amanda.saves',
        category: 'Business & Finance',
        contentType: 'video',
        tags: ['yield', 'earninganimation', 'tryyieldclub', 'tiktok'],
        uploadDate: Timestamp.fromDate(new Date('2025-02-04')),
        addedAt: Timestamp.now(),
        addedBy: 'system',
        isActive: true,
      },
    ];

    for (const videoData of seedVideos) {
      const videoRef = doc(collection(db, this.COLLECTION));
      await setDoc(videoRef, { id: videoRef.id, ...videoData });
    }

    console.log(`✅ Seeded ${seedVideos.length} initial viral video(s)`);
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
