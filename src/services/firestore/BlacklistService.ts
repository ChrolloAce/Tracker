import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Per-org blacklist of video URLs. Lives at
 * organizations/{orgId}.settings.blacklistedVideoUrls. The sync pipeline
 * (VideosDataService.syncAccountVideos) reads this once per run and skips
 * any candidate video whose URL matches, so a video the user deleted +
 * blacklisted never gets re-imported on the next scrape pass.
 *
 * URLs are stored normalized (lowercased, query/hash stripped, trailing
 * slash removed) so the same logical video isn't blacklisted twice under
 * cosmetic URL variants.
 */
class BlacklistService {
  /** Strip query / hash / trailing slash and lowercase the host so two
   *  cosmetically-different URLs for the same video collapse to one key. */
  static normalize(url: string): string {
    if (!url) return '';
    try {
      const u = new URL(url.trim());
      u.search = '';
      u.hash = '';
      u.hostname = u.hostname.toLowerCase();
      let out = u.toString();
      if (out.endsWith('/')) out = out.slice(0, -1);
      return out;
    } catch {
      // Not a parseable URL — fall back to plain string normalization
      // so we still dedupe trivial cases.
      return url.trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/$/, '');
    }
  }

  /** Read the org's full blacklist as a Set of normalized URLs. The sync
   *  pipeline calls this once per run and Set.has-checks each candidate. */
  static async loadBlacklist(orgId: string): Promise<Set<string>> {
    if (!orgId) return new Set();
    try {
      const orgDoc = await getDoc(doc(db, 'organizations', orgId));
      const list = (orgDoc.data()?.settings?.blacklistedVideoUrls as string[] | undefined) || [];
      return new Set(list.map(BlacklistService.normalize));
    } catch (err) {
      console.warn('[Blacklist] Failed to load blacklist:', err);
      return new Set();
    }
  }

  /** Add a URL to the org's blacklist. Idempotent — Firestore arrayUnion
   *  dedupes the entry server-side. */
  static async addToBlacklist(orgId: string, url: string): Promise<void> {
    if (!orgId || !url) return;
    const normalized = BlacklistService.normalize(url);
    if (!normalized) return;
    await updateDoc(doc(db, 'organizations', orgId), {
      'settings.blacklistedVideoUrls': arrayUnion(normalized),
    });
  }

  /** Remove a URL from the blacklist (e.g. user changes their mind). */
  static async removeFromBlacklist(orgId: string, url: string): Promise<void> {
    if (!orgId || !url) return;
    const normalized = BlacklistService.normalize(url);
    if (!normalized) return;
    await updateDoc(doc(db, 'organizations', orgId), {
      'settings.blacklistedVideoUrls': arrayRemove(normalized),
    });
  }

  /** Convenience: check whether a single URL is blacklisted. Prefer
   *  loadBlacklist + Set.has when checking many URLs in a tight loop. */
  static isBlacklisted(blacklist: Set<string>, url: string): boolean {
    return blacklist.has(BlacklistService.normalize(url));
  }
}

export default BlacklistService;
