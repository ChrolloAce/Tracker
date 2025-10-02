import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from 'clsx';

export type OutlierLevel = 'normal' | 'moderate' | 'high';
export type OutlierDirection = 'up' | 'down' | 'flat';

interface OutlierBadgeProps {
  level: OutlierLevel;
  direction: OutlierDirection;
  zScore?: number;
  percentageDiff?: number;
  showTooltip?: boolean;
  labelText?: string;
}

/**
 * OutlierBadge Component
 * Displays a visual indicator for video performance outliers
 * 
 * Levels:
 * - Normal: |z-score| < 1.5 (within 1.5 standard deviations)
 * - Moderate: 1.5 <= |z-score| < 2.5 (1.5 to 2.5 standard deviations)
 * - High: |z-score| >= 2.5 (more than 2.5 standard deviations)
 */
export const OutlierBadge: React.FC<OutlierBadgeProps> = ({
  level,
  direction,
  zScore,
  percentageDiff,
  showTooltip = true,
  labelText,
}) => {
  const getStyles = () => {
    if (level === 'normal') {
      return {
        container: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
        icon: Minus,
        label: 'Normal',
      };
    }

    if (direction === 'up') {
      return {
        container: level === 'high' 
          ? 'bg-green-500/15 text-green-400 border-green-500/30' 
          : 'bg-green-500/10 text-green-400 border-green-500/20',
        icon: TrendingUp,
        label: level === 'high' ? 'High Spike' : 'Moderate Spike',
      };
    }

    return {
      container: level === 'high'
        ? 'bg-red-500/15 text-red-400 border-red-500/30'
        : 'bg-red-500/10 text-red-400 border-red-500/20',
      icon: TrendingDown,
      label: level === 'high' ? 'High Drop' : 'Moderate Drop',
    };
  };

  const styles = getStyles();
  const Icon = styles.icon;

  const tooltipText = () => {
    if (!showTooltip || level === 'normal') return null;
    
    const parts = [];
    if (zScore !== undefined) {
      parts.push(`${Math.abs(zScore).toFixed(2)}σ ${direction === 'up' ? 'above' : 'below'} average`);
    }
    if (percentageDiff !== undefined) {
      const sign = direction === 'up' ? '+' : '';
      parts.push(`${sign}${percentageDiff.toFixed(0)}% vs median`);
    }
    return parts.join(' • ');
  };

  const tooltip = tooltipText();

  return (
    <div className="relative group">
      <div
        className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
          styles.container
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{labelText ?? styles.label}</span>
      </div>
      
      {tooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          {tooltip}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

/**
 * Calculate outlier level and direction from video metrics
 */
export const calculateOutlierStatus = (
  videoValue: number,
  accountMedian: number,
  accountStd: number
): { level: OutlierLevel; direction: OutlierDirection; zScore: number; percentageDiff: number } => {
  if (accountStd === 0 || accountMedian === 0) {
    return { level: 'normal', direction: 'flat', zScore: 0, percentageDiff: 0 };
  }

  const diff = videoValue - accountMedian;
  const zScore = diff / accountStd;
  const percentageDiff = ((videoValue - accountMedian) / accountMedian) * 100;

  let level: OutlierLevel;
  const absZScore = Math.abs(zScore);
  
  if (absZScore < 1.5) {
    level = 'normal';
  } else if (absZScore < 2.5) {
    level = 'moderate';
  } else {
    level = 'high';
  }

  const direction: OutlierDirection = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';

  return { level, direction, zScore, percentageDiff };
};

