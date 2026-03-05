import {
  collection,
  query,
  where,
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
const DEFAULT_PAGE_SIZE = 48;

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
   * Sorting is done by Firestore; extra filtering (platform,
   * category, contentType, search) is expected to happen
   * client-side on the returned results.
   */
  static async fetchPage(options: ViralFetchOptions = {}): Promise<ViralFetchResult> {
    const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
    const { field, direction } = this.resolveSortField(options.sortBy);

    const constraints: QueryConstraint[] = [
      where('isActive', '==', true),
      orderBy(field, direction),
    ];

    if (options.lastDoc) {
      constraints.push(startAfter(options.lastDoc));
    }

    // Fetch one extra document to know if there are more pages
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
   * Get the total count of active viral videos (cheap aggregate).
   */
  static async getTotalCount(): Promise<number> {
    const q = query(
      collection(db, COLLECTION),
      where('isActive', '==', true),
    );
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
