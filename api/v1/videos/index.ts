/**
 * Public API v1 - Videos
 * GET /api/v1/videos - List all tracked videos
 * POST /api/v1/videos - Add video to track
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../utils/firebase-admin.js';
import { withApiAuth } from '../../middleware/apiKeyAuth.js';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';

const JOB_PRIORITY_USER_INITIATED = 100;
const BASE_URL = 'https://www.viewtrack.app';

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
 * Mirrors the manual video submission flow:
 * 1. Validate & detect platform
 * 2. Check for duplicates
 * 3. Create a pending video doc
 * 4. Create a high-priority syncQueue job
 * 5. Dispatch to process-single-video for immediate processing
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
  
  // Step 1: Create pending video document (same fields as manual flow)
  const videoData = {
    url,
    platform,
    videoId: `temp-${Date.now()}`,
    thumbnail: '',
    title: 'Processing...',
    description: '',
    uploadDate: Timestamp.now(),
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    status: 'processing',
    isSingular: false,
    syncStatus: 'pending',
    syncRequestedAt: Timestamp.now(),
    syncRetryCount: 0,
    organizationId: auth.organizationId,
    projectId: targetProjectId,
    dateSubmitted: Timestamp.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  const docRef = await db
    .collection('organizations')
    .doc(auth.organizationId)
    .collection('projects')
    .doc(targetProjectId)
    .collection('videos')
    .add(videoData);

  console.log(`📹 [API] Video doc created: ${docRef.id} for ${url}`);
  
  // Step 2: Create high-priority syncQueue job (same as queue-manual-video)
  const jobRef = db.collection('syncQueue').doc();
  await jobRef.set({
    type: 'single_video',
    status: 'pending',
    orgId: auth.organizationId,
    projectId: targetProjectId,
    videoUrl: url,
    addedBy: 'api',
    createdAt: Timestamp.now(),
    startedAt: null,
    completedAt: null,
    attempts: 0,
    maxAttempts: 3,
    priority: JOB_PRIORITY_USER_INITIATED,
    error: null,
    userInitiated: true
  });
  
  console.log(`📋 [API] SyncQueue job created: ${jobRef.id}`);

  // Step 3: Dispatch to process-single-video for immediate processing
  const cronSecret = process.env.CRON_SECRET;
  let processingStatus = 'queued';
  
  try {
    const dispatchResponse = await fetch(`${BASE_URL}/api/process-single-video`, {
      method: 'POST',
      headers: {
        'Authorization': cronSecret || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        videoId: url,
        orgId: auth.organizationId,
        projectId: targetProjectId,
        jobId: jobRef.id,
        addedBy: 'api'
      })
    });
    
    if (dispatchResponse.ok) {
      await jobRef.update({
        status: 'running',
        startedAt: Timestamp.now()
      });
      processingStatus = 'processing';
      console.log(`⚡ [API] Immediate dispatch successful for ${url}`);
    } else {
      console.warn(`⚠️ [API] Dispatch returned ${dispatchResponse.status}, falling back to queue`);
    }
  } catch (dispatchError: any) {
    console.warn(`⚠️ [API] Immediate dispatch failed: ${dispatchError.message}, job stays queued`);
    
    // Trigger queue-worker as fallback
    fetch(`${BASE_URL}/api/queue-worker`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ trigger: 'api_video_added' })
    }).catch(() => {});
  }
  
  return res.status(201).json({
    success: true,
    data: {
      id: docRef.id,
      url,
      platform,
      status: processingStatus,
      jobId: jobRef.id,
      message: processingStatus === 'processing'
        ? 'Video dispatched for immediate processing. Metrics typically available within 30-60 seconds.'
        : 'Video queued for processing. Metrics will be available shortly.'
    }
  });
}

// Export — handler checks method internally, so accept both read & write scopes
export default withApiAuth(['videos:read'], handler);
