import React from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Activity,
  Link as LinkIcon,
  Upload,
  RefreshCw
} from 'lucide-react';
import { VideoSubmission } from '../../types';
import { LinkClick } from '../../services/LinkClicksService';
import { PlatformIcon } from '../ui/PlatformIcon';
import DataAggregationService from '../../services/DataAggregationService';
import DateFilterService from '../../services/DateFilterService';
import { HeicImage } from '../HeicImage';
import { KPICardData } from './kpiTypes';
import { computeIntervalBreakdown } from './kpiDataProcessing';

interface KPICardTooltipProps {
  tooltipData: { x: number; y: number; point: any; lineX: number };
  data: KPICardData;
  submissions: VideoSubmission[];
  linkClicks: LinkClick[];
  dateFilter: string;
  customRange?: { startDate: Date; endDate: Date };
  imageErrors: Set<string>;
  setImageErrors: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const truncateText = (text: string, maxLength: number = 10): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * KPICardTooltip Component
 * Massive tooltip portal that shows detailed video and metric breakdowns
 */
export const KPICardTooltip: React.FC<KPICardTooltipProps> = ({
  tooltipData,
  data,
  submissions,
  linkClicks,
  dateFilter,
  customRange,
  imageErrors,
  setImageErrors
}) => {
  // Get counts first to determine layout
  const point = tooltipData.point;
  const interval = point.interval;

  // End of the active date range — used as the per-video cap below so
  // the breakdown can't credit a video more than its end-of-range
  // value (which is what the headline KPI uses). Without this cap, a
  // video that peaked mid-interval and was later corrected down (e.g.
  // TikTok recount, removed video) would show its peak in this
  // tooltip while the headline only credits the final value.
  const dateRange = DateFilterService.getDateRange(dateFilter as any, customRange, submissions);
  const rangeEndDate = dateRange.endDate;

  // Per-period breakdown is computed by the SAME central helper the chart
  // and DayVideosModal use, so the tooltip's totals can never disagree with
  // them. The display-only top-N lists below still need the per-video
  // values for ranking, but the sums shown in the breakdown headers come
  // straight from this object.
  const centralBreakdown = interval ? computeIntervalBreakdown(
    submissions,
    interval.startDate,
    interval.endDate,
    rangeEndDate,
    { excludeSparked: true, rangeStartDate: dateRange.startDate },
  ) : null;

  // Calculate new uploads and top gainers counts
  const videosInInterval = interval ? submissions.filter((video: VideoSubmission) => {
    const uploadDate = video.uploadDate ? new Date(video.uploadDate) : new Date(video.dateSubmitted);
    return DataAggregationService.isDateInInterval(uploadDate, interval);
  }) : [];

  // Refreshed list mirrors the central helper exactly: ONLY videos
  // uploaded BEFORE the broader period count as refreshed. Videos
  // uploaded inside the period (this bucket OR another) are credited to
  // their upload-day's "New" — surfacing them here would disagree with
  // the badge total above and double-count their views.
  const periodStartForClassification = dateRange.startDate; // null = all time
  const videosWithSnapshotsInIntervalCheck = interval ? submissions.filter((video: VideoSubmission) => {
    const snapshots = video.snapshots || [];
    if (snapshots.length === 0) return false;
    const uploadDate = video.uploadDate ? new Date(video.uploadDate) : new Date(video.dateSubmitted);
    if (periodStartForClassification) {
      return uploadDate < periodStartForClassification;
    }
    // All-time view: anything before THIS bucket counts as refreshed.
    return uploadDate < interval.startDate;
  }) : [];
  
  // Per-video cap: latest snapshot value at-or-before the date-range
  // end. The per-interval refresh gain can't exceed (cap - startValue);
  // this stops a peak that was later corrected down from inflating
  // the breakdown total above the headline.
  const valueAtRangeEnd = (video: VideoSubmission, key: string): number => {
    const snaps = video.snapshots || [];
    if (snaps.length === 0) return ((video as any)[key] as number) || 0;
    const snap = [...snaps]
      .filter(s => new Date(s.capturedAt) <= rangeEndDate)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
    return ((snap as any)?.[key] as number) || 0;
  };

  // Calculate refreshed videos (videos with growth)
  const allTopGainers = videosWithSnapshotsInIntervalCheck
    .map((video: VideoSubmission) => {
      const allSnapshots = video.snapshots || [];

      const snapshotsInOrBeforeInterval = allSnapshots.filter(snapshot => {
        const snapshotDate = new Date(snapshot.capturedAt);
        return snapshotDate <= interval.endDate;
      });

      if (snapshotsInOrBeforeInterval.length === 0) return null;

      const sortedSnapshots = [...snapshotsInOrBeforeInterval].sort((a, b) =>
        new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
      );

      const snapshotAtStart = sortedSnapshots.filter(s =>
        new Date(s.capturedAt) <= interval.startDate
      ).pop();

      const snapshotAtEnd = sortedSnapshots.filter(s =>
        new Date(s.capturedAt) <= interval.endDate
      ).pop();

      if (!snapshotAtEnd) return null;

      // Display-metric key (matches the rest of the tooltip).
      const growthMetricKey = data.id === 'views' ? 'views'
        : data.id === 'likes' ? 'likes'
        : data.id === 'comments' ? 'comments'
        : data.id === 'shares' ? 'shares'
        : data.id === 'bookmarks' ? 'bookmarks'
        : 'views';

      // Cap the end value at the video's value at end-of-range so a
      // mid-interval peak that was later corrected down can't credit
      // more than the headline total knows about.
      const cap = valueAtRangeEnd(video, growthMetricKey);
      const viewsCap = valueAtRangeEnd(video, 'views');

      if (!snapshotAtStart || snapshotAtStart === snapshotAtEnd) {
        // Fallback: Use initial snapshot or first available snapshot if no start snapshot exists
        // This handles videos added DURING the interval
        const initialSnapshot = video.snapshots?.find(s => s.isInitialSnapshot) || sortedSnapshots[0];
        if (!initialSnapshot) return null;

        // Always use VIEWS as the primary metric for determining if a video should be shown
        const viewsStartValue = (initialSnapshot as any)['views'] || 0;
        const viewsEndValue = Math.min((snapshotAtEnd as any)['views'] || 0, viewsCap);
        const viewsGrowth = viewsEndValue - viewsStartValue;

        const startValue = (initialSnapshot as any)[growthMetricKey] || 0;
        const endValue = Math.min((snapshotAtEnd as any)[growthMetricKey] || 0, cap);
        const growth = endValue - startValue;
        const growthPercentage = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;

        // Only return if there is actual growth
        return growth > 0 ? { video, growth, growthPercentage, absoluteGain: growth, viewsGrowth } : null;
      }

      // Always use VIEWS as the primary metric for determining if a video should be shown
      const viewsStartValue = (snapshotAtStart as any)['views'] || 0;
      const viewsEndValue = Math.min((snapshotAtEnd as any)['views'] || 0, viewsCap);
      const viewsGrowth = viewsEndValue - viewsStartValue;

      const startValue = (snapshotAtStart as any)[growthMetricKey] || 0;
      const endValue = Math.min((snapshotAtEnd as any)[growthMetricKey] || 0, cap);
      const growth = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
      const absoluteGain = endValue - startValue;

      return absoluteGain > 0 ? { video, growth, metricValue: endValue, absoluteGain, startValue, snapshotCount: allSnapshots.length, viewsGrowth } : null;
    })
    .filter(item => item !== null);
  
  const hasTopGainers = allTopGainers.length > 0;
  const hasNewUploads = videosInInterval.length > 0;
  
  // Dynamic width based on columns
  let tooltipWidth = 350;
  const columnsToShow = (hasNewUploads ? 1 : 0) + (hasTopGainers ? 1 : 0);
  if (columnsToShow === 2) tooltipWidth = 650;
  
  const verticalOffset = 20;
  const horizontalPadding = 20;
  const windowWidth = window.innerWidth;
  
  // Calculate position
  let leftPosition = tooltipData.x;
  let transformX = '-50%';
  
  if (tooltipData.x - (tooltipWidth / 2) < horizontalPadding) {
    leftPosition = horizontalPadding;
    transformX = '0';
  } else if (tooltipData.x + (tooltipWidth / 2) > windowWidth - horizontalPadding) {
    leftPosition = windowWidth - horizontalPadding;
    transformX = '-100%';
  }
  
  // Get base values from sparkline data (will be adjusted later after calculations)
  let value = point.value;
  let ppValue = point.ppValue;
  
  // Format functions
  let dateStr = '';
  if (interval) {
    dateStr = DataAggregationService.formatIntervalLabelFull(new Date(interval.startDate), interval.intervalType);
  }
  
  let ppDateStr = '';
  if (interval && dateFilter !== 'all') {
    let daysBack = 1;
    if (dateFilter === 'last7days') daysBack = 7;
    else if (dateFilter === 'last14days') daysBack = 14;
    else if (dateFilter === 'last30days') daysBack = 30;
    else if (dateFilter === 'last90days') daysBack = 90;
    else if (customRange) {
      const rangeLength = Math.ceil((customRange.endDate.getTime() - customRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
      daysBack = rangeLength;
    }
    
    const intervalLength = interval.endDate.getTime() - interval.startDate.getTime();
    const ppEndDate = new Date(interval.endDate.getTime() - (daysBack * 24 * 60 * 60 * 1000));
    const ppStartDate = new Date(ppEndDate.getTime() - intervalLength);
    
    ppDateStr = DataAggregationService.formatIntervalLabelFull(ppStartDate, interval.intervalType);
  }
  
  const formatDisplayNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const ppDisplayValue = typeof ppValue === 'number' ? formatDisplayNumber(ppValue) : null;

  const ppComparison = (typeof ppValue === 'number' && typeof value === 'number') ? (() => {
    const diff = value - ppValue;
    let percentChange: number;
    
    if (ppValue === 0) {
      // Previous period was 0
      if (value === 0) {
        percentChange = 0; // Both 0, no change
      } else {
        percentChange = Infinity; // New data, show as "NEW" below
      }
    } else {
      percentChange = ((diff / ppValue) * 100);
    }
    
    const isPositive = diff >= 0;
    const formattedDiff = Math.abs(diff).toLocaleString();
    return { diff, percentChange, isPositive, displayValue: ppDisplayValue, formattedDiff };
  })() : null;
  
  const metricKey = data.id === 'views' ? 'views' 
    : data.id === 'likes' ? 'likes'
    : data.id === 'comments' ? 'comments'
    : data.id === 'shares' ? 'shares'
    : 'views';
  
  const totalNewUploads = videosInInterval.length;
  const newUploads = [...videosInInterval]
    .sort((a, b) => ((b as any)[metricKey] || 0) - ((a as any)[metricKey] || 0))
    .slice(0, 5);
  
  
  const totalTopGainers = allTopGainers.length;
  const topGainers = [...allTopGainers]
    .sort((a: any, b: any) => (b.absoluteGain || 0) - (a.absoluteGain || 0))
    .slice(0, 5);
  
  // Totals come from the central helper (same source the chart bars and
  // DayVideosModal use). Previously these were duplicated inline; that
  // duplication was the bug Ernesto reported — the tooltip didn't
  // synthesize a current-snapshot at video.lastRefreshed, so a manually-
  // refreshed video with snapshot=14k but lifetime=300k credited 14k
  // here. The central helper now handles that synthesis once, so every
  // surface gets the correct number.
  const pickFromBreakdown = (key: 'views' | 'likes' | 'comments' | 'shares'): { newTotal: number; refTotal: number } => {
    if (!centralBreakdown) return { newTotal: 0, refTotal: 0 };
    if (key === 'views') return { newTotal: centralBreakdown.newViews, refTotal: centralBreakdown.refViews };
    if (key === 'likes') return { newTotal: centralBreakdown.newLikes, refTotal: centralBreakdown.refLikes };
    if (key === 'comments') return { newTotal: centralBreakdown.newComments, refTotal: centralBreakdown.refComments };
    return { newTotal: centralBreakdown.newShares, refTotal: centralBreakdown.refShares };
  };
  // Bookmarks/saves don't have a separate breakdown bucket in the central
  // helper (which only tracks the four core engagement metrics), so the
  // bookmarks card falls back to shares as a stand-in. Same fallback the
  // refreshed-list growthMetricKey logic above uses.
  const _breakdownMetricKey: 'views' | 'likes' | 'comments' | 'shares' =
    (metricKey as string) === 'bookmarks' ? 'shares' : (metricKey as 'views' | 'likes' | 'comments' | 'shares');
  const _breakdownPick = pickFromBreakdown(_breakdownMetricKey);
  const totalMetricFromNewUploads = _breakdownPick.newTotal;
  const totalMetricFromRefreshedVideos = _breakdownPick.refTotal;

  // The breakdown (new uploads + refreshed) is now the source of truth
  // for the headline number — the user explicitly wants the top number
  // to equal the sum below it. Previously we displayed the sparkline's
  // own `point.value` which used a separate algorithm and could disagree.
  const breakdownTotal = totalMetricFromNewUploads + totalMetricFromRefreshedVideos;

  // Cards that surface the New Uploads / Refreshed Videos breakdown
  // drive the headline number from that breakdown — the top-right total
  // becomes literally `newUploads + refreshed`, so the math the user
  // sees in the body always sums to the headline.
  const isBreakdownCard =
    data.id !== 'published-videos' && data.id !== 'videos' &&
    data.id !== 'accounts' && data.id !== 'active-accounts' &&
    data.id !== 'link-clicks';
  const headlineValue = isBreakdownCard ? breakdownTotal : value;
  const displayValue = typeof headlineValue === 'number' ? formatDisplayNumber(headlineValue) : headlineValue;
  
  let sortedItems: any[] = [];
  if (data.id === 'accounts' || data.id === 'active-accounts') {
    const accountsMap = new Map<string, { handle: string; platform: string; totalViews: number; videoCount: number; profilePicture?: string }>();
    videosInInterval.forEach(video => {
      const handle = video.uploaderHandle || 'Unknown';
      if (accountsMap.has(handle)) {
        const existing = accountsMap.get(handle)!;
        existing.totalViews += video.views || 0;
        existing.videoCount += 1;
      } else {
        accountsMap.set(handle, {
          handle,
          platform: video.platform,
          totalViews: video.views || 0,
          videoCount: 1,
          profilePicture: video.uploaderProfilePicture || undefined
        });
      }
    });
    sortedItems = Array.from(accountsMap.values())
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 5);
  } else if (data.id === 'link-clicks') {
    const clicksInInterval = interval ? linkClicks.filter((click: LinkClick) => {
      const clickDate = new Date(click.timestamp);
      return DataAggregationService.isDateInInterval(clickDate, interval);
    }) : [];
    
    const linksMap = new Map<string, { linkId: string; title: string; url: string; shortCode: string; clicks: number; accountHandle?: string; accountProfilePicture?: string; accountPlatform?: string }>();
    clicksInInterval.forEach((click: LinkClick) => {
      if (linksMap.has(click.linkId)) {
        const existing = linksMap.get(click.linkId)!;
        existing.clicks += 1;
      } else {
        linksMap.set(click.linkId, {
          linkId: click.linkId,
          title: click.linkTitle || click.shortCode || 'Untitled Link',
          url: click.linkUrl || '',
          shortCode: click.shortCode || '',
          clicks: 1,
          accountHandle: click.accountHandle,
          accountProfilePicture: click.accountProfilePicture,
          accountPlatform: click.accountPlatform
        });
      }
    });
    
    sortedItems = Array.from(linksMap.values())
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);
  } else {
    const metricKey = data.id === 'views' ? 'views' 
      : data.id === 'likes' ? 'likes'
      : data.id === 'comments' ? 'comments'
      : data.id === 'shares' ? 'shares'
      : 'views';
    
    sortedItems = videosInInterval
      .sort((a: VideoSubmission, b: VideoSubmission) => ((b as any)[metricKey] || 0) - ((a as any)[metricKey] || 0))
      .slice(0, 5);
  }
  
  const metricLabel = data.id === 'views' ? 'Views'
    : data.id === 'likes' ? 'Likes'
    : data.id === 'comments' ? 'Comments'
    : data.id === 'shares' ? 'Shares'
    : data.id === 'bookmarks' ? 'Bookmarks'
    : data.id === 'accounts' ? 'Total Views'
    : data.id === 'active-accounts' ? 'Total Views'
    : data.id === 'link-clicks' ? 'Clicks'
    : data.id === 'published-videos' ? 'Videos'
    : 'Views';
  
  const isPublishedVideosKPI = data.id === 'published-videos' || data.id === 'videos';
  
  return createPortal(
    <div 
      className="bg-surface-secondary backdrop-blur-xl text-content rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-border"
      style={{
        position: 'fixed',
        left: `${leftPosition}px`,
        top: `${tooltipData.y + verticalOffset}px`,
        transform: `translateX(${transformX})`,
        zIndex: 999999999,
        width: `${tooltipWidth}px`,
        maxHeight: '80vh', // Flexible height, up to 80% of viewport
        overflowY: 'auto', // Scroll if needed
        pointerEvents: 'none'
      }}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 space-y-2.5 bg-surface-secondary/95 sticky top-0 z-10 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <p className="text-xs text-content-muted font-medium tracking-wider">{dateStr}</p>
          <p className="text-xl font-bold text-content">{displayValue}</p>
        </div>

        {/* For breakdown cards (views/likes/comments/shares/bookmarks),
            replace the legacy current-vs-previous-period rows with the
            New Video Views / Refresh Views split so the math the user
            sees here adds up to the headline number above. The previous
            "+X% from previous period" line is gone — that comparison
            now belongs on the KPI card itself, not the tooltip. */}
        {isBreakdownCard ? (
          <div className="pt-2 border-t border-border-subtle space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-content-muted" />
                <span className="text-xs text-content-muted font-medium tracking-wider">New Video Views</span>
              </div>
              <span className="text-sm font-semibold text-content tabular-nums">
                {formatDisplayNumber(totalMetricFromNewUploads)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-content-muted" />
                <span className="text-xs text-content-muted font-medium tracking-wider">Refresh Views</span>
              </div>
              <span className="text-sm font-semibold text-content tabular-nums">
                {formatDisplayNumber(totalMetricFromRefreshedVideos)}
              </span>
            </div>
          </div>
        ) : (
          <>
            {ppComparison && ppComparison.displayValue && ppDateStr && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-content-muted font-medium tracking-wider">{ppDateStr}</p>
                <p className="text-lg font-semibold text-content-muted">{ppComparison.displayValue}</p>
              </div>
            )}

            {ppComparison && ppDateStr && ppComparison.percentChange !== Infinity && ppComparison.percentChange !== 0 && (
              <div className="pt-2 border-t border-border-subtle flex justify-center">
                <p className="text-xs font-medium text-content-muted text-center">
                  <span className={ppComparison.isPositive ? 'text-emerald-400' : 'text-red-400'}>
                    {ppComparison.isPositive ? '↑' : '↓'} {(() => {
                      const percent = Math.abs(ppComparison.percentChange);
                      if (percent >= 1000000) return `${(percent / 1000000).toFixed(1)}M`;
                      if (percent >= 1000) return `${(percent / 1000).toFixed(1)}K`;
                      return percent.toFixed(1);
                    })()}%
                  </span>
                  {' '}{ppComparison.isPositive ? 'increase' : 'decrease'} from Current Period
                </p>
              </div>
            )}
          </>
        )}
      </div>
      
      <div className="border-t border-border mx-5"></div>

      {/* Two-Column Layout */}
      {!isPublishedVideosKPI && data.id !== 'accounts' && data.id !== 'active-accounts' && data.id !== 'link-clicks' && (
        <div className="flex min-w-0">
          {hasNewUploads && (
            <div className={`flex-1 min-w-0 px-5 py-3 ${hasTopGainers ? 'border-r border-border' : ''}`}>
              <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-3 flex items-center gap-2 min-w-0">
                <Upload className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">New Uploads ({totalNewUploads})</span>
                <span className="text-content font-bold ml-auto whitespace-nowrap flex-shrink-0 tabular-nums">
                  {formatDisplayNumber(totalMetricFromNewUploads)} {metricLabel.toLowerCase()}
                </span>
              </h3>
              <div className="space-y-2">
                {newUploads.map((video: VideoSubmission, idx: number) => (
                  <div key={`new-${video.id}-${idx}`} className="flex items-center gap-2 py-2 hover:bg-surface-hover rounded-lg px-2 -mx-2 transition-colors">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-gray-800">
                      {video.thumbnail ? (
                        <img 
                          src={video.thumbnail} 
                          alt={video.title || video.caption || 'Video'} 
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-4 h-4 text-gray-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-content font-medium leading-tight truncate">
                        {truncateText(video.title || video.caption || '(No caption)', 10)}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="w-3 h-3 flex-shrink-0">
                          <PlatformIcon platform={video.platform} size="sm" />
                        </div>
                        <span className="text-[10px] text-content-muted truncate">
                          {truncateText(video.uploaderHandle || video.platform, 10)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs font-bold text-content">
                        {formatDisplayNumber((video as any)[metricKey] || 0)}
                      </p>
                      <p className="text-[10px] text-content-muted">{metricLabel.toLowerCase()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {hasTopGainers && (
            <div className="flex-1 min-w-0 px-5 py-3">
              <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-3 flex items-center gap-2 min-w-0">
                <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Refreshed Videos ({totalTopGainers})</span>
                <span className="text-content font-bold ml-auto whitespace-nowrap flex-shrink-0 tabular-nums">
                  +{formatDisplayNumber(totalMetricFromRefreshedVideos)} {metricLabel.toLowerCase()}
                </span>
              </h3>
              {topGainers.length > 0 ? (
                <div className="space-y-2">
                  {topGainers.map((item: any, idx: number) => (
                    <div key={`gainer-${item.video.id}-${idx}`} className="flex items-center gap-2 py-2 hover:bg-surface-hover rounded-lg px-2 -mx-2 transition-colors">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-gray-800">
                        {item.video.thumbnail ? (
                          <img 
                            src={item.video.thumbnail} 
                            alt={item.video.title || item.video.caption || 'Video'} 
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-4 h-4 text-gray-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-content font-medium leading-tight truncate">
                          {truncateText(item.video.title || item.video.caption || '(No caption)', 10)}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-3 h-3 flex-shrink-0">
                            <PlatformIcon platform={item.video.platform} size="sm" />
                          </div>
                          <span className="text-[10px] text-content-muted truncate">
                            {truncateText(item.video.uploaderHandle || item.video.platform, 10)}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs font-bold text-content">
                          +{formatDisplayNumber(item.absoluteGain)}
                        </p>
                        <p className="text-[10px] text-content-muted">{metricLabel.toLowerCase()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Activity className="w-6 h-6 text-gray-600 mx-auto mb-1" />
                  <p className="text-xs text-content-muted">No growth data</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Single Column Layout for Accounts/Links/Videos */}
      {(data.id === 'accounts' || data.id === 'active-accounts' || data.id === 'link-clicks' || isPublishedVideosKPI) && sortedItems.length > 0 && (
        <div className="px-5 py-3 border-t border-border">
          {(data.id === 'accounts' || data.id === 'active-accounts') ? (
            // Render Accounts with Profile Pictures
            sortedItems.map((account: any, idx: number) => (
              <div 
                key={`${account.handle}-${idx}`}
                className="flex items-center gap-3 py-2.5 hover:bg-surface-hover rounded-lg px-2 -mx-2 transition-colors"
              >
                {/* Profile Picture with Platform Icon */}
                <div className="flex-shrink-0 w-12 h-12 relative">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800">
                    {account.profilePicture && !imageErrors.has(account.handle) ? (
                      <img 
                        src={account.profilePicture} 
                        alt={account.handle} 
                        className="w-full h-full object-cover"
                        onError={() => {
                          setImageErrors(prev => new Set(prev).add(account.handle));
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        {(account.handle || 'A').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-surface-secondary rounded-full flex items-center justify-center border border-border">
                    <PlatformIcon platform={account.platform} className="w-3 h-3" />
                  </div>
                </div>
                
                {/* Account Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-content truncate">
                    {account.handle}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-content-muted">
                      {account.videoCount} {account.videoCount === 1 ? 'video' : 'videos'}
                    </span>
                  </div>
                </div>
                
                {/* Total Views */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold text-content">
                    {formatDisplayNumber(account.totalViews)}
                  </p>
                  <p className="text-xs text-content-muted">{metricLabel}</p>
                </div>
              </div>
            ))
          ) : data.id === 'link-clicks' ? (
            // Render Link Clicks
            sortedItems.map((link: any, idx: number) => (
              <div 
                key={`${link.linkId}-${idx}`}
                className="flex items-center gap-3 py-2.5 hover:bg-surface-hover rounded-lg px-2 -mx-2 transition-colors"
              >
                {/* Link Icon */}
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <LinkIcon className="w-6 h-6 text-blue-400" />
                </div>
                
                {/* Link Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-content truncate">
                    {link.title || 'Untitled Link'}
                  </p>
                  <div className="flex items-center gap-2">
                    {link.accountHandle && (
                      <span className="text-xs text-content-muted truncate">
                        @{link.accountHandle}
                      </span>
                    )}
                    {link.shortCode && (
                      <span className="text-xs text-content-muted">
                        • {link.shortCode}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Click Count */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold text-content">
                    {formatDisplayNumber(link.clicks)}
                  </p>
                  <p className="text-xs text-content-muted">{link.clicks === 1 ? 'click' : 'clicks'}</p>
                </div>
              </div>
            ))
          ) : (
            // Render Videos
            sortedItems.map((video: VideoSubmission, idx: number) => (
              <div 
                key={`${video.id}-${idx}`}
                className="flex items-center gap-3 py-2.5 hover:bg-surface-hover rounded-lg px-2 -mx-2 transition-colors"
              >
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-800">
                  {video.thumbnail ? (
                    <HeicImage 
                      src={video.thumbnail} 
                      alt={video.title || video.caption || 'Video'} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                </div>
                
                {/* Video Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-content truncate">
                    {truncateText(video.title || video.caption || 'Untitled', 10)}
                  </p>
                  <p className="text-xs text-content-muted truncate">
                    @{truncateText(video.uploaderHandle || 'Unknown', 10)}
                  </p>
                </div>
                
                {/* Views */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold text-content">
                    {formatDisplayNumber(video.views || 0)}
                  </p>
                  <p className="text-xs text-content-muted">views</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>,
    document.body
  );
};

