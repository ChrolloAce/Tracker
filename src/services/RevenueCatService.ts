import AuthenticatedApiService from './AuthenticatedApiService';

/**
 * RevenueCat Charts API v2 service.
 *
 * Chart names and response format verified against the real API with key sk_CDTz...
 * Response shape: { values: [{ cohort, incomplete, measure, value }], summary }
 * Each chart has numbered "measures" (0, 1, 2...) for sub-metrics.
 */

export interface RevenueCatChartResponse {
  values: Array<{
    cohort: number;       // unix timestamp (seconds)
    incomplete: boolean;
    measure: number;      // 0, 1, 2... — sub-metric index
    value: number;
  }>;
  summary?: Record<string, Record<string, number>>;
}

/**
 * Maps our unified metric keys to RevenueCat chart name + measure index.
 * Verified against the real API — these are the exact chart_name values
 * that return data.
 */
const METRIC_TO_RC_CHART: Record<string, { chartName: string; measure: number }> = {
  grossRevenue:            { chartName: 'revenue',               measure: 0 },
  netProceeds:             { chartName: 'revenue',               measure: 0 }, // RC doesn't separate net proceeds
  mrr:                     { chartName: 'mrr',                   measure: 0 },
  trialStarts:             { chartName: 'trial_conversion_rate', measure: 0 }, // measure 0 = Trial Starts
  trialConversionRate:     { chartName: 'trial_conversion_rate', measure: 4 }, // measure 4 = Conversion Rate %
  subStarts:               { chartName: 'actives_new',           measure: 0 },
  activeSubscriptionsStart:{ chartName: 'actives',               measure: 0 },
  paidConversionRate:      { chartName: 'conversion_to_paying',  measure: 0 },
  transactionCompletes:    { chartName: 'conversion_to_paying',  measure: 0 },
  arpu:                    { chartName: 'ltv_per_customer',      measure: 0 },
};

class RevenueCatService {
  /**
   * Fetch chart data from RevenueCat via our proxy endpoint.
   * Returns the raw RC response.
   */
  async fetchRawChart(
    orgId: string,
    chartName: string,
    resolution: string,
    startDate: string,
    endDate: string
  ): Promise<RevenueCatChartResponse> {
    return AuthenticatedApiService.post<RevenueCatChartResponse>(
      '/api/revenuecat-metrics',
      { orgId, chartName, resolution, startDate, endDate }
    );
  }

  /**
   * Fetch chart data for a unified metric key, converting to the same
   * data shape the Revenue page expects (array of { x: dateString, value: number }).
   */
  async fetchMetricData(
    orgId: string,
    metricKey: string,
    resolution: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{ x: string; value: number; incomplete: boolean }>> {
    const mapping = METRIC_TO_RC_CHART[metricKey];
    if (!mapping) throw new Error(`Unknown metric: ${metricKey}`);

    const raw = await this.fetchRawChart(orgId, mapping.chartName, resolution, startDate, endDate);

    // Filter to just the measure we care about
    const points = (raw.values || []).filter(v => v.measure === mapping.measure);

    // Convert cohort timestamp to date string and deduplicate
    return points.map(p => ({
      x: new Date(p.cohort * 1000).toISOString().split('T')[0],
      value: p.value,
      incomplete: p.incomplete,
    }));
  }

  /**
   * Fetch all trial cohort metrics in one call (since they all come from
   * trial_conversion_rate chart, we only need one API call).
   */
  async fetchTrialCohorts(
    orgId: string,
    resolution: string,
    startDate: string,
    endDate: string
  ): Promise<Map<string, { started: number; converted: number; expired: number; pending: number }>> {
    const raw = await this.fetchRawChart(orgId, 'trial_conversion_rate', resolution, startDate, endDate);

    const cohorts = new Map<string, { started: number; converted: number; expired: number; pending: number }>();

    for (const point of raw.values || []) {
      const dateKey = new Date(point.cohort * 1000).toISOString().split('T')[0];
      if (!cohorts.has(dateKey)) {
        cohorts.set(dateKey, { started: 0, converted: 0, expired: 0, pending: 0 });
      }
      const entry = cohorts.get(dateKey)!;
      switch (point.measure) {
        case 0: entry.started = point.value; break;
        case 1: entry.converted = point.value; break;
        case 2: entry.expired = point.value; break;
        case 3: entry.pending = point.value; break;
      }
    }

    return cohorts;
  }

  /**
   * Get the RC resolution string from our granularity.
   */
  getResolution(granularity: string): string {
    // RevenueCat supports: day, week, month
    switch (granularity) {
      case 'day': return 'day';
      case 'week': return 'week';
      case 'month': return 'month';
      case 'year': return 'month'; // RC has no year resolution, use month
      default: return 'day';
    }
  }

  /**
   * Compute start/end date strings (YYYY-MM-DD) for our time range presets.
   * RevenueCat requires start_date/end_date in plain date format.
   */
  getTimeRange(timeRange: string): { startDate: string; endDate: string } {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    let start: Date;

    switch (timeRange) {
      case '7d':   start = new Date(now.getTime() - 7 * 86400000); break;
      case '30d':  start = new Date(now.getTime() - 30 * 86400000); break;
      case '90d':  start = new Date(now.getTime() - 90 * 86400000); break;
      case '180d': start = new Date(now.getTime() - 180 * 86400000); break;
      case '1y':   start = new Date(now.getTime() - 365 * 86400000); break;
      case '2y':
        start = new Date(now);
        start.setFullYear(start.getFullYear() - 2);
        break;
      default:     start = new Date(now.getTime() - 30 * 86400000); break;
    }

    return { startDate: start.toISOString().split('T')[0], endDate: end };
  }
}

export default new RevenueCatService();
