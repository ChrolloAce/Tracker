/**
 * Instagram Full Profile API
 * 
 * Fetches profile data AND reels in one call (optimized)
 * 
 * POST /api/instagram-full
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

    console.log(`🎯 [API] Fetching full profile + ${maxReels} reels for @${username}...`);

    const result = await InstagramScraperService.fetchProfileWithReels(username, maxReels);

    if (!result.profile) {
      return res.status(404).json({ 
        error: 'Profile not found or private' 
      });
    }

    console.log(`✅ [API] Fetched profile + ${result.reels.length} reels for @${username}`);

    return res.status(200).json({
      success: true,
      profile: result.profile,
      reels: {
        count: result.reels.length,
        data: result.reels
      }
    });

  } catch (error: any) {
    console.error('❌ [API] Error fetching Instagram full profile:', error);
    
    return res.status(500).json({
      error: 'Failed to fetch Instagram profile data',
      message: error.message
    });
  }
}

