import React from 'react';
import { VideoSubmission } from '../types';
import TopPlatformsRaceChart from './TopPlatformsRaceChart';

interface TopPlatformsCardProps {
  submissions: VideoSubmission[];
}

/**
 * TopPlatformsCard Component
 * 
 * Wraps the TopPlatformsRaceChart for use in the Top Performers Grid.
 * Shows platform performance comparison.
 */
const TopPlatformsCard: React.FC<TopPlatformsCardProps> = ({ submissions }) => {
  return <TopPlatformsRaceChart submissions={submissions} />;
};

export default TopPlatformsCard;

