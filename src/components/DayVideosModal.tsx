import React, { useMemo, useState } from 'react';
import { X, Eye, Heart, MessageCircle, Share2, Activity, Video, Users, MousePointerClick } from 'lucide-react';
import { VideoSubmission, VideoSnapshot } from '../types';
import { TimeInterval } from '../services/DataAggregationService';
import { LinkClick } from '../services/LinkClicksService';
import { VideoSubmissionsTable } from './VideoSubmissionsTable';

interface DayVideosModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  videos: VideoSubmission[];
  metricLabel: string;
  onVideoClick?: (video: VideoSubmission) => void;
  accountFilter?: string; // Optional: filter by account username
  dateRangeLabel?: string; // Optional: show date range instead of specific date (e.g., "Last 7 Days")
  interval?: TimeInterval | null; // Optional: interval information for formatted date range
  ppVideos?: VideoSubmission[]; // Previous period videos
  ppInterval?: TimeInterval | null; // Previous period interval
  linkClicks?: LinkClick[]; // Link clicks for the period
  ppLinkClicks?: LinkClick[]; // Previous period link clicks
  dayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // Optional: filter by specific day of week (0 = Sunday, 6 = Saturday)
  hourRange?: { start: number; end: number }; // Optional: filter by hour range (e.g., {start: 13, end: 14})
  selectedPeriodRange?: { startDate: Date; endDate: Date }; // CRITICAL: The overall selected date range (e.g., "Last 30 Days" boundaries)
}

const DayVideosModal: React.FC<DayVideosModalProps> = ({
  isOpen,
  onClose,
  date,
  videos,
  metricLabel: _metricLabel,
  onVideoClick,
  accountFilter,
  dateRangeLabel,
  interval,
  ppVideos = [],
  ppInterval,
  linkClicks = [],
  ppLinkClicks = [],
  dayOfWeek,
  hourRange,
  selectedPeriodRange
}) => {
  const [showPreviousPeriod, setShowPreviousPeriod] = useState(false);

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

  const formatPercentage = (percent: number): string => {
    const absPercent = Math.abs(percent);
    if (absPercent >= 1_000_000) {
      return `${(percent / 1_000_000).toFixed(1)}M`;
    } else if (absPercent >= 1_000) {
      return `${(percent / 1_000).toFixed(1)}K`;
    }
    return percent.toFixed(0);
  };

  const getPercentageColor = (percent: number): string => {
    return percent >= 0 ? 'text-emerald-400' : 'text-red-400';
  };

  const getPercentageBgColor = (percent: number): string => {
    return percent >= 0 
      ? 'bg-emerald-500/10 border-emerald-500/20' 
      : 'bg-red-500/10 border-red-500/20';
  };

  const calculateEngagementRate = (video: VideoSubmission): number => {
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
    
    // Apply account filter
    if (accountFilter) {
      videosToUse = videosToUse.filter(v => v.uploaderHandle?.toLowerCase() === accountFilter.toLowerCase());
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
    
    // If interval is present, calculate growth from snapshots instead of totals
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    
    if (interval) {
      // Calculate growth for each video based on snapshots in the interval
      videosToUse.forEach(video => {
        const uploadDate = video.uploadDate ? new Date(video.uploadDate) : new Date(video.dateSubmitted);
        
        // CRITICAL: Check if video was uploaded within the interval AND within the selected period
        // This prevents videos from outside the selected period appearing in partial intervals at edges
        let isNewUpload = uploadDate >= interval.startDate && uploadDate <= interval.endDate;
        if (selectedPeriodRange && isNewUpload) {
          // Additional check: video must also be uploaded within the overall selected period
          isNewUpload = uploadDate >= selectedPeriodRange.startDate && uploadDate <= selectedPeriodRange.endDate;
        }
        
        // For NEW uploads in this interval, count their full stats (no growth calculation)
        // This ensures new videos contribute their entire view count, not just growth
        if (isNewUpload) {
          totalViews += video.views || 0;
          totalLikes += video.likes || 0;
          totalComments += video.comments || 0;
          totalShares += video.shares || 0;
          return;
        }
        
        const snapshots = video.snapshots || [];
        
        // Include current video metrics if they differ from last snapshot
        const effectiveSnapshots = [...snapshots];
        const lastSnapshot = effectiveSnapshots[effectiveSnapshots.length - 1];
        const metricsDiffer = !lastSnapshot ||
          (lastSnapshot.views || 0) !== (video.views || 0) ||
          (lastSnapshot.likes || 0) !== (video.likes || 0) ||
          (lastSnapshot.comments || 0) !== (video.comments || 0) ||
          (lastSnapshot.shares || 0) !== (video.shares || 0);
        
        if (metricsDiffer && video.lastRefreshed) {
          const syntheticSnapshot: VideoSnapshot = {
            id: `${video.id}-current`,
            videoId: video.id,
            views: video.views || 0,
            likes: video.likes || 0,
            comments: video.comments || 0,
            shares: video.shares || 0,
            saves: video.saves || 0,
            capturedAt: video.lastRefreshed instanceof Date ? video.lastRefreshed : new Date(video.lastRefreshed as any),
            capturedBy: 'scheduled_refresh',
            isInitialSnapshot: false
          };
          effectiveSnapshots.push(syntheticSnapshot);
        }
        
        if (effectiveSnapshots.length === 0) return;
        
        const snapshotsInOrBeforeInterval = effectiveSnapshots.filter(s => {
          const capturedAt = s.capturedAt instanceof Date ? s.capturedAt : new Date(s.capturedAt);
          return capturedAt <= interval.endDate;
        });
        
        if (snapshotsInOrBeforeInterval.length === 0) return;
        
        const sortedSnapshots = [...snapshotsInOrBeforeInterval].sort((a, b) => {
          const dateA = a.capturedAt instanceof Date ? a.capturedAt : new Date(a.capturedAt);
          const dateB = b.capturedAt instanceof Date ? b.capturedAt : new Date(b.capturedAt);
          return dateA.getTime() - dateB.getTime();
        });
        
        const snapshotAtStart = sortedSnapshots.filter(s => {
          const capturedAt = s.capturedAt instanceof Date ? s.capturedAt : new Date(s.capturedAt);
          return capturedAt <= interval.startDate;
        }).pop();
        
        const snapshotAtEnd = sortedSnapshots.filter(s => {
          const capturedAt = s.capturedAt instanceof Date ? s.capturedAt : new Date(s.capturedAt);
          return capturedAt <= interval.endDate;
        }).pop();
        
        if (!snapshotAtEnd) return;
        
        // Use initial snapshot as baseline if no start snapshot
        const baselineSnapshot = snapshotAtStart || effectiveSnapshots.find(s => s.isInitialSnapshot) || effectiveSnapshots[0];
        if (!baselineSnapshot) return;
        
        // Calculate growth
        const viewsGrowth = (snapshotAtEnd.views || 0) - (baselineSnapshot.views || 0);
        const likesGrowth = (snapshotAtEnd.likes || 0) - (baselineSnapshot.likes || 0);
        const commentsGrowth = (snapshotAtEnd.comments || 0) - (baselineSnapshot.comments || 0);
        const sharesGrowth = (snapshotAtEnd.shares || 0) - (baselineSnapshot.shares || 0);
        
        totalViews += Math.max(0, viewsGrowth);
        totalLikes += Math.max(0, likesGrowth);
        totalComments += Math.max(0, commentsGrowth);
        totalShares += Math.max(0, sharesGrowth);
      });
    } else {
      // No interval - use current totals
      totalViews = videosToUse.reduce((sum, v) => sum + (v.views || 0), 0);
      totalLikes = videosToUse.reduce((sum, v) => sum + (v.likes || 0), 0);
      totalComments = videosToUse.reduce((sum, v) => sum + (v.comments || 0), 0);
      totalShares = videosToUse.reduce((sum, v) => sum + (v.shares || 0), 0);
    }
    
    const totalEngagement = totalLikes + totalComments + totalShares;
    const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;
    const uniqueAccounts = new Set(videosToUse.map(v => v.uploaderHandle)).size;
    const clicksCount = linkClicks.length;

    return {
      views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      engagementRate,
      videos: videosToUse.length,
      accounts: uniqueAccounts,
      clicks: clicksCount
    };
  }, [videos, accountFilter, linkClicks, dayOfWeek, hourRange, interval]);

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
    if (accountFilter) {
      videosToUse = videosToUse.filter(v => v.uploaderHandle?.toLowerCase() === accountFilter.toLowerCase());
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
      clicks: clicksCount
    };
  }, [ppVideos, accountFilter, ppLinkClicks, dayOfWeek, hourRange]);

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
    if (accountFilter) {
      videosToShow = videosToShow.filter(v => 
        v.uploaderHandle?.toLowerCase() === accountFilter.toLowerCase()
      );
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
  }, [videos, accountFilter, dayOfWeek, hourRange, interval]);

  // Calculate Refreshed Videos (videos with highest growth from snapshots)
  // Use ALL videos (not just filteredVideos) to match tooltip behavior
  const topGainers = useMemo(() => {
    console.log('📈 [DayVideosModal] Calculating top gainers', {
      videosCount: videos.length,
      intervalStart: interval?.startDate?.toISOString?.(),
      intervalEnd: interval?.endDate?.toISOString?.(),
      accountFilter,
      dayOfWeek,
      hourRange
    });

    let videosToAnalyze = videos;
    
    // Filter out invalid/empty videos (0 views, no caption, no data)
    videosToAnalyze = videosToAnalyze.filter(v => {
      const hasStats = (v.views || 0) > 0 || (v.likes || 0) > 0 || (v.comments || 0) > 0;
      const hasContent = (v.title && v.title !== '(No caption)') || (v.caption && v.caption !== '(No caption)');
      return hasStats || hasContent; // Keep video if it has either stats OR content
    });
    
    // Apply account filter if present (to match the context)
    if (accountFilter) {
      videosToAnalyze = videosToAnalyze.filter(v => 
        v.uploaderHandle?.toLowerCase() === accountFilter.toLowerCase()
      );
    }
    
    // Apply day of week filter if present
    if (dayOfWeek !== undefined) {
      videosToAnalyze = videosToAnalyze.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        return videoDate.getDay() === dayOfWeek;
      });
    }
    
    // Apply hour range filter if present
    if (hourRange) {
      videosToAnalyze = videosToAnalyze.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        const hour = videoDate.getHours();
        return hour >= hourRange.start && hour < hourRange.end;
      });
    }
    
    // If no interval, fall back to simple logic
    if (!interval) {
      return videosToAnalyze
      .map((video: VideoSubmission) => {
        const snapshots = video.snapshots || [];
        console.log('   • Video snapshots (no interval):', video.id, snapshots.length);
          if (snapshots.length < 1) return null;
        
        const sortedSnapshots = [...snapshots].sort((a, b) => 
          new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
        );
        
        const earliest = sortedSnapshots[0];
        const latest = sortedSnapshots[sortedSnapshots.length - 1];
        
        const earliestViews = earliest.views || 0;
        const latestViews = latest.views || video.views || 0;
        const growth = earliestViews > 0 ? ((latestViews - earliestViews) / earliestViews) * 100 : 0;
        
        return {
          video,
          growth,
          currentViews: latestViews,
          snapshotCount: snapshots.length,
          earliestViews,
          viewsGained: latestViews - earliestViews
        };
      })
        .filter(item => item !== null && item.viewsGained > 0)
        .sort((a: any, b: any) => b.viewsGained - a.viewsGained);
    }

    // Match KPICards tooltip logic: use interval-aware snapshot filtering
    // Look at ALL videos with snapshots, not just those uploaded in the interval
    const result = videosToAnalyze
      .map((video: VideoSubmission) => {
        const normalizeSnapshot = (snapshot: VideoSnapshot): VideoSnapshot => {
          const capturedAtValue = (snapshot as any).capturedAt;
          let capturedAt = capturedAtValue instanceof Date ? capturedAtValue : new Date(capturedAtValue);
          if (Number.isNaN(capturedAt.getTime())) {
            capturedAt = new Date();
          }
          return {
            ...snapshot,
            capturedAt
          };
        };

        const originalSnapshots = (video.snapshots || []).map(normalizeSnapshot);
        const effectiveSnapshots: VideoSnapshot[] = [...originalSnapshots];

        const latestViews = video.views || 0;
        const latestLikes = video.likes || 0;
        const latestComments = video.comments || 0;
        const latestShares = video.shares || 0;
        const latestSaves = (video.saves ?? video.bookmarks) || 0;

        const lastSnapshot = effectiveSnapshots[effectiveSnapshots.length - 1];
        const metricsDiffer = !lastSnapshot ||
          (lastSnapshot.views || 0) !== latestViews ||
          (lastSnapshot.likes || 0) !== latestLikes ||
          (lastSnapshot.comments || 0) !== latestComments ||
          (lastSnapshot.shares || 0) !== latestShares ||
          (lastSnapshot.saves || lastSnapshot.bookmarks || 0) !== latestSaves;

        if (metricsDiffer) {
          let capturedAt = video.lastRefreshed instanceof Date
            ? video.lastRefreshed
            : video.lastRefreshed
              ? new Date(video.lastRefreshed as unknown as string)
              : new Date();

          if (interval && capturedAt > interval.endDate) {
            capturedAt = new Date(interval.endDate);
          }

          if (lastSnapshot && capturedAt < lastSnapshot.capturedAt) {
            capturedAt = new Date(lastSnapshot.capturedAt.getTime());
            capturedAt.setSeconds(capturedAt.getSeconds() + 1);
          }

          const syntheticSnapshot: VideoSnapshot = {
            id: `${video.id}-current-metrics`,
            videoId: video.id,
            views: latestViews,
            likes: latestLikes,
            comments: latestComments,
            shares: latestShares,
            saves: latestSaves,
            capturedAt,
            capturedBy: 'scheduled_refresh',
            isInitialSnapshot: false
          };

          effectiveSnapshots.push(syntheticSnapshot);
          console.log('   • Added synthetic snapshot from latest metrics:', {
            videoId: video.id,
            capturedAt,
            views: latestViews
          });
        }

        if (effectiveSnapshots.length === 0) {
          console.log('   • Skipping video (no snapshots after normalization):', video.id);
          return null;
        }
        
        // Get snapshots in or before the interval
        const snapshotsInOrBeforeInterval = effectiveSnapshots.filter(snapshot => {
          const snapshotDate = new Date(snapshot.capturedAt);
          return snapshotDate <= interval.endDate;
        });
        const latestSnapshotInRange = snapshotsInOrBeforeInterval[snapshotsInOrBeforeInterval.length - 1];
        if (latestSnapshotInRange) {
          const cutoff = interval.endDate;
          if (latestSnapshotInRange.capturedAt > cutoff) {
            return null;
          }
        }
        
        if (snapshotsInOrBeforeInterval.length === 0) {
          console.log('   • Skipping video (no snapshots before interval end):', video.id);
          return null;
        }
        
        const sortedSnapshots = [...snapshotsInOrBeforeInterval].sort((a, b) => 
          new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
        );
        
        console.log('   • Video sorted snapshots:', video.id, sortedSnapshots.map(s => ({
          capturedAt: new Date(s.capturedAt).toISOString(),
          views: s.views,
          isInitial: s.isInitialSnapshot
        })));
        
        // Get snapshot at/before interval start (baseline)
        const snapshotAtStart = sortedSnapshots.filter(s => 
          new Date(s.capturedAt) <= interval.startDate
        ).pop();
        
        // Get latest snapshot at/before interval end
        const snapshotAtEnd = sortedSnapshots.filter(s => 
          new Date(s.capturedAt) <= interval.endDate
        ).pop();
        
        console.log('   • Baseline & End snapshots:', {
          videoId: video.id,
          snapshotAtStart: snapshotAtStart ? {
            capturedAt: new Date(snapshotAtStart.capturedAt).toISOString(),
            views: snapshotAtStart.views
          } : null,
          snapshotAtEnd: snapshotAtEnd ? {
            capturedAt: new Date(snapshotAtEnd.capturedAt).toISOString(),
            views: snapshotAtEnd.views
          } : null
        });
        
        // Need end snapshot to calculate growth
        if (!snapshotAtEnd) {
          console.log('   • Skipping video (no end snapshot):', video.id);
          return null;
        }
        
        // If no start snapshot, use initial snapshot or first available snapshot as baseline
        if (!snapshotAtStart || snapshotAtStart === snapshotAtEnd) {
          const initialSnapshot = effectiveSnapshots.find(s => s.isInitialSnapshot) || effectiveSnapshots[0];
          if (!initialSnapshot) {
            console.log('     • Skipping (no baseline snapshot) for video:', video.id);
            return null;
          }
 
          const growthMetricKey = 'views';
          const startValue = (initialSnapshot as any)[growthMetricKey] || 0;
          const endValue = (snapshotAtEnd as any)[growthMetricKey] || 0;
          const absoluteGain = endValue - startValue;
          const growthPercentage = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
          console.log('     • Fallback baseline', { videoId: video.id, startValue, endValue, absoluteGain });
          
          return absoluteGain > 0 ? {
            video,
            growth: growthPercentage,
            growthPercentage,
            metricValue: endValue,
            absoluteGain,
            startValue,
            snapshotCount: effectiveSnapshots.length,
            viewsGained: absoluteGain,
            currentViews: endValue
          } : null;
        }
        
        const growthMetricKey = 'views';
 
        const startValue = (snapshotAtStart as any)[growthMetricKey] || 0;
        const endValue = (snapshotAtEnd as any)[growthMetricKey] || 0;
        const absoluteGain = endValue - startValue;
        const growthPercentage = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
        console.log('     • Interval growth', { videoId: video.id, metricKey: growthMetricKey, startValue, endValue, absoluteGain });
 
        if (absoluteGain <= 0) {
          return null;
        }
 
        return {
          video,
          growth: growthPercentage,
          growthPercentage,
          metricValue: endValue,
          absoluteGain,
          startValue,
          snapshotCount: effectiveSnapshots.length,
          viewsGained: absoluteGain,
          currentViews: endValue
        };
      })
      .filter(item => item !== null);

    const sortedResult = result.sort((a: any, b: any) => b.viewsGained - a.viewsGained);
    
    console.log('📈 [DayVideosModal] Top gainers result:', {
      totalVideos: videos.length,
      validVideos: videosToAnalyze.length,
      videosWithGrowth: sortedResult.length,
      topGainers: sortedResult.slice(0, 5).map((g: any) => ({
        id: g.video.id,
        title: g.video.title?.substring(0, 50),
        viewsGained: g.viewsGained,
        growth: g.growth.toFixed(1) + '%'
      }))
    });
    
    return sortedResult;
  }, [videos, accountFilter, dayOfWeek, hourRange, interval]);

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
    if (accountFilter) {
      videosToShow = videosToShow.filter(v => 
        v.uploaderHandle?.toLowerCase() === accountFilter.toLowerCase()
      );
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
  }, [ppVideos, ppInterval, accountFilter, dayOfWeek, hourRange]);

  // Calculate PP Top Gainers
  const ppTopGainers = useMemo(() => {
    if (!ppVideos || !ppInterval) return [];
    
    let videosToAnalyze = ppVideos;
    
    // Filter out invalid/empty videos
    videosToAnalyze = videosToAnalyze.filter(v => {
      const hasStats = (v.views || 0) > 0 || (v.likes || 0) > 0 || (v.comments || 0) > 0;
      const hasContent = (v.title && v.title !== '(No caption)') || (v.caption && v.caption !== '(No caption)');
      return hasStats || hasContent;
    });
    
    // Apply filters
    if (accountFilter) {
      videosToAnalyze = videosToAnalyze.filter(v => 
        v.uploaderHandle?.toLowerCase() === accountFilter.toLowerCase()
      );
    }
    
    if (dayOfWeek !== undefined) {
      videosToAnalyze = videosToAnalyze.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        return videoDate.getDay() === dayOfWeek;
      });
    }
    
    if (hourRange) {
      videosToAnalyze = videosToAnalyze.filter(v => {
        const videoDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
        const hour = videoDate.getHours();
        return hour >= hourRange.start && hour < hourRange.end;
      });
    }
    
    const result = videosToAnalyze
      .map((video: VideoSubmission) => {
        const normalizeSnapshot = (snapshot: VideoSnapshot): VideoSnapshot => {
          const capturedAtValue = (snapshot as any).capturedAt;
          let capturedAt = capturedAtValue instanceof Date ? capturedAtValue : new Date(capturedAtValue);
          if (Number.isNaN(capturedAt.getTime())) {
            capturedAt = new Date();
          }
          return {
            ...snapshot,
            capturedAt
          };
        };

        const originalSnapshots = (video.snapshots || []).map(normalizeSnapshot);
        const effectiveSnapshots: VideoSnapshot[] = [...originalSnapshots];

        const latestViews = video.views || 0;
        const latestLikes = video.likes || 0;
        const latestComments = video.comments || 0;
        const latestShares = video.shares || 0;

        const latestSnapshotDate = originalSnapshots.length > 0
          ? Math.max(...originalSnapshots.map(s => s.capturedAt.getTime()))
          : null;

        if (
          latestSnapshotDate !== null &&
          latestSnapshotDate < ppInterval.endDate.getTime()
        ) {
          effectiveSnapshots.push({
            capturedAt: ppInterval.endDate,
            views: latestViews,
            likes: latestLikes,
            comments: latestComments,
            shares: latestShares,
            saves: video.saves || video.bookmarks || 0,
            bookmarks: video.saves || video.bookmarks || 0
          });
        }

        const snapshotsInInterval = effectiveSnapshots.filter((s: VideoSnapshot) =>
          s.capturedAt >= ppInterval.startDate && s.capturedAt <= ppInterval.endDate
        );

        if (snapshotsInInterval.length < 2) {
          return null;
        }

        snapshotsInInterval.sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

        const firstSnapshot = snapshotsInInterval[0];
        const lastSnapshot = snapshotsInInterval[snapshotsInInterval.length - 1];

        const startValue = firstSnapshot.views || 0;
        const endValue = lastSnapshot.views || 0;
        const absoluteGain = endValue - startValue;
        const growthPercentage = startValue > 0 ? (absoluteGain / startValue) * 100 : 0;

        if (absoluteGain <= 0) {
          return null;
        }

        return {
          video,
          growth: growthPercentage,
          growthPercentage,
          metricValue: endValue,
          absoluteGain,
          startValue,
          snapshotCount: effectiveSnapshots.length,
          viewsGained: absoluteGain,
          currentViews: endValue
        };
      })
      .filter(item => item !== null);

    return result.sort((a: any, b: any) => b.viewsGained - a.viewsGained);
  }, [ppVideos, ppInterval, accountFilter, dayOfWeek, hourRange]);

  // Calculate total views from new uploads
  const totalNewUploadViews = useMemo(() => {
    return newUploads.reduce((sum, video) => sum + (video.views || 0), 0);
  }, [newUploads]);

  // Filter out refreshed videos that are also in new uploads
  const filteredTopGainers = useMemo(() => {
    const newUploadIds = new Set(newUploads.map(v => v.id));
    return topGainers.filter((item: any) => !newUploadIds.has(item.video.id));
  }, [topGainers, newUploads]);

  // PP filtered top gainers
  const ppFilteredTopGainers = useMemo(() => {
    const ppNewUploadIds = new Set(ppNewUploads.map(v => v.id));
    return ppTopGainers.filter((item: any) => !ppNewUploadIds.has(item.video.id));
  }, [ppTopGainers, ppNewUploads]);

  // Calculate total views gained from refreshed videos (excluding new uploads)
  const totalRefreshedViewsGained = useMemo(() => {
    return filteredTopGainers.reduce((sum, item: any) => sum + (item.viewsGained || 0), 0);
  }, [filteredTopGainers]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-[#0a0a0a] rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden border border-white/[0.06]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white">
              {(() => {
                // If filtering by day of week and hour, show special format
                if (dayOfWeek !== undefined && hourRange) {
                  const dayName = getDayName(dayOfWeek);
                  const timeRange = formatHourRange(hourRange.start, hourRange.end);
                  return `${dayName} ${timeRange}`;
                }
                
                const currentInterval = showPreviousPeriod ? ppInterval : interval;
                // Priority: interval > dateRangeLabel > fallback to formatted date
                if (currentInterval) {
                  return accountFilter 
                    ? `@${accountFilter} · ${formatIntervalRange(currentInterval)}`
                    : formatIntervalRange(currentInterval);
                }
                if (dateRangeLabel && accountFilter) {
                  return `@${accountFilter} · ${dateRangeLabel}`;
                }
                return dateRangeLabel || formatDate(date);
              })()}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Period Toggle Tabs */}
            {hasPPData && (
              <div className="flex items-center bg-white/[0.02] rounded-lg p-0.5 border border-white/[0.04]">
              <button
                  onClick={() => setShowPreviousPeriod(false)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    !showPreviousPeriod 
                      ? 'bg-white/10 text-white' 
                      : 'text-gray-400 hover:text-gray-300'
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
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    showPreviousPeriod 
                      ? 'bg-white/10 text-white' 
                      : 'text-gray-400 hover:text-gray-300'
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
              onClick={onClose}
              className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Main Content - Reorganized Layout */}
        <div className="p-6 overflow-y-auto overflow-x-hidden" style={{ maxHeight: 'calc(90vh - 65px)' }}>
          {/* Two-Column Layout: Left (Videos) | Right (KPIs) */}
          <div className="flex gap-4">
            {/* LEFT SIDE - Video Tables (Compact) */}
            <div className="flex-1 space-y-2 min-w-0">
              {/* New Videos Table - Compact */}
              {(() => {
                const videosToShow = showPreviousPeriod ? ppNewUploads : newUploads;
                return (
                  <div className="overflow-x-auto">
                    <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '117.65%' }}>
                      <VideoSubmissionsTable
                        submissions={videosToShow}
                        onVideoClick={onVideoClick}
                        headerTitle={`New Videos (${videosToShow.length})`}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Refreshed Videos Table - Compact */}
              {(() => {
                const gainersToShow = showPreviousPeriod ? ppFilteredTopGainers : filteredTopGainers;
                return (
                  <div className="overflow-x-auto">
                    <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '117.65%' }}>
                      <VideoSubmissionsTable
                        submissions={gainersToShow.map((item: any) => {
                          // Calculate growth for all metrics from snapshots
                          const video = item.video;
                          const snapshots = video.snapshots || [];
                          
                          // Get earliest and latest snapshots
                          const sortedSnapshots = [...snapshots].sort((a: any, b: any) => 
                            new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
                          );
                          
                          const earliest = sortedSnapshots[0];
                          const latest = sortedSnapshots[sortedSnapshots.length - 1] || video;
                          
                          // Calculate deltas for each metric
                          const viewsGained = (latest.views || video.views || 0) - (earliest?.views || 0);
                          const likesGained = (latest.likes || video.likes || 0) - (earliest?.likes || 0);
                          const commentsGained = (latest.comments || video.comments || 0) - (earliest?.comments || 0);
                          const sharesGained = (latest.shares || video.shares || 0) - (earliest?.shares || 0);
                          const bookmarksGained = ((latest.saves || latest.bookmarks) || (video.saves || video.bookmarks) || 0) - ((earliest?.saves || earliest?.bookmarks) || 0);
                          
                          return {
                            ...video,
                            // Override stats to show only growth (delta) instead of totals
                            views: viewsGained,
                            likes: likesGained,
                            comments: commentsGained,
                            shares: sharesGained,
                            bookmarks: bookmarksGained,
                            saves: bookmarksGained
                          };
                        })}
                        onVideoClick={onVideoClick}
                        headerTitle={`Refreshed Videos (${gainersToShow.length})`}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* RIGHT SIDE - Summary Card + KPI Metrics (Sticky) */}
            <div className="w-72 flex-shrink-0 sticky top-0 self-start space-y-4">
              {/* Performance Summary Card */}
              {(() => {
                const currentViews = cpKPIMetrics.views;
                const previousViews = ppKPIMetrics.views;
                let percentChange: number;
                
                if (previousViews === 0) {
                  // Previous period was 0
                  if (currentViews === 0) {
                    percentChange = 0; // Both 0, no change
                  } else {
                    percentChange = Infinity; // New data, show as "NEW"
                  }
                } else {
                  percentChange = ((currentViews - previousViews) / previousViews) * 100;
                }
                
                const isPositive = percentChange >= 0;
                
                // Calculate views from new vs refreshed
                const newUploadViews = newUploads.reduce((sum, v) => sum + (v.views || 0), 0);
                const refreshedViews = totalRefreshedViewsGained;
                const totalTrackedViews = newUploadViews + refreshedViews;
                const newUploadPercent = totalTrackedViews > 0 ? (newUploadViews / totalTrackedViews) * 100 : 0;
                const refreshedPercent = totalTrackedViews > 0 ? (refreshedViews / totalTrackedViews) * 100 : 0;
                
                // Format period as date range (e.g., "Nov 9 - 12" or "Nov 10" for single day)
                const formatDateRange = (startDate: Date, endDate: Date) => {
                  const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
                  const startDay = startDate.getDate();
                  const endDay = endDate.getDate();
                  const startMonthNum = startDate.getMonth();
                  const endMonthNum = endDate.getMonth();
                  
                  // If same day and same month, show just "Nov 10"
                  if (startMonthNum === endMonthNum && startDay === endDay) {
                    return `${startMonth} ${startDay}`;
                  }
                  
                  // If same month but different days, show "Nov 9 - 12"
                  if (startMonthNum === endMonthNum) {
                    return `${startMonth} ${startDay} - ${endDay}`;
                  }
                  
                  // If different months, show "Nov 30 - Dec 3"
                  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
                  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
                };
                
                const periodName = interval 
                  ? formatDateRange(interval.startDate, interval.endDate)
                  : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                // Format previous period date range
                const ppPeriodName = ppInterval
                  ? formatDateRange(ppInterval.startDate, ppInterval.endDate)
                  : '';
                
                return (
                  <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
                    <p className="text-xs leading-relaxed text-gray-400">
                      {hasPPData && percentChange !== Infinity && percentChange !== 0 && (
                        <>
                          In {periodName}, you did{' '}
                          <span className={`font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPositive ? '+' : ''}{Math.abs(percentChange).toFixed(1)}%
                          </span>
                          {' '}{isPositive ? 'better' : 'worse'} than {ppPeriodName}.{' '}
                        </>
                      )}
                      <span className="font-semibold text-white">{newUploadPercent.toFixed(0)}%</span> of your views came from new uploads, while{' '}
                      <span className="font-semibold text-white">{refreshedPercent.toFixed(0)}%</span> came from refreshed videos.
                    </p>
                  </div>
                );
              })()}
              
              {/* KPI Grid */}
              {(() => {
                // Calculate breakdowns for each metric - use correct period data
                const uploadsToUse = showPreviousPeriod ? ppNewUploads : newUploads;
                const gainersToUse = showPreviousPeriod ? ppFilteredTopGainers : filteredTopGainers;
                
                const newUploadMetrics = uploadsToUse.reduce((acc, v) => ({
                  views: acc.views + (v.views || 0),
                  likes: acc.likes + (v.likes || 0),
                  comments: acc.comments + (v.comments || 0),
                  shares: acc.shares + (v.shares || 0),
                  bookmarks: acc.bookmarks + ((v.saves || v.bookmarks) || 0)
                }), { views: 0, likes: 0, comments: 0, shares: 0, bookmarks: 0 });
                
                const refreshedMetrics = gainersToUse.reduce((acc, item: any) => {
                  const video = item.video;
                  const snapshots = video.snapshots || [];
                  const sortedSnapshots = [...snapshots].sort((a: any, b: any) => 
                    new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
                  );
                  const earliest = sortedSnapshots[0];
                  const latest = sortedSnapshots[sortedSnapshots.length - 1] || video;
                  
                  return {
                    views: acc.views + ((latest.views || video.views || 0) - (earliest?.views || 0)),
                    likes: acc.likes + ((latest.likes || video.likes || 0) - (earliest?.likes || 0)),
                    comments: acc.comments + ((latest.comments || video.comments || 0) - (earliest?.comments || 0)),
                    shares: acc.shares + ((latest.shares || video.shares || 0) - (earliest?.shares || 0)),
                    bookmarks: acc.bookmarks + (((latest.saves || latest.bookmarks) || (video.saves || video.bookmarks) || 0) - ((earliest?.saves || earliest?.bookmarks) || 0))
                  };
                }, { views: 0, likes: 0, comments: 0, shares: 0, bookmarks: 0 });
                
                return (
                  <div className="grid grid-cols-2 gap-3">
            {/* Views */}
            <div 
              className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors relative group"
              title={`New: ${formatNumber(newUploadMetrics.views)} • Refreshed: ${formatNumber(refreshedMetrics.views)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Views</span>
                <Eye className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.views : cpKPIMetrics.views)}
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.views, cpKPIMetrics.views)
                    : calculateComparison(cpKPIMetrics.views, ppKPIMetrics.views);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
              {/* Breakdown Tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-lg p-2 shadow-xl min-w-[140px]">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-gray-400">New</span>
                    <span className="text-gray-300 font-medium">{formatNumber(newUploadMetrics.views)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-400">Refreshed</span>
                    <span className="text-gray-300 font-medium">{formatNumber(refreshedMetrics.views)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Likes */}
            <div 
              className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors relative group"
              title={`New: ${formatNumber(newUploadMetrics.likes)} • Refreshed: ${formatNumber(refreshedMetrics.likes)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Likes</span>
                <Heart className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.likes : cpKPIMetrics.likes)}
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.likes, cpKPIMetrics.likes)
                    : calculateComparison(cpKPIMetrics.likes, ppKPIMetrics.likes);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
              {/* Breakdown Tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-lg p-2 shadow-xl min-w-[140px]">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-gray-400">New</span>
                    <span className="text-gray-300 font-medium">{formatNumber(newUploadMetrics.likes)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-400">Refreshed</span>
                    <span className="text-gray-300 font-medium">{formatNumber(refreshedMetrics.likes)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Comments */}
            <div 
              className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors relative group"
              title={`New: ${formatNumber(newUploadMetrics.comments)} • Refreshed: ${formatNumber(refreshedMetrics.comments)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Comments</span>
                <MessageCircle className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.comments : cpKPIMetrics.comments)}
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.comments, cpKPIMetrics.comments)
                    : calculateComparison(cpKPIMetrics.comments, ppKPIMetrics.comments);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
              {/* Breakdown Tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-lg p-2 shadow-xl min-w-[140px]">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-gray-400">New</span>
                    <span className="text-gray-300 font-medium">{formatNumber(newUploadMetrics.comments)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-400">Refreshed</span>
                    <span className="text-gray-300 font-medium">{formatNumber(refreshedMetrics.comments)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Shares */}
            <div 
              className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors relative group"
              title={`New: ${formatNumber(newUploadMetrics.shares)} • Refreshed: ${formatNumber(refreshedMetrics.shares)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Shares</span>
                <Share2 className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.shares : cpKPIMetrics.shares)}
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.shares, cpKPIMetrics.shares)
                    : calculateComparison(cpKPIMetrics.shares, ppKPIMetrics.shares);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
              {/* Breakdown Tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-lg p-2 shadow-xl min-w-[140px]">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-gray-400">New</span>
                    <span className="text-gray-300 font-medium">{formatNumber(newUploadMetrics.shares)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-400">Refreshed</span>
                    <span className="text-gray-300 font-medium">{formatNumber(refreshedMetrics.shares)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Engagement Rate */}
            <div 
              className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors relative group"
              title={`New: ${newUploadMetrics.views ? ((newUploadMetrics.likes + newUploadMetrics.comments + newUploadMetrics.shares) / newUploadMetrics.views * 100).toFixed(1) : 0}% • Refreshed: ${refreshedMetrics.views ? ((refreshedMetrics.likes + refreshedMetrics.comments + refreshedMetrics.shares) / refreshedMetrics.views * 100).toFixed(1) : 0}%`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Engagement</span>
                <Activity className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {(showPreviousPeriod ? ppKPIMetrics.engagementRate : cpKPIMetrics.engagementRate).toFixed(1)}%
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.engagementRate, cpKPIMetrics.engagementRate)
                    : calculateComparison(cpKPIMetrics.engagementRate, ppKPIMetrics.engagementRate);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
              {/* Breakdown Tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-lg p-2 shadow-xl min-w-[140px]">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-gray-400">New</span>
                    <span className="text-gray-300 font-medium">
                      {newUploadMetrics.views ? ((newUploadMetrics.likes + newUploadMetrics.comments + newUploadMetrics.shares) / newUploadMetrics.views * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-400">Refreshed</span>
                    <span className="text-gray-300 font-medium">
                      {refreshedMetrics.views ? ((refreshedMetrics.likes + refreshedMetrics.comments + refreshedMetrics.shares) / refreshedMetrics.views * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Videos */}
            <div 
              className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors relative group"
              title={`New: ${uploadsToUse.length} • Refreshed: ${gainersToUse.length}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Videos</span>
                <Video className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.videos : cpKPIMetrics.videos)}
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.videos, cpKPIMetrics.videos)
                    : calculateComparison(cpKPIMetrics.videos, ppKPIMetrics.videos);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
              {/* Breakdown Tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-lg p-2 shadow-xl min-w-[140px]">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-gray-400">New</span>
                    <span className="text-gray-300 font-medium">{uploadsToUse.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-400">Refreshed</span>
                    <span className="text-gray-300 font-medium">{gainersToUse.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Accounts */}
            <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Accounts</span>
                <Users className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.accounts : cpKPIMetrics.accounts)}
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.accounts, cpKPIMetrics.accounts)
                    : calculateComparison(cpKPIMetrics.accounts, ppKPIMetrics.accounts);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Link Clicks */}
            <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Clicks</span>
                <MousePointerClick className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {formatNumber(showPreviousPeriod ? ppKPIMetrics.clicks : cpKPIMetrics.clicks)}
                </span>
                {hasPPData && (() => {
                  const comp = showPreviousPeriod 
                    ? calculateComparison(ppKPIMetrics.clicks, cpKPIMetrics.clicks)
                    : calculateComparison(cpKPIMetrics.clicks, ppKPIMetrics.clicks);
                  return comp.percentChange > 0 ? (
                    <span className={`text-[10px] font-medium ${comp.isPositive ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comp.isPositive ? '+' : '-'}{comp.percentChange.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
            </div>
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
