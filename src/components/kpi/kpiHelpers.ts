/**
 * KPI Helper Functions
 * Utility functions for formatting and calculations
 */

export const formatNumber = (num: number | undefined | null, isRevenue: boolean = false): string => {
  // Handle undefined, null, or NaN values
  if (num === undefined || num === null || isNaN(num)) return '0';
  
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  if (isRevenue) return `$${num.toFixed(2)}`;
  return num.toString();
};

export const formatCompactNumber = (num: number | undefined | null): string => {
  // Handle undefined, null, or NaN values
  if (num === undefined || num === null || isNaN(num)) return '0';
  
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export const getAccentColors = (accent: string) => {
  switch (accent) {
    case 'emerald':
      return { stroke: '#10b981', gradient: ['#10b981', '#059669'] };
    case 'pink':
      return { stroke: '#ec4899', gradient: ['#ec4899', '#db2777'] };
    case 'blue':
      return { stroke: '#3b82f6', gradient: ['#3b82f6', '#2563eb'] };
    case 'violet':
      return { stroke: '#8b5cf6', gradient: ['#8b5cf6', '#7c3aed'] };
    case 'teal':
      return { stroke: '#14b8a6', gradient: ['#14b8a6', '#0d9488'] };
    case 'orange':
      return { stroke: '#f97316', gradient: ['#f97316', '#ea580c'] };
    case 'slate':
      return { stroke: '#64748b', gradient: ['#64748b', '#475569'] };
    default:
      return { stroke: '#10b981', gradient: ['#10b981', '#059669'] };
  }
};

export const calculatePercentChange = (current: number, previous: number): { value: number; isPositive: boolean; absoluteValue: number } => {
  if (previous === 0) {
    return {
      value: current > 0 ? 100 : 0,
      isPositive: current >= 0,
      absoluteValue: current
    };
  }
  
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(change),
    isPositive: change >= 0,
    absoluteValue: current - previous
  };
};

export const formatPeriodLabel = (dateFilter: string, customRange?: { startDate: Date; endDate: Date }): string => {
  switch (dateFilter) {
    case 'today':
      return 'vs Yesterday';
    case 'yesterday':
      return 'vs Day Before';
    case 'last7days':
      return 'vs Previous 7 Days';
    case 'last14days':
      return 'vs Previous 14 Days';
    case 'last30days':
      return 'vs Previous 30 Days';
    case 'last90days':
      return 'vs Previous 90 Days';
    case 'mtd':
      return 'vs Last Month';
    case 'ytd':
      return 'vs Last Year';
    case 'custom':
      if (customRange) {
        const daysDiff = Math.ceil((customRange.endDate.getTime() - customRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
        return `vs Previous ${daysDiff} Days`;
      }
      return 'vs Previous Period';
    default:
      return '';
  }
};

