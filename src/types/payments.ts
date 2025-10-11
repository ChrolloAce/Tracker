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
  maxAmount?: number; // Cap on total earnings from this component (useful for CPM)
  
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
  tiers: Omit<PaymentTier, 'id' | 'paidAt' | 'paidAmount'>[];
}

/**
 * Pre-defined templates
 */
export const PAYMENT_TIER_TEMPLATES: PaymentTierTemplate[] = [
  {
    id: 'flat_fee_simple',
    name: 'Flat Fee Per Video',
    description: 'Simple flat payment per video delivered',
    icon: 'DollarSign',
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
    icon: 'TrendingUp',
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
    icon: 'Target',
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
    id: 'cpm_only',
    name: 'CPM Only',
    description: 'Simple CPM-based payment with optional cap',
    icon: 'BarChart3',
    example: 'A video with 1M views: $10,000 (capped at $5,000)',
    tiers: [
      {
        order: 0,
        label: 'CPM Payment',
        description: 'Payment per 1,000 views',
        appliesTo: 'per_video',
        components: [
          {
            id: 'comp-1',
            type: 'cpm',
            amount: 10,
            maxAmount: 5000,
            label: '$10 CPM (capped at $5,000)'
          }
        ],
        isPaid: false
      }
    ]
  },
  {
    id: 'hybrid_performance',
    name: 'Hybrid Performance',
    description: 'Base + CPM + milestone bonuses for viral content',
    icon: 'Rocket',
    example: 'A video with 1M views: $250 + $10,000 + $500 + $1,000 = $11,750',
    tiers: [
      {
        order: 0,
        label: 'Base + CPM',
        description: 'Base payment plus CPM',
        appliesTo: 'per_video',
        components: [
          {
            id: 'comp-1',
            type: 'flat_fee',
            amount: 250,
            label: '$250 base'
          },
          {
            id: 'comp-2',
            type: 'cpm',
            amount: 10,
            label: '$10 CPM'
          }
        ],
        isPaid: false
      },
      {
        order: 1,
        label: 'Viral Bonus (500K)',
        description: 'Bonus for viral content',
        appliesTo: 'milestone',
        milestoneCondition: {
          type: 'views',
          threshold: 500000
        },
        components: [
          {
            id: 'comp-3',
            type: 'bonus',
            amount: 500,
            label: '$500 at 500K views'
          }
        ],
        isPaid: false
      },
      {
        order: 2,
        label: 'Mega Viral Bonus (1M)',
        description: 'Bonus for mega viral content',
        appliesTo: 'milestone',
        milestoneCondition: {
          type: 'views',
          threshold: 1000000
        },
        components: [
          {
            id: 'comp-4',
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
    id: 'tiered_cpm',
    name: 'Tiered CPM Rates',
    description: 'Increasing CPM rates based on view thresholds',
    icon: 'LineChart',
    example: 'A video with 1M views: $200 (0-10K) + $500 (10K-100K) + $9,000 (100K-1M) = $9,700',
    tiers: [
      {
        order: 0,
        label: 'Initial Views Payment',
        description: 'First 10K views at $20 CPM',
        appliesTo: 'per_video',
        components: [
          {
            id: 'comp-1',
            type: 'cpm',
            amount: 20,
            maxViews: 10000,
            label: '$20 CPM (first 10K views)'
          }
        ],
        isPaid: false
      },
      {
        order: 1,
        label: 'Growth Phase Payment',
        description: '10K-100K views at $5 CPM',
        appliesTo: 'per_video',
        components: [
          {
            id: 'comp-2',
            type: 'cpm',
            amount: 5,
            minViews: 10000,
            maxViews: 100000,
            label: '$5 CPM (10K-100K views)'
          }
        ],
        isPaid: false
      },
      {
        order: 2,
        label: 'Scale Phase Payment',
        description: 'Above 100K views at $10 CPM',
        appliesTo: 'per_video',
        components: [
          {
            id: 'comp-3',
            type: 'cpm',
            amount: 10,
            minViews: 100000,
            label: '$10 CPM (100K+ views)'
          }
        ],
        isPaid: false
      }
    ]
  }
];

