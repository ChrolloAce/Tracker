import React from 'react';
import DashboardPage from './DashboardPage';

/**
 * Team Members Page - Wrapper that renders DashboardPage with team tab
 */
const TeamMembersPage: React.FC = () => {
  return <DashboardPage initialTab="team" />;
};

export default TeamMembersPage;

