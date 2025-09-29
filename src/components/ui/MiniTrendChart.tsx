import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MiniTrendChartProps {
  data: number[];
  className?: string;
}

export const MiniTrendChart: React.FC<MiniTrendChartProps> = ({ data, className = "" }) => {
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

  // Determine color based on trend
  const getColor = () => {
    if (isFlat) return 'text-gray-400';
    return isUpward ? 'text-green-500' : 'text-red-500';
  };

  const getIcon = () => {
    if (isFlat) return <Minus className="w-3 h-3" />;
    return isUpward ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />;
  };

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <div className="relative">
        <svg width={width} height={height} className="overflow-visible">
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={getColor()}
          />
          {/* Add dots at data points */}
          {data.map((value, index) => {
            const x = (index / (data.length - 1)) * width;
            const y = height - ((value - minValue) / range) * height;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="1"
                fill="currentColor"
                className={getColor()}
              />
            );
          })}
        </svg>
      </div>
      <div className={getColor()}>
        {getIcon()}
      </div>
    </div>
  );
};
