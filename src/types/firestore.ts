import { Timestamp } from 'firebase/firestore';

// ==================== ENUMS & TYPES ====================

export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'twitter';
export type Role = 'owner' | 'admin' | 'member' | 'creator';
export type MemberStatus = 'active' | 'invited' | 'removed';
export type VideoPlatform = Platform | 'file' | 'other';
export type AccountType = 'my' | 'competitor';
export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

/**
 * Payment term types for creator compensation
 */
export type PaymentTermType = 
  | 'flat_fee'
  | 'base_cpm'
  | 'base_guaranteed_views'
  | 'cpc'
  | 'cpa_cps'
  | 'revenue_share'
  | 'tiered_performance'
  | 'retainer';

/**
 * Payment due date types
 */
export type PaymentDueDateType = 
  | 'none'
  | 'fixed_date'
  | 'days_after_posted'
  | 'after_views_reached';

/**
 * Payment term preset
 */
export interface PaymentTermPreset {
  id: string;
  name: string;
  type: PaymentTermType;
  description: string;
  baseAmount?: number;
  cpmRate?: number; // Cost per 1000 views
  guaranteedViews?: number;
  cpcRate?: number; // Cost per click
  cpaRate?: number; // Cost per acquisition
  revenueSharePercentage?: number;
  tierRates?: { views: number; bonus: number }[]; // For tiered performance
  retainerAmount?: number; // Monthly retainer
  currency: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  
  // Payment due date configuration
  dueDateType?: PaymentDueDateType;
  fixedDueDate?: Timestamp; // For 'fixed_date'
  daysAfterPosted?: number; // For 'days_after_posted'
  viewsRequired?: number; // For 'after_views_reached'
}

// ==================== USER ACCOUNT ====================

/**
 * Root-level user account (one per Firebase Auth user)
 * Path: /users/{userId}
 */
export interface UserAccount {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  plan: 'free' | 'pro' | 'enterprise';
  defaultOrgId?: string; // Most recently used organization
}

// ==================== ORGANIZATIONS ====================

/**
 * Organization (workspace/project)
 * Path: /organizations/{orgId}
 */
export interface Organization {
  id: string;
  name: string;
  slug?: string; // URL-friendly identifier
  website?: string;
  logoUrl?: string;
  metadata?: Record<string, any>; // For storing additional onboarding data
  createdAt: Timestamp;
  createdBy: string; // userId
  ownerUserId: string;
  
  // Aggregated counts (updated via Cloud Functions)
  memberCount: number;
  trackedAccountCount: number;
  videoCount: number;
  linkCount: number;
  projectCount?: number;
  
  // Settings
  settings?: {
    timezone?: string;
    currency?: string;
  };
}

/**
 * Organization member
 * Path: /organizations/{orgId}/members/{userId}
 */
export interface OrgMember {
  userId: string;
  role: Role;
  joinedAt: Timestamp;
  status: MemberStatus;
  invitedBy?: string; // userId
  email?: string; // Added for display purposes
  displayName?: string; // Added for display purposes
  photoURL?: string; // Profile photo URL
  permissions?: any; // Custom permissions (TeamMemberPermissions from permissions.ts)
  lastActiveProjectId?: string; // Last active project
  creatorProjectIds?: string[]; // Projects where user is a creator (for project filtering)
}

/**
 * Team invitation
 * Path: /organizations/{orgId}/invitations/{invitationId}
 */
export interface TeamInvitation {
  id: string;
  orgId: string;
  email: string; // Email of invitee
  role: Role;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  invitedBy: string; // userId who sent invite
  invitedByName?: string; // Display name of inviter
  invitedByEmail?: string; // Email of inviter
  organizationName: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  acceptedAt?: Timestamp;
  declinedAt?: Timestamp;
  projectId?: string; // Optional: For adding creators to specific project
}

// ==================== TRACKED ACCOUNTS ====================

/**
 * Tracked social media account
 * Path: /organizations/{orgId}/trackedAccounts/{accountId}
 */
export interface TrackedAccount {
  id: string;
  orgId: string;
  
  // Account details
  platform: Platform;
  username: string;
  displayName?: string;
  profilePicture?: string;
  accountType: AccountType; // 'my' | 'competitor'
  
  // Stats
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  bio?: string;
  isVerified?: boolean;
  
  // Metadata
  dateAdded: Timestamp;
  addedBy: string; // userId
  lastSynced?: Timestamp;
  isActive: boolean;
  
  // Background sync status (for Vercel cron jobs)
  syncStatus?: 'idle' | 'pending' | 'syncing' | 'completed' | 'error';
  syncProgress?: {
    current: number;
    total: number;
    message: string;
  };
  lastSyncAt?: Timestamp;
  lastSyncError?: string;
  syncRequestedBy?: string; // userId who requested the sync
  syncRequestedAt?: Timestamp;
  syncRetryCount?: number;
  maxRetries?: number;
  
  // Aggregates (computed)
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares?: number;
  // Outlier detection
  outlierAnalysis?: {
    topPerformersCount: number;
    underperformersCount: number;
    lastCalculated: Timestamp;
  };
}

// ==================== VIDEOS ====================

/**
 * Video metrics snapshot
 */
export interface VideoMetrics {
  views: number;
  likes: number;
  comments: number;
  shares?: number;
  saves?: number;
}

/**
 * Video deltas (growth over time)
 */
export interface VideoDeltas {
  viewsDelta24h?: number;
  likesDelta24h?: number;
  commentsDelta24h?: number;
  viewsDelta7d?: number;
  likesDelta7d?: number;
  commentsDelta7d?: number;
  viewsDelta30d?: number;
  likesDelta30d?: number;
  commentsDelta30d?: number;
}

/**
 * Video document
 * Path: /organizations/{orgId}/videos/{videoId}
 */
export interface VideoDoc extends VideoMetrics, VideoDeltas {
  id: string;
  orgId: string;
  
  // Source
  platform: VideoPlatform;
  trackedAccountId?: string; // If from a tracked account
  url?: string; // Legacy field
  videoUrl?: string; // New field name
  videoId: string; // Platform-specific video ID
  
  // Content
  title?: string; // Legacy field
  videoTitle?: string; // New field name
  description?: string; // Legacy field
  caption?: string; // New field name (matches Firestore)
  thumbnail?: string;
  duration?: number;
  hashtags?: string[];
  
  // Timestamps
  uploadDate: Timestamp; // When posted on platform
  dateAdded: Timestamp; // When added to ViewTrack
  lastRefreshed?: Timestamp;
  
  // Metadata
  addedBy: string; // userId
  status: 'active' | 'archived';
  isSingular: boolean; // Not tied to tracked account
  
  // Background processing (like accounts)
  syncStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  syncRequestedBy?: string;
  syncRequestedAt?: Timestamp;
  syncCompletedAt?: Timestamp;
  syncError?: string;
  syncRetryCount?: number;
  
  // Engagement rate (computed)
  engagementRate?: number;
}

/**
 * Video refresh snapshot (historical data point)
 * Path: /organizations/{orgId}/videos/{videoId}/snapshots/{snapshotId}
 */
export interface VideoSnapshot extends VideoMetrics {
  id: string;
  videoId: string;
  capturedAt: Timestamp;
  capturedBy: string; // 'system' | userId
  
  // Optional: store raw API response
  rawData?: Record<string, any>;
}

// ==================== TRACKED LINKS ====================

/**
 * Tracked/shortened link
 * Path: /organizations/{orgId}/links/{linkId}
 */
export interface TrackedLink {
  id: string;
  orgId: string;
  
  // Link details
  shortCode: string; // For /l/{shortCode}
  originalUrl: string;
  title: string;
  description?: string;
  tags?: string[];
  
  // Analytics
  totalClicks: number;
  uniqueClicks: number;
  last7DaysClicks: number;
  
  // Associations
  linkedVideoId?: string;
  linkedAccountId?: string;
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string; // userId
  lastClickedAt?: Timestamp;
  isActive: boolean;
}

/**
 * Link click event
 * Path: /organizations/{orgId}/links/{linkId}/clicks/{clickId}
 */
export interface LinkClick {
  id: string;
  linkId: string;
  timestamp: Timestamp;
  
  // Link metadata
  linkTitle?: string;
  linkUrl?: string;
  shortCode?: string;
  
  // Device info
  userAgent: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser?: string;
  os?: string;
  
  // Location
  country?: string;
  city?: string;
  
  // Referrer
  referrer?: string;
  
  // IP (hashed for privacy)
  ipHash?: string;
  
  // Linked account info (if link is attached to an account)
  accountHandle?: string;
  accountProfilePicture?: string;
  accountPlatform?: string;
}

// ==================== SETTINGS & PREFERENCES ====================

/**
 * User preferences
 * Path: /users/{userId}/preferences/app
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultView: 'dashboard' | 'accounts' | 'links';
  notifications: {
    email: boolean;
    videoAlerts: boolean;
    weeklyDigest: boolean;
  };
}

/**
 * Organization settings
 * Path: /organizations/{orgId}/settings/general
 */
export interface OrganizationSettings {
  // Refresh intervals
  autoRefreshVideos: boolean;
  refreshIntervalHours: number;
  
  // Notifications
  alertOnViralVideo: boolean;
  viralThreshold: number;
  
  // Integrations
  integrations?: {
    slack?: { webhookUrl: string };
    discord?: { webhookUrl: string };
  };
}

// ==================== CREATORS & PAYOUTS ====================

/**
 * Creator-Account Link (mapping) - PROJECT SCOPED
 * Path: /organizations/{orgId}/projects/{projectId}/creatorLinks/{linkId}
 */
export interface CreatorLink {
  id: string;
  orgId: string;
  projectId: string; // NEW: Project-scoped
  creatorId: string; // userId of the creator
  accountId: string; // trackedAccountId
  createdAt: Timestamp;
  createdBy: string; // userId of admin who created link
}

/**
 * Creator profile (denormalized for quick lookups) - PROJECT SCOPED
 * Path: /organizations/{orgId}/projects/{projectId}/creators/{creatorId}
 */
export interface Creator {
  id: string; // userId
  orgId: string;
  projectId: string; // NEW: Project-scoped
  displayName: string;
  email?: string; // Optional - can be added later
  photoURL?: string;
  linkedAccountsCount: number;
  totalEarnings: number;
  payoutsEnabled: boolean;
  createdAt: Timestamp;
  lastPayoutAt?: Timestamp;
  status?: string; // Status of the creator (e.g., 'pending', 'active')
  
  // Payment terms
  paymentTermPresetId?: string; // Reference to selected preset
  customPaymentTerms?: Partial<PaymentTermPreset>; // Custom overrides
  contractNotes?: string;
  contractStartDate?: Timestamp;
  contractEndDate?: Timestamp;
  
  // Flexible payment information (freeform)
  paymentInfo?: {
    isPaid: boolean;
    structure?: string; // Freeform payment structure description
    schedule?: 'weekly' | 'bi-weekly' | 'monthly' | 'custom';
    customSchedule?: string; // Custom schedule description
    notes?: string; // Additional payment notes
    updatedAt?: Timestamp;
    // Structured payment rules for calculation (legacy)
    paymentRules?: Array<{
      id: string;
      type: string;
      enabled: boolean;
      amount?: number;
      rate?: number;
      percentage?: number;
      minViews?: number;
      maxViews?: number;
      minVideos?: number;
      milestoneThreshold?: number;
      milestoneType?: string;
      milestonePaid?: boolean;
      upfrontCondition?: {
        videosRequired?: number;
        paid?: boolean;
      };
      description: string;
    }>;
    // New tiered payment structure
    tieredStructure?: any; // TieredPaymentStructure from payments.ts
  };
}

/**
 * Payout record - PROJECT SCOPED
 * Path: /organizations/{orgId}/projects/{projectId}/creators/{creatorId}/payouts/{payoutId}
 */
export interface Payout {
  id: string;
  orgId: string;
  projectId: string; // NEW: Project-scoped
  creatorId: string;
  
  // Period
  periodStart: Timestamp;
  periodEnd: Timestamp;
  
  // Metrics
  accountIds: string[]; // Accounts included in this payout
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares?: number;
  eligibleMetric: number; // The metric used for calculation (e.g., views)
  
  // Payment
  amount: number; // Amount in dollars
  currency: string; // e.g., 'USD'
  status: PayoutStatus;
  
  // Payment details
  paymentMethod?: string; // e.g., 'PayPal', 'Bank Transfer'
  reference?: string; // Payment reference number
  notes?: string; // Admin notes
  
  // Timestamps
  createdAt: Timestamp;
  createdBy: string; // Admin who created the payout
  paidAt?: Timestamp;
  
  // Rate info (for transparency)
  rateDescription?: string; // e.g., '$10 per 1,000 views'
}

