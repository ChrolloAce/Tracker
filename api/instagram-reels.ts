/**
 * Instagram Reels API
 * 
 * Fetches multiple reels from an Instagram profile
 * 
 * POST /api/instagram-reels
 * Body: { username: string, maxReels?: number }
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { InstagramScraperService } from './services/InstagramScraperService';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, maxReels = 30 } = req.body;

    if (!username) {
      return res.status(400).json({ 
        error: 'Missing required field: username' 
      });
    }

    // Validate username format
    if (!InstagramScraperService.isValidUsername(username)) {
      return res.status(400).json({ 
        error: 'Invalid Instagram username format' 
      });
    }

    // Validate maxReels
    if (maxReels < 1 || maxReels > 100) {
      return res.status(400).json({ 
        error: 'maxReels must be between 1 and 100' 
      });
    }

    console.log(`📸 [API] Fetching ${maxReels} reels for @${username}...`);

    const reels = await InstagramScraperService.fetchProfileReels(username, maxReels);

    console.log(`✅ [API] Fetched ${reels.length} reels for @${username}`);

    return res.status(200).json({
      success: true,
      count: reels.length,
      data: reels
    });

  } catch (error: any) {
    console.error('❌ [API] Error fetching Instagram reels:', error);
    
    return res.status(500).json({
      error: 'Failed to fetch Instagram reels',
      message: error.message
    });
  }
}

