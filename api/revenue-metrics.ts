import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAndVerifyOrg, handleCorsPreFlight, setCorsHeaders } from './_middleware/auth.js';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * POST /api/revenue-metrics
 *
 * Proxies chart data requests to the Superwall Charts V2 API.
 * Reads the Superwall API key from org settings in Firestore.
 *
 * Body: { orgId, applicationId, yAxis, xAxis, dateFilter, dateInterval, include? }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCorsPreFlight(req, res)) return;
  setCorsHeaders(res, req);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orgId, applicationId, yAxis, xAxis, dateFilter, dateInterval, include } = req.body;

    if (!orgId || !applicationId || !yAxis || !xAxis) {
      return res.status(400).json({ error: 'Missing required fields: orgId, applicationId, yAxis, xAxis' });
    }

    // Authenticate user and verify org access
    const { user } = await authenticateAndVerifyOrg(req, orgId);
    console.log(`📊 Revenue metrics request from ${user.email} for org ${orgId}`);

    // Read Superwall API key from org settings
    const db = getFirestore();
    const settingsDoc = await db
      .collection('organizations')
      .doc(orgId)
      .collection('settings')
      .doc('general')
      .get();

    const settings = settingsDoc.data();
    const superwallApiKey = settings?.integrations?.superwall?.apiKey;

    if (!superwallApiKey) {
      return res.status(400).json({
        error: 'Superwall API key not configured',
        code: 'SUPERWALL_NOT_CONFIGURED',
      });
    }

    // Build request body for Superwall Charts V2 API
    const superwallBody: Record<string, any> = {
      application_id: applicationId,
      y_axis: yAxis,
      x_axis: xAxis,
    };

    if (dateFilter) superwallBody.date_filter = dateFilter;
    if (dateInterval) superwallBody.date_interval = dateInterval;
    if (include) superwallBody.include = include;

    // Only show production data
    superwallBody.environment = ['PRODUCTION'];

    // Proxy to Superwall
    const superwallRes = await fetch('https://api.superwall.com/v2/charts/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superwallApiKey}`,
      },
      body: JSON.stringify(superwallBody),
    });

    if (!superwallRes.ok) {
      const errorBody = await superwallRes.text();
      console.error(`Superwall API error (${superwallRes.status}):`, errorBody);
      return res.status(superwallRes.status).json({
        error: 'Superwall API request failed',
        details: errorBody,
      });
    }

    const data = await superwallRes.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Revenue metrics error:', error);
    return res.status(error.message?.includes('Access denied') ? 403 : 500).json({
      error: error.message || 'Internal server error',
    });
  }
}
