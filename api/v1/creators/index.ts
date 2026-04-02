/**
 * Public API v1 - Creators
 * GET /api/v1/creators - List all creators in a project with computed stats
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeFirebase } from '../../utils/firebase-admin.js';
import { withApiAuth } from '../../middleware/apiKeyAuth.js';
import type { AuthenticatedApiRequest } from '../../../src/types/apiKeys';
import { getCreatorsWithStats } from './statsHelper.js';

initializeFirebase();

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

  const { projectId, limit = '50', offset = '0' } = req.query;
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

  const limitNum = Math.min(parseInt(limit as string) || 50, 100);
  const offsetNum = parseInt(offset as string) || 0;

  const allCreators = await getCreatorsWithStats(auth.organizationId, targetProjectId);
  const paginated = allCreators.slice(offsetNum, offsetNum + limitNum);

  return res.status(200).json({
    success: true,
    data: {
      creators: paginated,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total: allCreators.length,
        hasMore: allCreators.length > offsetNum + limitNum
      }
    }
  });
}

export default withApiAuth(['creators:read'], handler);
