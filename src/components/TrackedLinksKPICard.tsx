import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { LinkClick } from '../services/LinkClicksService';
import { LucideIcon, Link as LinkIcon, Eye, EyeOff } from 'lucide-react';
import { TrackedLink, TrackedAccount } from '../types/firestore';

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
  links?: TrackedLink[];
  accounts?: Map<string, TrackedAccount>;
  isCensored?: boolean;
  onToggleCensor?: () => void;
  onClick?: (date: Date, clicks: LinkClick[]) => void; // Click on card/graph point
  onLinkClick?: (shortCode: string, date: Date, clicks: LinkClick[]) => void; // Click on specific link in tooltip
  // Added props to match KPICard
  isEditMode?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
}

export const TrackedLinksKPICard: React.FC<TrackedLinksKPICardProps> = ({
  label,
  value,
  growth,
  isIncreasing,
  icon: Icon,
  sparklineData,
  links = [],
  accounts: _accounts = new Map(),
  isCensored = false,
  onToggleCensor,
  onClick,
  onLinkClick,
  isEditMode = false,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop
}) => {
  const [tooltipData, setTooltipData] = useState<{ x: number; y: number; point: SparklineDataPoint; lineX: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (timestamp: number): string => {
    // Align to start of day in local timezone for accurate date display
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const strokeColor = isIncreasing ? '#22c55e' : '#ef4444';

  const handleCardClick = () => {
    // Don't trigger click actions when in edit mode (dragging)
    if (isEditMode || !onClick) return;
    
    if (tooltipData) {
      // If hovering over a specific point, open modal for that day
      onClick(new Date(tooltipData.point.timestamp), tooltipData.point.clicks || []);
    } else if (sparklineData && sparklineData.length > 0) {
      // If clicking anywhere else on the card, show all links from all periods
      // Collect all clicks from all sparkline data points
      const allClicks = sparklineData.reduce((acc, point) => {
        if (point.clicks && point.clicks.length > 0) {
          acc.push(...point.clicks);
        }
        return acc;
      }, [] as LinkClick[]);
      
      // Use the most recent timestamp (last data point) as the reference date
      const mostRecentPoint = sparklineData[sparklineData.length - 1];
      onClick(new Date(mostRecentPoint.timestamp), allClicks);
    }
  };

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      onMouseMove={(e) => {
        // Disable tooltips when censored or in edit mode
        if (isCensored || isEditMode) return;
        
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setTooltipData(null);
      }}
      draggable={isEditMode}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`
        group relative rounded-2xl bg-zinc-900/60 backdrop-blur border shadow-lg transition-all duration-200
        will-change-transform
        ${isEditMode ? 'cursor-move' : 'cursor-pointer'}
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${isDragOver ? 'ring-2 ring-emerald-500 border-emerald-500/50' : 'border-white/5 hover:shadow-xl hover:ring-1 hover:ring-white/10'}
      `}
      style={{ transform: 'translateZ(0)', minHeight: '180px', overflow: 'visible' }}
    >
      {/* Background layers container with overflow clipping */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none z-0">
      {/* Depth Gradient Overlay */}
      <div 
          className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
        }}
      />
      </div>

      {/* Full-height vertical cursor line */}
      {tooltipData && (
        <div
          style={{
            position: 'absolute',
            left: `${tooltipData.lineX - 1}px`, // Offset by 1px (half of line width) to center on dot
            top: 0,
            bottom: 0,
            width: '2px',
            background: `linear-gradient(to bottom, ${strokeColor}00 0%, ${strokeColor}80 15%, ${strokeColor}60 50%, ${strokeColor}40 85%, ${strokeColor}00 100%)`,
            pointerEvents: 'none',
            zIndex: 50
          }}
        />
      )}

      {/* Drag Handle (edit mode only) - Centered at top, shows on hover */}
      {isEditMode && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-emerald-400 opacity-0 group-hover:opacity-60 transition-opacity duration-200 z-20">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      )}

      {/* Privacy Toggle - Eye icon (shows on hover, next to main icon) */}
      {isHovered && !isEditMode && onToggleCensor && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCensor();
          }}
          className="absolute top-3 sm:top-4 right-10 sm:right-12 p-1 hover:bg-white/10 rounded-lg transition-all duration-200 z-50"
          title={isCensored ? "Show data" : "Hide data"}
        >
          {isCensored ? (
            <EyeOff className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 hover:text-white" />
          ) : (
            <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 hover:text-white" />
          )}
        </button>
      )}

      {/* Censoring Overlay - Completely blurs card when active */}
      {isCensored && (
        <div className="absolute inset-0 rounded-2xl bg-black/95 backdrop-blur-[100px] flex items-center justify-center z-40 border border-white/10" style={{ backdropFilter: 'blur(100px)' }}>
          <div className="flex flex-col items-center gap-3">
            <EyeOff className="w-10 h-10 text-gray-400" />
            <p className="text-gray-400 text-sm font-medium">{label} Hidden</p>
          </div>
        </div>
      )}

      {/* Upper Solid Portion - 60% (reduced to give more space to graph) */}
      <div className="relative px-3 sm:px-4 md:px-5 pt-3 sm:pt-4 pb-2 z-10" style={{ height: '60%' }}>
        {/* Icon (top-right) */}
        <div className="absolute top-3 sm:top-4 right-3 sm:right-4">
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 opacity-60" />
        </div>

        {/* Metric Content - Pushed Higher */}
        <div className="flex flex-col h-full justify-start pt-1">
          {/* Label - Smaller */}
          <div className="text-[10px] sm:text-xs font-medium text-zinc-400 tracking-wide mb-1.5 sm:mb-2">
            {label}
          </div>

          {/* Value Row - Number + Delta Badge aligned horizontally */}
          <div className="flex items-baseline gap-2 sm:gap-3 -mt-1">
            <span className={`text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white`}>
              {value}
            </span>
            
            {/* Delta Badge (if exists) - Aligned with number baseline */}
            {growth !== undefined && (
              <span className={`inline-flex items-baseline text-[10px] sm:text-xs font-semibold ${
                isIncreasing ? 'text-green-400' : 'text-red-400'
              }`} style={{ letterSpacing: '-0.02em' }}>
                <span className="mr-0">{isIncreasing ? '+' : '−'}</span>
                {formatNumber(Math.abs(growth))}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Graph Layer - 40% (expanded for better visibility) */}
      {sparklineData && sparklineData.length > 0 && (
        <div 
          className="relative w-full overflow-hidden z-10"
          style={{ 
            height: '40%',
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

          {/* Line Chart - More vertical space for amplitude */}
          <div className="absolute inset-0" style={{ padding: '0' }}>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={sparklineData}
                  margin={{ top: 4, right: 0, bottom: 4, left: 0 }}
                >
                  <defs>
                    <linearGradient id={`bottom-gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
                      <stop offset="50%" stopColor={strokeColor} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {/* Y-axis with intelligent domain */}
                  <YAxis 
                    domain={[0, 'auto']} 
                    hide={true}
                  />
                  {/* Main Current Period Graph */}
                  <Area
                    type="monotoneX"
                    dataKey="value"
                    stroke={strokeColor}
                    strokeWidth={2.5}
                    fill={`url(#bottom-gradient-${label})`}
                    connectNulls={true}
                    dot={false}
                    activeDot={{ 
                      r: 3, 
                      fill: strokeColor, 
                      strokeWidth: 1.5, 
                      stroke: 'rgba(255, 255, 255, 0.3)',
                      style: { cursor: 'pointer' }
                    }}
                    isAnimationActive={true}
                    animationDuration={400}
                    animationEasing="ease-out"
                    animationBegin={0}
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

            {/* Links Clicked (grouped) */}
            {tooltipData.point.clicks && tooltipData.point.clicks.length > 0 && (() => {
              // Group clicks by shortCode
              const clickGroups = new Map<string, { 
                link: TrackedLink | null; 
                clicks: number;
                profilePicture?: string;
                accountHandle?: string;
              }>();
              
              tooltipData.point.clicks.forEach(click => {
                const shortCode = click.shortCode;
                if (!shortCode) return;
                
                if (!clickGroups.has(shortCode)) {
                  const link = links.find(l => l.shortCode === shortCode);
                  clickGroups.set(shortCode, { 
                    link: link || null, 
                    clicks: 0,
                    profilePicture: click.accountProfilePicture,
                    accountHandle: click.accountHandle
                  });
                }
                clickGroups.get(shortCode)!.clicks++;
              });
              
              // Sort by click count and take top 5
              const sortedGroups = Array.from(clickGroups.entries())
                .sort((a, b) => b[1].clicks - a[1].clicks)
                .slice(0, 5);
              
              return (
                <div className="space-y-1.5 border-t border-white/5 pt-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">
                    Links ({clickGroups.size})
                  </p>
                  <div className="space-y-1">
                    {sortedGroups.map(([shortCode, { link, clicks: clickCount, profilePicture, accountHandle }]) => {
                      return (
                        <div 
                          key={shortCode}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onLinkClick) {
                              onLinkClick(shortCode, new Date(tooltipData.point.timestamp), tooltipData.point.clicks || []);
                            }
                          }}
                          className="flex items-center gap-2 py-1.5 px-1.5 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                        >
                          {/* Creator Profile Picture or Link Icon */}
                          <div className="flex-shrink-0">
                            {profilePicture ? (
                              <img
                                src={profilePicture}
                                alt={accountHandle || 'User'}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                                <LinkIcon className="w-3 h-3 text-gray-500" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate">
                              {link?.title || `/${shortCode}`}
                            </p>
                            {accountHandle && (
                              <p className="text-[10px] text-gray-500 truncate">
                                @{accountHandle}
                              </p>
                            )}
                          </div>
                          
                          <span className="text-xs text-gray-400 font-medium">
                            {clickCount}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {clickGroups.size > 5 && (
                    <p className="text-xs text-gray-500 text-center pt-1">
                      +{clickGroups.size - 5} more
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

