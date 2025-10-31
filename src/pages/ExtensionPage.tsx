import React from 'react';
import DashboardPage from './DashboardPage';

/**
 * Extension Page - Wrapper that renders DashboardPage with extension tab
 */
const ExtensionPage: React.FC = () => {
  return <DashboardPage initialTab="extension" />;
};

export default ExtensionPage;

