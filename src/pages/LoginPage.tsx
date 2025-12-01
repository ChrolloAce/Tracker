import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import viewtrackLogo from '/Viewtrack Logo Black.png';
import TeamInvitationService from '../services/TeamInvitationService';

const LoginPage: React.FC = () => {
  const { user, signInWithGoogle, loading: authLoading, currentOrgId, currentProjectId } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [processingInvite, setProcessingInvite] = useState(false);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  
  // Get invite parameters from URL
  const inviteId = searchParams.get('invite');
  const orgId = searchParams.get('org');

  // Track login page visit with DataFast
  useEffect(() => {
    (window as any)?.datafast?.("login_page_view");
  }, []);

  // Check if we just came back from Google redirect
  useEffect(() => {
    const justRedirected = sessionStorage.getItem('justCompletedGoogleRedirect');
    
    // If we just completed a Google redirect AND have a user, show loading screen
    if (justRedirected === 'true' && user) {
      console.log('🔄 Just returned from Google - showing loading screen');
      setIsProcessingAuth(true);
      
      // If user exists and auth is done loading, we're about to navigate
      if (!authLoading) {
        console.log('🔄 Auth complete, processing navigation...');
        // Keep showing loading screen until we navigate
        // The navigation will clear the flag
      }
    } else if (justRedirected === 'true' && !user && !authLoading) {
      // Flag is set but no user - clear the stale flag
      console.log('⚠️ Stale redirect flag detected, clearing...');
      sessionStorage.removeItem('justCompletedGoogleRedirect');
      setIsProcessingAuth(false);
    } else if (user && authLoading) {
      // Normal case: user exists but still loading
      console.log('🔄 Processing authentication...');
      setIsProcessingAuth(true);
    } else if (!user && !authLoading) {
      // No user and not loading - hide processing screen
      setIsProcessingAuth(false);
    }
  }, [user, authLoading, currentOrgId]);

  // Handle navigation after successful authentication (non-invite flow)
  useEffect(() => {
    // Skip if processing invitation or still loading auth
    if (processingInvite || inviteId) {
      console.log('⏳ Skipping navigation - processing invite or invite flow');
      return;
    }
    
    // Wait for auth to finish loading
    if (authLoading) {
      console.log('⏳ Auth still loading...');
      return;
    }
    
    // If user is authenticated and auth has finished loading
    if (user && !authLoading) {
      console.log('✅ User authenticated on login page, checking org/project status...', {
        userId: user.uid,
        email: user.email,
        currentOrgId,
        currentProjectId,
        hasOrg: !!currentOrgId,
        hasProject: !!currentProjectId
      });
      
      // Check if user has organization and project
      if (currentOrgId && currentProjectId) {
        console.log('✅ User has org and project - navigating to dashboard');
        sessionStorage.removeItem('justCompletedGoogleRedirect');
        navigate('/dashboard', { replace: true });
      } else {
        console.log('📝 User needs onboarding - navigating to smooth setup flow');
        sessionStorage.removeItem('justCompletedGoogleRedirect');
        navigate('/onboarding', { replace: true });
      }
    } else if (!user && !authLoading) {
      console.log('ℹ️ No user on login page - this is normal');
    }
  }, [user, authLoading, currentOrgId, currentProjectId, processingInvite, inviteId, navigate]);

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

        
        // Give Firebase time to propagate the changes
        await new Promise(resolve => setTimeout(resolve, 3000));
        
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
    setSigningIn(true);
    setIsProcessingAuth(true);
    try {
      console.log('🔵 Initiating Google sign-in...');
      await signInWithGoogle();
      // User will be redirected to Google, then back to the app
      // AuthContext will handle the redirect result
      console.log('✅ Google sign-in redirect initiated...');
      // Keep loading state - don't set to false as user is being redirected
    } catch (err: any) {
      console.error('❌ Google sign-in error:', err);
      const errorMessage = err.message || 'Google sign-in failed';
      setError(errorMessage);
      setSigningIn(false);
      setIsProcessingAuth(false);
    }
  };


  // Show loading state if processing invitation - just spinning circle
  if (processingInvite) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Grid - Increased Visibility */}
      <div 
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />
        
      {/* Centered Login Card - Dark Mode */}
      <div className="relative z-10 w-full max-w-md bg-[#09090B] rounded-2xl shadow-2xl p-8 sm:p-10 border border-white/10">
          {/* Logo & Branding */}
        <div className="mb-8 flex justify-center">
          <img src={viewtrackLogo} alt="ViewTrack" className="h-8 w-auto invert" />
          </div>

          {/* Title & Subtitle */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            {inviteId ? 'Join the Team' : 'Welcome to ViewTrack'}
          </h1>
          <p className="text-gray-400">
            {inviteId 
              ? 'Sign in with Google to accept your invitation' 
              : 'Sign in to continue to your dashboard'
            }
          </p>
        </div>

          {error && (
          <div className="mb-6 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-center">
            <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {inviteId && !error && (
          <div className="mb-6 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg text-center">
            <p className="text-sm text-blue-400">
              🎉 You've been invited! Sign in to join.
              </p>
            </div>
          )}

        {/* Google Sign-In Button - White for Contrast */}
            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn || authLoading}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 hover:shadow-lg transition-all disabled:opacity-50 disabled:hover:bg-white disabled:hover:shadow-none group"
            >
          {signingIn || authLoading ? (
            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#000" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#000" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#000" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#000" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
          )}
          <span>{signingIn || authLoading ? 'Signing in...' : 'Continue with Google'}</span>
            </button>
        
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>

      {/* Authentication Processing Overlay - Just spinning circle */}
      {(isProcessingAuth || signingIn) && (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-white/10 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default LoginPage;
