import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, AlertCircle, Compass } from 'lucide-react';

interface NotFoundPageProps {
  type?: 'timeout' | '404' | 'permission';
  title?: string;
  message?: string;
  showSignOut?: boolean;
  onSignOut?: () => void;
}

const NotFoundPage: React.FC<NotFoundPageProps> = ({ 
  type = '404',
  title,
  message,
  showSignOut = false,
  onSignOut
}) => {
  const navigate = useNavigate();

  const content = {
    timeout: {
      icon: <AlertCircle className="w-16 h-16" />,
      iconBg: 'bg-zinc-800/50 border-zinc-700/50',
      iconColor: 'text-zinc-400',
      title: title || 'Loading Timeout',
      message: message || "We're having trouble loading your dashboard. This might be due to a permissions issue or network problem.",
      primaryAction: { label: 'Try Again', onClick: () => window.location.reload() },
      showSecondary: true
    },
    '404': {
      icon: <Compass className="w-16 h-16" />,
      iconBg: 'bg-zinc-800/50 border-zinc-700/50',
      iconColor: 'text-zinc-400',
      title: title || 'Page Not Found',
      message: message || "The page you're looking for doesn't exist or has been moved. Let's get you back on track.",
      primaryAction: { label: 'Go to Dashboard', onClick: () => navigate('/dashboard') },
      showSecondary: false
    },
    permission: {
      icon: <AlertCircle className="w-16 h-16" />,
      iconBg: 'bg-zinc-800/50 border-zinc-700/50',
      iconColor: 'text-zinc-400',
      title: title || 'Access Denied',
      message: message || "You don't have permission to access this page. Contact your workspace admin for access.",
      primaryAction: { label: 'Go Back', onClick: () => navigate(-1) },
      showSecondary: false
    }
  };

  const config = content[type];

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-zinc-800/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-zinc-700/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Content Container */}
      <div className="max-w-md w-full text-center relative z-10">
        {/* Icon */}
        <div className={`${config.iconBg} border rounded-2xl w-24 h-24 flex items-center justify-center mx-auto mb-6 backdrop-blur-xl`}>
          <div className={config.iconColor}>
            {config.icon}
          </div>
        </div>

        {/* 404 Large Text (only for 404 type) */}
        {type === '404' && (
          <div className="text-8xl font-black text-white/5 mb-2 select-none">
            404
          </div>
        )}
        
        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-3">
          {config.title}
        </h1>
        
        {/* Message */}
        <p className="text-white/60 mb-8 leading-relaxed">
          {config.message}
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Primary Action */}
          <button
            onClick={config.primaryAction.onClick}
            className="w-full px-6 py-3 bg-white hover:bg-white/90 text-black rounded-lg font-medium transition-all duration-200 shadow-lg shadow-white/10 hover:shadow-white/20"
          >
            {config.primaryAction.label}
          </button>
          
          {/* Sign Out Button (for timeout) */}
          {config.showSecondary && showSignOut && onSignOut && (
            <button
              onClick={onSignOut}
              className="w-full px-6 py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors border border-white/10"
            >
              Sign Out & Reset
            </button>
          )}

          {/* Secondary Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex-1 px-6 py-3 bg-transparent hover:bg-white/5 text-white/60 hover:text-white rounded-lg font-medium transition-colors border border-white/5 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="flex-1 px-6 py-3 bg-transparent hover:bg-white/5 text-white/60 hover:text-white rounded-lg font-medium transition-colors border border-white/5 flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Home
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-8 pt-6 border-t border-white/5">
          <p className="text-xs text-white/40">
            {type === 'timeout' 
              ? 'If this problem persists, try clearing your browser cache or contact support.'
              : type === '404'
              ? 'Lost? Use the navigation above or return to the homepage.'
              : 'Need access? Contact your workspace administrator.'}
          </p>
        </div>

        {/* Support Link */}
        <a 
          href="mailto:support@viewtrack.app" 
          className="inline-block mt-4 text-xs text-white/60 hover:text-white transition-colors"
        >
          Contact Support →
        </a>
      </div>
    </div>
  );
};

export default NotFoundPage;

