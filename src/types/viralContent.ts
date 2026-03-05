import { Timestamp } from 'firebase/firestore';

/**
 * Viral video content stored in Firestore.
 * Collection: /viralContent/{docId}
 */
export interface ViralVideo {
  id: string;
  order: number;
  url: string;
  platform: 'tiktok' | 'instagram' | 'youtube';
  title: string;
  description: string;
  thumbnail: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  followerCount: number;
  uploaderHandle: string;
  contentType: 'video' | 'slideshow';
  category: string;
  monetization?: string | null;
  productBrand?: string | null;
  tags: string[];
  uploadDate: Timestamp;
  addedAt: Timestamp;
  addedBy: string;
  isActive: boolean;
}
