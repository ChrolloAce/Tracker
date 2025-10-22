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
import { db } from './firebase';
import type {
  Campaign,
  CreateCampaignInput,
  CampaignParticipant,
  CampaignStats,
  CampaignStatus,
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
      startDate: Timestamp.fromDate(input.startDate),
      endDate: Timestamp.fromDate(input.endDate),
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

    // Only add compensationAmount if it's provided and valid
    if (input.compensationAmount !== undefined && input.compensationAmount > 0) {
      campaign.compensationAmount = input.compensationAmount;
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
   * Delete a campaign
   */
  static async deleteCampaign(
    orgId: string,
    projectId: string,
    campaignId: string
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

    await deleteDoc(campaignRef);
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
}

export default CampaignService;

