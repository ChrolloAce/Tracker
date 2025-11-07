/**
 * Instagram Post API
 * 
 * Fetches individual Instagram post/reel data
 * 
 * POST /api/instagram-post
 * Body: { url: string } OR { urls: string[] }
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
    const { url, urls, delayMs = 2000 } = req.body;

    // Handle single URL
    if (url) {
      if (!InstagramScraperService.isValidInstagramUrl(url)) {
        return res.status(400).json({ 
          error: 'Invalid Instagram URL format' 
        });
      }

      console.log(`📸 [API] Fetching Instagram post: ${url}`);

      const post = await InstagramScraperService.fetchPost(url);

      if (!post) {
        return res.status(404).json({ 
          error: 'Post not found or unavailable' 
        });
      }

      console.log(`✅ [API] Post fetched successfully`);

      return res.status(200).json({
        success: true,
        data: post
      });
    }

    // Handle multiple URLs (batch)
    if (urls && Array.isArray(urls)) {
      if (urls.length === 0) {
        return res.status(400).json({ 
          error: 'urls array cannot be empty' 
        });
      }

      if (urls.length > 50) {
        return res.status(400).json({ 
          error: 'Maximum 50 URLs per batch request' 
        });
      }

      // Validate all URLs
      for (const postUrl of urls) {
        if (!InstagramScraperService.isValidInstagramUrl(postUrl)) {
          return res.status(400).json({ 
            error: `Invalid Instagram URL: ${postUrl}` 
          });
        }
      }

      console.log(`📦 [API] Fetching ${urls.length} Instagram posts in batch...`);

      const posts = await InstagramScraperService.fetchPostsBatch(urls, delayMs);

      const successCount = posts.filter(p => p !== null).length;
      console.log(`✅ [API] Batch complete: ${successCount}/${urls.length} successful`);

      return res.status(200).json({
        success: true,
        total: urls.length,
        successful: successCount,
        data: posts
      });
    }

    // No valid input provided
    return res.status(400).json({ 
      error: 'Must provide either "url" (string) or "urls" (array)' 
    });

  } catch (error: any) {
    console.error('❌ [API] Error fetching Instagram post:', error);
    
    return res.status(500).json({
      error: 'Failed to fetch Instagram post',
      message: error.message
    });
  }
}

