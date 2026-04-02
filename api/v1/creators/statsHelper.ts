/**
 * Shared helper for computing creator stats from pre-aggregated TrackedAccount data.
 * Used by all /api/v1/creators/* endpoints.
 */

import { getFirestore } from 'firebase-admin/firestore';

const COLL_ORGS = 'organizations';
const COLL_PROJECTS = 'projects';
const COLL_CREATORS = 'creators';
const COLL_CREATOR_LINKS = 'creatorLinks';
const COLL_ACCOUNTS = 'trackedAccounts';

export interface CreatorStats {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalVideos: number;
  engagementRate: number;
}

export interface LinkedAccountInfo {
  id: string;
  username: string;
  platform: string;
  displayName: string;
  profilePicture: string;
  followerCount: number;
  totalViews: number;
  totalVideos: number;
}

export interface EnrichedCreator {
  id: string;
  displayName: string;
  email: string;
  photoURL: string;
  status: string;
  createdAt: string | null;
  stats: CreatorStats;
  linkedAccounts: LinkedAccountInfo[];
}

/**
 * Fetches all creators for a project and computes their stats
 * by summing pre-aggregated metrics from linked TrackedAccount docs.
 */
export async function getCreatorsWithStats(
  orgId: string,
  projectId: string
): Promise<EnrichedCreator[]> {
  const db = getFirestore();
  const projectRef = db
    .collection(COLL_ORGS).doc(orgId)
    .collection(COLL_PROJECTS).doc(projectId);

  // Fetch all three collections in parallel
  const [creatorsSnap, linksSnap, accountsSnap] = await Promise.all([
    projectRef.collection(COLL_CREATORS).get(),
    projectRef.collection(COLL_CREATOR_LINKS).get(),
    projectRef.collection(COLL_ACCOUNTS).get(),
  ]);

  // Build accounts lookup: accountId → account data
  const accountsMap = new Map<string, FirebaseFirestore.DocumentData>();
  for (const doc of accountsSnap.docs) {
    accountsMap.set(doc.id, doc.data());
  }

  // Build creator→accountIds mapping from links
  const creatorAccountsMap = new Map<string, string[]>();
  for (const doc of linksSnap.docs) {
    const data = doc.data();
    const creatorId = data.creatorId as string;
    const accountId = data.accountId as string;
    if (!creatorId || !accountId) continue;

    const existing = creatorAccountsMap.get(creatorId) || [];
    existing.push(accountId);
    creatorAccountsMap.set(creatorId, existing);
  }

  // Build enriched creator objects
  const results: EnrichedCreator[] = [];

  for (const doc of creatorsSnap.docs) {
    const data = doc.data();
    const linkedAccountIds = creatorAccountsMap.get(doc.id) || [];

    // Sum stats from linked accounts
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalVideos = 0;
    const linkedAccounts: LinkedAccountInfo[] = [];

    for (const accountId of linkedAccountIds) {
      const account = accountsMap.get(accountId);
      if (!account) continue; // dangling link — skip gracefully

      totalViews += account.totalViews || 0;
      totalLikes += account.totalLikes || 0;
      totalComments += account.totalComments || 0;
      totalShares += account.totalShares || 0;
      totalVideos += account.totalVideos || 0;

      linkedAccounts.push({
        id: accountId,
        username: account.username || '',
        platform: account.platform || '',
        displayName: account.displayName || account.username || '',
        profilePicture: account.profilePicture || '',
        followerCount: account.followerCount || 0,
        totalViews: account.totalViews || 0,
        totalVideos: account.totalVideos || 0,
      });
    }

    const engagementRate = totalViews > 0
      ? parseFloat(((totalLikes + totalComments + totalShares) / totalViews * 100).toFixed(2))
      : 0;

    results.push({
      id: doc.id,
      displayName: data.displayName || '',
      email: data.email || '',
      photoURL: data.photoURL || '',
      status: data.status || 'active',
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      stats: {
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalVideos,
        engagementRate,
      },
      linkedAccounts,
    });
  }

  return results;
}

/**
 * Fetches a single creator by ID with computed stats.
 * More efficient than getCreatorsWithStats when you only need one creator.
 */
export async function getCreatorById(
  orgId: string,
  projectId: string,
  creatorId: string
): Promise<EnrichedCreator | null> {
  const db = getFirestore();
  const projectRef = db
    .collection(COLL_ORGS).doc(orgId)
    .collection(COLL_PROJECTS).doc(projectId);

  // Fetch creator doc and their links in parallel
  const [creatorDoc, linksSnap] = await Promise.all([
    projectRef.collection(COLL_CREATORS).doc(creatorId).get(),
    projectRef.collection(COLL_CREATOR_LINKS)
      .where('creatorId', '==', creatorId).get(),
  ]);

  if (!creatorDoc.exists) return null;

  const data = creatorDoc.data()!;
  const linkedAccountIds = linksSnap.docs
    .map(d => d.data().accountId as string)
    .filter(Boolean);

  // Fetch linked account docs in parallel
  const accountDocs = await Promise.all(
    linkedAccountIds.map(accountId =>
      projectRef.collection(COLL_ACCOUNTS).doc(accountId).get()
    )
  );

  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalVideos = 0;
  const linkedAccounts: LinkedAccountInfo[] = [];

  for (const accountDoc of accountDocs) {
    if (!accountDoc.exists) continue;
    const account = accountDoc.data()!;

    totalViews += account.totalViews || 0;
    totalLikes += account.totalLikes || 0;
    totalComments += account.totalComments || 0;
    totalShares += account.totalShares || 0;
    totalVideos += account.totalVideos || 0;

    linkedAccounts.push({
      id: accountDoc.id,
      username: account.username || '',
      platform: account.platform || '',
      displayName: account.displayName || account.username || '',
      profilePicture: account.profilePicture || '',
      followerCount: account.followerCount || 0,
      totalViews: account.totalViews || 0,
      totalVideos: account.totalVideos || 0,
    });
  }

  const engagementRate = totalViews > 0
    ? parseFloat(((totalLikes + totalComments + totalShares) / totalViews * 100).toFixed(2))
    : 0;

  return {
    id: creatorDoc.id,
    displayName: data.displayName || '',
    email: data.email || '',
    photoURL: data.photoURL || '',
    status: data.status || 'active',
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
    stats: {
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalVideos,
      engagementRate,
    },
    linkedAccounts,
  };
}
