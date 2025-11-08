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
  VideoSnapshot as FirestoreVideoSnapshot,
  TrackedLink,
  LinkClick
} from '../types/firestore';
import { VideoSnapshot } from '../types/index';

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
    accountData: Omit<TrackedAccount, 'id' | 'orgId' | 'dateAdded' | 'addedBy' | 'totalVideos' | 'totalViews' | 'totalLikes' | 'totalComments' | 'totalShares'>,
    skipSync: boolean = false
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
      isRead: false,
      totalVideos: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      // Background sync fields - set to 'completed' if skipping sync, 'pending' otherwise
      syncStatus: skipSync ? 'completed' : 'pending',
      syncRequestedBy: userId,
      syncRequestedAt: Timestamp.now(),
      syncRetryCount: 0,
      maxRetries: 3,
      syncProgress: {
        current: skipSync ? 100 : 0,
        total: 100,
        message: skipSync ? 'Video added successfully' : 'Queued for sync...'
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
    
    // Increment organization usage counter
    try {
      const UsageTrackingService = (await import('./UsageTrackingService')).default;
      await UsageTrackingService.incrementUsage(orgId, 'trackedAccounts', 1);
      console.log(`✅ Incremented usage counter for org ${orgId}`);
    } catch (error) {
      console.error('⚠️ Failed to increment usage counter (non-critical):', error);
    }
    
    console.log(`✅ Added tracked account ${accountData.username} to project ${projectId} with sync status: ${skipSync ? 'completed' : 'pending'}`);
    
    if (!skipSync) {
      console.log(`⚡ Triggering immediate sync for instant feedback...`);
      // Trigger immediate sync (fire and forget)
      this.triggerImmediateSync(orgId, projectId, accountRef.id).catch(err => {
        console.error('Failed to trigger immediate sync:', err);
        // Non-critical - cron will pick it up anyway
      });
    } else {
      console.log(`⏭️ Skipping sync - account created for single video addition (status set to 'completed')`);
    }
    
    return accountRef.id;
  }

  /**
   * Trigger immediate sync for an account (fire and forget)
   * This provides instant feedback to users when they add accounts
   * Falls back to cron job if immediate sync fails
   */
  private static async triggerImmediateSync(orgId: string, projectId: string, accountId: string): Promise<void> {
    try {
      await fetch('/api/sync-single-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, orgId, projectId })
      });
      console.log(`🚀 Immediate sync triggered for account ${accountId}`);
    } catch (error) {
      console.error('Failed to trigger immediate sync:', error);
      // Non-critical error - cron will process it anyway
    }
  }

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
    
    // Decrement organization usage counter
    try {
      const UsageTrackingService = (await import('./UsageTrackingService')).default;
      await UsageTrackingService.decrementUsage(orgId, 'trackedAccounts', 1);
      console.log(`✅ Decremented usage counter for org ${orgId}`);
    } catch (error) {
      console.error('⚠️ Failed to decrement usage counter (non-critical):', error);
    }
    
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
              duration: video.duration || 0,
              lastRefreshed: Timestamp.now()
            });
          } else {
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
   * Delete a single video from a project
   */
  static async deleteVideo(orgId: string, projectId: string, videoId: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting video ${videoId}`);
      
      // STEP 1: Delete all snapshots for this video
      try {
        const snapshotsRef = collection(db, 'organizations', orgId, 'projects', projectId, 'videos', videoId, 'snapshots');
        const snapshotsSnapshot = await getDocs(snapshotsRef);
        
        if (snapshotsSnapshot.docs.length > 0) {
          const snapshotBatch = writeBatch(db);
          snapshotsSnapshot.docs.forEach(snapshotDoc => {
            snapshotBatch.delete(snapshotDoc.ref);
          });
          await snapshotBatch.commit();
          console.log(`✅ Deleted ${snapshotsSnapshot.docs.length} snapshots for video ${videoId}`);
        }
      } catch (snapshotError) {
        console.error('⚠️ Failed to delete video snapshots (non-critical):', snapshotError);
      }
      
      // STEP 2: Delete thumbnail from Firebase Storage
      try {
        const FirebaseStorageService = (await import('./FirebaseStorageService')).default;
        await FirebaseStorageService.deleteVideoThumbnail(orgId, videoId);
      } catch (storageError) {
        console.error('⚠️ Failed to delete video thumbnail (non-critical):', storageError);
      }
      
      // STEP 3: Delete video document
      const batch = writeBatch(db);
      const videoRef = doc(db, 'organizations', orgId, 'projects', projectId, 'videos', videoId);
      batch.delete(videoRef);
      
      // Decrement project video count
      const projectRef = doc(db, 'organizations', orgId, 'projects', projectId);
      batch.update(projectRef, { 
        videoCount: increment(-1),
        updatedAt: Timestamp.now()
      });
      
      await batch.commit();
      
      // Decrement organization usage counter
      try {
        const UsageTrackingService = (await import('./UsageTrackingService')).default;
        await UsageTrackingService.decrementUsage(orgId, 'trackedVideos', 1);
        console.log(`✅ Decremented video usage counter for org ${orgId}`);
      } catch (error) {
        console.error('⚠️ Failed to decrement video usage counter (non-critical):', error);
      }
      
      console.log(`✅ Deleted video ${videoId}`);
    } catch (error) {
      console.error('❌ Failed to delete video:', error);
      throw error;
    }
  }

  /**
   * Delete all videos for a tracked account in a project
   */
  static async deleteAccountVideos(orgId: string, projectId: string, accountId: string): Promise<void> {
    try {
      console.log(`🗑️ [DELETE] Starting video deletion for account ${accountId}`);
      console.log(`🗑️ [DELETE] Query path: organizations/${orgId}/projects/${projectId}/videos`);
      console.log(`🗑️ [DELETE] Filter: trackedAccountId == ${accountId}`);
      
      // Get all videos for this account
      const q = query(
        collection(db, 'organizations', orgId, 'projects', projectId, 'videos'),
        where('trackedAccountId', '==', accountId)
      );
      
      const snapshot = await getDocs(q);
      const videoCount = snapshot.docs.length;
      
      console.log(`📊 [DELETE] Query returned ${videoCount} videos`);
      
      if (videoCount === 0) {
        console.warn(`⚠️ [DELETE] No videos found for account ${accountId}. This might indicate:`);
        console.warn(`   - Videos use different trackedAccountId value`);
        console.warn(`   - Videos were already deleted`);
        console.warn(`   - Account has no videos`);
        console.log('✅ [DELETE] Proceeding with account deletion');
        return;
      }
      
      console.log(`📊 [DELETE] Found ${videoCount} videos to delete`);
      
      // Log first video details for debugging
      if (snapshot.docs.length > 0) {
        const firstVideo = snapshot.docs[0].data();
        console.log(`🔍 [DELETE] First video sample:`, {
          id: snapshot.docs[0].id,
          videoId: firstVideo.videoId,
          trackedAccountId: firstVideo.trackedAccountId,
          platform: firstVideo.platform,
          url: firstVideo.url?.substring(0, 50)
        });
      }
      
      // STEP 1: Delete all snapshots and thumbnails for each video
      const FirebaseStorageService = (await import('./FirebaseStorageService')).default;
      let snapshotsDeleted = 0;
      let thumbnailsDeleted = 0;
      let thumbnailErrors = 0;
      let snapshotErrors = 0;
      
      console.log(`🗑️ [DELETE] Step 1: Deleting snapshots and thumbnails for ${videoCount} videos...`);
      
      for (let idx = 0; idx < snapshot.docs.length; idx++) {
        const videoDoc = snapshot.docs[idx];
        const videoId = videoDoc.id;
        const videoData = videoDoc.data();
        
        console.log(`  🗑️ [DELETE] Processing video ${idx + 1}/${videoCount}: ${videoId}`);
        
        // Delete snapshots for this video (in batches of 500)
        try {
          const snapshotsRef = collection(db, 'organizations', orgId, 'projects', projectId, 'videos', videoId, 'snapshots');
          const snapshotsSnapshot = await getDocs(snapshotsRef);
          
          console.log(`    📸 [DELETE] Found ${snapshotsSnapshot.docs.length} snapshots for video ${videoId}`);
          
          if (snapshotsSnapshot.docs.length > 0) {
            const BATCH_SIZE = 500;
            for (let i = 0; i < snapshotsSnapshot.docs.length; i += BATCH_SIZE) {
              const snapshotBatch = writeBatch(db);
              const batchDocs = snapshotsSnapshot.docs.slice(i, i + BATCH_SIZE);
              
              batchDocs.forEach(snapshotDoc => {
                snapshotBatch.delete(snapshotDoc.ref);
              });
              
              await snapshotBatch.commit();
              snapshotsDeleted += batchDocs.length;
              console.log(`    ✅ [DELETE] Deleted snapshot batch ${Math.floor(i / BATCH_SIZE) + 1}`);
            }
          }
        } catch (snapshotError) {
          snapshotErrors++;
          console.error(`    ❌ [DELETE] Failed to delete snapshots for video ${videoId}:`, snapshotError);
        }
        
        // Delete thumbnail for this video
        try {
          const platform = videoData.platform || 'unknown';
          const videoIdFromData = videoData.videoId || videoId;
          console.log(`    🖼️ [DELETE] Attempting to delete thumbnail: ${platform}_${videoIdFromData}_thumb.jpg`);
          await FirebaseStorageService.deleteVideoThumbnail(orgId, videoId, platform, videoIdFromData);
          thumbnailsDeleted++;
          console.log(`    ✅ [DELETE] Deleted thumbnail for video ${videoId}`);
        } catch (thumbnailError: any) {
          thumbnailErrors++;
          // Don't log 404 errors as they're expected if thumbnail doesn't exist
          if (!thumbnailError.message?.includes('404') && !thumbnailError.message?.includes('not found')) {
            console.error(`    ⚠️ [DELETE] Failed to delete thumbnail for video ${videoId}:`, thumbnailError.message);
          } else {
            console.log(`    ℹ️ [DELETE] No thumbnail found for video ${videoId} (expected if never uploaded)`);
          }
        }
      }
      
      console.log(`✅ [DELETE] Step 1 complete: ${snapshotsDeleted} snapshots deleted, ${thumbnailsDeleted} thumbnails deleted`);
      if (snapshotErrors > 0) console.warn(`⚠️ [DELETE] ${snapshotErrors} snapshot deletion errors`);
      if (thumbnailErrors > 0) console.warn(`⚠️ [DELETE] ${thumbnailErrors} thumbnail deletion errors (may be expected)`);
      
      // STEP 2: Delete video documents in batches
      console.log(`🗑️ [DELETE] Step 2: Deleting ${videoCount} video documents...`);
      const batchSize = 500;
      let batchesCommitted = 0;
      
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchDocs = snapshot.docs.slice(i, i + batchSize);
        
        batchDocs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // Update project video count in the last batch
        if (i + batchSize >= snapshot.docs.length) {
          const projectRef = doc(db, 'organizations', orgId, 'projects', projectId);
          batch.update(projectRef, { 
            videoCount: increment(-videoCount),
            updatedAt: Timestamp.now()
          });
          console.log(`  📊 [DELETE] Updating project video count (-${videoCount})`);
        }
        
        await batch.commit();
        batchesCommitted++;
        console.log(`  ✅ [DELETE] Committed batch ${batchesCommitted} (${batchDocs.length} videos)`);
      }
      
      // Decrement organization usage counter
      try {
        const UsageTrackingService = (await import('./UsageTrackingService')).default;
        await UsageTrackingService.decrementUsage(orgId, 'trackedVideos', videoCount);
        console.log(`✅ [DELETE] Decremented org usage counter by ${videoCount}`);
      } catch (error) {
        console.error('⚠️ [DELETE] Failed to decrement video usage counter (non-critical):', error);
      }
      
      console.log(`✅ [DELETE] Successfully deleted ${videoCount} videos for account ${accountId}`);
      console.log(`📊 [DELETE] Summary:`);
      console.log(`   - ${videoCount} videos deleted`);
      console.log(`   - ${snapshotsDeleted} snapshots deleted`);
      console.log(`   - ${thumbnailsDeleted} thumbnails deleted`);
      console.log(`   - ${batchesCommitted} batch(es) committed`);
    } catch (error) {
      console.error('❌ [DELETE] Failed to delete account videos:', error);
      console.error('❌ [DELETE] Error details:', {
        accountId,
        orgId,
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
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
