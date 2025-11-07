/**
 * Instagram Profile API
 * 
 * Fetches Instagram profile data (followers, bio, etc.)
 * 
 * POST /api/instagram-profile
 * Body: { username: string }
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
    const { username } = req.body;

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

    console.log(`📸 [API] Fetching Instagram profile for @${username}...`);

    const profile = await InstagramScraperService.fetchProfile(username);

    if (!profile) {
      return res.status(404).json({ 
        error: 'Profile not found or private' 
      });
    }

    console.log(`✅ [API] Profile fetched successfully for @${username}`);

    return res.status(200).json({
      success: true,
      data: profile
    });

  } catch (error: any) {
    console.error('❌ [API] Error fetching Instagram profile:', error);
    
    return res.status(500).json({
      error: 'Failed to fetch Instagram profile',
      message: error.message
    });
  }
}

