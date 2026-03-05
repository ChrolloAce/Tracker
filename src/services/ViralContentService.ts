import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getCountFromServer,
  QueryDocumentSnapshot,
  DocumentData,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import { ViralVideo } from '../types/viralContent';

const COLLECTION = 'viralContent';
const DEFAULT_PAGE_SIZE = 12;

// ─── Public types ────────────────────────────────────────

export interface ViralFetchOptions {
  sortBy?: 'recently_added' | 'latest_posted' | 'most_views' | 'most_likes';
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot<DocumentData> | null;
}

export interface ViralFetchResult {
  videos: ViralVideo[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

// ─── Service ─────────────────────────────────────────────

class ViralContentService {
  /**
   * Fetch a page of viral videos from Firestore.
   *
   * Uses simple single-field orderBy queries that work with
   * Firestore's automatic indexes — no composite index setup needed.
   *
   * Additional filtering (platform, category, contentType, search)
   * is done client-side on the returned results.
   */
  static async fetchPage(options: ViralFetchOptions = {}): Promise<ViralFetchResult> {
    const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
    const { field, direction } = this.resolveSortField(options.sortBy);

    const constraints: QueryConstraint[] = [
      orderBy(field, direction),
    ];

    if (options.lastDoc) {
      constraints.push(startAfter(options.lastDoc));
    }

    // Fetch one extra document to detect if more pages exist
    constraints.push(limit(pageSize + 1));

    const q = query(collection(db, COLLECTION), ...constraints);
    const snapshot = await getDocs(q);

    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;

    return {
      videos: pageDocs.map((d) => ({ id: d.id, ...d.data() } as ViralVideo)),
      lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
      hasMore,
    };
  }

  /**
   * Get total count of viral videos.
   */
  static async getTotalCount(): Promise<number> {
    const q = query(collection(db, COLLECTION));
    const snap = await getCountFromServer(q);
    return snap.data().count;
  }

  // ─── Private helpers ─────────────────────────────────────

  private static resolveSortField(
    sortBy?: string,
  ): { field: string; direction: 'asc' | 'desc' } {
    switch (sortBy) {
      case 'most_views':
        return { field: 'views', direction: 'desc' };
      case 'most_likes':
        return { field: 'likes', direction: 'desc' };
      case 'latest_posted':
        return { field: 'uploadDate', direction: 'desc' };
      case 'recently_added':
      default:
        return { field: 'order', direction: 'asc' };
    }
  }
}

export default ViralContentService;
