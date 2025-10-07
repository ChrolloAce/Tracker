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
  increment,
  updateDoc
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
 * FirestoreDataService - Manages videos, tracked accounts, and links within projects
 * 
 * **All data is scoped to projects now:** organizations/{orgId}/projects/{projectId}/{collection}
 */
class FirestoreDataService {
  
  // ==================== TRACKED ACCOUNTS ====================
  
  /**
   * Add a tracked social media account to a project
   */
  static async addTrackedAccount(
    orgId: string,
    projectId: string,
    userId: string,
    accountData: Omit<TrackedAccount, 'id' | 'orgId' | 'dateAdded' | 'addedBy' | 'totalVideos' | 'totalViews' | 'totalLikes' | 'totalComments' | 'totalShares'>
  ): Promise<string> {
    const batch = writeBatch(db);
    
    // Create tracked account in project with background sync fields
    const accountRef = doc(collection(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts'));
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
      totalShares: 0,
      // Background sync fields
      syncStatus: 'pending',
      syncRequestedBy: userId,
      syncRequestedAt: Timestamp.now(),
      syncRetryCount: 0,
      maxRetries: 3,
      syncProgress: {
        current: 0,
        total: 100,
        message: 'Queued for sync...'
      }
    };
    
    batch.set(accountRef, fullAccountData);
    
    // Increment project account count
    const projectRef = doc(db, 'organizations', orgId, 'projects', projectId);
    batch.update(projectRef, { 
      trackedAccountCount: increment(1),
      updatedAt: Timestamp.now()
    });
    
    await batch.commit();
    console.log(`✅ Added tracked account ${accountData.username} to project ${projectId} with sync status: pending`);
    console.log(`⏳ Account queued for background sync. Cron job will process in ~5 minutes.`);
    
    // Note: We don't trigger immediate sync to avoid auth complexity
    // The cron job runs every 5 minutes and will pick this up automatically
    
    return accountRef.id;
  }

  /**
   * Note: Removed triggerAccountSync() method
   * We rely solely on the cron job to process pending accounts
   * This avoids auth complexity and keeps the system simple
   * The cron runs every 5 minutes automatically
   */

  /**
   * Get all tracked accounts for a project
   */
  static async getTrackedAccounts(orgId: string, projectId: string, platform?: string): Promise<TrackedAccount[]> {
    let q = query(
      collection(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts'),
      where('isActive', '==', true),
      orderBy('dateAdded', 'desc')
    );
    
    if (platform) {
      q = query(
        collection(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts'),
        where('platform', '==', platform),
        where('isActive', '==', true),
        orderBy('dateAdded', 'desc')
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrackedAccount));
  }

  /**
   * Update tracked account in a project
   */
  static async updateTrackedAccount(orgId: string, projectId: string, accountId: string, updates: Partial<TrackedAccount>): Promise<void> {
    const accountRef = doc(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts', accountId);
    await setDoc(accountRef, updates, { merge: true });
    console.log(`✅ Updated tracked account ${accountId}`);
  }

  /**
   * Delete tracked account from a project
   */
  static async deleteTrackedAccount(orgId: string, projectId: string, accountId: string): Promise<void> {
    const batch = writeBatch(db);
    
    // Delete account
    const accountRef = doc(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts', accountId);
    batch.delete(accountRef);
    
    // Decrement project count
    const projectRef = doc(db, 'organizations', orgId, 'projects', projectId);
    batch.update(projectRef, { 
      trackedAccountCount: increment(-1),
      updatedAt: Timestamp.now()
    });
    
    await batch.commit();
    console.log(`✅ Deleted tracked account ${accountId}`);
  }

  // ==================== VIDEOS ====================
  
  /**
   * Add a video to a project
   */
  static async addVideo(
    orgId: string,
    projectId: string,
    userId: string,
    videoData: Omit<VideoDoc, 'id' | 'orgId' | 'dateAdded' | 'addedBy'>
  ): Promise<string> {
    const batch = writeBatch(db);
    
    // Create video in project
    const videoRef = doc(collection(db, 'organizations', orgId, 'projects', projectId, 'videos'));
    const fullVideoData: VideoDoc = {
      ...videoData,
      id: videoRef.id,
      orgId,
      dateAdded: Timestamp.now(),
      addedBy: userId
    };
    
    batch.set(videoRef, fullVideoData);
    
    // Increment project video count
    const projectRef = doc(db, 'organizations', orgId, 'projects', projectId);
    batch.update(projectRef, { 
      videoCount: increment(1),
      updatedAt: Timestamp.now()
    });
    
    // If linked to tracked account, increment its video count
    if (videoData.trackedAccountId) {
      const accountRef = doc(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts', videoData.trackedAccountId);
      batch.update(accountRef, { 
        totalVideos: increment(1),
        totalViews: increment(videoData.views || 0),
        totalLikes: increment(videoData.likes || 0),
        totalComments: increment(videoData.comments || 0),
        totalShares: increment(videoData.shares || 0)
      });
    }
    
    await batch.commit();
    console.log(`✅ Added video ${videoRef.id} to project ${projectId}`);
    return videoRef.id;
  }

  /**
   * Get videos for a project
   */
  static async getVideos(
    orgId: string,
    projectId: string,
    filters?: {
      trackedAccountId?: string;
      platform?: string;
      status?: 'active' | 'archived';
      limitCount?: number;
    }
  ): Promise<VideoDoc[]> {
    let q = query(
      collection(db, 'organizations', orgId, 'projects', projectId, 'videos'),
      orderBy('lastRefreshed', 'desc'),
      limit(filters?.limitCount || 100)
    );
    
    if (filters?.trackedAccountId) {
      q = query(
        collection(db, 'organizations', orgId, 'projects', projectId, 'videos'),
        where('trackedAccountId', '==', filters.trackedAccountId),
        orderBy('uploadDate', 'desc'),
        limit(filters?.limitCount || 1000)
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoDoc));
  }

  /**
   * Add or update multiple videos for a tracked account (batch operation)
   */
  static async syncAccountVideos(
    orgId: string,
    projectId: string,
    accountId: string,
    userId: string,
    videos: Array<{
      videoId: string;
      url: string;
      thumbnail: string;
      caption: string;
      uploadDate: Date;
      views: number;
      likes: number;
      comments: number;
      shares?: number;
      duration?: number;
      hashtags?: string[];
      mentions?: string[];
    }>,
    platform?: 'instagram' | 'tiktok' | 'youtube' | 'twitter'
  ): Promise<void> {
    try {
      console.log(`💾 Syncing ${videos.length} videos to project ${projectId} for account ${accountId}`);
      
      // Process in batches of 500 (Firestore limit)
      const batchSize = 500;
      for (let i = 0; i < videos.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchVideos = videos.slice(i, i + batchSize);
        
        for (const video of batchVideos) {
          // Use videoId as document ID for easy updates
          const videoRef = doc(db, 'organizations', orgId, 'projects', projectId, 'videos', video.videoId);
          
          // Check if video exists
          const existingDoc = await getDoc(videoRef);
          
          if (existingDoc.exists()) {
            // Update existing video metrics
            batch.update(videoRef, {
              views: video.views,
              likes: video.likes,
              comments: video.comments,
              shares: video.shares || 0,
              lastRefreshed: Timestamp.now()
            });
          } else {
            // Create new video document
            const videoData: VideoDoc = {
              id: videoRef.id,
              orgId,
              trackedAccountId: accountId,
              videoId: video.videoId,
              url: video.url,
              thumbnail: video.thumbnail,
              title: video.caption?.substring(0, 100) || '',
              description: video.caption,
              platform: platform || 'instagram',
              uploadDate: Timestamp.fromDate(video.uploadDate),
              views: video.views,
              likes: video.likes,
              comments: video.comments,
              shares: video.shares || 0,
              duration: video.duration || 0,
              hashtags: video.hashtags || [],
              status: 'active',
              isSingular: false,
              dateAdded: Timestamp.now(),
              addedBy: userId,
              lastRefreshed: Timestamp.now()
            };
            
            batch.set(videoRef, videoData);
          }
        }
        
        await batch.commit();
        console.log(`✅ Synced batch ${i / batchSize + 1} of ${Math.ceil(videos.length / batchSize)}`);
      }
      
      console.log(`✅ Successfully synced all ${videos.length} videos to project`);
    } catch (error) {
      console.error('❌ Failed to sync videos to Firestore:', error);
      throw error;
    }
  }

  /**
   * Get videos for a specific tracked account in a project
   */
  static async getAccountVideos(orgId: string, projectId: string, accountId: string, limitCount: number = 100): Promise<VideoDoc[]> {
    try {
      const q = query(
        collection(db, 'organizations', orgId, 'projects', projectId, 'videos'),
        where('trackedAccountId', '==', accountId),
        orderBy('uploadDate', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      const videos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoDoc));
      
      console.log(`✅ Loaded ${videos.length} videos for account ${accountId}`);
      return videos;
    } catch (error) {
      console.error('❌ Failed to load account videos:', error);
      return [];
    }
  }

  /**
   * Delete all videos for a tracked account in a project
   */
  static async deleteAccountVideos(orgId: string, projectId: string, accountId: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting all videos for account ${accountId}`);
      
      // Get all videos for this account
      const q = query(
        collection(db, 'organizations', orgId, 'projects', projectId, 'videos'),
        where('trackedAccountId', '==', accountId)
      );
      
      const snapshot = await getDocs(q);
      
      // Delete in batches
      const batchSize = 500;
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchDocs = snapshot.docs.slice(i, i + batchSize);
        
        batchDocs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
      }
      
      console.log(`✅ Deleted ${snapshot.docs.length} videos for account ${accountId}`);
    } catch (error) {
      console.error('❌ Failed to delete account videos:', error);
      throw error;
    }
  }

  /**
   * Add video snapshot (refresh data)
   */
  static async addVideoSnapshot(
    orgId: string,
    projectId: string,
    videoId: string,
    userId: string,
    metrics: { views: number; likes: number; comments: number; shares?: number }
  ): Promise<void> {
    const batch = writeBatch(db);
    
    // Create snapshot
    const snapshotRef = doc(collection(db, 'organizations', orgId, 'projects', projectId, 'videos', videoId, 'snapshots'));
    const snapshotData: VideoSnapshot = {
      id: snapshotRef.id,
      videoId,
      ...metrics,
      capturedAt: Timestamp.now(),
      capturedBy: userId
    };
    
    batch.set(snapshotRef, snapshotData);
    
    // Update video with latest metrics
    const videoRef = doc(db, 'organizations', orgId, 'projects', projectId, 'videos', videoId);
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
  static async getVideoSnapshots(orgId: string, projectId: string, videoId: string, limitCount: number = 30): Promise<VideoSnapshot[]> {
    const q = query(
      collection(db, 'organizations', orgId, 'projects', projectId, 'videos', videoId, 'snapshots'),
      orderBy('capturedAt', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoSnapshot));
  }

  // ==================== TRACKED LINKS ====================
  
  /**
   * Create a tracked link in a project
   */
  static async createLink(
    orgId: string,
    projectId: string,
    userId: string,
    linkData: Omit<TrackedLink, 'id' | 'orgId' | 'createdAt' | 'createdBy' | 'totalClicks' | 'uniqueClicks' | 'last7DaysClicks'>
  ): Promise<string> {
    const batch = writeBatch(db);
    
    // Create link in project
    const linkRef = doc(collection(db, 'organizations', orgId, 'projects', projectId, 'links'));
    
    // Remove undefined fields (Firestore doesn't accept undefined)
    const cleanLinkData: any = { ...linkData };
    Object.keys(cleanLinkData).forEach(key => {
      if (cleanLinkData[key] === undefined) {
        delete cleanLinkData[key];
      }
    });
    
    const fullLinkData: TrackedLink = {
      ...cleanLinkData,
      id: linkRef.id,
      orgId,
      createdAt: Timestamp.now(),
      createdBy: userId,
      totalClicks: 0,
      uniqueClicks: 0,
      last7DaysClicks: 0
    };
    
    batch.set(linkRef, fullLinkData);
    
    // Increment project link count
    const projectRef = doc(db, 'organizations', orgId, 'projects', projectId);
    batch.update(projectRef, { 
      linkCount: increment(1),
      updatedAt: Timestamp.now()
    });
    
    // Create public link lookup (for redirects) - includes URL, org, project for instant redirect
    const publicLinkRef = doc(db, 'publicLinks', linkData.shortCode);
    batch.set(publicLinkRef, { 
      orgId, 
      projectId,
      linkId: linkRef.id, 
      url: cleanLinkData.originalUrl 
    });
    
    await batch.commit();
    console.log(`✅ Created link ${linkData.shortCode} in project ${projectId}`);
    return linkRef.id;
  }

  /**
   * Get links for a project
   */
  static async getLinks(orgId: string, projectId: string): Promise<TrackedLink[]> {
    const q = query(
      collection(db, 'organizations', orgId, 'projects', projectId, 'links'),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrackedLink));
  }

  /**
   * Record link click in a project
   */
  static async recordLinkClick(
    orgId: string,
    projectId: string,
    linkId: string,
    clickData: Omit<LinkClick, 'id' | 'linkId' | 'timestamp'>
  ): Promise<void> {
    const batch = writeBatch(db);
    
    // Add click record
    const clickRef = doc(collection(db, 'organizations', orgId, 'projects', projectId, 'links', linkId, 'clicks'));
    const fullClickData: LinkClick = {
      ...clickData,
      id: clickRef.id,
      linkId,
      timestamp: Timestamp.now()
    };
    
    batch.set(clickRef, fullClickData);
    
    // Update link analytics
    const linkRef = doc(db, 'organizations', orgId, 'projects', projectId, 'links', linkId);
    batch.update(linkRef, {
      totalClicks: increment(1),
      lastClickedAt: Timestamp.now()
    });
    
    await batch.commit();
  }

  /**
   * Update a tracked link in a project
   */
  static async updateLink(
    orgId: string,
    projectId: string,
    linkId: string,
    updates: Partial<TrackedLink>
  ): Promise<void> {
    const linkRef = doc(db, 'organizations', orgId, 'projects', projectId, 'links', linkId);
    await updateDoc(linkRef, updates);
    console.log(`✅ Updated link ${linkId}`);
  }

  /**
   * Delete a tracked link (soft delete) from a project
   */
  static async deleteLink(orgId: string, projectId: string, linkId: string): Promise<void> {
    const linkRef = doc(db, 'organizations', orgId, 'projects', projectId, 'links', linkId);
    await updateDoc(linkRef, { isActive: false });
    console.log(`✅ Deleted link ${linkId}`);
  }

  /**
   * Get link by ID from a project
   */
  static async getLinkById(orgId: string, projectId: string, linkId: string): Promise<TrackedLink | null> {
    const linkDoc = await getDoc(doc(db, 'organizations', orgId, 'projects', projectId, 'links', linkId));
    if (linkDoc.exists()) {
      return { id: linkDoc.id, ...linkDoc.data() } as TrackedLink;
    }
    return null;
  }

  /**
   * Resolve short code to link data (includes URL, projectId for instant redirect)
   */
  static async resolveShortCode(shortCode: string): Promise<{ orgId: string; projectId: string; linkId: string; url: string } | null> {
    const publicLinkDoc = await getDoc(doc(db, 'publicLinks', shortCode));
    if (publicLinkDoc.exists()) {
      return publicLinkDoc.data() as { orgId: string; projectId: string; linkId: string; url: string };
    }
    return null;
  }
}

export default FirestoreDataService;
