/**
 * Public Project Share API
 * GET /api/public-share?token=xxx
 *
 * Returns project analytics data (accounts, videos, stats) for a valid share token.
 * No authentication required - this is a public endpoint.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from './utils/firebase-admin.js';

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

    // Fetch accounts and videos in parallel
    const [accountsSnapshot, videosSnapshot] = await Promise.all([
      projectRef.collection('trackedAccounts').get(),
      projectRef.collection('videos').get(),
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

    // Process videos
    const videos = videosSnapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        platform: d.platform || '',
        videoUrl: d.url || d.videoUrl || '',
        title: d.title || d.videoTitle || '',
        caption: d.caption || '',
        thumbnail: d.thumbnail || '',
        uploaderHandle: d.uploaderHandle || '',
        views: d.views || 0,
        likes: d.likes || 0,
        comments: d.comments || 0,
        shares: d.shares || 0,
        uploadDate: d.uploadDate?.toDate?.()?.toISOString() || null,
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
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Public share error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
