import React, { useMemo, useState } from 'react';
import { LinkClick } from '../services/LinkClicksService';
import { DateFilterType } from './DateRangeFilter';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, BarChart2, Activity, Info, ChevronDown } from 'lucide-react';

interface LinksMetricComparisonCardProps {
  linkClicks: LinkClick[];
  dateFilter: DateFilterType;
  customDateRange?: { startDate: Date; endDate: Date };
}

type ChartType = 'line' | 'area' | 'bar';

const LinksMetricComparisonCard: React.FC<LinksMetricComparisonCardProps> = ({
  linkClicks,
  dateFilter,
  customDateRange,
}) => {
  const [hoveredMetric, setHoveredMetric] = useState<'links' | 'unique' | null>(null);
  const [chartType, setChartType] = useState<ChartType>('area');
  const [showTooltipInfo, setShowTooltipInfo] = useState(false);

  const chartData = useMemo(() => {
    // Group clicks by date
    const dataByDate: { [key: string]: { totalClicks: number; uniqueClicks: Set<string> } } = {};

    // Find actual date range from data
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    // Get date range from link clicks
    linkClicks.forEach((click) => {
      const date = new Date(click.timestamp);
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    });

    // If no data, use last 7 days
    if (!minDate || !maxDate) {
      maxDate = new Date();
      minDate = new Date();
      minDate.setDate(minDate.getDate() - 7);
    }

    // Extend range slightly for padding
    const startDate = new Date(minDate);
    startDate.setDate(startDate.getDate() - 1);
    const endDate = new Date(maxDate);
    endDate.setDate(endDate.getDate() + 1);

    // Initialize all dates in range with 0
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      dataByDate[dateKey] = { totalClicks: 0, uniqueClicks: new Set() };
    }

    // Aggregate click data
    linkClicks.forEach((click) => {
      const dateKey = new Date(click.timestamp).toISOString().split('T')[0];
      if (dataByDate[dateKey]) {
        dataByDate[dateKey].totalClicks += 1;
        // Use userAgent + deviceType as unique identifier
        dataByDate[dateKey].uniqueClicks.add(`${click.userAgent}-${click.deviceType}`);
      }
    });

    // Convert to array format for recharts
    const chartDataArray = Object.entries(dataByDate)
      .map(([date, data]) => ({
        date,
        totalClicks: data.totalClicks,
        uniqueClicks: data.uniqueClicks.size,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return chartDataArray;
  }, [linkClicks]);

  // Calculate totals and growth
  const stats = useMemo(() => {
    const now = new Date();
    let dateRangeStart: Date | null = null;
    let dateRangeEnd: Date = new Date();
    let ppDateRangeStart: Date | null = null;
    let ppDateRangeEnd: Date | null = null;
    
    // Calculate date ranges based on filter
    if (dateFilter === 'today') {
      dateRangeStart = new Date(now);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd.setHours(23, 59, 59, 999);
      
      // PP = yesterday
      ppDateRangeStart = new Date(dateRangeStart);
      ppDateRangeStart.setDate(ppDateRangeStart.getDate() - 1);
      ppDateRangeEnd = new Date(ppDateRangeStart);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'last7days') {
      dateRangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // PP = previous 7 days
      ppDateRangeStart = new Date(dateRangeStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      ppDateRangeEnd = new Date(dateRangeStart);
    } else if (dateFilter === 'last30days') {
      dateRangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // PP = previous 30 days
      ppDateRangeStart = new Date(dateRangeStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      ppDateRangeEnd = new Date(dateRangeStart);
    } else if (dateFilter === 'last90days') {
      dateRangeStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      
      // PP = previous 90 days
      ppDateRangeStart = new Date(dateRangeStart.getTime() - 90 * 24 * 60 * 60 * 1000);
      ppDateRangeEnd = new Date(dateRangeStart);
    } else if (dateFilter === 'custom' && customDateRange) {
      dateRangeStart = new Date(customDateRange.startDate);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date(customDateRange.endDate);
      dateRangeEnd.setHours(23, 59, 59, 999);
      
      // PP = same duration before start date
      const duration = dateRangeEnd.getTime() - dateRangeStart.getTime();
      ppDateRangeEnd = new Date(dateRangeStart);
      ppDateRangeStart = new Date(dateRangeStart.getTime() - duration);
    }
    
    // Current Period clicks
    const cpClicks = linkClicks.filter(click => {
      if (!dateRangeStart) return true;
      const clickDate = new Date(click.timestamp);
      return clickDate >= dateRangeStart && clickDate <= dateRangeEnd;
    });
    
    const cpTotalClicks = cpClicks.length;
    const cpUniqueClicks = new Set(cpClicks.map(c => `${c.userAgent}-${c.deviceType}`)).size;
    
    // Previous Period clicks
    let ppTotalClicks = 0;
    let ppUniqueClicks = 0;
    
    if (ppDateRangeStart && ppDateRangeEnd) {
      const ppClicks = linkClicks.filter(click => {
        const clickDate = new Date(click.timestamp);
        return clickDate >= ppDateRangeStart! && clickDate <= ppDateRangeEnd!;
      });
      
      ppTotalClicks = ppClicks.length;
      ppUniqueClicks = new Set(ppClicks.map(c => `${c.userAgent}-${c.deviceType}`)).size;
    }
    
    // Calculate growth percentages
    const totalClicksGrowth = ppTotalClicks > 0 ? ((cpTotalClicks - ppTotalClicks) / ppTotalClicks) * 100 : 0;
    const uniqueClicksGrowth = ppUniqueClicks > 0 ? ((cpUniqueClicks - ppUniqueClicks) / ppUniqueClicks) * 100 : 0;
    
    return {
      cpTotalClicks,
      cpUniqueClicks,
      totalClicksGrowth,
      uniqueClicksGrowth,
    };
  }, [linkClicks, dateFilter, customDateRange]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div 
          className="backdrop-blur-xl text-white rounded-xl border shadow-2xl"
          style={{
            backgroundColor: 'rgba(26, 26, 26, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            padding: '12px 16px'
          }}
        >
          <p className="text-sm font-semibold text-white mb-2">
            {new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-sm" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs text-gray-300">
                    {entry.dataKey === 'totalClicks' ? 'Total Clicks' : 'Unique Clicks'}:
                  </span>
                </div>
                <span className="text-sm font-bold text-white">{formatNumber(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Colors for metrics
  const totalClicksColor = '#10b981'; // Emerald
  const uniqueClicksColor = '#3b82f6'; // Blue

  // Render chart based on type
  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 10, left: 0, bottom: 0 }
    };

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <defs>
              <linearGradient id="barGradientTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={totalClicksColor} stopOpacity={1} />
                <stop offset="100%" stopColor={totalClicksColor} stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="barGradientUnique" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={uniqueClicksColor} stopOpacity={1} />
                <stop offset="100%" stopColor={uniqueClicksColor} stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(255, 255, 255, 0.05)" 
              vertical={false}
            />
            <XAxis 
              dataKey="date"
              stroke="rgba(255, 255, 255, 0.15)" 
              tick={{ fill: 'rgba(255, 255, 255, 0.4)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
            />
            <YAxis 
              yAxisId="left"
              stroke={totalClicksColor}
              tick={{ fill: totalClicksColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatNumber}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke={uniqueClicksColor}
              tick={{ fill: uniqueClicksColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatNumber}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }} />
            <Bar
              yAxisId="left"
              dataKey="totalClicks"
              fill="url(#barGradientTotal)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              opacity={hoveredMetric === 'unique' ? 0.3 : 1}
            />
            <Bar
              yAxisId="right"
              dataKey="uniqueClicks"
              fill="url(#barGradientUnique)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              opacity={hoveredMetric === 'links' ? 0.3 : 1}
            />
          </BarChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(255, 255, 255, 0.05)" 
              vertical={false}
            />
            <XAxis 
              dataKey="date"
              stroke="rgba(255, 255, 255, 0.15)" 
              tick={{ fill: 'rgba(255, 255, 255, 0.4)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
            />
            <YAxis 
              yAxisId="left"
              stroke={totalClicksColor}
              tick={{ fill: totalClicksColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatNumber}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke={uniqueClicksColor}
              tick={{ fill: uniqueClicksColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatNumber}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="totalClicks"
              stroke={totalClicksColor}
              strokeWidth={2.5}
              dot={{ fill: totalClicksColor, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: totalClicksColor, stroke: '#fff', strokeWidth: 2 }}
              opacity={hoveredMetric === 'unique' ? 0.3 : 1}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="uniqueClicks"
              stroke={uniqueClicksColor}
              strokeWidth={2.5}
              dot={{ fill: uniqueClicksColor, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: uniqueClicksColor, stroke: '#fff', strokeWidth: 2 }}
              opacity={hoveredMetric === 'links' ? 0.3 : 1}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="totalClicksGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={totalClicksColor} stopOpacity={0.5} />
                <stop offset="100%" stopColor={totalClicksColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="uniqueClicksGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={uniqueClicksColor} stopOpacity={0.5} />
                <stop offset="100%" stopColor={uniqueClicksColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="rgba(255, 255, 255, 0.15)" 
              tick={{ fill: 'rgba(255, 255, 255, 0.4)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
            />
            <YAxis 
              yAxisId="left"
              stroke={totalClicksColor}
              tick={{ fill: totalClicksColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatNumber}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke={uniqueClicksColor}
              tick={{ fill: uniqueClicksColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatNumber}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="totalClicks"
              stroke={totalClicksColor}
              strokeWidth={2.5}
              fill="url(#totalClicksGradient)"
              opacity={hoveredMetric === 'unique' ? 0.3 : 1}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="uniqueClicks"
              stroke={uniqueClicksColor}
              strokeWidth={2.5}
              fill="url(#uniqueClicksGradient)"
              opacity={hoveredMetric === 'links' ? 0.3 : 1}
            />
          </AreaChart>
        );
    }
  };

  return (
    <div className="relative rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg hover:shadow-xl transition-all duration-300 p-6 overflow-hidden">
      {/* Depth Gradient Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
        }}
      />

      {/* Content Layer */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">Metric Comparison</h2>
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltipInfo(true)}
                onMouseLeave={() => setShowTooltipInfo(false)}
                className="text-gray-500 hover:text-gray-400 transition-colors"
              >
                <Info className="w-4 h-4" style={{ opacity: 0.5 }} />
              </button>
              
              {/* Info Tooltip */}
              {showTooltipInfo && (
                <div 
                  className="absolute left-0 top-full mt-2 w-64 p-3 rounded-lg border shadow-xl z-50"
                  style={{
                    backgroundColor: 'rgba(26, 26, 26, 0.98)',
                    borderColor: 'rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Compare total clicks vs unique clicks to understand traffic patterns and audience reach.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Chart Type Icons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded-md transition-all ${
                chartType === 'bar' 
                  ? 'bg-white/15 text-white' 
                  : 'text-gray-500 hover:bg-white/5 hover:text-gray-400'
              }`}
              title="Bar Chart"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`p-1.5 rounded-md transition-all ${
                chartType === 'line' 
                  ? 'bg-white/15 text-white' 
                  : 'text-gray-500 hover:bg-white/5 hover:text-gray-400'
              }`}
              title="Line Chart"
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`p-1.5 rounded-md transition-all ${
                chartType === 'area' 
                  ? 'bg-white/15 text-white' 
                  : 'text-gray-500 hover:bg-white/5 hover:text-gray-400'
              }`}
              title="Area Chart"
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div 
            className={`p-4 rounded-xl bg-white/5 border transition-all cursor-pointer ${
              hoveredMetric === 'links' ? 'border-[#10B981] bg-[#10B981]/10' : 'border-white/5'
            }`}
            onMouseEnter={() => setHoveredMetric('links')}
            onMouseLeave={() => setHoveredMetric(null)}
          >
            <p className="text-xs text-gray-400 mb-1">Total Clicks</p>
            <p className="text-2xl font-bold text-white mb-1">{formatNumber(stats.cpTotalClicks)}</p>
            {dateFilter !== 'all' && (
              <div className="flex items-center gap-1">
                {stats.totalClicksGrowth >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-400" />
                )}
                <span className={`text-xs font-medium ${
                  stats.totalClicksGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {Math.abs(stats.totalClicksGrowth).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          <div 
            className={`p-4 rounded-xl bg-white/5 border transition-all cursor-pointer ${
              hoveredMetric === 'unique' ? 'border-[#3B82F6] bg-[#3B82F6]/10' : 'border-white/5'
            }`}
            onMouseEnter={() => setHoveredMetric('unique')}
            onMouseLeave={() => setHoveredMetric(null)}
          >
            <p className="text-xs text-gray-400 mb-1">Unique Clicks</p>
            <p className="text-2xl font-bold text-white mb-1">{formatNumber(stats.cpUniqueClicks)}</p>
            {dateFilter !== 'all' && (
              <div className="flex items-center gap-1">
                {stats.uniqueClicksGrowth >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-400" />
                )}
                <span className={`text-xs font-medium ${
                  stats.uniqueClicksGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {Math.abs(stats.uniqueClicksGrowth).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default LinksMetricComparisonCard;

