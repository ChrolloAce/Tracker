import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import viewtrackLogo from '/Viewtrack Logo Black.png';

/**
 * PreparingWorkspacePage - Shows a loading screen while auth initializes
 * Then redirects based on user's organization status
 * 
 * KEY FIX: Uses useNavigate() imperatively instead of <Navigate> component
 * to avoid infinite render loops caused by component re-rendering
 */
const PreparingWorkspacePage: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const hasNavigated = React.useRef(false);

  useEffect(() => {
    // Prevent multiple navigation attempts
    if (hasNavigated.current) {
      console.log('⚠️ Already navigated, skipping...');
      return;
    }

    const { user, loading, currentOrgId, currentProjectId } = auth;

    // Wait for auth to finish loading
    if (loading) {
      console.log('⏳ Auth still loading...');
      return;
    }

    // No user? Go to login
    if (!user) {
      console.log('❌ No user found, redirecting to login');
      hasNavigated.current = true;
      navigate('/login', { replace: true });
      return;
    }

    // User exists, wait for org data to load
    console.log('🔍 User found, waiting for org data...', {
      userId: user.uid,
      email: user.email,
      currentOrgId,
      currentProjectId,
      loading
    });

    // Give AuthContext time to load org/project data
    // AuthContext needs time to: load user orgs, set currentOrgId, create/load project, set currentProjectId
    const timer = setTimeout(() => {
      // Check org status after delay
      const { currentOrgId: orgId, currentProjectId: projId } = auth;
      
      console.log('🔍 After 3s delay:', {
        userId: user.uid,
        currentOrgId: orgId,
        currentProjectId: projId,
        hasOrg: !!orgId,
        hasProject: !!projId
      });

      // Mark as navigated BEFORE calling navigate to prevent race conditions
      hasNavigated.current = true;

      if (orgId && projId) {
        console.log('✅ Has organization - navigating to dashboard');
        navigate('/dashboard', { replace: true });
      } else {
        console.log('📝 No organization - navigating to home page');
        navigate('/', { replace: true });
      }
    }, 3000);

    return () => {
      console.log('🧹 Cleaning up timer');
      clearTimeout(timer);
    };
  }, [auth, navigate]);

  // Always show loading screen (no conditional rendering of Navigate)
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
            We are launching Nov 12 at 2am
          </h2>
          <p className="text-gray-500 text-sm">
            Please check back then. Thank you for your patience!
          </p>
        </div>
      </div>
    </div>
  );
};

export default PreparingWorkspacePage;
