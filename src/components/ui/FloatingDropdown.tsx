import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface FloatingDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement>;
  children: React.ReactNode;
  align?: 'left' | 'right';
  offset?: number;
}

/**
 * FloatingDropdown - A dropdown that renders as a portal at the body level
 * This ensures it always floats above all other content, similar to KPI tooltips
 */
export const FloatingDropdown: React.FC<FloatingDropdownProps> = ({
  isOpen,
  onClose,
  triggerRef,
  children,
  align = 'right',
  offset = 8
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Update position when dropdown opens or window resizes/scrolls
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current || !dropdownRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const dropdownRect = dropdownRef.current.getBoundingClientRect();

      let left = 0;
      let top = triggerRect.bottom + offset;

      if (align === 'right') {
        // Align right edge of dropdown with right edge of trigger
        left = triggerRect.right - dropdownRect.width;
      } else {
        // Align left edge of dropdown with left edge of trigger
        left = triggerRect.left;
      }

      // Ensure dropdown stays within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust horizontal position if dropdown would overflow
      if (left + dropdownRect.width > viewportWidth - 16) {
        left = viewportWidth - dropdownRect.width - 16;
      }
      if (left < 16) {
        left = 16;
      }

      // Flip to top if dropdown would overflow bottom
      if (top + dropdownRect.height > viewportHeight - 16) {
        top = triggerRect.top - dropdownRect.height - offset;
      }

      setPosition({ top, left });
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
  }, [isOpen, triggerRef, align, offset]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9995]"
        onClick={onClose}
      />

      {/* Dropdown */}
      <div
        ref={dropdownRef}
        className="fixed z-[9996] w-56 bg-black border border-white/20 rounded-lg shadow-2xl py-1"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
};

// Dropdown menu item component for consistency
interface DropdownItemProps {
  icon?: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({
  icon,
  label,
  onClick,
  variant = 'default',
  disabled = false
}) => {
  const colorClass = variant === 'danger' 
    ? 'text-red-400 hover:bg-red-500/10'
    : 'text-gray-200 hover:bg-white/10';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-4 py-2 text-sm ${colorClass} flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {icon && <span className="w-4 h-4 flex items-center justify-center">{icon}</span>}
      <span>{label}</span>
    </button>
  );
};

// Dropdown divider component
export const DropdownDivider: React.FC = () => (
  <div className="my-1 border-t border-white/10" />
);

