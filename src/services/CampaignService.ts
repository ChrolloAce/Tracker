import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import type {
  Campaign,
  CreateCampaignInput,
  CampaignParticipant,
  CampaignStats,
  CampaignStatus,
  CampaignVideoSubmission,
  CreateVideoSubmissionInput,
  VideoSubmissionStatus,
} from '../types/campaigns';
import type { VideoSubmission } from '../types';
import FirestoreDataService from './FirestoreDataService';
import CreatorLinksService from './CreatorLinksService';
import { computePerVideoMetricInRange } from '../components/kpi/kpiDataProcessing';

/**
 * Campaign Service - Handles all campaign-related operations
 */
class CampaignService {
  /**
   * Create a new campaign
   */
  static async createCampaign(
    orgId: string,
    projectId: string,
    userId: string,
    input: CreateCampaignInput
  ): Promise<string> {
    const campaignsRef = collection(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'campaigns'
    );

    const now = Timestamp.now();

    const campaign: any = {
      organizationId: orgId,
      projectId,
      name: input.name,
      description: input.description,
      status: 'draft',
      campaignType: input.campaignType,
      startDate: Timestamp.fromDate(input.startDate),
      isIndefinite: input.isIndefinite,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      goalType: input.goalType,
      goalAmount: input.goalAmount,
      currentProgress: 0,
      progressPercent: 0,
      compensationType: input.compensationType,
      rewards: input.rewards,
      bonusRewards: input.bonusRewards,
      metricGuarantees: input.metricGuarantees || [],
      resources: [], // Initialize empty resources array
      participantIds: input.participantIds,
      participants: [],
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalEngagement: 0,
      totalVideos: 0,
      totalEarnings: 0,
      leaderboard: [],
    };

    // Add endDate only if not indefinite
    if (!input.isIndefinite && input.endDate) {
      campaign.endDate = Timestamp.fromDate(input.endDate);
    }

    // Only add optional fields if provided
    if (input.coverImage) {
      campaign.coverImage = input.coverImage;
    }
    
    if (input.compensationAmount !== undefined && input.compensationAmount > 0) {
      campaign.compensationAmount = input.compensationAmount;
    }

    if (input.defaultRuleIds && input.defaultRuleIds.length > 0) {
      campaign.defaultRuleIds = input.defaultRuleIds;
    }

    console.log('💾 Saving campaign to Firestore:', JSON.stringify(campaign, null, 2));

    const docRef = await addDoc(campaignsRef, campaign);
    
    // Initialize participants
    await this.initializeParticipants(orgId, projectId, docRef.id, input.participantIds);
    
    return docRef.id;
  }

  /**
   * Initialize campaign participants
   */
  private static async initializeParticipants(
    orgId: string,
    projectId: string,
    campaignId: string,
    participantIds: string[]
  ): Promise<void> {
    // In a real implementation, you'd fetch creator info from Firestore
    // For now, we'll create placeholder participants
    const batch = writeBatch(db);
    const campaignRef = doc(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'campaigns',
      campaignId
    );

    const participants: CampaignParticipant[] = participantIds.map((creatorId) => ({
      creatorId,
      creatorName: 'Creator Name', // TODO: Fetch from user profile
      creatorEmail: 'creator@example.com',
      joinedAt: Timestamp.now(),
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalEngagement: 0,
      engagementRate: 0,
      videoCount: 0,
      contributionPercent: 0,
      currentRank: 0,
      baseEarnings: 0,
      bonusEarnings: 0,
      rewardEarnings: 0,
      totalEarnings: 0,
    }));

    batch.update(campaignRef, { participants });
    await batch.commit();
  }

  /**
   * Get all campaigns for a project
   */
  static async getCampaigns(
    orgId: string,
    projectId: string,
    status?: CampaignStatus
  ): Promise<Campaign[]> {
    const campaignsRef = collection(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'campaigns'
    );

    let q = query(campaignsRef, orderBy('createdAt', 'desc'));

    if (status) {
      q = query(campaignsRef, where('status', '==', status), orderBy('createdAt', 'desc'));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Campaign[];
  }

  /**
   * Get a single campaign by ID
   */
  static async getCampaign(
    orgId: string,
    projectId: string,
    campaignId: string
  ): Promise<Campaign | null> {
    const campaignRef = doc(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'campaigns',
      campaignId
    );

    const snapshot = await getDoc(campaignRef);

    if (!snapshot.exists()) return null;

    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as Campaign;
  }

  /**
   * Upload cover image for campaign
   */
  static async uploadCoverImage(
    orgId: string,
    file: File
  ): Promise<string> {
    try {
      const storagePath = `organizations/${orgId}/campaign-covers/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      
      console.log('📤 Uploading campaign cover image:', storagePath);
      await uploadBytes(storageRef, file);
      
      const downloadURL = await getDownloadURL(storageRef);
      console.log('✅ Cover image uploaded:', downloadURL);
      
      return downloadURL;
    } catch (error) {
      console.error('Failed to upload cover image:', error);
      throw error;
    }
  }

  /**
   * Update campaign
   */
  static async updateCampaign(
    orgId: string,
    projectId: string,
    campaignId: string,
    updates: Partial<Campaign>
  ): Promise<void> {
    try {
      const campaignRef = doc(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'campaigns',
        campaignId
      );

      await updateDoc(campaignRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });

      console.log('✅ Campaign updated:', campaignId);
    } catch (error) {
      console.error('Failed to update campaign:', error);
      throw error;
    }
  }

  /**
   * Delete campaign and its cover image
   */
  static async deleteCampaign(
    orgId: string,
    projectId: string,
    campaignId: string,
    coverImageUrl?: string
  ): Promise<void> {
    try {
      // Delete cover image from storage if exists
      if (coverImageUrl) {
        try {
          // Extract storage path from URL
          const url = new URL(coverImageUrl);
          const pathMatch = url.pathname.match(/\/o\/(.+)\?/);
          if (pathMatch) {
            const storagePath = decodeURIComponent(pathMatch[1]);
            const storageRef = ref(storage, storagePath);
            await deleteObject(storageRef);
            console.log('✅ Cover image deleted from storage');
          }
        } catch (error) {
          console.warn('Failed to delete cover image (may not exist):', error);
        }
      }

      // Delete campaign document
      const campaignRef = doc(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'campaigns',
        campaignId
      );
      
      await deleteDoc(campaignRef);
      console.log('✅ Campaign deleted:', campaignId);
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      throw error;
    }
  }

  /**
   * Get campaigns for a specific creator
   */
  static async getCreatorCampaigns(
    orgId: string,
    projectId: string,
    creatorId: string
  ): Promise<Campaign[]> {
    const campaignsRef = collection(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'campaigns'
    );

    const q = query(
      campaignsRef,
      where('participantIds', 'array-contains', creatorId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Campaign[];
  }

  /**
   * Update campaign status
   */
  static async updateCampaignStatus(
    orgId: string,
    projectId: string,
    campaignId: string,
    status: CampaignStatus
  ): Promise<void> {
    const campaignRef = doc(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'campaigns',
      campaignId
    );

    await updateDoc(campaignRef, {
      status,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Update campaign metrics (recalculate from videos)
   */
  static async updateCampaignMetrics(
    orgId: string,
    projectId: string,
    campaignId: string
  ): Promise<void> {
    // This would fetch all videos in the campaign date range
    // from participants and recalculate all metrics
    // Implementation depends on your video data structure
    
    const campaignRef = doc(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'campaigns',
      campaignId
    );

    // TODO: Implement metric calculation logic
    await updateDoc(campaignRef, {
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Load videos (with snapshots attached) for every participant in a campaign,
   * keyed by `creatorId`. Used by the leaderboard ranking path and by display
   * surfaces (CampaignLeaderboard, CampaignDetailsPage, management cards) that
   * need snapshot-aware totals bounded by the campaign's start/end window.
   *
   * Goes via CreatorLinksService → tracked accounts → videos, then attaches
   * snapshots in a single batch. Returns an empty map for any creator with no
   * linked accounts or no videos.
   */
  static async loadCampaignCreatorVideos(
    orgId: string,
    projectId: string,
    campaign: Campaign,
  ): Promise<Map<string, VideoSubmission[]>> {
    const result = new Map<string, VideoSubmission[]>();
    if (!campaign.participantIds || campaign.participantIds.length === 0) {
      return result;
    }

    const allAccounts = await FirestoreDataService.getTrackedAccounts(orgId, projectId);
    const accountById = new Map(allAccounts.map(a => [a.id, a]));

    // Resolve creator → linked tracked account ids in parallel.
    const creatorAccountLinks = await Promise.all(
      campaign.participantIds.map(async creatorId => {
        try {
          const links = await CreatorLinksService.getCreatorLinkedAccounts(orgId, projectId, creatorId);
          return { creatorId, accountIds: links.map(l => l.accountId) };
        } catch (e) {
          console.warn(`Failed to load linked accounts for creator ${creatorId}:`, e);
          return { creatorId, accountIds: [] as string[] };
        }
      }),
    );

    // Pull videos per tracked account. We can't query "all videos for these
    // accounts" in one shot without an `in` query (>10 limit), so fan out per
    // account and dedupe later. Bounded by campaign size; fine for display.
    const allVideoDocs: Array<{ creatorId: string; videoDoc: any }> = [];
    for (const { creatorId, accountIds } of creatorAccountLinks) {
      if (accountIds.length === 0) {
        result.set(creatorId, []);
        continue;
      }
      const perAccount = await Promise.all(
        accountIds.map(accId =>
          FirestoreDataService.getVideos(orgId, projectId, { trackedAccountId: accId }).catch(err => {
            console.warn(`Failed to load videos for account ${accId}:`, err);
            return [] as any[];
          }),
        ),
      );
      const seen = new Set<string>();
      for (const docs of perAccount) {
        for (const v of docs) {
          if (seen.has(v.id)) continue;
          seen.add(v.id);
          allVideoDocs.push({ creatorId, videoDoc: v });
        }
      }
    }

    // Batch-load snapshots for every collected video at once.
    const allVideoIds = Array.from(new Set(allVideoDocs.map(({ videoDoc }) => videoDoc.id)));
    const snapshotsMap = allVideoIds.length > 0
      ? await FirestoreDataService.getVideoSnapshotsBatch(orgId, projectId, allVideoIds)
      : new Map();

    // Convert VideoDoc → VideoSubmission with snapshots attached, grouped by creator.
    for (const { creatorId, videoDoc } of allVideoDocs) {
      const account = videoDoc.trackedAccountId ? accountById.get(videoDoc.trackedAccountId) : null;
      const submission: VideoSubmission = {
        id: videoDoc.id,
        url: videoDoc.url || videoDoc.videoUrl || '',
        platform: videoDoc.platform,
        thumbnail: videoDoc.thumbnail || '',
        title: videoDoc.title || videoDoc.videoTitle || '',
        caption: videoDoc.description || videoDoc.caption || '',
        uploader: account?.displayName || account?.username || '',
        uploaderHandle: account?.username || '',
        uploaderProfilePicture: account?.profilePicture,
        followerCount: account?.followerCount,
        trackedAccountId: videoDoc.trackedAccountId,
        status: videoDoc.status === 'archived' ? 'rejected' : videoDoc.status === 'processing' ? 'pending' : 'approved',
        views: videoDoc.views || 0,
        likes: videoDoc.likes || 0,
        comments: videoDoc.comments || 0,
        shares: videoDoc.shares || 0,
        saves: videoDoc.saves || 0,
        duration: videoDoc.duration || 0,
        dateSubmitted: videoDoc.dateAdded?.toDate?.() || new Date(),
        uploadDate: videoDoc.uploadDate?.toDate?.() || new Date(),
        lastRefreshed: videoDoc.lastRefreshed?.toDate?.(),
        snapshots: snapshotsMap.get(videoDoc.id) || [],
        sparkedAt: videoDoc.sparkedAt?.toDate?.(),
        sparkViewLogs: videoDoc.sparkViewLogs,
      };
      const list = result.get(creatorId) || [];
      list.push(submission);
      result.set(creatorId, list);
    }

    // Ensure every participant has an entry, even if empty.
    for (const creatorId of campaign.participantIds) {
      if (!result.has(creatorId)) result.set(creatorId, []);
    }

    return result;
  }

  /**
   * Coerce a Firestore Timestamp/Date to a plain Date, or null if absent.
   */
  private static toDateOrNull(d: any): Date | null {
    if (!d) return null;
    if (d instanceof Date) return d;
    if (typeof d.toDate === 'function') return d.toDate();
    return new Date(d);
  }

  /**
   * Calculate and update leaderboard.
   *
   * Ranking and scoring use snapshot-bounded per-video metrics over the
   * campaign's [startDate, endDate] window — NOT the participant's lifetime
   * `totalViews`/`totalLikes`/etc. Lifetime totals leak views from before the
   * campaign started or after it ended into the score, which is the bug this
   * pass exists to fix.
   */
  static async updateLeaderboard(
    orgId: string,
    projectId: string,
    campaignId: string
  ): Promise<void> {
    const campaign = await this.getCampaign(orgId, projectId, campaignId);
    if (!campaign) return;

    // Resolve campaign window (Firestore Timestamps → Date, end defaults to now).
    const campaignStart = this.toDateOrNull(campaign.startDate);
    const campaignEnd = this.toDateOrNull(campaign.endDate) ?? new Date();

    // Load each participant's videos+snapshots once, then derive per-creator
    // snapshot-bounded scores. Falls back to stored participant totals if the
    // load fails (better stale-but-consistent than blank leaderboard).
    let creatorVideos: Map<string, VideoSubmission[]>;
    try {
      creatorVideos = await this.loadCampaignCreatorVideos(orgId, projectId, campaign);
    } catch (e) {
      console.warn('updateLeaderboard: failed to load campaign videos, falling back to stored totals:', e);
      creatorVideos = new Map();
    }

    // Compute per-creator snapshot-bounded score for the campaign's goal metric.
    const scoreFor = (participant: CampaignParticipant): number => {
      const videos = creatorVideos.get(participant.creatorId);
      if (!videos || videos.length === 0) {
        // Fallback: stored lifetime totals (pre-snapshot-aware). Better than
        // dropping the participant from the leaderboard entirely.
        switch (campaign.goalType) {
          case 'total_views': return participant.totalViews;
          case 'total_engagement': return participant.totalEngagement;
          case 'avg_engagement_rate': return participant.engagementRate;
          case 'total_likes': return participant.totalLikes;
          case 'total_comments': return participant.totalComments;
          case 'video_count': return participant.videoCount;
          default: return 0;
        }
      }
      const sumMetric = (m: 'views' | 'likes' | 'comments' | 'shares') =>
        videos.reduce(
          (s, v) => s + computePerVideoMetricInRange(v, m, campaignStart, campaignEnd, { excludeSparked: m === 'views' }),
          0,
        );

      switch (campaign.goalType) {
        case 'total_views': return sumMetric('views');
        case 'total_likes': return sumMetric('likes');
        case 'total_comments': return sumMetric('comments');
        case 'total_engagement': return sumMetric('likes') + sumMetric('comments') + sumMetric('shares');
        case 'avg_engagement_rate': {
          const v = sumMetric('views');
          if (v <= 0) return 0;
          return ((sumMetric('likes') + sumMetric('comments')) / v) * 100;
        }
        case 'video_count': {
          // Count videos uploaded inside the campaign window.
          if (!campaignStart) return videos.length;
          return videos.filter(vid => {
            const up = vid.uploadDate ? new Date(vid.uploadDate) : new Date(vid.dateSubmitted);
            return up >= campaignStart && up <= campaignEnd;
          }).length;
        }
        default: return 0;
      }
    };

    // Sort participants by snapshot-bounded score (descending).
    const scored = campaign.participants.map(p => ({ participant: p, score: scoreFor(p) }));
    scored.sort((a, b) => b.score - a.score);

    // Create leaderboard with ranks + delta vs previous rank.
    const leaderboard = scored.map((entry, index) => {
      const previousRank = entry.participant.currentRank || index + 1;
      const newRank = index + 1;
      return {
        creatorId: entry.participant.creatorId,
        rank: newRank,
        score: entry.score,
        delta: previousRank - newRank, // Positive = moved up, negative = moved down
      };
    });

    // Update campaign with new leaderboard and participant ranks
    const updatedParticipants = scored.map((entry, index) => ({
      ...entry.participant,
      currentRank: index + 1,
    }));

    const campaignRef = doc(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'campaigns',
      campaignId
    );

    await updateDoc(campaignRef, {
      leaderboard,
      participants: updatedParticipants,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Get campaign statistics
   */
  static async getCampaignStats(
    orgId: string,
    projectId: string
  ): Promise<CampaignStats> {
    const campaigns = await this.getCampaigns(orgId, projectId);

    const stats: CampaignStats = {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter((c) => c.status === 'active').length,
      completedCampaigns: campaigns.filter((c) => c.status === 'completed').length,
      totalParticipants: new Set(campaigns.flatMap((c) => c.participantIds)).size,
      totalViews: campaigns.reduce((sum, c) => sum + c.totalViews, 0),
      totalPaidOut: campaigns.reduce((sum, c) => sum + c.totalEarnings, 0),
      avgCampaignPerformance: 0,
    };

    if (campaigns.length > 0) {
      stats.avgCampaignPerformance =
        campaigns.reduce((sum, c) => sum + c.progressPercent, 0) / campaigns.length;
    }

    return stats;
  }

  // ==================== VIDEO SUBMISSIONS ====================

  /**
   * Submit a video to a campaign
   */
  static async submitVideo(
    orgId: string,
    projectId: string,
    userId: string,
    input: CreateVideoSubmissionInput
  ): Promise<string> {
    const submissionsRef = collection(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'campaigns',
      input.campaignId,
      'videoSubmissions'
    );

    const now = Timestamp.now();

    const submission: any = {
      campaignId: input.campaignId,
      organizationId: orgId,
      projectId,
      submittedBy: userId,
      submittedAt: now,
      videoUrl: input.videoUrl,
      platform: input.platform,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagementRate: 0,
      status: 'pending',
      baseEarnings: 0,
      bonusEarnings: 0,
      totalEarnings: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Add optional fields
    if (input.thumbnail) submission.thumbnail = input.thumbnail;
    if (input.title) submission.title = input.title;
    if (input.description) submission.description = input.description;
    if (input.ruleId) submission.ruleId = input.ruleId;

    const docRef = await addDoc(submissionsRef, submission);
    return docRef.id;
  }

  /**
   * Get all video submissions for a campaign
   */
  static async getCampaignSubmissions(
    orgId: string,
    projectId: string,
    campaignId: string
  ): Promise<CampaignVideoSubmission[]> {
    const submissionsRef = collection(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'campaigns',
      campaignId,
      'videoSubmissions'
    );

    const q = query(submissionsRef, orderBy('submittedAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as CampaignVideoSubmission[];
  }

  /**
   * Get a creator's video submissions for a campaign
   */
  static async getCreatorSubmissions(
    orgId: string,
    projectId: string,
    campaignId: string,
    creatorId: string
  ): Promise<CampaignVideoSubmission[]> {
    const submissionsRef = collection(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'campaigns',
      campaignId,
      'videoSubmissions'
    );

    const q = query(
      submissionsRef,
      where('submittedBy', '==', creatorId),
      orderBy('submittedAt', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as CampaignVideoSubmission[];
  }

  /**
   * Update video submission status
   */
  static async updateSubmissionStatus(
    orgId: string,
    projectId: string,
    campaignId: string,
    submissionId: string,
    status: VideoSubmissionStatus,
    reviewNotes?: string,
    reviewerId?: string
  ): Promise<void> {
    const submissionRef = doc(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'campaigns',
      campaignId,
      'videoSubmissions',
      submissionId
    );

    const updates: any = {
      status,
      updatedAt: Timestamp.now(),
    };

    if (reviewNotes) updates.reviewNotes = reviewNotes;
    if (reviewerId) {
      updates.reviewedBy = reviewerId;
      updates.reviewedAt = Timestamp.now();
    }

    await updateDoc(submissionRef, updates);
  }

  /**
   * Update video submission metrics
   */
  static async updateSubmissionMetrics(
    orgId: string,
    projectId: string,
    campaignId: string,
    submissionId: string,
    metrics: {
      views?: number;
      likes?: number;
      comments?: number;
      shares?: number;
      engagementRate?: number;
    }
  ): Promise<void> {
    const submissionRef = doc(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'campaigns',
      campaignId,
      'videoSubmissions',
      submissionId
    );

    const updates: any = {
      ...metrics,
      updatedAt: Timestamp.now(),
    };

    await updateDoc(submissionRef, updates);
  }

  /**
   * Delete a video submission
   */
  static async deleteSubmission(
    orgId: string,
    projectId: string,
    campaignId: string,
    submissionId: string
  ): Promise<void> {
    const submissionRef = doc(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'campaigns',
      campaignId,
      'videoSubmissions',
      submissionId
    );

    await deleteDoc(submissionRef);
  }
}

export default CampaignService;

