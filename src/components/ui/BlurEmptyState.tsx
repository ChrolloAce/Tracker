import React, { useState } from 'react';
import { Info, LucideIcon } from 'lucide-react';
import Lottie from 'lottie-react';

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
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-white/[0.02] to-transparent backdrop-blur-xl rounded-2xl border border-white/10"></div>
        
        {/* Subtle glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5 rounded-2xl opacity-50"></div>
        
        {/* Content */}
        <div className="relative max-w-xl mx-auto text-center px-8 py-12">
          {/* Animation or Icon */}
          {animation && (
            <div className="w-48 h-48 mx-auto mb-4">
              <Lottie animationData={animation} loop={true} />
            </div>
          )}

          {/* Title with Info Tooltip */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <h3 className="text-xl md:text-2xl font-bold text-white">
              {title}
            </h3>
            
            {tooltipText && (
              <div className="relative">
                <button
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="w-5 h-5 rounded-full bg-blue-500/20 hover:bg-blue-500/30 flex items-center justify-center transition-colors"
                >
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                </button>
                
                {showTooltip && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-gray-900/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-xl p-3 z-50 animate-fade-in">
                    <div className="text-xs text-gray-300 text-left">
                      {tooltipText}
                    </div>
                    {/* Arrow */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-gray-900/95 border-l border-t border-white/20 rotate-45"></div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
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
                      flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all
                      ${action.disabled 
                        ? 'bg-gray-700/50 text-gray-400 border border-gray-700 cursor-not-allowed opacity-60' 
                        : `transform hover:scale-105 active:scale-95 ${action.primary 
                        ? 'bg-white/10 hover:bg-white/15 text-white border border-white/20 hover:border-white/30' 
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 hover:border-white/20'
                        }`
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

