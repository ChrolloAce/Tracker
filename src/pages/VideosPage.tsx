import React from 'react';
import DashboardPage from './DashboardPage';

/**
 * Videos Page - Wrapper that renders DashboardPage with videos tab
 */
const VideosPage: React.FC = () => {
  return <DashboardPage initialTab="videos" />;
};

export default VideosPage;

