/**
 * Apify Client - Direct API calls without HTTP proxy
 * 
 * This is used by cron jobs and sync functions to call Apify directly
 * instead of making HTTP calls to /api/apify-proxy
 */

interface ApifyRunOptions {
  actorId: string;
  input: any;
  token?: string;
}

interface ApifyResponse {
  items: any[];
  run?: any;
}

/**
 * Call Apify actor directly and get dataset items
 */
/**
 * Retry logic for Instagram-specific errors (403, proxy, SSL)
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 2000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.log(`    ⏳ Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || String(error);
      
      // Check if it's a retryable error
      const isRetryable = 
        errorMsg.includes('403') ||
        errorMsg.includes('Forbidden') ||
        errorMsg.includes('proxy') ||
        errorMsg.includes('SSL') ||
        errorMsg.includes('ECONNRESET') ||
        errorMsg.includes('ETIMEDOUT') ||
        errorMsg.includes('Max retries exceeded');
      
      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }
      
      console.log(`    ⚠️ Retryable error detected: ${errorMsg.substring(0, 100)}`);
    }
  }
  
  throw lastError;
}

export async function runApifyActor(options: ApifyRunOptions): Promise<ApifyResponse> {
  const { actorId, input, token } = options;
  
  const APIFY_TOKEN = token || process.env.APIFY_TOKEN;
  
  if (!APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN not set in environment variables');
  }
  
  // Normalize actor ID (convert / to ~)
  const normalizedActorId = actorId.includes('/') 
    ? actorId.replace('/', '~') 
    : actorId;
  
  // Check if this is an Instagram actor (needs special handling)
  const isInstagram = normalizedActorId.includes('instagram');
  
  console.log('🔄 Direct Apify call:', {
    actorId: normalizedActorId,
    inputKeys: Object.keys(input || {}),
    isInstagram
  });
  
  try {
    // Wrap Instagram calls in retry logic
    const executeCall = async () => {
      // Try run-sync-get-dataset-items first (fastest)
      const syncUrl = `https://api.apify.com/v2/acts/${normalizedActorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
      
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      
      if (response.ok) {
        const items = await response.json();
        const itemsArray = Array.isArray(items) ? items : [];
        
        console.log(`✅ Apify returned ${itemsArray.length} items`);
        
        return {
          items: itemsArray,
          run: { id: 'sync', status: 'SUCCEEDED' }
        };
      }
      
      // If sync fails, try regular run endpoint
      console.warn(`⚠️ Sync endpoint failed (${response.status}), trying regular run...`);
      
      const runUrl = `https://api.apify.com/v2/acts/${normalizedActorId}/runs?token=${APIFY_TOKEN}`;
      const runResponse = await fetch(runUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      
      if (!runResponse.ok) {
        const errorText = await runResponse.text();
        throw new Error(`Apify API error: ${runResponse.status} - ${errorText}`);
      }
      
      const runData = await runResponse.json();
      const runId = runData.data.id;
      
      console.log(`🏃 Waiting for run ${runId} to complete...`);
      
      // Wait for completion
      const completedRun = await waitForRunCompletion(runId, APIFY_TOKEN);
      
      // Get dataset items
      const datasetId = completedRun.defaultDatasetId;
      const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json`;
      
      const datasetResponse = await fetch(datasetUrl);
      if (!datasetResponse.ok) {
        throw new Error(`Failed to fetch dataset: ${datasetResponse.status}`);
      }
      
      const items = await datasetResponse.json();
      
      console.log(`✅ Got ${items.length} items from dataset`);
      
      return {
        items: Array.isArray(items) ? items : [],
        run: completedRun
      };
    };
    
    // Use retry logic for Instagram, direct call for others
    if (isInstagram) {
      return await retryWithBackoff(executeCall, 3, 2000);
    } else {
      return await executeCall();
    }
    
  } catch (error: any) {
    console.error('❌ Apify API error:', error.message);
    throw error;
  }
}

async function waitForRunCompletion(runId: string, token: string, timeout: number = 120000): Promise<any> {
  const startTime = Date.now();
  const pollInterval = 3000;
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
      
      if (!response.ok) {
        throw new Error(`Failed to check run status: ${response.status}`);
      }
      
      const runData = await response.json();
      const status = runData.data.status;
      
      console.log(`📊 Run status: ${status}`);
      
      if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        return runData.data;
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
    } catch (error) {
      console.warn('⚠️ Error checking run status:', error);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  throw new Error(`Actor run timed out after ${timeout}ms`);
}

