import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { LinkClick } from '../services/LinkClicksService';
import { LucideIcon } from 'lucide-react';

interface SparklineDataPoint {
  timestamp: number;
  value: number;
  clicks?: LinkClick[]; // Store clicks for this time point
}

interface TrackedLinksKPICardProps {
  label: string;
  value: string | number;
  growth?: number;
  isIncreasing: boolean;
  icon: LucideIcon;
  sparklineData: SparklineDataPoint[];
  onClick?: (date: Date, clicks: LinkClick[]) => void; // Click on card/graph point
  onLinkClick?: (linkCode: string, date: Date, clicks: LinkClick[]) => void; // Click on specific link in tooltip
}

export const TrackedLinksKPICard: React.FC<TrackedLinksKPICardProps> = ({
  label,
  value,
  growth,
  isIncreasing,
  icon: Icon,
  sparklineData,
  onClick,
  onLinkClick
}) => {
  const [tooltipData, setTooltipData] = useState<{ x: number; y: number; point: SparklineDataPoint; lineX: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const strokeColor = isIncreasing ? '#22c55e' : '#ef4444';

  const handleCardClick = () => {
    if (tooltipData && onClick) {
      // Open modal for the currently hovered day
      onClick(new Date(tooltipData.point.timestamp), tooltipData.point.clicks || []);
    }
  };

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      onMouseMove={(e) => {
        if (!sparklineData || sparklineData.length === 0 || !cardRef.current) return;
        
        const cardRect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - cardRect.left;
        const percentage = x / cardRect.width;
        const clampedPercentage = Math.max(0, Math.min(1, percentage));
        
        const dataIndex = Math.max(0, Math.min(
          sparklineData.length - 1,
          Math.round(clampedPercentage * (sparklineData.length - 1))
        ));
        
        const point = sparklineData[dataIndex];
        
        if (point) {
          const snappedPercentage = dataIndex / (sparklineData.length - 1);
          const snappedLineX = snappedPercentage * cardRect.width;
          
          setTooltipData({
            x: e.clientX,
            y: e.clientY,
            point: point,
            lineX: snappedLineX
          });
        }
      }}
      onMouseLeave={() => setTooltipData(null)}
      className="group relative rounded-2xl border border-white/5 shadow-lg hover:shadow-xl hover:ring-1 hover:ring-white/10 transition-all duration-300 overflow-hidden cursor-pointer"
      style={{ minHeight: '180px', backgroundColor: '#121214' }}
    >
      {/* Depth Gradient Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
        }}
      />

      {/* Full-height vertical cursor line */}
      {tooltipData && (
        <div
          style={{
            position: 'absolute',
            left: `${tooltipData.lineX}px`,
            top: 0,
            bottom: 0,
            width: '2px',
            background: `linear-gradient(to bottom, ${strokeColor}00 0%, ${strokeColor}80 15%, ${strokeColor}60 50%, ${strokeColor}40 85%, ${strokeColor}00 100%)`,
            pointerEvents: 'none',
            zIndex: 50
          }}
        />
      )}
      
      {/* Upper Solid Portion - 75% */}
      <div className="relative px-5 pt-5 pb-2 z-10" style={{ height: '75%' }}>
        {/* Icon (top-right) */}
        <div className="absolute top-4 right-4">
          <Icon className="w-5 h-5 text-gray-400 opacity-60" />
        </div>

        {/* Metric Content */}
        <div className="flex flex-col h-full justify-start pt-1">
          {/* Label */}
          <div className="text-xs font-medium text-zinc-400 tracking-wide mb-2">
            {label}
          </div>

          {/* Value + Delta */}
          <div className="flex items-baseline gap-3 -mt-1">
            <span className="text-3xl lg:text-4xl font-bold tracking-tight text-white">
              {value}
            </span>
            
            {/* Delta Badge */}
            {growth !== undefined && (
              <span className={`inline-flex items-baseline text-xs font-semibold ${
                isIncreasing ? 'text-green-400' : 'text-red-400'
              }`} style={{ letterSpacing: '-0.02em' }}>
                <span className="mr-0">{isIncreasing ? '+' : '−'}</span>
                {formatNumber(Math.abs(growth))}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Graph Layer - 25% */}
      {sparklineData && sparklineData.length > 0 && (
        <div 
          className="relative w-full overflow-hidden z-10"
          style={{ 
            height: '25%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 100%)',
            borderBottomLeftRadius: '1rem',
            borderBottomRightRadius: '1rem'
          }}
        >
          {/* Atmospheric Gradient Overlay */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to top, ${strokeColor}15 0%, transparent 80%)`,
              mixBlendMode: 'soft-light'
            }}
          />

          {/* Line Chart */}
          <div className="absolute inset-0" style={{ padding: '0' }}>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={sparklineData}
                  margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
                >
                  <defs>
                    <linearGradient id={`gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={strokeColor} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={[0, 'auto']} hide={true} />
                  <Area
                    type="monotoneX"
                    dataKey="value"
                    stroke={strokeColor}
                    strokeWidth={2}
                    fill={`url(#gradient-${label})`}
                    isAnimationActive={false}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Portal Tooltip */}
      {tooltipData && createPortal(
        <div
          className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10"
          style={{
            position: 'fixed',
            left: `${tooltipData.x}px`,
            top: `${tooltipData.y + 20}px`,
            transform: 'translateX(-50%)',
            zIndex: 999999999,
            width: '350px',
            maxHeight: '500px',
            pointerEvents: 'auto',
            overflow: 'hidden'
          }}
        >
          <div className="px-5 py-4">
            {/* Date */}
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
              {formatDate(tooltipData.point.timestamp)}
            </p>
            
            {/* Value */}
            <p className="text-2xl text-white font-bold mb-4">
              {formatNumber(tooltipData.point.value)} clicks
            </p>

            {/* Links Clicked (up to 5) */}
            {tooltipData.point.clicks && tooltipData.point.clicks.length > 0 && (
              <div className="space-y-2 border-t border-white/10 pt-3">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                  Top Links ({tooltipData.point.clicks.length})
                </p>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {tooltipData.point.clicks.slice(0, 5).map((click, idx) => (
                    <div 
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onLinkClick && click.linkCode) {
                          onLinkClick(click.linkCode, new Date(tooltipData.point.timestamp), tooltipData.point.clicks || []);
                        }
                      }}
                      className="flex items-center gap-2 py-1.5 px-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate font-medium">
                          {click.linkCode}
                        </p>
                        {click.accountUsername && (
                          <p className="text-xs text-gray-500">
                            @{click.accountUsername}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        1 click
                      </span>
                    </div>
                  ))}
                </div>
                {tooltipData.point.clicks.length > 5 && (
                  <p className="text-xs text-gray-500 text-center pt-2">
                    +{tooltipData.point.clicks.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

