import React from 'react';
import DashboardPage from './DashboardPage';

/**
 * Creators Page - Wrapper that renders DashboardPage with creators tab
 */
const CreatorsPage: React.FC = () => {
  return <DashboardPage initialTab="creators" />;
};

export default CreatorsPage;

