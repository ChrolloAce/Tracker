/**
 * Revenue Data Service - Manages revenue data in Firestore
 * 
 * Data structure:
 * organizations/{orgId}/projects/{projectId}/revenue/{collection}
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  RevenueIntegration,
  RevenueTransaction,
  RevenueMetrics,
  RevenueSnapshot,
  RevenueAttribution,
  RevenueProvider,
} from '../types/revenue';
import RevenueCatService from './RevenueCatService';
import SuperwallService from './SuperwallService';
import AppleAppStoreService from './AppleAppStoreService';

/**
 * Revenue Data Service for managing revenue integrations and data
 */
class RevenueDataService {
  
  // ==================== INTEGRATIONS ====================
  
  /**
   * Save revenue integration credentials
   */
  static async saveIntegration(
    orgId: string,
    projectId: string,
    provider: RevenueProvider,
    credentials: RevenueIntegration['credentials'],
    settings?: RevenueIntegration['settings']
  ): Promise<string> {
    const integrationRef = doc(
      collection(db, 'organizations', orgId, 'projects', projectId, 'revenueIntegrations')
    );

    // Clean credentials - remove undefined values to avoid Firestore errors
    const cleanedCredentials: RevenueIntegration['credentials'] = {};
    if (credentials.apiKey !== undefined) {
      cleanedCredentials.apiKey = credentials.apiKey;
    }
    if (credentials.appId !== undefined) {
      cleanedCredentials.appId = credentials.appId;
    }
    if (credentials.secretKey !== undefined) {
      cleanedCredentials.secretKey = credentials.secretKey;
    }
    // Apple App Store Connect fields
    if (credentials.issuerId !== undefined) {
      cleanedCredentials.issuerId = credentials.issuerId;
    }
    if (credentials.keyId !== undefined) {
      cleanedCredentials.keyId = credentials.keyId;
    }
    if (credentials.vendorNumber !== undefined) {
      cleanedCredentials.vendorNumber = credentials.vendorNumber;
    }

    const integration: RevenueIntegration = {
      id: integrationRef.id,
      organizationId: orgId,
      projectId,
      provider,
      enabled: true,
      credentials: cleanedCredentials,
      settings: settings || {
        autoSync: true,
        syncInterval: 60, // 1 hour
        currency: 'USD',
        timezone: 'UTC',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(integrationRef, {
      ...integration,
      createdAt: Timestamp.fromDate(integration.createdAt),
      updatedAt: Timestamp.fromDate(integration.updatedAt),
    });

    return integrationRef.id;
  }

  /**
   * Get revenue integration
   */
  static async getIntegration(
    orgId: string,
    projectId: string,
    provider: RevenueProvider
  ): Promise<RevenueIntegration | null> {
    const q = query(
      collection(db, 'organizations', orgId, 'projects', projectId, 'revenueIntegrations'),
      where('provider', '==', provider)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }

    const data = snapshot.docs[0].data();
    
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      lastSynced: data.lastSynced?.toDate(),
    } as RevenueIntegration;
  }

  /**
   * Get all revenue integrations for a project
   */
  static async getAllIntegrations(
    orgId: string,
    projectId: string
  ): Promise<RevenueIntegration[]> {
    const snapshot = await getDocs(
      collection(db, 'organizations', orgId, 'projects', projectId, 'revenueIntegrations')
    );

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        lastSynced: data.lastSynced?.toDate(),
      } as RevenueIntegration;
    });
  }

  /**
   * Update integration settings
   */
  static async updateIntegration(
    orgId: string,
    projectId: string,
    integrationId: string,
    updates: Partial<RevenueIntegration>
  ): Promise<void> {
    const integrationRef = doc(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'revenueIntegrations',
      integrationId
    );

    await setDoc(
      integrationRef,
      {
        ...updates,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  }

  /**
   * Delete integration
   */
  static async deleteIntegration(
    orgId: string,
    projectId: string,
    integrationId: string
  ): Promise<void> {
    const integrationRef = doc(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'revenueIntegrations',
      integrationId
    );

    await deleteDoc(integrationRef);
  }

  /**
   * Test integration connection
   */
  static async testIntegration(
    provider: RevenueProvider,
    credentials: RevenueIntegration['credentials']
  ): Promise<boolean> {
    try {
      if (provider === 'revenuecat' && credentials.apiKey) {
        // For RevenueCat, appId field contains the project ID
        return await RevenueCatService.testConnection(credentials.apiKey, credentials.appId);
      }
      
      if (provider === 'superwall' && credentials.apiKey && credentials.appId) {
        return await SuperwallService.testConnection(credentials.apiKey, credentials.appId);
      }

      if (provider === 'apple' && credentials.apiKey && credentials.keyId && credentials.issuerId && credentials.appId) {
        return await AppleAppStoreService.testConnection(
          {
            privateKey: credentials.apiKey,
            keyId: credentials.keyId,
            issuerId: credentials.issuerId,
            bundleId: credentials.appId
          },
          true // Use sandbox for testing
        );
      }

      return false;
    } catch (error) {
      console.error('Integration test failed:', error);
      return false;
    }
  }

  // ==================== TRANSACTIONS ====================

  /**
   * Save revenue transactions in batch
   */
  static async saveTransactions(
    orgId: string,
    projectId: string,
    transactions: RevenueTransaction[]
  ): Promise<void> {
    const batch = writeBatch(db);

    transactions.forEach(transaction => {
      const transactionRef = doc(
        collection(db, 'organizations', orgId, 'projects', projectId, 'revenueTransactions'),
        transaction.id
      );

      batch.set(transactionRef, {
        ...transaction,
        purchaseDate: Timestamp.fromDate(transaction.purchaseDate),
        expirationDate: transaction.expirationDate ? Timestamp.fromDate(transaction.expirationDate) : null,
        refundDate: transaction.refundDate ? Timestamp.fromDate(transaction.refundDate) : null,
        createdAt: Timestamp.fromDate(transaction.createdAt),
        updatedAt: Timestamp.fromDate(transaction.updatedAt),
      });
    });

    await batch.commit();
  }

  /**
   * Fetch transactions for a date range
   */
  static async getTransactions(
    orgId: string,
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueTransaction[]> {
    const q = query(
      collection(db, 'organizations', orgId, 'projects', projectId, 'revenueTransactions'),
      where('purchaseDate', '>=', Timestamp.fromDate(startDate)),
      where('purchaseDate', '<=', Timestamp.fromDate(endDate)),
      orderBy('purchaseDate', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        purchaseDate: data.purchaseDate?.toDate() || new Date(),
        expirationDate: data.expirationDate?.toDate(),
        refundDate: data.refundDate?.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as RevenueTransaction;
    });
  }

  // ==================== METRICS ====================

  /**
   * Save calculated revenue metrics
   */
  static async saveMetrics(
    orgId: string,
    projectId: string,
    metrics: RevenueMetrics
  ): Promise<void> {
    const metricsRef = doc(
      collection(db, 'organizations', orgId, 'projects', projectId, 'revenueMetrics')
    );

    await setDoc(metricsRef, {
      ...metrics,
      startDate: Timestamp.fromDate(metrics.startDate),
      endDate: Timestamp.fromDate(metrics.endDate),
      calculatedAt: Timestamp.fromDate(metrics.calculatedAt),
    });
  }

  /**
   * Get latest revenue metrics
   */
  static async getLatestMetrics(
    orgId: string,
    projectId: string
  ): Promise<RevenueMetrics | null> {
    // First try to get Apple metrics (most recent/accurate for Apple integrations)
    const appleMetrics = await this.getAppleMetrics(orgId, projectId);
    if (appleMetrics) {
      return appleMetrics;
    }

    // Fall back to RevenueCat/other metrics
    const q = query(
      collection(db, 'organizations', orgId, 'projects', projectId, 'revenueMetrics'),
      orderBy('calculatedAt', 'desc')
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const data = snapshot.docs[0].data();

    return {
      ...data,
      startDate: data.startDate?.toDate() || new Date(),
      endDate: data.endDate?.toDate() || new Date(),
      calculatedAt: data.calculatedAt?.toDate() || new Date(),
    } as RevenueMetrics;
  }

  /**
   * Get Apple-specific metrics from apple_summary document
   */
  static async getAppleMetrics(
    orgId: string,
    projectId: string
  ): Promise<RevenueMetrics | null> {
    try {
      const docRef = doc(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'revenueMetrics',
        'apple_summary'
      );

      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();

      // Convert Apple data format to RevenueMetrics format
      // Apple stores revenue in DOLLARS, but RevenueMetrics expects CENTS
      const totalRevenue = (data.totalRevenue || 0) * 100; // Convert dollars to cents
      const totalDownloads = data.totalDownloads || 0;
      
      // Extract daily metrics for charting (if available)
      const dailyMetrics = data.dailyMetrics || [];

      return {
        organizationId: orgId,
        projectId: projectId,
        totalRevenue, // In cents
        netRevenue: totalRevenue, // Apple revenue is already net (after their cut)
        refunds: 0,
        activeSubscriptions: totalDownloads, // Use downloads as "active subscriptions" for KPI display
        newSubscriptions: totalDownloads,
        churnedSubscriptions: 0,
        trialConversions: 0,
        averageRevenuePerUser: totalDownloads > 0 ? totalRevenue / totalDownloads : 0,
        averageRevenuePerPurchase: totalDownloads > 0 ? totalRevenue / totalDownloads : 0,
        mrr: 0,
        arr: 0,
        revenueByPlatform: {
          ios: totalRevenue,
          android: 0,
          web: 0,
          other: 0,
        },
        revenueByProduct: [],
        startDate: data.dateRange?.start?.toDate() || new Date(),
        endDate: data.dateRange?.end?.toDate() || new Date(),
        calculatedAt: data.lastSynced?.toDate() || new Date(),
        // Add daily metrics for charting
        dailyMetrics: dailyMetrics.map((d: any) => ({
          date: d.date?.toDate() || new Date(),
          revenue: (d.revenue || 0) * 100, // Convert to cents
          downloads: d.downloads || 0
        }))
      } as RevenueMetrics;
    } catch (error) {
      console.error('Failed to fetch Apple metrics:', error);
      return null;
    }
  }

  /**
   * Calculate metrics from transactions in real-time
   * Use this when webhooks have added new transactions
   */
  static async calculateMetricsFromTransactions(
    orgId: string,
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueMetrics> {
    console.log('📊 Calculating metrics from transactions...');
    
    const transactions = await this.getTransactions(orgId, projectId, startDate, endDate);
    
    if (transactions.length === 0) {
      console.log('No transactions found for date range');
      return {
        organizationId: orgId,
        projectId: projectId,
        totalRevenue: 0,
        netRevenue: 0,
        refunds: 0,
        activeSubscriptions: 0,
        newSubscriptions: 0,
        churnedSubscriptions: 0,
        trialConversions: 0,
        averageRevenuePerUser: 0,
        averageRevenuePerPurchase: 0,
        mrr: 0,
        arr: 0,
        revenueByPlatform: {
          ios: 0,
          android: 0,
          web: 0,
          other: 0,
        },
        revenueByProduct: [],
        startDate,
        endDate,
        calculatedAt: new Date(),
      };
    }

    // Calculate totals
    const totalRevenue = transactions
      .filter(t => t.type !== 'refund')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const refunds = transactions
      .filter(t => t.type === 'refund')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const netRevenue = totalRevenue - refunds;
    
    // Unique subscribers
    const uniqueCustomers = new Set(
      transactions
        .filter(t => t.customerId)
        .map(t => t.customerId!)
    );
    const totalSubscribers = uniqueCustomers.size;
    
    // Active, new, churned subscriptions
    const activeSubscriptions = transactions.filter(t => t.status === 'active' && t.type !== 'refund').length;
    const newSubscriptions = transactions.filter(t => !t.isRenewal && t.type !== 'refund').length;
    const churnedSubscriptions = transactions.filter(t => t.status === 'cancelled' || t.status === 'expired').length;
    const trialConversions = transactions.filter(t => t.isTrial).length;
    
    // Platform breakdown
    const revenueByPlatform = {
      ios: transactions.filter(t => t.platform === 'ios' && t.type !== 'refund').reduce((sum, t) => sum + t.amount, 0),
      android: transactions.filter(t => t.platform === 'android' && t.type !== 'refund').reduce((sum, t) => sum + t.amount, 0),
      web: transactions.filter(t => t.platform === 'web' && t.type !== 'refund').reduce((sum, t) => sum + t.amount, 0),
      other: transactions.filter(t => t.platform === 'other' && t.type !== 'refund').reduce((sum, t) => sum + t.amount, 0),
    };

    // Revenue by product (as array)
    const productMap = new Map<string, { revenue: number; count: number; name?: string }>();
    transactions.forEach(t => {
      if (t.type !== 'refund') {
        const existing = productMap.get(t.productId) || { revenue: 0, count: 0, name: t.productName };
        productMap.set(t.productId, {
          revenue: existing.revenue + t.amount,
          count: existing.count + 1,
          name: existing.name || t.productName
        });
      }
    });

    const revenueByProduct = Array.from(productMap.entries()).map(([productId, data]) => ({
      productId,
      productName: data.name || productId,
      revenue: data.revenue,
      count: data.count
    }));

    // Calculate averages
    const averageRevenuePerUser = totalSubscribers > 0 ? totalRevenue / totalSubscribers : 0;
    const averageRevenuePerPurchase = transactions.length > 0 ? totalRevenue / transactions.length : 0;

    // Calculate MRR/ARR
    const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const monthsInPeriod = Math.max(1, daysInPeriod / 30);
    const mrr = totalRevenue / monthsInPeriod;
    const arr = mrr * 12;

    const metrics: RevenueMetrics = {
      organizationId: orgId,
      projectId: projectId,
      totalRevenue,
      netRevenue,
      refunds,
      activeSubscriptions,
      newSubscriptions,
      churnedSubscriptions,
      trialConversions,
      averageRevenuePerUser,
      averageRevenuePerPurchase,
      mrr,
      arr,
      revenueByPlatform,
      revenueByProduct,
      startDate,
      endDate,
      calculatedAt: new Date(),
    };

    // Save the calculated metrics
    await this.saveMetrics(orgId, projectId, metrics);

    console.log('✅ Metrics calculated:', {
      totalRevenue: (metrics.totalRevenue / 100).toFixed(2),
      transactions: transactions.length,
      subscribers: totalSubscribers
    });

    return metrics;
  }

  // ==================== SNAPSHOTS ====================

  /**
   * Save revenue snapshot
   */
  static async saveSnapshot(
    orgId: string,
    projectId: string,
    snapshot: RevenueSnapshot
  ): Promise<void> {
    const snapshotRef = doc(
      collection(db, 'organizations', orgId, 'projects', projectId, 'revenueSnapshots'),
      snapshot.id
    );

    await setDoc(snapshotRef, {
      ...snapshot,
      snapshotDate: Timestamp.fromDate(snapshot.snapshotDate),
      createdAt: Timestamp.fromDate(snapshot.createdAt),
    });
  }

  /**
   * Get revenue snapshots for time period
   */
  static async getSnapshots(
    orgId: string,
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueSnapshot[]> {
    const q = query(
      collection(db, 'organizations', orgId, 'projects', projectId, 'revenueSnapshots'),
      where('snapshotDate', '>=', Timestamp.fromDate(startDate)),
      where('snapshotDate', '<=', Timestamp.fromDate(endDate)),
      orderBy('snapshotDate', 'asc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        snapshotDate: data.snapshotDate?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
      } as RevenueSnapshot;
    });
  }

  // ==================== ATTRIBUTION ====================

  /**
   * Save revenue attribution
   */
  static async saveAttribution(
    orgId: string,
    projectId: string,
    attribution: RevenueAttribution
  ): Promise<void> {
    const attributionRef = doc(
      collection(db, 'organizations', orgId, 'projects', projectId, 'revenueAttributions'),
      attribution.id
    );

    await setDoc(attributionRef, {
      ...attribution,
      startDate: Timestamp.fromDate(attribution.startDate),
      endDate: Timestamp.fromDate(attribution.endDate),
      createdAt: Timestamp.fromDate(attribution.createdAt),
      updatedAt: Timestamp.fromDate(attribution.updatedAt),
    });
  }

  /**
   * Get attribution for a video
   */
  static async getVideoAttribution(
    orgId: string,
    projectId: string,
    videoId: string
  ): Promise<RevenueAttribution | null> {
    const q = query(
      collection(db, 'organizations', orgId, 'projects', projectId, 'revenueAttributions'),
      where('videoId', '==', videoId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const data = snapshot.docs[0].data();

    return {
      ...data,
      startDate: data.startDate?.toDate() || new Date(),
      endDate: data.endDate?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as RevenueAttribution;
  }

  /**
   * Get attribution for a creator
   */
  static async getCreatorAttribution(
    orgId: string,
    projectId: string,
    creatorHandle: string
  ): Promise<RevenueAttribution | null> {
    const q = query(
      collection(db, 'organizations', orgId, 'projects', projectId, 'revenueAttributions'),
      where('creatorHandle', '==', creatorHandle)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const data = snapshot.docs[0].data();

    return {
      ...data,
      startDate: data.startDate?.toDate() || new Date(),
      endDate: data.endDate?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as RevenueAttribution;
  }

  // ==================== SYNC ====================

  /**
   * Sync revenue data from RevenueCat
   */
  static async syncRevenueCat(
    orgId: string,
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ transactionCount: number; revenue: number }> {
    // Get RevenueCat integration
    const integration = await this.getIntegration(orgId, projectId, 'revenuecat');
    
    if (!integration || !integration.credentials.apiKey) {
      throw new Error('RevenueCat integration not found or missing API key');
    }

    if (!integration.credentials.appId) {
      throw new Error('RevenueCat Project ID is required. Please update your integration settings.');
    }

    // Fetch transactions from RevenueCat (returns aggregate metrics from v2 API)
    let rcTransactions;
    try {
      rcTransactions = await RevenueCatService.fetchTransactions(
        { 
          apiKey: integration.credentials.apiKey,
          projectId: integration.credentials.appId // RevenueCat Project ID stored in appId field
        },
        startDate,
        endDate
      );
    } catch (error: any) {
      // Don't let RevenueCat errors break the entire dashboard
      console.error('⚠️ RevenueCat sync failed (non-critical):', error.message);
      
      // Update last synced time anyway to prevent constant retries
      await this.updateIntegration(orgId, projectId, integration.id, {
        lastSynced: new Date(),
      });
      
      return {
        transactionCount: 0,
        revenue: 0
      };
    }

    // Note: v2 API returns aggregate metrics, not individual transactions
    // This is expected and still provides useful revenue data
    if (rcTransactions.length === 0) {
      // Update last synced time even if no data
      await this.updateIntegration(orgId, projectId, integration.id, {
        lastSynced: new Date(),
      });

      // Return zero results (no error - this is expected for v2 API)
      return {
        transactionCount: 0,
        revenue: 0,
      };
    }

    // Transform to our format
    const transactions = RevenueCatService.transformTransactions(
      rcTransactions,
      orgId,
      projectId
    );

    // Save to Firestore
    if (transactions.length > 0) {
      await this.saveTransactions(orgId, projectId, transactions);
    }

    // Calculate metrics
    const metrics = RevenueCatService.calculateMetrics(
      transactions,
      orgId,
      projectId,
      startDate,
      endDate
    );

    await this.saveMetrics(orgId, projectId, metrics);

    // Update last synced time
    await this.updateIntegration(orgId, projectId, integration.id, {
      lastSynced: new Date(),
    });

    return {
      transactionCount: transactions.length,
      revenue: metrics.totalRevenue,
    };
  }

  /**
   * Sync revenue data from Superwall
   */
  static async syncSuperwall(
    orgId: string,
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ eventCount: number; revenue: number }> {
    // Get Superwall integration
    const integration = await this.getIntegration(orgId, projectId, 'superwall');
    
    if (!integration || !integration.credentials.apiKey || !integration.credentials.appId) {
      throw new Error('Superwall integration not found or missing credentials');
    }

    // Fetch conversion events from Superwall
    const eventsResponse = await SuperwallService.fetchConversionEvents(
      {
        apiKey: integration.credentials.apiKey,
        appId: integration.credentials.appId,
      },
      startDate,
      endDate
    );

    // Transform to transactions
    const transactions = SuperwallService.transformEventsToTransactions(
      eventsResponse.events,
      orgId,
      projectId
    );

    // Save to Firestore
    if (transactions.length > 0) {
      await this.saveTransactions(orgId, projectId, transactions);
    }

    // Calculate total revenue
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);

    // Update last synced time
    await this.updateIntegration(orgId, projectId, integration.id, {
      lastSynced: new Date(),
    });

    return {
      eventCount: transactions.length,
      revenue: totalRevenue,
    };
  }

  /**
   * Sync Apple App Store data
   */
  static async syncApple(
    orgId: string,
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ transactionCount: number; revenue: number }> {
    const integration = await this.getIntegration(orgId, projectId, 'apple');
    
    if (!integration || !integration.credentials.apiKey || !integration.credentials.keyId || !integration.credentials.issuerId || !integration.credentials.appId) {
      throw new Error('Apple App Store integration not configured');
    }

    console.log('📱 Syncing Apple App Store data...');

    try {
      // Fetch transactions from Apple
      const appleTransactions = await AppleAppStoreService.fetchTransactions(
        {
          privateKey: integration.credentials.apiKey,
          keyId: integration.credentials.keyId,
          issuerId: integration.credentials.issuerId,
          bundleId: integration.credentials.appId
        },
        startDate,
        endDate,
        false // Use production by default; could be made configurable
      );

      console.log(`✅ Fetched ${appleTransactions.length} Apple transactions`);

      // Convert to RevenueTransaction format with app metadata
      const transactions = AppleAppStoreService.convertToRevenueTransactions(
        appleTransactions,
        orgId,
        projectId,
        {
          bundleId: integration.credentials.appId,
          appName: integration.settings?.appName,
          appIcon: integration.settings?.appIcon,
          appleId: integration.settings?.appleId
        }
      );

      // Save to Firestore
      if (transactions.length > 0) {
        await this.saveTransactions(orgId, projectId, transactions);
      }

      // Calculate metrics
      const totalRevenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);

      // Update last synced time
      await this.updateIntegration(orgId, projectId, integration.id, {
        lastSynced: new Date(),
      });

      return {
        transactionCount: transactions.length,
        revenue: totalRevenue,
      };
    } catch (error) {
      console.error('❌ Failed to sync Apple data:', error);
      throw error;
    }
  }

  /**
   * Sync all enabled integrations
   */
  static async syncAllIntegrations(
    orgId: string,
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ success: boolean; results: Array<{ provider: string; count: number; revenue: number }> }> {
    const integrations = await this.getAllIntegrations(orgId, projectId);
    const results = [];

    for (const integration of integrations.filter(i => i.enabled)) {
      try {
        if (integration.provider === 'revenuecat') {
          const result = await this.syncRevenueCat(orgId, projectId, startDate, endDate);
          results.push({
            provider: 'revenuecat',
            count: result.transactionCount,
            revenue: result.revenue,
          });
        } else if (integration.provider === 'superwall') {
          const result = await this.syncSuperwall(orgId, projectId, startDate, endDate);
          results.push({
            provider: 'superwall',
            count: result.eventCount,
            revenue: result.revenue,
          });
        } else if (integration.provider === 'apple') {
          const result = await this.syncApple(orgId, projectId, startDate, endDate);
          results.push({
            provider: 'apple',
            count: result.transactionCount,
            revenue: result.revenue,
          });
        }
      } catch (error) {
        console.error(`Failed to sync ${integration.provider}:`, error);
      }
    }

    return {
      success: results.length > 0,
      results,
    };
  }
}

export default RevenueDataService;

