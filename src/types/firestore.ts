import { Timestamp } from 'firebase/firestore';

// ==================== ENUMS & TYPES ====================

export type Platform = 'instagram' | 'tiktok' | 'youtube';
export type Role = 'owner' | 'admin' | 'member';
export type MemberStatus = 'active' | 'invited' | 'removed';
export type VideoPlatform = Platform | 'file' | 'other';
export type AccountType = 'my' | 'competitor';

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
  
  // Aggregates (computed)
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares?: number;
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
  url: string;
  videoId: string; // Platform-specific video ID
  
  // Content
  title?: string;
  description?: string;
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

