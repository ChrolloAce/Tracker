/**
 * Subscription and billing types
 */

export type PlanTier = 'free' | 'basic' | 'pro' | 'ultra' | 'enterprise';

export interface SubscriptionPlan {
  id: PlanTier;
  name: string;
  displayName: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  stripePriceIdMonthly: string;
  stripePriceIdYearly: string;
  features: {
    // Team & Collaboration
    teamSeats: number;
    flexibleSeats: boolean;
    
    // Account Tracking
    maxAccounts: number; // -1 for unlimited
    
    // Video Tracking
    maxVideos: number;
    
    // Data & Refresh
    dataRefreshHours: number; // 24, 12, 6, etc.
    refreshOnDemand: boolean;
    
    // API & Integration
    mcpCallsPerMonth: number;
    appStoreIntegration: boolean;
    
    // Advanced Features
    manageCreators: boolean;
    customBranding: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
    
    // Link Tracking
    maxLinks: number; // -1 for unlimited
    customDomain: boolean;
  };
  recommended?: boolean;
}

export interface OrganizationSubscription {
  id: string;
  orgId: string;
  
  // Plan details
  planTier: PlanTier;
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';
  
  // Stripe details
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  
  // Billing
  billingCycle: 'monthly' | 'yearly';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  
  // Trial
  trialEnd?: Date;
  
  // Usage tracking
  usage: {
    accounts: number;
    videos: number;
    teamMembers: number;
    mcpCalls: number;
    links: number;
    lastReset: Date;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageLimit {
  current: number;
  limit: number; // -1 for unlimited
  percentage: number;
  isOverLimit: boolean;
}

export interface PlanLimits {
  accounts: UsageLimit;
  videos: UsageLimit;
  teamSeats: UsageLimit;
  mcpCalls: UsageLimit;
  links: UsageLimit;
}

/**
 * Plan configurations
 */
export const SUBSCRIPTION_PLANS: Record<PlanTier, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    displayName: 'Free',
    description: 'Get started for free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    stripePriceIdMonthly: 'free',
    stripePriceIdYearly: 'free',
    features: {
      teamSeats: 1,
      flexibleSeats: false,
      maxAccounts: -1, // unlimited
      maxVideos: 5,
      dataRefreshHours: 48,
      refreshOnDemand: false,
      mcpCallsPerMonth: 10,
      appStoreIntegration: false,
      manageCreators: false,
      customBranding: false,
      prioritySupport: false,
      apiAccess: false,
      maxLinks: 1,
      customDomain: false,
    },
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    displayName: 'Basic',
    description: 'Indie Hackers',
    monthlyPrice: 24.99,
    yearlyPrice: 19.99, // 20% discount
    stripePriceIdMonthly: process.env.VITE_STRIPE_BASIC_MONTHLY || 'price_basic_monthly',
    stripePriceIdYearly: process.env.VITE_STRIPE_BASIC_YEARLY || 'price_basic_yearly',
    features: {
      teamSeats: 1,
      flexibleSeats: false,
      maxAccounts: -1, // unlimited
      maxVideos: 150,
      dataRefreshHours: 24,
      refreshOnDemand: false,
      mcpCallsPerMonth: 100,
      appStoreIntegration: false,
      manageCreators: false,
      customBranding: false,
      prioritySupport: false,
      apiAccess: false,
      maxLinks: 10,
      customDomain: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    displayName: 'Pro',
    description: 'Small Projects',
    monthlyPrice: 79.99,
    yearlyPrice: 63.99, // 20% discount
    stripePriceIdMonthly: process.env.VITE_STRIPE_PRO_MONTHLY || 'price_pro_monthly',
    stripePriceIdYearly: process.env.VITE_STRIPE_PRO_YEARLY || 'price_pro_yearly',
    recommended: true,
    features: {
      teamSeats: 1,
      flexibleSeats: true,
      maxAccounts: -1, // unlimited
      maxVideos: 1000,
      dataRefreshHours: 24,
      refreshOnDemand: false,
      mcpCallsPerMonth: 1000,
      appStoreIntegration: true,
      manageCreators: false,
      customBranding: false,
      prioritySupport: false,
      apiAccess: false,
      maxLinks: 100,
      customDomain: false,
    },
  },
  ultra: {
    id: 'ultra',
    name: 'Ultra',
    displayName: 'Ultra',
    description: 'Growing Businesses',
    monthlyPrice: 199.99,
    yearlyPrice: 159.99, // 20% discount
    stripePriceIdMonthly: process.env.VITE_STRIPE_ULTRA_MONTHLY || 'price_ultra_monthly',
    stripePriceIdYearly: process.env.VITE_STRIPE_ULTRA_YEARLY || 'price_ultra_yearly',
    features: {
      teamSeats: 20,
      flexibleSeats: true,
      maxAccounts: -1, // unlimited
      maxVideos: 5000,
      dataRefreshHours: 12,
      refreshOnDemand: true,
      mcpCallsPerMonth: 1000,
      appStoreIntegration: true,
      manageCreators: true,
      customBranding: true,
      prioritySupport: true,
      apiAccess: false,
      maxLinks: -1, // unlimited
      customDomain: true,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    displayName: 'Enterprise',
    description: 'App Studios & Agencies',
    monthlyPrice: 0, // Custom pricing
    yearlyPrice: 0,
    stripePriceIdMonthly: 'contact',
    stripePriceIdYearly: 'contact',
    features: {
      teamSeats: -1, // unlimited
      flexibleSeats: true,
      maxAccounts: -1,
      maxVideos: -1,
      dataRefreshHours: 6,
      refreshOnDemand: true,
      mcpCallsPerMonth: -1,
      appStoreIntegration: true,
      manageCreators: true,
      customBranding: true,
      prioritySupport: true,
      apiAccess: true,
      maxLinks: -1,
      customDomain: true,
    },
  },
};

