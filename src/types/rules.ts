/**
 * Tracking Rules Types
 * Define filtering rules for tracked account videos
 */

export type RuleConditionType = 
  | 'description_contains'
  | 'description_not_contains'
  | 'hashtag_includes'
  | 'hashtag_not_includes'
  | 'views_greater_than'
  | 'views_less_than'
  | 'likes_greater_than'
  | 'engagement_rate_greater_than'
  | 'posted_after_date'
  | 'posted_before_date';

export interface RuleCondition {
  id: string;
  type: RuleConditionType;
  value: string | number;
  operator?: 'AND' | 'OR'; // How to combine with next condition
  caseSensitive?: boolean; // For text-based conditions (description_contains, etc.)
}

export interface TrackingRule {
  id: string;
  name: string;
  description?: string;
  conditions: RuleCondition[];
  isActive: boolean;
  appliesTo: {
    platforms?: ('instagram' | 'tiktok' | 'youtube' | 'twitter')[];
    accountIds?: string[]; // Specific accounts, or empty for "available to all"
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // userId
  organizationId: string;
  projectId: string;
}

export interface RuleMatchResult {
  matches: boolean;
  matchedConditions: string[];
  failedConditions: string[];
}

