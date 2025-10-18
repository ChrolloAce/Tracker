/**
 * Superwall API Integration Service
 * Docs: https://docs.superwall.com/docs/api
 */

import {
  SuperwallPaywall,
  SuperwallExperiment,
  RevenueTransaction,
} from '../types/revenue';

interface SuperwallConfig {
  apiKey: string;
  appId: string;
  baseUrl?: string;
}

interface SuperwallAnalyticsResponse {
  paywalls: Array<{
    id: string;
    name: string;
    impressions: number;
    conversions: number;
    revenue: {
      amount: number;
      currency: string;
    };
  }>;
  experiments: Array<{
    id: string;
    name: string;
    status: string;
    variants: Array<{
      id: string;
      name: string;
      impressions: number;
      conversions: number;
      revenue: number;
    }>;
  }>;
}

interface SuperwallEventResponse {
  events: Array<{
    id: string;
    event_name: string;
    user_id: string;
    timestamp: string;
    properties: Record<string, any>;
  }>;
}

/**
 * Superwall Service for paywall analytics and experimentation
 */
export class SuperwallService {
  private static readonly DEFAULT_BASE_URL = 'https://api.superwall.com/v1';

  /**
   * Fetch paywall analytics
   */
  static async fetchPaywallAnalytics(
    config: SuperwallConfig,
    startDate: Date,
    endDate: Date
  ): Promise<SuperwallAnalyticsResponse> {
    const baseUrl = config.baseUrl || this.DEFAULT_BASE_URL;
    
    const params = new URLSearchParams({
      app_id: config.appId,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    });

    const response = await fetch(`${baseUrl}/analytics/paywalls?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Superwall API Error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch specific paywall performance
   */
  static async fetchPaywallPerformance(
    config: SuperwallConfig,
    paywallId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SuperwallPaywall> {
    const baseUrl = config.baseUrl || this.DEFAULT_BASE_URL;
    
    const params = new URLSearchParams({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    });

    const response = await fetch(`${baseUrl}/paywalls/${paywallId}/performance?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Superwall API Error: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      id: data.id,
      name: data.name,
      impressions: data.impressions || 0,
      conversions: data.conversions || 0,
      conversionRate: data.impressions > 0 ? (data.conversions / data.impressions) * 100 : 0,
      revenue: data.revenue?.amount || 0,
    };
  }

  /**
   * Fetch experiment results
   */
  static async fetchExperiments(
    config: SuperwallConfig,
    status?: 'active' | 'paused' | 'completed'
  ): Promise<SuperwallExperiment[]> {
    const baseUrl = config.baseUrl || this.DEFAULT_BASE_URL;
    
    const params = new URLSearchParams({
      app_id: config.appId,
    });

    if (status) {
      params.append('status', status);
    }

    const response = await fetch(`${baseUrl}/experiments?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Superwall API Error: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    
    return (data.experiments || []).map((exp: any) => ({
      id: exp.id,
      name: exp.name,
      status: exp.status || 'active',
      variants: (exp.variants || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        impressions: v.impressions || 0,
        conversions: v.conversions || 0,
        revenue: v.revenue || 0,
      })),
    }));
  }

  /**
   * Fetch conversion events
   */
  static async fetchConversionEvents(
    config: SuperwallConfig,
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ): Promise<SuperwallEventResponse> {
    const baseUrl = config.baseUrl || this.DEFAULT_BASE_URL;
    
    const params = new URLSearchParams({
      app_id: config.appId,
      event_name: 'subscription_start',
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      limit: limit.toString(),
    });

    const response = await fetch(`${baseUrl}/events?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Superwall API Error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Transform Superwall events to RevenueTransactions
   */
  static transformEventsToTransactions(
    events: SuperwallEventResponse['events'],
    organizationId: string,
    projectId: string
  ): RevenueTransaction[] {
    return events
      .filter(event => event.properties.revenue_amount)
      .map((event) => ({
        id: `sw_${event.id}`,
        organizationId,
        projectId,
        provider: 'superwall' as const,
        platform: this.detectPlatform(event.properties),
        transactionId: event.id,
        customerId: event.user_id,
        amount: Math.round((event.properties.revenue_amount || 0) * 100),
        currency: event.properties.currency || 'USD',
        productId: event.properties.product_id || 'unknown',
        productName: event.properties.product_name,
        purchaseDate: new Date(event.timestamp),
        type: event.properties.is_trial ? 'trial' : 'purchase',
        status: 'active' as const,
        isRenewal: event.properties.is_renewal || false,
        isTrial: event.properties.is_trial || false,
        metadata: {
          paywallId: event.properties.paywall_id,
          experimentId: event.properties.experiment_id,
          variantId: event.properties.variant_id,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
  }

  /**
   * Calculate paywall conversion funnel
   */
  static calculateConversionFunnel(paywalls: SuperwallPaywall[]) {
    const totalImpressions = paywalls.reduce((sum, p) => sum + p.impressions, 0);
    const totalConversions = paywalls.reduce((sum, p) => sum + p.conversions, 0);
    const totalRevenue = paywalls.reduce((sum, p) => sum + p.revenue, 0);

    const overallConversionRate = totalImpressions > 0 
      ? (totalConversions / totalImpressions) * 100 
      : 0;

    const revenuePerImpression = totalImpressions > 0 
      ? totalRevenue / totalImpressions 
      : 0;

    const revenuePerConversion = totalConversions > 0 
      ? totalRevenue / totalConversions 
      : 0;

    return {
      totalImpressions,
      totalConversions,
      totalRevenue,
      overallConversionRate,
      revenuePerImpression,
      revenuePerConversion,
      topPaywalls: paywalls
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
    };
  }

  /**
   * Analyze experiment performance
   */
  static analyzeExperiment(experiment: SuperwallExperiment) {
    const totalImpressions = experiment.variants.reduce((sum, v) => sum + v.impressions, 0);
    const totalConversions = experiment.variants.reduce((sum, v) => sum + v.conversions, 0);
    const totalRevenue = experiment.variants.reduce((sum, v) => sum + v.revenue, 0);

    const variantsWithMetrics = experiment.variants.map(variant => {
      const conversionRate = variant.impressions > 0 
        ? (variant.conversions / variant.impressions) * 100 
        : 0;

      const revenuePerImpression = variant.impressions > 0 
        ? variant.revenue / variant.impressions 
        : 0;

      return {
        ...variant,
        conversionRate,
        revenuePerImpression,
      };
    });

    // Find winner (highest revenue per impression)
    const winner = variantsWithMetrics.reduce((best, current) => 
      current.revenuePerImpression > best.revenuePerImpression ? current : best
    );

    return {
      experiment: {
        ...experiment,
        totalImpressions,
        totalConversions,
        totalRevenue,
      },
      variants: variantsWithMetrics,
      winner,
    };
  }

  /**
   * Detect platform from event properties
   */
  private static detectPlatform(properties: Record<string, any>): 'ios' | 'android' | 'web' | 'other' {
    const platform = properties.platform || properties.os || '';
    
    if (platform.toLowerCase().includes('ios')) return 'ios';
    if (platform.toLowerCase().includes('android')) return 'android';
    if (platform.toLowerCase().includes('web')) return 'web';
    
    return 'other';
  }

  /**
   * Test API connection
   */
  static async testConnection(apiKey: string, appId: string): Promise<boolean> {
    try {
      const params = new URLSearchParams({ app_id: appId });
      
      const response = await fetch(`${this.DEFAULT_BASE_URL}/paywalls?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Superwall connection test failed:', error);
      return false;
    }
  }
}

export default SuperwallService;

