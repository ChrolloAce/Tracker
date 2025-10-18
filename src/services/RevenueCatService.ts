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
  app_user_id: string;
  product_id: string;
  purchased_at_ms: number;
  price: number;
  currency: string;
  is_trial_period: boolean;
  store: 'app_store' | 'play_store' | 'stripe' | 'promotional';
  // Add more fields as needed
}

/**
 * RevenueCat Service for fetching revenue data
 */
export class RevenueCatService {
  private static readonly DEFAULT_BASE_URL = 'https://api.revenuecat.com/v1';

  /**
   * Fetch overview metrics from RevenueCat
   */
  static async fetchOverview(
    config: RevenueCatConfig,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueCatOverviewResponse> {
    const baseUrl = config.baseUrl || this.DEFAULT_BASE_URL;
    
    const params = new URLSearchParams({
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    });

    const response = await fetch(`${baseUrl}/subscribers/overview?${params}`, {
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

    return response.json();
  }

  /**
   * Fetch transaction history
   */
  static async fetchTransactions(
    config: RevenueCatConfig,
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ): Promise<RevenueCatTransaction[]> {
    const baseUrl = config.baseUrl || this.DEFAULT_BASE_URL;
    
    const params = new URLSearchParams({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      limit: limit.toString(),
    });

    const response = await fetch(`${baseUrl}/transactions?${params}`, {
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
    return data.transactions || [];
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
    return transactions.map((tx) => ({
      id: `rc_${tx.id}`,
      organizationId,
      projectId,
      provider: 'revenuecat' as const,
      platform: this.mapStoreToPlatform(tx.store),
      transactionId: tx.id,
      customerId: tx.app_user_id,
      amount: Math.round(tx.price * 100), // Convert to cents
      currency: tx.currency,
      productId: tx.product_id,
      purchaseDate: new Date(tx.purchased_at_ms),
      type: tx.is_trial_period ? 'trial' : 'purchase',
      status: 'active' as const,
      isRenewal: false,
      isTrial: tx.is_trial_period,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
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
  private static mapStoreToPlatform(store: string): 'ios' | 'android' | 'web' | 'other' {
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
   * Test API connection
   */
  static async testConnection(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.DEFAULT_BASE_URL}/subscribers/overview`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('RevenueCat connection test failed:', error);
      return false;
    }
  }
}

export default RevenueCatService;

