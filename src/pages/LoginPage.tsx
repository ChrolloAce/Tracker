import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import viewtrackLogo from '/Viewtrack Logo Black.png';
import instagramIcon from '/Instagram_icon.png';
import tiktokIcon from '/TiktokLogo.png';
import youtubeIcon from '/Youtube_shorts_icon.svg.png';
import xLogo from '/twitter-x-logo.png';
import TeamInvitationService from '../services/TeamInvitationService';

const LoginPage: React.FC = () => {
  const { user, signInWithGoogle } = useAuth();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingInvite, setProcessingInvite] = useState(false);
  
  // Get invite parameters from URL
  const inviteId = searchParams.get('invite');
  const orgId = searchParams.get('org');

  // Track login page visit with DataFast
  useEffect(() => {
    (window as any)?.datafast?.("login_page_view");
  }, []);

  // Auto-accept invitation when user is authenticated
  useEffect(() => {
    const autoAcceptInvitation = async () => {
      // Check if we have invite parameters and an authenticated user
      if (!user || !inviteId || !orgId || processingInvite) return;
      
      setProcessingInvite(true);
      setError('');

      try {
        // Auto-accept the invitation
        await TeamInvitationService.acceptInvitation(
          inviteId,
          orgId,
          user.uid,
          user.email!,
          user.displayName || undefined
        );

        
        // Give Firebase a moment to propagate the changes
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Redirect to dashboard - the AuthContext will handle setting the right org/project
        window.location.href = '/dashboard';
      } catch (err: any) {
        console.error('❌ Failed to accept invitation:', err);
        setError(err.message || 'Failed to accept invitation. Please try again.');
        setProcessingInvite(false);
      }
    };

    autoAcceptInvitation();
  }, [user, inviteId, orgId, processingInvite]);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      // Use window.location for hard navigation to prevent React Router from intercepting
      window.location.href = '/preparing-workspace';
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
      setLoading(false);
    }
  };

  // Show loading state if processing invitation
  if (processingInvite) {
    console.log('🔄 Showing loading screen:', { processingInvite });
    return (
      <div className="min-h-screen bg-[#FAFAFB] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-md w-full bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 lg:p-12 text-center">
          <div className="mb-4 sm:mb-6">
            <img src={viewtrackLogo} alt="ViewTrack" className="h-8 sm:h-10 w-auto mx-auto" />
          </div>
          <div className="flex items-center justify-center mb-4 sm:mb-6">
            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-2 border-[#2282FF]"></div>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
            Setting up your account...
          </h2>
          <p className="text-sm sm:text-base text-gray-500">
            We're creating your creator profile. This will only take a moment!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl w-full bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden grid md:grid-cols-2">
        
        {/* Left Column - Login Form */}
        <div className="p-6 sm:p-8 lg:p-12 relative">
          {/* Logo & Branding */}
          <div className="mb-6 sm:mb-8">
            <img src={viewtrackLogo} alt="ViewTrack" className="h-8 sm:h-10 w-auto mb-2" />
          </div>

          {/* Title & Subtitle */}
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            {inviteId ? 'Join the Team' : 'Welcome to ViewTrack'}
          </h1>
          <p className="text-sm sm:text-base text-gray-500 mb-6 sm:mb-8">
            {inviteId 
              ? 'Sign in with Google to accept your invitation' 
              : 'Sign in with Google to get started'
            }
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {inviteId && !error && (
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-600">
                🎉 You've been invited! Sign in with Google to get started.
              </p>
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 shadow-sm"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-sm sm:text-base font-semibold text-gray-700">
              {loading ? 'Signing in...' : 'Continue with Google'}
            </span>
          </button>
        </div>

        {/* Right Column - Feature/Illustration Section - Hidden on Mobile */}
        <div className="hidden md:flex bg-black p-8 lg:p-12 flex-col items-center justify-center text-center relative overflow-hidden">
          {/* Background Decoration */}
          <div className="absolute inset-0">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full opacity-50 blur-3xl"></div>
          </div>

          {/* Illustration - Interconnected Icons */}
          <div className="relative mb-8 lg:mb-12">
            <div className="relative w-64 h-64 lg:w-80 lg:h-80">
              {/* Center Hub */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-20 h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl flex items-center justify-center shadow-2xl border border-gray-600">
                  <Link2 className="w-10 h-10 lg:w-12 lg:h-12 text-white" />
                </div>
              </div>

              {/* Instagram Icon - Top */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
                <div className="w-12 h-12 lg:w-14 lg:h-14 bg-white rounded-xl flex items-center justify-center shadow-xl p-2">
                  <img src={instagramIcon} alt="Instagram" className="w-6 h-6 lg:w-8 lg:h-8 object-contain" />
                </div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0.5 h-12 lg:h-16 bg-gradient-to-b from-gray-600 to-transparent"></div>
              </div>

              {/* TikTok Icon - Left */}
              <div className="absolute top-1/2 left-0 transform -translate-y-1/2">
                <div className="w-12 h-12 lg:w-14 lg:h-14 bg-white rounded-xl flex items-center justify-center shadow-xl p-2">
                  <img src={tiktokIcon} alt="TikTok" className="w-6 h-6 lg:w-8 lg:h-8 object-contain" />
                </div>
                <div className="absolute top-1/2 left-full transform -translate-y-1/2 w-12 lg:w-16 h-0.5 bg-gradient-to-r from-gray-600 to-transparent"></div>
              </div>

              {/* YouTube Icon - Bottom */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
                <div className="w-12 h-12 lg:w-14 lg:h-14 bg-white rounded-xl flex items-center justify-center shadow-xl p-2">
                  <img src={youtubeIcon} alt="YouTube" className="w-6 h-6 lg:w-8 lg:h-8 object-contain" />
                </div>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0.5 h-12 lg:h-16 bg-gradient-to-t from-gray-600 to-transparent"></div>
              </div>

              {/* X (Twitter) Icon - Right */}
              <div className="absolute top-1/2 right-0 transform -translate-y-1/2">
                <div className="w-12 h-12 lg:w-14 lg:h-14 bg-white rounded-xl flex items-center justify-center shadow-xl p-2">
                  <img src={xLogo} alt="X" className="w-6 h-6 lg:w-8 lg:h-8 object-contain" />
                </div>
                <div className="absolute top-1/2 right-full transform -translate-y-1/2 w-12 lg:w-16 h-0.5 bg-gradient-to-l from-gray-600 to-transparent"></div>
              </div>
            </div>
          </div>

          {/* Tagline */}
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-3 lg:mb-4 relative z-10">
            Start tracking now
          </h2>
          <p className="text-gray-400 text-base lg:text-lg relative z-10 max-w-md px-4">
            Track all your social media content performance in one place.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

