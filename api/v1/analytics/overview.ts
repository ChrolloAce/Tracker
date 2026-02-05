/**
 * Public API v1 - Analytics Overview
 * GET /api/v1/analytics/overview - Get overall statistics
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../utils/firebase-admin';
import { withApiAuth } from '../../middleware/apiKeyAuth';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';

initializeFirebase();
const db = getFirestore();

async function handler(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }
    });
  }

  const { projectId, startDate, endDate } = req.query;
  const targetProjectId = auth.projectId || projectId;
  
  // Initialize stats
  const stats = {
    totalAccounts: 0,
    totalVideos: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    platformBreakdown: {
      tiktok: { accounts: 0, videos: 0, views: 0 },
      instagram: { accounts: 0, videos: 0, views: 0 },
      youtube: { accounts: 0, videos: 0, views: 0 },
      twitter: { accounts: 0, videos: 0, views: 0 }
    },
    topPerformingVideos: [] as any[],
    topCreators: [] as any[],
    recentActivity: [] as any[]
  };
  
  // Get projects to query
  const projectsToQuery: string[] = [];
  
  if (targetProjectId && typeof targetProjectId === 'string') {
    projectsToQuery.push(targetProjectId);
  } else {
    const projectsSnapshot = await db
      .collection('organizations')
      .doc(auth.organizationId)
      .collection('projects')
      .get();
    
    projectsSnapshot.docs.forEach(doc => projectsToQuery.push(doc.id));
  }
  
  // Aggregate data from all projects
  const allVideos: any[] = [];
  const accountStats: Map<string, any> = new Map();
  
  for (const projId of projectsToQuery) {
    const projectRef = db
      .collection('organizations')
      .doc(auth.organizationId)
      .collection('projects')
      .doc(projId);
    
    // Get accounts
    const accountsSnapshot = await projectRef.collection('trackedAccounts').get();
    stats.totalAccounts += accountsSnapshot.size;
    
    accountsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const platform = data.platform as keyof typeof stats.platformBreakdown;
      if (stats.platformBreakdown[platform]) {
        stats.platformBreakdown[platform].accounts++;
      }
      
      // Track top creators
      const key = `${data.username}:${data.platform}`;
      if (!accountStats.has(key)) {
        accountStats.set(key, {
          username: data.username,
          platform: data.platform,
          profilePicture: data.profilePicture,
          totalViews: data.totalViews || 0,
          totalVideos: data.totalVideos || 0,
          followerCount: data.followerCount || 0
        });
      }
    });
    
    // Get videos
    const videosSnapshot = await projectRef.collection('videos').get();
    stats.totalVideos += videosSnapshot.size;
    
    videosSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const views = data.views || 0;
      const likes = data.likes || 0;
      const comments = data.comments || 0;
      const shares = data.shares || 0;
      
      stats.totalViews += views;
      stats.totalLikes += likes;
      stats.totalComments += comments;
      stats.totalShares += shares;
      
      const platform = data.platform as keyof typeof stats.platformBreakdown;
      if (stats.platformBreakdown[platform]) {
        stats.platformBreakdown[platform].videos++;
        stats.platformBreakdown[platform].views += views;
      }
      
      allVideos.push({
        id: doc.id,
        projectId: projId,
        url: data.url,
        platform: data.platform,
        thumbnail: data.thumbnail,
        title: data.title,
        uploaderHandle: data.uploaderHandle,
        views,
        likes,
        comments,
        uploadDate: data.uploadDate?.toDate?.()?.toISOString(),
        lastRefreshed: data.lastRefreshed?.toDate?.()?.toISOString()
      });
    });
  }
  
  // Get top performing videos (by views)
  stats.topPerformingVideos = allVideos
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)
    .map(v => ({
      id: v.id,
      title: v.title,
      platform: v.platform,
      thumbnail: v.thumbnail,
      uploaderHandle: v.uploaderHandle,
      views: v.views,
      likes: v.likes
    }));
  
  // Get top creators (by total views)
  stats.topCreators = Array.from(accountStats.values())
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 10);
  
  // Get recent activity (last 10 videos by upload date)
  stats.recentActivity = allVideos
    .filter(v => v.uploadDate)
    .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
    .slice(0, 10)
    .map(v => ({
      id: v.id,
      title: v.title,
      platform: v.platform,
      uploaderHandle: v.uploaderHandle,
      views: v.views,
      uploadDate: v.uploadDate
    }));
  
  // Calculate averages
  const averages = {
    viewsPerVideo: stats.totalVideos > 0 ? Math.round(stats.totalViews / stats.totalVideos) : 0,
    likesPerVideo: stats.totalVideos > 0 ? Math.round(stats.totalLikes / stats.totalVideos) : 0,
    engagementRate: stats.totalViews > 0 
      ? ((stats.totalLikes + stats.totalComments) / stats.totalViews * 100).toFixed(2) + '%'
      : '0%'
  };
  
  return res.status(200).json({
    success: true,
    data: {
      summary: {
        totalAccounts: stats.totalAccounts,
        totalVideos: stats.totalVideos,
        totalViews: stats.totalViews,
        totalLikes: stats.totalLikes,
        totalComments: stats.totalComments,
        totalShares: stats.totalShares
      },
      averages,
      platformBreakdown: stats.platformBreakdown,
      topPerformingVideos: stats.topPerformingVideos,
      topCreators: stats.topCreators,
      recentActivity: stats.recentActivity,
      generatedAt: new Date().toISOString()
    }
  });
}

export default withApiAuth(['analytics:read'], handler);
