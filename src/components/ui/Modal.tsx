import React from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal - Dark theme with max constraints to prevent overflow */}
        <div 
          className={clsx(
            'relative w-full max-w-2xl max-h-[85vh] transform overflow-hidden rounded-2xl bg-surface border border-border p-6 shadow-2xl transition-all',
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
            <h3 className="text-xl font-bold text-content">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-content-muted hover:text-content hover:bg-surface-active transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(85vh-8rem)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
