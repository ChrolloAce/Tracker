import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MiniTrendChartProps {
  data: number[];
  className?: string;
  label?: string;
}

export const MiniTrendChart: React.FC<MiniTrendChartProps> = ({ data, className = "", label }) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ index: number; value: number; x: number; y: number } | null>(null);
  if (!data || data.length < 2) {
    return (
      <div className={`w-8 h-4 flex items-center justify-center ${className}`}>
        <Minus className="w-3 h-3 text-gray-400" />
      </div>
    );
  }

  // Calculate trend direction
  const firstValue = data[0];
  const lastValue = data[data.length - 1];
  const isUpward = lastValue > firstValue;
  const isFlat = lastValue === firstValue;

  // Normalize data for SVG path
  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1; // Avoid division by zero

  const width = 32;
  const height = 16;
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - minValue) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  // Create area path for fill
  const areaPoints = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - minValue) / range) * height;
    return `${x},${y}`;
  });
  const areaPath = `M0,${height} L${areaPoints.join(' L')} L${width},${height} Z`;

  // Determine color based on trend
  const getColor = () => {
    if (isFlat) return 'text-gray-400';
    return isUpward ? 'text-green-500' : 'text-red-500';
  };

  const getGradientId = () => {
    if (isFlat) return 'gray-gradient';
    return isUpward ? 'green-gradient' : 'red-gradient';
  };

  const getIcon = () => {
    if (isFlat) return <Minus className="w-3 h-3" />;
    return isUpward ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />;
  };

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <div className="relative">
        <svg width={width} height={height} className="overflow-visible">
          <defs>
            <linearGradient id="green-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="red-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgb(239, 68, 68)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="rgb(239, 68, 68)" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="gray-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgb(156, 163, 175)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="rgb(156, 163, 175)" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          
          {/* Filled area */}
          <path
            d={areaPath}
            fill={`url(#${getGradientId()})`}
          />
          
          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={getColor()}
          />
          
          {/* Interactive dots at data points */}
          {data.map((value, index) => {
            const x = (index / (data.length - 1)) * width;
            const y = height - ((value - minValue) / range) * height;
            const isHovered = hoveredPoint?.index === index;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r={isHovered ? "2.5" : "1.5"}
                fill="currentColor"
                className={`${getColor()} cursor-pointer transition-all`}
                onMouseEnter={() => setHoveredPoint({ index, value, x, y })}
                onMouseLeave={() => setHoveredPoint(null)}
                style={{ filter: isHovered ? 'drop-shadow(0 0 4px currentColor)' : 'none' }}
              />
            );
          })}
        </svg>
        
        {/* Tooltip */}
        {hoveredPoint && (
          <div 
            className="absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg whitespace-nowrap pointer-events-none"
            style={{
              left: `${hoveredPoint.x + 8}px`,
              top: `${hoveredPoint.y - 24}px`,
            }}
          >
            {label || 'Value'}: {hoveredPoint.value.toLocaleString()}
          </div>
        )}
      </div>
      <div className={getColor()}>
        {getIcon()}
      </div>
    </div>
  );
};
