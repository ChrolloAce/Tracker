import React, { useMemo, useState } from 'react';
import { LinkClick } from '../services/LinkClicksService';
import { DateFilterType } from './DateRangeFilter';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, BarChart2, Activity, Info } from 'lucide-react';
import DayClicksModal from './DayClicksModal';
import { TrackedLink, TrackedAccount } from '../types/firestore';

interface LinksMetricComparisonCardProps {
  linkClicks: LinkClick[];
  dateFilter: DateFilterType;
  customDateRange?: { startDate: Date; endDate: Date };
  links: TrackedLink[];
  accounts: Map<string, TrackedAccount>;
  onLinkClick: (link: TrackedLink) => void;
}

type ChartType = 'line' | 'area' | 'bar';

const LinksMetricComparisonCard: React.FC<LinksMetricComparisonCardProps> = ({
  linkClicks,
  dateFilter,
  customDateRange,
  links,
  accounts,
  onLinkClick,
}) => {
  const [hoveredMetric, setHoveredMetric] = useState<'links' | 'unique' | null>(null);
  const [chartType, setChartType] = useState<ChartType>('area');
  const [showTooltipInfo, setShowTooltipInfo] = useState(false);
  const [isDayClicksModalOpen, setIsDayClicksModalOpen] = useState(false);
  const [selectedDayClicksDate, setSelectedDayClicksDate] = useState<Date | null>(null);
  const [selectedDayClicks, setSelectedDayClicks] = useState<LinkClick[]>([]);

  const chartData = useMemo(() => {
    // First, filter clicks by date range
    const now = new Date();
    let dateRangeStart: Date | null = null;
    let dateRangeEnd: Date = new Date();
    
    // Calculate date ranges based on filter
    if (dateFilter === 'today') {
      dateRangeStart = new Date(now);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date(now);
      dateRangeEnd.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'yesterday') {
      dateRangeStart = new Date(now);
      dateRangeStart.setDate(dateRangeStart.getDate() - 1);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date(now);
      dateRangeEnd.setDate(dateRangeEnd.getDate() - 1);
      dateRangeEnd.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'last7days') {
      dateRangeEnd = new Date(now);
      dateRangeEnd.setHours(23, 59, 59, 999);
      dateRangeStart = new Date(now);
      dateRangeStart.setDate(dateRangeStart.getDate() - 6); // Last 7 days including today
      dateRangeStart.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'last14days') {
      dateRangeEnd = new Date(now);
      dateRangeEnd.setHours(23, 59, 59, 999);
      dateRangeStart = new Date(now);
      dateRangeStart.setDate(dateRangeStart.getDate() - 13); // Last 14 days including today
      dateRangeStart.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'last30days') {
      dateRangeEnd = new Date(now);
      dateRangeEnd.setHours(23, 59, 59, 999);
      dateRangeStart = new Date(now);
      dateRangeStart.setDate(dateRangeStart.getDate() - 29); // Last 30 days including today
      dateRangeStart.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'last90days') {
      dateRangeEnd = new Date(now);
      dateRangeEnd.setHours(23, 59, 59, 999);
      dateRangeStart = new Date(now);
      dateRangeStart.setDate(dateRangeStart.getDate() - 89); // Last 90 days including today
      dateRangeStart.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'mtd') {
      // Month to date
      dateRangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date(now);
      dateRangeEnd.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'lastmonth') {
      // Last month
      dateRangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
      dateRangeEnd.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'ytd') {
      // Year to date
      dateRangeStart = new Date(now.getFullYear(), 0, 1);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date(now);
      dateRangeEnd.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'custom' && customDateRange) {
      dateRangeStart = new Date(customDateRange.startDate);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date(customDateRange.endDate);
      dateRangeEnd.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'all') {
      // All time - no filter
      dateRangeStart = null;
      dateRangeEnd = new Date(now);
      dateRangeEnd.setHours(23, 59, 59, 999);
    }
    
    // Filter clicks by date range
    const filteredClicks = dateRangeStart 
      ? linkClicks.filter(click => {
          const clickDate = new Date(click.timestamp);
          return clickDate >= dateRangeStart! && clickDate <= dateRangeEnd;
        })
      : linkClicks;

    // Group clicks by date
    const dataByDate: { [key: string]: { totalClicks: number; uniqueClicks: Set<string> } } = {};

    // Use the filter boundaries for chart range
    let minDate = dateRangeStart || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let maxDate = dateRangeEnd;
    
    // Normalize to date-only (no time component)
    minDate = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());

    // Initialize all dates in range with 0 - fixed loop to avoid mutation issues
    const dayCount = Math.ceil((maxDate.getTime() - minDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    for (let i = 0; i < dayCount; i++) {
      const currentDate = new Date(minDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dateKey = currentDate.toISOString().split('T')[0];
      dataByDate[dateKey] = { totalClicks: 0, uniqueClicks: new Set() };
    }

    // Aggregate filtered click data
    filteredClicks.forEach((click) => {
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
  }, [linkClicks, dateFilter, customDateRange]);

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
    } else if (dateFilter === 'yesterday') {
      dateRangeStart = new Date(now);
      dateRangeStart.setDate(dateRangeStart.getDate() - 1);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date(now);
      dateRangeEnd.setDate(dateRangeEnd.getDate() - 1);
      dateRangeEnd.setHours(23, 59, 59, 999);
      
      // PP = day before yesterday
      ppDateRangeStart = new Date(dateRangeStart);
      ppDateRangeStart.setDate(ppDateRangeStart.getDate() - 1);
      ppDateRangeEnd = new Date(ppDateRangeStart);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'last7days') {
      dateRangeStart = new Date(now);
      dateRangeStart.setDate(dateRangeStart.getDate() - 6);
      dateRangeStart.setHours(0, 0, 0, 0);
      
      // PP = previous 7 days
      ppDateRangeStart = new Date(dateRangeStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      ppDateRangeEnd = new Date(dateRangeStart);
    } else if (dateFilter === 'last14days') {
      dateRangeStart = new Date(now);
      dateRangeStart.setDate(dateRangeStart.getDate() - 13);
      dateRangeStart.setHours(0, 0, 0, 0);
      
      // PP = previous 14 days
      ppDateRangeStart = new Date(dateRangeStart.getTime() - 14 * 24 * 60 * 60 * 1000);
      ppDateRangeEnd = new Date(dateRangeStart);
    } else if (dateFilter === 'last30days') {
      dateRangeStart = new Date(now);
      dateRangeStart.setDate(dateRangeStart.getDate() - 29);
      dateRangeStart.setHours(0, 0, 0, 0);
      
      // PP = previous 30 days
      ppDateRangeStart = new Date(dateRangeStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      ppDateRangeEnd = new Date(dateRangeStart);
    } else if (dateFilter === 'last90days') {
      dateRangeStart = new Date(now);
      dateRangeStart.setDate(dateRangeStart.getDate() - 89);
      dateRangeStart.setHours(0, 0, 0, 0);
      
      // PP = previous 90 days
      ppDateRangeStart = new Date(dateRangeStart.getTime() - 90 * 24 * 60 * 60 * 1000);
      ppDateRangeEnd = new Date(dateRangeStart);
    } else if (dateFilter === 'mtd') {
      // Month to date
      dateRangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date(now);
      dateRangeEnd.setHours(23, 59, 59, 999);
      
      // PP = same days in previous month
      ppDateRangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      ppDateRangeStart.setHours(0, 0, 0, 0);
      ppDateRangeEnd = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      ppDateRangeEnd.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'lastmonth') {
      // Last month
      dateRangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
      dateRangeEnd.setHours(23, 59, 59, 999);
      
      // PP = month before last month
      ppDateRangeStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      ppDateRangeStart.setHours(0, 0, 0, 0);
      ppDateRangeEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'ytd') {
      // Year to date
      dateRangeStart = new Date(now.getFullYear(), 0, 1);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date(now);
      dateRangeEnd.setHours(23, 59, 59, 999);
      
      // PP = same period last year
      ppDateRangeStart = new Date(now.getFullYear() - 1, 0, 1);
      ppDateRangeStart.setHours(0, 0, 0, 0);
      ppDateRangeEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      ppDateRangeEnd.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'custom' && customDateRange) {
      dateRangeStart = new Date(customDateRange.startDate);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date(customDateRange.endDate);
      dateRangeEnd.setHours(23, 59, 59, 999);
      
      // PP = same duration before start date
      const duration = dateRangeEnd.getTime() - dateRangeStart.getTime();
      ppDateRangeEnd = new Date(dateRangeStart);
      ppDateRangeStart = new Date(dateRangeStart.getTime() - duration);
    } else if (dateFilter === 'all') {
      // All time - no PP comparison
      dateRangeStart = null;
      dateRangeEnd = new Date(now);
      dateRangeEnd.setHours(23, 59, 59, 999);
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

  const handleChartClick = (data: any) => {
    // Recharts onClick event structure
    if (!data) return;
    
    // Try multiple possible event structures
    let dateStr: string | undefined;
    
    // Check if it's from activeLabel (common in newer Recharts versions)
    if (data.activeLabel) {
      dateStr = data.activeLabel;
    }
    // Check if it's from activePayload
    else if (data.activePayload && data.activePayload[0] && data.activePayload[0].payload) {
      dateStr = data.activePayload[0].payload.date;
    }
    // Check if it's from the direct payload
    else if (data.date) {
      dateStr = data.date;
    }
    
    if (!dateStr) {
      console.log('Unable to extract date from click event:', data);
      return;
    }
    
    const clickDate = new Date(dateStr);
    
    // Filter clicks for this specific day
    const dayClicks = linkClicks.filter(click => {
      const clickDateObj = new Date(click.timestamp);
      return clickDateObj.toISOString().split('T')[0] === dateStr;
    });
    
    if (dayClicks.length > 0) {
      setSelectedDayClicksDate(clickDate);
      setSelectedDayClicks(dayClicks);
      setIsDayClicksModalOpen(true);
    }
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
          <p className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-white/10 text-center">
            Click to view details
          </p>
        </div>
      );
    }
    return null;
  };

  // Colors for metrics
  const totalClicksColor = '#10b981'; // Green
  const uniqueClicksColor = '#6b7280'; // Gray

  // Render chart based on type
  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 10, left: 0, bottom: 0 }
    };

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps} onClick={handleChartClick}>
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
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.02)', cursor: 'pointer' }} />
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
          <LineChart {...commonProps} onClick={handleChartClick}>
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
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255, 255, 255, 0.2)' }} />
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
          <AreaChart {...commonProps} onClick={handleChartClick}>
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
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 2 }} />
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
                  className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] p-3 rounded-lg border shadow-xl z-50"
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
              hoveredMetric === 'unique' ? 'border-[#6B7280] bg-[#6B7280]/10' : 'border-white/5'
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
        <div className="h-64 cursor-pointer">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Day Clicks Modal */}
      {isDayClicksModalOpen && selectedDayClicksDate && (
        <DayClicksModal
          isOpen={isDayClicksModalOpen}
          onClose={() => {
            setIsDayClicksModalOpen(false);
            setSelectedDayClicksDate(null);
            setSelectedDayClicks([]);
          }}
          date={selectedDayClicksDate}
          clicks={selectedDayClicks}
          links={links}
          accounts={accounts}
          onLinkClick={(link) => {
            setIsDayClicksModalOpen(false);
            onLinkClick(link);
          }}
        />
      )}
    </div>
  );
};

export default LinksMetricComparisonCard;

