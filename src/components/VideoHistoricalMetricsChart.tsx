import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Eye, Heart, MessageCircle, Share2, TrendingUp, Bookmark, ChevronDown } from 'lucide-react';

interface ChartDataPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
  timestamp: number;
}

interface VideoHistoricalMetricsChartProps {
  data: ChartDataPoint[];
}

type MetricKey = 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'engagementRate';

interface MetricConfig {
  key: MetricKey;
  label: string;
  icon: React.ElementType;
  color: string;
  formatValue: (value: number) => string;
}

const metrics: MetricConfig[] = [
  {
    key: 'views',
    label: 'Views',
    icon: Eye,
    color: '#22c55e', // Green for all
    formatValue: (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'likes',
    label: 'Likes',
    icon: Heart,
    color: '#22c55e', // Green for all
    formatValue: (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'comments',
    label: 'Comments',
    icon: MessageCircle,
    color: '#22c55e', // Green for all
    formatValue: (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'shares',
    label: 'Shares',
    icon: Share2,
    color: '#22c55e', // Green for all
    formatValue: (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'saves',
    label: 'Bookmarks',
    icon: Bookmark,
    color: '#22c55e', // Green for all
    formatValue: (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'engagementRate',
    label: 'Engagement',
    icon: TrendingUp,
    color: '#22c55e', // Green for all
    formatValue: (value) => `${value.toFixed(1)}%`,
  },
];

export const VideoHistoricalMetricsChart: React.FC<VideoHistoricalMetricsChartProps> = ({ data }) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('views');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const currentMetric = metrics.find(m => m.key === selectedMetric) || metrics[0];
  const MetricIcon = currentMetric.icon;

  // Calculate max value for Y-axis
  const maxValue = useMemo(() => {
    if (data.length === 0) return 100;
    const values = data.map(d => d[selectedMetric]);
    return Math.max(...values, 10);
  }, [data, selectedMetric]);

  // Calculate total (latest/cumulative value)
  const totalValue = useMemo(() => {
    if (data.length === 0) return 0;
    // Get the latest (most recent) value
    return data[data.length - 1][selectedMetric];
  }, [data, selectedMetric]);

  // Format total value for display
  const formattedTotal = useMemo(() => {
    if (selectedMetric === 'engagementRate') {
      return `${totalValue.toFixed(1)}%`;
    }
    if (totalValue >= 1000000) {
      return `${(totalValue / 1000000).toFixed(1)}M`;
    }
    if (totalValue >= 1000) {
      return `${(totalValue / 1000).toFixed(1)}K`;
    }
    return totalValue.toString();
  }, [totalValue, selectedMetric]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dataPoint = payload[0].payload;
    
    return (
      <div 
        className="rounded-lg border border-white/10 shadow-xl p-3"
        style={{ backgroundColor: 'rgba(18, 18, 20, 0.98)' }}
      >
        <div className="text-xs text-gray-400 mb-1.5">{dataPoint.date}</div>
        <div className="flex items-center gap-2">
          <div 
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: currentMetric.color }}
          />
          <span className="text-sm font-semibold text-white">
            {currentMetric.formatValue(dataPoint[selectedMetric])}
          </span>
        </div>
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className="relative rounded-2xl border border-white/5 shadow-lg overflow-hidden" style={{ backgroundColor: '#121214', height: '400px' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-500 text-sm mb-2">No historical data available</div>
            <div className="text-gray-600 text-xs">Snapshots will appear as data is collected</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border border-white/5 shadow-lg overflow-hidden" style={{ backgroundColor: '#121214' }}>
      {/* Depth Gradient Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
        }}
      />

      {/* Header with Title and Metric Selector */}
      <div className="relative z-10 px-6 pt-5 pb-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-white">
            Historical Metrics
          </h3>
        </div>

        {/* Metric Selector Dropdown */}
        <div className="relative" style={{ zIndex: 9999 }}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border transition-all"
            style={{
              backgroundColor: isDropdownOpen ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
              borderColor: isDropdownOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
            }}
          >
            <span className="text-sm font-semibold text-white">{currentMetric.label}</span>
            <ChevronDown 
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} 
            />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0"
                style={{ zIndex: 9998 }}
                onClick={() => setIsDropdownOpen(false)}
              />
              
              {/* Menu */}
              <div 
                className="absolute right-0 mt-2 w-48 rounded-xl border shadow-2xl overflow-hidden"
                style={{ 
                  backgroundColor: '#0a0a0b',
                  borderColor: 'rgba(255,255,255,0.1)',
                  zIndex: 9999,
                }}
              >
                {metrics.map((metric) => {
                  const isSelected = selectedMetric === metric.key;
                  return (
                    <button
                      key={metric.key}
                      onClick={() => {
                        setSelectedMetric(metric.key);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-all"
                      style={{
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <span className="text-sm font-medium text-white flex-1 text-left">
                        {metric.label}
                      </span>
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="relative z-10 p-6" style={{ height: '350px' }}>
        {/* Total Value Display - Inside Chart (Top Right) */}
        <div className="absolute top-8 right-8 z-20 text-right">
          <div className="text-xs text-gray-400 mb-0.5 font-medium tracking-wide">
            {currentMetric.label}
          </div>
          <div className="text-3xl font-bold tracking-tight text-white">
            {formattedTotal}
          </div>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id={`gradient-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(255,255,255,0.03)" 
              vertical={false}
            />
            
            <XAxis 
              dataKey="date"
              stroke="rgba(255,255,255,0.3)"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              dy={5}
            />
            
            <YAxis 
              stroke="rgba(255,255,255,0.3)"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              dx={-5}
              tickFormatter={(value) => {
                if (selectedMetric === 'engagementRate') {
                  return `${value.toFixed(0)}%`;
                }
                return value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toString();
              }}
              domain={[0, Math.ceil(maxValue * 1.1)]}
            />
            
            <Tooltip content={<CustomTooltip />} cursor={false} />
            
            <Line 
              type="monotone"
              dataKey={selectedMetric}
              stroke={currentMetric.color}
              strokeWidth={3}
              dot={{ 
                fill: currentMetric.color, 
                strokeWidth: 2, 
                r: 4,
                stroke: '#121214'
              }}
              activeDot={{ 
                r: 6, 
                fill: currentMetric.color,
                stroke: '#121214',
                strokeWidth: 2
              }}
              fill={`url(#gradient-${selectedMetric})`}
              fillOpacity={1}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Watermark */}
      <div 
        className="absolute bottom-4 right-6 text-xs font-semibold tracking-wider opacity-10 pointer-events-none"
        style={{ color: 'white' }}
      >
        viral.app
      </div>
    </div>
  );
};

