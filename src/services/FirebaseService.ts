import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { VideoSubmission } from '../types';
import { TrackedAccount } from '../types/accounts';
import { TrackedLink } from '../types/trackedLinks';

/**
 * FirebaseService - Central service for all Firebase Firestore operations
 * This replaces localStorage with cloud storage for better scalability
 */
class FirebaseService {
  // Collection names
  private static VIDEOS_COLLECTION = 'videos';
  private static ACCOUNTS_COLLECTION = 'accounts';
  private static LINKS_COLLECTION = 'trackedLinks';
  private static SETTINGS_COLLECTION = 'settings';

  // ========== VIDEO SUBMISSIONS ==========
  
  /**
   * Save a video submission to Firestore
   */
  static async saveVideo(userId: string, video: VideoSubmission): Promise<void> {
    try {
      const videoRef = doc(db, this.VIDEOS_COLLECTION, video.id);
      await setDoc(videoRef, {
        ...video,
        userId,
        dateSubmitted: Timestamp.fromDate(new Date(video.dateSubmitted)),
        uploadDate: Timestamp.fromDate(new Date(video.uploadDate)),
        lastRefreshed: video.lastRefreshed ? Timestamp.fromDate(new Date(video.lastRefreshed)) : null,
        snapshots: video.snapshots?.map(s => ({
          ...s,
          capturedAt: Timestamp.fromDate(new Date(s.capturedAt))
        })) || []
      });
      console.log(`✅ Saved video ${video.id} to Firebase`);
    } catch (error) {
      console.error('Failed to save video to Firebase:', error);
      throw error;
    }
  }

  /**
   * Get all videos for a user
   */
  static async getVideos(userId: string): Promise<VideoSubmission[]> {
    try {
      const videosRef = collection(db, this.VIDEOS_COLLECTION);
      const q = query(videosRef, where('userId', '==', userId), orderBy('dateSubmitted', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const videos: VideoSubmission[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        videos.push({
          ...data,
          id: doc.id,
          dateSubmitted: data.dateSubmitted.toDate(),
          uploadDate: data.uploadDate.toDate(),
          lastRefreshed: data.lastRefreshed?.toDate(),
          snapshots: data.snapshots?.map((s: any) => ({
            ...s,
            capturedAt: s.capturedAt.toDate()
          })) || []
        } as VideoSubmission);
      });
      
      console.log(`✅ Loaded ${videos.length} videos from Firebase`);
      return videos;
    } catch (error) {
      console.error('Failed to load videos from Firebase:', error);
      throw error;
    }
  }

  /**
   * Delete a video
   */
  static async deleteVideo(videoId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.VIDEOS_COLLECTION, videoId));
      console.log(`✅ Deleted video ${videoId} from Firebase`);
    } catch (error) {
      console.error('Failed to delete video from Firebase:', error);
      throw error;
    }
  }

  /**
   * Update a video
   */
  static async updateVideo(videoId: string, updates: Partial<VideoSubmission>): Promise<void> {
    try {
      const videoRef = doc(db, this.VIDEOS_COLLECTION, videoId);
      const updateData: any = { ...updates };
      
      // Convert dates to Timestamps
      if (updates.lastRefreshed) {
        updateData.lastRefreshed = Timestamp.fromDate(new Date(updates.lastRefreshed));
      }
      if (updates.snapshots) {
        updateData.snapshots = updates.snapshots.map(s => ({
          ...s,
          capturedAt: Timestamp.fromDate(new Date(s.capturedAt))
        }));
      }
      
      await updateDoc(videoRef, updateData);
      console.log(`✅ Updated video ${videoId} in Firebase`);
    } catch (error) {
      console.error('Failed to update video in Firebase:', error);
      throw error;
    }
  }

  // ========== TRACKED ACCOUNTS ==========
  
  /**
   * Save a tracked account
   */
  static async saveAccount(userId: string, account: TrackedAccount): Promise<void> {
    try {
      const accountRef = doc(db, this.ACCOUNTS_COLLECTION, account.id);
      await setDoc(accountRef, {
        ...account,
        userId,
        dateAdded: Timestamp.fromDate(new Date(account.dateAdded)),
        lastSynced: account.lastSynced ? Timestamp.fromDate(new Date(account.lastSynced)) : null
      });
      console.log(`✅ Saved account ${account.id} to Firebase`);
    } catch (error) {
      console.error('Failed to save account to Firebase:', error);
      throw error;
    }
  }

  /**
   * Get all tracked accounts for a user
   */
  static async getAccounts(userId: string): Promise<TrackedAccount[]> {
    try {
      const accountsRef = collection(db, this.ACCOUNTS_COLLECTION);
      const q = query(accountsRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const accounts: TrackedAccount[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        accounts.push({
          ...data,
          id: doc.id,
          dateAdded: data.dateAdded.toDate(),
          lastSynced: data.lastSynced?.toDate()
        } as TrackedAccount);
      });
      
      console.log(`✅ Loaded ${accounts.length} accounts from Firebase`);
      return accounts;
    } catch (error) {
      console.error('Failed to load accounts from Firebase:', error);
      throw error;
    }
  }

  /**
   * Delete a tracked account
   */
  static async deleteAccount(accountId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.ACCOUNTS_COLLECTION, accountId));
      console.log(`✅ Deleted account ${accountId} from Firebase`);
    } catch (error) {
      console.error('Failed to delete account from Firebase:', error);
      throw error;
    }
  }

  // ========== TRACKED LINKS ==========
  
  /**
   * Save a tracked link
   */
  static async saveLink(userId: string, link: TrackedLink): Promise<void> {
    try {
      const linkRef = doc(db, this.LINKS_COLLECTION, link.id);
      await setDoc(linkRef, {
        ...link,
        userId,
        createdAt: Timestamp.fromDate(new Date(link.createdAt)),
        lastClickedAt: link.lastClickedAt ? Timestamp.fromDate(new Date(link.lastClickedAt)) : null
      });
      console.log(`✅ Saved link ${link.id} to Firebase`);
    } catch (error) {
      console.error('Failed to save link to Firebase:', error);
      throw error;
    }
  }

  /**
   * Get all tracked links for a user
   */
  static async getLinks(userId: string): Promise<TrackedLink[]> {
    try {
      const linksRef = collection(db, this.LINKS_COLLECTION);
      const q = query(linksRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const links: TrackedLink[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        links.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt.toDate(),
          lastClickedAt: data.lastClickedAt?.toDate()
        } as TrackedLink);
      });
      
      console.log(`✅ Loaded ${links.length} links from Firebase`);
      return links;
    } catch (error) {
      console.error('Failed to load links from Firebase:', error);
      throw error;
    }
  }

  /**
   * Delete a tracked link
   */
  static async deleteLink(linkId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.LINKS_COLLECTION, linkId));
      console.log(`✅ Deleted link ${linkId} from Firebase`);
    } catch (error) {
      console.error('Failed to delete link from Firebase:', error);
      throw error;
    }
  }

  // ========== USER SETTINGS ==========
  
  /**
   * Save user settings
   */
  static async saveSettings(userId: string, settings: any): Promise<void> {
    try {
      const settingsRef = doc(db, this.SETTINGS_COLLECTION, userId);
      await setDoc(settingsRef, settings, { merge: true });
      console.log(`✅ Saved settings for user ${userId}`);
    } catch (error) {
      console.error('Failed to save settings to Firebase:', error);
      throw error;
    }
  }

  /**
   * Get user settings
   */
  static async getSettings(userId: string): Promise<any> {
    try {
      const settingsRef = doc(db, this.SETTINGS_COLLECTION, userId);
      const docSnap = await getDoc(settingsRef);
      
      if (docSnap.exists()) {
        console.log(`✅ Loaded settings for user ${userId}`);
        return docSnap.data();
      }
      return null;
    } catch (error) {
      console.error('Failed to load settings from Firebase:', error);
      throw error;
    }
  }
}

export default FirebaseService;

