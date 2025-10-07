import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Test TikTok Actor - Check if clockworks~tiktok-scraper is accessible
 * 
 * Usage: GET /api/test-tiktok-actor?username=USERNAME
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username = 'charlidamelio' } = req.query; // Default to a known TikTok account

  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  
  if (!APIFY_TOKEN) {
    return res.status(500).json({
      error: 'APIFY_TOKEN not set'
    });
  }

  console.log(`🧪 Testing TikTok actor with username: ${username}`);

  try {
    const actorId = 'clockworks~tiktok-scraper';
    const input = {
      profiles: [username],
      resultsPerPage: 5, // Just 5 for testing
      proxy: {
        useApifyProxy: true
      }
    };

    console.log('📋 Request details:');
    console.log(`   Actor: ${actorId}`);
    console.log(`   Input:`, JSON.stringify(input, null, 2));

    const syncItemsUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
    
    console.log('🔗 Calling Apify API...');
    const startTime = Date.now();
    
    const response = await fetch(syncItemsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️ API call took ${duration}ms`);
    console.log(`📡 Response status: ${response.status}`);

    if (response.status === 401) {
      const errorText = await response.text();
      console.error('❌ 401 Unauthorized:', errorText);
      
      return res.status(401).json({
        success: false,
        error: '401 Unauthorized from Apify',
        message: 'The clockworks~tiktok-scraper actor is rejecting your request',
        details: errorText,
        possibleReasons: [
          'The actor requires a paid subscription',
          'You need to "Subscribe" to this actor in Apify console first',
          'The actor owner changed access permissions',
          'The actor requires additional credits/payment',
          'Your Apify plan doesn\'t include access to this actor'
        ],
        solutions: [
          '1. Go to https://console.apify.com/actors/clockworks~tiktok-scraper',
          '2. Check if you need to click "Subscribe" or "Add to account"',
          '3. Check the actor\'s pricing page',
          '4. Try a different TikTok scraper actor (search for free alternatives)',
          '5. Contact the actor owner for access'
        ],
        alternativeActors: [
          'Try searching for "tiktok scraper" in Apify Store',
          'Look for actors marked as "Free" or with your plan',
          'Consider using TikTok\'s official API if you have access'
        ]
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Apify API error (${response.status}):`, errorText);
      
      return res.status(response.status).json({
        success: false,
        error: `Apify API error: ${response.status}`,
        details: errorText.substring(0, 1000),
        actorId
      });
    }

    const items = await response.json();
    const itemsArray = Array.isArray(items) ? items : [];
    
    console.log(`✅ Received ${itemsArray.length} items`);

    if (itemsArray.length > 0) {
      console.log('📊 Sample item:', JSON.stringify(itemsArray[0]).substring(0, 500));
    }
    
    return res.status(200).json({
      success: true,
      message: `Successfully fetched TikTok videos for @${username}`,
      stats: {
        totalVideos: itemsArray.length,
        duration: `${duration}ms`,
        username
      },
      actorDetails: {
        actorId,
        input,
        actorUrl: `https://console.apify.com/actors/${actorId}`
      },
      sampleVideos: itemsArray.slice(0, 3).map((item: any) => ({
        id: item.id,
        text: (item.text || '').substring(0, 100),
        author: item.authorMeta?.name || item.author?.name,
        stats: {
          views: item.playCount || item.viewCount,
          likes: item.diggCount || item.likes,
          comments: item.commentCount,
          shares: item.shareCount
        },
        url: item.webVideoUrl || item.videoUrl
      })),
      nextSteps: itemsArray.length > 0 ? [
        '✅ The actor is working!',
        '✅ Your token has access',
        'You can now add TikTok accounts'
      ] : [
        'The actor ran but returned 0 videos',
        'Try a different username',
        'Check if the TikTok account exists and is public'
      ]
    });

  } catch (error: any) {
    console.error('❌ Test failed:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Test failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

