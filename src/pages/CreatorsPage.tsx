import React from 'react';
import DashboardPage from './DashboardPage';

/**
 * Creators Page — always renders the admin creators management view.
 * Legacy creator portal (logged-in creator view) has been removed;
 * creators now use public share link portals at /c/:token.
 */
const CreatorsPage: React.FC = () => {
  return <DashboardPage initialTab="creators" />;
};

export default CreatorsPage;
