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

          // Test using Charts API with date range (same endpoint used for syncing)
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);
          
          const formatDate = (date: Date) => date.toISOString().split('T')[0];
          
          const params = new URLSearchParams({
            start_date: formatDate(startDate),
            end_date: formatDate(endDate),
            currency: 'USD'
          });
          
          const response = await fetchWithTimeout(
            `${baseUrlV2}/projects/${projectId}/charts/revenue?${params.toString()}`,
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
              hint: response.status === 403 ? 'Make sure you created a V2 API key with charts:revenue:read permission' : undefined
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
          
          // Use Charts API with date range support
          // Format dates as YYYY-MM-DD for RevenueCat
          const formatDate = (dateStr: string) => {
            const date = new Date(dateStr);
            return date.toISOString().split('T')[0];
          };
          
          const params = new URLSearchParams({
            start_date: formatDate(startDate),
            end_date: formatDate(endDate),
            currency: 'USD'
          });
          
          console.log('Fetching RevenueCat data for date range:', {
            start_date: formatDate(startDate),
            end_date: formatDate(endDate)
          });
          
          // Fetch revenue chart data (supports date filtering)
          const response = await fetchWithTimeout(
            `${baseUrlV2}/projects/${projectId}/charts/revenue?${params.toString()}`,
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
            
            console.log('RevenueCat Charts API response:', JSON.stringify(data));
            
            // Transform Charts API response to transaction format
            // Charts API returns time-series data with data points
            const transactions = [];
            
            // Try different possible response formats
            let totalRevenue = 0;
            let dataPoints: any[] = [];
            
            if (data.data_points && Array.isArray(data.data_points)) {
              // Format: { data_points: [ { date: "2024-01-01", value: 100 } ] }
              dataPoints = data.data_points;
            } else if (data.results && Array.isArray(data.results)) {
              // Format: { results: [...] }
              dataPoints = data.results;
            } else if (data.series && Array.isArray(data.series)) {
              // Format: { series: [...] }
              dataPoints = data.series;
            } else if (Array.isArray(data)) {
              // Format: [{ date: "2024-01-01", value: 100 }]
              dataPoints = data;
            }

            console.log('Parsed data points:', dataPoints.length, 'points');

            // Sum up revenue from all data points in the range
            if (dataPoints.length > 0) {
              totalRevenue = dataPoints.reduce((sum: number, point: any) => {
                const value = point.value || point.revenue || point.amount || 0;
                return sum + value;
              }, 0);
              
              console.log('Total revenue from data points:', totalRevenue);
              
              // Create a single aggregate transaction for the period
              if (totalRevenue > 0) {
                const now = Date.now();
                transactions.push({
                  id: `rc_period_${now}`,
                  date: new Date().toISOString(),
                  revenue: totalRevenue,
                  currency: 'USD',
                  type: 'period_aggregate',
                  period: {
                    start: formatDate(startDate),
                    end: formatDate(endDate)
                  }
                });
              }
            } else {
              console.log('No data points found, trying direct metrics extraction');
              
              // Fallback: Try to extract direct metrics if available
              const revenue = data.revenue || data.total_revenue || data.value || 0;
              if (revenue > 0) {
                totalRevenue = revenue;
                transactions.push({
                  id: `rc_aggregate_${Date.now()}`,
                  date: new Date().toISOString(),
                  revenue: totalRevenue,
                  currency: 'USD',
                  type: 'aggregate_metrics',
                });
              }
            }
            
            console.log(`Returning ${transactions.length} transaction(s) with total revenue: $${totalRevenue}`);
            
            return res.status(200).json({ 
              success: true, 
              data: { 
                transactions,
                raw_data: data, // Include raw data for debugging
                period: {
                  start: formatDate(startDate),
                  end: formatDate(endDate)
                },
                note: transactions.length === 0 
                  ? 'No revenue data found for this period. If you have revenue, it may take time to process, or you may need to set up webhooks for real-time data.'
                  : `Revenue data for period ${formatDate(startDate)} to ${formatDate(endDate)}`
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

