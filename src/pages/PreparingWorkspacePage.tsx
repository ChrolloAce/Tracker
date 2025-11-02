import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import viewtrackLogo from '/Viewtrack Logo Black.png';

/**
 * PreparingWorkspacePage - Shows a loading screen after login while checking organization status
 * Redirects to either dashboard or create organization based on user's status
 */
const PreparingWorkspacePage: React.FC = () => {
  const { user, loading, currentOrgId, currentProjectId } = useAuth();
  const navigate = useNavigate();
  const [checkComplete, setCheckComplete] = useState(false);
  const hasRedirected = useRef(false);
  const checkAttempts = useRef(0);
  const maxAttempts = 10; // Maximum 10 attempts (5 seconds total)

  useEffect(() => {
    // Prevent multiple redirects
    if (hasRedirected.current) {
      console.log('🚫 Already redirected, skipping');
      return;
    }

    const checkAccountStatus = async () => {
      // Wait for auth to finish loading
      if (loading) {
        console.log('⏳ Auth still loading...');
        return;
      }

      // If no user, redirect to login
      if (!user) {
        console.log('❌ No user found, redirecting to login');
        hasRedirected.current = true;
        navigate('/login', { replace: true });
        return;
      }

      // Increment check attempts
      checkAttempts.current++;
      console.log(`🔍 Check attempt ${checkAttempts.current}/${maxAttempts}:`, { 
        userId: user.uid, 
        email: user.email,
        currentOrgId, 
        currentProjectId,
        loading
      });

      // Give Firebase time to initialize, but check periodically
      if (!currentOrgId || !currentProjectId) {
        if (checkAttempts.current < maxAttempts) {
          // Wait 500ms and check again
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Trigger another check by updating state
          setCheckComplete(false);
          return;
        } else {
          // After max attempts, assume no org exists
          console.log('📝 Max attempts reached with no org, redirecting to create organization');
          hasRedirected.current = true;
          setCheckComplete(true);
          navigate('/create-organization', { replace: true });
          return;
        }
      }

      // User has organization and project
      console.log('✅ User has organization, redirecting to dashboard');
      hasRedirected.current = true;
      setCheckComplete(true);
      
      // Small delay before redirect to ensure smooth transition
      await new Promise(resolve => setTimeout(resolve, 300));
      navigate('/dashboard', { replace: true });
    };

    checkAccountStatus();
  }, [user, loading, currentOrgId, currentProjectId, navigate, checkComplete]);

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

