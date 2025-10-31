import React, { createContext, useContext } from 'react';
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
  // Demo org/project IDs - publicly accessible
  const DEMO_ORG_ID = 'vu4XD8yUegyiZe9Nw1Li';
  const DEMO_PROJECT_ID = 'tdqCRuMSWJ2q2IvOChWY';

  return (
    <DemoContext.Provider value={{
      isDemoMode: true,
      demoOrgId: DEMO_ORG_ID,
      demoProjectId: DEMO_PROJECT_ID
    }}>
      {/* Render the actual dashboard with demo data */}
      <DashboardPage />
    </DemoContext.Provider>
  );
};

export default DemoPage;
export { DemoContext };

