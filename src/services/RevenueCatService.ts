/**
 * RevenueCat API Integration Service
 * Docs: https://www.revenuecat.com/docs/api-v1
 */

import {
  RevenueTransaction,
  RevenueMetrics,
  RevenueCatSubscriber,
  RevenueCatProduct,
} from '../types/revenue';

interface RevenueCatConfig {
  apiKey: string;
  baseUrl?: string;
}

interface RevenueCatOverviewResponse {
  active_subscribers: number;
  active_trials: number;
  active_subscriptions_by_product: Record<string, number>;
  mrr: {
    value: number;
    currency: string;
  };
  // Add more fields as needed
}

interface RevenueCatTransaction {
  id: string;
  date?: string;
  revenue?: number;
  app_user_id?: string;
  product_id?: string;
  purchased_at_ms?: number;
  price?: number;
  currency: string;
  is_trial_period?: boolean;
  store?: 'app_store' | 'play_store' | 'stripe' | 'promotional';
  // Add more fields as needed
}

/**
 * RevenueCat Service for fetching revenue data
 */
export class RevenueCatService {
  private static readonly DEFAULT_BASE_URL = 'https://api.revenuecat.com/v1';

  /**
   * Fetch overview metrics from RevenueCat (via API proxy)
   */
  static async fetchOverview(
    config: RevenueCatConfig,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueCatOverviewResponse> {
    const response = await fetch('/api/revenue-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'revenuecat',
        action: 'fetchOverview',
        credentials: { apiKey: config.apiKey },
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`RevenueCat API Error: ${error.error || error.message || response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(`RevenueCat API Error: ${result.error || 'Unknown error'}`);
    }

    return result.data;
  }

  /**
   * Fetch transaction history (via API proxy)
   */
  static async fetchTransactions(
    config: RevenueCatConfig & { projectId?: string },
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ): Promise<RevenueCatTransaction[]> {
    const response = await fetch('/api/revenue-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'revenuecat',
        action: 'fetchTransactions',
        credentials: { apiKey: config.apiKey },
        projectId: config.projectId, // Pass the RevenueCat project ID
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`RevenueCat API Error: ${error.error || error.message || response.statusText}`);
    }

    const result = await response.json();
    
    console.log('🔍 RevenueCat Frontend - API Response:', result);
    console.log('📦 Transactions received:', result.data?.transactions?.length || 0);
    console.log('📊 Raw data:', result.data?.raw_data);
    console.log('⚠️ Warnings:', result.data?.warning);
    console.log('📝 Note:', result.data?.note);
    
    if (!result.success) {
      throw new Error(`RevenueCat API Error: ${result.error || 'Unknown error'}`);
    }

    const transactions = result.data.transactions || [];
    console.log('✅ Returning transactions:', transactions);
    return transactions;
  }

  /**
   * Fetch subscriber details
   */
  static async fetchSubscriber(
    config: RevenueCatConfig,
    appUserId: string
  ): Promise<RevenueCatSubscriber | null> {
    const baseUrl = config.baseUrl || this.DEFAULT_BASE_URL;

    const response = await fetch(`${baseUrl}/subscribers/${appUserId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`RevenueCat API Error: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      id: data.subscriber.original_app_user_id,
      customerId: data.subscriber.original_app_user_id,
      email: data.subscriber.email,
      firstSeen: new Date(data.subscriber.first_seen),
      lastSeen: new Date(data.subscriber.last_seen),
      activeSubscriptions: Object.keys(data.subscriber.subscriptions || {}),
      lifetimeRevenue: data.subscriber.lifetime_revenue || 0,
      mrr: data.subscriber.mrr || 0,
    };
  }

  /**
   * Fetch products and their metrics
   */
  static async fetchProducts(
    config: RevenueCatConfig
  ): Promise<RevenueCatProduct[]> {
    const baseUrl = config.baseUrl || this.DEFAULT_BASE_URL;

    const response = await fetch(`${baseUrl}/products`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`RevenueCat API Error: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    
    return (data.products || []).map((product: any) => ({
      id: product.id,
      name: product.name,
      type: product.type,
      price: product.price_cents || 0,
      currency: product.currency || 'USD',
      period: product.subscription_period,
      activeSubscribers: product.active_subscribers || 0,
      mrr: product.mrr || 0,
    }));
  }

  /**
   * Transform RevenueCat transactions to our RevenueTransaction format
   */
  static transformTransactions(
    transactions: RevenueCatTransaction[],
    organizationId: string,
    projectId: string
  ): RevenueTransaction[] {
    return transactions.map((tx) => {
      // Handle Charts API format (has date and revenue fields)
      if (tx.date && tx.revenue !== undefined) {
        return {
          id: `rc_${tx.id}`,
          organizationId,
          projectId,
          provider: 'revenuecat' as const,
          platform: 'other' as const,
          transactionId: tx.id,
          customerId: 'aggregate',
          amount: Math.round(tx.revenue * 100), // Convert to cents
          currency: tx.currency || 'USD',
          productId: 'daily_revenue',
          purchaseDate: new Date(tx.date),
          type: 'purchase' as const,
          status: 'active' as const,
          isRenewal: false,
          isTrial: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      
      // Handle traditional transaction format (backwards compatibility)
      return {
        id: `rc_${tx.id}`,
        organizationId,
        projectId,
        provider: 'revenuecat' as const,
        platform: this.mapStoreToPlatform(tx.store || 'other'),
        transactionId: tx.id,
        customerId: tx.app_user_id || 'unknown',
        amount: Math.round((tx.price || 0) * 100), // Convert to cents
        currency: tx.currency,
        productId: tx.product_id || 'unknown',
        purchaseDate: new Date(tx.purchased_at_ms || Date.now()),
        type: tx.is_trial_period ? 'trial' : 'purchase',
        status: 'active' as const,
        isRenewal: false,
        isTrial: tx.is_trial_period || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
  }

  /**
   * Calculate metrics from transactions
   */
  static calculateMetrics(
    transactions: RevenueTransaction[],
    organizationId: string,
    projectId: string,
    startDate: Date,
    endDate: Date
  ): RevenueMetrics {
    const totalRevenue = transactions.reduce((sum, tx) => 
      tx.type !== 'refund' ? sum + tx.amount : sum, 0
    );

    const refunds = transactions.reduce((sum, tx) => 
      tx.type === 'refund' ? sum + Math.abs(tx.amount) : sum, 0
    );

    const netRevenue = totalRevenue - refunds;

    const activeSubscriptions = new Set(
      transactions
        .filter(tx => tx.status === 'active' && tx.subscriptionPeriod)
        .map(tx => tx.customerId)
    ).size;

    const newSubscriptions = transactions.filter(tx => 
      tx.type === 'purchase' && !tx.isRenewal
    ).length;

    const trialConversions = transactions.filter(tx => 
      tx.type === 'purchase' && tx.isTrial
    ).length;

    // Calculate platform breakdown
    const revenueByPlatform = {
      ios: 0,
      android: 0,
      web: 0,
      other: 0,
    };

    transactions.forEach(tx => {
      if (tx.type !== 'refund') {
        const platform = tx.platform as keyof typeof revenueByPlatform;
        if (platform in revenueByPlatform) {
          revenueByPlatform[platform] += tx.amount;
        }
      }
    });

    // Calculate product breakdown
    const productRevenue = new Map<string, { name: string; revenue: number; count: number }>();
    
    transactions.forEach(tx => {
      if (tx.type !== 'refund') {
        const existing = productRevenue.get(tx.productId) || {
          name: tx.productName || tx.productId,
          revenue: 0,
          count: 0,
        };
        existing.revenue += tx.amount;
        existing.count += 1;
        productRevenue.set(tx.productId, existing);
      }
    });

    const revenueByProduct = Array.from(productRevenue.entries()).map(([productId, data]) => ({
      productId,
      productName: data.name,
      revenue: data.revenue,
      count: data.count,
    }));

    // Calculate MRR (simplified - assumes monthly subscriptions)
    const monthlySubscriptions = transactions.filter(tx => 
      tx.subscriptionPeriod === 'monthly' && tx.status === 'active'
    );
    const mrr = monthlySubscriptions.reduce((sum, tx) => sum + tx.amount, 0);

    const averageRevenuePerUser = activeSubscriptions > 0 
      ? netRevenue / activeSubscriptions 
      : 0;

    const averageRevenuePerPurchase = newSubscriptions > 0 
      ? netRevenue / newSubscriptions 
      : 0;

    return {
      organizationId,
      projectId,
      startDate,
      endDate,
      totalRevenue,
      netRevenue,
      refunds,
      activeSubscriptions,
      newSubscriptions,
      churnedSubscriptions: 0, // Would need historical data
      trialConversions,
      averageRevenuePerUser,
      averageRevenuePerPurchase,
      mrr,
      revenueByPlatform,
      revenueByProduct,
      calculatedAt: new Date(),
    };
  }

  /**
   * Map RevenueCat store to our platform type
   */
  private static mapStoreToPlatform(store: string | undefined): 'ios' | 'android' | 'web' | 'other' {
    if (!store) return 'other';
    
    switch (store) {
      case 'app_store':
        return 'ios';
      case 'play_store':
        return 'android';
      case 'stripe':
        return 'web';
      default:
        return 'other';
    }
  }

  /**
   * Test API connection (via API proxy)
   */
  static async testConnection(apiKey: string, projectId?: string): Promise<boolean> {
    try {
      const response = await fetch('/api/revenue-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'revenuecat',
          action: 'test',
          credentials: { apiKey },
          projectId, // Pass project ID for v2 endpoint
        }),
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.error('RevenueCat connection test failed:', error);
      return false;
    }
  }
}

export default RevenueCatService;

