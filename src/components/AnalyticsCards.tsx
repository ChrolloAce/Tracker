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

  // Normalize chart data to show trends better
  // Use cumulative sum to show growth trajectory
  const normalizedChartData = React.useMemo(() => {
    let cumulative = 0;
    return chartData.map(point => {
      cumulative += point.value;
      return {
        ...point,
        displayValue: cumulative,
        originalValue: point.value
      };
    });
  }, [chartData]);

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-white p-2 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900">
            {formatNumber(dataPoint.originalValue || payload[0].value)}
          </p>
          <p className="text-xs text-gray-500">{label}</p>
          {dataPoint.displayValue && (
            <p className="text-xs text-gray-400">
              Total: {formatNumber(dataPoint.displayValue)}
            </p>
          )}
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
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 ${colorClasses.bg} rounded-lg flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${colorClasses.icon}`} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</h3>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-50 transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Main Value */}
      <div className="mb-6">
        <div className="text-3xl font-bold text-gray-900 mb-2">
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

      {/* Enhanced Interactive Chart - Using cumulative data for better trend visibility */}
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={normalizedChartData}
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
            <YAxis 
              hide 
              domain={['dataMin', 'dataMax']}
              scale="linear"
            />
            <Area
              type="monotone"
              dataKey="displayValue"
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
  // Calculate analytics using snapshot-based growth when applicable
  const analytics = useMemo(() => {
    return DateFilterService.calculateFilteredAnalytics(submissions, dateFilter, customDateRange);
  }, [submissions, dateFilter, customDateRange]);

  const { totalLikes, totalComments, totalViews } = analytics;

  // Generate time series data based on actual submissions and selected time period
  const chartData = useMemo(() => {
    const timeSeriesData = TimePeriodService.generateTimeSeriesData(submissions, timePeriod);
    
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
  }, [submissions, timePeriod]);

  // Calculate period-over-period changes (comparing recent activity vs older periods)
  const calculateChange = (data: { period: string; value: number }[]): number => {
    if (data.length < 2) return 0;
    
    // Compare the most recent period activity vs the overall average
    const recentPeriodCount = Math.min(3, Math.floor(data.length / 3)); // Last 33% or 3 periods
    const recentData = data.slice(-recentPeriodCount);
    const olderData = data.slice(0, -recentPeriodCount);
    
    if (olderData.length === 0) return 0;
    
    const recentAverage = recentData.reduce((sum, p) => sum + p.value, 0) / recentData.length;
    const olderAverage = olderData.reduce((sum, p) => sum + p.value, 0) / olderData.length;
    
    if (olderAverage === 0) return recentAverage > 0 ? 100 : 0;
    
    return ((recentAverage - olderAverage) / olderAverage) * 100;
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
