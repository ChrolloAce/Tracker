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
            
            console.log('🔍 ===== REVENUECAT DEBUG =====');
            console.log('📦 Full API Response:', JSON.stringify(data, null, 2));
            
            // Transform overview metrics to transaction format
            // This gives ALL-TIME aggregate data, NOT date-filtered
            const transactions = [];
            let totalRevenue = 0;
            
            if (data.metrics && Array.isArray(data.metrics)) {
              const now = Date.now();
              
              console.log(`📊 Found ${data.metrics.length} metrics in response`);
              
              // Log each metric individually for debugging
              data.metrics.forEach((metric: any, index: number) => {
                console.log(`  Metric ${index + 1}:`, {
                  id: metric.id,
                  name: metric.name,
                  value: metric.value,
                  unit: metric.unit,
                  full: metric
                });
              });
              
              // Parse metrics by ID
              const metrics = data.metrics.reduce((acc: any, metric: any) => {
                acc[metric.id] = metric.value;
                return acc;
              }, {});

              console.log('📈 Parsed metrics object:', metrics);
              console.log('🔑 Available metric IDs:', Object.keys(metrics));

              // Extract revenue metrics
              // RevenueCat returns MRR (Monthly Recurring Revenue) for P28D period
              // Use MRR as the revenue value since that's what they provide
              const mrr = metrics.mrr || metrics.monthly_recurring_revenue || 0;
              totalRevenue = mrr; // Use MRR as revenue (represents 28-day recurring revenue)
              
              const activeSubscriptions = metrics.active_subscriptions || 
                                         metrics.active_subscribers || 
                                         0;
              const activeTrials = metrics.active_trials || 0;

              console.log('💰 Extracted values:', { 
                totalRevenue: totalRevenue,
                mrr: mrr, 
                activeSubscriptions: activeSubscriptions,
                activeTrials: activeTrials,
                note: 'MRR represents 28-day recurring revenue (P28D period)'
              });

              // Create a single aggregate transaction
              // Note: MRR represents the last 28 days of recurring revenue (P28D period)
              if (totalRevenue > 0 || activeSubscriptions > 0 || activeTrials > 0) {
                transactions.push({
                  id: `rc_mrr_${now}`,
                  date: new Date().toISOString(),
                  revenue: totalRevenue, // MRR value (28-day recurring revenue)
                  mrr: mrr,
                  active_subscriptions: activeSubscriptions,
                  active_trials: activeTrials,
                  currency: 'USD',
                  type: 'mrr_28d', // Indicates this is MRR for a 28-day period
                  period: 'P28D',
                  debug: {
                    all_metrics: metrics,
                    metric_ids: Object.keys(metrics)
                  }
                });
                console.log('✅ Created transaction with MRR:', totalRevenue);
              } else {
                console.log('⚠️ No MRR or active subscriptions found. All metrics:', metrics);
              }
            } else {
              console.log('❌ No metrics array found in response');
            }
            
            console.log(`✅ Returning ${transactions.length} transaction(s) with total revenue: $${totalRevenue}`);
            console.log('🔍 ===== END REVENUECAT DEBUG =====');
            
            return res.status(200).json({ 
              success: true, 
              data: { 
                transactions,
                raw_data: data, // Include raw data for debugging
                metrics_period: 'P28D',
                warning: 'RevenueCat overview endpoint returns fixed-period metrics (MRR = last 28 days). Cannot be customized via API.',
                recommendation: 'For custom date-range revenue tracking, set up webhooks: /REVENUECAT_SETUP_GUIDE.md',
                note: transactions.length === 0 
                  ? 'No revenue data found. Check that you have active subscriptions and the correct project ID.'
                  : `Showing MRR (Monthly Recurring Revenue) for the last 28 days (P28D period)`
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

