import React from 'react';
import DashboardPage from './DashboardPage';

/**
 * Settings Page Wrapper - Wrapper that renders DashboardPage with settings tab
 */
const SettingsPageWrapper: React.FC = () => {
  return <DashboardPage initialTab="settings" />;
};

export default SettingsPageWrapper;

