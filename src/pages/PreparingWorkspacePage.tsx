import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import viewtrackLogo from '/Viewtrack Logo Black.png';

/**
 * PreparingWorkspacePage - Shows a loading screen after login while checking organization status
 * Redirects to either dashboard or create organization based on user's status
 */
const PreparingWorkspacePage: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [checkComplete, setCheckComplete] = useState(false);
  const hasChecked = useRef(false);
  
  // Store latest auth values in refs so we can access fresh values in async function
  const authRef = useRef(auth);
  authRef.current = auth;

  useEffect(() => {
    // Prevent multiple checks
    if (hasChecked.current) {
      return;
    }

    const checkAccountStatus = async () => {
      const { user, loading } = authRef.current;
      console.log('🔍 Starting account check...', { loading, user: !!user });

      // Wait for auth to finish loading FIRST
      if (loading) {
        console.log('⏳ Auth still loading, waiting...');
        return;
      }

      // If no user, redirect to login
      if (!user) {
        console.log('❌ No user found, redirecting to login');
        hasChecked.current = true;
        navigate('/login', { replace: true });
        return;
      }

      // Mark as checked to prevent re-runs
      hasChecked.current = true;

      // Give Firebase extra time to fully initialize the auth context
      // This prevents race conditions where currentOrgId hasn't been set yet
      console.log('⏳ Waiting 2 seconds for auth context to fully initialize...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // NOW read the FRESH values from the ref (not stale closure values)
      const { currentOrgId, currentProjectId } = authRef.current;
      
      console.log('🔍 Final check after delay:', { 
        userId: user.uid, 
        email: user.email,
        hasOrg: !!currentOrgId,
        hasProject: !!currentProjectId,
        currentOrgId, 
        currentProjectId 
      });

      // Check if user has an organization
      if (currentOrgId && currentProjectId) {
        console.log('✅ User has organization, redirecting to dashboard');
        setCheckComplete(true);
        await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for smooth transition
        navigate('/dashboard', { replace: true });
      } else {
        console.log('📝 User has no organization, redirecting to create organization');
        setCheckComplete(true);
        await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for smooth transition
        navigate('/create-organization', { replace: true });
      }
    };

    checkAccountStatus();
    // Only depend on loading and user - once these are stable, we check once
    // navigate is stable and doesn't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.user]);

  return (
    <div className="min-h-screen bg-[#FAFAFB] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-12 text-center">
        {/* Logo */}
        <div className="mb-8">
          <img src={viewtrackLogo} alt="ViewTrack" className="h-12 w-auto mx-auto" />
        </div>

        {/* Animated Spinner */}
        <div className="flex items-center justify-center mb-8">
          <div className="relative">
            {/* Outer rotating ring */}
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-200"></div>
            {/* Inner rotating arc */}
            <div className="absolute top-0 left-0 animate-spin rounded-full h-20 w-20 border-4 border-transparent border-t-[#2282FF]"></div>
          </div>
        </div>

        {/* Loading Text */}
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-gray-900">
            Preparing your workspace...
          </h2>
          <p className="text-gray-500 text-sm">
            We're setting up everything for you. This will only take a moment.
          </p>
        </div>

        {/* Progress Indicators */}
        <div className="mt-8 space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-[#2282FF] rounded-full animate-pulse"></div>
            <span>Verifying account</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-[#2282FF] rounded-full animate-pulse delay-150"></div>
            <span>Loading workspace</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-[#2282FF] rounded-full animate-pulse delay-300"></div>
            <span>Preparing dashboard</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreparingWorkspacePage;

