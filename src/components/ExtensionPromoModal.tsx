import React from 'react';
import { X, Zap, LineChart, Bell, Sparkles } from 'lucide-react';

interface ExtensionPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExtensionPromoModal: React.FC<ExtensionPromoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-emerald-500/20">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Header */}
        <div className="text-center pt-8 pb-6 px-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-full border-2 border-emerald-500/30 mb-4">
            <Zap className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            Viewtrack Extension in Action
          </h2>
          <p className="text-gray-400">
            Never miss important insights and data updates
          </p>
        </div>

        {/* Video Section */}
        <div className="px-8 pb-6">
          <div className="relative w-full bg-black rounded-xl overflow-hidden border border-emerald-500/20 shadow-xl">
            {/* Placeholder for video - replace with your actual video */}
            <div className="aspect-video bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/20 rounded-full mb-4">
                  <Sparkles className="w-10 h-10 text-emerald-400 animate-pulse" />
                </div>
                <p className="text-white text-lg font-medium mb-2">Extension Demo Video</p>
                <p className="text-gray-400 text-sm">Coming soon - Your extension showcase will appear here</p>
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
        <div className="px-8 pb-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Feature 1 */}
            <div className="bg-zinc-800/50 rounded-xl p-4 border border-emerald-500/10">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Real-time Tracking</h3>
                  <p className="text-gray-400 text-sm">Monitor your content performance instantly</p>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-zinc-800/50 rounded-xl p-4 border border-emerald-500/10">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <LineChart className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Deep Analytics</h3>
                  <p className="text-gray-400 text-sm">Comprehensive insights and metrics</p>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-zinc-800/50 rounded-xl p-4 border border-emerald-500/10">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <Bell className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Smart Notifications</h3>
                  <p className="text-gray-400 text-sm">Get alerted on important updates</p>
                </div>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="bg-zinc-800/50 rounded-xl p-4 border border-emerald-500/10">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">AI-Powered Insights</h3>
                  <p className="text-gray-400 text-sm">Smart recommendations and trends</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-8 py-6 text-center">
          <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <Zap className="w-6 h-6" />
            Supercharge Your Analytics
            <Zap className="w-6 h-6" />
          </h3>
          <p className="text-white/90 mb-6">
            Get instant access with our powerful browser extension
          </p>
          <button
            onClick={() => {
              // Replace with your actual Chrome Web Store URL
              window.open('https://chrome.google.com/webstore', '_blank');
            }}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-gray-100 text-emerald-600 font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm5.564 15.434l-3.354-1.933L9.562 15.3l3.655-6.309 1.765 3.054 3.36 1.936-1.778 3.453z"/>
            </svg>
            Add to Chrome - It's Free
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExtensionPromoModal;

