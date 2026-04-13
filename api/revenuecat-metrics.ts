import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAndVerifyOrg, handleCorsPreFlight, setCorsHeaders } from './_middleware/auth.js';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * POST /api/revenuecat-metrics
 *
 * Proxies chart data requests to the RevenueCat Charts API.
 * Reads the RevenueCat API key + project ID from org settings in Firestore.
 *
 * Body: { orgId, chartName, resolution, startTime, endTime }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCorsPreFlight(req, res)) return;
  setCorsHeaders(res, req);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orgId, chartName, resolution, startDate, endDate } = req.body;

    if (!orgId || !chartName) {
      return res.status(400).json({ error: 'Missing required fields: orgId, chartName' });
    }

    const { user } = await authenticateAndVerifyOrg(req, orgId);
    console.log(`📊 RevenueCat metrics request from ${user.email} for org ${orgId}, chart=${chartName}`);

    const db = getFirestore();
    const settingsDoc = await db
      .collection('organizations').doc(orgId)
      .collection('settings').doc('general')
      .get();

    const settings = settingsDoc.data();
    const rcApiKey = settings?.integrations?.revenuecat?.apiKey;
    const rcProjectId = settings?.integrations?.revenuecat?.projectId;

    if (!rcApiKey || !rcProjectId) {
      return res.status(400).json({
        error: 'RevenueCat not configured',
        code: 'REVENUECAT_NOT_CONFIGURED',
      });
    }

    // Build query params — RC uses start_date/end_date with YYYY-MM-DD format
    const params = new URLSearchParams();
    if (resolution) params.set('resolution', resolution);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);

    const url = `https://api.revenuecat.com/v2/projects/${rcProjectId}/charts/${chartName}?${params.toString()}`;

    const rcRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${rcApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!rcRes.ok) {
      const errorBody = await rcRes.text();
      console.error(`RevenueCat API error (${rcRes.status}):`, errorBody);
      return res.status(rcRes.status).json({
        error: 'RevenueCat API request failed',
        details: errorBody,
      });
    }

    const data = await rcRes.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('RevenueCat metrics error:', error);
    return res.status(error.message?.includes('Access denied') ? 403 : 500).json({
      error: error.message || 'Internal server error',
    });
  }
}
