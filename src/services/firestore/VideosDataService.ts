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
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { 
  VideoDoc,
  VideoSnapshot as FirestoreVideoSnapshot
} from '../../types/firestore';
import { VideoSnapshot } from '../../types/index';
import AdminService from '../AdminService';

/**
 * VideosDataService
 * 
 * Handles all video and snapshot operations in Firestore.
 * Manages videos within the project scope: organizations/{orgId}/projects/{projectId}/videos
 */
export class VideosDataService {
  
  /**
   * Add a video to a project
   * Admin users bypass video limits
   */
  static async addVideo(
    orgId: string,
    projectId: string,
    userId: string,
    videoData: Omit<VideoDoc, 'id' | 'orgId' | 'dateAdded' | 'addedBy'>
  ): Promise<string> {
    // ✅ CHECK VIDEO LIMITS BEFORE ADDING (admins bypass)
    const isAdmin = await AdminService.shouldBypassLimits(userId);
    
    if (!isAdmin) {
    const usageDoc = await getDoc(doc(db, 'organizations', orgId, 'billing', 'usage'));
    const usage = usageDoc.data();
    const currentVideos = usage?.trackedVideos || 0;
    const videoLimit = usage?.videoLimit || usage?.limits?.trackedVideos || 100;
    
    if (currentVideos >= videoLimit) {
      throw new Error(`Video limit reached (${videoLimit}). Please upgrade your plan to add more videos.`);
    }
    
    console.log(`📊 Video limits - Current: ${currentVideos}, Limit: ${videoLimit}, Available: ${videoLimit - currentVideos}`);
    } else {
      console.log(`🔓 Admin user ${userId} bypassing video limit check`);
    }
    
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
    try {
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
      const videos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoDoc));
    
      return videos;
    } catch (error) {
      console.error('❌ Failed to fetch videos:', error);
      return [];
    }
  }

  /**
   * Get snapshots for a specific video
   */
  static async getVideoSnapshots(
    orgId: string,
    projectId: string,
    videoId: string
  ): Promise<VideoSnapshot[]> {
    try {
      const snapshotsRef = collection(
        db, 
        'organizations', orgId, 
        'projects', projectId, 
        'videos', videoId, 
        'snapshots'
      );
      const snapshotsQuery = query(snapshotsRef, orderBy('capturedAt', 'asc'));
      const snapshotsSnapshot = await getDocs(snapshotsQuery);
      
      const snapshots: VideoSnapshot[] = snapshotsSnapshot.docs.map(doc => {
        const data = doc.data() as FirestoreVideoSnapshot;
        
        // Convert Firestore snapshot to VideoSubmission snapshot format
        return {
          id: doc.id,
          videoId: data.videoId,
          views: data.views,
          likes: data.likes,
          comments: data.comments,
          shares: data.shares,
          capturedAt: data.capturedAt?.toDate?.() || new Date(),
          capturedBy: (data.capturedBy === 'initial_upload' || 
                      data.capturedBy === 'manual_refresh' || 
                      data.capturedBy === 'scheduled_refresh')
                      ? data.capturedBy 
                      : 'manual_refresh' as const
        } as VideoSnapshot;
      });
      
      return snapshots;
    } catch (error) {
      console.error(`❌ Failed to fetch snapshots for video ${videoId}:`, error);
      return [];
    }
  }

  /**
   * Get snapshots for multiple videos (batch operation)
   */
  static async getVideoSnapshotsBatch(
    orgId: string,
    projectId: string,
    videoIds: string[]
  ): Promise<Map<string, VideoSnapshot[]>> {
    const snapshotsMap = new Map<string, VideoSnapshot[]>();
    
    // Fetch snapshots for each video
    const promises = videoIds.map(async (videoId) => {
      const snapshots = await this.getVideoSnapshots(orgId, projectId, videoId);
      return { videoId, snapshots };
    });
    
    const results = await Promise.all(promises);
    
    // Build map
    results.forEach(({ videoId, snapshots }) => {
      snapshotsMap.set(videoId, snapshots);
    });
    
    // console.log(`📸 Loaded snapshots for ${results.filter(r => r.snapshots.length > 0).length}/${videoIds.length} videos`);
    
    return snapshotsMap;
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
      
      // ✅ CHECK VIDEO LIMITS
      const usageDoc = await getDoc(doc(db, 'organizations', orgId, 'billing', 'usage'));
      const usage = usageDoc.data();
      const currentVideos = usage?.trackedVideos || 0;
      const videoLimit = usage?.videoLimit || usage?.limits?.trackedVideos || 100;
      const availableSpace = videoLimit - currentVideos;
      
      console.log(`📊 Video limits - Current: ${currentVideos}, Limit: ${videoLimit}, Available: ${availableSpace}`);
      
      if (availableSpace <= 0) {
        throw new Error(`Video limit reached (${videoLimit}). Please upgrade your plan to add more videos.`);
      }
      
      // Process in batches of 500 (Firestore limit)
      const batchSize = 500;
      let newVideosAdded = 0;
      
      for (let i = 0; i < videos.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchVideos = videos.slice(i, i + batchSize);
        
        for (const video of batchVideos) {
          // ✅ Stop if we've reached the limit
          if (newVideosAdded >= availableSpace) {
            console.warn(`⚠️ Video limit reached. Stopping at ${newVideosAdded} new videos (${videos.length - i} videos not synced)`);
            break;
          }
          
          // Use videoId as document ID for easy updates
          const videoRef = doc(db, 'organizations', orgId, 'projects', projectId, 'videos', video.videoId);
          
          // Check if video exists
          const existingDoc = await getDoc(videoRef);
          
          if (existingDoc.exists()) {
            // Update existing video metrics (doesn't count against limit)
            batch.update(videoRef, {
              views: video.views,
              likes: video.likes,
              comments: video.comments,
              shares: video.shares || 0,
              duration: video.duration || 0,
              lastRefreshed: Timestamp.now()
            });
          } else {
            // Check if we have space for this new video
            if (newVideosAdded >= availableSpace) {
              console.warn(`⚠️ Skipping video ${video.videoId} - limit reached`);
              continue;
            }
            // Debug: Log first video being saved
            if (batchVideos.indexOf(video) === 0 && video.caption) {
              console.log('🔍 Saving first video to Firestore:', {
                caption: video.caption,
                title: video.caption?.substring(0, 100),
                description: video.caption,
                videoId: video.videoId
              });
            }
            
            // Create new video document
            const videoData: VideoDoc = {
              id: videoRef.id,
              orgId,
              trackedAccountId: accountId,
              videoId: video.videoId,
              videoUrl: video.url, // New field name
              url: video.url, // Keep legacy for backward compatibility
              thumbnail: video.thumbnail,
              videoTitle: video.caption?.substring(0, 100) || '', // New field name
              title: video.caption?.substring(0, 100) || '', // Keep legacy
              caption: video.caption, // New field name (matches Firestore)
              description: video.caption, // Keep legacy
              platform: platform || 'instagram',
              uploadDate: Timestamp.fromDate(video.uploadDate),
              views: video.views,
              likes: video.likes,
              comments: video.comments,
              shares: video.shares || 0,
              saves: (video as any).saves || 0,
              duration: video.duration || 0,
              hashtags: video.hashtags || [],
              status: 'active',
              isSingular: false,
              dateAdded: Timestamp.now(),
              addedBy: userId,
              lastRefreshed: Timestamp.now()
            };
            
            batch.set(videoRef, videoData);
            newVideosAdded++; // ✅ Track new videos added
          }
        }
        
        await batch.commit();
        console.log(`✅ Synced batch ${i / batchSize + 1} of ${Math.ceil(videos.length / batchSize)} (${newVideosAdded} new videos)`);
      }
      
      console.log(`✅ Successfully synced videos - ${newVideosAdded} new, ${videos.length - newVideosAdded} updated (total: ${videos.length})`);
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
   * Delete a single video from a project (immediately via API)
   * ✅ UPDATED: Immediate deletion via API call instead of cron queue
   */
  static async deleteVideo(orgId: string, projectId: string, videoId: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting video ${videoId} immediately...`);
      
      // Get video data before deletion
      const videoRef = doc(db, 'organizations', orgId, 'projects', projectId, 'videos', videoId);
      const videoSnap = await getDoc(videoRef);
      
      if (!videoSnap.exists()) {
        console.warn(`⚠️ Video ${videoId} doesn't exist, skipping`);
        return;
      }
      
          const videoData = videoSnap.data();
      const platform = videoData?.platform;
      const platformVideoId = videoData?.videoId;
      const trackedAccountId = videoData?.trackedAccountId;
      
      // Get Firebase ID token for authentication
      const user = getAuth().currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const token = await user.getIdToken();
      
      // Call the immediate deletion API
      const response = await fetch('/api/delete-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
        orgId,
        projectId,
        videoId,
        platformVideoId: platformVideoId || null,
        platform: platform || null,
          trackedAccountId: trackedAccountId || null
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete video');
      }
      
      const result = await response.json();
      console.log(`✅ Video deleted successfully in ${result.duration}s (${result.snapshotsDeleted} snapshots removed)`);
      
      } catch (error) {
      console.error('❌ Failed to delete video:', error);
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
    
    // Create snapshot (using Firestore type for storage)
    const snapshotRef = doc(collection(db, 'organizations', orgId, 'projects', projectId, 'videos', videoId, 'snapshots'));
    const snapshotData: FirestoreVideoSnapshot = {
      id: snapshotRef.id,
      videoId,
      views: metrics.views,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      capturedAt: Timestamp.now(),
      capturedBy: userId,
      isInitialSnapshot: false // Manual snapshot from user, not initial
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
}

