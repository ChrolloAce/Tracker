import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { RevenueMetrics } from '../types/revenue';
import { TimeInterval } from '../services/DataAggregationService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DayTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  revenueMetrics: RevenueMetrics | null;
  metricType: 'revenue' | 'downloads';
  interval?: TimeInterval | null;
  ppInterval?: TimeInterval | null;
  dateRangeLabel?: string;
  dateFilter?: string;
  customRange?: { startDate: Date; endDate: Date };
}

const DayTransactionsModal: React.FC<DayTransactionsModalProps> = ({
  isOpen,
  onClose,
  date,
  revenueMetrics,
  metricType,
  interval,
  ppInterval,
  dateRangeLabel,
  dateFilter,
  customRange
}) => {
  const [showPreviousPeriod, setShowPreviousPeriod] = useState(false);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatIntervalRange = (interval: TimeInterval): string => {
    const startDate = new Date(interval.startDate);
    const endDate = new Date(interval.endDate);
    
    switch (interval.intervalType) {
      case 'year':
        return startDate.getFullYear().toString();
      
      case 'month':
        return startDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short'
        });
      
      case 'week':
        const startFormatted = startDate.toLocaleDateString('en-US', { 
          weekday: 'short',
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
        const endFormatted = endDate.toLocaleDateString('en-US', { 
          weekday: 'short',
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
        return `${startFormatted} - ${endFormatted}`;
      
      case 'day':
      default:
        return formatDate(startDate);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const calculateComparison = (cpValue: number, ppValue: number) => {
    if (ppValue === 0) return { percentChange: 0, isPositive: true };
    const percentChange = ((cpValue - ppValue) / ppValue) * 100;
    return {
      percentChange: Math.abs(percentChange),
      isPositive: percentChange >= 0
    };
  };

  const hasPPData = ppInterval !== null && ppInterval !== undefined;

  // Get daily metrics from revenue metrics, filtered by date range
  const dailyMetrics = useMemo(() => {
    if (!revenueMetrics?.dailyMetrics) return [];
    
    let metrics = [...revenueMetrics.dailyMetrics];
    
    // Apply date filter if provided
    if (dateFilter && dateFilter !== 'all') {
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      let startDate: Date;
      
      if (dateFilter === 'custom' && customRange) {
        startDate = new Date(customRange.startDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(customRange.endDate);
        endDate.setHours(23, 59, 59, 999);
        
        metrics = metrics.filter(day => {
          const dayDate = day.date?.toDate ? day.date.toDate() : new Date(day.date);
          return dayDate >= startDate && dayDate <= endDate;
        });
      } else {
        // Calculate start date for preset filters
        if (dateFilter === 'today') {
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
        } else if (dateFilter === 'last7days') {
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
        } else if (dateFilter === 'last14days') {
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 14);
        } else if (dateFilter === 'last30days') {
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 30);
        } else if (dateFilter === 'last90days') {
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 90);
        } else {
          startDate = new Date(0); // Show all
        }
        
        startDate.setHours(0, 0, 0, 0);
        
        metrics = metrics.filter(day => {
          const dayDate = day.date?.toDate ? day.date.toDate() : new Date(day.date);
          return dayDate >= startDate && dayDate <= now;
        });
      }
    }
    
    return metrics.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [revenueMetrics, dateFilter, customRange]);

  // Filter daily metrics for the current interval
  const currentPeriodMetrics = useMemo(() => {
    if (!interval) return dailyMetrics;
    
    return dailyMetrics.filter(day => {
      const dayDate = new Date(day.date);
      return dayDate >= interval.startDate && dayDate <= interval.endDate;
    });
  }, [dailyMetrics, interval]);

  // Calculate metrics for current period
  const cpMetrics = useMemo(() => {
    const totalRevenue = currentPeriodMetrics.reduce((sum, day) => sum + day.revenue, 0);
    const totalDownloads = currentPeriodMetrics.reduce((sum, day) => sum + day.downloads, 0);
    
    return {
      revenue: totalRevenue,
      downloads: totalDownloads,
      days: currentPeriodMetrics.length,
      avgRevenuePerDay: currentPeriodMetrics.length > 0 ? totalRevenue / currentPeriodMetrics.length : 0,
      avgDownloadsPerDay: currentPeriodMetrics.length > 0 ? totalDownloads / currentPeriodMetrics.length : 0
    };
  }, [currentPeriodMetrics]);

  // Calculate metrics for previous period
  const ppMetrics = useMemo(() => {
    if (!ppInterval) return null;
    
    const ppPeriodMetrics = dailyMetrics.filter(day => {
      const dayDate = new Date(day.date);
      return dayDate >= ppInterval.startDate && dayDate <= ppInterval.endDate;
    });
    
    const totalRevenue = ppPeriodMetrics.reduce((sum, day) => sum + day.revenue, 0);
    const totalDownloads = ppPeriodMetrics.reduce((sum, day) => sum + day.downloads, 0);
    
    return {
      revenue: totalRevenue,
      downloads: totalDownloads,
      days: ppPeriodMetrics.length,
      avgRevenuePerDay: ppPeriodMetrics.length > 0 ? totalRevenue / ppPeriodMetrics.length : 0,
      avgDownloadsPerDay: ppPeriodMetrics.length > 0 ? totalDownloads / ppPeriodMetrics.length : 0
    };
  }, [dailyMetrics, ppInterval]);

  // Chart data (sorted by date for timeline)
  const chartData = useMemo(() => {
    return [...currentPeriodMetrics]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(day => ({
        date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: day.revenue / 100, // Convert cents to dollars
        downloads: day.downloads,
        fullDate: new Date(day.date)
      }));
  }, [currentPeriodMetrics]);

  if (!isOpen) return null;

  const displayMetrics = showPreviousPeriod && ppMetrics ? ppMetrics : cpMetrics;
  const displayInterval = showPreviousPeriod ? ppInterval : interval;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111111] rounded-2xl border border-white/[0.08] shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between flex-shrink-0">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {metricType === 'revenue' ? 'Revenue Details' : 'Downloads Details'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {dateRangeLabel || (displayInterval ? formatIntervalRange(displayInterval) : formatDate(date))}
                </p>
              </div>
            </div>
          </div>

          {/* Period Toggle */}
          {hasPPData && (
            <div className="flex items-center gap-2 mr-4">
              <button
                onClick={() => setShowPreviousPeriod(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  !showPreviousPeriod
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-gray-400'
                }`}
              >
                Current
              </button>
              <button
                onClick={() => setShowPreviousPeriod(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  showPreviousPeriod
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-gray-400'
                }`}
              >
                Previous
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-2 hover:bg-white/5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* KPI Summary Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Total Revenue */}
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Revenue</span>
                </div>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(displayMetrics.revenue)}
                  </p>
                  {hasPPData && ppMetrics && !showPreviousPeriod && (() => {
                    const comparison = calculateComparison(cpMetrics.revenue, ppMetrics.revenue);
                    return (
                      <span className={`text-xs font-semibold mb-1 ${
                        comparison.isPositive ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {comparison.isPositive ? '↑' : '↓'} {comparison.percentChange.toFixed(0)}%
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatCurrency(displayMetrics.avgRevenuePerDay)}/day avg
                </p>
              </div>

              {/* Total Downloads */}
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Downloads</span>
                </div>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-bold text-white">
                    {formatNumber(displayMetrics.downloads)}
                  </p>
                  {hasPPData && ppMetrics && !showPreviousPeriod && (() => {
                    const comparison = calculateComparison(cpMetrics.downloads, ppMetrics.downloads);
                    return (
                      <span className={`text-xs font-semibold mb-1 ${
                        comparison.isPositive ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {comparison.isPositive ? '↑' : '↓'} {comparison.percentChange.toFixed(0)}%
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatNumber(displayMetrics.avgDownloadsPerDay)}/day avg
                </p>
              </div>

              {/* Conversion Rate */}
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Conversion</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {displayMetrics.downloads > 0 
                    ? ((displayMetrics.revenue / 100) / displayMetrics.downloads * 100).toFixed(2)
                    : '0.00'}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Download to revenue
                </p>
              </div>

              {/* Average Revenue Per Download */}
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">ARPU</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {displayMetrics.downloads > 0 
                    ? formatCurrency(displayMetrics.revenue / displayMetrics.downloads)
                    : '$0.00'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Average rev/download
                </p>
              </div>
            </div>

            {/* App Breakdown (if available) */}
            {revenueMetrics?.revenueByApp && revenueMetrics.revenueByApp.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 px-1 mb-3">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue by App · {revenueMetrics.revenueByApp.length}
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {revenueMetrics.revenueByApp.map((app, idx) => (
                    <div 
                      key={`${app.appBundleId}-${idx}`}
                      className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08] hover:bg-white/[0.05] transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {/* App Icon */}
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-white/[0.05] flex items-center justify-center border border-white/[0.08]">
                          {app.appIcon ? (
                            <img 
                              src={app.appIcon} 
                              alt={app.appName} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-gray-400 font-bold text-lg">
                              {(app.appName || 'App').charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        
                        {/* App Name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {app.appName || 'Unknown App'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {app.appBundleId}
                          </p>
                        </div>
                      </div>
                      
                      {/* Metrics */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400">Revenue</span>
                          <span className="text-sm font-bold text-white">
                            {formatCurrency(app.revenue)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400">Downloads</span>
                          <span className="text-sm font-semibold text-white">
                            {formatNumber(app.downloads)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400">Active Subs</span>
                          <span className="text-sm font-semibold text-white">
                            {formatNumber(app.activeSubscriptions)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trend Chart */}
            {chartData.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 px-1 mb-3">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {metricType === 'revenue' ? 'Revenue Trend' : 'Download Trend'}
                    {interval && (
                      <span className="ml-2 text-emerald-400">
                        ({formatIntervalRange(interval)})
                      </span>
                    )}
                  </h3>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08]">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis 
                        dataKey="date" 
                        stroke="rgba(255,255,255,0.3)"
                        style={{ fontSize: '12px' }}
                        tick={{ fill: 'rgba(255,255,255,0.5)' }}
                      />
                      <YAxis 
                        yAxisId="left"
                        stroke="rgba(16,185,129,0.5)"
                        style={{ fontSize: '12px' }}
                        tick={{ fill: 'rgba(255,255,255,0.5)' }}
                        tickFormatter={(value) => `$${value.toFixed(0)}`}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right"
                        stroke="rgba(59,130,246,0.5)"
                        style={{ fontSize: '12px' }}
                        tick={{ fill: 'rgba(255,255,255,0.5)' }}
                        tickFormatter={(value) => formatNumber(value)}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(17, 17, 17, 0.95)', 
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          color: 'white'
                        }}
                        formatter={(value: any, name: string) => {
                          if (name === 'revenue') {
                            return [`$${Number(value).toFixed(2)}`, 'Revenue'];
                          }
                          return [formatNumber(Number(value)), 'Downloads'];
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}
                        formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                      />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="rgb(16,185,129)" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="downloads" 
                        stroke="rgb(59,130,246)" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayTransactionsModal;

