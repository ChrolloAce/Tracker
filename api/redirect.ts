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

    // Check if request is from a bot/preview service (don't count these as clicks)
    const userAgent = req.headers['user-agent'] || '';
    const isBot = isPreviewBot(userAgent);

    if (!isBot) {
      // Only record analytics for real human clicks
      recordClickAnalytics(db, linkData, req).catch(err => 
        console.error('Analytics error:', err)
      );
    } else {
      console.log(`🤖 Bot/preview detected, not recording click: ${userAgent.substring(0, 50)}...`);
    }

    // INSTANT 302 REDIRECT - happens immediately!
    res.setHeader('Location', destinationUrl);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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
 * Record click analytics in background (doesn't delay redirect)
 */
async function recordClickAnalytics(db: any, linkData: any, req: VercelRequest) {
  try {
    const { FieldValue } = await import('firebase-admin/firestore');
    
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const userAgentLower = userAgent.toLowerCase();

    // Device detection
    let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
    if (/mobile|android|iphone/.test(userAgentLower)) {
      deviceType = 'mobile';
    } else if (/tablet|ipad/.test(userAgentLower)) {
      deviceType = 'tablet';
    }

    // Browser detection
    let browser = 'Unknown';
    if (userAgentLower.includes('chrome')) browser = 'Chrome';
    else if (userAgentLower.includes('safari')) browser = 'Safari';
    else if (userAgentLower.includes('firefox')) browser = 'Firefox';
    else if (userAgentLower.includes('edge')) browser = 'Edge';

    // OS detection
    let os = 'Unknown';
    if (userAgentLower.includes('windows')) os = 'Windows';
    else if (userAgentLower.includes('mac')) os = 'macOS';
    else if (userAgentLower.includes('linux')) os = 'Linux';
    else if (userAgentLower.includes('android')) os = 'Android';
    else if (userAgentLower.includes('ios') || userAgentLower.includes('iphone') || userAgentLower.includes('ipad')) os = 'iOS';

    // Get referrer
    const referrer = req.headers['referer'] || req.headers['referrer'] || 'Direct';

    // Get IP for unique click tracking
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
    const ipString = Array.isArray(ip) ? ip[0] : ip;
    
    // Create IP hash for privacy
    const crypto = await import('crypto');
    const ipHash = crypto.createHash('sha256').update(ipString + linkData.linkId).digest('hex');

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

    const clickData = {
      id: clickRef.id,
      linkId: linkData.linkId,
      timestamp: FieldValue.serverTimestamp(),
      userAgent,
      deviceType,
      browser,
      os,
      referrer,
      ipHash,
    };

    console.log(`📊 Recording click for link ${linkData.linkId} in project ${linkData.projectId}`);

    // Write click document
    await clickRef.set(clickData);

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

