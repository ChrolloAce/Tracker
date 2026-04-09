import React, { useState, lazy, Suspense } from 'react';
import { Info, LucideIcon } from 'lucide-react';

// Lazy load Lottie component
const LottieComponent = lazy(() => import('lottie-react'));

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon: LucideIcon;
  primary?: boolean;
}

interface EmptyStateProps {
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  animation?: any; // Lottie animation JSON
  tooltipText?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actions = [],
  animation,
  tooltipText
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="flex items-center justify-center min-h-[500px] py-12">
      <div className="max-w-2xl mx-auto text-center px-6">
        {/* Animation or Icon */}
        {animation && (
          <div className="w-64 h-64 mx-auto mb-6">
            <Suspense fallback={<div className="w-full h-full" />}>
              <LottieComponent animationData={animation} loop={true} />
            </Suspense>
          </div>
        )}

        {/* Title with Info Tooltip */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <h3 className="text-2xl md:text-3xl font-bold text-content">
            {title}
          </h3>
          
          {tooltipText && (
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="w-6 h-6 rounded-full bg-blue-500/20 hover:bg-blue-500/30 flex items-center justify-center transition-colors"
              >
                <Info className="w-4 h-4 text-blue-400" />
              </button>
              
              {showTooltip && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-surface border border-border-hover rounded-lg shadow-xl p-4 z-50 animate-fade-in">
                  <div className="text-sm text-content-muted text-left">
                    {tooltipText}
                  </div>
                  {/* Arrow */}
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-surface border-l border-t border-border-hover rotate-45"></div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-lg text-content-muted mb-8 max-w-md mx-auto">
          {description}
        </p>

        {/* Action Buttons */}
        {actions.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-4">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`
                    flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold transition-all transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl
                    ${action.primary 
                      ? 'bg-surface-active hover:bg-surface-active text-content border border-border-hover hover:border-border-hover'
                      : 'bg-surface-hover hover:bg-surface-active text-content-muted hover:text-content border border-border hover:border-border-hover'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {action.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Decorative gradient */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] animate-pulse"></div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

