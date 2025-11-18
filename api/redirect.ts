import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Server-side redirect handler for instant redirects
 * This bypasses React entirely for maximum speed
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { shortCode } = req.query;

  if (!shortCode || typeof shortCode !== 'string') {
    return res.status(400).json({ error: 'Invalid short code' });
  }

  try {
    // Import Firebase Admin only when needed (serverless optimization)
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    // Initialize Firebase Admin if not already initialized
    if (getApps().length === 0) {
      // Handle private key - replace both \\n and literal \n with actual newlines
      let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
      
      // Remove quotes if they exist
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      
      // Replace escaped newlines with actual newlines
      privateKey = privateKey.replace(/\\n/g, '\n');

      // Use service account from environment variables
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      };

      initializeApp({
        credential: cert(serviceAccount as any),
      });
    }

    const db = getFirestore();

    // Fast server-side read
    const publicLinkDoc = await db.collection('publicLinks').doc(shortCode).get();

    if (!publicLinkDoc.exists) {
      // Return 404 page
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Link Not Found</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: #f9fafb;
              }
              .container {
                text-align: center;
                padding: 2rem;
              }
              h1 { font-size: 2rem; margin-bottom: 1rem; }
              p { color: #6b7280; margin-bottom: 2rem; }
              a {
                display: inline-block;
                padding: 0.75rem 1.5rem;
                background: #3b82f6;
                color: white;
                text-decoration: none;
                border-radius: 0.5rem;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🔗 Link Not Found</h1>
              <p>This short link doesn't exist or has been deleted.</p>
              <a href="/">Go to Dashboard</a>
            </div>
          </body>
        </html>
      `);
    }

    const linkData = publicLinkDoc.data();
    const destinationUrl = linkData?.url;

    if (!destinationUrl) {
      return res.status(404).json({ error: 'Destination URL not found' });
    }

    // Record ALL clicks (including bots) - no filtering
    // Use Promise.race to timeout after 5 seconds - don't block redirect
    Promise.race([
      recordClickAnalytics(db, linkData, req),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Analytics timeout after 5s')), 5000)
      )
    ]).catch(err => {
      console.error('❌ Analytics error:', err.message);
      // Don't log full details to avoid verbose errors
    });

    // INSTANT 302 REDIRECT - happens immediately!
    res.setHeader('Location', destinationUrl);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.status(302).end();

  } catch (error) {
    console.error('Redirect error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Detect if the request is from a bot or preview service
 * These shouldn't be counted as real clicks
 */
function isPreviewBot(userAgent: string): boolean {
  const botPatterns = [
    // Link Preview Bots (these fetch links to generate previews)
    'whatsapp',
    'facebookexternalhit',
    'facebot',
    'twitterbot',
    'telegrambot',
    'slackbot',
    'discordbot',
    'linkedinbot',
    'pinterestbot',
    'snapchat',
    'instagram',
    'skypeuripreview',
    'imessagebot',
    
    // Search Engine Crawlers
    'googlebot',
    'bingbot',
    'baiduspider',
    'yandexbot',
    'duckduckbot',
    'slurp', // Yahoo
    
    // SEO & Monitoring Tools
    'ahrefsbot',
    'semrushbot',
    'dotbot',
    'mj12bot',
    'rogerbot',
    'screaming frog',
    'uptimerobot',
    'pingdom',
    'newrelic',
    
    // Social Media Preview Bots
    'tumblr',
    'reddit',
    'applebot',
    'developers.google.com/+/web/snippet',
    
    // Other Bots
    'bot',
    'crawler',
    'spider',
    'scraper',
    'preview',
    'headless'
  ];

  const userAgentLower = userAgent.toLowerCase();
  return botPatterns.some(pattern => userAgentLower.includes(pattern));
}

/**
 * Extract detailed browser and version info
 */
function parseBrowserInfo(userAgent: string): { browser: string; browserVersion?: string } {
  const ua = userAgent.toLowerCase();
  
  // Edge (check first as it contains 'chrome')
  if (ua.includes('edg/')) {
    const match = userAgent.match(/Edg\/([0-9.]+)/);
    return { browser: 'Edge', browserVersion: match ? match[1] : undefined };
  }
  // Chrome
  if (ua.includes('chrome/')) {
    const match = userAgent.match(/Chrome\/([0-9.]+)/);
    return { browser: 'Chrome', browserVersion: match ? match[1] : undefined };
  }
  // Safari
  if (ua.includes('safari/') && !ua.includes('chrome')) {
    const match = userAgent.match(/Version\/([0-9.]+)/);
    return { browser: 'Safari', browserVersion: match ? match[1] : undefined };
  }
  // Firefox
  if (ua.includes('firefox/')) {
    const match = userAgent.match(/Firefox\/([0-9.]+)/);
    return { browser: 'Firefox', browserVersion: match ? match[1] : undefined };
  }
  
  return { browser: 'Unknown' };
}

/**
 * Extract detailed OS and version info
 */
function parseOSInfo(userAgent: string): { os: string; osVersion?: string } {
  const ua = userAgent.toLowerCase();
  
  // Windows
  if (ua.includes('windows nt')) {
    const match = userAgent.match(/Windows NT ([0-9.]+)/);
    const version = match ? match[1] : undefined;
    return { os: 'Windows', osVersion: version };
  }
  // macOS
  if (ua.includes('mac os x')) {
    const match = userAgent.match(/Mac OS X ([0-9_]+)/);
    const version = match ? match[1].replace(/_/g, '.') : undefined;
    return { os: 'macOS', osVersion: version };
  }
  // iOS
  if (ua.includes('iphone') || ua.includes('ipad')) {
    const match = userAgent.match(/OS ([0-9_]+)/);
    const version = match ? match[1].replace(/_/g, '.') : undefined;
    return { os: 'iOS', osVersion: version };
  }
  // Android
  if (ua.includes('android')) {
    const match = userAgent.match(/Android ([0-9.]+)/);
    return { os: 'Android', osVersion: match ? match[1] : undefined };
  }
  // Linux
  if (ua.includes('linux')) {
    return { os: 'Linux' };
  }
  
  return { os: 'Unknown' };
}

/**
 * Detect platform/source from referrer
 */
function detectPlatform(referrer: string): string | undefined {
  if (referrer === 'Direct' || !referrer) return undefined;
  
  const refLower = referrer.toLowerCase();
  
  if (refLower.includes('instagram.com')) return 'Instagram';
  if (refLower.includes('tiktok.com')) return 'TikTok';
  if (refLower.includes('twitter.com') || refLower.includes('x.com')) return 'Twitter/X';
  if (refLower.includes('facebook.com')) return 'Facebook';
  if (refLower.includes('youtube.com')) return 'YouTube';
  if (refLower.includes('linkedin.com')) return 'LinkedIn';
  if (refLower.includes('reddit.com')) return 'Reddit';
  if (refLower.includes('pinterest.com')) return 'Pinterest';
  if (refLower.includes('snapchat.com')) return 'Snapchat';
  if (refLower.includes('t.co')) return 'Twitter/X';
  if (refLower.includes('discord.com')) return 'Discord';
  if (refLower.includes('telegram.org') || refLower.includes('t.me')) return 'Telegram';
  if (refLower.includes('whatsapp.com')) return 'WhatsApp';
  
  return undefined;
}

/**
 * Parse URL query parameters
 */
function parseQueryParams(url: string): {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  queryParams?: Record<string, string>;
} {
  try {
    const urlObj = new URL(url);
    const params = Object.fromEntries(urlObj.searchParams.entries());
    
    const result: any = {};
    const otherParams: Record<string, string> = {};
    
    // Extract UTM parameters
    if (params.utm_source) result.utmSource = params.utm_source;
    if (params.utm_medium) result.utmMedium = params.utm_medium;
    if (params.utm_campaign) result.utmCampaign = params.utm_campaign;
    if (params.utm_term) result.utmTerm = params.utm_term;
    if (params.utm_content) result.utmContent = params.utm_content;
    
    // Collect all other params (excluding UTM params)
    Object.keys(params).forEach(key => {
      if (!key.startsWith('utm_')) {
        otherParams[key] = params[key];
      }
    });
    
    if (Object.keys(otherParams).length > 0) {
      result.queryParams = otherParams;
    }
    
    return result;
  } catch {
    return {};
  }
}

/**
 * Get Geo IP data from request (Vercel provides this)
 */
function getGeoData(req: VercelRequest): {
  country?: string;
  countryCode?: string;
  city?: string;
  region?: string;
} {
  // Vercel provides geo headers
  return {
    country: req.headers['x-vercel-ip-country'] as string | undefined,
    countryCode: req.headers['x-vercel-ip-country-code'] as string | undefined,
    city: req.headers['x-vercel-ip-city'] as string | undefined,
    region: req.headers['x-vercel-ip-country-region'] as string | undefined,
  };
}

/**
 * Record click analytics in background (doesn't delay redirect)
 */
async function recordClickAnalytics(db: any, linkData: any, req: VercelRequest) {
  try {
    const { FieldValue } = await import('firebase-admin/firestore');
    
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const userAgentLower = userAgent.toLowerCase();

    // Detect if bot (still track for analytics, but mark accordingly)
    const isBot = isPreviewBot(userAgent);

    // Device detection
    let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
    if (/mobile|android|iphone/.test(userAgentLower)) {
      deviceType = 'mobile';
    } else if (/tablet|ipad/.test(userAgentLower)) {
      deviceType = 'tablet';
    }

    // Enhanced browser and OS detection
    const browserInfo = parseBrowserInfo(userAgent);
    const osInfo = parseOSInfo(userAgent);

    // Get referrer and extract domain
    const referrer = req.headers['referer'] || req.headers['referrer'] || 'Direct';
    let referrerDomain: string | undefined;
    if (referrer !== 'Direct') {
      try {
        const refUrl = new URL(referrer);
        referrerDomain = refUrl.hostname.replace('www.', '');
      } catch {
        referrerDomain = undefined;
      }
    }

    // Detect platform from referrer
    const platform = detectPlatform(referrer);

    // Get Geo IP data
    const geoData = getGeoData(req);

    // Parse query parameters from original request
    const fullUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}${req.url}`;
    const queryData = parseQueryParams(fullUrl);

    // Get language and timezone from headers
    const language = req.headers['accept-language']?.split(',')[0];
    const timezone = req.headers['x-vercel-ip-timezone'] as string | undefined;

    // Get IP for unique click tracking
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
    const ipString = Array.isArray(ip) ? ip[0] : ip;
    
    // Create IP hash for privacy
    const crypto = await import('crypto');
    const ipHash = crypto.createHash('sha256').update(ipString + linkData.linkId).digest('hex');

    // Get ISP/Organization info (if available from Vercel)
    const isp = req.headers['x-vercel-ip-isp'] as string | undefined;
    const organization = req.headers['x-vercel-ip-org'] as string | undefined;

    // Create click document (correct path with projects)
    const clickRef = db
      .collection('organizations')
      .doc(linkData.orgId)
      .collection('projects')
      .doc(linkData.projectId)
      .collection('links')
      .doc(linkData.linkId)
      .collection('clicks')
      .doc();

    // Build click data - filter out undefined values to avoid Firestore errors
    const clickData: Record<string, any> = {
      id: clickRef.id,
      linkId: linkData.linkId,
      timestamp: FieldValue.serverTimestamp(),
      userAgent,
      deviceType,
      browser: browserInfo.browser,
      referrer,
      ipHash,
      isBot, // Now properly detected - still tracked but marked for analytics
    };

    // Add optional fields only if they have values
    if (browserInfo.browserVersion) clickData.browserVersion = browserInfo.browserVersion;
    if (osInfo.os) clickData.os = osInfo.os;
    if (osInfo.osVersion) clickData.osVersion = osInfo.osVersion;
    if (referrerDomain) clickData.referrerDomain = referrerDomain;
    if (geoData.country) clickData.country = geoData.country;
    if (geoData.countryCode) clickData.countryCode = geoData.countryCode;
    if (geoData.city) clickData.city = geoData.city;
    if (geoData.region) clickData.region = geoData.region;
    if (isp) clickData.isp = isp;
    if (organization) clickData.organization = organization;
    if (platform) clickData.platform = platform;
    if (language) clickData.language = language;
    if (timezone) clickData.timezone = timezone;

    // Add UTM and query params (spread only adds defined values)
    Object.entries(queryData).forEach(([key, value]) => {
      if (value !== undefined) {
        clickData[key] = value;
      }
    });

    console.log(`📊 Recording click for link ${linkData.linkId} in project ${linkData.projectId}`);
    console.log(`📍 Click path: organizations/${linkData.orgId}/projects/${linkData.projectId}/links/${linkData.linkId}/clicks/${clickRef.id}`);

    // Validate required fields
    if (!linkData.orgId || !linkData.projectId || !linkData.linkId) {
      throw new Error(`Missing required fields: orgId=${linkData.orgId}, projectId=${linkData.projectId}, linkId=${linkData.linkId}`);
    }

    // Write click document
    await clickRef.set(clickData);
    console.log(`✅ Click document created successfully`);

    // Update link stats using atomic increment (correct path with projects)
    const linkRef = db
      .collection('organizations')
      .doc(linkData.orgId)
      .collection('projects')
      .doc(linkData.projectId)
      .collection('links')
      .doc(linkData.linkId);

    await linkRef.update({
      totalClicks: FieldValue.increment(1),
      lastClickedAt: FieldValue.serverTimestamp(),
    });

    console.log(`✅ Click recorded successfully for link ${linkData.linkId} in project ${linkData.projectId}`);
  } catch (error) {
    console.error('❌ Failed to record analytics:', error);
    throw error; // Re-throw to see in logs
  }
}

