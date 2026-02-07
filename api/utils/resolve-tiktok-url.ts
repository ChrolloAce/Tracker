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
 * Resolve a shortened TikTok URL by following the redirect chain.
 * Returns the final resolved URL, or the original if resolution fails.
 */
export async function resolveTikTokUrl(url: string): Promise<string> {
  if (!isShortenedTikTokUrl(url)) {
    return url;
  }

  console.log(`🔗 [TIKTOK] Resolving shortened URL: ${url}`);

  try {
    // Follow redirects manually to get the final URL
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const resolvedUrl = response.url;

    if (resolvedUrl && resolvedUrl !== url && resolvedUrl.includes('tiktok.com')) {
      // Clean up the resolved URL - remove query params that aren't needed
      const urlObj = new URL(resolvedUrl);
      const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;
      console.log(`✅ [TIKTOK] Resolved to: ${cleanUrl}`);
      return cleanUrl;
    }

    // If HEAD didn't work, try GET with manual redirect tracking
    console.log(`⚠️ [TIKTOK] HEAD redirect didn't resolve, trying GET...`);
    const getResponse = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const finalUrl = getResponse.url;
    if (finalUrl && finalUrl !== url && finalUrl.includes('tiktok.com')) {
      const urlObj = new URL(finalUrl);
      const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;
      console.log(`✅ [TIKTOK] Resolved via GET to: ${cleanUrl}`);
      return cleanUrl;
    }

    // Last resort: parse the response body for a canonical URL or redirect meta tag
    const body = await getResponse.text();
    const canonicalMatch = body.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
    if (canonicalMatch && canonicalMatch[1].includes('tiktok.com')) {
      console.log(`✅ [TIKTOK] Resolved via canonical tag: ${canonicalMatch[1]}`);
      return canonicalMatch[1];
    }

    // Try to find the actual video URL in the page content
    const videoUrlMatch = body.match(/https:\/\/www\.tiktok\.com\/@[^"'\s]+\/video\/\d+/);
    if (videoUrlMatch) {
      console.log(`✅ [TIKTOK] Resolved via page content: ${videoUrlMatch[0]}`);
      return videoUrlMatch[0];
    }

    console.warn(`⚠️ [TIKTOK] Could not resolve shortened URL, using original: ${url}`);
    return url;
  } catch (error) {
    console.error(`❌ [TIKTOK] Failed to resolve shortened URL:`, error);
    console.warn(`⚠️ [TIKTOK] Falling back to original URL: ${url}`);
    return url;
  }
}
