import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  increment,
  updateDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  TrackedAccount, 
  VideoDoc,
  TrackedLink,
  LinkClick
} from '../types/firestore';
import { VideoSnapshot } from '../types/index';
import { AccountsDataService } from './firestore/AccountsDataService';
import { VideosDataService } from './firestore/VideosDataService';

/**
 * FirestoreDataService - Facade for all Firestore operations
 * 
 * **Architecture**: This service delegates to specialized sub-services:
 * - AccountsDataService: Tracked account operations
 * - VideosDataService: Video and snapshot operations
 * - Links operations remain in this file
 * 
 * **All data is scoped to projects:** organizations/{orgId}/projects/{projectId}/{collection}
 */
class FirestoreDataService {
  
  // ==================== TRACKED ACCOUNTS (delegated to AccountsDataService) ====================
  
  static async addTrackedAccount(
    orgId: string,
    projectId: string,
    userId: string,
    accountData: Omit<TrackedAccount, 'id' | 'orgId' | 'dateAdded' | 'addedBy' | 'totalVideos' | 'totalViews' | 'totalLikes' | 'totalComments' | 'totalShares'>,
    skipSync: boolean = false
  ): Promise<string> {
    return AccountsDataService.addTrackedAccount(orgId, projectId, userId, accountData, skipSync);
  }

  static async getTrackedAccount(orgId: string, projectId: string, accountId: string): Promise<TrackedAccount | null> {
    return AccountsDataService.getTrackedAccount(orgId, projectId, accountId);
  }

  static async getTrackedAccounts(orgId: string, projectId: string, platform?: string): Promise<TrackedAccount[]> {
    return AccountsDataService.getTrackedAccounts(orgId, projectId, platform);
  }

  static async updateTrackedAccount(orgId: string, projectId: string, accountId: string, updates: Partial<TrackedAccount>): Promise<void> {
    return AccountsDataService.updateTrackedAccount(orgId, projectId, accountId, updates);
  }

  static async deleteTrackedAccount(orgId: string, projectId: string, accountId: string): Promise<void> {
    return AccountsDataService.deleteTrackedAccount(orgId, projectId, accountId);
  }

  // ==================== VIDEOS (delegated to VideosDataService) ====================
  
  static async addVideo(
    orgId: string,
    projectId: string,
    userId: string,
    videoData: Omit<VideoDoc, 'id' | 'orgId' | 'dateAdded' | 'addedBy'>
  ): Promise<string> {
    return VideosDataService.addVideo(orgId, projectId, userId, videoData);
  }

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
    return VideosDataService.getVideos(orgId, projectId, filters);
  }

  static async getVideoSnapshots(
    orgId: string,
    projectId: string,
    videoId: string
  ): Promise<VideoSnapshot[]> {
    return VideosDataService.getVideoSnapshots(orgId, projectId, videoId);
  }

  static async getVideoSnapshotsBatch(
    orgId: string,
    projectId: string,
    videoIds: string[]
  ): Promise<Map<string, VideoSnapshot[]>> {
    return VideosDataService.getVideoSnapshotsBatch(orgId, projectId, videoIds);
  }

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
    return VideosDataService.syncAccountVideos(orgId, projectId, accountId, userId, videos, platform);
  }

  static async getAccountVideos(orgId: string, projectId: string, accountId: string, limitCount: number = 100): Promise<VideoDoc[]> {
    return VideosDataService.getAccountVideos(orgId, projectId, accountId, limitCount);
  }

  static async deleteVideo(orgId: string, projectId: string, videoId: string): Promise<void> {
    return VideosDataService.deleteVideo(orgId, projectId, videoId);
  }

  static async addVideoSnapshot(
    orgId: string,
    projectId: string,
    videoId: string,
    userId: string,
    metrics: { views: number; likes: number; comments: number; shares?: number }
  ): Promise<void> {
    return VideosDataService.addVideoSnapshot(orgId, projectId, videoId, userId, metrics);
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
    const publicLinkData = { 
      orgId, 
      projectId,
      linkId: linkRef.id, 
      url: cleanLinkData.originalUrl,
      createdAt: Timestamp.now()
    };
    batch.set(publicLinkRef, publicLinkData);
    
    await batch.commit();
    console.log(`✅ Created link ${linkData.shortCode} in project ${projectId}`);
    console.log(`📍 Public link data:`, publicLinkData);
    console.log(`🔗 Short URL: ${window.location.origin}/l/${linkData.shortCode}`);
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
    clickData: Omit<LinkClick, 'id' | 'linkId' | 'timestamp' | 'linkTitle' | 'linkUrl' | 'shortCode'>
  ): Promise<void> {
    const batch = writeBatch(db);
    
    // Get link details first
    const linkRef = doc(db, 'organizations', orgId, 'projects', projectId, 'links', linkId);
    const linkDoc = await getDoc(linkRef);
    const linkData = linkDoc.data();
    
    // Add click record to project-level linkClicks collection for easy querying
    const clickRef = doc(collection(db, 'organizations', orgId, 'projects', projectId, 'linkClicks'));
    const fullClickData = {
      ...clickData,
      id: clickRef.id,
      linkId,
      linkTitle: linkData?.title || 'Unknown',
      linkUrl: linkData?.originalUrl || '',
      shortCode: linkData?.shortCode || '',
      timestamp: Timestamp.now()
    };
    
    batch.set(clickRef, fullClickData);
    
    // Update link analytics
    batch.update(linkRef, {
      totalClicks: increment(1),
      uniqueClicks: increment(1), // Simplified for now - could be improved with better uniqueness tracking
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
  static async resolveShortCode(shortCode: string): Promise<{ 
    orgId: string; 
    projectId: string; 
    linkId: string; 
    url: string;
    linkedAccountId?: string;
    accountHandle?: string;
    accountProfilePicture?: string;
    accountPlatform?: string;
  } | null> {
    const publicLinkDoc = await getDoc(doc(db, 'publicLinks', shortCode));
    if (publicLinkDoc.exists()) {
      const publicData = publicLinkDoc.data() as { orgId: string; projectId: string; linkId: string; url: string };
      
      // Fetch the full link document to get linked account info
      try {
        const linkRef = doc(db, 'organizations', publicData.orgId, 'projects', publicData.projectId, 'links', publicData.linkId);
        const linkDoc = await getDoc(linkRef);
        
        if (linkDoc.exists()) {
          const linkData = linkDoc.data();
          const linkedAccountId = linkData.linkedAccountId;
          
          // If there's a linked account, fetch the account details
          if (linkedAccountId) {
            const accountRef = doc(db, 'organizations', publicData.orgId, 'projects', publicData.projectId, 'trackedAccounts', linkedAccountId);
            const accountDoc = await getDoc(accountRef);
            
            if (accountDoc.exists()) {
              const accountData = accountDoc.data();
              return {
                ...publicData,
                linkedAccountId,
                accountHandle: accountData.username,
                accountProfilePicture: accountData.profilePicture,
                accountPlatform: accountData.platform
              };
            }
          }
        }
      } catch (error) {
        console.error('Error fetching linked account info:', error);
      }
      
      // Return basic data even if account fetch failed
      return publicData;
    }
    return null;
  }
}

export default FirestoreDataService;
