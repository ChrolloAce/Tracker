import { doc, updateDoc, Timestamp, deleteField, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { VideoSnapshot } from '../../types';

/**
 * Spark ads support for individual videos.
 *
 * A "Sparked" video is one running paid ads on the host platform (TikTok
 * Spark Ads, Meta boosted Reels, etc.). Once marked, every snapshot delta
 * captured AFTER `sparkedAt` is treated as ad-driven views rather than
 * organic. Headline view totals across the app subtract the ad portion so
 * "views" stays an organic-only metric; the ad portion shows up as a
 * separate stat.
 *
 * For cases where the in-app view counter drifts from what the ad
 * platform reports, the admin can log per-day ad-view totals via
 * `addSparkViewLog`. The split helper below prefers logged totals over
 * snapshot-delta inference for any day that has a log entry.
 */
class SparkService {
  /** Path helper — videos live under projects in this codebase. */
  private static videoRef(orgId: string, projectId: string, videoId: string) {
    return doc(db, 'organizations', orgId, 'projects', projectId, 'videos', videoId);
  }

  /** Mark a video as Sparked. Defaults `when` to now. Idempotent —
   *  re-calling overwrites the timestamp (use when re-starting a paused
   *  ad run from a new date). */
  static async markAsSparked(
    orgId: string,
    projectId: string,
    videoId: string,
    when: Date = new Date(),
  ): Promise<void> {
    await updateDoc(this.videoRef(orgId, projectId, videoId), {
      sparkedAt: Timestamp.fromDate(when),
    });
  }

  /** Remove the Spark mark. Snapshot deltas revert to all-organic. The
   *  manual sparkViewLogs are kept (deleting them is a separate action). */
  static async unmarkSparked(orgId: string, projectId: string, videoId: string): Promise<void> {
    await updateDoc(this.videoRef(orgId, projectId, videoId), {
      sparkedAt: deleteField(),
    });
  }

  /** Freeze / unfreeze a video — controls whether the cron refreshes it.
   *  Pairs naturally with Spark: a Sparked video's growth is shaped by ad
   *  spend, so refreshing burns API quota tracking numbers the admin is
   *  already controlling manually via sparkViewLogs. The flag is the same
   *  `isStale` field used by the freeze toggles in EditProjectModal /
   *  AccountsTable / VideoSubmissionsTable. */
  static async setVideoFrozen(
    orgId: string,
    projectId: string,
    videoId: string,
    frozen: boolean,
  ): Promise<void> {
    await updateDoc(this.videoRef(orgId, projectId, videoId), {
      isStale: frozen,
    });
  }

  /** Replace the entire sparkViewLogs array with a single override entry —
   *  used by "Set views" mode where the user types one ad-view total
   *  instead of logging per-day entries. Pass `views = 0` to clear. */
  static async setManualAdViewsTotal(
    orgId: string,
    projectId: string,
    videoId: string,
    views: number,
    loggedBy?: string,
  ): Promise<void> {
    if (views <= 0) {
      // Clear by writing an empty array.
      await updateDoc(this.videoRef(orgId, projectId, videoId), {
        sparkViewLogs: [],
      });
      return;
    }
    const entry = {
      id: `spk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString().slice(0, 10),
      views,
      ...(loggedBy ? { loggedBy } : {}),
      loggedAt: Timestamp.now(),
    };
    await updateDoc(this.videoRef(orgId, projectId, videoId), {
      sparkViewLogs: [entry],
    });
  }

  /** Append a manual ad-view log entry. */
  static async addSparkViewLog(
    orgId: string,
    projectId: string,
    videoId: string,
    entry: { date: string; views: number; note?: string; loggedBy?: string },
  ): Promise<void> {
    const log = {
      id: `spk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      date: entry.date,
      views: entry.views,
      ...(entry.note ? { note: entry.note } : {}),
      ...(entry.loggedBy ? { loggedBy: entry.loggedBy } : {}),
      loggedAt: Timestamp.now(),
    };
    await updateDoc(this.videoRef(orgId, projectId, videoId), {
      sparkViewLogs: arrayUnion(log),
    });
  }

  /** Remove a manual ad-view log entry by id. The caller passes the
   *  entire entry object (Firestore arrayRemove matches by deep equality). */
  static async removeSparkViewLog(
    orgId: string,
    projectId: string,
    videoId: string,
    entry: any,
  ): Promise<void> {
    await updateDoc(this.videoRef(orgId, projectId, videoId), {
      sparkViewLogs: arrayRemove(entry),
    });
  }

  /**
   * Split a video's snapshots into organic vs ad views.
   *
   * Algorithm:
   *  1. Sort snapshots by capturedAt.
   *  2. For each consecutive pair, the delta is the views gained between
   *     them. If the second snapshot is AFTER `sparkedAt`, the delta
   *     belongs to ads; otherwise it's organic. (When `sparkedAt` falls
   *     mid-pair, the whole delta is attributed to ads — close enough
   *     given snapshot cadence and the alternative is a fragile split.)
   *  3. Manual sparkViewLogs override the delta-inferred ad total: if
   *     logs cover the period, sum the logged totals as ad views and
   *     subtract that sum from total views to get organic. Logs are the
   *     ground truth when they exist.
   *
   * Returns absolute totals (not deltas), so the headline tile can show
   * `organic` as the primary number and `ad` as the secondary stat.
   */
  static splitViewsBySpark(
    snapshots: VideoSnapshot[] | undefined,
    sparkedAt: Date | undefined,
    totalViews: number,
    sparkViewLogs?: Array<{ views: number }>,
  ): { organic: number; ad: number } {
    // Manual logs take priority — when present they're the source of
    // truth for ad views.
    if (sparkViewLogs && sparkViewLogs.length > 0) {
      const ad = sparkViewLogs.reduce((s, l) => s + (l.views || 0), 0);
      return { organic: Math.max(0, totalViews - ad), ad };
    }

    // Not Sparked → everything is organic.
    if (!sparkedAt) return { organic: totalViews, ad: 0 };

    // No snapshots → can't infer; assume the entire current total is
    // organic (ad has its own logs path above).
    if (!snapshots || snapshots.length < 2) return { organic: totalViews, ad: 0 };

    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
    );
    const sparkTime = sparkedAt.getTime();

    let ad = 0;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const delta = (curr.views || 0) - (prev.views || 0);
      if (delta <= 0) continue;
      if (new Date(curr.capturedAt).getTime() >= sparkTime) ad += delta;
    }
    return { organic: Math.max(0, totalViews - ad), ad };
  }
}

export default SparkService;
