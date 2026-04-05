/**
 * Public API v1 - Viral Content
 * GET /api/v1/viral - Browse viral videos with filtering & pagination
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from '../../_utils/firebase-admin.js';
import { withApiAuth } from '../../_middleware/apiKeyAuth.js';
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
      error: { message: 'Method not allowed. Use GET.', code: 'METHOD_NOT_ALLOWED' }
    });
  }

  const {
    platform,
    category,
    tags,
    contentType,
    minViews,
    maxViews,
    sortBy = 'views',
    sortOrder = 'desc',
    limit: limitStr = '20',
    offset: offsetStr = '0',
    search,
  } = req.query;

  const limitNum = Math.min(Math.max(parseInt(limitStr as string, 10) || 20, 1), 100);
  const offsetNum = Math.max(parseInt(offsetStr as string, 10) || 0, 0);

  try {
    let query: FirebaseFirestore.Query = db.collection('viralContent');

    // Platform filter
    if (platform && typeof platform === 'string') {
      const validPlatforms = ['tiktok', 'instagram', 'youtube'];
      if (!validPlatforms.includes(platform.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`,
            code: 'INVALID_PLATFORM'
          }
        });
      }
      query = query.where('platform', '==', platform.toLowerCase());
    }

    // Category filter
    if (category && typeof category === 'string') {
      query = query.where('category', '==', category);
    }

    // Content type filter
    if (contentType && typeof contentType === 'string') {
      const validTypes = ['video', 'slideshow'];
      if (!validTypes.includes(contentType)) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Invalid contentType. Must be one of: ${validTypes.join(', ')}`,
            code: 'INVALID_CONTENT_TYPE'
          }
        });
      }
      query = query.where('contentType', '==', contentType);
    }

    // Active only
    query = query.where('isActive', '==', true);

    // Sort
    const validSortFields: Record<string, string> = {
      views: 'views',
      likes: 'likes',
      comments: 'comments',
      shares: 'shares',
      saves: 'saves',
      uploadDate: 'uploadDate',
      addedAt: 'addedAt',
      order: 'order',
    };

    const sortField = validSortFields[sortBy as string] || 'views';
    const sortDir = (sortOrder as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    query = query.orderBy(sortField, sortDir as FirebaseFirestore.OrderByDirection);

    // When searching, fetch more docs since search is client-side
    const hasClientFilters = search || tags || minViews || maxViews;
    const fetchLimit = hasClientFilters ? 500 : offsetNum + limitNum;
    query = query.limit(fetchLimit);

    const snapshot = await query.get();
    const allDocs = snapshot.docs;

    let videos = allDocs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        url: d.url,
        platform: d.platform,
        title: d.title,
        description: d.description,
        thumbnail: d.thumbnail,
        contentType: d.contentType,
        category: d.category,
        tags: d.tags || [],
        uploaderHandle: d.uploaderHandle,
        followerCount: d.followerCount,
        monetization: d.monetization || null,
        productBrand: d.productBrand || null,
        metrics: {
          views: d.views || 0,
          likes: d.likes || 0,
          comments: d.comments || 0,
          shares: d.shares || 0,
          saves: d.saves || 0,
        },
        uploadDate: d.uploadDate?.toDate?.()?.toISOString() || null,
        addedAt: d.addedAt?.toDate?.()?.toISOString() || null,
      };
    });

    // Client-side filters (can't do range queries with Firestore composite index limits)
    if (minViews && typeof minViews === 'string') {
      const min = parseInt(minViews, 10);
      if (!isNaN(min)) videos = videos.filter((v) => v.metrics.views >= min);
    }
    if (maxViews && typeof maxViews === 'string') {
      const max = parseInt(maxViews, 10);
      if (!isNaN(max)) videos = videos.filter((v) => v.metrics.views <= max);
    }

    // Tags filter (comma-separated)
    if (tags && typeof tags === 'string') {
      const tagList = tags.split(',').map((t) => t.trim().toLowerCase());
      videos = videos.filter((v) =>
        v.tags.some((t: string) => tagList.includes(t.toLowerCase()))
      );
    }

    // Search (title, description, uploaderHandle, tags, category)
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      videos = videos.filter(
        (v) =>
          v.title?.toLowerCase().includes(q) ||
          v.description?.toLowerCase().includes(q) ||
          v.uploaderHandle?.toLowerCase().includes(q) ||
          v.category?.toLowerCase().includes(q) ||
          v.tags?.some((t: string) => t.toLowerCase().includes(q))
      );
    }

    // Apply pagination AFTER client-side filters
    const totalFiltered = videos.length;
    videos = videos.slice(offsetNum, offsetNum + limitNum);

    return res.status(200).json({
      success: true,
      data: {
        videos,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total: totalFiltered,
          returned: videos.length,
          hasMore: offsetNum + limitNum < totalFiltered,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to fetch viral content',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}

// Requires viral:read scope
export default function routeHandler(req: VercelRequest, res: VercelResponse) {
  return withApiAuth(['analytics:read'] as any, handler)(req, res);
}
