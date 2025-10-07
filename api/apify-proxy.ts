import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Apify-Token');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { actorId, input, action = 'run' } = req.body;
    
    // Normalize actorId to Apify API path format: owner~actor and map known aliases
    const normalizeActorId = (id: unknown): string => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('Missing or invalid actorId');
      }
      // Support both "owner/actor" and "owner~actor" inputs
      if (id.includes('/')) {
        const [owner, actor] = id.split('/');
        id = `${owner}~${actor}`;
      }
      
      // Map known aliases to canonical owners
      const ACTOR_ALIASES: Record<string, string> = {
        'apify~tiktok-scraper': 'clockworks~tiktok-scraper',
      };
      if (ACTOR_ALIASES[id]) {
        return ACTOR_ALIASES[id];
      }
      return id;
    };
    
    const normalizedActorId = normalizeActorId(actorId);
    const APIFY_TOKEN = process.env.APIFY_TOKEN;

    // CRITICAL: Token must be set in Vercel environment variables
    if (!APIFY_TOKEN) {
      console.error('🚨 CRITICAL: APIFY_TOKEN environment variable is NOT SET!');
      console.error('   → Go to Vercel Dashboard → Settings → Environment Variables');
      console.error('   → Add APIFY_TOKEN with your token from https://console.apify.com/account/integrations');
      console.error('   → Redeploy your app');
      return res.status(500).json({
        error: 'APIFY_TOKEN not configured',
        message: 'The APIFY_TOKEN environment variable is not set in Vercel',
        solution: [
          '1. Go to https://console.apify.com/account/integrations and copy your token',
          '2. Go to Vercel Dashboard → Your Project → Settings → Environment Variables',
          '3. Add APIFY_TOKEN with your token value',
          '4. Check ALL environments (Production, Preview, Development)',
          '5. Redeploy your app'
        ]
      });
    }

    console.log('🔄 Apify proxy request:', { actorId, normalizedActorId, action, inputKeys: Object.keys(input || {}) });
    console.log('📋 Input parameters:', JSON.stringify(input).substring(0, 500));
    console.log('🔑 Using token:', APIFY_TOKEN ? `Token found (${APIFY_TOKEN.substring(0, 15)}...)` : 'No token found');

    if (action === 'run') {
      // Prefer run-sync-get-dataset-items (returns array of items)
      const syncItemsUrl = `https://api.apify.com/v2/acts/${normalizedActorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
      console.log('🔗 Using run-sync-get-dataset-items URL:', syncItemsUrl);

      let runResponse = await fetch(syncItemsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!runResponse.ok) {
        const errorText = await runResponse.text();
        console.error('❌ run-sync-get-dataset-items failed:', runResponse.status);
        console.error('❌ Error response:', errorText.substring(0, 1000));
        
        // Special handling for 401 Unauthorized
        if (runResponse.status === 401) {
          console.error('🚨 APIFY TOKEN IS INVALID OR MISSING!');
          console.error('   → Go to https://console.apify.com/account/integrations');
          console.error('   → Copy your Personal API token');
          console.error('   → Set it as APIFY_TOKEN in Vercel environment variables');
        }

        // Fallback: use /runs then wait for completion and fetch dataset items
        const runsUrl = `https://api.apify.com/v2/acts/${normalizedActorId}/runs?token=${APIFY_TOKEN}`;
        console.log('↩️ Falling back to /runs URL:', runsUrl);

        const startRunRes = await fetch(runsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!startRunRes.ok) {
          const startErr = await startRunRes.text();
          console.error('❌ Failed to start run via /runs:', startRunRes.status, startErr);
          
          if (startRunRes.status === 401) {
            console.error('🚨 APIFY TOKEN IS INVALID OR MISSING!');
            return res.status(401).json({
              error: 'Apify authentication failed',
              message: 'Your APIFY_TOKEN is invalid, expired, or not set',
              details: startErr,
              solution: [
                '1. Go to https://console.apify.com/account/integrations',
                '2. Copy your Personal API token',
                '3. Add it as APIFY_TOKEN in Vercel environment variables',
                '4. Redeploy your app'
              ],
              actorId: normalizedActorId
            });
          }
          
          return res.status(startRunRes.status).json({
            error: `Failed to start actor run: ${startRunRes.status}`,
            details: startErr,
            actorId: normalizedActorId
          });
        }

        const runStartData = await startRunRes.json();
        const runId = runStartData?.data?.id;
        console.log('🏁 Run started:', runId);

        const runData = await waitForRunCompletion(runId, APIFY_TOKEN).catch((e) => {
          console.error('❌ Error while waiting for run:', e);
          return null;
        });

        if (!runData || runData.status !== 'SUCCEEDED') {
          return res.status(500).json({
            error: 'Actor run did not succeed',
            details: runData || 'Unknown run data',
            actorId: normalizedActorId
          });
        }

        const datasetId = runData.defaultDatasetId;
        console.log('🗂️ Fetching dataset items for dataset:', datasetId);
        const { items } = await getDatasetItems(datasetId, APIFY_TOKEN);

        return res.status(200).json({
          run: { id: runId, status: 'SUCCEEDED', defaultDatasetId: datasetId },
          items,
        });
      }

      const items = await runResponse.json();
      const itemsArray = Array.isArray(items) ? items : [];
      console.log('🎯 Synchronous run completed, got items directly:', itemsArray.length);
      
      if (itemsArray.length === 0) {
        console.warn('⚠️ Apify returned 0 items. This could mean:');
        console.warn('   - The username does not exist or is incorrect');
        console.warn('   - The account is private');
        console.warn('   - The account has no content');
        console.warn('   - The Apify actor has an issue');
        console.warn(`   - Actor: ${normalizedActorId}`);
        console.warn(`   - Input: ${JSON.stringify(input).substring(0, 200)}`);
      }

      return res.status(200).json({
        run: { id: 'sync-run', status: 'SUCCEEDED', defaultDatasetId: 'sync' },
        items: itemsArray,
      });

    } else if (action === 'dataset') {
      // Get dataset items
      const { datasetId } = req.body;
      const { items } = await getDatasetItems(datasetId, APIFY_TOKEN);
      
      return res.status(200).json({ items });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('❌ Apify proxy error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function waitForRunCompletion(runId: string, token: string, timeout: number = 120000): Promise<any> {
  const startTime = Date.now();
  const pollInterval = 3000; // Poll every 3 seconds

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
      
      if (!response.ok) {
        throw new Error(`Failed to check run status: ${response.status}`);
      }

      const runData = await response.json();
      const status = runData.data.status;
      
      console.log('📊 Run status check:', status);

      if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        return runData.data;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
    } catch (error) {
      console.warn('⚠️ Error checking run status:', error);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error(`Actor run timed out after ${timeout}ms`);
}

async function getDatasetItems(datasetId: string, token: string): Promise<{ items: any[] }> {
  const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&format=json`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch dataset: ${response.status}`);
  }

  const items = await response.json();
  return { items };
}
