import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, handleCorsPreFlight, setCorsHeaders } from './_middleware/auth.js';

/**
 * POST /api/superwall-projects
 *
 * Fetches the list of projects (with their applications) from Superwall
 * using a provided API key. Used during setup so the user can pick their app.
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
    // Authenticate — any logged-in user can call this
    await authenticateRequest(req);

    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing apiKey' });
    }

    const superwallRes = await fetch('https://api.superwall.com/v2/projects?limit=100', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!superwallRes.ok) {
      const errorBody = await superwallRes.text();
      console.error(`Superwall projects error (${superwallRes.status}):`, errorBody);
      return res.status(superwallRes.status).json({
        error: superwallRes.status === 401
          ? 'Invalid API key'
          : 'Failed to fetch projects from Superwall',
        details: errorBody,
      });
    }

    const data = await superwallRes.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Superwall projects error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
