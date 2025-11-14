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
    console.log('🚀 Triggering orchestrator (fire and forget)...');

    // Get the base URL
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'https://www.viewtrack.app';

    // Fire and forget - trigger orchestrator without awaiting
    fetch(`${baseUrl}/api/cron-orchestrator`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    }).catch(err => {
      console.error('Orchestrator trigger failed (non-critical):', err.message);
      // Non-critical - orchestrator runs on schedule anyway
    });

    // Return immediately
    console.log('✅ Orchestrator triggered successfully (running in background)');
    
    return res.status(200).json({
      success: true,
      message: 'Refresh job started in background',
      note: 'All accounts will be refreshed asynchronously. This may take several minutes to complete.',
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

