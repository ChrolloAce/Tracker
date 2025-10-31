import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import DashboardPage from './DashboardPage';

/**
 * Links Page - Wrapper that renders DashboardPage with analytics/links tab
 * Supports /links/:linkId to open specific link analytics
 */
const LinksPage: React.FC = () => {
  const { linkId } = useParams<{ linkId?: string }>();

  useEffect(() => {
    if (linkId) {
      // Dispatch event to open link analytics modal
      const event = new CustomEvent('openLinkAnalytics', { detail: { linkId } });
      window.dispatchEvent(event);
    }
  }, [linkId]);

  return <DashboardPage initialTab="analytics" />;
};

export default LinksPage;

