import React, { createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardPage from './DashboardPage';

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

/**
 * Public Demo Page
 * Renders the actual dashboard with hardcoded demo org/project
 * This allows anyone to view the demo without logging in
 */
const DemoPage: React.FC = () => {
  const location = useLocation();
  
  // Demo org/project IDs - publicly accessible
  const DEMO_ORG_ID = 'zcoz9Yc6BpjxsFogAIqr';
  const DEMO_PROJECT_ID = 'r2JV9idlIMO8dXbhpcR0';

  // Determine which tab to show based on URL
  const getInitialTab = () => {
    const path = location.pathname;
    if (path.includes('/accounts')) return 'accounts';
    if (path.includes('/videos')) return 'videos';
    if (path.includes('/links')) return 'analytics'; // Note: links maps to analytics tab
    if (path.includes('/creators')) return 'creators';
    if (path.includes('/campaigns')) return 'campaigns';
    if (path.includes('/extension')) return 'extension';
    return 'dashboard';
  };

  return (
    <DemoContext.Provider value={{
      isDemoMode: true,
      demoOrgId: DEMO_ORG_ID,
      demoProjectId: DEMO_PROJECT_ID
    }}>
      {/* Render the actual dashboard with demo data */}
      <DashboardPage initialTab={getInitialTab()} />
    </DemoContext.Provider>
  );
};

export default DemoPage;
export { DemoContext };

