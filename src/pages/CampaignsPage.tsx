import React from 'react';
import DashboardPage from './DashboardPage';

/**
 * Campaigns Page - Wrapper that renders DashboardPage with campaigns tab
 */
const CampaignsPage: React.FC = () => {
  return <DashboardPage initialTab="campaigns" />;
};

export default CampaignsPage;

