import {
  collection,
  query,
  orderBy,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { ViralVideo } from '../types/viralContent';

const COLLECTION = 'viralContent';

class ViralContentService {
  private static cachedVideos: ViralVideo[] | null = null;

  /**
   * Fetch first N videos quickly for instant display.
   */
  static async fetchFirst(count: number = 12): Promise<ViralVideo[]> {
    if (this.cachedVideos) return this.cachedVideos.slice(0, count);

    const q = query(collection(db, COLLECTION), orderBy('order', 'asc'), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ViralVideo));
  }

  /**
   * Fetch ALL viral videos (cached after first call).
   */
  static async fetchAll(): Promise<ViralVideo[]> {
    if (this.cachedVideos) return this.cachedVideos;

    const q = query(collection(db, COLLECTION), orderBy('order', 'asc'));
    const snapshot = await getDocs(q);

    this.cachedVideos = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as ViralVideo),
    );

    return this.cachedVideos;
  }

  static clearCache(): void {
    this.cachedVideos = null;
  }
}

export default ViralContentService;
