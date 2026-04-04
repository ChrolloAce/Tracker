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
    // Decode from base64 to get the raw PEM key
    return Buffer.from(encryptedKey, 'base64').toString('utf-8');
  } catch (error) {
    console.error('Failed to decode private key:', error);
    throw new Error('Failed to decode private key');
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
 * Fetch reports from Apple App Store Connect API with retry logic
 * reportType: 'SALES' for downloads, 'SUBSCRIBER' for per-transaction subscription revenue
 */
async function fetchAppleReports(
  token: string,
  vendorNumber: string,
  reportDate: string,
  reportType: 'SALES' | 'SUBSCRIBER' = 'SALES'
): Promise<any[]> {
  const url = new URL('https://api.appstoreconnect.apple.com/v1/salesReports');
  url.searchParams.append('filter[frequency]', 'DAILY');
  url.searchParams.append('filter[reportType]', reportType);
  url.searchParams.append('filter[vendorNumber]', vendorNumber);
  url.searchParams.append('filter[reportDate]', reportDate);

  // SUBSCRIBER reports require DETAILED subtype and version 1_3
  // SALES reports use SUMMARY subtype and version 1_0
  if (reportType === 'SUBSCRIBER') {
    url.searchParams.append('filter[reportSubType]', 'DETAILED');
    url.searchParams.append('filter[version]', '1_3');
  } else {
    url.searchParams.append('filter[reportSubType]', 'SUMMARY');
    url.searchParams.append('filter[version]', '1_0');
  }

  // Retry logic for 500 errors (Apple's server issues)
  let lastError: Error | null = null;
  const maxRetries = 3;
  const baseDelay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/a-gzip'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Retry only on 500 errors (server-side issues)
        if (response.status === 500 && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.warn(`⚠️ Apple API 500 error (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
          lastError = new Error(`Apple API 500 error: ${errorText}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry
        }

        // Don't retry for other errors (4xx, etc)
        console.error('Apple API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Apple API request failed: ${response.status} ${response.statusText}`);
      }

      // Success - return the response
      return await parseAppleResponse(response);
      
    } catch (error: any) {
      // Network errors - retry
      if (attempt < maxRetries && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`⚠️ Network error (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  // All retries failed
  throw lastError || new Error('Failed to fetch Apple sales reports after retries');
}

/**
 * Parse Apple API response (gzipped TSV or JSON)
 */
async function parseAppleResponse(response: Response): Promise<any[]> {

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
    const { organizationId, projectId, manual, dateRange, wipeData } = req.method === 'POST' 
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
    
    console.log('📦 Syncing for:', { organizationId, projectId, manual: !!manual, days: daysToSync, wipeData: !!wipeData });

    // If wipeData flag is set, delete all existing revenue data before syncing
    if (wipeData) {
      console.log('🗑️  Wiping existing revenue data...');
      const metricsRef = db
        .collection('organizations')
        .doc(organizationId as string)
        .collection('projects')
        .doc(projectId as string)
        .collection('revenueMetrics')
        .doc('apple_summary');
      
      await metricsRef.delete();
      console.log('✅ Revenue data wiped successfully');
    }

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

    console.log(`🚀 Fetching ${datesToFetch.length} days of SALES + SUBSCRIBER reports in parallel...`);

    // Fetch SALES (downloads) and SUBSCRIBER (per-transaction revenue) reports in parallel
    const fetchPromises = datesToFetch.map(async (reportDate, index) => {
      const salesResult = { data: [] as any[], success: false };
      const subResult = { data: [] as any[], success: false };

      const [salesRes, subRes] = await Promise.allSettled([
        fetchAppleReports(token, integration.credentials.vendorNumber, reportDate, 'SALES'),
        fetchAppleReports(token, integration.credentials.vendorNumber, reportDate, 'SUBSCRIBER'),
      ]);

      if (salesRes.status === 'fulfilled' && salesRes.value.length > 0) {
        salesResult.data = salesRes.value;
        salesResult.success = true;
      } else if (salesRes.status === 'rejected') {
        console.warn(`  ⚠️ SALES fetch failed for ${reportDate}: ${salesRes.reason?.message || salesRes.reason}`);
      }

      if (subRes.status === 'fulfilled' && subRes.value.length > 0) {
        subResult.data = subRes.value;
        subResult.success = true;
      } else if (subRes.status === 'rejected') {
        console.warn(`  ⚠️ SUBSCRIBER fetch failed for ${reportDate}: ${subRes.reason?.message || subRes.reason}`);
      }

      if (salesResult.success || subResult.success) {
        console.log(`  ✓ ${reportDate}: ${salesResult.data.length} sales + ${subResult.data.length} subscriber records (${index + 1}/${datesToFetch.length})`);
      }

      return { date: reportDate, sales: salesResult, subscriptions: subResult };
    });

    // Wait for all parallel fetches to complete
    const results = await Promise.all(fetchPromises);

    // Aggregate all the data
    let allSalesData: any[] = [];
    let allSubscriptionData: any[] = [];
    let daysWithData = 0;
    results.forEach(result => {
      const hasData = result.sales.success || result.subscriptions.success;
      if (hasData) daysWithData++;
      if (result.sales.success) allSalesData = allSalesData.concat(result.sales.data);
      if (result.subscriptions.success) allSubscriptionData = allSubscriptionData.concat(result.subscriptions.data);
    });
    
    const daysProcessed = datesToFetch.length;

    // Calculate aggregated metrics and daily breakdown from all records
    let totalRevenue = 0;
    let totalDownloads = 0;
    let totalSubscriptionRevenue = 0;
    let activeSubscriptions = 0;
    let newSubscriptions = 0;
    const dailyBreakdown: Record<string, { revenue: number; downloads: number; subscriptionRevenue: number; date: Date }> = {};

    // Get Apple ID for filtering
    const targetAppleId = integration.credentials?.appId;
    console.log(`🎯 Target Apple ID: ${targetAppleId || 'ALL APPS (no filter)'}`);

    // Debug: Log sample records from both report types
    if (allSalesData.length > 0) {
      console.log('📋 Sample SALES record:', Object.keys(allSalesData[0]));
    }
    if (allSubscriptionData.length > 0) {
      console.log('📋 Sample SUBSCRIBER record columns:', Object.keys(allSubscriptionData[0]));
      console.log('📋 Sample SUBSCRIBER record data:', allSubscriptionData[0]);
    }

    // Helper to ensure a daily entry exists
    const ensureDay = (dateStr: string) => {
      if (dateStr && !dailyBreakdown[dateStr]) {
        dailyBreakdown[dateStr] = { revenue: 0, downloads: 0, subscriptionRevenue: 0, date: new Date(dateStr) };
      }
    };

    // Helper to check Apple ID match
    const matchesApp = (recordAppleId: string | undefined) => {
      if (!targetAppleId) return true;
      return recordAppleId && recordAppleId === targetAppleId;
    };

    // --- Process SALES records (downloads + paid app revenue) ---
    let salesFiltered = 0;
    let salesSkipped = 0;
    allSalesData.forEach(record => {
      const recordAppleId = record['Apple Identifier'] || record['apple_identifier'];
      if (!matchesApp(recordAppleId)) { salesSkipped++; return; }
      salesFiltered++;

      const units = parseInt(record['Units'] || record['units'] || '0');
      const proceeds = parseFloat(record['Developer Proceeds'] || record['developer_proceeds'] || '0');
      const saleDate = record['Begin Date'] || record['begin_date'] || '';

      totalDownloads += units;
      totalRevenue += proceeds;

      if (saleDate) {
        ensureDay(saleDate);
        dailyBreakdown[saleDate].downloads += units;
        dailyBreakdown[saleDate].revenue += proceeds;
      }
    });

    // --- Process SUBSCRIBER records (per-transaction subscription revenue) ---
    // SUBSCRIBER report columns: Event Date, App Name, App Apple ID, Subscription Name,
    // Subscription Apple ID, Developer Proceeds, Proceeds Currency, Customer Price,
    // Customer Currency, Device, Country, Subscriber ID, Units, Event Date, Purchase Date, etc.
    let subsFiltered = 0;
    let subsSkipped = 0;
    allSubscriptionData.forEach(record => {
      const recordAppleId = record['App Apple ID'] || record['Apple Identifier'] || record['apple_identifier'];
      if (!matchesApp(recordAppleId)) { subsSkipped++; return; }
      subsFiltered++;

      const units = parseInt(record['Units'] || record['Quantity'] || '1');
      const proceeds = parseFloat(record['Developer Proceeds'] || record['developer_proceeds'] || '0');
      const eventDate = record['Event Date'] || record['Begin Date'] || record['event_date'] || '';
      const isRefund = record['Refund'] === 'Yes' || record['Refund'] === 'true';

      // Calculate revenue: proceeds * units, negative for refunds
      const revenue = isRefund ? -(proceeds * units) : (proceeds * units);
      totalSubscriptionRevenue += revenue;
      totalRevenue += revenue;

      // Count subscriptions (each record is a transaction)
      if (proceeds > 0 && !isRefund) {
        newSubscriptions += units;
        activeSubscriptions += units;
      }

      if (eventDate) {
        ensureDay(eventDate);
        dailyBreakdown[eventDate].subscriptionRevenue += revenue;
        dailyBreakdown[eventDate].revenue += revenue;
      }
    });

    // Convert daily breakdown to array and sort by date
    const dailyMetrics = Object.entries(dailyBreakdown)
      .map(([date, data]) => ({
        date: data.date,
        revenue: data.revenue,
        downloads: data.downloads,
        subscriptionRevenue: data.subscriptionRevenue,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    console.log('');
    console.log('='.repeat(60));
    console.log('📊 SYNC COMPLETE');
    console.log('='.repeat(60));
    console.log(`📦 Sales Records: ${allSalesData.length} total, ${salesFiltered} matched, ${salesSkipped} skipped`);
    console.log(`📦 Subscriber Records: ${allSubscriptionData.length} total, ${subsFiltered} matched, ${subsSkipped} skipped`);
    console.log(`🎯 Target Apple ID: ${targetAppleId || 'NONE (importing all apps)'}`);
    console.log(`💰 Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`💰 Subscription Revenue: $${totalSubscriptionRevenue.toFixed(2)}`);
    console.log(`📥 Total Downloads: ${totalDownloads.toLocaleString()}`);
    console.log(`📊 New Subscriptions: ${newSubscriptions}`);
    console.log(`📊 Active Subscriptions: ${activeSubscriptions}`);
    console.log(`📅 Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    console.log(`📈 Days Processed: ${daysProcessed}`);
    console.log(`📊 Daily Metrics: ${dailyMetrics.length} days with data`);
    console.log('='.repeat(60));
    console.log('');

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
    const dailyMetricsMap = new Map<string, { revenue: number; downloads: number; subscriptionRevenue: number; date: Date }>();

    // Add existing data
    existingDailyMetrics.forEach((d: any) => {
      const date = d.date?.toDate();
      if (date) {
        const dateKey = date.toISOString().split('T')[0];
        dailyMetricsMap.set(dateKey, {
          date,
          revenue: d.revenue || 0,
          downloads: d.downloads || 0,
          subscriptionRevenue: d.subscriptionRevenue || 0,
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
    const cumulativeTotalSubRevenue = mergedDailyMetrics.reduce((sum, d) => sum + (d.subscriptionRevenue || 0), 0);
    const cumulativeRecordCount = allSalesData.length + allSubscriptionData.length + (existingData?.recordCount || 0);

    // Store merged data
    await metricsRef.set({
      provider: 'apple',
      totalRevenue: cumulativeTotalRevenue,
      totalSubscriptionRevenue: cumulativeTotalSubRevenue,
      totalDownloads: cumulativeTotalDownloads,
      activeSubscriptions,
      newSubscriptions,
      recordCount: cumulativeRecordCount,
      dateRange: {
        start: mergedDailyMetrics[0]?.date || startDate,
        end: mergedDailyMetrics[mergedDailyMetrics.length - 1]?.date || endDate
      },
      dailyMetrics: mergedDailyMetrics.map(d => ({
        date: Timestamp.fromDate(d.date),
        revenue: d.revenue,
        downloads: d.downloads,
        subscriptionRevenue: d.subscriptionRevenue || 0,
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
        totalSubscriptionRevenue: cumulativeTotalSubRevenue,
        totalDownloads: cumulativeTotalDownloads,
        activeSubscriptions,
        newSubscriptions,
        salesRecords: allSalesData.length,
        subscriptionRecords: allSubscriptionData.length,
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

