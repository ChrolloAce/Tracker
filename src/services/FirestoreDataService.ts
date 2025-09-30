import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  TrackedAccount, 
  VideoDoc,
  VideoSnapshot,
  TrackedLink,
  LinkClick
} from '../types/firestore';

/**
 * FirestoreDataService - Manages videos, tracked accounts, and links within an organization
 */
class FirestoreDataService {
  
  // ==================== TRACKED ACCOUNTS ====================
  
  /**
   * Add a tracked social media account
   */
  static async addTrackedAccount(
    orgId: string,
    userId: string,
    accountData: Omit<TrackedAccount, 'id' | 'orgId' | 'dateAdded' | 'addedBy' | 'totalVideos' | 'totalViews' | 'totalLikes' | 'totalComments' | 'totalShares'>
  ): Promise<string> {
    const batch = writeBatch(db);
    
    // Create tracked account
    const accountRef = doc(collection(db, 'organizations', orgId, 'trackedAccounts'));
    const fullAccountData: TrackedAccount = {
      ...accountData,
      id: accountRef.id,
      orgId,
      dateAdded: Timestamp.now(),
      addedBy: userId,
      totalVideos: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0
    };
    
    batch.set(accountRef, fullAccountData);
    
    // Increment org tracked account count
    const orgRef = doc(db, 'organizations', orgId);
    batch.update(orgRef, { trackedAccountCount: increment(1) });
    
    await batch.commit();
    console.log(`✅ Added tracked account ${accountData.username} to org ${orgId}`);
    return accountRef.id;
  }

  /**
   * Get all tracked accounts for an organization
   */
  static async getTrackedAccounts(orgId: string, platform?: string): Promise<TrackedAccount[]> {
    let q = query(
      collection(db, 'organizations', orgId, 'trackedAccounts'),
      where('isActive', '==', true),
      orderBy('dateAdded', 'desc')
    );
    
    if (platform) {
      q = query(
        collection(db, 'organizations', orgId, 'trackedAccounts'),
        where('platform', '==', platform),
        where('isActive', '==', true),
        orderBy('dateAdded', 'desc')
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrackedAccount));
  }

  /**
   * Update tracked account
   */
  static async updateTrackedAccount(orgId: string, accountId: string, updates: Partial<TrackedAccount>): Promise<void> {
    const accountRef = doc(db, 'organizations', orgId, 'trackedAccounts', accountId);
    await setDoc(accountRef, updates, { merge: true });
    console.log(`✅ Updated tracked account ${accountId}`);
  }

  /**
   * Delete tracked account
   */
  static async deleteTrackedAccount(orgId: string, accountId: string): Promise<void> {
    const batch = writeBatch(db);
    
    // Delete account
    const accountRef = doc(db, 'organizations', orgId, 'trackedAccounts', accountId);
    batch.delete(accountRef);
    
    // Decrement org count
    const orgRef = doc(db, 'organizations', orgId);
    batch.update(orgRef, { trackedAccountCount: increment(-1) });
    
    await batch.commit();
    console.log(`✅ Deleted tracked account ${accountId}`);
  }

  // ==================== VIDEOS ====================
  
  /**
   * Add a video
   */
  static async addVideo(
    orgId: string,
    userId: string,
    videoData: Omit<VideoDoc, 'id' | 'orgId' | 'dateAdded' | 'addedBy'>
  ): Promise<string> {
    const batch = writeBatch(db);
    
    // Create video
    const videoRef = doc(collection(db, 'organizations', orgId, 'videos'));
    const fullVideoData: VideoDoc = {
      ...videoData,
      id: videoRef.id,
      orgId,
      dateAdded: Timestamp.now(),
      addedBy: userId
    };
    
    batch.set(videoRef, fullVideoData);
    
    // Increment org video count
    const orgRef = doc(db, 'organizations', orgId);
    batch.update(orgRef, { videoCount: increment(1) });
    
    // If linked to tracked account, increment its video count
    if (videoData.trackedAccountId) {
      const accountRef = doc(db, 'organizations', orgId, 'trackedAccounts', videoData.trackedAccountId);
      batch.update(accountRef, { 
        totalVideos: increment(1),
        totalViews: increment(videoData.views || 0),
        totalLikes: increment(videoData.likes || 0),
        totalComments: increment(videoData.comments || 0),
        totalShares: increment(videoData.shares || 0)
      });
    }
    
    await batch.commit();
    console.log(`✅ Added video ${videoRef.id} to org ${orgId}`);
    return videoRef.id;
  }

  /**
   * Get videos for an organization
   */
  static async getVideos(
    orgId: string,
    filters?: {
      trackedAccountId?: string;
      platform?: string;
      status?: 'active' | 'archived';
      limitCount?: number;
    }
  ): Promise<VideoDoc[]> {
    let q = query(
      collection(db, 'organizations', orgId, 'videos'),
      orderBy('lastRefreshed', 'desc'),
      limit(filters?.limitCount || 100)
    );
    
    if (filters?.trackedAccountId) {
      q = query(
        collection(db, 'organizations', orgId, 'videos'),
        where('trackedAccountId', '==', filters.trackedAccountId),
        orderBy('uploadDate', 'desc'),
        limit(filters?.limitCount || 100)
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoDoc));
  }

  /**
   * Add video snapshot (refresh data)
   */
  static async addVideoSnapshot(
    orgId: string,
    videoId: string,
    userId: string,
    metrics: { views: number; likes: number; comments: number; shares?: number }
  ): Promise<void> {
    const batch = writeBatch(db);
    
    // Create snapshot
    const snapshotRef = doc(collection(db, 'organizations', orgId, 'videos', videoId, 'snapshots'));
    const snapshotData: VideoSnapshot = {
      id: snapshotRef.id,
      videoId,
      ...metrics,
      capturedAt: Timestamp.now(),
      capturedBy: userId
    };
    
    batch.set(snapshotRef, snapshotData);
    
    // Update video with latest metrics
    const videoRef = doc(db, 'organizations', orgId, 'videos', videoId);
    batch.update(videoRef, {
      ...metrics,
      lastRefreshed: Timestamp.now()
    });
    
    await batch.commit();
    console.log(`✅ Added snapshot for video ${videoId}`);
  }

  /**
   * Get video snapshots for time-series analysis
   */
  static async getVideoSnapshots(orgId: string, videoId: string, limitCount: number = 30): Promise<VideoSnapshot[]> {
    const q = query(
      collection(db, 'organizations', orgId, 'videos', videoId, 'snapshots'),
      orderBy('capturedAt', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoSnapshot));
  }

  // ==================== TRACKED LINKS ====================
  
  /**
   * Create a tracked link
   */
  static async createLink(
    orgId: string,
    userId: string,
    linkData: Omit<TrackedLink, 'id' | 'orgId' | 'createdAt' | 'createdBy' | 'totalClicks' | 'uniqueClicks' | 'last7DaysClicks'>
  ): Promise<string> {
    const batch = writeBatch(db);
    
    // Create link
    const linkRef = doc(collection(db, 'organizations', orgId, 'links'));
    const fullLinkData: TrackedLink = {
      ...linkData,
      id: linkRef.id,
      orgId,
      createdAt: Timestamp.now(),
      createdBy: userId,
      totalClicks: 0,
      uniqueClicks: 0,
      last7DaysClicks: 0
    };
    
    batch.set(linkRef, fullLinkData);
    
    // Increment org link count
    const orgRef = doc(db, 'organizations', orgId);
    batch.update(orgRef, { linkCount: increment(1) });
    
    // Create public link lookup (for redirects)
    const publicLinkRef = doc(db, 'publicLinks', linkData.shortCode);
    batch.set(publicLinkRef, { orgId, linkId: linkRef.id });
    
    await batch.commit();
    console.log(`✅ Created link ${linkData.shortCode}`);
    return linkRef.id;
  }

  /**
   * Get links for an organization
   */
  static async getLinks(orgId: string): Promise<TrackedLink[]> {
    const q = query(
      collection(db, 'organizations', orgId, 'links'),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrackedLink));
  }

  /**
   * Record link click
   */
  static async recordLinkClick(
    orgId: string,
    linkId: string,
    clickData: Omit<LinkClick, 'id' | 'linkId' | 'timestamp'>
  ): Promise<void> {
    const batch = writeBatch(db);
    
    // Add click record
    const clickRef = doc(collection(db, 'organizations', orgId, 'links', linkId, 'clicks'));
    const fullClickData: LinkClick = {
      ...clickData,
      id: clickRef.id,
      linkId,
      timestamp: Timestamp.now()
    };
    
    batch.set(clickRef, fullClickData);
    
    // Update link analytics
    const linkRef = doc(db, 'organizations', orgId, 'links', linkId);
    batch.update(linkRef, {
      totalClicks: increment(1),
      lastClickedAt: Timestamp.now()
    });
    
    await batch.commit();
  }

  /**
   * Resolve short code to link data
   */
  static async resolveShortCode(shortCode: string): Promise<{ orgId: string; linkId: string } | null> {
    const publicLinkDoc = await getDoc(doc(db, 'publicLinks', shortCode));
    if (publicLinkDoc.exists()) {
      return publicLinkDoc.data() as { orgId: string; linkId: string };
    }
    return null;
  }
}

export default FirestoreDataService;

