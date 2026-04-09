import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
// ThemeProvider is in main.tsx
import EmailVerificationScreen from './components/EmailVerificationScreen';
import ErrorBoundary from './components/ErrorBoundary';
import NotFoundPage from './pages/NotFoundPage';

// Lazy-loaded page components (route-level code splitting)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const PreparingWorkspacePage = lazy(() => import('./pages/PreparingWorkspacePage'));
const DemoPage = lazy(() => import('./pages/DemoPage'));
const CreateOrganizationPage = lazy(() => import('./pages/CreateOrganizationPage'));
const OnboardingOrchestrator = lazy(() => import('./pages/OnboardingOrchestrator'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'));
const ApifyMonitorPage = lazy(() => import('./pages/ApifyMonitorPage'));
const RefreshMonitorPage = lazy(() => import('./pages/RefreshMonitorPage'));
const ViewAsPage = lazy(() => import('./pages/ViewAsPage'));
const AccountsPage = lazy(() => import('./pages/AccountsPage'));
const VideosPage = lazy(() => import('./pages/VideosPage'));
const LinksPage = lazy(() => import('./pages/LinksPage'));
const CreatorsPage = lazy(() => import('./pages/CreatorsPage'));
const CampaignsPage = lazy(() => import('./pages/CampaignsPage'));
// Hidden for MVP
// const ExtensionPage = lazy(() => import('./pages/ExtensionPage'));
const SettingsPageWrapper = lazy(() => import('./pages/SettingsPageWrapper'));
// const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
// const RevenuePage = lazy(() => import('./pages/RevenuePage'));
const TeamMembersPage = lazy(() => import('./pages/TeamMembersPage'));
// LinkRedirect removed - Vercel server-side redirect in vercel.json + api/redirect.ts handles /l/:shortId
const ContractSigningPage = lazy(() => import('./pages/ContractSigningPage'));
const ContractEditorPage = lazy(() => import('./pages/ContractEditorPage'));
const CreateContractPage = lazy(() => import('./pages/CreateContractPage'));
// const CreatorDetailsPageWrapper = lazy(() => import('./pages/CreatorDetailsPageWrapper')); // DEPRECATED: Now using dashboard with filters
const SubscriptionPage = lazy(() => import('./components/SubscriptionPage'));
const BillingManagementPage = lazy(() => import('./components/BillingManagementPage'));
const CampaignDetailsPage = lazy(() => import('./components/CampaignDetailsPage'));
const CreateCampaignPage = lazy(() => import('./pages/CreateCampaignPage'));
const EditCampaignPage = lazy(() => import('./pages/EditCampaignPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const CreatorInvitationPage = lazy(() => import('./pages/CreatorInvitationPage'));
const ApiDocsPage = lazy(() => import('./pages/ApiDocsPage'));
const ApiManagementPage = lazy(() => import('./pages/ApiManagementPage'));
const ViralPage = lazy(() => import('./pages/ViralPage'));
// SavedViralPage is rendered inside DashboardPage via initialTab="saved"
const OpenClawPage = lazy(() => import('./pages/OpenClawPage'));
const PublicSharePage = lazy(() => import('./pages/PublicSharePage'));
const SharedFolderPage = lazy(() => import('./pages/SharedFolderPage'));

// SEO Pages (lazy-loaded)
const PricingPage = lazy(() => import('./pages/seo').then(m => ({ default: m.PricingPage })));
const FeaturesPage = lazy(() => import('./pages/seo').then(m => ({ default: m.FeaturesPage })));
const SolutionsPage = lazy(() => import('./pages/seo').then(m => ({ default: m.SolutionsPage })));
const ResourcesPage = lazy(() => import('./pages/seo').then(m => ({ default: m.ResourcesPage })));
const PlatformPage = lazy(() => import('./pages/seo').then(m => ({ default: m.PlatformPage })));
const StartTrackingPage = lazy(() => import('./pages/seo').then(m => ({ default: m.StartTrackingPage })));
const CampaignAnalyticsPage = lazy(() => import('./pages/seo').then(m => ({ default: m.CampaignAnalyticsPage })));
const LinkTrackingPage = lazy(() => import('./pages/seo').then(m => ({ default: m.LinkTrackingPage })));
const CreatorPortalFeaturePage = lazy(() => import('./pages/seo').then(m => ({ default: m.CreatorPortalFeaturePage })));
const UnifiedKPIsPage = lazy(() => import('./pages/seo').then(m => ({ default: m.UnifiedKPIsPage })));
const AutoRefreshPage = lazy(() => import('./pages/seo').then(m => ({ default: m.AutoRefreshPage })));
const ContractsPage = lazy(() => import('./pages/seo').then(m => ({ default: m.ContractsPage })));
const ChromeExtensionPage = lazy(() => import('./pages/seo').then(m => ({ default: m.ChromeExtensionPage })));
const UGCCampaignsPage = lazy(() => import('./pages/seo').then(m => ({ default: m.UGCCampaignsPage })));
const AppFoundersPage = lazy(() => import('./pages/seo').then(m => ({ default: m.AppFoundersPage })));
const DTCBrandsPage = lazy(() => import('./pages/seo').then(m => ({ default: m.DTCBrandsPage })));
const AgenciesPage = lazy(() => import('./pages/seo').then(m => ({ default: m.AgenciesPage })));
const MarketingTeamsPage = lazy(() => import('./pages/seo').then(m => ({ default: m.MarketingTeamsPage })));
const AnalyticsGuidePage = lazy(() => import('./pages/seo').then(m => ({ default: m.AnalyticsGuidePage })));
const ReportingTemplatePage = lazy(() => import('./pages/seo').then(m => ({ default: m.ReportingTemplatePage })));
const UGCBriefTemplatePage = lazy(() => import('./pages/seo').then(m => ({ default: m.UGCBriefTemplatePage })));

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

  if (showError) {
    return (
      <NotFoundPage 
        type="timeout"
        showSignOut={true}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-[3px] border-border border-t-orange-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-content-muted mt-4">Loading...</p>
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
    <ErrorBoundary>
    <Suspense fallback={<LoadingSkeleton />}>
    <Routes>
        {/* Public pages - NOT covered by maintenance */}
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/api-docs" element={<ApiDocsPage />} />
        {/* /l/:shortId handled by Vercel server-side redirect (api/redirect.ts) - no React fallback needed */}

        {/* Creator invitation portal - public route */}
        <Route path="/invitations/:invitationId" element={<CreatorInvitationPage />} />

        {/* Public project share - no auth required */}
        <Route path="/share/:token" element={<PublicSharePage />} />
        <Route path="/shared/:token" element={<SharedFolderPage />} />
        
        {/* SEO Pages - Public */}
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/solutions" element={<SolutionsPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/influencer-marketing-analytics-platform" element={<PlatformPage />} />
        <Route path="/start-tracking" element={<StartTrackingPage />} />
        
        {/* Feature Detail Pages */}
        <Route path="/features/campaign-analytics" element={<CampaignAnalyticsPage />} />
        <Route path="/features/link-tracking" element={<LinkTrackingPage />} />
        <Route path="/features/creator-portal" element={<CreatorPortalFeaturePage />} />
        <Route path="/features/unified-kpis" element={<UnifiedKPIsPage />} />
        <Route path="/features/auto-refresh" element={<AutoRefreshPage />} />
        <Route path="/features/contracts" element={<ContractsPage />} />
        <Route path="/features/chrome-extension" element={<ChromeExtensionPage />} />
        <Route path="/features/ugc-campaigns" element={<UGCCampaignsPage />} />
        
        {/* Solution Detail Pages */}
        <Route path="/solutions/app-founders" element={<AppFoundersPage />} />
        <Route path="/solutions/dtc-brands" element={<DTCBrandsPage />} />
        <Route path="/solutions/influencer-agencies" element={<AgenciesPage />} />
        <Route path="/solutions/marketing-teams" element={<MarketingTeamsPage />} />
        
        {/* Resource Detail Pages */}
        <Route path="/resources/influencer-analytics-guide" element={<AnalyticsGuidePage />} />
        <Route path="/resources/influencer-campaign-reporting-template" element={<ReportingTemplatePage />} />
        <Route path="/resources/ugc-campaign-brief-template" element={<UGCBriefTemplatePage />} />
        
        {/* Main app routes - COVERED by pre-launch */}
      <Route 
        path="/" 
        element={
          !user ? (
            <LandingPage />
          ) : currentOrgId && currentProjectId ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/onboarding" replace />
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
          ) : currentOrgId && currentProjectId ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/onboarding" replace />
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

      {/* Contract edit route - requires authentication */}
      <Route
        path="/contracts/edit/:contractId"
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
            <Navigate to="/" replace />
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
            <Navigate to="/" replace />
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
            <Navigate to="/" replace />
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
          ) : (
            <OnboardingOrchestrator />
          )
        } 
      />

      <Route
        path="/create-organization"
        element={
          loading ? (
            <LoadingSkeleton />
          ) : currentOrgId ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <CreateOrganizationPage />
          )
        } 
      />

      {/* Super Admin Page */}
      <Route 
        path="/super-admin" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : (
            <SuperAdminPage />
          )
        } 
      />

      {/* Apify Monitor Page (Super Admin) */}
      <Route 
        path="/apify-monitor" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : (
            <ApifyMonitorPage />
          )
        } 
      />

      {/* API Management Page (Super Admin) */}
      <Route
        path="/api-management"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : (
            <ApiManagementPage />
          )
        }
      />

      {/* Refresh Monitor Page (Super Admin) */}
      <Route 
        path="/refresh-monitor" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : (
            <RefreshMonitorPage />
          )
        } 
      />

      {/* View As Page (Super Admin) - supports all tab routes */}
      <Route 
        path="/view-as/:orgId/*" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : (
            <ViewAsPage />
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
            <Navigate to="/" replace />
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
            <Navigate to="/" replace />
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
            <Navigate to="/" replace />
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
            <Navigate to="/" replace />
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
            <Navigate to="/" replace />
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
            <Navigate to="/" replace />
          ) : (
            <CampaignsPage />
          )
        } 
      />

      {/* Hidden for MVP — redirect to dashboard */}
      <Route path="/extension" element={<Navigate to="/" replace />} />

      <Route
        path="/viral"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <Navigate to="/" replace />
          ) : (
            <ViralPage />
          )
        }
      />

      <Route
        path="/saved"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <Navigate to="/" replace />
          ) : (
            <DashboardPage initialTab="saved" />
          )
        }
      />

      <Route
        path="/openclaw"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentOrgId || !currentProjectId ? (
            <Navigate to="/" replace />
          ) : (
            <OpenClawPage />
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

      {/* Hidden for MVP — redirect to dashboard */}
      <Route path="/integrations" element={<Navigate to="/" replace />} />
      <Route path="/revenue" element={<Navigate to="/" replace />} />

      <Route 
        path="/team" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : currentOrgId ? (
            <TeamMembersPage />
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

      {/* Account details - redirects to dashboard with account filter */}
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
            <Navigate to="/" replace />
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
            <Navigate to="/" replace />
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

      <Route path="*" element={<NotFoundPage type="404" />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}

export default App;
