/**
 * Flexible Payout System Types
 * 
 * Supports:
 * - Reusable payout structures (templates)
 * - Per-creator customization
 * - Multiple component types (base, CPM, bonuses, caps)
 * - Campaign-level competitions
 */

// ==================== COMPONENT TYPES ====================

/**
 * Base component - guaranteed payment
 */
export interface BasePayoutComponent {
  type: 'base';
  amount: number;
  payAt?: 'on_assign' | 'on_publish' | 'on_campaign_end';
  description?: string;
}

/**
 * CPM component - performance-based per 1000 views/metric
 */
export interface CPMPayoutComponent {
  type: 'cpm';
  rate: number; // $ per 1000 of metric
  metric: 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'ig_reel_plays' | 'yt_views' | 'tt_views';
  cap?: number; // Max payout from this component
  minThreshold?: number; // Don't pay unless they hit this number
  description?: string;
}

/**
 * Flat upfront component - one-time payment
 */
export interface FlatPayoutComponent {
  type: 'flat';
  amount: number;
  payAt?: 'on_assign' | 'on_publish' | 'on_campaign_end';
  description?: string;
}

/**
 * Single bonus component - pay when condition is met
 */
export interface BonusPayoutComponent {
  type: 'bonus';
  condition: {
    metric: 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'conversions' | 'videos_posted';
    value: number;
    operator?: '>=' | '>' | '=' | '<' | '<=';
  };
  amount?: number; // Fixed amount
  percentOfTotal?: number; // OR percentage of total earned
  once?: boolean; // Only pay once when crossed (default true)
  description?: string;
}

/**
 * Tiered bonus component - multiple thresholds
 */
export interface TieredBonusPayoutComponent {
  type: 'bonus_tiered';
  metric: 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'conversions' | 'videos_posted';
  tiers: Array<{
    threshold: number;
    amount: number;
    description?: string;
  }>;
  description?: string;
}

/**
 * Conversion-based component - pay per conversion/sale
 */
export interface ConversionPayoutComponent {
  type: 'conversion';
  amountPerConversion: number;
  cap?: number; // Max total payout from conversions
  minConversions?: number; // Don't pay unless they hit X conversions
  description?: string;
}

/**
 * Video-based component - pay per video posted
 */
export interface VideoPayoutComponent {
  type: 'per_video';
  amountPerVideo: number;
  maxVideos?: number; // Cap number of videos paid for
  minQualityThreshold?: {
    metric: 'views' | 'likes' | 'engagement_rate';
    value: number;
  };
  description?: string;
}

/**
 * All possible payout component types
 */
export type PayoutComponent =
  | BasePayoutComponent
  | CPMPayoutComponent
  | FlatPayoutComponent
  | BonusPayoutComponent
  | TieredBonusPayoutComponent
  | ConversionPayoutComponent
  | VideoPayoutComponent;

// ==================== PAYOUT STRUCTURE (TEMPLATE) ====================

/**
 * Reusable payout structure - like a saved "rule"
 * Can be applied to multiple creators across campaigns
 */
export interface PayoutStructure {
  id: string;
  orgId: string;
  name: string; // e.g. "Base + CPM w/ cap", "Flat + tiered bonus"
  description?: string;
  components: PayoutComponent[];
  maxPayout?: number; // Structure-level cap
  createdAt: Date;
  createdBy: string;
  isActive: boolean;
  isDefault?: boolean; // Default for new creators
  tags?: string[]; // For organization (e.g. "high-tier", "micro-influencer")
}

/**
 * Component-level override for per-creator customization
 */
export interface PayoutComponentOverride {
  componentIndex: number; // Which component to override
  field: string; // e.g. "rate", "amount", "cap"
  value: number | string | boolean;
}

/**
 * Creator assignment to a campaign with payout structure
 */
export interface CampaignCreatorAssignment {
  creatorId: string;
  payoutStructureId: string;
  overrides?: PayoutComponentOverride[]; // Custom values for this creator
  assignedAt: Date;
  assignedBy: string;
  notes?: string;
}

// ==================== CAMPAIGN COMPETITIONS ====================

/**
 * Competition type
 */
export type CompetitionType =
  | 'top_n' // Top N performers
  | 'first_to_hit' // First to reach threshold
  | 'most_improved' // Biggest % growth
  | 'consistency' // Most consistent performer
  | 'engagement_king'; // Best engagement rate

/**
 * Campaign-level competition
 */
export interface CampaignCompetition {
  id: string;
  campaignId: string;
  name: string; // e.g. "Top 3 Views in November"
  description?: string;
  metric: 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'conversions' | 'engagement_rate' | 'videos_posted';
  type: CompetitionType;
  
  // Top N config
  topN?: number; // For top_n type
  
  // First to hit config
  threshold?: number; // For first_to_hit type
  
  // Prizes
  prizes: Array<{
    rank?: number; // For top_n (1, 2, 3)
    amount: number;
    description?: string;
  }>;
  
  // Eligibility
  eligibleCreatorIds?: string[]; // If empty, all creators eligible
  
  // Timing
  startDate?: Date; // If different from campaign dates
  endDate?: Date;
  
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
}

// ==================== PAYOUT CALCULATION ====================

/**
 * Calculated payout breakdown for a creator
 */
export interface PayoutCalculation {
  creatorId: string;
  campaignId: string;
  calculatedAt: Date;
  
  // Component breakdowns
  componentPayouts: Array<{
    componentType: PayoutComponent['type'];
    componentIndex: number;
    description: string;
    amount: number;
    details?: Record<string, any>; // Extra info (e.g. views counted, tier reached)
  }>;
  
  // Totals
  subtotal: number; // Before caps
  capApplied?: number; // Structure-level cap
  competitionBonus?: number; // From campaign competitions
  total: number; // Final amount
  
  // Performance data used
  performanceData: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    conversions?: number;
    videosPosted?: number;
    engagementRate?: number;
  };
  
  // Status
  status: 'pending' | 'approved' | 'paid' | 'disputed';
  approvedAt?: Date;
  approvedBy?: string;
  paidAt?: Date;
  notes?: string;
}

/**
 * Competition results
 */
export interface CompetitionResult {
  competitionId: string;
  campaignId: string;
  calculatedAt: Date;
  
  rankings: Array<{
    rank: number;
    creatorId: string;
    metricValue: number;
    prize?: number;
  }>;
  
  isFinalized: boolean;
  finalizedAt?: Date;
  finalizedBy?: string;
}

// ==================== CREATOR DEFAULT ====================

/**
 * Creator's default payout structure
 * Used as prefill when adding to campaigns
 */
export interface CreatorDefaultPayout {
  creatorId: string;
  defaultPayoutStructureId?: string;
  notes?: string;
  updatedAt: Date;
  updatedBy: string;
}

// ==================== FIRESTORE TYPES ====================

/**
 * Firestore-safe payout structure (with Timestamps)
 */
export interface FirestorePayoutStructure extends Omit<PayoutStructure, 'createdAt'> {
  createdAt: import('firebase/firestore').Timestamp;
}

/**
 * Firestore-safe payout calculation
 */
export interface FirestorePayoutCalculation extends Omit<PayoutCalculation, 'calculatedAt' | 'approvedAt' | 'paidAt'> {
  calculatedAt: import('firebase/firestore').Timestamp;
  approvedAt?: import('firebase/firestore').Timestamp;
  paidAt?: import('firebase/firestore').Timestamp;
}

/**
 * Firestore-safe competition
 */
export interface FirestoreCampaignCompetition extends Omit<CampaignCompetition, 'createdAt' | 'startDate' | 'endDate'> {
  createdAt: import('firebase/firestore').Timestamp;
  startDate?: import('firebase/firestore').Timestamp;
  endDate?: import('firebase/firestore').Timestamp;
}

