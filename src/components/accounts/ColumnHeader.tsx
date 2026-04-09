import React, { useState } from 'react';
import { createPortal } from 'react-dom';

export const ColumnHeader: React.FC<{
  label: string;
  tooltip: string;
  sortable?: boolean;
  sortKey?: string;
  currentSortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: () => void;
  sticky?: boolean;
}> = ({ label, tooltip, sortable, sortKey, currentSortBy, sortOrder, onSort, sticky }) => {
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseLeave = () => {
    setTooltipPosition(null);
  };
  
  return (
    <>
      <th 
        className={`px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-content-muted uppercase tracking-wider ${sortable ? 'cursor-pointer hover:bg-surface-hover transition-colors' : ''} ${sticky ? 'sticky left-0 bg-surface-secondary backdrop-blur z-20' : ''}`}
        onClick={sortable ? onSort : undefined}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {sortable && currentSortBy === sortKey && (
            <span className="text-content">
              {sortOrder === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
      </th>
      
      {/* Tooltip portal - follows mouse cursor */}
      {tooltipPosition && createPortal(
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y + 20}px`,
            transform: 'translateX(-50%)',
            maxWidth: '320px',
            width: 'max-content'
          }}
        >
          <div 
            className="bg-surface backdrop-blur-xl text-content rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-border p-3"
            style={{
              maxWidth: '320px',
              width: 'max-content'
            }}
          >
            <div className="text-xs text-content-muted leading-relaxed whitespace-normal">
              {tooltip}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

