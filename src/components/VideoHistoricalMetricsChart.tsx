import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Eye, Heart, MessageCircle, Share2, TrendingUp, Bookmark, ChevronDown } from 'lucide-react';
import '../styles/no-select.css';

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
  cumulativeTotals: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    engagementRate: number;
  };
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
    formatValue: (value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'likes',
    label: 'Likes',
    icon: Heart,
    color: '#22c55e', // Green for all
    formatValue: (value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'comments',
    label: 'Comments',
    icon: MessageCircle,
    color: '#22c55e', // Green for all
    formatValue: (value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'shares',
    label: 'Shares',
    icon: Share2,
    color: '#22c55e', // Green for all
    formatValue: (value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'saves',
    label: 'Bookmarks',
    icon: Bookmark,
    color: '#22c55e', // Green for all
    formatValue: (value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'engagementRate',
    label: 'Engagement',
    icon: TrendingUp,
    color: '#22c55e', // Green for all
    formatValue: (value) => `${value.toFixed(1)}%`,
  },
];

export const VideoHistoricalMetricsChart: React.FC<VideoHistoricalMetricsChartProps> = ({ data, cumulativeTotals }) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('views');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const currentMetric = metrics.find(m => m.key === selectedMetric) || metrics[0];

  // Calculate max value for Y-axis
  const maxValue = useMemo(() => {
    if (data.length === 0) return 100;
    const values = data.map(d => d[selectedMetric]);
    return Math.max(...values, 10);
  }, [data, selectedMetric]);

  // Get cumulative total for selected metric
  const totalValue = useMemo(() => {
    return cumulativeTotals[selectedMetric];
  }, [cumulativeTotals, selectedMetric]);

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
    return totalValue.toLocaleString();
  }, [totalValue, selectedMetric]);

  // Custom tooltip - shows the DELTA (difference) for this snapshot
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dataPoint = payload[0].payload;
    const deltaValue = dataPoint[selectedMetric]; // This is already the delta from chart data
    
    return (
      <div 
        className="rounded-lg border border-white/10 shadow-xl p-3 min-w-[160px]"
        style={{ backgroundColor: 'rgba(18, 18, 20, 0.98)' }}
      >
        <div className="text-xs text-gray-400 mb-2">{dataPoint.date}</div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: '#3b82f6' }}
              />
              <span className="text-xs text-gray-400">Growth:</span>
            </div>
            <span className="text-sm font-bold text-white">
              +{currentMetric.formatValue(deltaValue)}
            </span>
          </div>
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
    <div className="relative rounded-2xl border border-white/5 shadow-lg overflow-hidden select-none" style={{ backgroundColor: '#121214', userSelect: 'none' }}>
      {/* Depth Gradient Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
        }}
      />

      {/* Header with Title and Metric Selector */}
      <div className="relative px-6 pt-5 pb-3 flex items-center justify-between border-b border-white/5" style={{ zIndex: 100 }}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-white">
            Growth per Snapshot
          </h3>
        </div>

        {/* Metric Selector Dropdown */}
        <div className="relative z-30">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border transition-all outline-none focus:outline-none"
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
                style={{ zIndex: 9999 }}
                onClick={() => setIsDropdownOpen(false)}
              />
              
              {/* Menu */}
              <div 
                className="absolute right-0 mt-2 w-48 rounded-xl border shadow-2xl overflow-hidden"
                style={{ 
                  backgroundColor: '#0a0a0b',
                  borderColor: 'rgba(255,255,255,0.1)',
                  zIndex: 10000,
                }}
              >
                {metrics.map((metric) => {
                  const isSelected = selectedMetric === metric.key;
                  return (
                    <button
                      key={metric.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMetric(metric.key);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-all outline-none focus:outline-none"
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
      <div className="relative z-10 p-6 pt-16" style={{ height: '400px' }}>
        {/* Total Amount Display - Above Chart */}
        <div className="absolute top-6 right-8 z-20 text-right">
          <div className="text-xs text-gray-500 mb-0.5 font-medium tracking-wide uppercase">
            Total {currentMetric.label}
          </div>
          <div className="text-4xl font-bold tracking-tight text-white">
            {formattedTotal}
          </div>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <AreaChart 
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id={`gradient-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
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
            
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '5 5' }}
              animationDuration={200}
              isAnimationActive={true}
            />
            
            <Area 
              type="monotone"
              dataKey={selectedMetric}
              stroke="#3b82f6"
              strokeWidth={3}
              fill={`url(#gradient-${selectedMetric})`}
              fillOpacity={1}
              dot={{ 
                fill: '#3b82f6', 
                strokeWidth: 2, 
                r: 5,
                stroke: '#121214',
                style: { cursor: 'pointer' }
              }}
              activeDot={{ 
                r: 7, 
                fill: '#3b82f6',
                stroke: '#121214',
                strokeWidth: 2,
                style: { cursor: 'pointer' }
              }}
              isAnimationActive={true}
              animationDuration={300}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Watermark */}
      <div 
        className="absolute bottom-4 right-6 text-xs font-semibold tracking-wider opacity-10 pointer-events-none"
        style={{ color: 'white' }}
      >
        viewtrack.app
      </div>
    </div>
  );
};

