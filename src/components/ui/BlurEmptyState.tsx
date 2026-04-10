import React, { useState, lazy, Suspense } from 'react';
import { Info, LucideIcon } from 'lucide-react';

// Lazy load Lottie component
const LottieComponent = lazy(() => import('lottie-react'));

interface BlurEmptyStateAction {
  label: string;
  onClick: () => void;
  icon: LucideIcon;
  primary?: boolean;
  disabled?: boolean;
}

interface BlurEmptyStateProps {
  title: string;
  description: string;
  actions?: BlurEmptyStateAction[];
  animation?: any; // Lottie animation JSON
  tooltipText?: string;
}

export const BlurEmptyState: React.FC<BlurEmptyStateProps> = ({
  title,
  description,
  actions = [],
  animation,
  tooltipText
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="flex items-center justify-center min-h-[400px] py-8">
      <div className="relative">
        {/* Transparent gradient background with blur */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-white/[0.02] to-transparent backdrop-blur-xl rounded-2xl border border-border"></div>
        
        {/* Subtle glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-orange-500/3 rounded-2xl opacity-50"></div>
        
        {/* Content */}
        <div className="relative max-w-xl mx-auto text-center px-8 py-12">
          {/* Animation or Icon */}
          {animation && (
            <div className="w-48 h-48 mx-auto mb-4">
              <Suspense fallback={<div className="w-full h-full" />}>
                <LottieComponent animationData={animation} loop={true} />
              </Suspense>
            </div>
          )}

          {/* Title with Info Tooltip */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <h3 className="text-xl md:text-2xl font-bold text-content">
              {title}
            </h3>
            
            {tooltipText && (
              <div className="relative">
                <button
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="w-5 h-5 rounded-full bg-orange-500/20 hover:bg-orange-500/30 flex items-center justify-center transition-colors"
                >
                  <Info className="w-3.5 h-3.5 text-orange-500" />
                </button>
                
                {showTooltip && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-surface backdrop-blur-xl border border-border-hover rounded-lg shadow-xl p-3 z-50 animate-fade-in">
                    <div className="text-xs text-content-muted text-left">
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
          <p className="text-sm text-content-muted mb-6 max-w-sm mx-auto">
            {description}
          </p>

          {/* Action Buttons */}
          {actions.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {actions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <button
                    key={index}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={`
                      flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all
                      ${action.disabled
                        ? 'bg-surface-secondary text-content-muted border border-border cursor-not-allowed opacity-60'
                        : action.primary
                        ? 'bg-orange-500 text-white shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px]'
                        : 'bg-surface-secondary text-content border border-border shadow-[0_2px_0_0_var(--border)] hover:shadow-[0_1px_0_0_var(--border)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px]'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}
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

