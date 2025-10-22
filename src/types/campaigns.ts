import { Timestamp } from 'firebase/firestore';

/**
 * Campaign Goal Types
 */
export type CampaignGoalType = 
  | 'total_views'
  | 'total_engagement'
  | 'total_revenue'
  | 'video_count'
  | 'avg_engagement_rate'
  | 'total_likes'
  | 'total_comments'
  | 'total_shares';

/**
 * Campaign Status
 */
export type CampaignStatus = 
  | 'draft'
  | 'active'
  | 'completed'
  | 'cancelled';

/**
 * Compensation Type for Campaign
 */
export type CompensationType =
  | 'flat_cpm'      // Pay per 1000 views
  | 'flat_per_video' // Fixed amount per video
  | 'none';          // Use creator's individual payment method

/**
 * Reward Structure for Campaign Winners
 */
export interface CampaignReward {
  position: number;      // 1 = 1st place, 2 = 2nd place, etc.
  amount: number;        // Reward amount in dollars
  description?: string;  // Optional description of reward
}

/**
 * Bonus Reward based on performance thresholds
 */
export interface BonusReward {
  id: string;
  type: 'views_threshold' | 'contribution_percent';
  threshold: number;     // e.g., 100000 views or 10% contribution
  amount: number;        // Bonus amount in dollars
  description: string;   // Description of the bonus
}

/**
 * Participant in a Campaign
 */
export interface CampaignParticipant {
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  joinedAt: Timestamp | Date;
  
  // Performance metrics
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalEngagement: number;
  engagementRate: number;
  videoCount: number;
  
  // Contribution & ranking
  contributionPercent: number;  // % of total campaign performance
  currentRank: number;
  
  // Earnings
  baseEarnings: number;         // From CPM or flat fee
  bonusEarnings: number;        // From bonuses
  rewardEarnings: number;       // From winning positions
  totalEarnings: number;
}

/**
 * Main Campaign Interface
 */
export interface Campaign {
  id: string;
  organizationId: string;
  projectId: string;
  
  // Basic Info
  name: string;
  description: string;          // Supports markdown
  status: CampaignStatus;
  
  // Timeline
  startDate: Timestamp | Date;
  endDate: Timestamp | Date;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy: string;            // Admin user ID
  
  // Goal Configuration
  goalType: CampaignGoalType;
  goalAmount: number;           // Target amount (e.g., 1M views)
  currentProgress: number;      // Current amount achieved
  progressPercent: number;      // % of goal achieved
  
  // Compensation
  compensationType: CompensationType;
  compensationAmount?: number;  // CPM rate or flat fee amount
  
  // Rewards
  rewards: CampaignReward[];    // Position-based rewards (1st, 2nd, 3rd)
  bonusRewards: BonusReward[];  // Performance-based bonuses
  
  // Participants
  participantIds: string[];     // Array of creator user IDs
  participants: CampaignParticipant[];
  
  // Analytics
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalEngagement: number;
  totalVideos: number;
  totalEarnings: number;        // Total paid out
  
  // Leaderboard (sorted by performance)
  leaderboard: {
    creatorId: string;
    rank: number;
    score: number;              // Based on goalType
    delta: number;              // Change from previous rank
  }[];
}

/**
 * Campaign Creation Input (for admins)
 */
export interface CreateCampaignInput {
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  goalType: CampaignGoalType;
  goalAmount: number;
  compensationType: CompensationType;
  compensationAmount?: number;
  rewards: CampaignReward[];
  bonusRewards: BonusReward[];
  participantIds: string[];
}

/**
 * Campaign Stats for Dashboard
 */
export interface CampaignStats {
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  totalParticipants: number;
  totalViews: number;
  totalPaidOut: number;
  avgCampaignPerformance: number;
}

