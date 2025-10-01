import { Timestamp } from 'firebase/firestore';

/**
 * Project - A container for organizing tracked accounts, links, and videos
 * within an organization
 */
export interface Project {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  color?: string; // Hex color for UI (optional for backward compatibility)
  icon?: string; // Emoji or icon name (optional)
  imageUrl?: string; // Custom uploaded image
  createdAt: Timestamp;
  createdBy: string; // userId
  isArchived: boolean;
  archivedAt?: Timestamp;
  archivedBy?: string;
}

/**
 * Project statistics for quick dashboard loading
 */
export interface ProjectStats {
  projectId: string;
  trackedAccountCount: number;
  videoCount: number;
  linkCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalClicks: number;
  lastUpdated: Timestamp;
}

/**
 * Data for creating a new project
 */
export interface CreateProjectData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  imageUrl?: string;
}

/**
 * Data for updating a project
 */
export interface UpdateProjectData {
  name?: string;
  description?: string;
  imageUrl?: string;
}

/**
 * Project with stats (for UI display)
 */
export interface ProjectWithStats extends Project {
  stats: ProjectStats;
}

/**
 * Predefined project colors for quick selection
 */
export const PROJECT_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Yellow', value: '#F59E0B' },
  { name: 'Green', value: '#10B981' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Gray', value: '#6B7280' },
  { name: 'Slate', value: '#64748B' },
];

/**
 * Predefined project icons
 */
export const PROJECT_ICONS = [
  '🎯', '🚀', '💼', '📊', '🎨', '💡',
  '🔥', '⚡', '✨', '🌟', '💎', '🎪',
  '🎬', '📱', '💻', '🎮', '🏆', '🎉',
  '🌈', '🔮', '🎭', '🎸', '🎤', '🎧',
];

