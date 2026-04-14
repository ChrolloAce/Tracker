/**
 * Public Account Share API
 * GET /api/public-account-share?token=xxx
 *
 * Returns a single tracked account's scoped dashboard data:
 *   - account profile (handle, display name, platform, follower count, avatar)
 *   - videos from this account (by trackedAccountId or uploaderHandle match)
 *   - summary totals
 *
 * No authentication — the token IS the credential. Revoked tokens return 410.
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
    const shareDoc = await db.collection('accountShareLinks').doc(token).get();
    if (!shareDoc.exists) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    const share = shareDoc.data()!;
    if (share.revoked) {
      return res.status(410).json({ error: 'This share link has been revoked' });
    }

    const { orgId, projectId, accountId } = share;
    if (!orgId || !projectId || !accountId) {
      return res.status(500).json({ error: 'Invalid share link' });
    }

    const projectRef = db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId);

    const [accountDoc, accountVideosSnap] = await Promise.all([
      projectRef.collection('trackedAccounts').doc(accountId).get(),
      projectRef.collection('videos').where('trackedAccountId', '==', accountId).get(),
    ]);

    if (!accountDoc.exists) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = accountDoc.data()!;
    const username = (account.username || '') as string;

    // Also fetch videos that match by uploaderHandle — catches videos that
    // were tracked before this specific account doc, or videos stored with
    // a different trackedAccountId pointing at a duplicate account doc.
    let handleVideosSnap: FirebaseFirestore.QuerySnapshot | null = null;
    if (username) {
      try {
        handleVideosSnap = await projectRef.collection('videos')
          .where('uploaderHandle', '==', username)
          .get();
      } catch {
        // Non-critical
      }
    }

    // Merge + dedupe
    const videoMap = new Map<string, any>();

    const mapVideo = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const d = doc.data();
      return {
        id: doc.id,
        url: d.url || d.videoUrl || '',
        platform: d.platform || '',
        thumbnail: d.thumbnail || '',
        title: d.title || d.videoTitle || '',
        caption: d.caption || '',
        uploader: d.uploader || d.uploaderHandle || '',
        uploaderHandle: (d.uploaderHandle || '') as string,
        uploaderProfilePicture: d.uploaderProfilePicture || account.profilePicture || '',
        followerCount: d.followerCount || account.followerCount || 0,
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

    for (const doc of accountVideosSnap.docs) {
      const v = mapVideo(doc);
      videoMap.set(v.id, v);
    }
    if (handleVideosSnap) {
      for (const doc of handleVideosSnap.docs) {
        const v = mapVideo(doc);
        if (!videoMap.has(v.id)) videoMap.set(v.id, v);
      }
    }

    // Filter dead/failed videos (same pattern as creator share)
    const TEN_MINUTES_AGO = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const videos = Array.from(videoMap.values()).filter(v => {
      if (v.thumbnail || v.views > 0 || v.likes > 0) return true;
      if (v.dateSubmitted && v.dateSubmitted > TEN_MINUTES_AGO) return true;
      return false;
    });
    videos.sort((a, b) => b.views - a.views);

    const totalViews = videos.reduce((s, v) => s + v.views, 0);
    const totalLikes = videos.reduce((s, v) => s + v.likes, 0);
    const totalComments = videos.reduce((s, v) => s + v.comments, 0);
    const totalShares = videos.reduce((s, v) => s + v.shares, 0);
    const avgViews = videos.length > 0 ? Math.round(totalViews / videos.length) : 0;

    return res.status(200).json({
      success: true,
      data: {
        account: {
          username,
          displayName: (account.displayName as string) || username,
          platform: (account.platform as string) || '',
          profilePicture: (account.profilePicture as string) || '',
          followerCount: (account.followerCount as number) || 0,
          bio: (account.bio as string) || '',
          isVerified: (account.isVerified as boolean) || false,
        },
        summary: {
          totalVideos: videos.length,
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          avgViews,
        },
        videos,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('❌ public-account-share error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
