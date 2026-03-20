import { getFirestore } from 'firebase-admin/firestore';

/**
 * Plan-based video limits (must match src/types/subscription.ts SUBSCRIPTION_PLANS)
 */
const PLAN_MAX_VIDEOS: Record<string, number> = {
  free: 5,
  basic: 150,
  pro: 1000,
  ultra: 5000,
  enterprise: -1, // unlimited
};

export interface VideoLimitResult {
  allowed: boolean;
  planTier: string;
  limit: number;
  currentCount: number;
  remaining: number;
}

/**
 * Check whether an organization can add more videos.
 *
 * Uses a real Firestore count across all projects (not a cached counter)
 * so the result is always accurate.
 */
export async function checkVideoLimit(orgId: string): Promise<VideoLimitResult> {
  const db = getFirestore();

  // 1. Get the org's plan tier
  const subDoc = await db
    .collection('organizations').doc(orgId)
    .collection('billing').doc('subscription')
    .get();

  const planTier = subDoc.data()?.planTier || 'free';
  const limit = PLAN_MAX_VIDEOS[planTier] ?? 5;

  // Enterprise / unlimited plans always pass
  if (limit === -1) {
    return { allowed: true, planTier, limit: -1, currentCount: 0, remaining: Infinity };
  }

  // 2. Count actual videos across all projects
  const projectsSnap = await db
    .collection('organizations').doc(orgId)
    .collection('projects')
    .get();

  let totalVideos = 0;
  for (const proj of projectsSnap.docs) {
    const countSnap = await proj.ref.collection('videos').count().get();
    totalVideos += countSnap.data().count;
  }

  const remaining = Math.max(0, limit - totalVideos);

  return {
    allowed: totalVideos < limit,
    planTier,
    limit,
    currentCount: totalVideos,
    remaining,
  };
}
