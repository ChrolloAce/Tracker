import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { TeamInvitation } from '../types/firestore';
import TeamInvitationService from '../services/TeamInvitationService';
import { Mail, Loader2, CheckCircle, AlertCircle, UserPlus, Shield, Crown } from 'lucide-react';
import viewtrackLogo from '/Viewtrack Logo Black.png';

/**
 * CreatorInvitationPage (renamed but handles all roles)
 * 
 * Custom portal for team members to accept invitations directly from email links.
 * Bypasses normal onboarding and takes them straight to the dashboard.
 * Supports all roles: member, admin, creator
 */
const CreatorInvitationPage: React.FC = () => {
  const { invitationId } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();
  const { user, signInWithGoogle, logout } = useAuth();

  // States
  const [invitation, setInvitation] = useState<TeamInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [processingInvite, setProcessingInvite] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Helper to get role icon and display name
  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'admin':
        return { icon: Shield, label: 'Admin', color: 'text-blue-600 dark:text-blue-400' };
      case 'creator':
        return { icon: Crown, label: 'Creator', color: 'text-purple-600 dark:text-purple-400' };
      default:
        return { icon: UserPlus, label: 'Member', color: 'text-gray-600 dark:text-gray-400' };
    }
  };

  // Load invitation details
  useEffect(() => {
    loadInvitation();
  }, [invitationId]);

  // Auto-accept if user is already logged in
  useEffect(() => {
    if (user && invitation && !processingInvite && !successMessage) {
      handleAutoAccept();
    }
  }, [user, invitation]);

  const loadInvitation = async () => {
    if (!invitationId) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Query all organizations to find the invitation
      // We need to use a different approach since we don't have orgId in the URL
      const invitationsSnapshot = await getDoc(doc(db, 'invitationsLookup', invitationId));
      
      if (!invitationsSnapshot.exists()) {
        // If lookup doesn't exist, we need to search through organizations
        // This is a fallback - in production, you'd want to maintain an invitationsLookup collection
        setError('Invitation not found. It may have expired or been deleted.');
        setLoading(false);
        return;
      }

      const lookupData = invitationsSnapshot.data();
      const inviteRef = doc(db, 'organizations', lookupData.orgId, 'invitations', invitationId);
      const inviteDoc = await getDoc(inviteRef);

      if (!inviteDoc.exists()) {
        setError('Invitation not found. It may have expired or been deleted.');
        setLoading(false);
        return;
      }

      const inviteData = inviteDoc.data() as TeamInvitation;

      // Check if invitation is still valid
      if (inviteData.status !== 'pending') {
        setError(`This invitation has already been ${inviteData.status}.`);
        setLoading(false);
        return;
      }

      // Check if expired
      const now = new Date();
      if (inviteData.expiresAt.toDate() < now) {
        setError('This invitation has expired. Please request a new invitation.');
        setLoading(false);
        return;
      }

      setInvitation(inviteData);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to load invitation:', err);
      setError('Failed to load invitation. Please try again.');
      setLoading(false);
    }
  };

  const handleAutoAccept = async () => {
    if (!user || !invitation || processingInvite) return;

    // Check if user's email matches invitation email
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      setError(
        `This invitation is for ${invitation.email}, but you are signed in as ${user.email}. ` +
        `Please sign out and log in with the correct email.`
      );
      return;
    }

    try {
      setProcessingInvite(true);
      setError('');

      await TeamInvitationService.acceptInvitation(
        invitation.id,
        invitation.orgId,
        user.uid,
        user.email!,
        user.displayName || undefined
      );

      setSuccessMessage(`Welcome to ${invitation.organizationName}!`);

      // Wait a moment for Firebase to propagate changes
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Failed to accept invitation:', err);
      setError(err.message || 'Failed to accept invitation. Please try again.');
      setProcessingInvite(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!invitation) return;

    setAuthLoading(true);
    setError('');

    try {
      await signInWithGoogle();
      // User will be auto-logged in, and the useEffect will handle acceptance
      // Note: Google email must match invitation email
    } catch (err: any) {
      console.error('Google authentication error:', err);
      setError(err.message || 'Google authentication failed. Please try again.');
      setAuthLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="bg-white dark:bg-[#161616] rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 p-8 max-w-md w-full text-center">
          <Loader2 className="w-12 h-12 animate-spin text-gray-900 dark:text-white mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Loading Invitation...</h2>
          <p className="text-gray-600 dark:text-gray-400">Please wait while we fetch your invitation details.</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (successMessage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
          <p className="text-gray-600 mb-2">{successMessage}</p>
          <p className="text-gray-500 text-sm mb-6">Redirecting you to the dashboard...</p>
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto" />
        </div>
      </div>
    );
  }

  // Processing state (after login, accepting invitation)
  if (processingInvite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Accepting Invitation...</h2>
          <p className="text-gray-600">Please wait while we set up your account.</p>
        </div>
      </div>
    );
  }

  // Main invitation acceptance UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-500 p-8 text-center">
          <img src={viewtrackLogo} alt="ViewTrack" className="h-12 mx-auto mb-4 filter brightness-0 invert" />
          <h1 className="text-3xl font-bold text-white mb-2">You're Invited! 🎨</h1>
          <p className="text-white/90 text-sm">
            Join <span className="font-semibold">{invitation?.organizationName}</span> as a Creator
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Invitation Details */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 mb-6">
            <p className="text-gray-700 text-center mb-4">
              <span className="font-semibold">{invitation?.invitedByName}</span> has invited you to join their team on ViewTrack!
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <Mail className="w-4 h-4" />
              <span>{invitation?.email}</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Auth Form */}
          {!user && (
            <>
              <form onSubmit={handleAuth} className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      disabled
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-gray-900 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">This email is pre-filled from your invitation</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-12 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {isSignUp ? 'Creating Account...' : 'Signing In...'}
                    </>
                  ) : (
                    isSignUp ? 'Create Account & Join' : 'Sign In & Join'
                  )}
                </button>
              </form>

              {/* Toggle Sign In / Sign Up */}
              <div className="text-center mb-6">
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                  }}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
              </div>

              {/* Divider */}
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              {/* Google Sign In */}
              <button
                onClick={handleGoogleAuth}
                disabled={authLoading}
                className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </button>
            </>
          )}

          {/* User is already logged in but email doesn't match */}
          {user && error && (
            <div className="space-y-4">
              <button
                onClick={async () => {
                  await logout();
                  window.location.reload();
                }}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Sign Out & Try Again
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 text-center">
          <p className="text-xs text-gray-500">
            By joining, you agree to ViewTrack's{' '}
            <a href="/terms" className="text-purple-600 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="text-purple-600 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CreatorInvitationPage;

