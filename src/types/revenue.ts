/**
 * Revenue tracking types for RevenueCat and Superwall integrations
 */

export type RevenueProvider = 'revenuecat' | 'superwall' | 'stripe' | 'apple' | 'manual';

export type RevenuePlatform = 'ios' | 'android' | 'web' | 'stripe' | 'other';

export type SubscriptionPeriod = 'monthly' | 'yearly' | 'lifetime' | 'trial';

/**
 * Revenue integration credentials stored in Firestore
 */
export interface RevenueIntegration {
  id: string;
  organizationId: string;
  projectId: string;
  provider: RevenueProvider;
  enabled: boolean;
  credentials: {
    apiKey?: string; // RevenueCat API Key / Superwall API Key / Apple Private Key (encrypted .p8)
    appId?: string; // Superwall App ID / RevenueCat Project ID / Apple Bundle ID
    secretKey?: string; // For server-side integrations
    keyId?: string; // Apple App Store Connect Key ID
    issuerId?: string; // Apple App Store Connect Issuer ID
    vendorNumber?: string; // Apple App Store Connect Vendor Number (8 digits)
  };
  settings?: {
    autoSync?: boolean;
    syncInterval?: number; // Minutes
    currency?: string;
    timezone?: string;
  };
  lastSynced?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Individual revenue transaction
 */
export interface RevenueTransaction {
  id: string;
  organizationId: string;
  projectId: string;
  provider: RevenueProvider;
  platform: RevenuePlatform;
  
  // Transaction details
  transactionId: string; // External transaction ID
  customerId?: string;
  customerEmail?: string;
  
  // Revenue data
  amount: number; // In cents
  currency: string;
  netAmount?: number; // After platform fees
  
  // Product info
  productId: string;
  productName?: string;
  subscriptionPeriod?: SubscriptionPeriod;
  
  // App info (for multi-app tracking)
  appBundleId?: string;      // e.g., "com.trackview.ios"
  appName?: string;          // e.g., "TrackView"
  appAppleId?: string;       // e.g., "1234567890"
  appIcon?: string;          // URL or path to app icon
  
  // Timing
  purchaseDate: Date;
  expirationDate?: Date;
  refundDate?: Date;
  
  // Status
  type: 'purchase' | 'renewal' | 'refund' | 'trial' | 'upgrade' | 'downgrade';
  status: 'active' | 'expired' | 'refunded' | 'cancelled';
  isRenewal: boolean;
  isTrial: boolean;
  
  // Attribution (link to video/creator performance)
  attributedVideoId?: string;
  attributedCreatorHandle?: string;
  attributedCampaignId?: string;
  
  // Metadata
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Aggregated revenue metrics (similar to video metrics)
 */
export interface RevenueMetrics {
  organizationId: string;
  projectId: string;
  
  // Time period
  startDate: Date;
  endDate: Date;
  
  // Core metrics
  totalRevenue: number; // In cents
  netRevenue: number;
  refunds: number;
  activeSubscriptions: number;
  newSubscriptions: number;
  churnedSubscriptions: number;
  trialConversions: number;
  
  // Averages
  averageRevenuePerUser: number; // ARPU
  averageRevenuePerPurchase: number;
  
  // Growth
  mrr: number; // Monthly Recurring Revenue
  arr?: number; // Annual Recurring Revenue
  
  // Platform breakdown
  revenueByPlatform: {
    ios: number;
    android: number;
    web: number;
    other: number;
  };
  
  // Product breakdown
  revenueByProduct: Array<{
    productId: string;
    productName: string;
    revenue: number;
    count: number;
  }>;
  
  // Previous period comparison
  previousPeriodRevenue?: number;
  revenueGrowth?: number; // Percentage
  
  // Daily metrics for charting (Apple only)
  dailyMetrics?: Array<{
    date: Date;
    revenue: number; // In cents
    downloads: number;
    revenueByApp?: Array<{
      appBundleId: string;
      appName: string;
      appIcon?: string;
      revenue: number;
      downloads: number;
    }>;
  }>;
  
  // Revenue breakdown by app
  revenueByApp?: Array<{
    appBundleId: string;
    appName: string;
    appIcon?: string;
    appAppleId?: string;
    revenue: number;
    downloads: number;
    activeSubscriptions: number;
  }>;
  
  calculatedAt: Date;
}

/**
 * Revenue snapshot for time series data (like VideoSnapshot)
 */
export interface RevenueSnapshot {
  id: string;
  organizationId: string;
  projectId: string;
  
  // Snapshot timing
  snapshotDate: Date;
  period: 'daily' | 'weekly' | 'monthly';
  
  // Metrics at this point in time
  totalRevenue: number;
  mrr: number;
  activeSubscriptions: number;
  newSubscriptions: number;
  churnedSubscriptions: number;
  
  // Metadata
  capturedBy: 'scheduled_sync' | 'manual_refresh' | 'api_sync';
  createdAt: Date;
}

/**
 * Revenue attribution - link revenue to content performance
 */
export interface RevenueAttribution {
  id: string;
  organizationId: string;
  projectId: string;
  
  // Attribution targets
  videoId?: string;
  creatorHandle?: string;
  campaignId?: string;
  trackedLinkId?: string;
  
  // Revenue data
  totalRevenue: number;
  transactionCount: number;
  conversionRate: number; // Percentage
  
  // Time period
  startDate: Date;
  endDate: Date;
  
  // Calculated metrics
  revenuePerView?: number;
  revenuePerClick?: number;
  roi?: number; // Return on investment
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Superwall specific types
 */
export interface SuperwallPaywall {
  id: string;
  name: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
}

export interface SuperwallExperiment {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  variants: Array<{
    id: string;
    name: string;
    impressions: number;
    conversions: number;
    revenue: number;
  }>;
}

/**
 * RevenueCat specific types
 */
export interface RevenueCatSubscriber {
  id: string;
  customerId: string;
  email?: string;
  firstSeen: Date;
  lastSeen: Date;
  activeSubscriptions: string[];
  lifetimeRevenue: number;
  mrr: number;
}

export interface RevenueCatProduct {
  id: string;
  name: string;
  type: 'subscription' | 'one-time';
  price: number;
  currency: string;
  period?: SubscriptionPeriod;
  activeSubscribers: number;
  mrr: number;
}

/**
 * Apple App Store specific types
 */
export interface AppleSubscription {
  originalTransactionId: string;
  productId: string;
  purchaseDate: Date;
  expiresDate?: Date;
  autoRenewStatus?: boolean;
  autoRenewProductId?: string;
  isInBillingRetryPeriod?: boolean;
  isInTrialPeriod?: boolean;
  isInIntroOfferPeriod?: boolean;
  subscriptionGroupId?: string;
  status: 'active' | 'expired' | 'in_billing_retry' | 'billing_issue' | 'refunded' | 'revoked';
}

export interface AppleTransaction {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  purchaseDate: Date;
  expiresDate?: Date;
  quantity: number;
  type: 'auto-renewable-subscription' | 'non-consumable' | 'consumable' | 'non-renewing-subscription';
  price?: number;
  currency?: string;
  subscriptionGroupId?: string;
  webOrderLineItemId?: string;
  isUpgraded?: boolean;
  revocationDate?: Date;
  revocationReason?: string;
  offerType?: 'introductory' | 'promotional' | 'offer-code';
}

export interface AppleNotificationPayload {
  notificationType: string;
  subtype?: string;
  data: {
    appAppleId: number;
    bundleId: string;
    bundleVersion?: string;
    environment: 'Sandbox' | 'Production';
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
}

