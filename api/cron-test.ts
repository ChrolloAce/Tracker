import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Manual Cron Test Endpoint
 * Call this anytime to manually trigger the video refresh
 * 
 * Usage: GET https://your-app.vercel.app/api/cron-test
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🧪 Manual cron test triggered');
  
  // Import the actual cron handler
  const cronHandler = (await import('./cron-refresh-videos')).default;
  
  // Create a mock request with the correct authorization
  const mockReq = {
    ...req,
    headers: {
      ...req.headers,
      authorization: `Bearer ${process.env.CRON_SECRET}`
    }
  } as VercelRequest;
  
  // Call the cron handler
  return cronHandler(mockReq, res);
}

