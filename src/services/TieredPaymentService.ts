import { PaymentComponent, TieredPaymentStructure } from '../types/payments';
import { Timestamp } from 'firebase/firestore';

/**
 * TieredPaymentService
 * Handles calculations for component-based tiered payment structures
 */
class TieredPaymentService {
  /**
   * Calculate earnings for a single video based on payment structure
   */
  static calculateVideoEarnings(
    structure: TieredPaymentStructure,
    videoViews: number,
    videoEngagement?: number
  ): {
    total: number;
    breakdown: { label: string; amount: number }[];
  } {
    let total = 0;
    const breakdown: { label: string; amount: number }[] = [];

    structure.tiers.forEach(tier => {
      if (tier.appliesTo === 'per_video') {
        tier.components.forEach(comp => {
          const amount = this.calculateComponentAmount(comp, videoViews, videoEngagement);
          if (amount > 0) {
            total += amount;
            breakdown.push({
              label: comp.label || this.generateComponentLabel(comp),
              amount
            });
          }
        });
      }
    });

    return { total, breakdown };
  }

  /**
   * Calculate milestone bonuses earned
   */
  static calculateMilestoneBonuses(
    structure: TieredPaymentStructure,
    totalViews: number,
    totalVideos: number,
    daysElapsed: number,
    totalEngagement?: number
  ): {
    total: number;
    breakdown: { label: string; amount: number; achieved: boolean }[];
  } {
    let total = 0;
    const breakdown: { label: string; amount: number; achieved: boolean }[] = [];

    structure.tiers.forEach(tier => {
      if (tier.appliesTo === 'milestone' && tier.milestoneCondition) {
        const achieved = this.isMilestoneAchieved(
          tier.milestoneCondition,
          totalViews,
          totalVideos,
          daysElapsed,
          totalEngagement
        );

        if (achieved && !tier.isPaid) {
          tier.components.forEach(comp => {
            const amount = comp.amount;
            total += amount;
            breakdown.push({
              label: tier.label,
              amount,
              achieved: true
            });
          });
        } else if (!achieved) {
          tier.components.forEach(comp => {
            breakdown.push({
              label: tier.label,
              amount: comp.amount,
              achieved: false
            });
          });
        }
      }
    });

    return { total, breakdown };
  }

  /**
   * Calculate amount for a single payment component
   */
  private static calculateComponentAmount(
    component: PaymentComponent,
    views: number,
    engagement?: number
  ): number {
    switch (component.type) {
      case 'flat_fee':
        return component.amount;

      case 'cpm':
        if (component.minViews && views < component.minViews) return 0;
        const eligibleViews = component.minViews ? views - component.minViews : views;
        const maxViews = component.maxViews ? Math.min(eligibleViews, component.maxViews - (component.minViews || 0)) : eligibleViews;
        const cpmAmount = (maxViews / 1000) * component.amount;
        // Apply cap if maxAmount is set
        return component.maxAmount ? Math.min(cpmAmount, component.maxAmount) : cpmAmount;

      case 'per_view':
        if (component.minViews && views < component.minViews) return 0;
        const countableViews = component.minViews ? views - component.minViews : views;
        const limitedViews = component.maxViews ? Math.min(countableViews, component.maxViews - (component.minViews || 0)) : countableViews;
        return limitedViews * component.amount;

      case 'per_engagement':
        return (engagement || 0) * component.amount;

      case 'bonus':
        return component.amount;

      default:
        return 0;
    }
  }

  /**
   * Check if milestone is achieved
   */
  private static isMilestoneAchieved(
    condition: { type: 'views' | 'videos' | 'time' | 'engagement'; threshold: number },
    totalViews: number,
    totalVideos: number,
    daysElapsed: number,
    totalEngagement?: number
  ): boolean {
    switch (condition.type) {
      case 'views':
        return totalViews >= condition.threshold;
      case 'videos':
        return totalVideos >= condition.threshold;
      case 'time':
        return daysElapsed >= condition.threshold;
      case 'engagement':
        return (totalEngagement || 0) >= condition.threshold;
      default:
        return false;
    }
  }

  /**
   * Generate human-readable label for component
   */
  private static generateComponentLabel(component: PaymentComponent): string {
    switch (component.type) {
      case 'flat_fee':
        return `$${component.amount} base`;
      case 'cpm':
        let label = `$${component.amount} CPM`;
        if (component.minViews) {
          label += ` after ${(component.minViews / 1000).toFixed(0)}K views`;
        }
        return label;
      case 'per_view':
        return `$${component.amount} per view`;
      case 'per_engagement':
        return `$${component.amount} per engagement`;
      case 'bonus':
        return `$${component.amount} bonus`;
      default:
        return '';
    }
  }

  /**
   * Generate human-readable description of entire payment structure
   */
  static generateDescription(structure: TieredPaymentStructure): string {
    const parts: string[] = [];

    structure.tiers.forEach(tier => {
      const componentDescs = tier.components.map(comp => 
        this.generateComponentLabel(comp)
      );

      if (tier.appliesTo === 'per_video') {
        parts.push(`${componentDescs.join(' + ')} per video`);
      } else if (tier.appliesTo === 'milestone' && tier.milestoneCondition) {
        const threshold = tier.milestoneCondition.threshold;
        const thresholdStr = threshold >= 1000 
          ? `${(threshold / 1000).toFixed(0)}K` 
          : threshold.toString();
        parts.push(`${componentDescs.join(' + ')} at ${thresholdStr} ${tier.milestoneCondition.type}`);
      } else if (tier.appliesTo === 'per_campaign') {
        parts.push(`${componentDescs.join(' + ')} per campaign`);
      }
    });

    return parts.join('; ');
  }

  /**
   * Mark a milestone tier as paid
   */
  static markTierAsPaid(
    structure: TieredPaymentStructure,
    tierId: string,
    paidAmount: number,
    notes?: string
  ): TieredPaymentStructure {
    const updatedTiers = structure.tiers.map(tier => {
      if (tier.id === tierId) {
        return {
          ...tier,
          isPaid: true,
          paidAt: Timestamp.now(),
          paidAmount,
          notes: notes || tier.notes
        };
      }
      return tier;
    });

    const totalPaid = updatedTiers
      .filter(t => t.isPaid)
      .reduce((sum, t) => sum + (t.paidAmount || 0), 0);

    return {
      ...structure,
      tiers: updatedTiers,
      totalPaid,
      updatedAt: Timestamp.now()
    };
  }

  /**
   * Validate payment structure
   */
  static validate(structure: TieredPaymentStructure): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if there are any tiers
    if (structure.tiers.length === 0) {
      warnings.push('No payment tiers defined');
    }

    // Check individual tiers
    structure.tiers.forEach((tier, index) => {
      if (!tier.label || tier.label.trim() === '') {
        warnings.push(`Tier ${index + 1} has no label`);
      }

      if (tier.components.length === 0) {
        warnings.push(`Tier "${tier.label}" has no payment components`);
      }

      // Check milestone conditions
      if (tier.appliesTo === 'milestone' && !tier.milestoneCondition) {
        errors.push(`Tier "${tier.label}" is a milestone but has no condition set`);
      }

      // Check components
      tier.components.forEach((comp, ci) => {
        if (comp.amount <= 0) {
          errors.push(`Tier "${tier.label}" component ${ci + 1} has invalid amount`);
        }

        if (comp.type === 'cpm' && comp.minViews && comp.minViews < 0) {
          errors.push(`Tier "${tier.label}" has invalid minViews condition`);
        }
      });
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get summary statistics
   */
  static getSummary(structure: TieredPaymentStructure): {
    totalTiers: number;
    perVideoTiers: number;
    milestoneTiers: number;
    paidTiers: number;
    hasValidStructure: boolean;
  } {
    const totalTiers = structure.tiers.length;
    const perVideoTiers = structure.tiers.filter(t => t.appliesTo === 'per_video').length;
    const milestoneTiers = structure.tiers.filter(t => t.appliesTo === 'milestone').length;
    const paidTiers = structure.tiers.filter(t => t.isPaid).length;
    const validation = this.validate(structure);

    return {
      totalTiers,
      perVideoTiers,
      milestoneTiers,
      paidTiers,
      hasValidStructure: validation.isValid
    };
  }
}

export default TieredPaymentService;
