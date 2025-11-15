import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Simple test endpoint to verify the trigger system works
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('✅ Test trigger called successfully');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  return res.status(200).json({
    success: true,
    message: 'Test trigger works!',
    method: req.method,
    timestamp: new Date().toISOString()
  });
}

