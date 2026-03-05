import {
  collection,
  query,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { ViralVideo } from '../types/viralContent';

const COLLECTION = 'viralContent';

// ─── Service ─────────────────────────────────────────────

class ViralContentService {
  /** In-memory cache so we only read Firestore once per session. */
  private static cachedVideos: ViralVideo[] | null = null;

  /**
   * Fetch ALL viral videos from Firestore (cached after first call).
   * ~4 K small docs ≈ 1–2 MB — fine to hold in memory.
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

  /** Clear the in-memory cache (e.g. after re-seeding). */
  static clearCache(): void {
    this.cachedVideos = null;
  }
}

export default ViralContentService;
