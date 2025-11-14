import { VercelRequest, VercelResponse } from '@vercel/node';
import * as jose from 'jose';

interface AppleServerAPIResponse {
  data?: any[];
  meta?: {
    hasMore?: boolean;
    revision?: string;
  };
}

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { privateKey, keyId, issuerId, bundleId, startDate, endDate, useSandbox = false } = req.body;

  if (!privateKey || !keyId || !issuerId || !bundleId || !startDate || !endDate) {
    return res.status(400).json({ 
      error: 'Missing required parameters', 
      details: 'privateKey, keyId, issuerId, bundleId, startDate, and endDate are required' 
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
        kid: keyId,
      })
      .setIssuer(issuerId)
      .setIssuedAt()
      .setExpirationTime('20m')
      .setAudience('https://api.storekit.itunes.apple.com')
      .sign(pkey);

    // 2. Fetch transactions with pagination
    const baseUrl = useSandbox 
      ? 'https://api.storekit-sandbox.itunes.apple.com' 
      : 'https://api.storekit.itunes.apple.com';
    
    const allData: any[] = [];
    let hasMore = true;
    let revision: string | undefined;
    let pageCount = 0;
    const maxPages = 100; // Safety limit

    while (hasMore && pageCount < maxPages) {
      const url = new URL(`${baseUrl}/inApps/v1/history/${bundleId}`);
      if (revision) {
        url.searchParams.append('revision', revision);
      }

      console.log(`🍎 Fetching Apple transactions page ${pageCount + 1}...`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Apple API error:', response.status, errorText);
        return res.status(response.status).json({ 
          error: 'Apple API error',
          status: response.status,
          details: errorText
        });
      }

      const data: AppleServerAPIResponse = await response.json();
      
      if (data.data) {
        allData.push(...data.data);
      }

      hasMore = data.meta?.hasMore || false;
      revision = data.meta?.revision;
      pageCount++;
    }

    console.log(`✅ Fetched ${allData.length} total Apple transactions across ${pageCount} pages`);

    // Return raw transaction data - let the client filter by date
    res.status(200).json({ 
      success: true,
      transactions: allData,
      pageCount,
      totalCount: allData.length
    });

  } catch (error) {
    console.error('❌ Failed to fetch Apple transactions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transactions', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

