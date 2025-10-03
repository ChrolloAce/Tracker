export interface VideoSnapshot {
  id: string;
  videoId: string;
  views: number;
  likes: number;
  comments: number;
  shares?: number;
  capturedAt: Date;
  capturedBy: 'initial_upload' | 'manual_refresh' | 'scheduled_refresh';
}

export interface VideoSubmission {
  id: string;
  url: string; // Renamed from instagramUrl to support both platforms
  platform: 'instagram' | 'tiktok' | 'youtube';
  thumbnail: string;
  title: string;
  caption?: string; // Video description/caption for rules filtering
  uploader: string;
  uploaderHandle: string;
  uploaderProfilePicture?: string; // Account profile picture
  status: 'pending' | 'approved' | 'rejected';
  views: number; // Current/latest metrics
  likes: number;
  comments: number;
  shares?: number; // TikTok specific
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
}
