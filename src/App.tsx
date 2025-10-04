import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import CreateOrganizationPage from './pages/CreateOrganizationPage';
import CreateProjectPage from './pages/CreateProjectPage';
import DashboardPage from './pages/DashboardPage';
import LinkRedirect from './components/LinkRedirect';
import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

// Wrapper component to handle navigation for CreateProjectPage
function CreateProjectPageWrapper() {
  const navigate = useNavigate();
  
  return (
    <CreateProjectPage
      onClose={() => navigate('/dashboard')}
      onSuccess={() => navigate('/dashboard')}
    />
  );
}

// Loading skeleton component with timeout
function LoadingSkeleton() {
  const { logout } = useAuth();
  const [showError, setShowError] = useState(false);
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    // Show error after 15 seconds
    const errorTimer = setTimeout(() => {
      setShowError(true);
    }, 15000);

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(errorTimer);
      clearInterval(countdownInterval);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to sign out:', error);
      // Force navigation anyway
      window.location.href = '/login';
    }
  };

  const handleRetry = () => {
    window.location.reload();
  };

  if (showError) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-3">
            Loading Timeout
          </h1>
          
          <p className="text-white/60 mb-8">
            We're having trouble loading your dashboard. This might be due to a permissions issue or network problem.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              Try Again
            </button>
            
            <button
              onClick={handleSignOut}
              className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
            >
              Sign Out & Reset
            </button>

            <button
              onClick={() => window.location.href = '/'}
              className="w-full px-6 py-3 bg-transparent hover:bg-white/5 text-white/60 rounded-lg font-medium transition-colors"
            >
              Go to Home
            </button>
          </div>

          <p className="text-xs text-white/40 mt-8">
            If this problem persists, try clearing your browser cache or contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white/60 text-sm">Loading...</p>
        {countdown > 0 && countdown <= 10 && (
          <p className="text-white/40 text-xs mt-2">
            If stuck, showing options in {countdown}s
          </p>
        )}
      </div>
    </div>
  );
}

function App() {
  const { user, loading, currentOrgId, currentProjectId } = useAuth();

  // Show loading skeleton while checking authentication
  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          !user ? (
            <LandingPage />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        } 
      />
      
      <Route 
        path="/login" 
        element={
          loading ? (
            <LoadingSkeleton />
          ) : !user ? (
            <LoginPage />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        } 
      />

      <Route path="/l/:shortId" element={<LinkRedirect />} />

      <Route 
        path="/onboarding" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : currentOrgId ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <OnboardingPage />
          )
        } 
      />

      <Route 
        path="/create-organization" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : currentOrgId ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <CreateOrganizationPage />
          )
        } 
      />

      <Route 
        path="/create-project" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId ? (
            <LoadingSkeleton />
          ) : currentProjectId ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <CreateProjectPageWrapper />
          )
        } 
      />

      <Route 
        path="/dashboard" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : currentOrgId && currentProjectId ? (
            <DashboardPage />
          ) : (
            // Show loading while org/project are being created/loaded
            <LoadingSkeleton />
          )
        } 
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
