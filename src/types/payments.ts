import { Timestamp } from 'firebase/firestore';

/**
 * Payment Tier Types
 */
export type PaymentTierType =
  | 'upfront'              // Upfront payment (percentage or fixed)
  | 'on_delivery'          // On video delivery
  | 'view_milestone'       // After reaching X views
  | 'engagement_milestone' // After reaching engagement threshold
  | 'time_based'           // After X days/weeks
  | 'completion'           // Final payment on completion
  | 'custom';              // Custom milestone

/**
 * Payment Tier Condition Type
 */
export type TierConditionType = 'percentage' | 'fixed_amount';

/**
 * Single Payment Tier/Stage
 */
export interface PaymentTier {
  id: string;
  type: PaymentTierType;
  order: number; // Order in which tiers are displayed
  
  // Amount configuration
  amountType: TierConditionType; // 'percentage' or 'fixed_amount'
  amount: number; // Dollar amount or percentage
  
  // Condition/Trigger
  label: string; // Display label (e.g., "Upfront", "After 10K Views")
  description?: string; // Additional description
  
  // Milestone-specific conditions
  viewsRequired?: number; // For view_milestone
  engagementRequired?: number; // For engagement_milestone (likes + comments)
  videosRequired?: number; // For on_delivery
  daysAfterStart?: number; // For time_based
  
  // Status tracking
  isPaid: boolean;
  paidAt?: Timestamp;
  paidAmount?: number; // Actual amount paid (useful for percentage-based)
  notes?: string;
}

/**
 * Complete Tiered Payment Structure
 */
export interface TieredPaymentStructure {
  id: string;
  name: string; // Contract name
  totalAmount: number; // Total contract amount in dollars
  currency: string; // e.g., 'USD'
  
  // Payment tiers/stages
  tiers: PaymentTier[];
  
  // Contract dates
  startDate?: Timestamp;
  endDate?: Timestamp;
  
  // Status
  isActive: boolean;
  totalPaid: number; // Running total of paid amounts
  remainingBalance: number; // Calculated field
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  notes?: string;
}

/**
 * Payment Tier Template for quick setup
 */
export interface PaymentTierTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  tiers: Omit<PaymentTier, 'id' | 'isPaid' | 'paidAt' | 'paidAmount'>[];
}

/**
 * Pre-defined templates
 */
export const PAYMENT_TIER_TEMPLATES: PaymentTierTemplate[] = [
  {
    id: 'standard_upfront',
    name: '50% Upfront, 50% on Delivery',
    description: 'Split payment: half upfront, half when video is delivered',
    icon: '💰',
    tiers: [
      {
        type: 'upfront',
        order: 0,
        amountType: 'percentage',
        amount: 50,
        label: 'Upfront Payment',
        description: '50% paid before work begins'
      },
      {
        type: 'on_delivery',
        order: 1,
        amountType: 'percentage',
        amount: 50,
        label: 'On Delivery',
        description: '50% paid when video is delivered',
        videosRequired: 1
      }
    ]
  },
  {
    id: 'milestone_based',
    name: 'Performance-Based Milestones',
    description: 'Payment tied to view milestones',
    icon: '🎯',
    tiers: [
      {
        type: 'upfront',
        order: 0,
        amountType: 'percentage',
        amount: 20,
        label: 'Upfront Payment',
        description: '20% paid upfront'
      },
      {
        type: 'view_milestone',
        order: 1,
        amountType: 'percentage',
        amount: 30,
        label: 'After 10K Views',
        description: '30% paid after reaching 10,000 views',
        viewsRequired: 10000
      },
      {
        type: 'view_milestone',
        order: 2,
        amountType: 'percentage',
        amount: 30,
        label: 'After 50K Views',
        description: '30% paid after reaching 50,000 views',
        viewsRequired: 50000
      },
      {
        type: 'completion',
        order: 3,
        amountType: 'percentage',
        amount: 20,
        label: 'Final Payment',
        description: '20% paid on campaign completion'
      }
    ]
  },
  {
    id: 'custom_tiered',
    name: 'Custom Tiered',
    description: 'Build your own payment structure',
    icon: '⚡',
    tiers: []
  }
];

