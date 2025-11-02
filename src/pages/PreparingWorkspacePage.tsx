import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import viewtrackLogo from '/Viewtrack Logo Black.png';

/**
 * PreparingWorkspacePage - Shows a loading screen while auth initializes
 * Then redirects based on user's organization status
 */
const PreparingWorkspacePage: React.FC = () => {
  const auth = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string>('');
  const hasStartedCheck = React.useRef(false);
  
  // Store latest auth in ref so we can read fresh values in setTimeout
  const authRef = React.useRef(auth);
  authRef.current = auth;

  useEffect(() => {
    // Only run once
    if (hasStartedCheck.current) {
      return;
    }

    const { user, loading } = authRef.current;

    // Don't do anything while auth is loading
    if (loading) {
      console.log('⏳ Auth loading...');
      return;
    }

    // If no user, redirect to login
    if (!user) {
      console.log('❌ No user, redirecting to login');
      hasStartedCheck.current = true;
      setRedirectPath('/login');
      setShouldRedirect(true);
      return;
    }

    // Mark that we've started the check
    hasStartedCheck.current = true;

    // Wait for auth context to fully initialize
    // AuthContext needs time to: load user orgs, set currentOrgId, create/load project, set currentProjectId
    console.log('⏳ Waiting 3 seconds for auth to fully initialize...');
    console.log('🔍 Current state at start:', { 
      userId: user.uid,
      email: user.email,
      currentOrgId: authRef.current.currentOrgId, 
      currentProjectId: authRef.current.currentProjectId 
    });
    
    const timer = setTimeout(() => {
      // Read FRESH values from ref
      const { currentOrgId, currentProjectId } = authRef.current;
      console.log('🔍 Checking org status after 3s delay:', { 
        userId: user.uid,
        currentOrgId, 
        currentProjectId,
        hasOrg: !!currentOrgId,
        hasProject: !!currentProjectId
      });
      
      if (currentOrgId && currentProjectId) {
        console.log('✅ User HAS organization and project, redirecting to dashboard');
        setRedirectPath('/dashboard');
      } else {
        console.log('📝 User has NO organization, redirecting to create organization page');
        setRedirectPath('/create-organization');
      }
      setShouldRedirect(true);
    }, 3000); // Give auth 3 seconds to fully initialize

    return () => clearTimeout(timer);
    // Only depend on user and loading to trigger the check once they're ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user, auth.loading]);

  // Handle redirect
  if (shouldRedirect && redirectPath) {
    console.log(`🔀 Redirecting to: ${redirectPath}`);
    return <Navigate to={redirectPath} replace />;
  }

  // Show loading screen

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

