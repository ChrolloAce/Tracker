import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Test Twitter Scraper - Diagnostic endpoint
 * 
 * Usage: GET /api/test-twitter-scraper?username=TWITTER_USERNAME
 * 
 * This endpoint tests the Apify tweet scraper to diagnose issues
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.query;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ 
      error: 'Missing or invalid username parameter',
      usage: '/api/test-twitter-scraper?username=TWITTER_USERNAME'
    });
  }

  console.log(`🧪 Testing Twitter scraper for username: ${username}`);

  try {
    const APIFY_TOKEN = process.env.APIFY_TOKEN || 'apify_api_7wvIrJjtEH6dTZktJZAtcIGAylH7cX2jRweu';
    const actorId = 'apidojo~tweet-scraper';
    
    const input = {
      twitterHandles: [username],
      maxItems: 5, // Just fetch 5 for testing
      sort: 'Latest',
      onlyImage: false,
      onlyVideo: false,
      onlyQuote: false,
      onlyVerifiedUsers: false,
      onlyTwitterBlue: false,
      includeSearchTerms: false,
    };

    console.log('📋 Request details:');
    console.log(`   Actor: ${actorId}`);
    console.log(`   Input:`, JSON.stringify(input, null, 2));
    console.log(`   Token: ${APIFY_TOKEN.substring(0, 15)}...`);

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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Apify API error:', errorText);
      
      return res.status(500).json({
        success: false,
        error: 'Apify API error',
        status: response.status,
        details: errorText.substring(0, 1000),
        suggestions: [
          'Check if the Apify actor exists and is publicly accessible',
          'Verify that the APIFY_TOKEN environment variable is set correctly',
          'Ensure the Twitter username is correct (without @ symbol)',
          'Check if the account exists and is public',
        ]
      });
    }

    const items = await response.json();
    const itemsArray = Array.isArray(items) ? items : [];
    
    console.log(`✅ Received ${itemsArray.length} items`);

    if (itemsArray.length > 0) {
      console.log('📊 Sample item structure:', Object.keys(itemsArray[0]));
      console.log('📊 First item author:', itemsArray[0].author);
    }

    // Filter out retweets
    const originalTweets = itemsArray.filter((tweet: any) => !tweet.isRetweet);
    
    return res.status(200).json({
      success: true,
      message: `Successfully fetched tweets for @${username}`,
      stats: {
        totalItems: itemsArray.length,
        originalTweets: originalTweets.length,
        retweets: itemsArray.length - originalTweets.length,
        duration: `${duration}ms`
      },
      actorDetails: {
        actorId,
        input
      },
      sampleTweets: originalTweets.slice(0, 3).map((tweet: any) => ({
        id: tweet.id,
        text: (tweet.fullText || tweet.text || '').substring(0, 100),
        author: {
          name: tweet.author?.name,
          username: tweet.author?.userName,
          followers: tweet.author?.followers
        },
        stats: {
          views: tweet.viewCount,
          likes: tweet.likeCount,
          replies: tweet.replyCount,
          retweets: tweet.retweetCount
        },
        createdAt: tweet.createdAt,
        url: tweet.url
      })),
      diagnostics: {
        tokenPresent: !!APIFY_TOKEN,
        responseStatus: response.status,
        itemsReceived: itemsArray.length,
        possibleIssues: itemsArray.length === 0 ? [
          'Account may not exist or username is incorrect',
          'Account may be private',
          'Account may have no tweets',
          'Apify actor may have changed or been deprecated',
          'Rate limiting may be in effect'
        ] : []
      }
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

