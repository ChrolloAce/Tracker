/**
 * Apple App Store JWT Token Generator
 * 
 * This serverless function generates JWT tokens for authenticating with Apple's App Store Server API.
 * It uses the ES256 algorithm with the provided private key.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT, importPKCS8 } from 'jose';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { privateKey, keyId, issuerId } = req.body;

    // Validate required fields
    if (!privateKey || !keyId || !issuerId) {
      return res.status(400).json({ 
        error: 'Missing required fields: privateKey, keyId, issuerId' 
      });
    }

    // Decrypt the private key (reverse of encryption from wizard)
    let privateKeyPem: string;
    try {
      // First decode from base64, then reverse XOR encryption
      const decoded = Buffer.from(privateKey, 'base64').toString('binary');
      privateKeyPem = Array.from(decoded)
        .map(char => String.fromCharCode(char.charCodeAt(0) ^ 0xAA))
        .join('');
    } catch (error) {
      return res.status(400).json({ 
        error: 'Invalid private key format. Failed to decrypt.' 
      });
    }

    // Import the private key
    const key = await importPKCS8(privateKeyPem, 'ES256');

    // Generate the JWT token
    const jwt = await new SignJWT({})
      .setProtectedHeader({
        alg: 'ES256',
        kid: keyId,
        typ: 'JWT'
      })
      .setIssuedAt()
      .setIssuer(issuerId)
      .setAudience('appstoreconnect-v1')
      .setExpirationTime('20m') // Token expires in 20 minutes
      .sign(key);

    // Return the token
    return res.status(200).json({ 
      token: jwt,
      expiresIn: 1200 // 20 minutes in seconds
    });

  } catch (error) {
    console.error('❌ JWT generation error:', error);
    
    // Return a helpful error message
    return res.status(500).json({ 
      error: 'Failed to generate JWT token',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

