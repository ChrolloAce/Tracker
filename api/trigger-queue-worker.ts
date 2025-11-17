import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Manual trigger for queue-worker
 * Use this to manually process pending jobs
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = 'https://www.viewtrack.app';
  
  console.log(`🔔 Manual trigger: Calling queue-worker...`);
  
  try {
    const response = await fetch(`${baseUrl}/api/queue-worker`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ trigger: 'manual' })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Queue worker failed: ${response.status} ${error}`);
      return res.status(response.status).json({
        success: false,
        error: `Worker returned ${response.status}`,
        details: error
      });
    }
    
    const result = await response.json();
    console.log(`✅ Queue worker completed successfully`);
    
    return res.status(200).json({
      success: true,
      message: 'Queue worker triggered successfully',
      result
    });
    
  } catch (error: any) {
    console.error(`❌ Failed to trigger queue worker:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

