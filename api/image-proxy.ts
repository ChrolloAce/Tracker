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

    // Fetch the image with proper headers to mimic a browser request
    // Especially important for Instagram which blocks most server requests
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': imageUrl.includes('instagram') ? 'https://www.instagram.com/' : undefined,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
      },
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch image: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: `Failed to fetch image: ${response.status} ${response.statusText}` 
      });
    }

    // Get the image as buffer
    const buffer = await response.arrayBuffer();
    
    // Validate we got actual image data
    if (buffer.byteLength < 100) {
      console.error(`❌ Downloaded data too small (${buffer.byteLength} bytes), likely not an image`);
      return res.status(400).json({ 
        error: 'Downloaded data too small, likely not an image',
        size: buffer.byteLength
      });
    }
    
    const base64 = Buffer.from(buffer).toString('base64');
    
    // Determine content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const dataUrl = `data:${contentType};base64,${base64}`;

    console.log(`✅ Successfully proxied image: ${identifier || 'unknown'} (${buffer.byteLength} bytes, ${contentType})`);

    return res.status(200).json({
      success: true,
      dataUrl: dataUrl,
      contentType: contentType,
      size: buffer.byteLength,
      identifier: identifier
    });

  } catch (error) {
    console.error('❌ Image proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy image',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
