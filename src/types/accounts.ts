export interface TrackedAccount {
  id: string;
  username: string;
  platform: 'instagram' | 'tiktok';
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
}

export interface AccountVideo {
  id: string;
  accountId: string;
  videoId: string;
  url: string;
  thumbnail: string;
  caption: string;
  uploadDate: Date;
  views: number;
  likes: number;
  comments: number;
  shares?: number;
  duration?: number;
  isSponsored?: boolean;
  hashtags: string[];
  mentions: string[];
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
