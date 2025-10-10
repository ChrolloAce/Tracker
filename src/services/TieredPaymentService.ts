import { PaymentTier, TieredPaymentStructure } from '../types/payments';
import { Timestamp } from 'firebase/firestore';

/**
 * TieredPaymentService
 * Handles calculations and status updates for tiered payment structures
 */
class TieredPaymentService {
  /**
   * Calculate the dollar amount for a specific tier
   */
  static calculateTierAmount(tier: PaymentTier, totalAmount: number): number {
    if (tier.amountType === 'percentage') {
      return (totalAmount * tier.amount) / 100;
    }
    return tier.amount;
  }

  /**
   * Calculate total allocated amount across all tiers
   */
  static calculateTotalAllocated(structure: TieredPaymentStructure): {
    totalPercentage: number;
    totalDollars: number;
    remainingPercentage: number;
    remainingDollars: number;
  } {
    let totalPercentage = 0;
    let totalDollars = 0;

    structure.tiers.forEach(tier => {
      if (tier.amountType === 'percentage') {
        totalPercentage += tier.amount;
        totalDollars += this.calculateTierAmount(tier, structure.totalAmount);
      } else {
        totalDollars += tier.amount;
      }
    });

    return {
      totalPercentage,
      totalDollars,
      remainingPercentage: 100 - totalPercentage,
      remainingDollars: structure.totalAmount - totalDollars
    };
  }

  /**
   * Check if a tier's conditions are met
   */
  static isTierConditionMet(
    tier: PaymentTier,
    metrics: {
      totalViews?: number;
      totalEngagement?: number;
      videoCount?: number;
      daysElapsed?: number;
      contractCompleted?: boolean;
    }
  ): boolean {
    switch (tier.type) {
      case 'upfront':
        // Upfront is always immediately available
        return true;

      case 'on_delivery':
        return (metrics.videoCount || 0) >= (tier.videosRequired || 1);

      case 'view_milestone':
        return (metrics.totalViews || 0) >= (tier.viewsRequired || 0);

      case 'engagement_milestone':
        return (metrics.totalEngagement || 0) >= (tier.engagementRequired || 0);

      case 'time_based':
        return (metrics.daysElapsed || 0) >= (tier.daysAfterStart || 0);

      case 'completion':
        return metrics.contractCompleted || false;

      case 'custom':
        // Custom conditions need manual approval
        return false;

      default:
        return false;
    }
  }

  /**
   * Get all tiers that are ready for payment
   */
  static getEligibleTiers(
    structure: TieredPaymentStructure,
    metrics: {
      totalViews?: number;
      totalEngagement?: number;
      videoCount?: number;
      daysElapsed?: number;
      contractCompleted?: boolean;
    }
  ): PaymentTier[] {
    return structure.tiers.filter(
      tier => !tier.isPaid && this.isTierConditionMet(tier, metrics)
    );
  }

  /**
   * Calculate earnings breakdown for a creator with tiered structure
   */
  static calculateEarnings(
    structure: TieredPaymentStructure,
    metrics: {
      totalViews?: number;
      totalEngagement?: number;
      videoCount?: number;
      daysElapsed?: number;
      contractCompleted?: boolean;
    }
  ): {
    totalEarned: number;
    totalPending: number;
    totalRemaining: number;
    breakdown: {
      tierId: string;
      tierLabel: string;
      amount: number;
      status: 'paid' | 'eligible' | 'pending';
      conditionMet: boolean;
    }[];
  } {
    let totalEarned = 0;
    let totalPending = 0;
    let totalRemaining = 0;

    const breakdown = structure.tiers.map(tier => {
      const amount = this.calculateTierAmount(tier, structure.totalAmount);
      const conditionMet = this.isTierConditionMet(tier, metrics);
      
      let status: 'paid' | 'eligible' | 'pending';
      if (tier.isPaid) {
        status = 'paid';
        totalEarned += amount;
      } else if (conditionMet) {
        status = 'eligible';
        totalPending += amount;
      } else {
        status = 'pending';
        totalRemaining += amount;
      }

      return {
        tierId: tier.id,
        tierLabel: tier.label,
        amount,
        status,
        conditionMet
      };
    });

    return {
      totalEarned,
      totalPending,
      totalRemaining,
      breakdown
    };
  }

  /**
   * Mark a tier as paid
   */
  static markTierAsPaid(
    structure: TieredPaymentStructure,
    tierId: string,
    paidAmount?: number,
    notes?: string
  ): TieredPaymentStructure {
    const updatedTiers = structure.tiers.map(tier => {
      if (tier.id === tierId) {
        const amount = paidAmount || this.calculateTierAmount(tier, structure.totalAmount);
        return {
          ...tier,
          isPaid: true,
          paidAt: Timestamp.now(),
          paidAmount: amount,
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
      remainingBalance: structure.totalAmount - totalPaid,
      updatedAt: Timestamp.now()
    };
  }

  /**
   * Get a summary of the payment structure
   */
  static getSummary(structure: TieredPaymentStructure): {
    totalTiers: number;
    paidTiers: number;
    eligibleTiers: number;
    pendingTiers: number;
    completionPercentage: number;
    isComplete: boolean;
  } {
    const totalTiers = structure.tiers.length;
    const paidTiers = structure.tiers.filter(t => t.isPaid).length;
    const completionPercentage = totalTiers > 0 ? (paidTiers / totalTiers) * 100 : 0;
    const isComplete = paidTiers === totalTiers && totalTiers > 0;

    return {
      totalTiers,
      paidTiers,
      eligibleTiers: 0, // Will be calculated with metrics
      pendingTiers: totalTiers - paidTiers,
      completionPercentage,
      isComplete
    };
  }

  /**
   * Generate a human-readable description of the payment structure
   */
  static generateDescription(structure: TieredPaymentStructure): string {
    const parts: string[] = [];

    const sortedTiers = [...structure.tiers].sort((a, b) => a.order - b.order);

    sortedTiers.forEach(tier => {
      const amount = this.calculateTierAmount(tier, structure.totalAmount);
      let condition = '';

      switch (tier.type) {
        case 'upfront':
          condition = 'upfront';
          break;
        case 'on_delivery':
          condition = `on delivery${tier.videosRequired ? ` of ${tier.videosRequired} video${tier.videosRequired !== 1 ? 's' : ''}` : ''}`;
          break;
        case 'view_milestone':
          condition = `after ${(tier.viewsRequired || 0).toLocaleString()} views`;
          break;
        case 'engagement_milestone':
          condition = `after ${(tier.engagementRequired || 0).toLocaleString()} total engagement`;
          break;
        case 'time_based':
          condition = `${tier.daysAfterStart} days after start`;
          break;
        case 'completion':
          condition = 'on completion';
          break;
        case 'custom':
          condition = tier.description || 'custom milestone';
          break;
      }

      parts.push(`$${amount.toLocaleString()} ${condition}`);
    });

    return parts.join(', ');
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

    // Check total amount
    if (structure.totalAmount <= 0) {
      errors.push('Total contract amount must be greater than 0');
    }

    // Check if there are any tiers
    if (structure.tiers.length === 0) {
      warnings.push('No payment tiers defined');
    }

    // Calculate allocation
    const allocation = this.calculateTotalAllocated(structure);

    // Check for over-allocation
    if (allocation.totalDollars > structure.totalAmount) {
      errors.push(`Total tier amounts ($${allocation.totalDollars.toLocaleString()}) exceed contract total ($${structure.totalAmount.toLocaleString()})`);
    }

    // Check for under-allocation (warning only)
    if (allocation.totalDollars < structure.totalAmount && structure.tiers.length > 0) {
      const diff = structure.totalAmount - allocation.totalDollars;
      warnings.push(`$${diff.toLocaleString()} unallocated in payment tiers`);
    }

    // Check percentage allocation
    const hasPercentages = structure.tiers.some(t => t.amountType === 'percentage');
    if (hasPercentages && allocation.totalPercentage > 100) {
      errors.push(`Percentage allocation exceeds 100% (${allocation.totalPercentage.toFixed(0)}%)`);
    }

    // Check individual tiers
    structure.tiers.forEach((tier, index) => {
      if (!tier.label || tier.label.trim() === '') {
        warnings.push(`Tier ${index + 1} has no label`);
      }

      if (tier.amount <= 0) {
        errors.push(`Tier "${tier.label}" has invalid amount`);
      }

      // Check type-specific validations
      if (tier.type === 'view_milestone' && !tier.viewsRequired) {
        errors.push(`Tier "${tier.label}" requires view threshold`);
      }

      if (tier.type === 'engagement_milestone' && !tier.engagementRequired) {
        errors.push(`Tier "${tier.label}" requires engagement threshold`);
      }

      if (tier.type === 'on_delivery' && !tier.videosRequired) {
        warnings.push(`Tier "${tier.label}" has no video count specified`);
      }

      if (tier.type === 'time_based' && !tier.daysAfterStart) {
        errors.push(`Tier "${tier.label}" requires days specification`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export default TieredPaymentService;

