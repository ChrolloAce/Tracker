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
 * Campaign Type - Competition vs Individual
 */
export type CampaignType = 
  | 'competition'  // Campaign-level goal, leaderboard, top performers win
  | 'individual';  // Individual goals per creator, everyone can win

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
 * Metric Guarantee - Required minimums per video
 */
export interface MetricGuarantee {
  id: string;
  metric: 'views' | 'likes' | 'comments' | 'shares' | 'engagement_rate';
  minValue: number;      // Minimum required (e.g., 10,000 views)
  description: string;   // e.g., "Minimum 10K views per video"
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
  coverImage?: string;          // Campaign cover image URL
  status: CampaignStatus;
  campaignType: CampaignType;   // Competition or Individual
  
  // Timeline
  startDate: Timestamp | Date;
  endDate?: Timestamp | Date;   // Optional - can be indefinite
  isIndefinite: boolean;        // True if no end date
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
  
  // Requirements
  metricGuarantees: MetricGuarantee[];  // Minimum metrics per video
  
  // Tracking Rules
  defaultRuleIds?: string[];    // Default tracking rules for this campaign
  
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
  coverImage?: string;            // Optional cover image URL
  campaignType: CampaignType;     // Competition or Individual
  startDate: Date;
  endDate?: Date;                 // Optional - can be indefinite
  isIndefinite: boolean;          // True if no end date
  goalType: CampaignGoalType;
  goalAmount: number;
  compensationType: CompensationType;
  compensationAmount?: number;
  rewards: CampaignReward[];
  bonusRewards: BonusReward[];
  metricGuarantees: MetricGuarantee[];  // Minimum metrics per video
  defaultRuleIds?: string[];      // Optional default tracking rules
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

/**
 * Video Submission Status for Campaigns
 */
export type VideoSubmissionStatus = 
  | 'pending'     // Waiting for review
  | 'approved'    // Approved and counted
  | 'rejected'    // Rejected
  | 'needs_changes'; // Needs modifications

/**
 * Campaign Video Submission
 */
export interface CampaignVideoSubmission {
  id: string;
  campaignId: string;
  organizationId: string;
  projectId: string;
  
  // Submitter Info
  submittedBy: string;        // Creator user ID
  submittedAt: Timestamp | Date;
  
  // Video Details
  videoUrl: string;           // URL to the video
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  thumbnail?: string;
  title?: string;
  description?: string;
  
  // Video Metrics
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  
  // Rule Association
  ruleId?: string;            // Optional: Rule used to track this video
  ruleName?: string;          // Name of the rule for display
  
  // Submission Status
  status: VideoSubmissionStatus;
  reviewedBy?: string;        // Admin who reviewed
  reviewedAt?: Timestamp | Date;
  reviewNotes?: string;       // Feedback from reviewer
  
  // Earnings
  baseEarnings: number;       // From CPM or flat rate
  bonusEarnings: number;      // From bonuses
  totalEarnings: number;
  
  // Metadata
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

/**
 * Create Video Submission Input
 */
export interface CreateVideoSubmissionInput {
  campaignId: string;
  videoUrl: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  thumbnail?: string;
  title?: string;
  description?: string;
  ruleId?: string;            // Optional: Associate with a tracking rule
}

