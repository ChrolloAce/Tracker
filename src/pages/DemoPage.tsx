import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import SpotlightOnboarding, { SpotlightStep } from '../components/spotlight/SpotlightOnboarding';

/**
 * Demo Context - Provides demo org/project IDs to the dashboard
 */
const DemoContext = createContext<{
  isDemoMode: boolean;
  demoOrgId: string;
  demoProjectId: string;
}>({
  isDemoMode: false,
  demoOrgId: '',
  demoProjectId: ''
});

export const useDemoContext = () => useContext(DemoContext);

const SPOTLIGHT_STEPS: SpotlightStep[] = [
  {
    target: '[data-spotlight="sidebar-nav"]',
    title: 'Navigation',
    description: 'Browse through your dashboard, tracked accounts, videos, links, campaigns and more — all from the sidebar.',
    position: 'right',
    padding: 4,
  },
  {
    target: '[data-spotlight="kpi-cards"]',
    title: 'Key Metrics at a Glance',
    description: 'See your total views, engagement, top performers and growth trends — all updated in real time.',
    position: 'top',
    padding: 8,
  },
  {
    target: '[data-spotlight="filters"]',
    title: 'Filter Your Data',
    description: 'Slice your analytics by account, platform, date range, and custom rules to find exactly what you need.',
    position: 'bottom',
    padding: 6,
  },
  {
    target: '[data-spotlight="video-slider"]',
    title: 'Recent Videos',
    description: 'Scroll through your latest tracked videos. Click any thumbnail to see detailed analytics and performance history.',
    position: 'bottom',
    padding: 8,
  },
  {
    target: '[data-spotlight="nav-accounts"]',
    title: 'Track Any Account',
    description: 'Add Instagram, TikTok, YouTube, or X accounts to automatically track all their content and performance.',
    position: 'right',
    padding: 4,
  },
  {
    target: '[data-spotlight="nav-campaigns"]',
    title: 'Run Campaigns',
    description: 'Create campaigns with goals, compensation rules, and leaderboards to manage creator collaborations at scale.',
    position: 'right',
    padding: 4,
  },
  {
    target: '[data-spotlight="nav-openclaw-keys"]',
    title: 'Connect Open Claw',
    description: 'Add your API key so Open Claw can self-improve based on your video data and competitor insights — fully automated learning.',
    position: 'right',
    padding: 4,
    expandSection: '[data-section-id="openclaw-section"]',
  },
  {
    target: 'center',
    title: 'Ready to track your content?',
    description: 'Create your free workspace in seconds — just your name, org name, and a Google sign-in. No credit card required.',
    ctaLabel: 'Create Your Workspace',
  },
];

const DEMO_ONBOARDING_KEY = 'viewtrack_demo_onboarding_completed';

/**
 * Public Demo Page
 * Renders the actual dashboard with hardcoded demo org/project
 * This allows anyone to view the demo without logging in
 */
const DemoPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [dashboardReady, setDashboardReady] = useState(false);

  // Demo org/project IDs - publicly accessible
  const DEMO_ORG_ID = 'Vx2UpxGCV3uD8Xj2ioX4';
  const DEMO_PROJECT_ID = 'ayGJEIQc23rJlamuOqp3';

  // Determine which tab to show based on URL
  const getInitialTab = () => {
    const path = location.pathname;
    if (path.includes('/accounts')) return 'accounts';
    if (path.includes('/videos')) return 'videos';
    if (path.includes('/links')) return 'analytics';
    if (path.includes('/creators')) return 'creators';
    if (path.includes('/campaigns')) return 'campaigns';
    if (path.includes('/extension')) return 'extension';
    return 'dashboard';
  };

  // Wait for dashboard data to load, then always show spotlight
  useEffect(() => {
    if (!dashboardReady) return;

    // Short delay so the UI has settled
    const timer = setTimeout(() => setShowSpotlight(true), 600);
    return () => clearTimeout(timer);
  }, [dashboardReady]);

  // Poll for KPI cards to appear (signals data is loaded)
  useEffect(() => {
    const check = setInterval(() => {
      const kpi = document.querySelector('[data-spotlight="kpi-cards"]');
      if (kpi && kpi.children.length > 0) {
        setDashboardReady(true);
        clearInterval(check);
      }
    }, 500);
    return () => clearInterval(check);
  }, []);

  const handleComplete = () => {
    setShowSpotlight(false);
    localStorage.setItem(DEMO_ONBOARDING_KEY, 'true');
    // Navigate to the simplified org creation flow
    navigate('/create-organization');
  };

  const handleSkip = () => {
    setShowSpotlight(false);
    localStorage.setItem(DEMO_ONBOARDING_KEY, 'true');
  };

  return (
    <DemoContext.Provider value={{
      isDemoMode: true,
      demoOrgId: DEMO_ORG_ID,
      demoProjectId: DEMO_PROJECT_ID
    }}>
      <DashboardPage initialTab={getInitialTab()} />
      <SpotlightOnboarding
        steps={SPOTLIGHT_STEPS}
        isActive={showSpotlight}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
    </DemoContext.Provider>
  );
};

export default DemoPage;
export { DemoContext };
