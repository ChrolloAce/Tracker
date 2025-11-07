import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';

interface ErrorIndicatorProps {
  errorMessage: string;
  errorTimestamp?: Date;
  onDismiss?: () => void;
  showInline?: boolean;
}

export function ErrorIndicator({ errorMessage, errorTimestamp, onDismiss, showInline = false }: ErrorIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (showInline) {
    // Inline error display (for account/video cards)
    return (
      <div className="relative">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="relative flex items-center justify-center w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 transition-colors animate-pulse"
          title="Error - Click for details"
        >
          <AlertCircle className="w-3 h-3 text-white" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-600 rounded-full animate-ping" />
        </button>

        {showDetails && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
              onClick={() => setShowDetails(false)}
            />
            
            {/* Error Modal */}
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[9999]">
              <div className="bg-zinc-900 rounded-lg border border-red-500/30 shadow-2xl p-6 mx-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/20">
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Error Occurred</h3>
                      {errorTimestamp && (
                        <p className="text-sm text-white/50 mt-0.5">
                          {errorTimestamp.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-white/70" />
                  </button>
                </div>

                {/* Error Message */}
                <div className="bg-zinc-950/50 border border-red-500/20 rounded-lg p-4 mb-4">
                  <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap break-words">
                    {errorMessage}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowDetails(false);
                      onDismiss?.();
                    }}
                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors font-medium"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
                  >
                    Retry
                  </button>
                </div>

                {/* Help Text */}
                <p className="text-xs text-white/40 text-center mt-4">
                  Admin has been notified. The issue will be investigated.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Badge error indicator (for table rows)
  return (
    <button
      onClick={() => setShowDetails(!showDetails)}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors text-red-400 text-xs font-medium"
      title={errorMessage}
    >
      <AlertCircle className="w-3 h-3" />
      <span>Error</span>
      {showDetails && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
          onClick={(e) => {
            e.stopPropagation();
            setShowDetails(false);
          }}
        />
      )}
    </button>
  );
}

