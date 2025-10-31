import React from 'react';
import DashboardPage from './DashboardPage';

/**
 * Links Page - Wrapper that renders DashboardPage with analytics/links tab
 */
const LinksPage: React.FC = () => {
  return <DashboardPage initialTab="analytics" />;
};

export default LinksPage;

