import React from 'react';
import { X, Zap, LineChart, Bell, Sparkles } from 'lucide-react';

interface ExtensionPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExtensionPromoModal: React.FC<ExtensionPromoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-white/10"
        style={{ backgroundColor: '#121214' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center pt-6 pb-4 px-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-500/10 rounded-xl border border-emerald-500/20 mb-3">
            <Zap className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Viewtrack Extension
          </h2>
          <p className="text-sm text-gray-400">
            Supercharge your workflow with instant analytics
          </p>
        </div>

        {/* Video Section */}
        <div className="px-6 pb-4">
          <div className="relative w-full bg-black/50 rounded-xl overflow-hidden border border-white/5">
            {/* Placeholder for video - replace with your actual video */}
            <div className="aspect-video bg-gradient-to-br from-zinc-900/50 via-zinc-800/50 to-zinc-900/50 flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/10 rounded-xl border border-emerald-500/20 mb-3">
                  <Sparkles className="w-7 h-7 text-emerald-400 animate-pulse" />
                </div>
                <p className="text-white text-base font-medium mb-1">Extension Demo</p>
                <p className="text-gray-500 text-xs">Video coming soon</p>
              </div>
            </div>
            
            {/* If you have a video URL, uncomment this:
            <video 
              className="w-full h-full"
              controls
              autoPlay
              muted
              loop
              poster="/path/to/thumbnail.jpg"
            >
              <source src="/path/to/your/video.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            */}
          </div>
        </div>

        {/* Features Grid */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {/* Feature 1 */}
            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <h3 className="text-white text-sm font-semibold">Real-time</h3>
              </div>
              <p className="text-gray-400 text-xs">Monitor instantly</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <LineChart className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <h3 className="text-white text-sm font-semibold">Analytics</h3>
              </div>
              <p className="text-gray-400 text-xs">Deep insights</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Bell className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <h3 className="text-white text-sm font-semibold">Notifications</h3>
              </div>
              <p className="text-gray-400 text-xs">Stay updated</p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <h3 className="text-white text-sm font-semibold">AI-Powered</h3>
              </div>
              <p className="text-gray-400 text-xs">Smart trends</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="border-t border-white/5 px-6 py-4 text-center">
          <button
            onClick={() => {
              // Replace with your actual Chrome Web Store URL
              window.open('https://chrome.google.com/webstore', '_blank');
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm5.564 15.434l-3.354-1.933L9.562 15.3l3.655-6.309 1.765 3.054 3.36 1.936-1.778 3.453z"/>
            </svg>
            Add to Chrome - It's Free
          </button>
          <p className="text-gray-500 text-xs mt-3">
            Available for Chrome & Edge browsers
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExtensionPromoModal;

