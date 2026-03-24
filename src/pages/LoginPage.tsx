import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import TeamInvitationService from '../services/TeamInvitationService';
import ViralContentService from '../services/ViralContentService';

const LoginPage: React.FC = () => {
  const { user, signInWithGoogle, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [processingInvite, setProcessingInvite] = useState(false);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  const inviteId = searchParams.get('invite');
  const orgId = searchParams.get('org');

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    (window as any)?.datafast?.("login_page_view");
  }, []);

  // Load viral thumbnails for background
  useEffect(() => {
    ViralContentService.fetchFirst(40).then(videos => {
      setThumbnails(videos.map(v => (v as any).thumbnailUrl || (v as any).thumbnail || '').filter(Boolean));
    }).catch(() => {});
  }, []);

  // Check if we just came back from Google redirect
  useEffect(() => {
    const justRedirected = sessionStorage.getItem('justCompletedGoogleRedirect');
    if (justRedirected === 'true' && user) {
      setIsProcessingAuth(true);
    }
  }, [user]);

  // Auto-accept invitation if user is logged in with invite params
  useEffect(() => {
    if (!user || !inviteId || !orgId || processingInvite) return;
    const autoAcceptInvitation = async () => {
      setProcessingInvite(true);
      setError('');
      try {
        await TeamInvitationService.acceptInvitation(inviteId, orgId, user.uid, user.email!, user.displayName || undefined);
        await new Promise(resolve => setTimeout(resolve, 3000));
        window.location.href = '/dashboard';
      } catch (err: any) {
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
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
      setSigningIn(false);
      setIsProcessingAuth(false);
    }
  };

  if (processingInvite) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#F8F9FB] flex transition-opacity duration-500 ease-out"
      style={{ opacity: mounted ? 1 : 0 }}
    >
      {/* Left side — Login form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12">
        <div className="max-w-md w-full mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 leading-snug">
            Log in to <span className="text-[#007BFF]">ViewTrack</span>
          </h1>
          <p className="text-gray-500 text-sm mb-10">Sign in to access your dashboard</p>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-center">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {inviteId && !error && (
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
              <p className="text-sm text-blue-600">You've been invited! Sign in to join.</p>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn || authLoading}
            className="w-full py-3.5 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-all text-sm flex items-center justify-center gap-3 disabled:opacity-50 border border-gray-200 shadow-sm"
          >
            {signingIn || authLoading ? (
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <p className="text-gray-400 text-xs mt-8">
            Don't have an account? <a href="/create-organization" className="text-[#007BFF] hover:underline">Create workspace</a>
          </p>
        </div>
      </div>

      {/* Right side — Scrolling video grid */}
      <div className="hidden lg:block w-1/2 relative overflow-hidden">
        <style>{`
          @keyframes scrollUp { from { transform: translateY(0); } to { transform: translateY(-50%); } }
          @keyframes scrollDown { from { transform: translateY(-50%); } to { transform: translateY(0); } }
        `}</style>
        <div className="absolute inset-0">
          <div className="flex gap-2 h-full">
            {[0, 1, 2, 3, 4].map(col => {
              const colThumbs = thumbnails.slice(col * 8, col * 8 + 8);
              const doubled = [...colThumbs, ...colThumbs];
              const direction = col % 2 === 0 ? 'scrollUp' : 'scrollDown';
              const duration = 25 + col * 5;
              return (
                <div key={col} className="flex-1 overflow-hidden">
                  <div
                    className="flex flex-col gap-2"
                    style={{ animation: `${direction} ${duration}s linear infinite` }}
                  >
                    {doubled.map((thumb, i) => (
                      <div key={i} className="aspect-[9/16] rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                        <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Auth processing overlay */}
      {(isProcessingAuth || signingIn) && (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-white/10 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default LoginPage;
