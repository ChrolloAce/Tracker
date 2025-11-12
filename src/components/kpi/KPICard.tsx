import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { VideoSubmission } from '../../types';
import { LinkClick } from '../../services/LinkClicksService';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { DateFilterType } from '../DateRangeFilter';
import { TimePeriodType } from '../TimePeriodSelector';
import { TimeInterval } from '../../services/DataAggregationService';
import { AnimatedNumber } from './AnimatedNumber';
import { KPICardData } from './kpiTypes';
import { KPICardTooltip } from './KPICardTooltip';

export interface KPICardProps {
  data: KPICardData;
  onClick?: () => void;
  onIntervalHover?: (interval: TimeInterval | null) => void;
  timePeriod?: TimePeriodType;
  submissions?: VideoSubmission[];
  linkClicks?: LinkClick[];
  dateFilter?: DateFilterType;
  customRange?: { startDate: Date; endDate: Date };
  isEditMode?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  isCensored?: boolean;
  onToggleCensor?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
}

/**
 * KPICard Component
 * Individual KPI card with sparkline and interactive tooltip
 */

const KPICard: React.FC<{ 
  data: KPICardData; 
  onClick?: () => void;
  onIntervalHover?: (interval: TimeInterval | null) => void;
  timePeriod?: TimePeriodType;
  submissions?: VideoSubmission[];
  linkClicks?: LinkClick[];
  dateFilter?: DateFilterType;
  customRange?: { startDate: Date; endDate: Date };
  isEditMode?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  isCensored?: boolean;
  onToggleCensor?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
}> = ({ 
  data, 
  onClick, 
  onIntervalHover, 
  submissions = [], 
  linkClicks = [],
  dateFilter = 'all',
  customRange,
  isEditMode = false,
  isDragging = false,
  isDragOver = false,
  isCensored = false,
  onToggleCensor,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop
}) => {
  // Tooltip state for Portal rendering
  const [tooltipData, setTooltipData] = useState<{ x: number; y: number; point: any; lineX: number } | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [isHovered, setIsHovered] = useState(false);
  
  // Auto-close tooltip when mouse is outside the card
  React.useEffect(() => {
    if (!tooltipData) return;
    
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!cardRef.current) return;
      
      const rect = cardRef.current.getBoundingClientRect();
      const isOutside = 
        e.clientX < rect.left || 
        e.clientX > rect.right || 
        e.clientY < rect.top || 
        e.clientY > rect.bottom;
      
      if (isOutside) {
        setTooltipData(null);
        if (onIntervalHover) onIntervalHover(null);
        
        // Force clear any lingering recharts tooltips
        const tooltips = document.querySelectorAll('[class*="recharts-tooltip-wrapper"]');
        tooltips.forEach(tooltip => {
          if (tooltip instanceof HTMLElement) {
            tooltip.style.display = 'none';
          }
        });
      }
    };
    
    document.addEventListener('mousemove', handleGlobalMouseMove);
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [tooltipData, onIntervalHover]);
  
  const formatDeltaNumber = (num: number, isRevenue: boolean = false): string => {
    const absNum = Math.abs(num);
    if (absNum >= 1000000) return `${(absNum / 1000000).toFixed(1)}M`;
    if (absNum >= 1000) return `${(absNum / 1000).toFixed(1)}K`;
    // For revenue, format to 2 decimal places; for counts, use whole number
    if (isRevenue) return `$${absNum.toFixed(2)}`;
    return Math.round(absNum).toString();
  };

  // Determine colors based on trend (green for increase, red for decrease)
  const isIncreasing = data.isIncreasing !== undefined ? data.isIncreasing : true;
  const colors = {
    icon: 'bg-white/5',
    iconColor: 'text-white',
    gradient: isIncreasing ? ['#22c55e', '#22c55e00'] : ['#ef4444', '#ef444400'], // green-500 : red-500
    stroke: isIncreasing ? '#22c55e' : '#ef4444',
    deltaBg: 'bg-white/10 text-white'
  };

  const Icon = data.icon;

  return (
    <div 
      ref={cardRef}
      onClick={onClick}
      onMouseMove={(e) => {
        // Disable tooltips in edit mode or when censored
        if (isEditMode || isCensored) return;
        
        if (!data.sparklineData || data.sparklineData.length === 0 || !cardRef.current) return;
        
        const cardRect = cardRef.current.getBoundingClientRect();
        
        // Calculate X position within the card
        const x = e.clientX - cardRect.left;
        const percentage = x / cardRect.width;
        
        // Clamp percentage between 0 and 1
        const clampedPercentage = Math.max(0, Math.min(1, percentage));
        
        // Get nearest data point
        const dataIndex = Math.max(0, Math.min(
          data.sparklineData.length - 1,
          Math.round(clampedPercentage * (data.sparklineData.length - 1))
        ));
        
        const point = data.sparklineData[dataIndex];
        
        if (point) {
          // Calculate the SNAPPED X position based on the actual data point index
          const snappedPercentage = dataIndex / (data.sparklineData.length - 1);
          const snappedLineX = snappedPercentage * cardRect.width;
          
          setTooltipData({
            x: e.clientX,
            y: e.clientY,
            point: point,
            lineX: snappedLineX // Snapped to data point, not mouse position
          });
          
          // Store the hovered interval so handleCardClick knows the full timeframe
          if (point.interval && onIntervalHover) {
            onIntervalHover(point.interval);
          }
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        // Clear tooltip state
        setTooltipData(null);
        if (onIntervalHover) onIntervalHover(null);
        
        // Force clear any lingering recharts tooltips
        setTimeout(() => {
          const tooltips = document.querySelectorAll('[class*="recharts-tooltip-wrapper"]');
          tooltips.forEach(tooltip => {
            if (tooltip instanceof HTMLElement) {
              tooltip.style.display = 'none';
            }
          });
        }, 50);
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
            background: `linear-gradient(to bottom, ${colors.stroke}00 0%, ${colors.stroke}80 15%, ${colors.stroke}60 50%, ${colors.stroke}40 85%, ${colors.stroke}00 100%)`,
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
            <p className="text-gray-400 text-sm font-medium">{data.label} Hidden</p>
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
            {data.label}
          </div>

          {/* Value Row - Number + Delta Badge aligned horizontally */}
          <div className="flex items-baseline gap-2 sm:gap-3 -mt-1">
            <AnimatedNumber 
              value={data.value} 
              className={`text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight ${data.isEmpty ? 'text-zinc-600' : 'text-white'}`}
            />
            
            {/* Delta Badge (if exists) - Aligned with number baseline */}
            {data.delta && data.delta.absoluteValue !== undefined && (
              <span className={`inline-flex items-baseline text-[10px] sm:text-xs font-semibold ${
                data.delta.isPositive ? 'text-green-400' : 'text-red-400'
              }`} style={{ letterSpacing: '-0.02em' }}>
                <span className="mr-0">{data.delta.isPositive ? '+' : '−'}</span>
            {data.delta.isPercentage 
                  ? `${Math.abs(data.delta.absoluteValue).toFixed(1)}%`
              : formatDeltaNumber(data.delta.absoluteValue, data.id === 'revenue')}
          </span>
            )}
        </div>

          {/* Period/Subtitle */}
          {data.period && (
            <span className="text-[10px] sm:text-xs text-zinc-500 mt-1 sm:mt-1.5 flex items-center gap-1">
              <span className="inline-block w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-zinc-700"></span>
              {data.period}
            </span>
          )}
        </div>

        {/* CTA Button (if exists) */}
      {!data.delta && data.ctaText && (
          <button className="absolute bottom-2 sm:bottom-3 right-3 sm:right-5 inline-flex items-center gap-0.5 rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs text-zinc-400 bg-white/5 hover:bg-white/10 transition-colors">
          {data.ctaText}
          <ChevronRight className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
        </button>
      )}
      </div>

      {/* Bottom Graph Layer - 40% (expanded for better visibility) */}
      {data.sparklineData && data.sparklineData.length > 0 && (
        <div 
          className="relative w-full overflow-hidden z-10"
          style={{ 
            height: '40%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 100%)',
            borderBottomLeftRadius: '1rem',
            borderBottomRightRadius: '1rem'
          }}
          onMouseLeave={() => {
            // Force clear any lingering tooltips when mouse leaves chart area
            const tooltips = document.querySelectorAll('[class*="recharts-tooltip-wrapper"]');
            tooltips.forEach(tooltip => {
              if (tooltip instanceof HTMLElement) {
                tooltip.style.display = 'none';
              }
            });
          }}
        >
          {/* Atmospheric Gradient Overlay */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to top, ${colors.stroke}15 0%, transparent 80%)`,
              mixBlendMode: 'soft-light'
            }}
          />
          
          {/* Line Chart - More vertical space for amplitude */}
          <div className="absolute inset-0" style={{ padding: '0' }}>
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                {(() => {
                 // Note: Single data points are already padded by generateSparklineData
                 // so data.sparklineData.length should never be 1 for today view
                 // All sparklines render as lines for consistent aesthetic
                 
                 let chartData = data.sparklineData;
                 let yMax = 1;
                 
                 {
                   // Calculate intelligent Y-axis domain with outlier capping
                   const values = data.sparklineData.map(d => d.value).filter((v): v is number => typeof v === 'number');
                   const ppValues = data.sparklineData.map(d => d.ppValue).filter((v): v is number => typeof v === 'number' && v > 0);
                   const allValues: number[] = [...values, ...ppValues];
                   
                   if (allValues.length === 0) {
                     return null;
                   }
                   
                   // Sort to find statistics
                   const sortedValues = [...allValues].sort((a, b) => a - b);
                   const max = sortedValues[sortedValues.length - 1] || 1;
                   const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)] || 1;
                   
                   // Cap outliers: if max is more than 5x the Q3, cap at 2x Q3
                   yMax = max;
                   if (max > q3 * 5 && q3 > 0) {
                     yMax = q3 * 2;
                   }
                 }
                 
                 // Check if PP data exists
                 const hasPPData = chartData.some(d => typeof d.ppValue === 'number' && d.ppValue !== undefined);
                 
                 return (
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart 
                       data={chartData}
                       margin={{ top: 4, right: 0, bottom: 4, left: 0 }}
                     >
                      <defs>
                        <linearGradient id={`bottom-gradient-${data.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.3} />
                          <stop offset="50%" stopColor={colors.stroke} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={colors.stroke} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id={`pp-gradient-${data.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.08} />
                          <stop offset="100%" stopColor={colors.stroke} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      {/* Y-axis with intelligent domain */}
                      <YAxis 
                        domain={[0, yMax]} 
                        hide={true}
                      />
                      {/* PP (Previous Period) Ghost Graph - rendered first so it's behind */}
                      {hasPPData && (
                        <Area
                          type="monotoneX"
                          dataKey="ppValue"
                          stroke="rgb(156, 163, 175)"
                          strokeWidth={1.5}
                          strokeOpacity={0.15}
                          fill="none"
                          dot={false}
                          isAnimationActive={true}
                          animationDuration={400}
                          animationEasing="ease-out"
                          animationBegin={0}
                        />
                      )}
                      {/* Main Current Period Graph */}
                      <Area
                        type="monotoneX"
                        dataKey="value"
                        stroke={colors.stroke}
                        strokeWidth={2.5}
                        fill={`url(#bottom-gradient-${data.id})`}
                        connectNulls={true}
                        dot={false}
                        activeDot={{ 
                          r: 3, 
                          fill: colors.stroke, 
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
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Fallback if no sparkline data */}
      {(!data.sparklineData || data.sparklineData.length === 0) && (
        <div 
          className="relative w-full overflow-hidden"
          style={{ 
            height: '40%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.2) 0%, transparent 100%)',
            borderBottomLeftRadius: '1rem',
            borderBottomRightRadius: '1rem'
          }}
        />
      )}

      {/* Portal Tooltip */}
      {tooltipData && (
        <KPICardTooltip
          tooltipData={tooltipData}
          data={data}
          submissions={submissions}
          linkClicks={linkClicks}
          dateFilter={dateFilter}
          customRange={customRange}
          imageErrors={imageErrors}
          setImageErrors={setImageErrors}
        />
      )}
    </div>
  );
};

export default KPICard;
