export interface VideoSnapshot {
  id: string;
  videoId: string;
  views: number;
  likes: number;
  comments: number;
  shares?: number;
  saves?: number; // Bookmarks/saves count
  bookmarks?: number; // Alias for saves
  capturedAt: Date;
  timestamp?: Date; // Backwards compatibility
  capturedBy: 'initial_upload' | 'manual_refresh' | 'scheduled_refresh';
}

export interface VideoSubmission {
  id: string;
  url: string; // Renamed from instagramUrl to support both platforms
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  thumbnail: string;
  title: string;
  caption?: string; // Video description/caption for rules filtering
  uploader: string;
  uploaderHandle: string;
  uploaderProfilePicture?: string; // Account profile picture
  followerCount?: number; // Creator's follower count
  status: 'pending' | 'approved' | 'rejected';
  views: number; // Current/latest metrics
  likes: number;
  comments: number;
  shares?: number; // Share count
  saves?: number; // Bookmarks/saves count (TikTok/Instagram)
  bookmarks?: number; // Alias for saves
  duration?: number; // Video duration in seconds
  dateSubmitted: Date;
  uploadDate: Date; // When the video was originally uploaded to the platform
  timestamp?: string; // Original upload timestamp (legacy)
  snapshots?: VideoSnapshot[]; // Historical snapshots
  lastRefreshed?: Date; // When metrics were last updated
  selected?: boolean;
}

export interface InstagramVideoData {
  id: string;
  thumbnail_url: string;
  caption: string;
  username: string;
  like_count: number;
  comment_count: number;
  view_count?: number;
  timestamp: string;
  // Extended fields for richer data (like TikTok)
  profile_pic_url?: string;
  display_name?: string;
  follower_count?: number;
  share_count?: number;
  video_duration?: number;
  is_verified?: boolean;
  play_count?: number;
  ig_play_count?: number;
}
