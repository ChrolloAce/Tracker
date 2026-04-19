/**
 * Flexible Payout System Types
 * 
 * Supports:
 * - Reusable payout structures (templates)
 * - Per-creator customization
 * - Multiple component types (base, CPM, bonuses, caps)
 * - Campaign-level competitions
 */

// ==================== SHARED TYPES ====================

/**
 * Supported video platforms
 */
export type VideoPlatform = 'tiktok' | 'instagram' | 'youtube' | 'twitter';

/**
 * Caps that can be applied to bonus-type components
 */
export interface BonusCaps {
  perVideo?: number;    // Max bonus earned from a single video
  perCampaign?: number; // Max bonus earned across entire campaign
}

/**
 * Structure-level caps
 */
export interface StructureCaps {
  perCampaign?: number; // Max total payout per creator per campaign
  perPeriod?: {
    amount: number;
    period: 'week' | 'month';
    alignment: 'calendar' | 'rolling';
  };
}

// ==================== COMPONENT TYPES ====================

/**
 * Payout component type enum
 */
export type PayoutComponentType = 'base' | 'cpm' | 'flat' | 'bonus' | 'bonus_tiered' | 'conversion' | 'per_video';

/**
 * Payout metrics
 */
export type PayoutMetric = 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'conversions' | 'videos_posted' | 'engagement_rate' | 'ig_reel_plays' | 'yt_views' | 'tt_views';

/**
 * Condition for bonus payouts
 */
export interface PayoutCondition {
  metric: PayoutMetric;
  value: number;
  operator?: '>=' | '>' | '=' | '<' | '<=';
}

/**
 * Base component - guaranteed payment
 */
export interface BasePayoutComponent {
  id?: string; // Optional ID for tracking
  name?: string; // Optional name for display
  type: 'base';
  amount: number;
  payAt?: 'on_assign' | 'on_publish' | 'on_campaign_end';
  description?: string;
}

/**
 * CPM component - performance-based per 1000 views/metric
 */
export interface CPMPayoutComponent {
  id?: string;
  name?: string;
  type: 'cpm';
  rate: number; // $ per 1000 of metric
  metric: 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'ig_reel_plays' | 'yt_views' | 'tt_views';
  cap?: number; // Max payout from this component
  minThreshold?: number; // Don't pay unless they hit this number
  platformRates?: Partial<Record<VideoPlatform, number>>; // Override rate per platform
  /**
   * How to handle cross-posted video groups.
   * 'sum-all' (default) — sum metric across all platform copies (each view/like counts).
   * 'max-per-group' — per cross-post group, take only the best-performing copy's metric.
   * Ungrouped videos are unaffected.
   */
  crossPostPolicy?: 'sum-all' | 'max-per-group';
  description?: string;
}

/**
 * Flat upfront component - one-time payment
 */
export interface FlatPayoutComponent {
  id?: string;
  name?: string;
  type: 'flat';
  amount: number;
  payAt?: 'on_assign' | 'on_publish' | 'on_campaign_end';
  description?: string;
}

/**
 * Single bonus component - pay when condition is met
 */
export interface BonusPayoutComponent {
  id?: string;
  name?: string;
  type: 'bonus';
  condition: {
    metric: 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'conversions' | 'videos_posted';
    value: number;
    operator?: '>=' | '>' | '=' | '<' | '<=';
  };
  amount?: number; // Fixed amount
  /**
   * If set, switches to STACKING mode: pays `amount` for every `per` units of the metric.
   * Example: amount=100, per=100000, metric=views → $100 for every 100k views.
   * The condition.value is treated as a minimum threshold (creator must hit it before any payout).
   */
  per?: number;
  /**
   * For stacking bonuses: how to apply the calculation.
   * 'per_video' = each video earns bonus independently (most common for clipping campaigns).
   * 'creator_total' = sum of metric across all videos, then one bonus calculation.
   * Defaults to 'per_video' if not set.
   */
  scope?: 'per_video' | 'creator_total';
  /**
   * Piecewise rate tiers for stacking bonuses. The primary `amount`/`per` represents
   * the "from 0" band. Each entry here defines a higher band that takes over at `threshold`.
   * Example: $100/100K from 0 → after 1M, $50/100K → after 2M, $25/100K.
   *   rateTiers: [{ threshold: 1_000_000, rate: 50, per: 100_000 }, { threshold: 2_000_000, rate: 25, per: 100_000 }]
   * Only meaningful when `per` is set (stacking mode).
   */
  rateTiers?: Array<{ threshold: number; rate: number; per: number }>;
  /**
   * How to evaluate cross-posted video groups (only relevant for stacking + per_video scope,
   * or a one-time bonus with a perVideo cap).
   * 'max-per-group' (default) — a single platform copy in the group must hit the threshold;
   *   pays once per group using the best-performing copy's metric.
   * 'sum-per-group' — combined metric across all copies in the group; pays once per group.
   * 'per-platform' — each platform copy evaluated independently (no grouping).
   */
  crossPostPolicy?: 'max-per-group' | 'sum-per-group' | 'per-platform';
  percentOfTotal?: number; // OR percentage of total earned
  once?: boolean; // Only pay once when crossed (default true)
  caps?: BonusCaps; // Per-video and per-campaign caps
  description?: string;
}

/**
 * Tiered bonus component - multiple thresholds
 */
export interface TieredBonusPayoutComponent {
  id?: string;
  name?: string;
  type: 'bonus_tiered';
  metric: 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'conversions' | 'videos_posted';
  tiers: Array<{
    threshold: number;
    amount: number;
    description?: string;
  }>;
  caps?: BonusCaps; // Per-video and per-campaign caps
  /**
   * Cross-post handling when perVideo cap is set (per-video evaluation mode).
   * Same semantics as BonusPayoutComponent.crossPostPolicy.
   */
  crossPostPolicy?: 'max-per-group' | 'sum-per-group' | 'per-platform';
  description?: string;
}

/**
 * Conversion-based component - pay per conversion/sale
 */
export interface ConversionPayoutComponent {
  id?: string;
  name?: string;
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
  id?: string;
  name?: string;
  type: 'per_video';
  amountPerVideo: number;
  maxVideos?: number; // Cap number of videos paid for
  minQualityThreshold?: {
    metric: 'views' | 'likes' | 'engagement_rate';
    value: number;
  };
  /**
   * How to count cross-posted video groups.
   * 'count-as-1' (default) — a cross-post group is paid as one video, regardless of platform count.
   * 'count-as-each' — each platform copy counts as its own video (legacy behavior).
   * 'count-with-cap' — pay for up to `crossPostCap` platform copies per group.
   */
  crossPostPolicy?: 'count-as-1' | 'count-as-each' | 'count-with-cap';
  /** Only used when crossPostPolicy is 'count-with-cap'. Max platform copies paid per group. */
  crossPostCap?: number;
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
  maxPayout?: number; // Legacy: structure-level cap (use caps.perCampaign instead)
  caps?: StructureCaps; // Structure-level caps (per-campaign, per-period)
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
  structureSnapshot?: PayoutStructure; // Immutable copy at assignment time for dispute resolution
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
  | 'engagement_king' // Best engagement rate
  | 'random_draw'; // Random draw from eligible participants

/**
 * Legacy alias for CompetitionType
 */
export type CampaignCompetitionType = CompetitionType;

/**
 * Competition prize structure
 */
export interface CampaignCompetitionPrize {
  rank?: number;
  amount: number;
  description?: string;
}

/**
 * Campaign-level competition
 */
export interface CampaignCompetition {
  id: string;
  campaignId: string;
  name: string; // e.g. "Top 3 Views in November"
  description?: string;
  metric: 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'conversions' | 'engagement_rate' | 'videos_posted' | 'ig_reel_plays' | 'yt_views' | 'tt_views';
  type: CompetitionType;
  
  // Top N config
  topN?: number; // For top_n type
  n?: number; // Alias for topN (backward compatibility)
  
  // First to hit config
  threshold?: number; // For first_to_hit type
  targetValue?: number; // Alias for threshold (backward compatibility)
  
  // Prizes
  prizes: CampaignCompetitionPrize[];
  
  // Eligibility
  eligibleCreatorIds?: string[]; // If empty, all creators eligible
  eligibility?: {
    creatorIds?: string[];
    minVideos?: number;
    minEngagementRate?: number;
    tags?: string[];
  }; // Legacy eligibility format
  
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

/**
 * Creator payout record (final calculated payout)
 * Alias for PayoutCalculation for backward compatibility
 */
export type CreatorPayoutRecord = PayoutCalculation;

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

