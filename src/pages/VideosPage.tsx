import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import DashboardPage from './DashboardPage';

/**
 * Videos Page - Wrapper that renders DashboardPage with videos tab
 * Supports /videos/:videoId to open specific video analytics
 */
const VideosPage: React.FC = () => {
  const { videoId } = useParams<{ videoId?: string }>();

  useEffect(() => {
    if (videoId) {
      // Dispatch event to open video analytics modal
      const event = new CustomEvent('openVideoAnalytics', { detail: { videoId } });
      window.dispatchEvent(event);
    }
  }, [videoId]);

  return <DashboardPage initialTab="videos" />;
};

export default VideosPage;

