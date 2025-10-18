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
      const baseUrlV2 = 'https://api.revenuecat.com/v2';

      // Test connection - use v2 endpoint with project_id
      if (action === 'test') {
        try {
          // Get project ID from credentials
          const { projectId } = req.body;
          
          if (!projectId) {
            return res.status(400).json({ 
              success: false, 
              error: 'Project ID is required to test the connection' 
            });
          }

          // Test using overview metrics endpoint (only available aggregate endpoint)
          const response = await fetchWithTimeout(
            `${baseUrlV2}/projects/${projectId}/metrics/overview?currency=USD`,
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
            const errorText = await response.text();
            let error;
            try {
              error = JSON.parse(errorText);
            } catch {
              error = { message: errorText || 'Unknown error' };
            }
            
            return res.status(response.status).json({ 
              success: false, 
              error: error.message || error.error || 'API connection failed',
              hint: response.status === 403 ? 'Make sure you created a V2 API key with the required permissions (metrics read access)' : undefined
            });
          }
        } catch (error: any) {
          return res.status(500).json({ 
            success: false, 
            error: error.message || 'Connection failed' 
          });
        }
      }

      // Fetch overview metrics (aggregate data)
      // Note: For transaction-level data, webhooks are required
      // Reference: https://docs.revenuecat.com/reference/get-overview-metrics-for-a-project
      if (action === 'fetchTransactions') {
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'Missing startDate or endDate' });
        }

        try {
          // Note: This endpoint requires a project_id, not just an API key
          // The project_id should be passed in the request body
          const { projectId } = req.body;
          
          if (!projectId) {
            return res.status(400).json({ 
              error: 'Missing projectId. Please provide your RevenueCat project ID.' 
            });
          }

          const baseUrlV2 = 'https://api.revenuecat.com/v2';
          
          // RevenueCat's public REST API doesn't have a date-filtered revenue endpoint
          // The best we can do is use the overview metrics endpoint
          // Note: This returns ALL TIME data, not date-filtered
          // For date-filtered transaction data, webhooks are required
          
          console.log('⚠️ RevenueCat API limitation: Fetching overview metrics (all-time data)');
          console.log('⚠️ Date filtering requires webhook integration for real-time transaction tracking');
          console.log('Requested date range (will be ignored by API):', {
            start: new Date(startDate).toISOString().split('T')[0],
            end: new Date(endDate).toISOString().split('T')[0]
          });
          
          // Use overview metrics endpoint (only available endpoint for aggregate data)
          const response = await fetchWithTimeout(
            `${baseUrlV2}/projects/${projectId}/metrics/overview?currency=USD`,
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
            
            console.log('RevenueCat Overview API response:', JSON.stringify(data));
            
            // Transform overview metrics to transaction format
            // This gives ALL-TIME aggregate data, NOT date-filtered
            const transactions = [];
            let totalRevenue = 0;
            
            if (data.metrics && Array.isArray(data.metrics)) {
              const now = Date.now();
              
              // Parse metrics by ID
              const metrics = data.metrics.reduce((acc: any, metric: any) => {
                acc[metric.id] = metric.value;
                return acc;
              }, {});

              console.log('Parsed metrics:', metrics);

              // Extract revenue metrics (try different possible IDs)
              totalRevenue = metrics.revenue || 
                             metrics.total_revenue || 
                             metrics.lifetime_revenue || 
                             metrics.active_subscriptions_revenue || 
                             0;
              
              const mrr = metrics.mrr || metrics.monthly_recurring_revenue || 0;
              const activeSubscriptions = metrics.active_subscriptions || 
                                         metrics.active_subscribers || 
                                         metrics.active_trials || 
                                         0;

              console.log('Extracted values:', { totalRevenue, mrr, activeSubscriptions });

              // Create a single aggregate transaction
              // WARNING: This is ALL TIME data, not filtered by the requested date range
              if (totalRevenue > 0 || mrr > 0) {
                transactions.push({
                  id: `rc_all_time_${now}`,
                  date: new Date().toISOString(),
                  revenue: totalRevenue,
                  mrr: mrr,
                  active_subscriptions: activeSubscriptions,
                  currency: 'USD',
                  type: 'all_time_aggregate',
                  warning: 'This is ALL-TIME data, not filtered by date range'
                });
              }
            }
            
            console.log(`Returning ${transactions.length} transaction(s) with total revenue: $${totalRevenue}`);
            
            return res.status(200).json({ 
              success: true, 
              data: { 
                transactions,
                raw_data: data, // Include raw data for debugging
                warning: 'RevenueCat REST API does not support date-filtered revenue queries',
                recommendation: 'For date-specific revenue tracking, set up webhooks: /REVENUECAT_SETUP_GUIDE.md',
                note: transactions.length === 0 
                  ? 'No revenue data found. Check that you have active subscriptions and the correct project ID.'
                  : `Showing ALL-TIME aggregate metrics (not filtered by date range)`
              } 
            });
          } else {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { message: errorText || 'Unknown error' };
            }
            
            return res.status(response.status).json({ 
              success: false, 
              error: errorData.message || errorData.error || 'Failed to fetch metrics',
              details: errorData
            });
          }
        } catch (error: any) {
          return res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to fetch metrics',
            details: error.toString()
          });
        }
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

