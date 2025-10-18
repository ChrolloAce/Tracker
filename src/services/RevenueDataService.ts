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

    const integration: RevenueIntegration = {
      id: integrationRef.id,
      organizationId: orgId,
      projectId,
      provider,
      enabled: true,
      credentials,
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
        return await RevenueCatService.testConnection(credentials.apiKey);
      }
      
      if (provider === 'superwall' && credentials.apiKey && credentials.appId) {
        return await SuperwallService.testConnection(credentials.apiKey, credentials.appId);
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

    // Fetch transactions from RevenueCat
    const rcTransactions = await RevenueCatService.fetchTransactions(
      { apiKey: integration.credentials.apiKey },
      startDate,
      endDate
    );

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

