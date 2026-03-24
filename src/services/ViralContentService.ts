import {
  collection,
  query,
  orderBy,
  getDocs,
  limit,
  startAfter,
  where,
  getCountFromServer,
  QueryConstraint,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { ViralVideo } from '../types/viralContent';

const COLLECTION = 'viralContent';

export type SortField = 'order' | 'views' | 'likes' | 'uploadDate';
export type SortDir = 'asc' | 'desc';

export interface PageFilters {
  platform?: string;   // 'all' or omitted means no filter
  category?: string;   // 'All' or omitted means no filter
  contentType?: string; // 'all' or omitted means no filter
  sortField?: SortField;
  sortDir?: SortDir;
}

export interface PageResult {
  videos: ViralVideo[];
  /** The last Firestore DocumentSnapshot, used as cursor for next page */
  lastDoc: DocumentSnapshot | null;
  /** Total count matching the current filters (cached) */
  totalCount: number;
}

class ViralContentService {
  // ── Page cache keyed by "filters + page" ──────────────────
  private static pageCache = new Map<string, { videos: ViralVideo[]; lastDoc: DocumentSnapshot | null }>();
  private static countCache = new Map<string, { count: number; ts: number }>();
  /** Store the lastDoc for each page so we can jump to any page */
  private static cursorCache = new Map<string, DocumentSnapshot>();

  /** Cache for fetchAllForSearch — holds all docs ordered by order ASC */
  private static allDocsCache: { videos: ViralVideo[]; ts: number } | null = null;
  private static ALL_DOCS_TTL = 5 * 60_000; // 5 minutes

  private static COUNT_TTL = 60_000; // 1 minute

  /**
   * Fetch first N videos quickly for instant display (unchanged).
   */
  static async fetchFirst(count: number = 12): Promise<ViralVideo[]> {
    const q = query(collection(db, COLLECTION), orderBy('order', 'asc'), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ViralVideo));
  }

  /**
   * Build a cache key from filters (excludes page — page is appended separately).
   */
  private static filterKey(filters: PageFilters): string {
    return [
      filters.platform || 'all',
      filters.category || 'All',
      filters.contentType || 'all',
      filters.sortField || 'order',
      filters.sortDir || 'asc',
    ].join('|');
  }

  /**
   * Build Firestore query constraints from filters.
   */
  private static buildConstraints(filters: PageFilters): QueryConstraint[] {
    const constraints: QueryConstraint[] = [];

    if (filters.platform && filters.platform !== 'all') {
      constraints.push(where('platform', '==', filters.platform));
    }
    if (filters.category && filters.category !== 'All') {
      constraints.push(where('category', '==', filters.category));
    }
    if (filters.contentType && filters.contentType !== 'all') {
      constraints.push(where('contentType', '==', filters.contentType));
    }

    // Determine sort
    const sortField = filters.sortField || 'order';
    const sortDir = filters.sortDir || 'asc';
    constraints.push(orderBy(sortField, sortDir));

    return constraints;
  }

  /**
   * Fetch a single page of videos with server-side filtering and cursor-based pagination.
   *
   * @param page      1-based page number
   * @param pageSize  items per page
   * @param filters   server-side filters (platform, category, contentType, sort)
   */
  static async fetchPage(
    page: number,
    pageSize: number,
    filters: PageFilters = {},
  ): Promise<PageResult> {
    const fKey = this.filterKey(filters);
    const pageKey = `${fKey}|p${page}`;

    // Return from cache if we have this exact page
    const cached = this.pageCache.get(pageKey);
    if (cached) {
      const totalCount = await this.getCount(filters);
      return { videos: cached.videos, lastDoc: cached.lastDoc, totalCount };
    }

    const constraints = this.buildConstraints(filters);

    // For page 1, no cursor needed. For page N, we need the lastDoc of page N-1.
    let cursor: DocumentSnapshot | undefined;
    if (page > 1) {
      const prevPageKey = `${fKey}|p${page - 1}`;
      cursor = this.cursorCache.get(prevPageKey) ?? undefined;

      // If we don't have the previous page's cursor, we need to fetch pages sequentially
      if (!cursor) {
        // Fetch all preceding pages to build cursors
        for (let p = 1; p < page; p++) {
          const pKey = `${fKey}|p${p}`;
          if (this.cursorCache.has(pKey)) continue;
          await this.fetchPage(p, pageSize, filters);
        }
        const retryKey = `${fKey}|p${page - 1}`;
        cursor = this.cursorCache.get(retryKey) ?? undefined;
      }
    }

    const queryConstraints = [...constraints, limit(pageSize)];
    if (cursor) {
      queryConstraints.push(startAfter(cursor));
    }

    const q = query(collection(db, COLLECTION), ...queryConstraints);
    const snapshot = await getDocs(q);

    const videos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ViralVideo));
    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

    // Cache this page's results and its cursor
    this.pageCache.set(pageKey, { videos, lastDoc });
    if (lastDoc) {
      this.cursorCache.set(pageKey, lastDoc);
    }

    const totalCount = await this.getCount(filters);

    return { videos, lastDoc, totalCount };
  }

  /**
   * Get the total count of documents matching the given filters.
   * Uses Firestore's countFromServer with a short TTL cache.
   */
  static async getCount(filters: PageFilters = {}): Promise<number> {
    const fKey = this.filterKey(filters);
    const cached = this.countCache.get(fKey);
    if (cached && Date.now() - cached.ts < this.COUNT_TTL) {
      return cached.count;
    }

    const constraints = this.buildConstraints(filters);
    // Remove the orderBy for count queries — it's unnecessary and avoids index issues
    const countConstraints = constraints.filter(
      (c) => (c as any).type !== 'orderBy',
    );

    const q = query(collection(db, COLLECTION), ...countConstraints);
    try {
      const countSnapshot = await getCountFromServer(q);
      const count = countSnapshot.data().count;
      this.countCache.set(fKey, { count, ts: Date.now() });
      return count;
    } catch {
      // Fallback: if countFromServer not available, fetch all IDs
      const fallbackQ = query(collection(db, COLLECTION), ...countConstraints);
      const snapshot = await getDocs(fallbackQ);
      const count = snapshot.size;
      this.countCache.set(fKey, { count, ts: Date.now() });
      return count;
    }
  }

  /**
   * Fetch ALL viral videos ordered by order ASC.
   * Used for client-side search so the user can find any video in the library.
   * Results are cached with a 5-minute TTL.
   */
  static async fetchAllForSearch(): Promise<ViralVideo[]> {
    // Return from cache if fresh
    if (this.allDocsCache && Date.now() - this.allDocsCache.ts < this.ALL_DOCS_TTL) {
      return this.allDocsCache.videos;
    }

    const q = query(collection(db, COLLECTION), orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    const videos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ViralVideo));

    this.allDocsCache = { videos, ts: Date.now() };
    return videos;
  }

  /**
   * Clear all caches (page data, cursors, counts, allDocs).
   */
  static clearCache(): void {
    this.pageCache.clear();
    this.cursorCache.clear();
    this.countCache.clear();
    this.allDocsCache = null;
  }
}

export default ViralContentService;
