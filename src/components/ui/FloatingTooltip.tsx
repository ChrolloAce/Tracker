import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface FloatingTooltipProps {
  isVisible: boolean;
  triggerRef: React.RefObject<HTMLElement>;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
}

/**
 * FloatingTooltip - A tooltip that renders as a portal at the body level
 * This ensures it always floats above all other content, never clipped by overflow
 */
export const FloatingTooltip: React.FC<FloatingTooltipProps> = ({
  isVisible,
  triggerRef,
  children,
  position = 'top',
  offset = 8
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: -9999, left: -9999 });
  const rafRef = useRef<number>(0);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = 0;
    let left = 0;

    // Calculate preferred position
    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - offset;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + offset;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - offset;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + offset;
        break;
    }

    // Auto-flip if off screen
    if (position === 'top' && top < 8) {
      top = triggerRect.bottom + offset;
    } else if (position === 'bottom' && top + tooltipRect.height > vh - 8) {
      top = triggerRect.top - tooltipRect.height - offset;
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, vw - tooltipRect.width - 8));
    top = Math.max(8, Math.min(top, vh - tooltipRect.height - 8));

    setCoords({ top, left });
  }, [triggerRef, position, offset]);

  useEffect(() => {
    if (!isVisible) return;

    // Position immediately + after render for accurate tooltip size
    updatePosition();
    rafRef.current = requestAnimationFrame(() => {
      updatePosition();
      // Second RAF to ensure paint is complete
      rafRef.current = requestAnimationFrame(updatePosition);
    });

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updatePosition);
    };

    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [isVisible, updatePosition]);

  if (!isVisible) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      className="fixed z-[9997] pointer-events-none"
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
      }}
    >
      <div className="bg-black border border-white/20 rounded-lg p-3 shadow-2xl text-xs max-w-xs">
        {children}
      </div>
    </div>,
    document.body
  );
};
