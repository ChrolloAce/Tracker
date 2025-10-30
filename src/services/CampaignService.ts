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
   * Calculate and update leaderboard
   */
  static async updateLeaderboard(
    orgId: string,
    projectId: string,
    campaignId: string
  ): Promise<void> {
    const campaign = await this.getCampaign(orgId, projectId, campaignId);
    if (!campaign) return;

    // Sort participants by their score (based on goal type)
    const sortedParticipants = [...campaign.participants].sort((a, b) => {
      switch (campaign.goalType) {
        case 'total_views':
          return b.totalViews - a.totalViews;
        case 'total_engagement':
          return b.totalEngagement - a.totalEngagement;
        case 'avg_engagement_rate':
          return b.engagementRate - a.engagementRate;
        case 'total_likes':
          return b.totalLikes - a.totalLikes;
        case 'total_comments':
          return b.totalComments - a.totalComments;
        case 'video_count':
          return b.videoCount - a.videoCount;
        default:
          return 0;
      }
    });

    // Create leaderboard with ranks
    const leaderboard = sortedParticipants.map((participant, index) => {
      const previousRank = participant.currentRank || index + 1;
      const newRank = index + 1;
      
      let score = 0;
      switch (campaign.goalType) {
        case 'total_views':
          score = participant.totalViews;
          break;
        case 'total_engagement':
          score = participant.totalEngagement;
          break;
        case 'avg_engagement_rate':
          score = participant.engagementRate;
          break;
        case 'total_likes':
          score = participant.totalLikes;
          break;
        case 'total_comments':
          score = participant.totalComments;
          break;
        case 'video_count':
          score = participant.videoCount;
          break;
      }

      return {
        creatorId: participant.creatorId,
        rank: newRank,
        score,
        delta: previousRank - newRank, // Positive = moved up, negative = moved down
      };
    });

    // Update campaign with new leaderboard and participant ranks
    const updatedParticipants = sortedParticipants.map((p, index) => ({
      ...p,
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

