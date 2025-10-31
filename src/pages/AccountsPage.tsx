import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import DashboardPage from './DashboardPage';

/**
 * Accounts Page - Wrapper that renders DashboardPage with accounts tab
 * Supports /accounts/:accountId to open specific account details
 */
const AccountsPage: React.FC = () => {
  const { accountId } = useParams<{ accountId?: string }>();

  useEffect(() => {
    if (accountId) {
      // Dispatch event to open account details
      const event = new CustomEvent('openAccount', { detail: { accountId } });
      window.dispatchEvent(event);
    }
  }, [accountId]);

  return <DashboardPage initialTab="accounts" />;
};

export default AccountsPage;

