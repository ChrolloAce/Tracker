/**
 * Public Creator Share API
 * GET /api/public-creator-share?token=xxx
 *
 * Returns a single creator's scoped dashboard data:
 *   - creator profile (name/avatar/accepts-submissions flag)
 *   - only the tracked accounts linked to this creator
 *   - only the videos from those linked accounts OR assigned to this creator
 *   - summary totals + pending job count
 *
 * No authentication — the token IS the credential. Revoked tokens return 410.
 *
 * Performance: queries only this creator's videos via targeted Firestore
 * queries instead of reading the entire project's video collection.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from './_utils/firebase-admin.js';

initializeFirebase();
const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing share token' });
  }

  try {
    // ── Round 1: token lookup (must happen first — everything depends on it) ──
    const shareDoc = await db.collection('creatorShareLinks').doc(token).get();
    if (!shareDoc.exists) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    const share = shareDoc.data()!;
    if (share.revoked) {
      return res.status(410).json({ error: 'This share link has been revoked' });
    }

    const { orgId, projectId, creatorId, acceptSubmissions } = share;
    if (!orgId || !projectId || !creatorId) {
      return res.status(500).json({ error: 'Invalid share link' });
    }

    const projectRef = db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId);

    // ── Round 2: ALL remaining reads in ONE parallel batch ────────────
    // No sequential rounds — project doc, creator doc, creator links,
    // assigned videos, and pending jobs all fire at the same time.
    const [projectDoc, creatorDoc, linksSnap, assignedVideosSnap, pendingJobsSnap] = await Promise.all([
      projectRef.get(),
      projectRef.collection('creators').doc(creatorId).get(),
      projectRef.collection('creatorLinks').where('creatorId', '==', creatorId).get(),
      // Videos directly assigned to this creator (admin "Add Videos" or share page submit)
      projectRef.collection('videos').where('assignedCreatorId', '==', creatorId).get(),
      // Pending/running jobs for the processing indicator
      db.collection('syncQueue')
        .where('assignedCreatorId', '==', creatorId)
        .where('status', 'in', ['pending', 'running'])
        .get()
        .catch(() => ({ size: 0 } as any)), // non-critical
    ]);

    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectDoc.data()!;
    // Only count recent pending jobs (under 10 min old). Older stuck jobs
    // are dead (e.g. Apify budget ran out) and shouldn't keep shimmers spinning.
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const pendingJobs: number = pendingJobsSnap.docs
      ? pendingJobsSnap.docs.filter((d: any) => {
          const created = d.data?.()?.createdAt?.toDate?.();
          return created && created > tenMinAgo;
        }).length
      : 0;

    // If the creator profile doesn't exist in this project, fall back to the
    // org member doc. This happens when a portal was created by an admin on
    // a different project — the share link references a project where the
    // creator profile was auto-created, but it may have been deleted or the
    // link might predate the auto-create fix.
    let creatorData: Record<string, any>;
    if (creatorDoc.exists) {
      creatorData = creatorDoc.data()!;
    } else {
      const memberDoc = await db
        .collection('organizations').doc(orgId)
        .collection('members').doc(creatorId)
        .get();
      if (!memberDoc.exists) {
        return res.status(404).json({ error: 'Creator not found' });
      }
      creatorData = memberDoc.data()!;
    }

    // Photo: use what's on the creator doc. Only fall back to /users/{id}
    // for non-external creators (external creators have no Firebase auth user).
    let photoURL: string = creatorData.photoURL || '';
    if (!photoURL && !creatorData.isExternal && !creatorData.addedWithoutInvite) {
      try {
        const userDoc = await db.collection('users').doc(creatorId).get();
        if (userDoc.exists) photoURL = userDoc.data()?.photoURL || '';
      } catch { /* optional */ }
    }

    // ── Linked accounts ──────────────────────────────────────────────
    const linkedAccountIds = linksSnap.docs
      .map(d => (d.data().accountId || '') as string)
      .filter(Boolean);

    // Fetch linked account docs + their videos in parallel
    let accounts: any[] = [];
    let linkedAccountVideosSnap: FirebaseFirestore.QuerySnapshot | null = null;
    let handleVideosSnap: FirebaseFirestore.QuerySnapshot | null = null;

    if (linkedAccountIds.length > 0) {
      // Account docs: parallel individual reads (avoids composite index)
      const accountDocsPromise = Promise.all(
        linkedAccountIds.map(id => projectRef.collection('trackedAccounts').doc(id).get())
      );

      // Videos from linked accounts by trackedAccountId
      const linkedVideosPromise = linkedAccountIds.length <= 30
        ? projectRef.collection('videos')
            .where('trackedAccountId', 'in', linkedAccountIds)
            .get()
        : null;

      const [accountDocs, linkedVidsSnap] = await Promise.all([
        accountDocsPromise,
        linkedVideosPromise,
      ]);

      accounts = accountDocs
        .filter(doc => doc.exists)
        .map(doc => {
          const d = doc.data()!;
          return {
            id: doc.id,
            username: d.username || '',
            displayName: d.displayName || d.username || '',
            platform: (d.platform || '') as string,
            profilePicture: d.profilePicture || '',
            followerCount: d.followerCount || 0,
            totalVideos: d.totalVideos || 0,
            totalViews: d.totalViews || 0,
            totalLikes: d.totalLikes || 0,
            totalComments: d.totalComments || 0,
          };
        });

      linkedAccountVideosSnap = linkedVidsSnap;

      // Also fetch videos by uploaderHandle — catches videos from the same
      // account regardless of which trackedAccountId they reference (handles
      // duplicate account docs or accounts tracked before the creator was linked).
      const linkedUsernames = accounts
        .map(a => a.username)
        .filter(Boolean);

      if (linkedUsernames.length > 0 && linkedUsernames.length <= 30) {
        try {
          handleVideosSnap = await projectRef.collection('videos')
            .where('uploaderHandle', 'in', linkedUsernames)
            .get();
        } catch {
          // Non-critical — trackedAccountId query already covers most cases
        }
      }
    }

    // ── Merge videos from all sources and dedupe ─────────────────────
    const accountByUsername = new Map<string, typeof accounts[number]>();
    for (const a of accounts) {
      if (a.username) accountByUsername.set(a.username.toLowerCase(), a);
    }

    const videoMap = new Map<string, any>();

    const mapVideo = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const d = doc.data();
      const uploaderHandle = (d.uploaderHandle || '') as string;
      const linkedAccount = uploaderHandle ? accountByUsername.get(uploaderHandle.toLowerCase()) : undefined;
      return {
        id: doc.id,
        url: d.url || d.videoUrl || '',
        platform: d.platform || '',
        thumbnail: d.thumbnail || '',
        title: d.title || d.videoTitle || '',
        caption: d.caption || '',
        uploader: d.uploader || d.uploaderHandle || '',
        uploaderHandle,
        uploaderProfilePicture: d.uploaderProfilePicture || linkedAccount?.profilePicture || '',
        followerCount: d.followerCount || linkedAccount?.followerCount || 0,
        trackedAccountId: (d.trackedAccountId || '') as string,
        status: 'approved',
        views: d.views || 0,
        likes: d.likes || 0,
        comments: d.comments || 0,
        shares: d.shares || 0,
        saves: d.saves || d.bookmarks || 0,
        duration: d.duration || 0,
        dateSubmitted: d.dateAdded?.toDate?.()?.toISOString() || d.uploadDate?.toDate?.()?.toISOString() || new Date().toISOString(),
        uploadDate: d.uploadDate?.toDate?.()?.toISOString() || null,
        lastRefreshed: d.lastRefreshed?.toDate?.()?.toISOString() || null,
      };
    };

    // Source 1: videos assigned directly to this creator
    for (const doc of assignedVideosSnap.docs) {
      const v = mapVideo(doc);
      videoMap.set(v.id, v);
    }

    // Source 2: videos from linked tracked accounts (by trackedAccountId)
    if (linkedAccountVideosSnap) {
      for (const doc of linkedAccountVideosSnap.docs) {
        const v = mapVideo(doc);
        if (!videoMap.has(v.id)) videoMap.set(v.id, v);
      }
    }

    // Source 3: videos matched by uploaderHandle — catches existing videos
    // from the same account even if trackedAccountId doesn't match the
    // creator's linked account doc (duplicate accounts, pre-existing videos)
    if (handleVideosSnap) {
      for (const doc of handleVideosSnap.docs) {
        const v = mapVideo(doc);
        if (!videoMap.has(v.id)) videoMap.set(v.id, v);
      }
    }

    // Filter out dead/failed videos: no thumbnail, no views, and older than
    // 10 minutes. These are Apify runs that failed (e.g. budget ran out) and
    // will never resolve — showing them as permanent shimmer cards is bad UX.
    const TEN_MINUTES_AGO = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const videos = Array.from(videoMap.values()).filter(v => {
      // Keep videos that have useful data
      if (v.thumbnail || v.views > 0 || v.likes > 0) return true;
      // Keep recent videos (still processing — under 10 min old)
      if (v.dateSubmitted && v.dateSubmitted > TEN_MINUTES_AGO) return true;
      // Drop the rest — they're dead
      return false;
    });
    videos.sort((a, b) => b.views - a.views);

    const totalViews = videos.reduce((s, v) => s + v.views, 0);
    const totalLikes = videos.reduce((s, v) => s + v.likes, 0);
    const totalComments = videos.reduce((s, v) => s + v.comments, 0);
    const totalShares = videos.reduce((s, v) => s + v.shares, 0);

    return res.status(200).json({
      success: true,
      data: {
        project: {
          name: project.name || 'Untitled Project',
          icon: project.icon || '',
          color: project.color || '',
        },
        creator: {
          id: creatorId,
          displayName: creatorData.displayName || 'Creator',
          photoURL,
        },
        acceptSubmissions: acceptSubmissions !== false,
        pendingJobs,
        summary: {
          totalAccounts: accounts.length,
          totalVideos: videos.length,
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
        },
        accounts,
        videos,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('❌ public-creator-share error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
