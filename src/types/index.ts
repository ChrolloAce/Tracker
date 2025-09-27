export interface VideoSubmission {
  id: string;
  url: string; // Renamed from instagramUrl to support both platforms
  platform: 'instagram' | 'tiktok';
  thumbnail: string;
  title: string;
  uploader: string;
  uploaderHandle: string;
  status: 'pending' | 'approved' | 'rejected';
  views: number;
  likes: number;
  comments: number;
  shares?: number; // TikTok specific
  dateSubmitted: Date;
  timestamp?: string; // Original upload timestamp
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
