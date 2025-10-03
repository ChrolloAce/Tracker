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
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
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
    return res.status(500).json({ 
      error: 'Failed to proxy image',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
