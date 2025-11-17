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
   * Admin/user triggers manual refresh OR refreshing existing video metrics.
   * HIGH priority - manual action or maintaining existing data accuracy.
   */
  MANUAL_REFRESH: 50,
  
  /**
   * Refreshing metrics for existing videos during scheduled runs.
   * MEDIUM priority - important for data freshness.
   */
  REFRESH_EXISTING: 50,
  
  /**
   * Progressive spiderweb search phases (5→10→15→20 videos).
   * LOW priority - discovery of new content, runs after all refreshes.
   */
  SPIDERWEB_SEARCH: 10,
  
  /**
   * Automated cron job refreshes (baseline).
   * LOWEST priority - background maintenance.
   */
  SCHEDULED_REFRESH: 5
} as const;

export type JobPriority = typeof JOB_PRIORITIES[keyof typeof JOB_PRIORITIES];

