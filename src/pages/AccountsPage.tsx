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
      // Dispatch event to open account details (with delays to ensure accounts are loaded)
      const dispatchEvent = () => {
      const event = new CustomEvent('openAccount', { detail: { accountId } });
      window.dispatchEvent(event);
      };

      // Try immediately
      dispatchEvent();
      
      // Also try after delays to handle race conditions
      const timeout1 = setTimeout(dispatchEvent, 100);
      const timeout2 = setTimeout(dispatchEvent, 300);
      const timeout3 = setTimeout(dispatchEvent, 500);
      
      return () => {
        clearTimeout(timeout1);
        clearTimeout(timeout2);
        clearTimeout(timeout3);
      };
    }
  }, [accountId]);

  return <DashboardPage initialTab="accounts" />;
};

export default AccountsPage;

