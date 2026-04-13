import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, handleCorsPreFlight, setCorsHeaders } from './_middleware/auth.js';

/**
 * POST /api/revenuecat-projects
 *
 * Fetches the list of projects from RevenueCat using a provided API key.
 * Used during setup so the user can pick their project.
 *
 * Body: { apiKey }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCorsPreFlight(req, res)) return;
  setCorsHeaders(res, req);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await authenticateRequest(req);

    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing apiKey' });
    }

    const rcRes = await fetch('https://api.revenuecat.com/v2/projects', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!rcRes.ok) {
      const errorBody = await rcRes.text();
      console.error(`RevenueCat projects error (${rcRes.status}):`, errorBody);
      return res.status(rcRes.status).json({
        error: rcRes.status === 401
          ? 'Invalid API key'
          : 'Failed to fetch projects from RevenueCat',
        details: errorBody,
      });
    }

    const data = await rcRes.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('RevenueCat projects error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
