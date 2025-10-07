import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Test Apify Token - Check if your Apify API token is valid
 * 
 * Usage: GET /api/test-apify-token
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  
  console.log('🔍 Testing Apify token...');
  console.log('📋 Token source:', APIFY_TOKEN ? 'Environment variable' : 'MISSING - using fallback (WILL FAIL)');
  
  if (!APIFY_TOKEN) {
    return res.status(500).json({
      success: false,
      error: 'APIFY_TOKEN not set',
      message: 'The APIFY_TOKEN environment variable is not set in Vercel',
      solution: [
        '1. Go to https://console.apify.com/account/integrations',
        '2. Copy your Personal API token',
        '3. Go to Vercel Dashboard → Your Project → Settings → Environment Variables',
        '4. Add APIFY_TOKEN with your token value',
        '5. Redeploy your app'
      ]
    });
  }

  try {
    // Test the token by calling Apify's user info endpoint
    console.log('🔑 Testing token:', APIFY_TOKEN.substring(0, 20) + '...');
    
    const response = await fetch(`https://api.apify.com/v2/users/me?token=${APIFY_TOKEN}`);
    
    console.log('📡 Response status:', response.status);
    
    if (response.status === 401) {
      const errorData = await response.json();
      console.error('❌ Token is invalid:', errorData);
      
      return res.status(401).json({
        success: false,
        error: 'Invalid Apify token',
        status: 401,
        message: 'Your APIFY_TOKEN is set but it\'s invalid or expired',
        details: errorData,
        solution: [
          '1. Go to https://console.apify.com/account/integrations',
          '2. Generate a NEW Personal API token',
          '3. Go to Vercel Dashboard → Your Project → Settings → Environment Variables',
          '4. UPDATE the APIFY_TOKEN value with your new token',
          '5. Redeploy your app'
        ]
      });
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API error:', errorText);
      
      return res.status(response.status).json({
        success: false,
        error: 'Apify API error',
        status: response.status,
        details: errorText.substring(0, 500)
      });
    }
    
    const userData = await response.json();
    console.log('✅ Token is valid! User:', userData.data.username);
    
    // Check usage/credits
    const usageResponse = await fetch(`https://api.apify.com/v2/users/me/usage/monthly?token=${APIFY_TOKEN}`);
    let usageInfo = null;
    
    if (usageResponse.ok) {
      const usageData = await usageResponse.json();
      usageInfo = usageData.data;
      console.log('💰 Usage info:', usageInfo);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Apify token is valid! ✅',
      tokenInfo: {
        tokenSet: true,
        tokenPrefix: APIFY_TOKEN.substring(0, 20) + '...',
        valid: true
      },
      accountInfo: {
        username: userData.data.username,
        email: userData.data.email,
        plan: userData.data.plan,
        userId: userData.data.id
      },
      usage: usageInfo,
      nextSteps: [
        'Your token is valid! The 401 errors are coming from somewhere else.',
        'Check if you have enough Apify credits',
        'Check if the specific actors you\'re using are accessible with your plan'
      ]
    });
    
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Test failed',
      message: error.message
    });
  }
}

