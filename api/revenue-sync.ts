/**
 * Revenue Sync API Endpoint
 * Proxies requests to RevenueCat and Superwall APIs to avoid CORS issues
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Helper to make API calls with proper error handling
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { provider, action, credentials, startDate, endDate, limit = 100 } = req.body;

    if (!provider || !action || !credentials) {
      return res.status(400).json({ error: 'Missing required fields: provider, action, credentials' });
    }

    // ==================== REVENUECAT ====================
    if (provider === 'revenuecat') {
      const { apiKey } = credentials;

      if (!apiKey) {
        return res.status(400).json({ error: 'Missing RevenueCat API key' });
      }

      const baseUrl = 'https://api.revenuecat.com/v1';

      // Test connection
      if (action === 'test') {
        try {
          const response = await fetchWithTimeout(
            `${baseUrl}/subscribers/overview`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            return res.status(200).json({ success: true });
          } else {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            return res.status(response.status).json({ 
              success: false, 
              error: error.message || 'API connection failed' 
            });
          }
        } catch (error: any) {
          return res.status(500).json({ 
            success: false, 
            error: error.message || 'Connection failed' 
          });
        }
      }

      // Fetch transactions
      // IMPORTANT: RevenueCat's public REST API v1 does NOT support fetching transaction lists
      // You must use webhooks to receive transaction data in real-time
      // Reference: https://www.revenuecat.com/docs/integrations/webhooks
      if (action === 'fetchTransactions') {
        // Return helpful message about webhook requirement
        return res.status(200).json({
          success: true,
          data: {
            transactions: [],
            webhook_required: true,
            message: 'RevenueCat requires webhooks to sync transaction data. Please set up webhooks in your RevenueCat dashboard to receive real-time transaction events.',
            setup_url: 'https://www.revenuecat.com/docs/integrations/webhooks'
          }
        });
      }

      // Fetch overview
      if (action === 'fetchOverview') {
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'Missing startDate or endDate' });
        }

        try {
          const params = new URLSearchParams({
            start_date: startDate.split('T')[0], // Just the date part
            end_date: endDate.split('T')[0],
          });

          const response = await fetchWithTimeout(
            `${baseUrl}/subscribers/overview?${params}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            return res.status(200).json({ success: true, data });
          } else {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            return res.status(response.status).json({ 
              success: false, 
              error: error.message || 'Failed to fetch overview' 
            });
          }
        } catch (error: any) {
          return res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to fetch overview' 
          });
        }
      }
    }

    // ==================== SUPERWALL ====================
    if (provider === 'superwall') {
      const { apiKey, appId } = credentials;

      if (!apiKey || !appId) {
        return res.status(400).json({ error: 'Missing Superwall API key or App ID' });
      }

      const baseUrl = 'https://api.superwall.com/v1';

      // Test connection
      if (action === 'test') {
        try {
          const params = new URLSearchParams({ app_id: appId });

          const response = await fetchWithTimeout(
            `${baseUrl}/paywalls?${params}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            return res.status(200).json({ success: true });
          } else {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            return res.status(response.status).json({ 
              success: false, 
              error: error.message || 'API connection failed' 
            });
          }
        } catch (error: any) {
          return res.status(500).json({ 
            success: false, 
            error: error.message || 'Connection failed' 
          });
        }
      }

      // Fetch conversion events
      if (action === 'fetchConversionEvents') {
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'Missing startDate or endDate' });
        }

        try {
          const params = new URLSearchParams({
            app_id: appId,
            event_name: 'subscription_start',
            start_date: startDate,
            end_date: endDate,
            limit: limit.toString(),
          });

          const response = await fetchWithTimeout(
            `${baseUrl}/events?${params}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            return res.status(200).json({ success: true, data });
          } else {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            return res.status(response.status).json({ 
              success: false, 
              error: error.message || 'Failed to fetch events' 
            });
          }
        } catch (error: any) {
          return res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to fetch events' 
          });
        }
      }

      // Fetch paywall analytics
      if (action === 'fetchPaywallAnalytics') {
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'Missing startDate or endDate' });
        }

        try {
          const params = new URLSearchParams({
            app_id: appId,
            start_date: startDate,
            end_date: endDate,
          });

          const response = await fetchWithTimeout(
            `${baseUrl}/analytics/paywalls?${params}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            return res.status(200).json({ success: true, data });
          } else {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            return res.status(response.status).json({ 
              success: false, 
              error: error.message || 'Failed to fetch paywall analytics' 
            });
          }
        } catch (error: any) {
          return res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to fetch paywall analytics' 
          });
        }
      }
    }

    return res.status(400).json({ error: 'Invalid provider or action' });

  } catch (error: any) {
    console.error('Revenue sync error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}

