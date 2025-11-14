import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Trigger Orchestrator API
 * Starts the cron orchestrator asynchronously without waiting for completion
 * Returns immediately to provide instant feedback to users
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🚀 Triggering orchestrator...');

    // Get the base URL
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'https://www.viewtrack.app';

    const cronSecret = process.env.CRON_SECRET;
    
    console.log(`📡 Calling orchestrator at: ${baseUrl}/api/cron-orchestrator`);
    console.log(`🔑 CRON_SECRET available: ${!!cronSecret}`);
    
    if (!cronSecret) {
      console.error('❌ CRON_SECRET environment variable is not set!');
      throw new Error('CRON_SECRET is not configured');
    }

    // Call orchestrator with CRON_SECRET (orchestrator will detect manual trigger and return quickly)
    const response = await fetch(`${baseUrl}/api/cron-orchestrator`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📊 Orchestrator response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Orchestrator returned error: ${response.status}`, errorText.substring(0, 200));
      throw new Error(`Orchestrator failed with status ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Orchestrator completed:', result);
    
    return res.status(200).json({
      success: true,
      message: 'Refresh jobs dispatched successfully',
      stats: result.stats || {},
      note: 'All accounts are being refreshed in the background.',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Failed to trigger orchestrator:', error);
    return res.status(500).json({
      error: 'Failed to trigger refresh',
      message: error.message
    });
  }
}

