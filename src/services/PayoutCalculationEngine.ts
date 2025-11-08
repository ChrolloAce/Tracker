import type {
  PayoutStructure,
  PayoutComponent,
  PayoutMetric,
  PayoutCondition,
  CreatorPayoutRecord
} from '../types/payouts';
import type { VideoSubmission } from '../types';
import { Timestamp } from 'firebase/firestore';

/**
 * Performance metrics for a creator in a campaign
 */
export interface CreatorPerformance {
  creatorId: string;
  videoCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalEngagement: number;
  engagementRate: number;
  conversions?: number; // For future integrations
  videos: VideoSubmission[];
}

/**
 * Component calculation result
 */
export interface ComponentCalculation {
  componentId: string;
  componentName: string;
  type: string;
  amount: number;
  details: string;
  wasCapped?: boolean;
  originalAmount?: number;
}

/**
 * Payout calculation result
 */
export interface PayoutCalculationResult {
  creatorId: string;
  totalPayout: number;
  componentBreakdown: ComponentCalculation[];
  appliedCap?: {
    maxPayout: number;
    originalTotal: number;
  };
  performance: CreatorPerformance;
}

/**
 * Engine for calculating creator payouts based on flexible payout structures
 * 
 * Supports:
 * - Base/Flat payments
 * - CPM (cost per thousand)
 * - Single bonuses (condition-based)
 * - Tiered bonuses (multiple thresholds)
 * - Component-level caps
 * - Structure-level caps
 * - Per-creator overrides
 */
export class PayoutCalculationEngine {
  /**
   * Calculate payout for a single creator based on their performance and payout structure
   */
  static calculateCreatorPayout(
    creatorId: string,
    structure: PayoutStructure,
    performance: CreatorPerformance,
    overrides?: Record<string, any>
  ): PayoutCalculationResult {
    const componentBreakdown: ComponentCalculation[] = [];
    let totalPayout = 0;

    // Process each component in the structure
    for (const component of structure.components) {
      const calculation = this.calculateComponent(
        component,
        performance,
        overrides?.[component.id]
      );

      if (calculation.amount > 0) {
        componentBreakdown.push(calculation);
        totalPayout += calculation.amount;
      }
    }

    // Apply structure-level cap if specified
    let appliedCap: { maxPayout: number; originalTotal: number } | undefined;
    if (structure.maxPayout && totalPayout > structure.maxPayout) {
      appliedCap = {
        maxPayout: structure.maxPayout,
        originalTotal: totalPayout
      };
      totalPayout = structure.maxPayout;
    }

    return {
      creatorId,
      totalPayout,
      componentBreakdown,
      appliedCap,
      performance
    };
  }

  /**
   * Calculate a single payout component
   */
  static calculateComponent(
    component: PayoutComponent,
    performance: CreatorPerformance,
    overrides?: any
  ): ComponentCalculation {
    // Apply overrides
    const effectiveComponent = { ...component, ...overrides };

    let amount = 0;
    let details = '';
    let wasCapped = false;
    let originalAmount = 0;

    switch (effectiveComponent.type) {
      case 'base':
      case 'flat':
        amount = effectiveComponent.amount || 0;
        details = `Flat payment: $${amount}`;
        break;

      case 'cpm':
        amount = this.calculateCPM(effectiveComponent, performance);
        const metricValue = this.getMetricValue(
          effectiveComponent.metric || 'views',
          performance
        );
        details = `CPM: ${this.formatNumber(metricValue)} ${effectiveComponent.metric} @ $${effectiveComponent.rate}/1K`;
        
        // Apply cap if specified
        if (effectiveComponent.cap && amount > effectiveComponent.cap) {
          originalAmount = amount;
          amount = effectiveComponent.cap;
          wasCapped = true;
          details += ` (capped at $${effectiveComponent.cap})`;
        }
        break;

      case 'bonus':
        if (this.checkCondition(effectiveComponent.condition!, performance)) {
          amount = effectiveComponent.amount || 0;
          details = `Bonus: ${this.formatCondition(effectiveComponent.condition!, performance)}`;
        }
        break;

      case 'bonus_tiered':
        const tierResult = this.calculateTieredBonus(effectiveComponent, performance);
        amount = tierResult.amount;
        details = tierResult.details;
        break;
    }

    return {
      componentId: component.id,
      componentName: component.name,
      type: component.type,
      amount: Math.round(amount * 100) / 100, // Round to 2 decimals
      details,
      wasCapped,
      originalAmount: wasCapped ? originalAmount : undefined
    };
  }

  /**
   * Calculate CPM component
   */
  private static calculateCPM(
    component: PayoutComponent,
    performance: CreatorPerformance
  ): number {
    const metric = component.metric || 'views';
    const metricValue = this.getMetricValue(metric, performance);
    const rate = component.rate || 0;
    const minThreshold = component.minThreshold || 0;

    // Check if meets minimum threshold
    if (metricValue < minThreshold) {
      return 0;
    }

    // Calculate CPM (per 1000 units)
    return (metricValue / 1000) * rate;
  }

  /**
   * Calculate tiered bonus
   */
  private static calculateTieredBonus(
    component: PayoutComponent,
    performance: CreatorPerformance
  ): { amount: number; details: string } {
    if (!component.tiers || component.tiers.length === 0) {
      return { amount: 0, details: 'No tiers defined' };
    }

    // Sort tiers by condition value (descending) to find highest tier met
    const sortedTiers = [...component.tiers].sort((a, b) => {
      return b.condition.value - a.condition.value;
    });

    // Find highest tier that creator qualifies for
    for (const tier of sortedTiers) {
      if (this.checkCondition(tier.condition, performance)) {
        return {
          amount: tier.amount,
          details: `Tier bonus: ${this.formatCondition(tier.condition, performance)} → $${tier.amount}`
        };
      }
    }

    return { amount: 0, details: 'No tier threshold met' };
  }

  /**
   * Check if a condition is met
   */
  private static checkCondition(
    condition: PayoutCondition,
    performance: CreatorPerformance
  ): boolean {
    const metricValue = this.getMetricValue(condition.metric, performance);
    const targetValue = condition.value;
    const operator = condition.operator || 'gte';

    switch (operator) {
      case 'gt':
        return metricValue > targetValue;
      case 'gte':
        return metricValue >= targetValue;
      case 'lt':
        return metricValue < targetValue;
      case 'lte':
        return metricValue <= targetValue;
      case 'eq':
        return metricValue === targetValue;
      default:
        return metricValue >= targetValue;
    }
  }

  /**
   * Get metric value from performance data
   */
  private static getMetricValue(
    metric: PayoutMetric,
    performance: CreatorPerformance
  ): number {
    switch (metric) {
      case 'views':
        return performance.totalViews;
      case 'likes':
        return performance.totalLikes;
      case 'comments':
        return performance.totalComments;
      case 'shares':
        return performance.totalShares;
      case 'saves':
        return performance.totalSaves;
      case 'engagement_rate':
        return performance.engagementRate;
      case 'video_count':
        return performance.videoCount;
      case 'conversions':
        return performance.conversions || 0;
      default:
        return 0;
    }
  }

  /**
   * Format condition for display
   */
  private static formatCondition(
    condition: PayoutCondition,
    performance: CreatorPerformance
  ): string {
    const value = this.getMetricValue(condition.metric, performance);
    const target = condition.value;
    const metricLabel = this.getMetricLabel(condition.metric);

    return `${this.formatNumber(value)} ${metricLabel} (target: ${this.formatNumber(target)})`;
  }

  /**
   * Get human-readable metric label
   */
  private static getMetricLabel(metric: PayoutMetric): string {
    const labels: Record<PayoutMetric, string> = {
      views: 'views',
      likes: 'likes',
      comments: 'comments',
      shares: 'shares',
      saves: 'saves',
      engagement_rate: '% engagement',
      video_count: 'videos',
      total_payout: 'total payout',
      conversions: 'conversions'
    };

    return labels[metric] || metric;
  }

  /**
   * Format number for display
   */
  private static formatNumber(value: number): string {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  }

  /**
   * Calculate performance metrics from videos
   */
  static calculatePerformance(
    creatorId: string,
    videos: VideoSubmission[]
  ): CreatorPerformance {
    const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
    const totalLikes = videos.reduce((sum, v) => sum + (v.likes || 0), 0);
    const totalComments = videos.reduce((sum, v) => sum + (v.comments || 0), 0);
    const totalShares = videos.reduce((sum, v) => sum + (v.shares || 0), 0);
    const totalSaves = videos.reduce((sum, v) => sum + (v.saves || 0), 0);

    const totalEngagement = totalLikes + totalComments + totalShares + totalSaves;
    const engagementRate = totalViews > 0 
      ? (totalEngagement / totalViews) * 100 
      : 0;

    return {
      creatorId,
      videoCount: videos.length,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalSaves,
      totalEngagement,
      engagementRate,
      videos
    };
  }

  /**
   * Batch calculate payouts for multiple creators
   */
  static calculateBatchPayouts(
    assignments: Array<{
      creatorId: string;
      structure: PayoutStructure;
      performance: CreatorPerformance;
      overrides?: Record<string, any>;
    }>
  ): PayoutCalculationResult[] {
    return assignments.map(assignment =>
      this.calculateCreatorPayout(
        assignment.creatorId,
        assignment.structure,
        assignment.performance,
        assignment.overrides
      )
    );
  }

  /**
   * Create a payout record for storage in Firestore
   */
  static createPayoutRecord(
    campaignId: string,
    orgId: string,
    projectId: string,
    calculation: PayoutCalculationResult,
    periodStart: Date,
    periodEnd: Date
  ): Omit<CreatorPayoutRecord, 'id'> {
    return {
      campaignId,
      creatorId: calculation.creatorId,
      organizationId: orgId,
      projectId,
      calculatedAt: Timestamp.now(),
      periodStart: Timestamp.fromDate(periodStart),
      periodEnd: Timestamp.fromDate(periodEnd),
      totalPayout: calculation.totalPayout,
      componentBreakdown: calculation.componentBreakdown.map(comp => ({
        componentId: comp.componentId,
        componentName: comp.componentName,
        type: comp.type as any,
        amount: comp.amount,
        details: comp.details
      })),
      competitionPayouts: [], // Will be added by competition calculation
      status: 'pending'
    };
  }

  /**
   * Estimate payout (for UI preview before performance data is available)
   */
  static estimatePayout(
    structure: PayoutStructure,
    estimatedMetrics: Partial<CreatorPerformance>
  ): number {
    const performance: CreatorPerformance = {
      creatorId: 'preview',
      videoCount: estimatedMetrics.videoCount || 10,
      totalViews: estimatedMetrics.totalViews || 100000,
      totalLikes: estimatedMetrics.totalLikes || 5000,
      totalComments: estimatedMetrics.totalComments || 500,
      totalShares: estimatedMetrics.totalShares || 200,
      totalSaves: estimatedMetrics.totalSaves || 1000,
      totalEngagement: estimatedMetrics.totalEngagement || 6700,
      engagementRate: estimatedMetrics.engagementRate || 6.7,
      videos: []
    };

    const result = this.calculateCreatorPayout(
      'preview',
      structure,
      performance
    );

    return result.totalPayout;
  }
}

