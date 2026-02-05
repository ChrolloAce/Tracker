/**
 * Public API v1 - Videos
 * GET /api/v1/videos - List all tracked videos
 * POST /api/v1/videos - Add video to track
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
  switch (req.method) {
    case 'GET':
      return await listVideos(req, res, auth);
    case 'POST':
      return await addVideo(req, res, auth);
    default:
      return res.status(405).json({
        success: false,
        error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }
      });
  }
}

/**
 * List all videos for organization
 */
async function listVideos(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const { 
    projectId, 
    platform, 
    status,
    sortBy = 'uploadDate',
    sortOrder = 'desc',
    limit = '50', 
    offset = '0' 
  } = req.query;
  
  const targetProjectId = auth.projectId || projectId;
  
  // If we have a specific project, query that
  if (targetProjectId && typeof targetProjectId === 'string') {
    return await listVideosFromProject(req, res, auth, targetProjectId);
  }
  
  // Otherwise, aggregate across all projects
  const projectsSnapshot = await db
    .collection('organizations')
    .doc(auth.organizationId)
    .collection('projects')
    .get();
  
  const allVideos: any[] = [];
  
  for (const projectDoc of projectsSnapshot.docs) {
    let query: FirebaseFirestore.Query = projectDoc.ref.collection('videos');
    
    if (platform && typeof platform === 'string') {
      query = query.where('platform', '==', platform);
    }
    
    if (status && typeof status === 'string') {
      query = query.where('status', '==', status);
    }
    
    const videosSnapshot = await query.limit(100).get();
    
    videosSnapshot.docs.forEach(vDoc => {
      const data = vDoc.data();
      allVideos.push({
        id: vDoc.id,
        projectId: projectDoc.id,
        url: data.url,
        platform: data.platform,
        thumbnail: data.thumbnail,
        title: data.title,
        caption: data.caption,
        uploaderHandle: data.uploaderHandle,
        views: data.views || 0,
        likes: data.likes || 0,
        comments: data.comments || 0,
        shares: data.shares || 0,
        status: data.status,
        uploadDate: data.uploadDate?.toDate?.()?.toISOString(),
        lastRefreshed: data.lastRefreshed?.toDate?.()?.toISOString()
      });
    });
  }
  
  // Sort
  const sortField = sortBy as string;
  const order = sortOrder === 'asc' ? 1 : -1;
  allVideos.sort((a, b) => {
    const aVal = a[sortField] || 0;
    const bVal = b[sortField] || 0;
    if (typeof aVal === 'string') return aVal.localeCompare(bVal) * order;
    return (aVal - bVal) * order;
  });
  
  // Paginate
  const limitNum = Math.min(parseInt(limit as string) || 50, 100);
  const offsetNum = parseInt(offset as string) || 0;
  const paginatedVideos = allVideos.slice(offsetNum, offsetNum + limitNum);
  
  return res.status(200).json({
    success: true,
    data: {
      videos: paginatedVideos,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total: allVideos.length,
        hasMore: allVideos.length > offsetNum + limitNum
      }
    }
  });
}

/**
 * List videos from a specific project
 */
async function listVideosFromProject(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest,
  projectId: string
) {
  const { platform, status, limit = '50', offset = '0' } = req.query;
  
  let query: FirebaseFirestore.Query = db
    .collection('organizations')
    .doc(auth.organizationId)
    .collection('projects')
    .doc(projectId)
    .collection('videos');
  
  if (platform && typeof platform === 'string') {
    query = query.where('platform', '==', platform);
  }
  
  if (status && typeof status === 'string') {
    query = query.where('status', '==', status);
  }
  
  query = query.orderBy('uploadDate', 'desc');
  
  const limitNum = Math.min(parseInt(limit as string) || 50, 100);
  const offsetNum = parseInt(offset as string) || 0;
  
  const snapshot = await query.limit(limitNum + offsetNum).get();
  
  const videos = snapshot.docs
    .slice(offsetNum)
    .slice(0, limitNum)
    .map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        projectId,
        url: data.url,
        platform: data.platform,
        thumbnail: data.thumbnail,
        title: data.title,
        caption: data.caption,
        uploaderHandle: data.uploaderHandle,
        views: data.views || 0,
        likes: data.likes || 0,
        comments: data.comments || 0,
        shares: data.shares || 0,
        status: data.status,
        uploadDate: data.uploadDate?.toDate?.()?.toISOString(),
        lastRefreshed: data.lastRefreshed?.toDate?.()?.toISOString()
      };
    });
  
  return res.status(200).json({
    success: true,
    data: {
      videos,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total: snapshot.size,
        hasMore: snapshot.size > offsetNum + limitNum
      }
    }
  });
}

/**
 * Add a video to track
 */
async function addVideo(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest
) {
  const { url, projectId } = req.body;
  
  if (!url) {
    return res.status(400).json({
      success: false,
      error: { message: 'Video URL is required', code: 'VALIDATION_ERROR' }
    });
  }
  
  const targetProjectId = auth.projectId || projectId;
  if (!targetProjectId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Project ID required', code: 'VALIDATION_ERROR' }
    });
  }
  
  // Detect platform from URL
  let platform: string | null = null;
  if (url.includes('tiktok.com')) platform = 'tiktok';
  else if (url.includes('instagram.com')) platform = 'instagram';
  else if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'youtube';
  else if (url.includes('twitter.com') || url.includes('x.com')) platform = 'twitter';
  
  if (!platform) {
    return res.status(400).json({
      success: false,
      error: { message: 'Unsupported platform. Use TikTok, Instagram, YouTube, or Twitter URLs', code: 'VALIDATION_ERROR' }
    });
  }
  
  // Check if video already exists
  const existingQuery = await db
    .collection('organizations')
    .doc(auth.organizationId)
    .collection('projects')
    .doc(targetProjectId)
    .collection('videos')
    .where('url', '==', url)
    .limit(1)
    .get();
  
  if (!existingQuery.empty) {
    return res.status(409).json({
      success: false,
      error: { message: 'Video already being tracked', code: 'ALREADY_EXISTS' }
    });
  }
  
  // Create video document (will be processed by sync system)
  const videoData = {
    url,
    platform,
    status: 'pending',
    syncStatus: 'pending',
    views: 0,
    likes: 0,
    comments: 0,
    organizationId: auth.organizationId,
    projectId: targetProjectId,
    dateSubmitted: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const docRef = await db
    .collection('organizations')
    .doc(auth.organizationId)
    .collection('projects')
    .doc(targetProjectId)
    .collection('videos')
    .add(videoData);
  
  return res.status(201).json({
    success: true,
    data: {
      id: docRef.id,
      url,
      platform,
      status: 'pending',
      message: 'Video added. Metrics will be fetched shortly.'
    }
  });
}

// Export with authentication wrapper
export default withApiAuth(['videos:read'], handler);
