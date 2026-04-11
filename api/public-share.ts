/**
 * Public Project Share API
 * GET /api/public-share?token=xxx
 *
 * Returns project analytics data (accounts, videos, stats) for a valid share token.
 * No authentication required - this is a public endpoint.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from './_utils/firebase-admin.js';

initializeFirebase();
const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing share token' });
  }

  try {
    // Look up the share token
    const shareDoc = await db.collection('publicProjectShares').doc(token).get();

    if (!shareDoc.exists) {
      return res.status(404).json({ error: 'Share link not found or expired' });
    }

    const shareData = shareDoc.data()!;
    const { orgId, projectId } = shareData;

    if (!orgId || !projectId) {
      return res.status(404).json({ error: 'Invalid share link' });
    }

    // Fetch project info
    const projectDoc = await db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .get();

    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectDoc.data()!;
    const projectRef = db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId);

    // Fetch accounts, videos, creators and creator-links in parallel
    const [accountsSnapshot, videosSnapshot, creatorsSnapshot, creatorLinksSnapshot] = await Promise.all([
      projectRef.collection('trackedAccounts').get(),
      projectRef.collection('videos').get(),
      projectRef.collection('creators').get(),
      projectRef.collection('creatorLinks').get(),
    ]);

    // Process accounts
    const accounts = accountsSnapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        username: d.username || '',
        displayName: d.displayName || d.username || '',
        platform: d.platform || '',
        profilePicture: d.profilePicture || '',
        followerCount: d.followerCount || 0,
        totalVideos: d.totalVideos || 0,
        totalViews: d.totalViews || 0,
        totalLikes: d.totalLikes || 0,
        totalComments: d.totalComments || 0,
      };
    });

    // Process creators (public-facing subset: id, name, photo).
    // Creators often have an empty photoURL because it's populated lazily from
    // their Firebase user profile. Enrich any missing photoURL by reading
    // /users/{creatorId} — same pattern the authenticated dashboard uses.
    const rawCreators = creatorsSnapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        displayName: d.displayName || 'Unknown',
        photoURL: d.photoURL || '',
      };
    });

    const creators = await Promise.all(
      rawCreators.map(async (creator) => {
        if (creator.photoURL) return creator;
        try {
          const userDoc = await db.collection('users').doc(creator.id).get();
          if (userDoc.exists) {
            const userPhoto = userDoc.data()?.photoURL;
            if (userPhoto) return { ...creator, photoURL: userPhoto };
          }
        } catch {
          // photoURL is optional; fall through and let the UI render the initial
        }
        return creator;
      })
    );

    // Process creator → account links
    const creatorLinks = creatorLinksSnapshot.docs.map(doc => {
      const d = doc.data();
      return {
        creatorId: d.creatorId || '',
        accountId: d.accountId || '',
      };
    });

    // Build account lookup for enriching video data
    const accountLookup = new Map<string, any>();
    for (const acc of accounts) {
      accountLookup.set(acc.username, acc);
    }

    // Process videos in VideoSubmission-compatible format
    const videos = videosSnapshot.docs.map(doc => {
      const d = doc.data();
      const uploaderHandle = d.uploaderHandle || '';
      const linkedAccount = accountLookup.get(uploaderHandle);
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
        trackedAccountId: d.trackedAccountId || '',
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
    });

    // Sort videos by views descending
    videos.sort((a, b) => b.views - a.views);

    // Calculate totals
    const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
    const totalLikes = videos.reduce((sum, v) => sum + v.likes, 0);
    const totalComments = videos.reduce((sum, v) => sum + v.comments, 0);
    const totalShares = videos.reduce((sum, v) => sum + v.shares, 0);

    // Platform breakdown
    const platformBreakdown: Record<string, { videos: number; views: number; likes: number }> = {};
    for (const v of videos) {
      if (!platformBreakdown[v.platform]) {
        platformBreakdown[v.platform] = { videos: 0, views: 0, likes: 0 };
      }
      platformBreakdown[v.platform].videos++;
      platformBreakdown[v.platform].views += v.views;
      platformBreakdown[v.platform].likes += v.likes;
    }

    return res.status(200).json({
      success: true,
      data: {
        project: {
          name: project.name || 'Untitled Project',
          description: project.description || '',
          color: project.color || '',
          icon: project.icon || '',
        },
        summary: {
          totalAccounts: accounts.length,
          totalVideos: videos.length,
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
        },
        platformBreakdown,
        accounts,
        videos,
        creators,
        creatorLinks,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Public share error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
