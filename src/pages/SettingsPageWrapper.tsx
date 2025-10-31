import React from 'react';
import { useParams } from 'react-router-dom';
import DashboardPage from './DashboardPage';

/**
 * Settings Page Wrapper - Renders DashboardPage with settings tab
 * Supports sub-routes: /settings/billing, /settings/team, etc.
 */
const SettingsPageWrapper: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  
  // Map URL tab to internal tab name if needed
  const initialSettingsTab = tab || 'profile';
  
  return <DashboardPage initialTab="settings" initialSettingsTab={initialSettingsTab} />;
};

export default SettingsPageWrapper;

