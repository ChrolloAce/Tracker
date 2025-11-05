import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import jwt from 'jsonwebtoken';

// Initialize Firebase Admin
if (getApps().length === 0) {
  // Support both regular and base64-encoded credentials
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  
  // If FIREBASE_SERVICE_ACCOUNT_BASE64 is set, use that instead
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8')
      );
      initializeApp({
        credential: cert(serviceAccount)
      });
    } catch (error) {
      console.error('Failed to parse base64 service account:', error);
      throw error;
    }
  } else {
    // Use individual environment variables
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey?.replace(/\\n/g, '\n'),
      }),
    });
  }
}

const db = getFirestore();

/**
 * Decrypt the private key (reverse of encryption from wizard)
 */
function decryptPrivateKey(encryptedKey: string): string {
  try {
    // Reverse base64 + XOR cipher (0xAA)
    const decoded = Buffer.from(encryptedKey, 'base64').toString('binary');
    const decrypted = Array.from(decoded)
      .map(char => String.fromCharCode(char.charCodeAt(0) ^ 0xAA))
      .join('');
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt private key:', error);
    throw new Error('Failed to decrypt private key');
  }
}

/**
 * Generate JWT token for Apple App Store Connect API
 */
function generateAppleJWT(privateKey: string, keyId: string, issuerId: string): string {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: issuerId,
    exp: now + (20 * 60), // 20 minutes expiration
    aud: 'appstoreconnect-v1'
  };

  const token = jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    keyid: keyId,
    header: {
      alg: 'ES256',
      kid: keyId,
      typ: 'JWT'
    }
  });

  return token;
}

/**
 * Fetch sales reports from Apple App Store Connect API
 */
async function fetchAppleSalesReports(
  token: string,
  vendorNumber: string,
  reportDate: string
): Promise<any[]> {
  const url = new URL('https://api.appstoreconnect.apple.com/v1/salesReports');
  url.searchParams.append('filter[frequency]', 'DAILY');
  url.searchParams.append('filter[reportSubType]', 'SUMMARY');
  url.searchParams.append('filter[reportType]', 'SALES');
  url.searchParams.append('filter[vendorNumber]', vendorNumber);
  url.searchParams.append('filter[reportDate]', reportDate); // Format: YYYY-MM-DD

  console.log('📊 Fetching Apple sales reports:', {
    vendorNumber,
    reportDate,
    url: url.toString()
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/a-gzip'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Apple API Error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    });
    throw new Error(`Apple API request failed: ${response.status} ${response.statusText}`);
  }

  // Apple returns gzipped TSV data
  // For now, we'll return the raw response
  // In production, you'd decompress and parse the TSV
  const contentType = response.headers.get('content-type');
  console.log('Response content-type:', contentType);

  // Parse based on content type
  if (contentType?.includes('application/json')) {
    return await response.json();
  } else {
    // Gzipped data - would need decompression
    const buffer = await response.arrayBuffer();
    console.log('Received gzipped data, size:', buffer.byteLength);
    // TODO: Decompress and parse TSV data
    return [];
  }
}

/**
 * Main handler for syncing Apple revenue
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🍎 Starting Apple revenue sync...');

    // Get organization and project from query params or body
    const { organizationId, projectId, manual } = req.method === 'POST' 
      ? req.body 
      : req.query;

    if (!organizationId || !projectId) {
      return res.status(400).json({
        success: false,
        error: 'Missing organizationId or projectId'
      });
    }

    console.log('📦 Syncing for:', { organizationId, projectId, manual: !!manual });

    // Get Apple integration from Firestore
    const integrationsRef = db
      .collection('organizations')
      .doc(organizationId as string)
      .collection('projects')
      .doc(projectId as string)
      .collection('revenueIntegrations');

    const integrationsSnapshot = await integrationsRef
      .where('provider', '==', 'apple')
      .where('enabled', '==', true)
      .limit(1)
      .get();

    if (integrationsSnapshot.empty) {
      console.log('❌ No active Apple integration found');
      return res.status(404).json({
        success: false,
        error: 'No active Apple App Store integration found'
      });
    }

    const integrationDoc = integrationsSnapshot.docs[0];
    const integration = integrationDoc.data();

    console.log('✅ Found Apple integration:', {
      id: integrationDoc.id,
      issuerId: integration.credentials?.issuerId?.slice(0, 8) + '...',
      keyId: integration.credentials?.keyId,
      vendorNumber: integration.credentials?.vendorNumber
    });

    // Decrypt private key
    const encryptedKey = integration.credentials?.apiKey;
    if (!encryptedKey) {
      throw new Error('Private key not found in integration');
    }

    console.log('🔓 Decrypting private key...');
    const privateKey = decryptPrivateKey(encryptedKey);
    
    // Generate JWT token
    console.log('🎟️  Generating JWT token...');
    const token = generateAppleJWT(
      privateKey,
      integration.credentials.keyId,
      integration.credentials.issuerId
    );

    console.log('✅ JWT token generated successfully');

    // Fetch sales reports for yesterday (most recent complete day)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const reportDate = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log('📥 Fetching sales reports for:', reportDate);
    
    const salesData = await fetchAppleSalesReports(
      token,
      integration.credentials.vendorNumber,
      reportDate
    );

    console.log('📊 Sales data received:', {
      recordCount: Array.isArray(salesData) ? salesData.length : 'unknown',
      type: typeof salesData
    });

    // Update last synced timestamp
    await integrationDoc.ref.update({
      lastSynced: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    // TODO: Parse and store revenue transactions in Firestore
    // For now, we'll just return the raw data
    
    return res.status(200).json({
      success: true,
      message: 'Apple revenue sync completed successfully',
      data: {
        integrationId: integrationDoc.id,
        reportDate,
        recordCount: Array.isArray(salesData) ? salesData.length : 0,
        lastSynced: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Apple revenue sync failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync Apple revenue',
      details: error.stack
    });
  }
}

