import React, { useMemo } from 'react';
import { MoreVertical, TrendingUp, TrendingDown, Eye, Heart, MessageCircle } from 'lucide-react';
import { VideoSubmission } from '../types';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import DateFilterService from '../services/DateFilterService';
import { DateFilterType } from './DateRangeFilter';
import { TimePeriodType } from './TimePeriodSelector';
import { TimePeriodService } from '../services/TimePeriodService';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface AnalyticsCardsProps {
  submissions: VideoSubmission[];
  periodDescription?: string;
  dateFilter?: DateFilterType;
  customDateRange?: DateRange;
  timePeriod?: TimePeriodType;
}

interface MetricCardProps {
  title: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease';
  chartData: { period: string; value: number }[];
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple';
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  change, 
  changeType, 
  chartData,
  icon: Icon,
  color
}) => {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#1A1A1A] p-2 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {formatNumber(payload[0].value)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      );
    }
    return null;
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-50',
          icon: 'text-blue-600',
          stroke: '#3b82f6',
          gradient: 'blue-gradient'
        };
      case 'green':
        return {
          bg: 'bg-green-50',
          icon: 'text-green-600',
          stroke: '#22c55e',
          gradient: 'green-gradient'
        };
      case 'purple':
        return {
          bg: 'bg-purple-50',
          icon: 'text-purple-600',
          stroke: '#a855f7',
          gradient: 'purple-gradient'
        };
      default:
        return {
          bg: 'bg-gray-50',
          icon: 'text-gray-600',
          stroke: '#6b7280',
          gradient: 'gray-gradient'
        };
    }
  };

  const colorClasses = getColorClasses(color);

  return (
    <div className="bg-white dark:bg-[#161616] rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 ${colorClasses.bg} rounded-lg flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${colorClasses.icon}`} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</h3>
          </div>
        </div>
        <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Main Value */}
      <div className="mb-6">
        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {formatNumber(value)}
        </div>
        <div className={`flex items-center text-sm font-medium ${
          changeType === 'increase' ? 'text-green-600' : 'text-red-600'
        }`}>
          {changeType === 'increase' ? (
            <TrendingUp className="w-4 h-4 mr-1" />
          ) : (
            <TrendingDown className="w-4 h-4 mr-1" />
          )}
          <span>{Math.abs(change).toFixed(1)}% from last period</span>
        </div>
      </div>

      {/* Enhanced Interactive Chart */}
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
          >
            <defs>
              <linearGradient id={`areaGradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colorClasses.stroke} stopOpacity={0.2} />
                <stop offset="100%" stopColor={colorClasses.stroke} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="period" 
              axisLine={false}
              tickLine={false}
              tick={false}
            />
            <YAxis hide scale="sqrt" domain={[0, 'auto']} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={colorClasses.stroke}
              strokeWidth={2}
              fill={`url(#areaGradient-${color})`}
              dot={false}
              activeDot={{ 
                r: 3, 
                fill: colorClasses.stroke, 
                strokeWidth: 2, 
                stroke: '#fff' 
              }}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ stroke: colorClasses.stroke, strokeWidth: 1, strokeOpacity: 0.5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const AnalyticsCards: React.FC<AnalyticsCardsProps> = ({ 
  submissions, 
  dateFilter = 'all',
  customDateRange,
  timePeriod = 'weeks'
}) => {
  // We don't use analytics totals anymore - we calculate from graph data instead
  // This was kept for potential future use but is currently unused

  // Generate time series data based on actual submissions and selected time period
  // Use the date filter range to constrain the graph timeline
  const chartData = useMemo(() => {
    const dateRange = dateFilter !== 'all' 
      ? DateFilterService.getDateRange(dateFilter, customDateRange)
      : undefined;
    
    const timeSeriesData = TimePeriodService.generateTimeSeriesData(
      submissions, 
      timePeriod,
      dateRange
    );
    
    const viewsData = timeSeriesData.map(period => ({
      period: period.period,
      value: period.views
    }));
    
    const likesData = timeSeriesData.map(period => ({
      period: period.period,
      value: period.likes
    }));
    
    const commentsData = timeSeriesData.map(period => ({
      period: period.period,
      value: period.comments
    }));

    return {
      views: viewsData,
      likes: likesData,
      comments: commentsData
    };
  }, [submissions, timePeriod, dateFilter, customDateRange]);

  // Calculate totals from graph data - this ensures the numbers match what's shown in graphs
  const totalViews = useMemo(() => {
    return chartData.views.reduce((sum, period) => sum + period.value, 0);
  }, [chartData.views]);

  const totalLikes = useMemo(() => {
    return chartData.likes.reduce((sum, period) => sum + period.value, 0);
  }, [chartData.likes]);

  const totalComments = useMemo(() => {
    return chartData.comments.reduce((sum, period) => sum + period.value, 0);
  }, [chartData.comments]);

  // Calculate period-over-period changes
  const calculateChange = (data: { period: string; value: number }[]): number => {
    if (data.length < 2) return 0;
    const current = data[data.length - 1].value;
    const previous = data[data.length - 2].value;
    return previous > 0 ? ((current - previous) / previous) * 100 : 0;
  };

  const likesChange = calculateChange(chartData.likes);
  const commentsChange = calculateChange(chartData.comments);
  const viewsChange = calculateChange(chartData.views);

  return (
    <div className="mb-8">
      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard
          title="Total Views"
          value={totalViews}
          change={viewsChange}
          changeType={viewsChange >= 0 ? "increase" : "decrease"}
          chartData={chartData.views}
          icon={Eye}
          color="blue"
        />
        
        <MetricCard
          title="Total Likes"
          value={totalLikes}
          change={likesChange}
          changeType={likesChange >= 0 ? "increase" : "decrease"}
          chartData={chartData.likes}
          icon={Heart}
          color="green"
        />
        
        <MetricCard
          title="Total Comments"
          value={totalComments}
          change={commentsChange}
          changeType={commentsChange >= 0 ? "increase" : "decrease"}
          chartData={chartData.comments}
          icon={MessageCircle}
          color="purple"
        />
      </div>
    </div>
  );
};
