import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Trigger Tracking Processor
 * 
 * This is a cron endpoint that runs every minute to process pending tracking jobs.
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/trigger-tracking-processor",
 *     "schedule": "* * * * *"
 *   }]
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Verify this is a cron request or has the secret
    const authHeader = req.headers.authorization;
    const secret = req.query.secret as string;
    
    const isAuthorized = 
      authHeader === `Bearer ${process.env.CRON_SECRET}` ||
      secret === process.env.CRON_SECRET;

    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('🔄 Triggering tracking job processor...');

    // Call the process-tracking-job endpoint
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/process-tracking-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: process.env.CRON_SECRET
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Job processed successfully:', data);
      return res.status(200).json({
        success: true,
        ...data
      });
    } else {
      console.log('⚠️  No jobs to process or error occurred:', data);
      return res.status(200).json({
        success: false,
        ...data
      });
    }

  } catch (error: any) {
    console.error('❌ Error triggering processor:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
