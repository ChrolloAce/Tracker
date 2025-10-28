import { VercelRequest, VercelResponse } from '@vercel/node';
import * as jose from 'jose';

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { privateKey, keyId, issuerId, bundleId, useSandbox = true } = req.body;

  if (!privateKey || !keyId || !issuerId || !bundleId) {
    return res.status(400).json({ 
      error: 'Missing required credentials', 
      details: 'privateKey, keyId, issuerId, and bundleId are required' 
    });
  }

  try {
    // 1. Generate JWT token
    const decodedPrivateKey = Buffer.from(privateKey, 'base64').toString('utf8');
    const alg = 'ES256';
    const pkey = await jose.importPKCS8(decodedPrivateKey, alg);

    const jwt = await new jose.SignJWT({})
      .setProtectedHeader({
        alg,
        kid: keyId,
      })
      .setIssuer(issuerId)
      .setIssuedAt()
      .setExpirationTime('20m')
      .setAudience('https://api.storekit.itunes.apple.com')
      .sign(pkey);

    // 2. Test connection to Apple's API
    const baseUrl = useSandbox 
      ? 'https://api.storekit-sandbox.itunes.apple.com' 
      : 'https://api.storekit.itunes.apple.com';
    
    // Use a lightweight endpoint to test authentication
    // We expect 404 or 4xx (not found) but that's OK - it means auth worked
    const testResponse = await fetch(`${baseUrl}/inApps/v1/lookup/12345`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('🍎 Apple API test response status:', testResponse.status);

    // Success cases:
    // - 200-299: Valid response
    // - 400-499: Auth worked, but endpoint/data not found (expected for test)
    // Failure cases:
    // - 401: Unauthorized (bad credentials)
    // - 500+: Server error
    
    if (testResponse.status === 401) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication failed',
        details: 'Invalid credentials. Please check your Key ID, Issuer ID, and Private Key.'
      });
    }

    // Any other response (even 404) means the JWT worked
    if (testResponse.status < 500) {
      return res.status(200).json({ 
        success: true, 
        message: 'Apple App Store connection successful',
        statusCode: testResponse.status
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: 'Apple server error',
      details: `Received status ${testResponse.status} from Apple API`
    });

  } catch (error) {
    console.error('❌ Apple connection test failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to test Apple connection', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

