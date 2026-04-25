import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-ignore - heic-convert has no types
import convert from 'heic-convert';

// --- SSRF Protection ---

const ALLOWED_DOMAIN_SUFFIXES = [
  // Instagram / Facebook CDN
  'instagram.com',
  'cdninstagram.com',
  'fbcdn.net',
  // TikTok
  'tiktok.com',
  'tiktokcdn.com',
  // YouTube
  'youtube.com',
  'ytimg.com',
  'ggpht.com',
  // Twitter / X
  'twitter.com',
  'x.com',
  'twimg.com',
  // Firebase
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
];

function isPrivateIP(hostname: string): boolean {
  // IPv6 loopback / unspecified
  if (hostname === '::1' || hostname === '::' || hostname === '[::1]' || hostname === '[::]') {
    return true;
  }

  // Strip IPv6 brackets if present
  const clean = hostname.replace(/^\[|\]$/g, '');

  const parts = clean.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p))) {
    // Not a dotted-quad IPv4 — allow DNS names through (they get checked by domain allowlist)
    return false;
  }

  const [a, b] = parts;
  if (a === 127) return true;                              // 127.0.0.0/8
  if (a === 10) return true;                               // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;        // 172.16.0.0/12
  if (a === 192 && b === 168) return true;                 // 192.168.0.0/16
  if (a === 169 && b === 254) return true;                 // 169.254.0.0/16 (link-local / cloud metadata)
  if (a === 0 && parts.every(p => p === 0)) return true;   // 0.0.0.0

  return false;
}

function isDomainAllowed(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return ALLOWED_DOMAIN_SUFFIXES.some(
    suffix => lower === suffix || lower.endsWith('.' + suffix)
  );
}

/** Returns an error string if the URL should be blocked, or null if it's OK. */
function validateImageUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return 'Invalid URL';
  }

  // Protocol check
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return 'Only http and https protocols are allowed';
  }

  // Block private / internal IPs
  if (isPrivateIP(parsed.hostname)) {
    return 'Access to internal addresses is not allowed';
  }

  // Domain allowlist
  if (!isDomainAllowed(parsed.hostname)) {
    return 'Domain not allowed';
  }

  return null;
}

// --- Handler ---

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

    // SSRF protection: validate the URL before fetching
    const urlError = validateImageUrl(imageUrl);
    if (urlError) {
      console.error(`🚫 Blocked image proxy request: ${urlError} — ${imageUrl}`);
      return res.status(400).json({ error: urlError });
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
    const arrayBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // Validate we got actual image data
    if (buffer.length < 100) {
      console.error(`❌ Downloaded data too small (${buffer.length} bytes), likely not an image`);
      return res.status(400).json({
        error: 'Downloaded data too small, likely not an image',
        size: buffer.length
      });
    }

    let contentType = response.headers.get('content-type') || 'image/jpeg';

    // HEIC → JPEG conversion. TikTok (and other CDNs) sometimes serve creator
    // profile pics in HEIC format because the source upload was an iPhone
    // photo. Browsers other than Safari can't render HEIC in <img>, so we
    // convert to JPEG before handing the bytes back to the client uploader.
    // Mirrors the magic-byte check used in ImageUploadService.
    const isHEIC =
      contentType.includes('heic') ||
      contentType.includes('heif') ||
      imageUrl.toLowerCase().includes('.heic') ||
      imageUrl.toLowerCase().includes('.heif') ||
      (buffer.length > 12 &&
       buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70 &&
       buffer[8] === 0x68 && buffer[9] === 0x65 && buffer[10] === 0x69 && buffer[11] === 0x63);

    if (isHEIC) {
      console.log(`🔄 [HEIC] Converting HEIC image to JPEG for ${identifier || 'unknown'}…`);
      try {
        const out = await convert({ buffer, format: 'JPEG', quality: 0.9 });
        buffer = Buffer.from(out);
        contentType = 'image/jpeg';
        console.log(`✅ [HEIC] Converted to JPEG (${buffer.length} bytes)`);
      } catch (err) {
        console.error(`❌ [HEIC] Conversion failed:`, err);
        // Fall through and return the original HEIC bytes; better to upload
        // something than nothing, the backfill script can clean up later.
      }
    }

    const base64 = buffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    console.log(`✅ Successfully proxied image: ${identifier || 'unknown'} (${buffer.length} bytes, ${contentType})`);

    return res.status(200).json({
      success: true,
      dataUrl: dataUrl,
      contentType: contentType,
      size: buffer.length,
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
