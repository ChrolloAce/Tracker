import React, { useEffect, useRef, useState } from 'react';
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
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  // Update position when tooltip becomes visible or window resizes/scrolls
  useEffect(() => {
    if (!isVisible || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current || !tooltipRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      let top = 0;
      let left = 0;

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

      // Ensure tooltip stays within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust horizontal position if tooltip would overflow
      if (left + tooltipRect.width > viewportWidth - 16) {
        left = viewportWidth - tooltipRect.width - 16;
      }
      if (left < 16) {
        left = 16;
      }

      // Flip vertical position if tooltip would overflow
      if (position === 'top' && top < 16) {
        // Flip to bottom
        top = triggerRect.bottom + offset;
      } else if (position === 'bottom' && top + tooltipRect.height > viewportHeight - 16) {
        // Flip to top
        top = triggerRect.top - tooltipRect.height - offset;
      }

      // Ensure tooltip doesn't go off screen vertically
      if (top < 16) {
        top = 16;
      }
      if (top + tooltipRect.height > viewportHeight - 16) {
        top = viewportHeight - tooltipRect.height - 16;
      }

      setCoords({ top, left });
    };

    // Initial position
    updatePosition();

    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isVisible, triggerRef, position, offset]);

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
      <div className="bg-black border border-white/20 rounded-lg p-3 shadow-2xl text-xs">
        {children}
      </div>
    </div>,
    document.body
  );
};

