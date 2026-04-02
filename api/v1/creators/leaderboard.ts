/**
 * Public API v1 - Creator Leaderboard
 * GET /api/v1/creators/leaderboard - Ranked creator leaderboard sorted by metric
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeFirebase } from '../../utils/firebase-admin.js';
import { withApiAuth } from '../../middleware/apiKeyAuth.js';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';
import { getCreatorsWithStats, type EnrichedCreator } from './statsHelper.js';

initializeFirebase();

const VALID_SORT_METRICS = ['views', 'likes', 'comments', 'shares', 'engagement', 'videos'] as const;
type SortMetric = typeof VALID_SORT_METRICS[number];

function getMetricValue(creator: EnrichedCreator, metric: SortMetric): number {
  switch (metric) {
    case 'views': return creator.stats.totalViews;
    case 'likes': return creator.stats.totalLikes;
    case 'comments': return creator.stats.totalComments;
    case 'shares': return creator.stats.totalShares;
    case 'engagement': return creator.stats.engagementRate;
    case 'videos': return creator.stats.totalVideos;
  }
}

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

  const { projectId, sortBy = 'views', limit = '10' } = req.query;
  const targetProjectId = auth.projectId || projectId;

  if (!targetProjectId || typeof targetProjectId !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Project ID is required. Provide it as a query parameter or use a project-scoped API key.',
        code: 'VALIDATION_ERROR'
      }
    });
  }

  const metric = (typeof sortBy === 'string' && VALID_SORT_METRICS.includes(sortBy as SortMetric))
    ? sortBy as SortMetric
    : 'views';

  const limitNum = Math.min(Math.max(parseInt(limit as string) || 10, 1), 50);

  const allCreators = await getCreatorsWithStats(auth.organizationId, targetProjectId);

  // Sort descending by chosen metric
  const sorted = allCreators
    .sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric))
    .slice(0, limitNum);

  const leaderboard = sorted.map((creator, index) => ({
    rank: index + 1,
    creatorId: creator.id,
    displayName: creator.displayName,
    photoURL: creator.photoURL,
    score: getMetricValue(creator, metric),
    metric,
    stats: creator.stats,
    linkedAccountsCount: creator.linkedAccounts.length,
  }));

  return res.status(200).json({
    success: true,
    data: {
      leaderboard,
      meta: {
        projectId: targetProjectId,
        sortedBy: metric,
        totalCreators: allCreators.length,
        generatedAt: new Date().toISOString(),
      }
    }
  });
}

export default withApiAuth(['creators:read'], handler);
