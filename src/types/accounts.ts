export interface TrackedAccount {
  id: string;
  username: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  accountType: 'my' | 'competitor'; // New field
  displayName?: string;
  profilePicture?: string;
  youtubeChannelId?: string; // Store YouTube channel ID to avoid wrong channel lookups
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  bio?: string;
  isVerified?: boolean;
  dateAdded: Date;
  createdAt?: any; // Firestore Timestamp for when account was added
  lastSynced?: Date;
  lastRefreshed?: any; // Firestore Timestamp for last refresh
  isActive: boolean;
  isRead?: boolean; // New field for unread notification
  maxVideos?: number; // User's preference for how many videos to scrape on manual sync
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
  platform?: 'instagram' | 'tiktok' | 'youtube' | 'twitter'; // Platform the video is from
  thumbnail?: string;
  caption?: string;
  title?: string; // Video/post title
  uploader?: string; // Display name of uploader
  uploaderHandle?: string; // Handle/username of uploader
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
  saves?: number;
  duration?: number;
  isSponsored?: boolean;
  hashtags?: string[];
  mentions?: string[];
  dateAdded?: Date;
  lastRefreshed?: Date;
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
