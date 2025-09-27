// Browser-compatible Apify client wrapper
// This avoids the Node.js compatibility issues with the official Apify client

interface ApifyRunResult {
  id: string;
  status: string;
  defaultDatasetId: string;
  items?: any[]; // Include items for proxy response
}

interface ApifyDatasetItem {
  items: any[];
}

class ApifyBrowserClient {
  private proxyUrl: string;

  constructor(_token: string) {
    // Token is passed to the Vercel API proxy, not used directly here
    // Use current origin for development, or absolute path for production
    this.proxyUrl = `${window.location.origin}/api/apify-proxy`;
    console.log('🔧 Apify proxy URL set to:', this.proxyUrl);
  }

  async runActor(actorId: string, input: any, _options: { timeout?: number } = {}): Promise<ApifyRunResult> {
    console.log('🌐 Making Apify API call via Vercel proxy for actor:', actorId);
    console.log('📋 Input parameters:', input);

    try {
      // Call through Vercel API proxy to avoid CORS
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actorId,
          input,
          action: 'run'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Proxy request failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('🎯 Actor run completed via proxy:', data.run.id);

      return {
        id: data.run.id,
        status: data.run.status,
        defaultDatasetId: data.run.defaultDatasetId,
        items: data.items // Include items directly from proxy response
      };

    } catch (error) {
      console.error('❌ Apify proxy client error:', error);
      throw error;
    }
  }

  async getDatasetItems(datasetId: string): Promise<ApifyDatasetItem> {
    console.log('📥 Fetching dataset items via proxy for:', datasetId);

    try {
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          datasetId,
          action: 'dataset'
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to fetch dataset via proxy: ${response.status} - ${errorData.error}`);
      }

      const data = await response.json();
      console.log('✅ Retrieved dataset items via proxy:', data.items.length);

      return { items: data.items };
    } catch (error) {
      console.error('❌ Failed to fetch dataset items via proxy:', error);
      throw error;
    }
  }

  // waitForRunCompletion is now handled by the Vercel API proxy
}

export default ApifyBrowserClient;
