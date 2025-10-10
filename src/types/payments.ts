import { Timestamp } from 'firebase/firestore';

/**
 * Payment Component Types (can be combined in a single tier)
 */
export type PaymentComponentType =
  | 'flat_fee'        // Fixed $ per video
  | 'cpm'             // $ per 1000 views
  | 'per_view'        // $ per view
  | 'per_engagement'  // $ per like/comment/share
  | 'bonus';          // One-time bonus

/**
 * Single Payment Component (building block)
 */
export interface PaymentComponent {
  id: string;
  type: PaymentComponentType;
  amount: number; // Rate or fixed amount
  
  // Conditions for this component
  minViews?: number; // Only applies after X views
  maxViews?: number; // Only applies up to X views
  
  // Human-readable label
  label?: string;
}

/**
 * Payment Tier - A stage in the payment structure
 * Can contain multiple components (e.g., base + CPM)
 */
export interface PaymentTier {
  id: string;
  order: number;
  
  // Human-readable description
  label: string; // e.g., "Per Video Payment"
  description?: string; // Detailed explanation
  
  // Payment components in this tier
  components: PaymentComponent[];
  
  // When this tier applies
  appliesTo: 'per_video' | 'per_campaign' | 'milestone';
  
  // Milestone conditions (if appliesTo === 'milestone')
  milestoneCondition?: {
    type: 'views' | 'videos' | 'time' | 'engagement';
    threshold: number;
  };
  
  // Status tracking
  isPaid: boolean;
  paidAt?: Timestamp;
  paidAmount?: number;
  notes?: string;
}

/**
 * Complete Tiered Payment Structure
 */
export interface TieredPaymentStructure {
  id: string;
  name: string; // Contract name
  currency: string; // e.g., 'USD'
  
  // Payment tiers
  tiers: PaymentTier[];
  
  // Contract dates
  startDate?: Timestamp;
  endDate?: Timestamp;
  
  // Status
  isActive: boolean;
  totalPaid: number; // Running total of paid amounts
  
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
  example: string; // Example calculation
  tiers: Omit<PaymentTier, 'id' | 'isPaid' | 'paidAt' | 'paidAmount'>[];
}

/**
 * Pre-defined templates
 */
export const PAYMENT_TIER_TEMPLATES: PaymentTierTemplate[] = [
  {
    id: 'flat_fee_simple',
    name: 'Flat Fee Per Video',
    description: 'Simple flat payment per video delivered',
    icon: '💵',
    example: 'A video would earn $250',
    tiers: [
      {
        order: 0,
        label: 'Per Video Payment',
        description: 'Flat fee per video',
        appliesTo: 'per_video',
        components: [
          {
            id: 'comp-1',
            type: 'flat_fee',
            amount: 250,
            label: '$250 per video'
          }
        ],
        isPaid: false
      }
    ]
  },
  {
    id: 'base_plus_cpm',
    name: 'Base + CPM After Threshold',
    description: 'Base payment + CPM after views threshold',
    icon: '📈',
    example: 'A video with 1M views: $250 + $10,000 = $10,250',
    tiers: [
      {
        order: 0,
        label: 'Per Video Payment',
        description: 'Base payment plus CPM after 20K views',
        appliesTo: 'per_video',
        components: [
          {
            id: 'comp-1',
            type: 'flat_fee',
            amount: 250,
            label: '$250 base per video'
          },
          {
            id: 'comp-2',
            type: 'cpm',
            amount: 10,
            minViews: 20000,
            label: '$10 CPM after 20K views'
          }
        ],
        isPaid: false
      }
    ]
  },
  {
    id: 'performance_tiers',
    name: 'Performance Tiers',
    description: 'Different rates based on view ranges',
    icon: '🎯',
    example: 'A video with 1M views: $250 + $500 + $1,000 = $1,750',
    tiers: [
      {
        order: 0,
        label: 'Base Payment',
        description: 'Paid per video delivered',
        appliesTo: 'per_video',
        components: [
          {
            id: 'comp-1',
            type: 'flat_fee',
            amount: 250,
            label: '$250 base'
          }
        ],
        isPaid: false
      },
      {
        order: 1,
        label: 'Bronze Tier Bonus',
        description: 'Bonus for reaching 100K views',
        appliesTo: 'milestone',
        milestoneCondition: {
          type: 'views',
          threshold: 100000
        },
        components: [
          {
            id: 'comp-2',
            type: 'bonus',
            amount: 500,
            label: '$500 at 100K views'
          }
        ],
        isPaid: false
      },
      {
        order: 2,
        label: 'Gold Tier Bonus',
        description: 'Bonus for reaching 1M views',
        appliesTo: 'milestone',
        milestoneCondition: {
          type: 'views',
          threshold: 1000000
        },
        components: [
          {
            id: 'comp-3',
            type: 'bonus',
            amount: 1000,
            label: '$1,000 at 1M views'
          }
        ],
        isPaid: false
      }
    ]
  },
  {
    id: 'custom',
    name: 'Start From Scratch',
    description: 'Build your own payment structure',
    icon: '⚡',
    example: '',
    tiers: []
  }
];

