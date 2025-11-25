export interface TrackedAccount {
  id: string;
  orgId: string;
  addedBy: string;
  username: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  accountType: 'my' | 'competitor'; // New field
  creatorType?: 'automatic' | 'static';
  displayName?: string;
  profilePicture?: string;
  youtubeChannelId?: string; // Store YouTube channel ID to avoid wrong channel lookups
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  bio?: string;
  isVerified?: boolean;
  dateAdded: any;
  createdAt?: any; // Firestore Timestamp for when account was added
  lastSynced?: any;
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
    lastCalculated: any;
  };
  // Sync errors
  syncStatus?: 'idle' | 'pending' | 'syncing' | 'completed' | 'error';
  syncError?: string; // Deprecated?
  lastSyncError?: string;
  hasError?: boolean;
  syncRetryCount?: number;
}

export interface AccountVideo {
  id: string;
  accountId?: string;
  videoId?: string;
  url: string;
  platform?: 'instagram' | 'tiktok' | 'youtube' | 'twitter'; // Platform the video is from
  thumbnail?: string;
  media?: string[]; // Array of media URLs (for Twitter multi-image posts)
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
  shares?: number;
  playCount?: number;
  diggCount?: number;
  commentCount?: number;
  shareCount?: number;
  // Additional alias counts
  viewsCount?: number;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  duration?: number;
  // Metadata
  hashtags?: string[];
  mentions?: string[];
  // Additional fields
  isSingular?: boolean;
  description?: string;
  status?: string;
  syncStatus?: string;
  syncRequestedBy?: string;
  syncRequestedAt?: any;
  syncRetryCount?: number;
  commentsDelta30d?: number;
}

export interface VideoSubmission extends AccountVideo {
  dateSubmitted: Date;
  isLoading?: boolean;
  snapshots?: any[]; // Allow snapshots
}

export interface AccountWithFilteredStats extends TrackedAccount {
  filteredTotalVideos: number;
  filteredTotalViews: number;
  filteredTotalLikes: number;
  filteredTotalComments: number;
  filteredTotalShares?: number;
  filteredTotalBookmarks?: number;
  highestViewedVideo?: { title: string; views: number; videoId: string };
  postingStreak?: number;
  postingFrequency?: string; // e.g., "2/day", "every 3 days", "3x/week"
  avgEngagementRate?: number;
}
