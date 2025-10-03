export interface TrackedAccount {
  id: string;
  username: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  accountType: 'my' | 'competitor'; // New field
  displayName?: string;
  profilePicture?: string;
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  bio?: string;
  isVerified?: boolean;
  dateAdded: Date;
  lastSynced?: Date;
  isActive: boolean;
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares?: number;
  // Outlier detection
  outlierAnalysis?: {
    topPerformersCount: number;
    underperformersCount: number;
    lastCalculated: Date;
  };
}

export interface AccountVideo {
  id: string;
  accountId?: string;
  videoId?: string;
  url: string;
  thumbnail?: string;
  caption?: string;
  uploadDate?: Date;
  timestamp?: string; // Fallback date string
  // Support both naming conventions from API
  views?: number;
  likes?: number;
  comments?: number;
  viewsCount?: number;
  likesCount?: number;
  commentsCount?: number;
  playsCount?: number;
  sharesCount?: number;
  shares?: number;
  duration?: number;
  isSponsored?: boolean;
  hashtags?: string[];
  mentions?: string[];
  rawData?: any; // Store the full original API response data
}

export interface AccountAnalytics {
  accountId: string;
  period: 'daily' | 'weekly' | 'monthly';
  date: Date;
  newVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgEngagementRate: number;
  topPerformingVideo?: AccountVideo;
}
