import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Test YouTube API configuration
 * Tests if YOUTUBE_API_KEY is configured and working
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    // Check if API key is configured
    if (!apiKey) {
      return res.status(500).json({ 
        success: false,
        error: 'YouTube API key not configured',
        message: 'YOUTUBE_API_KEY environment variable is missing. Please add it to your Vercel environment variables.',
        instructions: 'See ENVIRONMENT_VARIABLES_CHECKLIST.md for setup instructions.'
      });
    }

    // Test API key by fetching a test channel (YouTube's official channel)
    const testChannelId = 'UC_x5XG1OV2P6uZZ5FSM9Ttw'; // YouTube's official channel
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${testChannelId}&key=${apiKey}`;
    
    console.log('🧪 Testing YouTube API key...');
    const ytRes = await fetch(url);
    
    if (!ytRes.ok) {
      const text = await ytRes.text();
      return res.status(ytRes.status).json({
        success: false,
        error: 'YouTube API key test failed',
        status: ytRes.status,
        details: text,
        message: 'The API key is configured but failed to authenticate with YouTube. Check if the key is valid and has YouTube Data API v3 enabled.'
      });
    }

    const data = await ytRes.json();
    
    if (!data.items || data.items.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'YouTube API returned no results',
        message: 'The API key works but returned unexpected results. This might indicate API restrictions.'
      });
    }

    // Success!
    return res.status(200).json({
      success: true,
      message: '✅ YouTube API key is configured and working correctly!',
      apiKeyPrefix: apiKey.substring(0, 10) + '...',
      testChannel: {
        id: data.items[0].id,
        title: data.items[0].snippet.title,
        description: data.items[0].snippet.description.substring(0, 100) + '...'
      },
      quotaUsed: '1 unit (channel info)',
      recommendations: [
        'Your YouTube integration is ready to use',
        'Users can now track YouTube channels and fetch Shorts',
        'Daily quota: 10,000 units (this test used 1 unit)'
      ]
    });

  } catch (error) {
    console.error('❌ YouTube config test error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      instructions: 'Check server logs for more details'
    });
  }
}

