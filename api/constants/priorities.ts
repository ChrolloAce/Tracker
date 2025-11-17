/**
 * Job Priority Constants
 * 
 * Defines priority levels for the sync queue system.
 * Higher numbers = higher priority (processed first).
 */

export const JOB_PRIORITIES = {
  /**
   * User manually adds account or video while on the platform.
   * HIGHEST priority - user expects immediate results.
   */
  USER_INITIATED: 100,
  
  /**
   * Admin/user triggers manual refresh.
   * MEDIUM priority - manual action but not immediate user addition.
   */
  MANUAL_REFRESH: 10,
  
  /**
   * Automated cron job refreshes.
   * LOWEST priority - background maintenance.
   */
  SCHEDULED_REFRESH: 5
} as const;

export type JobPriority = typeof JOB_PRIORITIES[keyof typeof JOB_PRIORITIES];

