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

    // Record click analytics in background (don't await)
    recordClickAnalytics(db, linkData, req).catch(err => 
      console.error('Analytics error:', err)
    );

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
 * Record click analytics in background (doesn't delay redirect)
 */
async function recordClickAnalytics(db: any, linkData: any, req: VercelRequest) {
  try {
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

    // Create click document
    const clickRef = db
      .collection('organizations')
      .doc(linkData.orgId)
      .collection('links')
      .doc(linkData.linkId)
      .collection('clicks')
      .doc();

    const clickData = {
      id: clickRef.id,
      linkId: linkData.linkId,
      timestamp: new Date(),
      userAgent,
      deviceType,
      browser,
      os,
      referrer,
    };

    // Batch write for analytics
    const batch = db.batch();
    batch.set(clickRef, clickData);

    // Update link stats
    const linkRef = db
      .collection('organizations')
      .doc(linkData.orgId)
      .collection('links')
      .doc(linkData.linkId);

    batch.update(linkRef, {
      totalClicks: (linkData.totalClicks || 0) + 1,
      lastClickedAt: new Date(),
    });

    await batch.commit();
  } catch (error) {
    console.error('Failed to record analytics:', error);
  }
}

