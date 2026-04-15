import AuthenticatedApiService from './AuthenticatedApiService';

export interface SuperwallChartRequest {
  orgId: string;
  applicationId: string;
  yAxis: string;
  xAxis: string;
  dateFilter?: {
    dimension: 'purchaseDate' | 'installDate' | 'firstPurchaseDate' | 'tsDate' | 'mrrDate';
    preset?: string;
    range?: { from: string; to: string };
  };
  dateInterval?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  include?: string[];
}

export interface SuperwallSeriesValue {
  y: number;
  extra?: Record<string, number>;
}

export interface SuperwallDataPoint {
  x: string;
  incomplete: boolean;
  values: Record<string, SuperwallSeriesValue>;
}

export interface SuperwallChartResponse {
  object: 'chart_data';
  request_id: string;
  series: Array<{ breakdown: string; key: string | null }>;
  data: SuperwallDataPoint[];
  y_axis: string;
  x_axis: string;
  filters: any;
  breakdowns: any;
  date_filters: any;
  enriched_data: any;
  duration: number;
}

/** Available Superwall metrics for the revenue chart toggles.
 *  Keys come from GET /v2/charts/definitions — verified against the real API. */
export const SUPERWALL_METRICS = [
  { key: 'grossRevenue', label: 'Revenue', valueType: 'currency' },
  { key: 'netProceeds', label: 'Proceeds', valueType: 'currency' },
  { key: 'mrr', label: 'MRR', valueType: 'currency' },
  { key: 'trialStarts', label: 'New Trials', valueType: 'number' },
  { key: 'trialConversionRate', label: 'Trial Conversion', valueType: 'percentage' },
  { key: 'subStarts', label: 'New Subscriptions', valueType: 'number' },
  { key: 'activeSubscriptionsStart', label: 'Active Subscriptions', valueType: 'number' },
  { key: 'paidConversionRate', label: 'Paid Conversion', valueType: 'percentage' },
  { key: 'transactionCompletes', label: 'Conversions', valueType: 'number' },
  { key: 'arpu', label: 'ARPU', valueType: 'currency' },
] as const;

export type SuperwallMetricKey = typeof SUPERWALL_METRICS[number]['key'];

/** Each metric requires a specific x_axis and date_filter dimension.
 *  Verified against the real API — using the wrong axis returns 0 data. */
const METRIC_AXIS_MAP: Record<string, { xAxis: string; dimension: string }> = {
  grossRevenue:            { xAxis: 'purchaseDate',  dimension: 'purchaseDate' },
  netProceeds:             { xAxis: 'purchaseDate',  dimension: 'purchaseDate' },
  mrr:                     { xAxis: 'mrrDate',       dimension: 'mrrDate' },
  trialStarts:             { xAxis: 'purchaseDate',  dimension: 'purchaseDate' },
  trialConversionRate:     { xAxis: 'installDate',   dimension: 'installDate' },
  subStarts:               { xAxis: 'purchaseDate',  dimension: 'purchaseDate' },
  activeSubscriptionsStart:{ xAxis: 'mrrDate',       dimension: 'mrrDate' },
  paidConversionRate:      { xAxis: 'installDate',   dimension: 'installDate' },
  transactionCompletes:    { xAxis: 'purchaseDate',  dimension: 'purchaseDate' },
  arpu:                    { xAxis: 'installDate',    dimension: 'installDate' },
  newUsers:                { xAxis: 'installDate',    dimension: 'installDate' },
};

class SuperwallService {
  /** Get the correct x_axis and date_filter dimension for a metric */
  getMetricAxis(metricKey: string): { xAxis: string; dimension: string } {
    return METRIC_AXIS_MAP[metricKey] || { xAxis: 'purchaseDate', dimension: 'purchaseDate' };
  }

  /**
   * Fetch chart data from Superwall via our proxy endpoint
   */
  async fetchChartData(params: SuperwallChartRequest): Promise<SuperwallChartResponse> {
    return AuthenticatedApiService.post<SuperwallChartResponse>(
      '/api/revenue-metrics',
      params
    );
  }

  /**
   * Map a date filter preset name to the Superwall API format
   */
  getDatePreset(filterType: string): string {
    switch (filterType) {
      case 'today': return 'today';
      case 'yesterday': return 'yesterday';
      case 'last7days': return 'last_7_days';
      case 'last14days': return 'last_30_days'; // closest match
      case 'last30days': return 'last_30_days';
      case 'last90days': return 'last_90_days';
      case 'ytd': return 'year_to_date';
      case 'all': return 'last_365_days';
      default: return 'last_30_days';
    }
  }

  /**
   * Map our granularity to Superwall date_interval
   */
  getDateInterval(granularity: string): 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' {
    switch (granularity) {
      case 'hour': return 'hour';
      case 'day': return 'day';
      case 'week': return 'week';
      case 'month': return 'month';
      case 'year': return 'year';
      default: return 'day';
    }
  }
}

export default new SuperwallService();
