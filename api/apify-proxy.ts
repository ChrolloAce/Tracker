import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { actorId, input, action = 'run' } = req.body;
    const APIFY_TOKEN = process.env.APIFY_TOKEN || 'apify_api_7wvIrJjtEH6dTZktJZAtcIGAylH7cX2jRweu';

    console.log('🔄 Apify proxy request:', { actorId, action, inputKeys: Object.keys(input || {}) });
    console.log('🔑 Using token:', APIFY_TOKEN ? 'Token found' : 'No token found');
    console.log('📋 Full input:', JSON.stringify(input, null, 2));

    if (action === 'run') {
      // Start actor run - using the correct endpoint format
      // DO NOT encode the forward slash - it's part of the path structure
      const apiUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
      console.log('🌐 Calling Apify API:', apiUrl);
      console.log('📦 Actor ID:', actorId);
      console.log('🔍 Full URL being called:', apiUrl.replace(APIFY_TOKEN, '***'));
      
      const runResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!runResponse.ok) {
        const errorText = await runResponse.text();
        console.error('❌ Apify run failed:', runResponse.status, errorText);
        
        // Try to parse error as JSON for better error messages
        let errorDetails = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson.error?.message || errorJson.message || errorText;
        } catch {
          // Keep original error text if not JSON
        }
        
        return res.status(runResponse.status).json({ 
          error: `Failed to start actor run: ${runResponse.status}`,
          details: errorDetails,
          actorId,
          input
        });
      }

      const items = await runResponse.json();
      console.log('🎯 Synchronous run completed, got items directly:', items.length);

      // run-sync-get-dataset-items returns items directly
      return res.status(200).json({
        run: { id: 'sync-run', status: 'SUCCEEDED', defaultDatasetId: 'sync' },
        items: items
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
