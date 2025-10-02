import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageUrl, identifier } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    console.log(`📥 Proxy downloading image: ${identifier || 'unknown'}`);
    console.log(`🔗 Image URL: ${imageUrl}`);

    // Determine platform based on URL
    const isInstagram = imageUrl.includes('instagram.com') || imageUrl.includes('fbcdn.net');
    const isTikTok = imageUrl.includes('tiktok.com') || imageUrl.includes('tiktokcdn.com');

    // Build headers based on platform
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    // Add platform-specific headers
    if (isInstagram) {
      headers['Referer'] = 'https://www.instagram.com/';
      headers['Origin'] = 'https://www.instagram.com';
      headers['Sec-Fetch-Dest'] = 'image';
      headers['Sec-Fetch-Mode'] = 'cors';
      headers['Sec-Fetch-Site'] = 'cross-site';
    } else if (isTikTok) {
      headers['Referer'] = 'https://www.tiktok.com/';
      headers['Origin'] = 'https://www.tiktok.com';
    }

    // Fetch the image with proper headers
    const response = await fetch(imageUrl, { headers });

    if (!response.ok) {
      console.error(`❌ Failed to fetch image: ${response.status} ${response.statusText}`);
      
      // Return a transparent 1x1 pixel as fallback instead of error
      const transparentPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      return res.status(200).json({
        success: false,
        dataUrl: `data:image/png;base64,${transparentPixel}`,
        contentType: 'image/png',
        size: 68,
        identifier: identifier,
        error: `Failed to fetch: ${response.status}`
      });
    }

    // Get the image as buffer
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    // Determine content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const dataUrl = `data:${contentType};base64,${base64}`;

    console.log(`✅ Successfully proxied image: ${identifier || 'unknown'} (${buffer.byteLength} bytes)`);

    return res.status(200).json({
      success: true,
      dataUrl: dataUrl,
      contentType: contentType,
      size: buffer.byteLength,
      identifier: identifier
    });

  } catch (error) {
    console.error('❌ Image proxy error:', error);
    
    // Return transparent pixel as fallback instead of 500 error
    const transparentPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    return res.status(200).json({
      success: false,
      dataUrl: `data:image/png;base64,${transparentPixel}`,
      contentType: 'image/png',
      size: 68,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
