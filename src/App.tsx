import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import CreateOrganizationPage from './pages/CreateOrganizationPage';
import CreateProjectPage from './pages/CreateProjectPage';
import DashboardPage from './pages/DashboardPage';
import LinkRedirect from './components/LinkRedirect';

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

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white/60 text-sm">Loading...</p>
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
