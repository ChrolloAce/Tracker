import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import CreateOrganizationPage from './pages/CreateOrganizationPage';
import CreateProjectPage from './pages/CreateProjectPage';
import DashboardPage from './pages/DashboardPage';
import LinkRedirect from './components/LinkRedirect';

function App() {
  const { user, loading, currentOrgId, currentProjectId } = useAuth();
  const [showLoginPage, setShowLoginPage] = useState(false);

  if (loading) return null;

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          !user ? (
            showLoginPage ? <LoginPage /> : <LandingPage onGetStarted={() => setShowLoginPage(true)} />
          ) : !currentOrgId ? (
            <Navigate to="/onboarding" replace />
          ) : !currentProjectId ? (
            <Navigate to="/create-project" replace />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        } 
      />
      
      <Route 
        path="/login" 
        element={!user ? <LoginPage /> : <Navigate to="/dashboard" replace />} 
      />

      <Route path="/l/:shortId" element={<LinkRedirect />} />

      <Route 
        path="/onboarding" 
        element={
          user && !currentOrgId ? <OnboardingPage /> : 
          user && currentOrgId ? <Navigate to="/dashboard" replace /> : 
          <Navigate to="/login" replace />
        } 
      />

      <Route 
        path="/create-organization" 
        element={user ? <CreateOrganizationPage /> : <Navigate to="/login" replace />} 
      />

      <Route 
        path="/create-project" 
        element={
          user && currentOrgId ? (
            <CreateProjectPage
              onClose={() => window.location.href = '/dashboard'}
              onSuccess={() => window.location.href = '/dashboard'}
            />
          ) : user && !currentOrgId ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />

      <Route 
        path="/dashboard" 
        element={
          user && currentOrgId && currentProjectId ? <DashboardPage /> :
          user && currentOrgId && !currentProjectId ? <Navigate to="/create-project" replace /> :
          user && !currentOrgId ? <Navigate to="/onboarding" replace /> :
          <Navigate to="/login" replace />
        } 
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
