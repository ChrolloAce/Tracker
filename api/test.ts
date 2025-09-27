import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const APIFY_TOKEN = process.env.APIFY_TOKEN;

  return res.status(200).json({
    message: 'Test API working!',
    method: req.method,
    hasToken: !!APIFY_TOKEN,
    tokenLength: APIFY_TOKEN ? APIFY_TOKEN.length : 0,
    tokenPreview: APIFY_TOKEN ? `${APIFY_TOKEN.substring(0, 10)}...` : 'No token',
    environment: process.env.NODE_ENV || 'unknown',
    timestamp: new Date().toISOString()
  });
}
