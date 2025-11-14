import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import jwt from 'jsonwebtoken';
import { gunzipSync } from 'zlib';

// Initialize Firebase Admin (same pattern as other working endpoints)
function initializeFirebase() {
if (getApps().length === 0) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    // Handle quoted private keys
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    // Replace escaped newlines with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');

    const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    };

    initializeApp({ 
      credential: cert(serviceAccount as any) 
    });
    console.log('✅ Firebase Admin initialized for Apple sync');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    throw error;
  }
}
  return getFirestore();
}

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
  } else if (contentType?.includes('application/a-gzip')) {
    // Gzipped TSV data - decompress and parse
    const buffer = await response.arrayBuffer();
    console.log('Received gzipped data, size:', buffer.byteLength);
    
    try {
      // Decompress the gzipped data
      const decompressed = gunzipSync(Buffer.from(buffer));
      const tsvText = decompressed.toString('utf-8');
      
      // Parse TSV (tab-separated values)
      const lines = tsvText.trim().split('\n');
      const headers = lines[0].split('\t');
      
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        const record: any = {};
        
        headers.forEach((header, index) => {
          record[header] = values[index];
        });
        
        records.push(record);
      }
      
      console.log(`📊 Parsed ${records.length} records from TSV`);
      return records;
    } catch (error) {
      console.error('Failed to decompress/parse TSV:', error);
      return [];
    }
  } else {
    console.log('Unknown content type:', contentType);
    return [];
  }
}

/**
 * Main handler for syncing Apple revenue
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Initialize Firebase
  const db = initializeFirebase();
  
  try {
    console.log('🍎 Starting Apple revenue sync...');

    // Get organization and project from query params or body
    const { organizationId, projectId, manual, dateRange } = req.method === 'POST' 
      ? req.body 
      : req.query;

    if (!organizationId || !projectId) {
      return res.status(400).json({
        success: false,
        error: 'Missing organizationId or projectId'
      });
    }

    // Parse date range (30, 90, or custom number of days)
    const daysToSync = dateRange ? parseInt(dateRange as string) : 90;
    
    console.log('📦 Syncing for:', { organizationId, projectId, manual: !!manual, days: daysToSync });

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
    
    // Validate credentials
    if (!integration.credentials.keyId || typeof integration.credentials.keyId !== 'string') {
      throw new Error('Invalid or missing keyId in integration credentials');
    }
    if (!integration.credentials.issuerId || typeof integration.credentials.issuerId !== 'string') {
      throw new Error('Invalid or missing issuerId in integration credentials');
    }
    
    // Generate JWT token
    console.log('🎟️  Generating JWT token...');
    const token = generateAppleJWT(
      privateKey,
      integration.credentials.keyId,
      integration.credentials.issuerId
    );

    console.log('✅ JWT token generated successfully');

    // Fetch sales reports for the specified date range
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // Yesterday (most recent complete day)
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToSync);

    console.log('📥 Fetching sales reports from:', {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      days: daysToSync
    });

    // Build array of all dates to fetch
    const datesToFetch: string[] = [];
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      datesToFetch.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`🚀 Fetching ${datesToFetch.length} days in parallel...`);

    // Fetch ALL days in parallel (10x faster!)
    const fetchPromises = datesToFetch.map(async (reportDate, index) => {
      try {
        const dailyData = await fetchAppleSalesReports(
      token,
      integration.credentials.vendorNumber,
      reportDate
    );

        if (dailyData && dailyData.length > 0) {
          console.log(`  ✓ ${reportDate}: ${dailyData.length} records (${index + 1}/${datesToFetch.length})`);
          return { success: true, data: dailyData, date: reportDate };
        }
        return { success: true, data: [], date: reportDate };
      } catch (error) {
        // Silent fail for days without data
        return { success: false, data: [], date: reportDate };
      }
    });

    // Wait for all parallel fetches to complete
    const results = await Promise.all(fetchPromises);
    
    // Aggregate all the data
    let allSalesData: any[] = [];
    let daysWithData = 0;
    results.forEach(result => {
      if (result.success && result.data.length > 0) {
        allSalesData = allSalesData.concat(result.data);
        daysWithData++;
      }
    });
    
    const daysProcessed = datesToFetch.length;

    // Calculate aggregated metrics and daily breakdown from all records
    let totalRevenue = 0;
    let totalDownloads = 0;
    const dailyBreakdown: Record<string, { revenue: number; downloads: number; date: Date }> = {};
    
    // Get Apple ID for filtering (if specified in integration settings)
    const targetAppleId = integration.credentials?.appId; // This is the Apple ID from settings
    console.log(`🎯 Target Apple ID: ${targetAppleId || 'ALL APPS (no filter)'}`);
    
    // Debug: Log first record structure to see what fields are available
    if (allSalesData.length > 0) {
      console.log('📋 Sample record structure:', Object.keys(allSalesData[0]));
      console.log('📋 Sample record data:', allSalesData[0]);
    }
    
    // Track filtering stats
    let totalRecords = 0;
    let filteredRecords = 0;
    let skippedRecords = 0;
    const uniqueAppleIds = new Set<string>();
    
    allSalesData.forEach(record => {
      totalRecords++;
      
      // Get Apple Identifier from the record (ONLY identifier we use for filtering)
      const recordAppleId = record['Apple Identifier'] || record['apple_identifier'];
      
      // Track all unique Apple IDs
      if (recordAppleId) uniqueAppleIds.add(recordAppleId);
      
      // If we have a target filter, check if this record matches (EXACT MATCH ONLY)
      if (targetAppleId) {
        const matchesAppleId = recordAppleId && recordAppleId === targetAppleId;
        
        if (!matchesAppleId) {
          skippedRecords++;
          return; // Skip this record - it's from a different app
        }
        
        filteredRecords++;
      } else {
        filteredRecords++;
      }
      
      // Units = downloads/purchases
      const units = parseInt(record['Units'] || record['units'] || '0');
      // Developer Proceeds = revenue after Apple's cut
      const proceeds = parseFloat(record['Developer Proceeds'] || record['developer_proceeds'] || '0');
      // Begin Date is the sale date
      const saleDate = record['Begin Date'] || record['begin_date'] || '';
      
      totalDownloads += units;
      totalRevenue += proceeds;
      
      // Group by date for daily breakdown
      if (saleDate) {
        if (!dailyBreakdown[saleDate]) {
          dailyBreakdown[saleDate] = { 
            revenue: 0, 
            downloads: 0,
            date: new Date(saleDate)
          };
        }
        dailyBreakdown[saleDate].revenue += proceeds;
        dailyBreakdown[saleDate].downloads += units;
      }
    });
    
    // Convert daily breakdown to array and sort by date
    const dailyMetrics = Object.entries(dailyBreakdown)
      .map(([date, data]) => ({
        date: data.date,
        revenue: data.revenue,
        downloads: data.downloads
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    console.log('');
    console.log('=' .repeat(60));
    console.log('📊 SYNC COMPLETE');
    console.log('=' .repeat(60));
    console.log(`✅ Total Records: ${allSalesData.length}`);
    console.log(`🎯 Filtered Records: ${filteredRecords} (kept) - EXACT Apple ID match only`);
    console.log(`🚫 Skipped Records: ${skippedRecords} (filtered out)`);
    console.log(`🆔 Unique Apple IDs in data: ${Array.from(uniqueAppleIds).join(', ')}`);
    console.log(`🎯 Target Apple ID: ${targetAppleId || 'NONE (importing all apps)'}`);
    console.log(`💰 Total Revenue: $${totalRevenue.toFixed(2)} (from ${filteredRecords} records)`);
    console.log(`📥 Total Downloads: ${totalDownloads.toLocaleString()} (from ${filteredRecords} records)`);
    console.log(`📅 Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    console.log(`📈 Days Processed: ${daysProcessed}`);
    console.log(`💰 Days with Sales: ${daysWithData}`);
    console.log(`📊 Daily Metrics: ${dailyMetrics.length} days with data`);
    console.log('=' .repeat(60));
    console.log('');

    const salesData = allSalesData;

    // Get existing data to merge with new data (for incremental syncs)
    const metricsRef = db
      .collection('organizations')
      .doc(organizationId as string)
      .collection('projects')
      .doc(projectId as string)
      .collection('revenueMetrics')
      .doc('apple_summary');
    
    const existingDoc = await metricsRef.get();
    const existingData = existingDoc.exists ? existingDoc.data() : null;
    
    // Merge daily metrics (keep existing + add new/update overlapping dates)
    const existingDailyMetrics = existingData?.dailyMetrics || [];
    const dailyMetricsMap = new Map<string, { revenue: number; downloads: number; date: Date }>();
    
    // Add existing data
    existingDailyMetrics.forEach((d: any) => {
      const date = d.date?.toDate();
      if (date) {
        const dateKey = date.toISOString().split('T')[0];
        dailyMetricsMap.set(dateKey, {
          date,
          revenue: d.revenue || 0,
          downloads: d.downloads || 0
        });
      }
    });
    
    // Update/add new data (overwrites if date exists)
    dailyMetrics.forEach(d => {
      const dateKey = d.date.toISOString().split('T')[0];
      dailyMetricsMap.set(dateKey, d);
    });
    
    // Convert back to sorted array
    const mergedDailyMetrics = Array.from(dailyMetricsMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Calculate cumulative totals from all daily data
    const cumulativeTotalRevenue = mergedDailyMetrics.reduce((sum, d) => sum + d.revenue, 0);
    const cumulativeTotalDownloads = mergedDailyMetrics.reduce((sum, d) => sum + d.downloads, 0);
    const cumulativeRecordCount = allSalesData.length + (existingData?.recordCount || 0);
    
    // Store merged data
    await metricsRef.set({
      provider: 'apple',
      totalRevenue: cumulativeTotalRevenue,
      totalDownloads: cumulativeTotalDownloads,
      recordCount: cumulativeRecordCount,
      dateRange: {
        start: mergedDailyMetrics[0]?.date || startDate,
        end: mergedDailyMetrics[mergedDailyMetrics.length - 1]?.date || endDate
      },
      dailyMetrics: mergedDailyMetrics.map(d => ({
        date: Timestamp.fromDate(d.date),
        revenue: d.revenue,
        downloads: d.downloads
      })),
      lastSynced: Timestamp.now(),
      updatedAt: Timestamp.now()
    }, { merge: true });
    
    console.log(`💾 Stored ${mergedDailyMetrics.length} daily data points (${dailyMetrics.length} new/updated)`);
    console.log(`📊 Cumulative totals: $${cumulativeTotalRevenue.toFixed(2)}, ${cumulativeTotalDownloads} downloads`);

    // Update integration last synced timestamp
    await integrationDoc.ref.update({
      lastSynced: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    return res.status(200).json({
      success: true,
      message: 'Apple revenue sync completed successfully',
      data: {
        integrationId: integrationDoc.id,
        dateRange: `${mergedDailyMetrics[0]?.date.toISOString().split('T')[0] || startDate.toISOString().split('T')[0]} to ${mergedDailyMetrics[mergedDailyMetrics.length - 1]?.date.toISOString().split('T')[0] || endDate.toISOString().split('T')[0]}`,
        recordCount: cumulativeRecordCount,
        totalRevenue: cumulativeTotalRevenue,
        totalDownloads: cumulativeTotalDownloads,
        newRecords: allSalesData.length,
        dailyDataPoints: mergedDailyMetrics.length,
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

