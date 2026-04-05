/**
 * Public Folder Share API
 * GET /api/public-folder-share?token=xxx
 *
 * Returns saved viral videos in a shared folder. No auth required.
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
    const shareDoc = await db.collection('publicFolderShares').doc(token).get();
    if (!shareDoc.exists) {
      return res.status(404).json({ error: 'Share link not found or expired' });
    }

    const { orgId, folderId, folderName } = shareDoc.data()!;
    if (!orgId || !folderId) {
      return res.status(404).json({ error: 'Invalid share link' });
    }

    // Fetch saved videos in this folder (no orderBy to avoid composite index requirement)
    const savedSnap = await db
      .collection(`organizations/${orgId}/savedViralContent`)
      .where('folderId', '==', folderId)
      .limit(200)
      .get();

    // Sort client-side by savedAt desc
    const sortedDocs = savedSnap.docs.sort((a, b) => {
      const aTime = a.data().savedAt?.toMillis?.() || 0;
      const bTime = b.data().savedAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    const videos = sortedDocs.map((d) => {
      const data = d.data();
      const video = data.video || {};
      return {
        id: d.id,
        url: video.url || '',
        platform: video.platform || '',
        title: video.title || '',
        description: video.description || '',
        thumbnail: video.thumbnail || '',
        uploaderHandle: video.uploaderHandle || '',
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0,
        shares: video.shares || 0,
        saves: video.saves || 0,
        contentType: video.contentType || 'video',
        category: video.category || '',
        tags: video.tags || [],
        followerCount: video.followerCount || 0,
        savedAt: data.savedAt?.toDate?.()?.toISOString() || null,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        folderName: folderName || 'Shared Collection',
        videoCount: videos.length,
        videos,
      },
    });
  } catch (err: any) {
    console.error('Public folder share error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
