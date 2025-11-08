import React from 'react';
import DashboardPage from './DashboardPage';

/**
 * Revenue Page - Wrapper that renders DashboardPage with revenue tab
 */
const RevenuePage: React.FC = () => {
  return <DashboardPage initialTab="revenue" />;
};

export default RevenuePage;

