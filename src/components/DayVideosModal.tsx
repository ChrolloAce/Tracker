import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye, Heart, MessageCircle, Share2, Activity, Users, MousePointerClick, TrendingUp, Table2, GalleryHorizontal, Info, RefreshCw, Sparkles } from 'lucide-react';
import { VideoSubmission, VideoSnapshot } from '../types';
import { computeIntervalBreakdown } from './kpi/kpiDataProcessing';
import { TimeInterval } from '../services/DataAggregationService';
import { LinkClick } from '../services/LinkClicksService';
import VideoSliderSection from './VideoSliderSection';
import { VideoSubmissionsTable } from './VideoSubmissionsTable';
import { AnimatedNumber } from './kpi/AnimatedNumber';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';

interface DayVideosModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  videos: VideoSubmission[];
  metricLabel: string;
  onVideoClick?: (video: VideoSubmission) => void;
  onDelete?: (id: string) => void; // Optional: delete handler
  accountFilter?: string | string[]; // Optional: filter by one or many account usernames (creator-row click passes the full set of linked usernames)
  /** Optional creator display name to render in the header when accountFilter is an array. */
  creatorDisplayName?: string;
  /** Optional: filter videos to a single platform (top-platform row click). */
  platformFilter?: VideoSubmission['platform'];
  dateRangeLabel?: string; // Optional: show date range instead of specific date (e.g., "Last 7 Days")
  interval?: TimeInterval | null; // Optional: interval information for formatted date range
  ppVideos?: VideoSubmission[]; // Previous period videos
  ppInterval?: TimeInterval | null; // Previous period interval
  linkClicks?: LinkClick[]; // Link clicks for the period
  ppLinkClicks?: LinkClick[]; // Previous period link clicks
  dayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // Optional: filter by specific day of week (0 = Sunday, 6 = Saturday)
  hourRange?: { start: number; end: number }; // Optional: filter by hour range (e.g., {start: 13, end: 14})
  selectedPeriodRange?: { startDate: Date; endDate: Date }; // CRITICAL: The overall selected date range (e.g., "Last 30 Days" boundaries)
  /** Per-day revenue map (YYYY-MM-DD → $). Powers the Revenue KPI card when
   *  the org has a Superwall integration configured. */
  revenueByDate?: Record<string, number>;
  // URL routing support
  updateUrlOnOpen?: boolean; // If true, update URL when modal opens
}

const DayVideosModal: React.FC<DayVideosModalProps> = ({
  isOpen,
  onClose,
  date,
  videos,
  metricLabel: _metricLabel,
  onVideoClick,
  onDelete: _onDelete,
  accountFilter,
  creatorDisplayName,
  platformFilter,
  dateRangeLabel,
  interval,
  ppVideos = [],
  ppInterval,
  linkClicks = [],
  ppLinkClicks = [],
  dayOfWeek,
  hourRange,
  selectedPeriodRange,
  revenueByDate,
  updateUrlOnOpen = true
}) => {
  const [showPreviousPeriod, setShowPreviousPeriod] = useState(false);
  const [viewMode, setViewMode] = useState<'slider' | 'table'>('slider');
  // Which video set to show: videos uploaded IN this period (new) vs videos
  // uploaded BEFORE that grew during the period (refreshed).
  const [videoSet, setVideoSet] = useState<'new' | 'refreshed'>('new');
  const [showVideoSetTip, setShowVideoSetTip] = useState(false);
  const [sortKey, setSortKey] = useState<'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'recent'>('views');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  // Creator filter — null means show all. Picked from the avatars bar.
  const [creatorFilter, setCreatorFilter] = useState<string | null>(null);
  const [showCreatorMenu, setShowCreatorMenu] = useState(false);
  const creatorMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
      if (creatorMenuRef.current && !creatorMenuRef.current.contains(e.target as Node)) {
        setShowCreatorMenu(false);
      }
    };
    if (showSortMenu || showCreatorMenu) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showSortMenu, showCreatorMenu]);
  const [searchParams, setSearchParams] = useSearchParams();

  // Normalize accountFilter to a lowercase Set so the rest of the component
  // can treat single-username and creator-row (multi-username) clicks
  // identically. matchesAccount(handle) returns true when the filter is
  // unset OR the handle is in the set.
  const accountFilterSet = useMemo<Set<string> | null>(() => {
    if (!accountFilter) return null;
    const arr = Array.isArray(accountFilter) ? accountFilter : [accountFilter];
    const lowered = arr.filter(Boolean).map(a => a.toLowerCase());
    return lowered.length ? new Set(lowered) : null;
  }, [accountFilter]);
  const accountFilterFirst = useMemo(() => {
    if (!accountFilter) return undefined;
    return Array.isArray(accountFilter) ? accountFilter[0] : accountFilter;
  }, [accountFilter]);
  const matchesAccount = useCallback(
    (handle?: string | null) => !accountFilterSet || accountFilterSet.has((handle || '').toLowerCase()),
    [accountFilterSet]
  );
  const matchesPlatform = useCallback(
    (platform?: string | null) => !platformFilter || platform === platformFilter,
    [platformFilter]
  );

  // Update URL when modal opens (if enabled)
  useEffect(() => {
    if (isOpen && updateUrlOnOpen) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('modal', 'day-videos');
      newParams.set('date', date.toISOString());
      if (accountFilter) {
        const acc = Array.isArray(accountFilter) ? accountFilter.join(',') : accountFilter;
        if (acc) newParams.set('account', acc);
      }
      if (interval) {
        newParams.set('interval', JSON.stringify({
          startDate: interval.startDate.toISOString(),
          endDate: interval.endDate.toISOString(),
          intervalType: interval.intervalType
        }));
      }
      setSearchParams(newParams, { replace: false });
    }
  }, [isOpen, date, accountFilter, interval, updateUrlOnOpen, searchParams, setSearchParams]);

  // Handle close - remove modal params from URL
  const handleClose = () => {
    if (updateUrlOnOpen) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('modal');
      newParams.delete('date');
      newParams.delete('account');
      newParams.delete('interval');
      setSearchParams(newParams, { replace: false });
    }
    onClose();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatIntervalRange = (interval: TimeInterval): string => {
    const startDate = new Date(interval.startDate);
    const endDate = new Date(interval.endDate);
    
    switch (interval.intervalType) {
      case 'year':
        // Just show the year: "2024"
        return startDate.getFullYear().toString();
      
      case 'month':
        // Show month and year: "Oct 2024"
        return startDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short'
        });
      
      case 'week':
        // Show date range: "Sun, Oct 1, 2024 - Sat, Oct 7, 2024"
        const startFormatted = startDate.toLocaleDateString('en-US', { 
          weekday: 'short',
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
        const endFormatted = endDate.toLocaleDateString('en-US', { 
          weekday: 'short',
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
        return `${startFormatted} - ${endFormatted}`;
      
      case 'day':
      default:
        // Show single day: "Sun, Oct 1, 2024"
        return formatDate(startDate);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Unused helper functions - kept for potential future use
  // @ts-ignore - Keeping for reference
  const _formatPercentage = (percent: number): string => {
    const absPercent = Math.abs(percent);
    if (absPercent >= 1_000_000) {
      return `${(percent / 1_000_000).toFixed(1)}M`;
    } else if (absPercent >= 1_000) {
      return `${(percent / 1_000).toFixed(1)}K`;
    }
    return percent.toFixed(0);
  };

  // @ts-ignore - Keeping for reference
  const _getPercentageColor = (percent: number): string => {
    return percent >= 0 ? 'text-emerald-400' : 'text-red-400';
  };

  // @ts-ignore - Keeping for reference
  const _getPercentageBgColor = (percent: number): string => {
    return percent >= 0 
      ? 'bg-emerald-500/10 border-emerald-500/20' 
      : 'bg-red-500/10 border-red-500/20';
  };

  // @ts-ignore - Keeping for reference
  const _calculateEngagementRate = (video: VideoSubmission): number => {
    if (!video.views || video.views === 0) return 0;
    const engagements = (video.likes || 0) + (video.comments || 0) + (video.shares || 0);
    return (engagements / video.views) * 100;
  };

  const getDayName = (dayIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayIndex];
  };

  const formatHourRange = (start: number, end: number): string => {
    const formatHour = (hour: number) => {
      const h = hour % 12 === 0 ? 12 : hour % 12;
      const period = hour < 12 ? 'AM' : 'PM';
      return `${h} ${period}`;
    };
    return `${formatHour(start)} - ${formatHour(end)}`;
  };

  const calculateComparison = (cpValue: number, ppValue: number) => {
    if (ppValue === 0) return { percentChange: 0, isPositive: true };
    const percentChange = ((cpValue - ppValue) / ppValue) * 100;
    return {
      percentChange: Math.abs(percentChange),
      isPositive: percentChange >= 0
    };
  };

  const hasPPData = ppInterval !== null && ppInterval !== undefined;

  // Calculate all KPI metrics for current period
  const cpKPIMetrics = useMemo(() => {
    let videosToUse = videos;

    // Filter out invalid/empty videos (0 views, no caption, no data)
    videosToUse = videosToUse.filter(v => {
      const hasStats = (v.views || 0) > 0 || (v.likes || 0) > 0 || (v.comments || 0) > 0;
      const hasContent = (v.title && v.title !== '(No caption)') || (v.caption && v.caption !== '(No caption)');
      return hasStats || hasContent; // Keep video if it has either stats OR content
    });

    // Apply account filter (caller-provided context). When clicking a creator
    // row, accountFilter is the array of all linked usernames; matchesAccount
    // handles both shapes.
    if (accountFilterSet) {
      videosToUse = videosToUse.filter(v => matchesAccount(v.uploaderHandle));
    }

    if (platformFilter) {
      videosToUse = videosToUse.filter(v => matchesPlatform(v.platform));
    }

    // In-modal creator filter from the avatars-bar dropdown. Re-running this
    // useMemo when the filter changes is what re-renders the metric cards
    // and triggers the AnimatedNumber tween in MetricCard.
    if (creatorFilter) {
      videosToUse = videosToUse.filter(v => (v.uploaderHandle || 'unknown') === creatorFilter);
    }

    // Apply day of week filter
    if (dayOfWeek !== undefined) {
      videosToUse = videosToUse.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        return videoDate.getDay() === dayOfWeek;
      });
    }
    
    // Apply hour range filter
    if (hourRange) {
      videosToUse = videosToUse.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        const hour = videoDate.getHours();
        return hour >= hourRange.start && hour < hourRange.end;
      });
    }
    
    // Bucketed totals — track new-uploads vs refreshed-growth so the badges
    // displayed under each KPI add up to the headline number. Math is shared
    // with the unified chart's bar generator (computeIntervalBreakdown lives in
    // kpiDataProcessing.ts) so the value the user clicks on the bar matches
    // what this modal shows. NEVER inline this math here again — chart and
    // popup must stay in lockstep.
    let newViews = 0, newLikes = 0, newComments = 0, newShares = 0;
    let refViews = 0, refLikes = 0, refComments = 0, refShares = 0;
    let newUploadCount = 0;
    let refreshedCount = 0;
    const activeAccounts = new Set<string>();

    if (interval) {
      // Cap baseline = end of the OVERALL selected range (e.g. "Last 30 Days"
      // boundary), matching what generateSparklineData passes as actualEndDate.
      // Falls back to interval.endDate when no period range is provided.
      const rangeEndDate = selectedPeriodRange?.endDate || interval.endDate;
      const rangeStartDate = selectedPeriodRange?.startDate || null;
      // excludeSparked: true mirrors the chart, which subtracts paid-views
      // per-bar in 'organic' mode (the only mode the dashboard runs in
      // since the reporting toggle was removed).
      // rangeStartDate switches the breakdown to the "credit by upload
      // date" attribution rule: videos uploaded inside this bucket get
      // their full at-period-end lifetime credited here, NOT just the
      // first-day slice. Videos uploaded in the period but in a different
      // bucket are skipped (already credited at their upload bucket).
      const breakdown = computeIntervalBreakdown(
        videosToUse,
        interval.startDate,
        interval.endDate,
        rangeEndDate,
        { excludeSparked: true, rangeStartDate },
      );
      newViews = breakdown.newViews;
      newLikes = breakdown.newLikes;
      newComments = breakdown.newComments;
      newShares = breakdown.newShares;
      refViews = breakdown.refViews;
      refLikes = breakdown.refLikes;
      refComments = breakdown.refComments;
      refShares = breakdown.refShares;
      newUploadCount = breakdown.newUploadCount;
      refreshedCount = breakdown.refreshedCount;
      breakdown.activeAccounts.forEach(a => activeAccounts.add(a));
    } else {
      // No interval — degrade to summing current totals as a single bucket.
      newViews = videosToUse.reduce((sum, v) => sum + (v.views || 0), 0);
      newLikes = videosToUse.reduce((sum, v) => sum + (v.likes || 0), 0);
      newComments = videosToUse.reduce((sum, v) => sum + (v.comments || 0), 0);
      newShares = videosToUse.reduce((sum, v) => sum + (v.shares || 0), 0);
      newUploadCount = videosToUse.length;
      videosToUse.forEach(v => v.uploaderHandle && activeAccounts.add(v.uploaderHandle));
    }

    const totalViews = newViews + refViews;
    const totalLikes = newLikes + refLikes;
    const totalComments = newComments + refComments;
    const totalShares = newShares + refShares;
    const engagementRate = totalViews > 0 ? ((totalLikes + totalComments + totalShares) / totalViews) * 100 : 0;
    const newEngRate = newViews > 0 ? ((newLikes + newComments + newShares) / newViews) * 100 : 0;
    const refEngRate = refViews > 0 ? ((refLikes + refComments + refShares) / refViews) * 100 : 0;

    return {
      views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      engagementRate,
      // Videos count = videos POSTED in this period (matches the user's
      // mental model — clicking on Apr 23 = "how many did we post that day").
      // Refreshed count is still surfaced in the breakdown tooltip below.
      videos: newUploadCount,
      accounts: activeAccounts.size,
      clicks: linkClicks.length,
      breakdown: {
        new: {
          views: newViews, likes: newLikes, comments: newComments, shares: newShares,
          videos: newUploadCount, engagementRate: newEngRate,
        },
        refreshed: {
          views: refViews, likes: refLikes, comments: refComments, shares: refShares,
          videos: refreshedCount, engagementRate: refEngRate,
        },
      },
    };
  }, [videos, accountFilter, platformFilter, creatorFilter, linkClicks, dayOfWeek, hourRange, interval, selectedPeriodRange]);

  // Calculate all KPI metrics for previous period
  const ppKPIMetrics = useMemo(() => {
    let videosToUse = ppVideos;
    
    // Filter out invalid/empty videos (0 views, no caption, no data)
    videosToUse = videosToUse.filter(v => {
      const hasStats = (v.views || 0) > 0 || (v.likes || 0) > 0 || (v.comments || 0) > 0;
      const hasContent = (v.title && v.title !== '(No caption)') || (v.caption && v.caption !== '(No caption)');
      return hasStats || hasContent; // Keep video if it has either stats OR content
    });
    
    // Apply account filter
    if (accountFilterSet) {
      videosToUse = videosToUse.filter(v => matchesAccount(v.uploaderHandle));
    }

    if (platformFilter) {
      videosToUse = videosToUse.filter(v => matchesPlatform(v.platform));
    }

    // Apply day of week filter
    if (dayOfWeek !== undefined) {
      videosToUse = videosToUse.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        return videoDate.getDay() === dayOfWeek;
      });
    }
    
    // Apply hour range filter
    if (hourRange) {
      videosToUse = videosToUse.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        const hour = videoDate.getHours();
        return hour >= hourRange.start && hour < hourRange.end;
      });
    }
    
    const totalViews = videosToUse.reduce((sum, v) => sum + (v.views || 0), 0);
    const totalLikes = videosToUse.reduce((sum, v) => sum + (v.likes || 0), 0);
    const totalComments = videosToUse.reduce((sum, v) => sum + (v.comments || 0), 0);
    const totalShares = videosToUse.reduce((sum, v) => sum + (v.shares || 0), 0);
    const totalEngagement = totalLikes + totalComments + totalShares;
    const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;
    const uniqueAccounts = new Set(videosToUse.map(v => v.uploaderHandle)).size;
    const clicksCount = ppLinkClicks.length;

    return {
      views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      engagementRate,
      videos: videosToUse.length,
      accounts: uniqueAccounts,
      clicks: clicksCount,
      // Empty breakdown for type parity with cpKPIMetrics — PP is mostly used
      // as a comparison ratio, so the per-bucket split isn't shown anyway.
      breakdown: {
        new: { views: 0, likes: 0, comments: 0, shares: 0, videos: 0, engagementRate: 0 },
        refreshed: { views: 0, likes: 0, comments: 0, shares: 0, videos: 0, engagementRate: 0 },
      },
    };
  }, [ppVideos, accountFilter, platformFilter, ppLinkClicks, dayOfWeek, hourRange]);

  // Calculate New Uploads (most recent videos in the period)
  // Use ALL videos (not filteredVideos) to match tooltip behavior
  const newUploads = useMemo(() => {
    // Start with all videos in the period
    let videosToShow = videos;
    
    // Filter out invalid/empty videos (0 views, no caption, no data)
    videosToShow = videosToShow.filter(v => {
      const hasStats = (v.views || 0) > 0 || (v.likes || 0) > 0 || (v.comments || 0) > 0;
      const hasContent = (v.title && v.title !== '(No caption)') || (v.caption && v.caption !== '(No caption)');
      return hasStats || hasContent; // Keep video if it has either stats OR content
    });
    
    // Filter by interval if present (only show videos uploaded in this specific interval)
    if (interval) {
      videosToShow = videosToShow.filter(v => {
        const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        return uploadDate >= interval.startDate && uploadDate <= interval.endDate;
      });
    }
    
    // Apply account filter if present (to match context)
    if (accountFilterSet) {
      videosToShow = videosToShow.filter(v => matchesAccount(v.uploaderHandle));
    }

    if (platformFilter) {
      videosToShow = videosToShow.filter(v => matchesPlatform(v.platform));
    }

    // Apply day of week filter if present
    if (dayOfWeek !== undefined) {
      videosToShow = videosToShow.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        return videoDate.getDay() === dayOfWeek;
      });
    }
    
    // Apply hour range filter if present
    if (hourRange) {
      videosToShow = videosToShow.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        const hour = videoDate.getHours();
        return hour >= hourRange.start && hour < hourRange.end;
      });
    }
    
    // Sort by upload date (most recent first) and show ALL videos (no limit)
    return [...videosToShow]
      .sort((a, b) => {
        const dateA = a.uploadDate ? new Date(a.uploadDate) : new Date(a.dateSubmitted);
        const dateB = b.uploadDate ? new Date(b.uploadDate) : new Date(b.dateSubmitted);
        return dateB.getTime() - dateA.getTime();
      });
  }, [videos, accountFilter, platformFilter, dayOfWeek, hourRange, interval]);

  /**
   * Refreshed videos: uploaded BEFORE the active interval but had snapshot
   * growth inside it. Stats overridden to show the views/likes gained in
   * this interval (the "delta") rather than lifetime totals — matches what
   * the breakdown badges count as "Refreshed".
   */
  const refreshedVideos = useMemo(() => {
    if (!interval) return [];
    let pool = videos.filter(v => {
      const hasStats = (v.views || 0) > 0 || (v.likes || 0) > 0 || (v.comments || 0) > 0;
      const hasContent = (v.title && v.title !== '(No caption)') || (v.caption && v.caption !== '(No caption)');
      return hasStats || hasContent;
    });
    if (accountFilterSet) pool = pool.filter(v => matchesAccount(v.uploaderHandle));
    if (platformFilter) pool = pool.filter(v => matchesPlatform(v.platform));
    if (dayOfWeek !== undefined) pool = pool.filter(v => {
      const d = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
      return d.getDay() === dayOfWeek;
    });
    if (hourRange) pool = pool.filter(v => {
      const d = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
      const h = d.getHours();
      return h >= hourRange.start && h < hourRange.end;
    });

    const out: VideoSubmission[] = [];
    // Period-aware classification: only videos uploaded BEFORE the broader
    // selected period count as refreshed. Videos uploaded inside the period
    // (this bucket OR another) are credited to their upload-day's "New"
    // bucket and must NOT show in any day's refreshed list — that would
    // double-count their views and disagree with the badge totals.
    const periodStart = selectedPeriodRange?.startDate ?? interval.startDate;
    pool.forEach(video => {
      const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
      // Skip videos uploaded anywhere inside the broader period — they're
      // "new" attached to their upload day, not refreshed here.
      if (uploadDate >= periodStart) return;

      const snapshots = (video.snapshots || []).slice();
      // Synthesize a "now" snapshot if the latest stats are newer than the
      // last captured snapshot — same trick cpKPIMetrics uses.
      const lastSnap = snapshots[snapshots.length - 1];
      const differs = !lastSnap ||
        (lastSnap.views || 0) !== (video.views || 0) ||
        (lastSnap.likes || 0) !== (video.likes || 0) ||
        (lastSnap.comments || 0) !== (video.comments || 0) ||
        (lastSnap.shares || 0) !== (video.shares || 0);
      if (differs && video.lastRefreshed) {
        snapshots.push({
          id: `${video.id}-current`,
          videoId: video.id,
          views: video.views || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          saves: video.saves || 0,
          capturedAt: video.lastRefreshed instanceof Date ? video.lastRefreshed : new Date(video.lastRefreshed as any),
          capturedBy: 'scheduled_refresh',
          isInitialSnapshot: false,
        } as VideoSnapshot);
      }
      if (snapshots.length === 0) return;

      const sorted = [...snapshots].sort((a, b) => {
        const da = a.capturedAt instanceof Date ? a.capturedAt : new Date(a.capturedAt);
        const db = b.capturedAt instanceof Date ? b.capturedAt : new Date(b.capturedAt);
        return da.getTime() - db.getTime();
      });
      const baseline =
        sorted.filter(s => {
          const c = s.capturedAt instanceof Date ? s.capturedAt : new Date(s.capturedAt);
          return c <= interval.startDate;
        }).pop() ||
        sorted.find(s => s.isInitialSnapshot) ||
        sorted[0];
      const endSnap = sorted.filter(s => {
        const c = s.capturedAt instanceof Date ? s.capturedAt : new Date(s.capturedAt);
        return c <= interval.endDate;
      }).pop();
      if (!baseline || !endSnap) return;

      const dViews = Math.max(0, (endSnap.views || 0) - (baseline.views || 0));
      const dLikes = Math.max(0, (endSnap.likes || 0) - (baseline.likes || 0));
      const dComments = Math.max(0, (endSnap.comments || 0) - (baseline.comments || 0));
      const dShares = Math.max(0, (endSnap.shares || 0) - (baseline.shares || 0));
      const dSaves = Math.max(0, (endSnap.saves || 0) - (baseline.saves || 0));
      if (dViews + dLikes + dComments + dShares === 0) return;

      out.push({
        ...video,
        // Override displayed stats with the in-period gain so the table /
        // slider show "what they earned during this period", not lifetime.
        views: dViews,
        likes: dLikes,
        comments: dComments,
        shares: dShares,
        saves: dSaves,
        bookmarks: dSaves,
      } as VideoSubmission);
    });
    return out.sort((a, b) => (b.views || 0) - (a.views || 0));
  }, [videos, accountFilter, platformFilter, dayOfWeek, hourRange, interval]);


  // Calculate PP New Uploads (using ppVideos and ppInterval)
  const ppNewUploads = useMemo(() => {
    if (!ppVideos || !ppInterval) return [];
    
    let videosToShow = ppVideos;
    
    // Filter out invalid/empty videos
    videosToShow = videosToShow.filter(v => {
      const hasStats = (v.views || 0) > 0 || (v.likes || 0) > 0 || (v.comments || 0) > 0;
      const hasContent = (v.title && v.title !== '(No caption)') || (v.caption && v.caption !== '(No caption)');
      return hasStats || hasContent;
    });
    
    // Filter by interval
    videosToShow = videosToShow.filter(v => {
      const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
      return uploadDate >= ppInterval.startDate && uploadDate <= ppInterval.endDate;
    });
    
    // Apply filters
    if (accountFilterSet) {
      videosToShow = videosToShow.filter(v => matchesAccount(v.uploaderHandle));
    }

    if (platformFilter) {
      videosToShow = videosToShow.filter(v => matchesPlatform(v.platform));
    }

    if (dayOfWeek !== undefined) {
      videosToShow = videosToShow.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        return videoDate.getDay() === dayOfWeek;
      });
    }
    
    if (hourRange) {
      videosToShow = videosToShow.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        const hour = videoDate.getHours();
        return hour >= hourRange.start && hour < hourRange.end;
      });
    }
    
    return [...videosToShow]
      .sort((a, b) => {
        const dateA = a.uploadDate ? new Date(a.uploadDate) : new Date(a.dateSubmitted);
        const dateB = b.uploadDate ? new Date(b.uploadDate) : new Date(b.dateSubmitted);
        return dateB.getTime() - dateA.getTime();
      });
  }, [ppVideos, ppInterval, accountFilter, platformFilter, dayOfWeek, hourRange]);

  // Calculate total views from new uploads (kept for potential future use)
  // @ts-ignore - Keeping for reference
  const _totalNewUploadViews = useMemo(() => {
    return newUploads.reduce((sum, video) => sum + (video.views || 0), 0);
  }, [newUploads]);

  // (filteredTopGainers / totalRefreshedViewsGained were only used by the
  // old performance-summary card. The new header subtitle reads
  // breakdown.refreshed.views off cpKPIMetrics, which is derived from the
  // same calc as the metric card totals — guaranteeing they agree.)

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div 
        className="bg-surface-secondary rounded-xl shadow-2xl w-full max-w-full sm:max-w-7xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimal Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-border">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <h2 className="text-sm sm:text-lg font-semibold text-content truncate">
              {(() => {
                if (dayOfWeek !== undefined && hourRange) {
                  const dayName = getDayName(dayOfWeek);
                  const timeRange = formatHourRange(hourRange.start, hourRange.end);
                  return `${dayName} ${timeRange}`;
                }
                const formatSpan = (intvl: TimeInterval): string => {
                  const ms = intvl.endDate.getTime() - intvl.startDate.getTime();
                  const totalDays = Math.max(1, Math.round(ms / 86_400_000));
                  if (totalDays === 1) return '1 day';
                  if (totalDays < 7) return `${totalDays} days`;
                  const weeks = Math.floor(totalDays / 7);
                  const days = totalDays - weeks * 7;
                  const wkLabel = `${weeks} week${weeks > 1 ? 's' : ''}`;
                  if (days === 0) return wkLabel;
                  return `${wkLabel} ${days} day${days > 1 ? 's' : ''}`;
                };
                const currentInterval = showPreviousPeriod ? ppInterval : interval;
                // For a creator click (multi-username) prefer the creator's
                // displayName; for a single-account click show the @handle;
                // for a top-platform click show the capitalized platform name.
                const platformLabel = platformFilter
                  ? platformFilter.charAt(0).toUpperCase() + platformFilter.slice(1)
                  : '';
                const accountLabel = accountFilterSet
                  ? (creatorDisplayName || (accountFilterFirst ? `@${accountFilterFirst}` : ''))
                  : platformLabel;
                let body: string;
                if (currentInterval) {
                  body = accountLabel
                    ? `${accountLabel} · ${formatIntervalRange(currentInterval)}`
                    : formatIntervalRange(currentInterval);
                } else if (dateRangeLabel && accountLabel) {
                  body = `${accountLabel} · ${dateRangeLabel}`;
                } else {
                  body = dateRangeLabel || formatDate(date);
                }
                const span = currentInterval ? ` (${formatSpan(currentInterval)})` : '';
                return `Metrics for ${body}${span}`;
              })()}
            </h2>
            {/* Source-of-views subtitle — uses the SAME breakdown numbers as the
                metric cards so the percentages always agree. */}
            {(() => {
              const total = cpKPIMetrics.breakdown.new.views + cpKPIMetrics.breakdown.refreshed.views;
              if (total === 0) return null;
              const newPct = Math.round((cpKPIMetrics.breakdown.new.views / total) * 100);
              const refPct = 100 - newPct;
              return (
                <p className="text-[11px] sm:text-xs text-content-muted truncate">
                  <span className="font-semibold text-content">{newPct}%</span> of views came from new uploads,{' '}
                  <span className="font-semibold text-content">{refPct}%</span> from refreshed videos
                </p>
              );
            })()}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Period Toggle Tabs */}
            {hasPPData && (
              <div className="flex items-center bg-surface-tertiary rounded-lg p-0.5 border border-border-subtle">
              <button
                  onClick={() => setShowPreviousPeriod(false)}
                  className={`px-2 sm:px-3 py-1 rounded text-[10px] sm:text-xs font-medium transition-all ${
                    !showPreviousPeriod 
                      ? 'bg-surface-active text-content' 
                      : 'text-content-muted hover:text-content-secondary'
                  }`}
                  title={`View data for ${interval ? (() => {
                    const formatDateRange = (startDate: Date, endDate: Date) => {
                      const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
                      const startDay = startDate.getDate();
                      const endDay = endDate.getDate();
                      const startMonthNum = startDate.getMonth();
                      const endMonthNum = endDate.getMonth();
                      if (startMonthNum === endMonthNum && startDay === endDay) return `${startMonth} ${startDay}`;
                      if (startMonthNum === endMonthNum) return `${startMonth} ${startDay} - ${endDay}`;
                      const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
                      return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
                    };
                    return formatDateRange(interval.startDate, interval.endDate);
                  })() : 'current period'}`}
                >
                  Current Period
              </button>
                <button
                  onClick={() => setShowPreviousPeriod(true)}
                  className={`px-2 sm:px-3 py-1 rounded text-[10px] sm:text-xs font-medium transition-all ${
                    showPreviousPeriod 
                      ? 'bg-surface-active text-content' 
                      : 'text-content-muted hover:text-content-secondary'
                  }`}
                  title={`View data for ${ppInterval ? (() => {
                    const formatDateRange = (startDate: Date, endDate: Date) => {
                      const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
                      const startDay = startDate.getDate();
                      const endDay = endDate.getDate();
                      const startMonthNum = startDate.getMonth();
                      const endMonthNum = endDate.getMonth();
                      if (startMonthNum === endMonthNum && startDay === endDay) return `${startMonth} ${startDay}`;
                      if (startMonthNum === endMonthNum) return `${startMonth} ${startDay} - ${endDay}`;
                      const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
                      return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
                    };
                    return formatDateRange(ppInterval.startDate, ppInterval.endDate);
                  })() : 'previous period'}`}
                >
                  Previous Period
                </button>
              </div>
            )}
            <button
              onClick={handleClose}
              className="p-1 sm:p-1.5 hover:bg-surface-hover rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-content-muted" />
            </button>
          </div>
        </div>

        {/* Main Content - Reorganized Layout */}
        <div className="p-3 sm:p-6 overflow-y-auto overflow-x-hidden" style={{ maxHeight: 'calc(95vh - 60px)' }}>
          {/* Stacked Layout: KPI strip on top, video tables below (matches viral.app overview) */}
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* TABLES — render after the KPI strip via order-2 */}
            <div className="flex-1 space-y-3 min-w-0 order-2 overflow-x-hidden">
              {(() => {
                // Pick the active list based on the New / Refreshed toggle.
                // PP only has "new" data (we don't compute refreshed for PP).
                const baseSet = videoSet === 'refreshed' && !showPreviousPeriod
                  ? refreshedVideos
                  : (showPreviousPeriod ? ppNewUploads : newUploads);
                const videosToShow = baseSet;
                const hasVideos = videosToShow.length > 0;

                if (!hasVideos) {
                  return (
                    <div className="flex items-center justify-center py-16 px-4">
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-hover flex items-center justify-center">
                          <TrendingUp className="w-8 h-8 text-content-muted" />
                        </div>
                        <h3 className="text-lg font-semibold text-content mb-2">
                          {videoSet === 'refreshed' ? 'No Refreshed Videos' : 'No Videos Posted'}
                        </h3>
                        <p className="text-sm text-content-muted">
                          {videoSet === 'refreshed'
                            ? 'No older videos grew during this period'
                            : 'No new uploads in this period'}
                        </p>
                      </div>
                    </div>
                  );
                }

                // Build creator stats from the FULL set (so the avatar bar
                // count doesn't shrink when a filter is applied).
                const creatorStats = (() => {
                  const map = new Map<string, { handle: string; avatar: string | undefined; count: number; topViews: number }>();
                  videosToShow.forEach(v => {
                    const handle = v.uploaderHandle || 'unknown';
                    const existing = map.get(handle);
                    if (existing) {
                      existing.count += 1;
                      if ((v.views || 0) > existing.topViews) existing.topViews = v.views || 0;
                    } else {
                      map.set(handle, {
                        handle,
                        avatar: v.uploaderProfilePicture,
                        count: 1,
                        topViews: v.views || 0,
                      });
                    }
                  });
                  return Array.from(map.values()).sort((a, b) => b.count - a.count || b.topViews - a.topViews);
                })();

                // Apply creator filter (after computing stats, before sort)
                const filteredByCreator = creatorFilter
                  ? videosToShow.filter(v => (v.uploaderHandle || 'unknown') === creatorFilter)
                  : videosToShow;

                // Sort videos before rendering. Engagement is a derived rate.
                const sortedVideos = [...filteredByCreator].sort((a, b) => {
                  const get = (v: VideoSubmission): number => {
                    switch (sortKey) {
                      case 'views': return v.views || 0;
                      case 'likes': return v.likes || 0;
                      case 'comments': return v.comments || 0;
                      case 'shares': return v.shares || 0;
                      case 'engagement': {
                        const eng = (v.likes || 0) + (v.comments || 0) + (v.shares || 0);
                        return v.views ? (eng / v.views) * 100 : 0;
                      }
                      case 'recent':
                        return new Date(v.uploadDate || v.dateSubmitted).getTime();
                      default: return 0;
                    }
                  };
                  return get(b) - get(a);
                });

                const sortLabels: Record<typeof sortKey, string> = {
                  views: 'Views',
                  likes: 'Likes',
                  comments: 'Comments',
                  shares: 'Shares',
                  engagement: 'Engagement',
                  recent: 'Most recent',
                };

                return (
                  <div className="w-full">
                    {/* Section header: title + creators bar + new/refreshed + sort + view toggle */}
                    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-content">
                        {videoSet === 'refreshed' ? 'Refreshed Videos' : 'New Videos'}{' '}
                        <span className="text-content-muted font-medium">({sortedVideos.length})</span>
                      </h3>
                      <div className="flex items-center gap-2">
                        {/* New / Refreshed toggle with info tooltip */}
                        <div className="relative flex items-center gap-1">
                          <div className="inline-flex rounded-lg bg-surface-tertiary border border-border-subtle p-0.5">
                            <button
                              onClick={() => setVideoSet('new')}
                              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                videoSet === 'new'
                                  ? 'bg-surface text-content shadow-sm'
                                  : 'text-content-muted hover:text-content'
                              }`}
                              title="Videos posted in this period"
                            >
                              <Sparkles className="w-3 h-3" />
                              New
                            </button>
                            <button
                              onClick={() => setVideoSet('refreshed')}
                              disabled={showPreviousPeriod}
                              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                videoSet === 'refreshed'
                                  ? 'bg-surface text-content shadow-sm'
                                  : 'text-content-muted hover:text-content'
                              }`}
                              title="Older videos that grew in this period"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Refreshed
                            </button>
                          </div>
                          <button
                            onMouseEnter={() => setShowVideoSetTip(true)}
                            onMouseLeave={() => setShowVideoSetTip(false)}
                            className="text-content-muted hover:text-content-secondary transition-colors"
                          >
                            <Info className="w-3.5 h-3.5" style={{ opacity: 0.6 }} />
                          </button>
                          {showVideoSetTip && (
                            <div className="absolute right-0 top-full mt-2 w-64 p-3 rounded-lg bg-surface-tertiary border border-border shadow-xl z-50 pointer-events-none">
                              <p className="text-[11px] text-content-secondary leading-relaxed">
                                <span className="font-semibold text-content">New</span>: videos uploaded during this period.{' '}
                                <span className="font-semibold text-content">Refreshed</span>: older videos that gained views/likes during this period (stats shown are the in-period gain, not lifetime).
                              </p>
                            </div>
                          )}
                        </div>
                        {/* Creators bar — stacked avatars + count, opens select-creator menu */}
                        {creatorStats.length > 0 && (
                          <div ref={creatorMenuRef} className="relative">
                            <button
                              onClick={() => setShowCreatorMenu(o => !o)}
                              className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-content-secondary hover:text-content bg-surface-tertiary hover:bg-surface-hover rounded-lg border border-border-subtle transition-colors"
                              title="Filter by creator"
                            >
                              {/* Stacked avatars (up to 3) */}
                              <div className="flex -space-x-2">
                                {creatorStats.slice(0, 3).map(c => (
                                  c.avatar ? (
                                    <img
                                      key={c.handle}
                                      src={c.avatar}
                                      alt={c.handle}
                                      className="w-5 h-5 rounded-full object-cover ring-2 ring-surface-tertiary"
                                    />
                                  ) : (
                                    <div
                                      key={c.handle}
                                      className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-[9px] font-bold ring-2 ring-surface-tertiary"
                                    >
                                      {c.handle.charAt(0).toUpperCase()}
                                    </div>
                                  )
                                ))}
                              </div>
                              <span>
                                {creatorFilter
                                  ? `@${creatorFilter}`
                                  : `${creatorStats.length} creator${creatorStats.length === 1 ? '' : 's'} posted`}
                              </span>
                              {creatorFilter && (
                                <span
                                  role="button"
                                  onClick={(e) => { e.stopPropagation(); setCreatorFilter(null); }}
                                  className="ml-1 p-0.5 rounded hover:bg-surface-active"
                                >
                                  <X className="w-3 h-3" />
                                </span>
                              )}
                            </button>
                            {showCreatorMenu && (
                              <div className="absolute right-0 top-full mt-2 w-60 max-h-72 overflow-y-auto rounded-lg bg-surface-tertiary border border-border shadow-xl z-50">
                                <button
                                  onClick={() => { setCreatorFilter(null); setShowCreatorMenu(false); }}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-sm border-b border-border-subtle ${
                                    creatorFilter === null
                                      ? 'bg-surface-hover text-content'
                                      : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                                  }`}
                                >
                                  <span className="font-semibold">All creators</span>
                                  <span className="text-xs text-content-muted">{videosToShow.length}</span>
                                </button>
                                {creatorStats.map(c => (
                                  <button
                                    key={c.handle}
                                    onClick={() => { setCreatorFilter(c.handle); setShowCreatorMenu(false); }}
                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm ${
                                      creatorFilter === c.handle
                                        ? 'bg-surface-hover text-content'
                                        : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {c.avatar ? (
                                        <img src={c.avatar} alt={c.handle} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                                      ) : (
                                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                                          {c.handle.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="truncate">@{c.handle}</span>
                                    </div>
                                    <span className="text-xs text-content-muted flex-shrink-0">{c.count}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sort dropdown moved INTO the slider's top-right
                            cluster — the table view sorts via column headers,
                            so a single global sort here would be misleading. */}
                        {/* View toggle: slider | table */}
                        <div className="inline-flex rounded-lg bg-surface-tertiary border border-border-subtle p-0.5">
                          <button
                            onClick={() => setViewMode('slider')}
                            className={`p-1.5 rounded-md transition-all ${
                              viewMode === 'slider'
                                ? 'bg-surface text-content shadow-sm'
                                : 'text-content-muted hover:text-content'
                            }`}
                            title="Slider view"
                          >
                            <GalleryHorizontal className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded-md transition-all ${
                              viewMode === 'table'
                                ? 'bg-surface text-content shadow-sm'
                                : 'text-content-muted hover:text-content'
                            }`}
                            title="Table view"
                          >
                            <Table2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Crossfade between the slider and the standard table.
                        Animation is handled by AnimatePresence — the leaving
                        view fades + slides up while the entering view fades
                        + slides in from below. */}
                    <AnimatePresence mode="wait" initial={false}>
                      {viewMode === 'slider' ? (
                        <motion.div
                          key="slider"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <VideoSliderSection
                            videos={sortedVideos}
                            maxVideos={Math.max(20, sortedVideos.length)}
                            onVideoClick={onVideoClick}
                            preserveOrder
                            sortControl={{
                              value: sortKey,
                              label: sortLabels[sortKey],
                              options: (Object.keys(sortLabels) as Array<typeof sortKey>).map(k => ({
                                value: k,
                                label: sortLabels[k],
                              })),
                              onChange: (v) => setSortKey(v as typeof sortKey),
                            }}
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="table"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          className="w-full sm:max-h-[560px] sm:overflow-y-auto overflow-x-hidden"
                        >
                          <VideoSubmissionsTable
                            submissions={sortedVideos}
                            onVideoClick={onVideoClick}
                            // Title is already shown in the section header
                            // above; pass empty string to keep the table chrome
                            // minimal.
                            headerTitle=""
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })()}
            </div>

            {/* TOP STRIP — Performance summary + KPI cards (full width, render first) */}
            <div className="w-full space-y-3 sm:space-y-4 order-1">
              {/* KPI Grid */}
              {(() => {
                // Pull breakdowns from the same calc that produces the headline
                // totals so New + Refreshed always add up to the top number.
                const activeMetrics = showPreviousPeriod ? ppKPIMetrics : cpKPIMetrics;
                const newUploadMetrics = activeMetrics.breakdown?.new ?? {
                  views: 0, likes: 0, comments: 0, shares: 0, videos: 0, engagementRate: 0,
                };
                const refreshedMetrics = activeMetrics.breakdown?.refreshed ?? {
                  views: 0, likes: 0, comments: 0, shares: 0, videos: 0, engagementRate: 0,
                };

                // viral.app-style metric card. Icon-in-square on the left,
                // label/value stacked on the right, subtle gradient + delta.
                const MetricCard: React.FC<{
                  label: string;
                  Icon: React.ComponentType<{ className?: string }>;
                  value: string;
                  delta?: { value: number; isPositive: boolean } | null;
                  tint?: 'emerald' | 'pink' | 'violet' | 'sky' | 'amber' | 'rose' | 'orange';
                  subline?: { newLabel: string; newValue: string; refLabel: string; refValue: string } | null;
                }> = ({ label, Icon, value, delta, tint = 'emerald', subline }) => {
                  // Soft tinted gradient on the right edge — same vibe as viral.app
                  const tintGradient: Record<string, string> = {
                    emerald: 'linear-gradient(135deg, transparent 60%, rgba(16,185,129,0.08) 100%)',
                    pink:    'linear-gradient(135deg, transparent 60%, rgba(236,72,153,0.08) 100%)',
                    violet:  'linear-gradient(135deg, transparent 60%, rgba(167,139,250,0.08) 100%)',
                    sky:     'linear-gradient(135deg, transparent 60%, rgba(59,130,246,0.08) 100%)',
                    amber:   'linear-gradient(135deg, transparent 60%, rgba(245,158,11,0.08) 100%)',
                    rose:    'linear-gradient(135deg, transparent 60%, rgba(244,63,94,0.08) 100%)',
                    orange:  'linear-gradient(135deg, transparent 60%, rgba(251,138,74,0.08) 100%)',
                  };
                  // Hover state + position. We render the tooltip via a portal
                  // to document.body so the modal's `overflow-y-auto` scroll
                  // container can't clip it (which is what was hiding it).
                  const cardRef = useRef<HTMLDivElement | null>(null);
                  const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null);
                  const showTip = useCallback(() => {
                    if (!cardRef.current || !subline) return;
                    const rect = cardRef.current.getBoundingClientRect();
                    setTipPos({
                      left: rect.left + rect.width / 2,
                      top: rect.top - 8, // 8px gap above the card
                    });
                  }, []);
                  const hideTip = useCallback(() => setTipPos(null), []);
                  return (
                    <div
                      ref={cardRef}
                      onMouseEnter={showTip}
                      onMouseLeave={hideTip}
                      className="relative rounded-2xl bg-surface border border-border-subtle hover:border-border-strong shadow-sm hover:shadow-md transition-all"
                      style={{ background: `var(--surface), ${tintGradient[tint]}`, backgroundImage: tintGradient[tint] }}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5">
                        <div className="flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-surface-tertiary border border-border-subtle flex items-center justify-center shadow-sm">
                          <Icon className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-content-secondary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] sm:text-xs text-content-muted font-medium mb-0.5 truncate">
                            {label}
                          </div>
                          <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
                            <AnimatedNumber
                              value={value}
                              className="text-2xl sm:text-3xl font-bold text-content tabular-nums tracking-tight"
                            />
                            {delta && (
                              <span
                                className={`text-xs font-semibold ${
                                  delta.isPositive ? 'text-emerald-500' : 'text-rose-500'
                                }`}
                              >
                                {delta.isPositive ? '+' : '−'}{delta.value.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Portal-rendered hover tooltip — escapes any ancestor
                          overflow by being a direct child of document.body. */}
                      {subline && tipPos && createPortal(
                        <div
                          className="pointer-events-none"
                          style={{
                            position: 'fixed',
                            left: tipPos.left,
                            top: tipPos.top,
                            transform: 'translate(-50%, -100%)',
                            zIndex: 9999,
                          }}
                        >
                          <div className="bg-surface-tertiary border border-border rounded-lg p-2 shadow-xl min-w-[160px]">
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <span className="text-content-muted">{subline.newLabel}</span>
                              <span className="text-content-secondary font-medium">{subline.newValue}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-content-muted">{subline.refLabel}</span>
                              <span className="text-content-secondary font-medium">{subline.refValue}</span>
                            </div>
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                  );
                };

                const cpDeltaFor = (cur: number, prev: number) => {
                  if (!hasPPData) return null;
                  const c = showPreviousPeriod
                    ? calculateComparison(prev, cur)
                    : calculateComparison(cur, prev);
                  return c.percentChange > 0 ? { value: c.percentChange, isPositive: c.isPositive } : null;
                };

                const m = showPreviousPeriod ? ppKPIMetrics : cpKPIMetrics;
                const newEng = newUploadMetrics.views
                  ? ((newUploadMetrics.likes + newUploadMetrics.comments + newUploadMetrics.shares) / newUploadMetrics.views) * 100
                  : 0;
                const refEng = refreshedMetrics.views
                  ? ((refreshedMetrics.likes + refreshedMetrics.comments + refreshedMetrics.shares) / refreshedMetrics.views) * 100
                  : 0;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard
                      label="Views"
                      Icon={Eye}
                      tint="emerald"
                      value={formatNumber(m.views)}
                      delta={cpDeltaFor(cpKPIMetrics.views, ppKPIMetrics.views)}
                      subline={{
                        newLabel: 'New',
                        newValue: formatNumber(newUploadMetrics.views),
                        refLabel: 'Refreshed',
                        refValue: formatNumber(refreshedMetrics.views),
                      }}
                    />
                    <MetricCard
                      label="Likes"
                      Icon={Heart}
                      tint="pink"
                      value={formatNumber(m.likes)}
                      delta={cpDeltaFor(cpKPIMetrics.likes, ppKPIMetrics.likes)}
                      subline={{
                        newLabel: 'New',
                        newValue: formatNumber(newUploadMetrics.likes),
                        refLabel: 'Refreshed',
                        refValue: formatNumber(refreshedMetrics.likes),
                      }}
                    />
                    <MetricCard
                      label="Comments"
                      Icon={MessageCircle}
                      tint="violet"
                      value={formatNumber(m.comments)}
                      delta={cpDeltaFor(cpKPIMetrics.comments, ppKPIMetrics.comments)}
                      subline={{
                        newLabel: 'New',
                        newValue: formatNumber(newUploadMetrics.comments),
                        refLabel: 'Refreshed',
                        refValue: formatNumber(refreshedMetrics.comments),
                      }}
                    />
                    <MetricCard
                      label="Shares"
                      Icon={Share2}
                      tint="sky"
                      value={formatNumber(m.shares)}
                      delta={cpDeltaFor(cpKPIMetrics.shares, ppKPIMetrics.shares)}
                      subline={{
                        newLabel: 'New',
                        newValue: formatNumber(newUploadMetrics.shares),
                        refLabel: 'Refreshed',
                        refValue: formatNumber(refreshedMetrics.shares),
                      }}
                    />
                    <MetricCard
                      label="Engagement"
                      Icon={Activity}
                      tint="amber"
                      value={`${m.engagementRate.toFixed(1)}%`}
                      delta={cpDeltaFor(cpKPIMetrics.engagementRate, ppKPIMetrics.engagementRate)}
                      subline={{
                        newLabel: 'New',
                        newValue: `${newEng.toFixed(1)}%`,
                        refLabel: 'Refreshed',
                        refValue: `${refEng.toFixed(1)}%`,
                      }}
                    />
                    <MetricCard
                      label="Active Accounts"
                      Icon={Users}
                      tint="rose"
                      value={formatNumber(m.accounts)}
                      delta={cpDeltaFor(cpKPIMetrics.accounts, ppKPIMetrics.accounts)}
                    />
                    <MetricCard
                      label="Link Clicks"
                      Icon={MousePointerClick}
                      tint="sky"
                      value={formatNumber(m.clicks)}
                      delta={cpDeltaFor(cpKPIMetrics.clicks, ppKPIMetrics.clicks)}
                    />
                    {/* Revenue (Superwall) — sits next to Link Clicks. When no
                        Superwall data is wired up we still render with $0 +
                        a discovery hint in the label. */}
                    {(() => {
                      let revenueSum = 0;
                      if (revenueByDate && interval) {
                        const cursor = new Date(interval.startDate);
                        const end = new Date(interval.endDate);
                        while (cursor.getTime() <= end.getTime()) {
                          const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
                          revenueSum += revenueByDate[key] || 0;
                          cursor.setDate(cursor.getDate() + 1);
                        }
                      }
                      const revenueDisplay =
                        revenueSum >= 1_000_000 ? `$${(revenueSum / 1_000_000).toFixed(2)}M`
                        : revenueSum >= 1_000 ? `$${(revenueSum / 1_000).toFixed(1)}K`
                        : `$${revenueSum.toFixed(2)}`;
                      return (
                        <MetricCard
                          label={revenueByDate ? 'Revenue' : 'Revenue (Set up Superwall)'}
                          Icon={Activity}
                          tint="orange"
                          value={revenueDisplay}
                        />
                      );
                    })()}
                  </div>
                );
              })()}
                          </div>
                        </div>
                      </div>
                    </div>
    </div>
  );
};

export default DayVideosModal;
