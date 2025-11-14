import { VercelRequest, VercelResponse } from '@vercel/node';
import * as jose from 'jose';

export default async function (req: VercelRequest, res: VercelResponse) {
  console.log('🍎 Apple connection test endpoint called');
  console.log('Method:', req.method);
  
  if (req.method !== 'POST') {
    console.log('❌ Invalid method');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { privateKey, keyID, keyId, issuerID, issuerId, vendorNumber, bundleId } = req.body;

  // Support both naming conventions (keyID/keyId, issuerID/issuerId)
  const finalKeyId = keyID || keyId;
  const finalIssuerId = issuerID || issuerId;

  console.log('📋 Received credentials:', {
    hasPrivateKey: !!privateKey,
    privateKeyLength: privateKey?.length || 0,
    keyID: finalKeyId,
    issuerID: finalIssuerId,
    vendorNumber: vendorNumber || 'not provided'
  });

  if (!privateKey || !finalKeyId || !finalIssuerId) {
    console.log('❌ Missing required credentials');
    return res.status(400).json({ 
      error: 'Missing required credentials', 
      details: 'privateKey, keyId, and issuerId are required',
      message: 'Please provide all required credentials'
    });
  }

  try {
    // 1. Decrypt the private key (reverse of encryption from wizard)
    // First decode from base64, then reverse XOR encryption
    const decoded = Buffer.from(privateKey, 'base64').toString('binary');
    const decrypted = Array.from(decoded)
      .map(char => String.fromCharCode(char.charCodeAt(0) ^ 0xAA))
      .join('');
    
    // 2. Generate JWT token
    const alg = 'ES256';
    const pkey = await jose.importPKCS8(decrypted, alg);

    const jwt = await new jose.SignJWT({})
      .setProtectedHeader({
        alg,
        kid: finalKeyId,
      })
      .setIssuer(finalIssuerId)
      .setIssuedAt()
      .setExpirationTime('20m')
      .setAudience('appstoreconnect-v1')
      .sign(pkey);

    console.log('🔑 Testing Apple App Store Connect API with:', {
      keyId: finalKeyId,
      issuerId: finalIssuerId,
      vendorNumber: vendorNumber || 'not provided'
    });

    // 2. Test connection to App Store Connect API
    // Use the finance reports endpoint to test credentials
    const testUrl = 'https://api.appstoreconnect.apple.com/v1/apps';
    
    const testResponse = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('🍎 Apple App Store Connect API test response status:', testResponse.status);

    // Success cases:
    // - 200-299: Valid response - credentials work!
    // - 403: Forbidden - auth worked but might need specific permissions
    // - 404: Not found - auth worked
    // Failure cases:
    // - 401: Unauthorized (bad credentials)
    // - 500+: Server error
    
    if (testResponse.status === 401) {
      const errorData = await testResponse.json().catch(() => ({}));
      console.error('❌ 401 Unauthorized:', errorData);
      return res.status(200).json({ 
        success: false, 
        message: 'Invalid credentials. Please verify your Issuer ID, Key ID, and Private Key are correct.',
        error: 'Authentication failed'
      });
    }

    // Any response that's not 401 or 500+ means the JWT authentication worked
    if (testResponse.status < 500) {
      console.log('✅ Apple API credentials validated successfully');
      return res.status(200).json({ 
        success: true, 
        message: 'Connection successful! Your Apple App Store Connect credentials are valid.',
        statusCode: testResponse.status
      });
    }

    return res.status(200).json({ 
      success: false, 
      message: 'Apple server error. Please try again later.',
      error: `Received status ${testResponse.status} from Apple API`
    });

  } catch (error) {
    console.error('❌ Apple connection test error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to test connection. ';
    if (error instanceof Error) {
      if (error.message.includes('Invalid PKCS8')) {
        errorMessage += 'Invalid private key format. Please ensure you uploaded the correct .p8 file.';
      } else if (error.message.includes('JWT')) {
        errorMessage += 'Failed to generate authentication token. Please check your credentials.';
      } else {
        errorMessage += error.message;
      }
    }
    
    res.status(200).json({ 
      success: false,
      message: errorMessage,
      error: 'Connection test failed'
    });
  }
}

