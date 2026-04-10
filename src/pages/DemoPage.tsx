import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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

const DEMO_ONBOARDING_KEY = 'viewtrack_demo_onboarding_completed';

/**
 * Public Demo Page
 * Renders the actual dashboard with hardcoded demo org/project
 * This allows anyone to view the demo without logging in
 */
const DemoPage: React.FC = () => {
  const navigate = useNavigate();
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [demoTab, setDemoTab] = useState('dashboard');

  const DEMO_ORG_ID = 'Vx2UpxGCV3uD8Xj2ioX4';
  const DEMO_PROJECT_ID = 'ayGJEIQc23rJlamuOqp3';

  // Build spotlight steps with tab switching
  const switchTab = useCallback((tab: string) => setDemoTab(tab), []);

  const spotlightSteps: SpotlightStep[] = React.useMemo(() => [
    {
      target: '[data-spotlight="sidebar-nav"]',
      title: 'Your Command Center',
      description: 'Everything you need lives here. <strong>Dashboard</strong>, <strong>accounts</strong>, <strong>videos</strong>, <strong>creators</strong>, <strong>campaigns</strong>, and your AI agent, all one click away.',
      position: 'right' as const,
      padding: 4,
      onEnter: () => switchTab('dashboard'),
    },
    {
      target: '[data-spotlight="kpi-cards"]',
      title: 'Performance Overview',
      description: 'See <strong>total views</strong>, <strong>engagement rate</strong>, <strong>top performers</strong>, and <strong>growth trends</strong> across every platform at a glance.',
      position: 'top' as const,
      padding: 8,
      onEnter: () => switchTab('dashboard'),
    },
    {
      target: '[data-spotlight="filters"]',
      title: 'Powerful Filters',
      description: 'Drill into your data by <strong>account</strong>, <strong>platform</strong>, <strong>date range</strong>, or <strong>custom rules</strong>. Find exactly what matters in seconds.',
      position: 'bottom' as const,
      padding: 6,
      onEnter: () => switchTab('dashboard'),
    },
    {
      target: '[data-spotlight="video-slider"]',
      title: 'Every Video, One Place',
      description: 'Your latest tracked videos with <strong>live metrics</strong>. Tap any thumbnail to unlock <strong>full analytics</strong> and <strong>performance history</strong>.',
      position: 'bottom' as const,
      padding: 8,
      onEnter: () => switchTab('dashboard'),
    },
    // --- Creators (2 steps) ---
    {
      target: '[data-spotlight="nav-creators"]',
      title: 'Creator Management',
      description: 'Your entire <strong>creator roster</strong> in one hub. Invite creators, send <strong>contracts</strong>, and track <strong>payouts</strong>.',
      position: 'right' as const,
      padding: 4,
      onEnter: () => switchTab('creators'),
      delay: 150,
    },
    {
      target: '[data-spotlight="main-content"]',
      title: 'Manage Your Creators',
      description: 'Invite creators and give each one their own <strong>portal</strong> with live analytics that update daily. Track <strong>payouts</strong>, send <strong>contracts</strong>, and see every video they post, all in one place.',
      position: 'left' as const,
      padding: 0,
      onEnter: () => switchTab('creators'),
    },
    // --- Discover / Viral ---
    {
      target: '[data-spotlight="main-content"]',
      title: 'Spy on What\'s Going Viral',
      description: 'See the <strong>top-performing content</strong> across TikTok, Instagram, and YouTube right now. Steal the <strong>hooks</strong>, <strong>formats</strong>, and ideas that are blowing up.',
      position: 'left' as const,
      padding: 0,
      onEnter: () => switchTab('viral'),
      delay: 150,
    },
    // --- Open Claw (2 steps) ---
    {
      target: '[data-spotlight="nav-openclaw-keys"]',
      title: 'Your AI Agent Starts Here',
      description: 'This is where ViewTrack becomes your <strong>AI\'s brain</strong>. Connect Open Claw and let it learn from every video you track.',
      position: 'right' as const,
      padding: 4,
      onEnter: () => switchTab('openclaw'),
      delay: 150,
    },
    {
      target: '[data-spotlight="main-content"]',
      title: 'Self-Improving AI',
      description: 'Plug in your <strong>API key</strong> and Open Claw will <strong>learn from your data</strong>, analyze <strong>competitor strategies</strong>, and spot <strong>viral trends</strong> automatically.',
      position: 'left' as const,
      padding: 0,
      onEnter: () => switchTab('openclaw'),
    },
    // --- Final CTA ---
    {
      target: 'center',
      title: 'Ready to get started?',
      description: '',
      ctaLabel: 'Create Your Workspace',
    },
  ], [switchTab]);

  // Lock scroll from the start until spotlight takes over
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Show spotlight immediately when dashboard is ready
  useEffect(() => {
    if (!dashboardReady) return;
    setShowSpotlight(true);
  }, [dashboardReady]);

  // Poll for dashboard content to appear, with fast fallback
  useEffect(() => {
    const start = Date.now();
    const check = setInterval(() => {
      const kpi = document.querySelector('[data-spotlight="kpi-cards"]');
      if (kpi && kpi.children.length > 0) {
        setDashboardReady(true);
        clearInterval(check);
        return;
      }
      if (Date.now() - start > 3000) {
        const sidebar = document.querySelector('[data-spotlight="sidebar-nav"]');
        if (sidebar) {
          setDashboardReady(true);
          clearInterval(check);
          return;
        }
      }
      if (Date.now() - start > 5000) {
        setDashboardReady(true);
        clearInterval(check);
      }
    }, 200);
    return () => clearInterval(check);
  }, []);

  const handleComplete = () => {
    setShowSpotlight(false);
    localStorage.setItem(DEMO_ONBOARDING_KEY, 'true');
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
      {/* Simple loading overlay */}
      {!dashboardReady && (
        <div className="fixed inset-0 z-[99999] bg-[#0A0A0A] flex flex-col items-center justify-center gap-5">
          <img src="/vtlogo.png" alt="ViewTrack" className="w-12 h-12 animate-pulse" />
          <div className="w-48 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full animate-[loading_1.5s_ease-in-out_infinite]" style={{ background: 'linear-gradient(90deg, #007BFF, #2583FF)' }} />
          </div>
          <style>{`@keyframes loading { 0% { width: 0%; margin-left: 0; } 50% { width: 70%; margin-left: 15%; } 100% { width: 0%; margin-left: 100%; } }`}</style>
        </div>
      )}
      <DashboardPage initialTab={demoTab} />
      <SpotlightOnboarding
        steps={spotlightSteps}
        isActive={showSpotlight}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
    </DemoContext.Provider>
  );
};

export default DemoPage;
export { DemoContext };
