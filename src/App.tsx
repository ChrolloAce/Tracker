import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import EmailVerificationScreen from './components/EmailVerificationScreen';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import PreparingWorkspacePage from './pages/PreparingWorkspacePage';
import DemoPage from './pages/DemoPage';
import OnboardingPage from './pages/OnboardingPage';
import CreateOrganizationPage from './pages/CreateOrganizationPage';
import CreateProjectPage from './pages/CreateProjectPage';
import DashboardPage from './pages/DashboardPage';
import AccountsPage from './pages/AccountsPage';
import VideosPage from './pages/VideosPage';
import LinksPage from './pages/LinksPage';
import CreatorsPage from './pages/CreatorsPage';
import CampaignsPage from './pages/CampaignsPage';
import ExtensionPage from './pages/ExtensionPage';
import SettingsPageWrapper from './pages/SettingsPageWrapper';
import LinkRedirect from './components/LinkRedirect';
import ContractSigningPage from './pages/ContractSigningPage';
import ContractEditorPage from './pages/ContractEditorPage';
import CreateContractPage from './pages/CreateContractPage';
// import CreatorDetailsPageWrapper from './pages/CreatorDetailsPageWrapper'; // DEPRECATED: Now using dashboard with filters
import SubscriptionPage from './components/SubscriptionPage';
import BillingManagementPage from './components/BillingManagementPage';
import CampaignDetailsPage from './components/CampaignDetailsPage';
import CreateCampaignPage from './pages/CreateCampaignPage';
import EditCampaignPage from './pages/EditCampaignPage';
import { PreLaunchCover } from './components/PreLaunchCover';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import SupportPage from './pages/SupportPage';
import CreatorInvitationPage from './pages/CreatorInvitationPage';
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

  useEffect(() => {
    // Show error after 15 seconds
    const errorTimer = setTimeout(() => {
      setShowError(true);
    }, 15000);

    return () => {
      clearTimeout(errorTimer);
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
              className="w-full px-6 py-3 bg-gray-900 dark:bg-white hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
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

  // Fast skeleton loader - no black screen! Show dashboard structure immediately
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Skeleton Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-64 bg-zinc-900/60 backdrop-blur border-r border-white/5 p-4">
        <div className="h-8 bg-white/5 rounded animate-pulse mb-8"></div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-white/5 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
      
      {/* Skeleton Header */}
      <div className="fixed top-0 left-64 right-0 h-16 bg-zinc-900/60 backdrop-blur border-b border-white/5 px-6 flex items-center">
        <div className="h-8 bg-white/5 rounded w-48 animate-pulse"></div>
      </div>
      
      {/* Skeleton Content */}
      <div className="ml-64 pt-24 px-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Skeleton KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-zinc-900/40 rounded-2xl border border-white/5 animate-pulse"></div>
            ))}
          </div>
          
          {/* Skeleton Charts */}
          <div className="h-96 bg-zinc-900/40 rounded-2xl border border-white/5 animate-pulse"></div>
          <div className="h-96 bg-zinc-900/40 rounded-2xl border border-white/5 animate-pulse"></div>
        </div>
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

  // Check if user needs email verification (skip for demo and Google)
  // Note: We use custom verification system, not Firebase's emailVerified
  const needsVerification = user && 
    user.email !== 'demo@viewtrack.app' && 
    !currentOrgId && 
    !currentProjectId &&
    user.providerData[0]?.providerId === 'password';

  // If user is logged in but email not verified, show verification screen
  if (needsVerification) {
    return <EmailVerificationScreen />;
  }

  return (
    <PreLaunchCover>
    <Routes>
        {/* Public pages - NOT covered by pre-launch */}
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/l/:shortId" element={<LinkRedirect />} />
        
        {/* Creator invitation portal - public route */}
        <Route path="/invitations/:invitationId" element={<CreatorInvitationPage />} />
        
        {/* Main app routes - COVERED by pre-launch */}
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
      
      {/* Preparing workspace page - shown after login while checking org status */}
      <Route 
        path="/preparing-workspace" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : (
            <PreparingWorkspacePage />
          )
        } 
      />
      
      {/* Public demo routes - no authentication required */}
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/demo/dashboard" element={<DemoPage />} />
      <Route path="/demo/accounts" element={<DemoPage />} />
      <Route path="/demo/videos" element={<DemoPage />} />
      <Route path="/demo/links" element={<DemoPage />} />
      <Route path="/demo/creators" element={<DemoPage />} />
      <Route path="/demo/campaigns" element={<DemoPage />} />
      <Route path="/demo/extension" element={<DemoPage />} />
      
      {/* Public contract signing route - no authentication required */}
      <Route path="/contract/:contractId" element={<ContractSigningPage />} />

      {/* Contract editor route - requires authentication */}
      <Route 
        path="/contract/edit/:creatorId" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : (
            <ContractEditorPage />
          )
        } 
      />

      {/* Contract creation route - requires authentication */}
      <Route 
        path="/contracts/create" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <LoadingSkeleton />
          ) : (
            <CreateContractPage />
          )
        } 
      />

      {/* Creator details - DEPRECATED: Now redirects to dashboard */}
      <Route 
        path="/creators/:creatorId" 
        element={
          <Navigate to="/dashboard" replace />
        } 
      />

      {/* Campaign details - accessible from /campaigns/:id */}
      <Route 
        path="/campaigns/:campaignId" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <Navigate to="/create-organization" replace />
          ) : (
            <CampaignDetailsPage />
          )
        } 
      />

      {/* Create campaign */}
      <Route 
        path="/campaigns/create" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <Navigate to="/create-organization" replace />
          ) : (
            <CreateCampaignPage />
          )
        } 
      />

      {/* Edit campaign */}
      <Route 
        path="/campaigns/:campaignId/edit" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <Navigate to="/create-organization" replace />
          ) : (
            <EditCampaignPage />
          )
        } 
      />

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
          loading ? (
            <LoadingSkeleton />
          ) : !user ? (
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

      {/* Main Dashboard and Pages */}
      <Route 
        path="/dashboard" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <Navigate to="/create-organization" replace />
          ) : (
            <DashboardPage />
          )
        } 
      />

      <Route 
        path="/accounts" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <Navigate to="/create-organization" replace />
          ) : (
            <AccountsPage />
          )
        } 
      />

      <Route 
        path="/videos" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <Navigate to="/create-organization" replace />
          ) : (
            <VideosPage />
          )
        } 
      />

      <Route 
        path="/links" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <Navigate to="/create-organization" replace />
          ) : (
            <LinksPage />
          )
        } 
      />

      <Route 
        path="/creators" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <Navigate to="/create-organization" replace />
          ) : (
            <CreatorsPage />
          )
        } 
      />

      <Route 
        path="/campaigns" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <Navigate to="/create-organization" replace />
          ) : (
            <CampaignsPage />
          )
        } 
      />

      <Route 
        path="/extension" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <Navigate to="/create-organization" replace />
          ) : (
            <ExtensionPage />
          )
        } 
      />

      <Route 
        path="/settings" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : currentOrgId ? (
            <SettingsPageWrapper />
          ) : (
            <Navigate to="/create-organization" replace />
          )
        } 
      />

      {/* Settings sub-routes */}
      <Route 
        path="/settings/:tab" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : currentOrgId ? (
            <SettingsPageWrapper />
          ) : (
            <Navigate to="/create-organization" replace />
          )
        } 
      />

      {/* Account details - redirects to dashboard */}
      <Route 
        path="/accounts/:accountId" 
        element={
          <Navigate to="/dashboard" replace />
        } 
      />

      {/* Video details with analytics modal */}
      <Route 
        path="/videos/:videoId" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <Navigate to="/create-organization" replace />
          ) : (
            <VideosPage />
          )
        } 
      />

      {/* Link analytics modal */}
      <Route 
        path="/links/:linkId" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <Navigate to="/create-organization" replace />
          ) : (
            <LinksPage />
          )
        } 
      />

      <Route 
        path="/subscription" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId ? (
            <LoadingSkeleton />
          ) : (
            <SubscriptionPage />
          )
        } 
      />

      <Route 
        path="/billing" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId ? (
            <LoadingSkeleton />
          ) : (
            <BillingManagementPage />
          )
        } 
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </PreLaunchCover>
  );
}

export default App;
