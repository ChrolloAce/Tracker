// Browser-compatible Apify client wrapper
// This avoids the Node.js compatibility issues with the official Apify client

interface ApifyRunResult {
  id: string;
  status: string;
  defaultDatasetId: string;
}

interface ApifyDatasetItem {
  items: any[];
}

class ApifyBrowserClient {
  private token: string;
  private baseUrl = 'https://api.apify.com/v2';

  constructor(token: string) {
    this.token = token;
  }

  async runActor(actorId: string, input: any, options: { timeout?: number } = {}): Promise<ApifyRunResult> {
    console.log('🌐 Making direct Apify API call for actor:', actorId);
    console.log('📋 Input parameters:', input);

    try {
      // Start the actor run
      const runResponse = await fetch(`${this.baseUrl}/acts/${actorId}/runs?token=${this.token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!runResponse.ok) {
        const errorText = await runResponse.text();
        throw new Error(`Failed to start actor run: ${runResponse.status} - ${errorText}`);
      }

      const runData = await runResponse.json();
      console.log('🎯 Actor run started:', runData.data.id);

      // Wait for the run to complete
      const completedRun = await this.waitForRunCompletion(runData.data.id, options.timeout || 60000);
      
      return {
        id: completedRun.id,
        status: completedRun.status,
        defaultDatasetId: completedRun.defaultDatasetId
      };

    } catch (error) {
      console.error('❌ Apify browser client error:', error);
      throw error;
    }
  }

  async getDatasetItems(datasetId: string): Promise<ApifyDatasetItem> {
    console.log('📥 Fetching dataset items for:', datasetId);

    try {
      const response = await fetch(`${this.baseUrl}/datasets/${datasetId}/items?token=${this.token}&format=json`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch dataset: ${response.status}`);
      }

      const items = await response.json();
      console.log('✅ Retrieved dataset items:', items.length);

      return { items };
    } catch (error) {
      console.error('❌ Failed to fetch dataset items:', error);
      throw error;
    }
  }

  private async waitForRunCompletion(runId: string, timeout: number): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 2000; // Poll every 2 seconds

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`${this.baseUrl}/actor-runs/${runId}?token=${this.token}`);
        
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
}

export default ApifyBrowserClient;
