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
    color: '#8b5cf6',
    formatValue: (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'likes',
    label: 'Likes',
    icon: Heart,
    color: '#ec4899',
    formatValue: (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'comments',
    label: 'Comments',
    icon: MessageCircle,
    color: '#06b6d4',
    formatValue: (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'shares',
    label: 'Shares',
    icon: Share2,
    color: '#10b981',
    formatValue: (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'saves',
    label: 'Bookmarks',
    icon: Bookmark,
    color: '#f59e0b',
    formatValue: (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString(),
  },
  {
    key: 'engagementRate',
    label: 'Engagement',
    icon: TrendingUp,
    color: '#22c55e',
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
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all"
          >
            <div 
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: currentMetric.color }}
            />
            <span className="text-sm font-medium text-white">{currentMetric.label}</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setIsDropdownOpen(false)}
              />
              
              {/* Menu */}
              <div 
                className="absolute right-0 mt-2 w-48 rounded-lg border border-white/10 shadow-xl z-50 overflow-hidden"
                style={{ backgroundColor: '#1a1a1c' }}
              >
                {metrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <button
                      key={metric.key}
                      onClick={() => {
                        setSelectedMetric(metric.key);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors ${
                        selectedMetric === metric.key ? 'bg-white/10' : ''
                      }`}
                    >
                      <Icon 
                        className="w-4 h-4"
                        style={{ color: metric.color }}
                      />
                      <span className="text-sm font-medium text-white">{metric.label}</span>
                      {selectedMetric === metric.key && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: metric.color }} />
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
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id={`gradient-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={currentMetric.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={currentMetric.color} stopOpacity={0} />
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

