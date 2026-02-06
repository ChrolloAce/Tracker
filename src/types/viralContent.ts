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
  uploaderName?: string;
  uploaderHandle?: string;
  uploaderProfilePic?: string;
  uploadDate?: Timestamp;
  addedAt: Timestamp;
  addedBy: string; // Super admin email
  tags?: string[];
  category?: string;
  isActive: boolean;
}

export interface ViralVideoInput {
  url: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  title: string;
  description?: string;
  thumbnail?: string;
  tags?: string[];
  category?: string;
}
