import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { TeamInvitation } from '../types/firestore';
import TeamInvitationService from '../services/TeamInvitationService';
import { Mail, Loader2, CheckCircle, XCircle, AlertCircle, UserPlus, Shield, Crown } from 'lucide-react';
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
    console.log('═══════════════════════════════════════════════');
    console.log('🚀 [INVITATION PAGE] Component mounted');
    console.log('📋 Invitation ID:', invitationId);
    console.log('👤 Current user:', user ? {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName
    } : 'Not logged in');
    console.log('═══════════════════════════════════════════════');
    loadInvitation();
  }, [invitationId]);

  // Auto-accept if user is already logged in
  useEffect(() => {
    console.log('🔄 [AUTO-ACCEPT CHECK]', {
      hasUser: !!user,
      hasInvitation: !!invitation,
      isProcessing: processingInvite,
      hasSuccess: !!successMessage,
      userEmail: user?.email,
      invitationEmail: invitation?.email
    });
    
    if (user && invitation && !processingInvite && !successMessage) {
      console.log('✅ [AUTO-ACCEPT] Conditions met, triggering auto-accept');
      handleAutoAccept();
    } else {
      console.log('⏸️ [AUTO-ACCEPT] Waiting for conditions...');
    }
  }, [user, invitation]);

  const loadInvitation = async () => {
    console.log('📥 [LOAD INVITATION] Starting...');
    
    if (!invitationId) {
      console.error('❌ [LOAD INVITATION] No invitation ID provided');
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      console.log('🔍 [LOAD INVITATION] Fetching invitation:', invitationId);

      // Get the public lookup document (no authentication required!)
      const lookupRef = doc(db, 'invitationsLookup', invitationId);
      const lookupSnapshot = await getDoc(lookupRef);
      
      if (!lookupSnapshot.exists()) {
        console.error('❌ [LOAD INVITATION] Lookup document not found for ID:', invitationId);
        console.error('❌ [LOAD INVITATION] This means the invitation was never created or was deleted');
        setError('Invitation not found. It may have expired or been deleted.');
        setLoading(false);
        return;
      }

      // The lookup now contains ALL invitation details (no need to query protected collection)
      const inviteData = lookupSnapshot.data() as TeamInvitation;
      console.log('✅ [LOAD INVITATION] Loaded public invitation data');
      console.log('📊 [LOAD INVITATION] Full invitation data:', JSON.stringify(inviteData, null, 2));
      console.log('📋 [LOAD INVITATION] Key fields:');
      console.log('  - email:', inviteData.email);
      console.log('  - organizationName:', inviteData.organizationName);
      console.log('  - role:', inviteData.role);
      console.log('  - status:', inviteData.status);
      console.log('  - id:', inviteData.id);
      console.log('  - orgId:', inviteData.orgId);

      // Validate that we have required fields
      if (!inviteData.email || !inviteData.organizationName || !inviteData.role) {
        console.error('❌ [LOAD INVITATION] Missing required fields:', {
          hasEmail: !!inviteData.email,
          hasOrgName: !!inviteData.organizationName,
          hasRole: !!inviteData.role
        });
        setError('This invitation link is invalid or was created with an older system. Please ask the sender to create a new invitation.');
        setLoading(false);
        return;
      }

      // Check if invitation is still valid
      if (inviteData.status && inviteData.status !== 'pending') {
        console.warn('⚠️ [LOAD INVITATION] Invitation status is not pending:', inviteData.status);
        const statusText = inviteData.status === 'accepted' ? 'accepted' :
                          inviteData.status === 'declined' ? 'declined' :
                          inviteData.status === 'expired' ? 'expired or cancelled' :
                          inviteData.status;
        setError(`This invitation has already been ${statusText}.`);
        setLoading(false);
        return;
      }

      // Check if expired (handle both Timestamp and missing expiresAt)
      if (inviteData.expiresAt) {
        try {
      const now = new Date();
          let expiryDate: Date;
          
          // Handle Firestore Timestamp
          if (typeof inviteData.expiresAt === 'object' && 'toDate' in inviteData.expiresAt) {
            expiryDate = inviteData.expiresAt.toDate();
          } else if (typeof inviteData.expiresAt === 'string' || typeof inviteData.expiresAt === 'number') {
            expiryDate = new Date(inviteData.expiresAt);
          } else {
            // If we can't parse it, skip expiration check
            console.warn('⚠️ [LOAD INVITATION] Could not parse expiresAt:', inviteData.expiresAt);
            expiryDate = new Date(Date.now() + 86400000); // Default to tomorrow
          }
          
          console.log('⏰ [LOAD INVITATION] Expiration check:', {
            now: now.toISOString(),
            expiresAt: expiryDate.toISOString(),
            isExpired: expiryDate < now
          });
          
          if (expiryDate < now) {
        console.error('❌ [LOAD INVITATION] Invitation has expired');
        setError('This invitation has expired. Please request a new invitation.');
        setLoading(false);
        return;
          }
        } catch (err) {
          console.error('⚠️ [LOAD INVITATION] Error checking expiration:', err);
          // Continue anyway if we can't check expiration
        }
      } else {
        console.log('ℹ️ [LOAD INVITATION] No expiration date set');
      }

      console.log('✅ [LOAD INVITATION] Invitation is valid! Setting state...');
      setInvitation(inviteData);
      setLoading(false);
      console.log('✅ [LOAD INVITATION] Complete! Invitation loaded successfully');
    } catch (err: any) {
      console.error('❌ Failed to load invitation:', err);
      console.error('Error details:', err.code, err.message);
      
      // Provide more specific error messages
      if (err.code === 'permission-denied') {
        setError('Permission denied. This invitation may be invalid or you may not have access to view it.');
      } else if (err.code === 'not-found') {
        setError('Invitation not found. It may have expired or been deleted.');
      } else {
        setError(`Failed to load invitation: ${err.message || 'Unknown error'}. Please try again or contact support.`);
      }
      setLoading(false);
    }
  };

  const handleAutoAccept = async () => {
    console.log('🎯 [AUTO-ACCEPT] Starting auto-accept process...');
    console.log('🎯 [AUTO-ACCEPT] Preconditions:', {
      hasUser: !!user,
      hasInvitation: !!invitation,
      isProcessing: processingInvite,
      userEmail: user?.email,
      invitationEmail: invitation?.email
    });
    
    if (!user || !invitation || processingInvite) {
      console.log('⏸️ [AUTO-ACCEPT] Preconditions not met, aborting');
      return;
    }

    // Check if user's email matches invitation email
    console.log('🔍 [AUTO-ACCEPT] Checking email match...');
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      console.error('❌ [AUTO-ACCEPT] Email mismatch!', {
        userEmail: user.email?.toLowerCase(),
        invitationEmail: invitation.email.toLowerCase()
      });
      setError(
        `This invitation is for ${invitation.email}, but you were signed in as ${user.email}. ` +
        `Please sign in with the correct email.`
      );
      // Auto-logout the user so they can sign in with correct account
      try {
        console.log('🚪 [AUTO-ACCEPT] Logging out user to sign in with correct email...');
        await logout();
      } catch (err) {
        console.error('❌ [AUTO-ACCEPT] Failed to logout:', err);
      }
      return;
    }

    console.log('✅ [AUTO-ACCEPT] Email matches! Proceeding with acceptance...');

    try {
      setProcessingInvite(true);
      setError('');

      console.log('📝 [AUTO-ACCEPT] Calling TeamInvitationService.acceptInvitation with:', {
        invitationId: invitation.id,
        orgId: invitation.orgId,
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || 'No display name'
      });

      await TeamInvitationService.acceptInvitation(
        invitation.id,
        invitation.orgId,
        user.uid,
        user.email!,
        user.displayName || undefined
      );

      console.log('✅ [AUTO-ACCEPT] Invitation accepted successfully!');
      setSuccessMessage(`Welcome to ${invitation.organizationName}!`);

      // Wait longer for Firebase to propagate org membership changes
      console.log('⏳ [AUTO-ACCEPT] Waiting 3 seconds for Firebase to propagate changes...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Use hard redirect to ensure AuthContext reloads with new org data
      console.log('🚀 [AUTO-ACCEPT] Redirecting to dashboard...');
      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error('❌ [AUTO-ACCEPT] Failed to accept invitation:', err);
      console.error('❌ [AUTO-ACCEPT] Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      setError(err.message || 'Failed to accept invitation. Please try again.');
      setProcessingInvite(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('🔐 [GOOGLE SIGN-IN] User clicked Google sign-in button');
    
    if (!invitation) {
      console.error('❌ [GOOGLE SIGN-IN] No invitation loaded!');
      return;
    }

    console.log('🔐 [GOOGLE SIGN-IN] Invitation email expected:', invitation.email);
    setAuthLoading(true);
    setError('');

    try {
      console.log('🔐 [GOOGLE SIGN-IN] Calling signInWithGoogle...');
      await signInWithGoogle();
      console.log('✅ [GOOGLE SIGN-IN] Google authentication successful!');
      console.log('ℹ️ [GOOGLE SIGN-IN] The useEffect will now handle auto-acceptance');
      // User will be auto-logged in, and the useEffect will handle acceptance
      // Note: Google email must match invitation email
    } catch (err: any) {
      console.error('❌ [GOOGLE SIGN-IN] Google authentication error:', err);
      console.error('❌ [GOOGLE SIGN-IN] Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
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
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="bg-white dark:bg-[#161616] rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 p-8 max-w-md w-full text-center">
          <div className="bg-red-100 dark:bg-red-500/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Invitation Error</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
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
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="bg-white dark:bg-[#161616] rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 p-8 max-w-md w-full text-center">
          <div className="bg-green-100 dark:bg-green-500/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Success!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">{successMessage}</p>
          <p className="text-gray-500 dark:text-gray-500 text-sm mb-6">Redirecting you to the dashboard...</p>
          <Loader2 className="w-8 h-8 animate-spin text-gray-900 dark:text-white mx-auto" />
        </div>
      </div>
    );
  }

  // Processing state (after login, accepting invitation)
  if (processingInvite) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="bg-white dark:bg-[#161616] rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 p-8 max-w-md w-full text-center">
          <Loader2 className="w-12 h-12 animate-spin text-gray-900 dark:text-white mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Accepting Invitation...</h2>
          <p className="text-gray-600 dark:text-gray-400">Please wait while we set up your account.</p>
        </div>
      </div>
    );
  }

  // Get role info for display
  const roleInfo = getRoleInfo(invitation?.role || 'member');
  const RoleIcon = roleInfo.icon;

  // Main invitation acceptance UI
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#161616] rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden max-w-md w-full">
        {/* Header */}
        <div className="bg-black dark:bg-white p-8 text-center border-b border-gray-200 dark:border-white/10">
          <img src={viewtrackLogo} alt="ViewTrack" className="h-12 mx-auto mb-4 dark:filter dark:brightness-0" />
          <h1 className="text-3xl font-bold text-white dark:text-black mb-2">You're Invited!</h1>
          <div className="flex items-center justify-center gap-2 text-white/90 dark:text-black/90 text-sm">
            <span>Join</span>
            <span className="font-semibold">{invitation?.organizationName}</span>
            <span>as</span>
            <span className={`inline-flex items-center gap-1 font-semibold ${roleInfo.color}`}>
              <RoleIcon className="w-4 h-4" />
              {roleInfo.label}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Invitation Details */}
          <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-6 mb-6 border border-gray-200 dark:border-white/10">
            <p className="text-gray-700 dark:text-gray-300 text-center mb-4">
              <span className="font-semibold text-gray-900 dark:text-white">{invitation?.invitedByName}</span> has invited you to join their team on ViewTrack!
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Mail className="w-4 h-4" />
              <span>{invitation?.email}</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Auth Form */}
          {!user && (
            <>
              {/* Google Sign In Only */}
              <div className="mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                  Sign in with Google to accept your invitation
                </p>
                <button
                  onClick={handleGoogleSignIn}
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white dark:bg-white/10 border-2 border-gray-300 dark:border-white/20 rounded-xl hover:bg-gray-50 dark:hover:bg-white/20 transition-all disabled:opacity-50 shadow-sm"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-base font-semibold text-gray-700 dark:text-white">
                    {authLoading ? 'Signing in...' : 'Continue with Google'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatorInvitationPage;
