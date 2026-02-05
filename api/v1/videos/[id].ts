/**
 * Public API v1 - Single Video Operations
 * GET /api/v1/videos/:id - Get video details with snapshots
 * DELETE /api/v1/videos/:id - Remove tracked video
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
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Video ID required', code: 'VALIDATION_ERROR' }
    });
  }

  switch (req.method) {
    case 'GET':
      return await getVideo(req, res, auth, id);
    case 'DELETE':
      return await deleteVideo(req, res, auth, id);
    default:
      return res.status(405).json({
        success: false,
        error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }
      });
  }
}

/**
 * Find video across all projects in organization
 */
async function findVideo(orgId: string, videoId: string, projectId?: string) {
  if (projectId) {
    const docRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('videos')
      .doc(videoId);
    
    const doc = await docRef.get();
    if (doc.exists) {
      return { doc, projectId };
    }
  }
  
  // Search across all projects
  const projectsSnapshot = await db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .get();
  
  for (const projectDoc of projectsSnapshot.docs) {
    const videoDoc = await projectDoc.ref
      .collection('videos')
      .doc(videoId)
      .get();
    
    if (videoDoc.exists) {
      return { doc: videoDoc, projectId: projectDoc.id };
    }
  }
  
  return null;
}

/**
 * Get video details with optional snapshots history
 */
async function getVideo(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest,
  videoId: string
) {
  const result = await findVideo(auth.organizationId, videoId, auth.projectId);
  
  if (!result) {
    return res.status(404).json({
      success: false,
      error: { message: 'Video not found', code: 'NOT_FOUND' }
    });
  }
  
  const { doc, projectId } = result;
  const data = doc.data()!;
  
  // Include snapshots history if requested
  const includeSnapshots = req.query.includeSnapshots === 'true';
  let snapshots: any[] = [];
  
  if (includeSnapshots) {
    const snapshotsSnapshot = await doc.ref
      .collection('snapshots')
      .orderBy('capturedAt', 'desc')
      .limit(100)
      .get();
    
    snapshots = snapshotsSnapshot.docs.map(sDoc => {
      const sData = sDoc.data();
      return {
        id: sDoc.id,
        views: sData.views,
        likes: sData.likes,
        comments: sData.comments,
        shares: sData.shares,
        capturedAt: sData.capturedAt?.toDate?.()?.toISOString()
      };
    });
  }
  
  // Calculate growth metrics
  let growth = null;
  if (data.snapshots && data.snapshots.length >= 2) {
    const sorted = [...data.snapshots].sort((a: any, b: any) => 
      new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
    );
    const latest = sorted[0];
    const previous = sorted[1];
    
    growth = {
      views: latest.views - previous.views,
      likes: latest.likes - previous.likes,
      comments: latest.comments - previous.comments,
      period: {
        from: previous.capturedAt,
        to: latest.capturedAt
      }
    };
  }
  
  return res.status(200).json({
    success: true,
    data: {
      id: doc.id,
      projectId,
      url: data.url,
      platform: data.platform,
      thumbnail: data.thumbnail,
      title: data.title,
      caption: data.caption,
      uploaderHandle: data.uploaderHandle,
      uploaderProfilePicture: data.uploaderProfilePicture,
      metrics: {
        views: data.views || 0,
        likes: data.likes || 0,
        comments: data.comments || 0,
        shares: data.shares || 0,
        saves: data.saves || 0
      },
      growth,
      status: data.status,
      syncStatus: data.syncStatus,
      uploadDate: data.uploadDate?.toDate?.()?.toISOString(),
      lastRefreshed: data.lastRefreshed?.toDate?.()?.toISOString(),
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.dateSubmitted?.toDate?.()?.toISOString(),
      ...(includeSnapshots && { snapshots })
    }
  });
}

/**
 * Delete a tracked video
 */
async function deleteVideo(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthenticatedApiRequest,
  videoId: string
) {
  const result = await findVideo(auth.organizationId, videoId, auth.projectId);
  
  if (!result) {
    return res.status(404).json({
      success: false,
      error: { message: 'Video not found', code: 'NOT_FOUND' }
    });
  }
  
  // Delete the video
  await result.doc.ref.delete();
  
  return res.status(200).json({
    success: true,
    message: 'Video removed from tracking'
  });
}

// Dynamic scopes based on method
export default async function routeHandler(req: VercelRequest, res: VercelResponse) {
  const scopes = req.method === 'DELETE' ? ['videos:write'] : ['videos:read'];
  return withApiAuth(scopes as any, handler)(req, res);
}
