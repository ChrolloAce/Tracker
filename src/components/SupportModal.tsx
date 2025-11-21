import React, { useEffect } from 'react';
import { X, MessageCircle, Mail } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateUrlOnOpen?: boolean; // If true, update URL when modal opens
}

const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose, updateUrlOnOpen = true }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Update URL when modal opens (if enabled)
  useEffect(() => {
    if (isOpen && updateUrlOnOpen) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('modal', 'support');
      setSearchParams(newParams, { replace: false });
    }
  }, [isOpen, updateUrlOnOpen, searchParams, setSearchParams]);

  // Handle close - remove modal params from URL
  const handleClose = () => {
    if (updateUrlOnOpen) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('modal');
      setSearchParams(newParams, { replace: false });
    }
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-[#0A0A0A] rounded-2xl border border-white/10 shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Support & Feedback</h2>
            <p className="text-gray-400 text-sm">We're here to help. Don't hesitate to reach out to us.</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Main Contact Options */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* WhatsApp Card */}
          <a
            href="https://wa.link/fmc4sg"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-[#0B3D2E] to-[#0D2118] border border-green-500/20 hover:border-green-500/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-green-500/10"
          >
            <div className="relative z-10">
              {/* WhatsApp Icon */}
              <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-4 group-hover:bg-green-500/30 transition-colors">
                <MessageCircle className="w-6 h-6 text-green-400" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-white mb-2">WhatsApp</h3>
              <p className="text-gray-300 text-sm mb-6">
                Chat with our founder Ernesto and get instant help.
              </p>

              {/* Button */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-gray-900 font-medium text-sm group-hover:bg-gray-100 transition-colors">
                Start Chat
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>

          {/* Email Card */}
          <a
            href="mailto:tryviewtrack@gmail.com"
            className="group relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-[#0D1C2F] to-[#111A27] border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/10"
          >
            <div className="relative z-10">
              {/* Mail Icon */}
              <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors">
                <Mail className="w-6 h-6 text-blue-400" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-white mb-2">Support E-Mail</h3>
              <p className="text-gray-300 text-sm mb-6">
                Get help, request features, or share feedback.
              </p>

              {/* Button */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-gray-900 font-medium text-sm group-hover:bg-gray-100 transition-colors">
                Contact us
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>

        {/* Twitter/X Option */}
        <div className="px-6 pb-6">
          <a
            href="https://x.com/ErnestoSOFTWARE"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all"
          >
            <div className="flex items-center gap-4">
              {/* X Logo */}
              <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>

              <div>
                <h4 className="text-white font-medium">Twitter / X</h4>
                <p className="text-gray-400 text-sm">Follow us for updates and support</p>
              </div>
            </div>

            <div className="px-4 py-2 bg-white/5 rounded-lg text-white text-sm font-medium group-hover:bg-white/10 transition-colors">
              Contact us
            </div>
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SupportModal;

