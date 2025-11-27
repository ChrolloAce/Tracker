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
import { HeicImage } from '../HeicImage';
import { KPICardData } from './kpiTypes';

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
  
  // Calculate new uploads and top gainers counts
  const videosInInterval = interval ? submissions.filter((video: VideoSubmission) => {
    const uploadDate = video.uploadDate ? new Date(video.uploadDate) : new Date(video.dateSubmitted);
    return DataAggregationService.isDateInInterval(uploadDate, interval);
  }) : [];
  
  // Get ALL videos with snapshot activity
  const videosWithSnapshotsInIntervalCheck = interval ? submissions.filter((video: VideoSubmission) => {
    const snapshots = video.snapshots || [];
    return snapshots.length > 0;
  }) : [];
  
  // Calculate refreshed videos (videos with growth)
  const topGainersCheck = videosWithSnapshotsInIntervalCheck
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
      
      if (!snapshotAtStart || snapshotAtStart === snapshotAtEnd) {
        const initialSnapshot = video.snapshots?.find(s => s.isInitialSnapshot) || sortedSnapshots[0];
        if (!initialSnapshot) return null;
        
        const growthMetricKey = data.id === 'views' ? 'views' 
          : data.id === 'likes' ? 'likes'
          : data.id === 'comments' ? 'comments'
          : data.id === 'shares' ? 'shares'
          : data.id === 'bookmarks' ? 'bookmarks'
          : 'views';
        
        const startValue = (initialSnapshot as any)[growthMetricKey] || 0;
        const endValue = (snapshotAtEnd as any)[growthMetricKey] || 0;
        const growth = endValue - startValue;
        
        return growth > 0 ? { video, growth, absoluteGain: growth } : null;
      }
      
      const growthMetricKey = data.id === 'views' ? 'views' 
        : data.id === 'likes' ? 'likes'
        : data.id === 'comments' ? 'comments'
        : data.id === 'shares' ? 'shares'
        : data.id === 'bookmarks' ? 'bookmarks'
        : 'views';
      
      const startValue = (snapshotAtStart as any)[growthMetricKey] || 0;
      const endValue = (snapshotAtEnd as any)[growthMetricKey] || 0;
      const absoluteGain = endValue - startValue;
      
      return absoluteGain > 0 ? { video, growth: absoluteGain, absoluteGain } : null;
    })
    .filter(item => item !== null);
  
  const hasTopGainers = topGainersCheck.length > 0;
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
  // For revenue metrics, use point.date if available (direct date from data)
  // For other metrics, use interval (aggregated time range)
  let dateStr = '';
  if (point.date && (data.id === 'revenue' || data.id === 'downloads')) {
    // Revenue/Downloads have specific dates in sparkline data
    const dateObj = new Date(point.date);
    dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } else if (interval) {
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
  
  const isRevenueMetric = data.id === 'revenue';
  const isDownloadsMetric = data.id === 'downloads';
  
  const formatDisplayNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    if (isRevenueMetric) return `$${num.toFixed(2)}`; // Add $ here for revenue
    if (isDownloadsMetric) return num.toLocaleString();
    return num.toLocaleString();
  };
  
  // Don't add $ again since formatDisplayNumber already includes it for revenue
  const displayValue = typeof value === 'number' ? formatDisplayNumber(value) : value;
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
    const formattedDiff = isRevenueMetric ? `$${Math.abs(diff).toFixed(2)}` : Math.abs(diff).toLocaleString();
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
  
  const videosWithSnapshotsInInterval = interval ? submissions.filter((video: VideoSubmission) => {
    const snapshots = video.snapshots || [];
    return snapshots.length > 0;
  }) : [];
  
  const allTopGainers = videosWithSnapshotsInInterval
    .map((video: VideoSubmission) => {
      const allSnapshots = (video.snapshots || []);
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
      
      if (!snapshotAtStart || snapshotAtStart === snapshotAtEnd) {
        const initialSnapshot = video.snapshots?.find(s => s.isInitialSnapshot) || sortedSnapshots[0];
        if (!initialSnapshot) return null;
        
        // Always use VIEWS as the primary metric for determining if a video should be shown
        const viewsStartValue = (initialSnapshot as any)['views'] || 0;
        const viewsEndValue = (snapshotAtEnd as any)['views'] || 0;
        const viewsGrowth = viewsEndValue - viewsStartValue;
        
        // But calculate the display metric based on the current KPI
        const growthMetricKey = data.id === 'views' ? 'views' 
          : data.id === 'likes' ? 'likes'
          : data.id === 'comments' ? 'comments'
          : data.id === 'shares' ? 'shares'
          : data.id === 'bookmarks' ? 'bookmarks'
          : 'views';
        const startValue = (initialSnapshot as any)[growthMetricKey] || 0;
        const endValue = (snapshotAtEnd as any)[growthMetricKey] || 0;
        const growth = endValue - startValue;
        const growthPercentage = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
        
        return { video, growth, growthPercentage, absoluteGain: growth, viewsGrowth };
      }
      
      // Always use VIEWS as the primary metric for determining if a video should be shown
      const viewsStartValue = (snapshotAtStart as any)['views'] || 0;
      const viewsEndValue = (snapshotAtEnd as any)['views'] || 0;
      const viewsGrowth = viewsEndValue - viewsStartValue;
      
      // But calculate the display metric based on the current KPI
      const growthMetricKey = data.id === 'views' ? 'views' 
        : data.id === 'likes' ? 'likes'
        : data.id === 'comments' ? 'comments'
        : data.id === 'shares' ? 'shares'
        : data.id === 'bookmarks' ? 'bookmarks'
        : 'views';
      
      const startValue = (snapshotAtStart as any)[growthMetricKey] || 0;
      const endValue = (snapshotAtEnd as any)[growthMetricKey] || 0;
      const growth = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
      const absoluteGain = endValue - startValue;
      
      return { video, growth, metricValue: endValue, absoluteGain, startValue, snapshotCount: allSnapshots.length, viewsGrowth };
    })
    .filter(item => item !== null && item.viewsGrowth !== undefined && item.viewsGrowth > 0);
  
  const totalTopGainers = allTopGainers.length;
  const topGainers = [...allTopGainers]
    .sort((a: any, b: any) => (b.absoluteGain || 0) - (a.absoluteGain || 0))
    .slice(0, 5);
  
  // Calculate total metrics from NEW UPLOADS and REFRESHED VIDEOS (based on current metric)
  const totalMetricFromNewUploads = videosInInterval.reduce((sum, video) => sum + ((video as any)[metricKey] || 0), 0);
  const totalMetricFromRefreshedVideos = allTopGainers.reduce((sum: number, item: any) => sum + (item.absoluteGain || 0), 0);
  
  // CRITICAL FIX: Add refreshed video metrics to the tooltip header value
  // The sparkline point.value only includes NEW UPLOADS, we need to add REFRESHED VIDEOS growth
  if (totalMetricFromRefreshedVideos > 0) {
    value = (value || 0) + totalMetricFromRefreshedVideos;
  }
  
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
      className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10" 
      style={{ 
        position: 'fixed',
        left: `${leftPosition}px`,
        top: `${tooltipData.y + verticalOffset}px`,
        transform: `translateX(${transformX})`,
        zIndex: 999999999,
        width: `${tooltipWidth}px`,
        maxHeight: '500px',
        pointerEvents: 'none'
      }}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 space-y-2.5">
        <div className="flex items-center justify-between">
          {(data.id === 'revenue' || data.id === 'downloads') ? (
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-center gap-1.5">
                {data.appIcon && (
                  <img 
                    src={data.appIcon} 
                    alt={data.appName || data.label}
                    className="w-4 h-4 rounded object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              <p className="text-xs text-gray-400 font-medium tracking-wider">{dateStr}</p>
              </div>
              <p className="text-2xl font-bold text-white">{displayValue}</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 font-medium tracking-wider">{dateStr}</p>
              <p className="text-xl font-bold text-white">{displayValue}</p>
            </>
          )}
        </div>
        
        {ppComparison && ppComparison.displayValue && ppDateStr && (
          <div className="flex items-center justify-between">
            {(data.id === 'revenue' || data.id === 'downloads') ? (
              <div className="flex items-baseline gap-2 flex-1">
                <p className="text-xs text-gray-500 font-medium tracking-wider">{ppDateStr}</p>
                <p className="text-lg font-semibold text-gray-400">{ppComparison.displayValue}</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 font-medium tracking-wider">{ppDateStr}</p>
                <p className="text-lg font-semibold text-gray-400">{ppComparison.displayValue}</p>
              </>
            )}
          </div>
        )}
        
        {ppComparison && ppDateStr && ppComparison.percentChange !== Infinity && ppComparison.percentChange !== 0 && (
          <div className="pt-2 border-t border-white/5">
            <p className="text-xs font-medium text-gray-400">
              <span className={ppComparison.isPositive ? 'text-emerald-400' : 'text-red-400'}>
                {ppComparison.isPositive ? '↑' : '↓'} {(() => {
                  const percent = Math.abs(ppComparison.percentChange);
                  if (percent >= 1000000) return `${(percent / 1000000).toFixed(1)}M`;
                  if (percent >= 1000) return `${(percent / 1000).toFixed(1)}K`;
                  return percent.toFixed(1);
                })()}%
              </span>
              {' '}{ppComparison.isPositive ? 'increase' : 'decrease'} on CP
            </p>
          </div>
        )}
      </div>
      
      {data.id !== 'revenue' && data.id !== 'downloads' && <div className="border-t border-white/10 mx-5"></div>}
      
      {/* Two-Column Layout */}
      {!isPublishedVideosKPI && data.id !== 'accounts' && data.id !== 'active-accounts' && data.id !== 'link-clicks' && data.id !== 'revenue' && data.id !== 'downloads' && (
        <div className="flex">
          {hasNewUploads && (
            <div className={`flex-1 px-5 py-3 ${hasTopGainers ? 'border-r border-white/10' : ''}`}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Upload className="w-3.5 h-3.5" />
                <span>New Uploads ({totalNewUploads})</span>
                <span className="text-white font-bold ml-auto">{formatDisplayNumber(totalMetricFromNewUploads)} {metricLabel.toLowerCase()}</span>
              </h3>
              <div className="space-y-2">
                {newUploads.map((video: VideoSubmission, idx: number) => (
                  <div key={`new-${video.id}-${idx}`} className="flex items-center gap-2 py-2 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors">
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
                      <p className="text-xs text-white font-medium leading-tight">
                        {((video.title || video.caption || '(No caption)').length > 13 
                          ? (video.title || video.caption || '(No caption)').substring(0, 13) + '...'
                          : (video.title || video.caption || '(No caption)'))}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="w-3 h-3">
                          <PlatformIcon platform={video.platform} size="sm" />
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {video.uploaderHandle || video.platform}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs font-bold text-white">
                        {formatDisplayNumber((video as any)[metricKey] || 0)}
                      </p>
                      <p className="text-[10px] text-gray-500">{metricLabel.toLowerCase()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {hasTopGainers && (
            <div className="flex-1 px-5 py-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refreshed Videos ({totalTopGainers})</span>
                <span className="text-white font-bold ml-auto">+{formatDisplayNumber(totalMetricFromRefreshedVideos)} {metricLabel.toLowerCase()}</span>
              </h3>
              {topGainers.length > 0 ? (
                <div className="space-y-2">
                  {topGainers.map((item: any, idx: number) => (
                    <div key={`gainer-${item.video.id}-${idx}`} className="flex items-center gap-2 py-2 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors">
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
                        <p className="text-xs text-white font-medium leading-tight">
                          {((item.video.title || item.video.caption || '(No caption)').length > 13 
                            ? (item.video.title || item.video.caption || '(No caption)').substring(0, 13) + '...'
                            : (item.video.title || item.video.caption || '(No caption)'))}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-3 h-3">
                            <PlatformIcon platform={item.video.platform} size="sm" />
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {item.video.uploaderHandle || item.video.platform}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs font-bold text-white">
                          +{formatDisplayNumber(item.absoluteGain)}
                        </p>
                        <p className="text-[10px] text-gray-500">{metricLabel.toLowerCase()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Activity className="w-6 h-6 text-gray-600 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">No growth data</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Single Column Layout for Accounts/Links/Videos */}
      {(data.id === 'accounts' || data.id === 'active-accounts' || data.id === 'link-clicks' || isPublishedVideosKPI) && sortedItems.length > 0 && (
        <div className="px-5 py-3 border-t border-white/10">
          {(data.id === 'accounts' || data.id === 'active-accounts') ? (
            // Render Accounts with Profile Pictures
            sortedItems.map((account: any, idx: number) => (
              <div 
                key={`${account.handle}-${idx}`}
                className="flex items-center gap-3 py-2.5 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
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
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#1a1a1a] rounded-full flex items-center justify-center border border-white/10">
                    <PlatformIcon platform={account.platform} className="w-3 h-3" />
                  </div>
                </div>
                
                {/* Account Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {account.handle}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">
                      {account.videoCount} {account.videoCount === 1 ? 'video' : 'videos'}
                    </span>
                  </div>
                </div>
                
                {/* Total Views */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold text-white">
                    {formatDisplayNumber(account.totalViews)}
                  </p>
                  <p className="text-xs text-gray-500">{metricLabel}</p>
                </div>
              </div>
            ))
          ) : data.id === 'link-clicks' ? (
            // Render Link Clicks
            sortedItems.map((link: any, idx: number) => (
              <div 
                key={`${link.linkId}-${idx}`}
                className="flex items-center gap-3 py-2.5 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
              >
                {/* Link Icon */}
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <LinkIcon className="w-6 h-6 text-blue-400" />
                </div>
                
                {/* Link Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {link.title || 'Untitled Link'}
                  </p>
                  <div className="flex items-center gap-2">
                    {link.accountHandle && (
                      <span className="text-xs text-gray-400 truncate">
                        @{link.accountHandle}
                      </span>
                    )}
                    {link.shortCode && (
                      <span className="text-xs text-gray-500">
                        • {link.shortCode}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Click Count */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold text-white">
                    {formatDisplayNumber(link.clicks)}
                  </p>
                  <p className="text-xs text-gray-500">{link.clicks === 1 ? 'click' : 'clicks'}</p>
                </div>
              </div>
            ))
          ) : (
            // Render Videos
            sortedItems.map((video: VideoSubmission, idx: number) => (
              <div 
                key={`${video.id}-${idx}`}
                className="flex items-center gap-3 py-2.5 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
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
                  <p className="text-sm font-medium text-white truncate">
                    {video.title || video.caption || 'Untitled'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    @{video.uploaderHandle || 'Unknown'}
                  </p>
                </div>
                
                {/* Views */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold text-white">
                    {formatDisplayNumber(video.views || 0)}
                  </p>
                  <p className="text-xs text-gray-500">views</p>
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

