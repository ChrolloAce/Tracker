import React from 'react';
import DashboardPage from './DashboardPage';

/**
 * Accounts Page - Wrapper that renders DashboardPage with accounts tab
 */
const AccountsPage: React.FC = () => {
  return <DashboardPage initialTab="accounts" />;
};

export default AccountsPage;

