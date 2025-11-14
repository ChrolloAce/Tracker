import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Manual Cron Test Endpoint
 * Call this anytime to manually trigger the cron orchestrator
 * 
 * Usage: GET https://your-app.vercel.app/api/cron-test
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🧪 Manual cron test triggered');
  
  // Import the orchestrator instead of cron-refresh-videos
  const cronHandler = (await import('./cron-orchestrator')).default;
  
  // Create a mock request with the correct authorization
  const mockReq = {
    ...req,
    method: 'POST',
    headers: {
      ...req.headers,
      authorization: `Bearer ${process.env.CRON_SECRET}`
    },
    body: req.body || {}
  } as VercelRequest;
  
  // Call the orchestrator
  return cronHandler(mockReq, res);
}

