import { VideoSubmission } from '../types/firestore';

/**
 * Payment Rule Types that can be calculated
 */
export type PaymentRuleType =
  | 'flat_fee'           // Fixed amount per video
  | 'flat_upfront'       // One-time upfront payment
  | 'cpm'                // Cost per 1000 views
  | 'per_view'           // Cost per view
  | 'per_like'           // Cost per like
  | 'per_comment'        // Cost per comment
  | 'per_share'          // Cost per share
  | 'per_click'          // Cost per tracked link click
  | 'revenue_share'      // Percentage of revenue
  | 'milestone_views'    // Bonus when total views hit threshold
  | 'milestone_videos'   // Bonus when video count hits threshold
  | 'tiered_views'       // Different rates based on view ranges
  | 'retainer';          // Monthly retainer

export interface PaymentRule {
  id: string;
  type: PaymentRuleType;
  enabled: boolean;
  
  // Common fields
  amount?: number;           // Base amount
  rate?: number;             // Rate for CPM, per-view, etc.
  percentage?: number;       // For revenue share
  
  // Thresholds
  minViews?: number;         // Minimum views required
  maxViews?: number;         // Maximum views for this rule
  minVideos?: number;        // Minimum videos required
  
  // Milestone specific
  milestoneThreshold?: number;  // Threshold to hit
  milestoneType?: 'total_views' | 'video_views' | 'video_count';
  milestonePaid?: boolean;      // Track if milestone was already paid
  
  // Upfront specific
  upfrontCondition?: {
    videosRequired?: number;    // Pay upfront for X videos
    paid?: boolean;             // Track if already paid
  };
  
  // Description for display
  description: string;
}

export interface PaymentCalculationResult {
  totalEarnings: number;
  breakdown: {
    ruleId: string;
    ruleDescription: string;
    amount: number;
    details: string;
  }[];
  videoEarnings: {
    videoId: string;
    videoTitle: string;
    earnings: number;
  }[];
}

/**
 * PaymentCalculationService
 * Calculates creator earnings based on structured payment rules
 */
class PaymentCalculationService {
  /**
   * Calculate total earnings for a creator based on their payment rules
   */
  static calculateEarnings(
    videos: VideoSubmission[],
    rules: PaymentRule[],
    linkClicks: number = 0,
    totalRevenue: number = 0
  ): PaymentCalculationResult {
    const result: PaymentCalculationResult = {
      totalEarnings: 0,
      breakdown: [],
      videoEarnings: []
    };

    // Filter enabled rules
    const enabledRules = rules.filter(r => r.enabled);

    // Calculate per-video earnings
    videos.forEach(video => {
      let videoTotal = 0;
      const videoBreakdown: string[] = [];

      enabledRules.forEach(rule => {
        const earnings = this.calculateRuleEarnings(rule, video, videos, linkClicks, totalRevenue);
        
        if (earnings > 0) {
          videoTotal += earnings;
          videoBreakdown.push(`${rule.description}: $${earnings.toFixed(2)}`);
        }
      });

      if (videoTotal > 0) {
        result.videoEarnings.push({
          videoId: video.id,
          videoTitle: video.title || 'Untitled',
          earnings: videoTotal
        });
        result.totalEarnings += videoTotal;
      }
    });

    // Calculate non-per-video earnings (upfront, retainer, milestones)
    enabledRules.forEach(rule => {
      const earnings = this.calculateNonVideoEarnings(rule, videos, linkClicks, totalRevenue);
      
      if (earnings > 0) {
        result.breakdown.push({
          ruleId: rule.id,
          ruleDescription: rule.description,
          amount: earnings,
          details: this.getEarningsDetails(rule, videos, earnings)
        });
        result.totalEarnings += earnings;
      }
    });

    return result;
  }

  /**
   * Calculate earnings for a single rule on a single video
   */
  private static calculateRuleEarnings(
    rule: PaymentRule,
    video: VideoSubmission,
    allVideos: VideoSubmission[],
    linkClicks: number,
    totalRevenue: number
  ): number {
    const views = video.views || 0;
    const likes = video.likes || 0;
    const comments = video.comments || 0;
    const shares = video.shares || 0;

    switch (rule.type) {
      case 'flat_fee':
        // Check if video meets minimum views requirement
        if (rule.minViews && views < rule.minViews) return 0;
        return rule.amount || 0;

      case 'cpm':
        // CPM: Cost per 1000 views
        if (rule.minViews && views < rule.minViews) return 0;
        const eligibleViews = rule.maxViews ? Math.min(views, rule.maxViews) : views;
        return (eligibleViews / 1000) * (rule.rate || 0);

      case 'per_view':
        if (rule.minViews && views < rule.minViews) return 0;
        const countableViews = rule.maxViews ? Math.min(views, rule.maxViews) : views;
        return countableViews * (rule.rate || 0);

      case 'per_like':
        return likes * (rule.rate || 0);

      case 'per_comment':
        return comments * (rule.rate || 0);

      case 'per_share':
        return shares * (rule.rate || 0);

      case 'tiered_views':
        // Calculate based on view range
        if (views < (rule.minViews || 0)) return 0;
        if (rule.maxViews && views > rule.maxViews) return 0;
        return rule.amount || 0;

      default:
        return 0;
    }
  }

  /**
   * Calculate non-per-video earnings (upfront, milestones, retainer)
   */
  private static calculateNonVideoEarnings(
    rule: PaymentRule,
    videos: VideoSubmission[],
    linkClicks: number,
    totalRevenue: number
  ): number {
    switch (rule.type) {
      case 'flat_upfront':
        // One-time upfront payment
        if (rule.upfrontCondition?.paid) return 0;
        if (rule.upfrontCondition?.videosRequired && videos.length < rule.upfrontCondition.videosRequired) {
          return 0;
        }
        return rule.amount || 0;

      case 'per_click':
        // Total link clicks
        return linkClicks * (rule.rate || 0);

      case 'revenue_share':
        // Percentage of total revenue
        return totalRevenue * ((rule.percentage || 0) / 100);

      case 'milestone_views':
        if (rule.milestonePaid) return 0;
        
        if (rule.milestoneType === 'total_views') {
          const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
          if (totalViews >= (rule.milestoneThreshold || 0)) {
            return rule.amount || 0;
          }
        }
        return 0;

      case 'milestone_videos':
        if (rule.milestonePaid) return 0;
        if (videos.length >= (rule.milestoneThreshold || 0)) {
          return rule.amount || 0;
        }
        return 0;

      case 'retainer':
        // Monthly retainer (calculated elsewhere, not per-video)
        return rule.amount || 0;

      default:
        return 0;
    }
  }

  /**
   * Get human-readable details about earnings
   */
  private static getEarningsDetails(
    rule: PaymentRule,
    videos: VideoSubmission[],
    earnings: number
  ): string {
    switch (rule.type) {
      case 'flat_upfront':
        return `Upfront payment for ${videos.length} videos`;
      
      case 'milestone_views':
        const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
        return `Milestone bonus for reaching ${totalViews.toLocaleString()} total views`;
      
      case 'milestone_videos':
        return `Milestone bonus for ${videos.length} videos`;
      
      case 'retainer':
        return `Monthly retainer`;
      
      case 'revenue_share':
        return `${rule.percentage}% revenue share`;
      
      default:
        return rule.description;
    }
  }

  /**
   * Parse a freeform text payment structure into structured rules
   * This is a helper to convert legacy text descriptions
   */
  static parsePaymentText(text: string): PaymentRule[] {
    const rules: PaymentRule[] = [];
    
    // Simple pattern matching for common structures
    // Example: "$500 upfront" -> flat_upfront rule
    const upfrontMatch = text.match(/\$(\d+)\s*upfront/i);
    if (upfrontMatch) {
      rules.push({
        id: `upfront-${Date.now()}`,
        type: 'flat_upfront',
        enabled: true,
        amount: parseFloat(upfrontMatch[1]),
        description: `$${upfrontMatch[1]} upfront`
      });
    }

    // Example: "$50 per video" -> flat_fee rule
    const perVideoMatch = text.match(/\$(\d+)\s*per\s*video/i);
    if (perVideoMatch) {
      rules.push({
        id: `per-video-${Date.now()}`,
        type: 'flat_fee',
        enabled: true,
        amount: parseFloat(perVideoMatch[1]),
        description: `$${perVideoMatch[1]} per video`
      });
    }

    // Example: "$10 CPM" -> cpm rule
    const cpmMatch = text.match(/\$(\d+(?:\.\d+)?)\s*cpm/i);
    if (cpmMatch) {
      rules.push({
        id: `cpm-${Date.now()}`,
        type: 'cpm',
        enabled: true,
        rate: parseFloat(cpmMatch[1]),
        description: `$${cpmMatch[1]} CPM`
      });
    }

    // Example: "$1000 bonus at 100k views" -> milestone rule
    const milestoneMatch = text.match(/\$(\d+)\s*bonus\s*(?:at|when|reaching)\s*(\d+)k?\s*views/i);
    if (milestoneMatch) {
      const amount = parseFloat(milestoneMatch[1]);
      let threshold = parseFloat(milestoneMatch[2]);
      if (text.toLowerCase().includes('k')) {
        threshold *= 1000;
      }
      
      rules.push({
        id: `milestone-${Date.now()}`,
        type: 'milestone_views',
        enabled: true,
        amount,
        milestoneThreshold: threshold,
        milestoneType: 'total_views',
        milestonePaid: false,
        description: `$${amount} bonus at ${threshold.toLocaleString()} total views`
      });
    }

    return rules;
  }

  /**
   * Convert structured rules to readable text
   */
  static rulesToText(rules: PaymentRule[]): string {
    return rules
      .filter(r => r.enabled)
      .map(r => r.description)
      .join(', ');
  }
}

export default PaymentCalculationService;

