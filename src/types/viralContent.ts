import { Timestamp } from 'firebase/firestore';

/**
 * Viral video content for discovery
 * Stored at: /viralContent/{videoId}
 */
export interface ViralVideo {
  id: string;
  url: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  title: string;
  description?: string;
  thumbnail?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  followerCount?: number;
  contentType?: 'video' | 'slideshow';
  uploaderName?: string;
  uploaderHandle?: string;
  uploaderProfilePic?: string;
  uploadDate?: Timestamp;
  addedAt: Timestamp;
  addedBy: string;
  tags?: string[];
  category?: string;
  isActive: boolean;
}
