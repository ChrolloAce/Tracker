import React from 'react';
import { VideoSubmission } from '../../types';
import { LinkClick } from '../../services/LinkClicksService';
import { TrackedLink, TrackedAccount } from '../../types/firestore';
import { RevenueMetrics, RevenueIntegration } from '../../types/revenue';
import { DateFilterType } from '../DateRangeFilter';
import { TimePeriodType } from '../TimePeriodSelector';
import { IntervalType, TimeInterval } from '../../services/DataAggregationService';

export interface KPICardsProps {
  submissions: VideoSubmission[]; // Filtered submissions for current period
  allSubmissions?: VideoSubmission[]; // All submissions (unfiltered) for PP calculation
  linkClicks?: LinkClick[];
  links?: TrackedLink[];
  accounts?: TrackedAccount[];
  dateFilter?: DateFilterType;
  customRange?: { startDate: Date; endDate: Date };
  timePeriod?: TimePeriodType;
  granularity?: 'day' | 'week' | 'month' | 'year';
  onCreateLink?: () => void;
  onVideoClick?: (video: VideoSubmission) => void;
  onOpenRevenueSettings?: () => void;
  revenueMetrics?: RevenueMetrics | null;
  revenueIntegrations?: RevenueIntegration[];
  isEditMode?: boolean;
  cardOrder?: string[];
  cardVisibility?: Record<string, boolean>;
  onReorder?: (newOrder: string[]) => void;
  onToggleCard?: (cardId: string) => void;
}

export interface KPICardData {
  id: string;
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'emerald' | 'pink' | 'blue' | 'violet' | 'teal' | 'orange' | 'slate';
  delta?: { value: number; isPositive: boolean; absoluteValue: number; isPercentage?: boolean };
  period?: string;
  sparklineData?: Array<{ value: number; timestamp?: number; interval?: TimeInterval; ppValue?: number }>;
  isEmpty?: boolean;
  ctaText?: string;
  isIncreasing?: boolean;
  intervalType?: IntervalType; // Add interval type to track how data is aggregated
}

export interface KPICardProps {
  data: KPICardData;
  onClick?: () => void;
  onIntervalHover?: (interval: TimeInterval | null) => void;
  timePeriod?: TimePeriodType;
  submissions?: VideoSubmission[];
  linkClicks?: LinkClick[];
  dateFilter?: DateFilterType;
  customRange?: { startDate: Date; endDate: Date };
  isEditMode?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  isCensored?: boolean;
  onToggleCensor?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
}

