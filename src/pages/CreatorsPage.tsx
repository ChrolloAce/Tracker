import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import DashboardPage from './DashboardPage';
import CreatorPortalPage from '../components/CreatorPortalPage';
import Sidebar from '../components/layout/Sidebar';

/**
 * Creators Page
 * - For admins/owners: Shows creators management via DashboardPage
 * - For creators: Shows their CreatorPortalPage directly
 */
const CreatorsPage: React.FC = () => {
  const { userRole } = useAuth();

  // For creators, show their portal directly
  if (userRole === 'creator') {
    return (
      <div className="min-h-screen bg-[#0A0A0B]">
        <Sidebar />
        <main className="ml-64 p-6">
          <CreatorPortalPage />
        </main>
      </div>
    );
  }

  // For admins/owners, show creators management
  return <DashboardPage initialTab="creators" />;
};

export default CreatorsPage;
