/**
 * Resolve shortened TikTok URLs to full URLs
 * 
 * Shortened formats:
 *   - https://www.tiktok.com/t/ZTh5hRMGQ/
 *   - https://vm.tiktok.com/ZMxxxxxxx/
 *   - https://vt.tiktok.com/ZSxxxxxxx/
 * 
 * These redirect to full URLs like:
 *   - https://www.tiktok.com/@username/video/1234567890
 */

/**
 * Check if a TikTok URL is a shortened/redirect URL
 */
export function isShortenedTikTokUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('tiktok.com/t/') ||
    lower.includes('vm.tiktok.com') ||
    lower.includes('vt.tiktok.com')
  );
}

/**
 * Check if a TikTok URL is a full post URL (already resolved)
 */
export function isFullTikTokUrl(url: string): boolean {
  return url.includes('tiktok.com/@') && url.includes('/video/');
}

/**
 * Resolve a shortened TikTok URL by following the redirect chain.
 * Uses multiple strategies for maximum reliability.
 * Returns the final resolved URL, or the original if resolution fails.
 */
export async function resolveTikTokUrl(url: string): Promise<string> {
  if (!isShortenedTikTokUrl(url)) {
    return url;
  }

  if (isFullTikTokUrl(url)) {
    return url;
  }

  console.log(`🔗 [TIKTOK URL RESOLVER] Resolving shortened URL: ${url}`);

  // Strategy 1: Manual redirect following (most reliable)
  try {
    console.log(`🔗 [TIKTOK URL RESOLVER] Strategy 1: Manual redirect following...`);
    let currentUrl = url;
    let maxRedirects = 10;

    while (maxRedirects > 0) {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      const location = response.headers.get('location');
      console.log(`🔗 [TIKTOK URL RESOLVER] Status: ${response.status}, Location: ${location || 'none'}`);

      if (location) {
        // Handle relative redirects
        const nextUrl = location.startsWith('http') ? location : new URL(location, currentUrl).toString();
        
        // Check if we've arrived at a full TikTok video URL
        if (isFullTikTokUrl(nextUrl)) {
          const urlObj = new URL(nextUrl);
          const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;
          console.log(`✅ [TIKTOK URL RESOLVER] Resolved via redirect chain: ${cleanUrl}`);
          return cleanUrl;
        }

        currentUrl = nextUrl;
        maxRedirects--;
        continue;
      }

      // No more redirects — check if current URL is good
      if (isFullTikTokUrl(currentUrl)) {
        const urlObj = new URL(currentUrl);
        const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;
        console.log(`✅ [TIKTOK URL RESOLVER] Resolved at final redirect: ${cleanUrl}`);
        return cleanUrl;
      }

      // Check response.url (some runtimes track final URL)
      if (response.url && isFullTikTokUrl(response.url)) {
        const urlObj = new URL(response.url);
        const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;
        console.log(`✅ [TIKTOK URL RESOLVER] Resolved via response.url: ${cleanUrl}`);
        return cleanUrl;
      }

      // If it's a 200 OK, try parsing the page
      if (response.status === 200) {
        const body = await response.text();
        const extracted = extractTikTokUrlFromHtml(body);
        if (extracted) {
          console.log(`✅ [TIKTOK URL RESOLVER] Resolved via HTML parsing: ${extracted}`);
          return extracted;
        }
      }

      break;
    }
  } catch (error) {
    console.warn(`⚠️ [TIKTOK URL RESOLVER] Strategy 1 failed:`, error);
  }

  // Strategy 2: Auto-follow redirect with GET
  try {
    console.log(`🔗 [TIKTOK URL RESOLVER] Strategy 2: Auto-follow GET...`);
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    // Check final URL
    if (response.url && isFullTikTokUrl(response.url)) {
      const urlObj = new URL(response.url);
      const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;
      console.log(`✅ [TIKTOK URL RESOLVER] Resolved via auto-follow: ${cleanUrl}`);
      return cleanUrl;
    }

    // Parse body for video URL
    const body = await response.text();
    const extracted = extractTikTokUrlFromHtml(body);
    if (extracted) {
      console.log(`✅ [TIKTOK URL RESOLVER] Resolved via page HTML: ${extracted}`);
      return extracted;
    }
  } catch (error) {
    console.warn(`⚠️ [TIKTOK URL RESOLVER] Strategy 2 failed:`, error);
  }

  console.error(`❌ [TIKTOK URL RESOLVER] All strategies failed for: ${url}`);
  return url;
}

/**
 * Extract a full TikTok video URL from HTML content
 */
function extractTikTokUrlFromHtml(html: string): string | null {
  // Try canonical link
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/);
  if (canonicalMatch && isFullTikTokUrl(canonicalMatch[1])) {
    return canonicalMatch[1];
  }

  // Try alternate canonical format
  const canonicalMatch2 = html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/);
  if (canonicalMatch2 && isFullTikTokUrl(canonicalMatch2[1])) {
    return canonicalMatch2[1];
  }

  // Try og:url meta tag
  const ogUrlMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/);
  if (ogUrlMatch && isFullTikTokUrl(ogUrlMatch[1])) {
    return ogUrlMatch[1];
  }

  // Try to find video URL in page content
  const videoUrlMatch = html.match(/https:\/\/www\.tiktok\.com\/@[^"'\s\\]+\/video\/\d+/);
  if (videoUrlMatch) {
    return videoUrlMatch[0];
  }

  // Try JSON-LD structured data
  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/);
  if (jsonLdMatch) {
    try {
      const jsonData = JSON.parse(jsonLdMatch[1]);
      const jsonUrl = jsonData.url || jsonData['@id'];
      if (jsonUrl && isFullTikTokUrl(jsonUrl)) {
        return jsonUrl;
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  return null;
}
