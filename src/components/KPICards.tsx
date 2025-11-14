import React, { useMemo, useState, useCallback } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { VideoSubmission } from '../types';
import { LinkClick } from '../services/LinkClicksService';
import { TrackedLink, TrackedAccount } from '../types/firestore';
import { TimePeriodType } from './TimePeriodSelector';
import DayVideosModal from './DayVideosModal';
import DayClicksModal from './DayClicksModal';
import DayTransactionsModal from './DayTransactionsModal';
import LinkAnalyticsModalEnhanced from './LinkAnalyticsModalEnhanced';
import { TrackedLinksKPICard } from './TrackedLinksKPICard';
import DataAggregationService, { TimeInterval } from '../services/DataAggregationService';
import { useNavigate } from 'react-router-dom';

// Import extracted modules
import { KPICardsProps } from './kpi/kpiTypes';
import { generateKPICardData } from './kpi/generateKPICardData';
import KPICard from './kpi/KPICard';

const KPICardsComponent: React.FC<KPICardsProps> = ({ 
  submissions, 
  allSubmissions, // All submissions for PP calculation
  linkClicks = [], 
  links = [],
  accounts = [],
  dateFilter = 'all',
  customRange,
  timePeriod = 'weeks', 
  granularity = 'day',
  onCreateLink,
  onVideoClick,
  onOpenRevenueSettings,
  revenueMetrics,
  revenueIntegrations = [],
  isEditMode = false,
  cardOrder = [],
  cardVisibility = {},
  onReorder,
  onToggleCard
}) => {
  const navigate = useNavigate();
  // Day Videos Modal state
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayVideos, setSelectedDayVideos] = useState<VideoSubmission[]>([]);
  const [selectedPPVideos, setSelectedPPVideos] = useState<VideoSubmission[]>([]);
  const [selectedLinkClicks, setSelectedLinkClicks] = useState<LinkClick[]>([]);
  const [selectedPPLinkClicks, setSelectedPPLinkClicks] = useState<LinkClick[]>([]);
  const [dayModalMetric, setDayModalMetric] = useState<string>('');
  const [hoveredInterval, setHoveredInterval] = useState<TimeInterval | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<TimeInterval | null>(null);
  
  // Transactions Modal state
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
  const [transactionsMetricType, setTransactionsMetricType] = useState<'revenue' | 'downloads'>('revenue');
  
  // Link analytics modal state
  const [isLinkAnalyticsModalOpen, setIsLinkAnalyticsModalOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<TrackedLink | null>(null);
  const [isDayClicksModalOpen, setIsDayClicksModalOpen] = useState(false);
  const [selectedDayClicksDate, setSelectedDayClicksDate] = useState<Date | null>(null);
  const [selectedDayClicks, setSelectedDayClicks] = useState<LinkClick[]>([]);
  
  // Drag and drop state
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [dragOverCard, setDragOverCard] = useState<string | null>(null);
  const [selectedPPInterval, setSelectedPPInterval] = useState<TimeInterval | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  
  // Censored cards state (persisted in localStorage)
  const [censoredCards, setCensoredCards] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('censoredKPICards');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  const toggleCardCensor = useCallback((cardId: string) => {
    setCensoredCards(prev => {
      const newState = { ...prev, [cardId]: !prev[cardId] };
      localStorage.setItem('censoredKPICards', JSON.stringify(newState));
      return newState;
    });
  }, []);

  // Convert accounts array to Map for TrackedLinksKPICard
  const accountsMap = useMemo(() => {
    const map = new Map<string, TrackedAccount>();
    accounts.forEach(acc => map.set(acc.id, acc));
    return map;
  }, [accounts]);

  const handleCardClick = (metricId: string, metricLabel: string) => {
    // If it's link clicks and there are no links, trigger create link callback
    if (metricId === 'link-clicks' && linkClicks.length === 0 && onCreateLink) {
      onCreateLink();
      return;
    }
    
    // If it's revenue or downloads and no integration is set up, redirect to settings
    if ((metricId === 'revenue' || metricId === 'downloads') && revenueIntegrations.length === 0) {
      navigate('/settings');
      // Set the active tab to revenue when navigating
      localStorage.setItem('settingsActiveTab', 'revenue');
      return;
    }
    
    // If it's revenue or downloads WITH data, show transactions modal
    if ((metricId === 'revenue' || metricId === 'downloads') && revenueMetrics) {
      setTransactionsMetricType(metricId as 'revenue' | 'downloads');
      
      // Set the interval data for the modal
      if (hoveredInterval) {
        setSelectedInterval(hoveredInterval);
        
        // Calculate PP interval if date filter is active
        if (dateFilter !== 'all') {
          let daysBack = 1;
          if (dateFilter === 'last7days') daysBack = 7;
          else if (dateFilter === 'last14days') daysBack = 14;
          else if (dateFilter === 'last30days') daysBack = 30;
          else if (dateFilter === 'last90days') daysBack = 90;
          else if (customRange) {
            const rangeLength = Math.ceil((customRange.endDate.getTime() - customRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
            daysBack = rangeLength;
          }
          
          const intervalLength = hoveredInterval.endDate.getTime() - hoveredInterval.startDate.getTime();
          const ppEndDate = new Date(hoveredInterval.endDate.getTime() - (daysBack * 24 * 60 * 60 * 1000));
          const ppStartDate = new Date(ppEndDate.getTime() - intervalLength);
          
          setSelectedPPInterval({
            startDate: ppStartDate,
            endDate: ppEndDate,
            timestamp: ppStartDate.getTime(),
            intervalType: hoveredInterval.intervalType,
            label: DataAggregationService.formatIntervalLabel(ppStartDate, hoveredInterval.intervalType)
          });
        } else {
          setSelectedPPInterval(null);
        }
      } else {
        // Use the full current period
        setSelectedInterval(null);
        setSelectedPPInterval(null);
      }
      
      setSelectedDate(hoveredInterval ? new Date(hoveredInterval.startDate) : new Date());
      setIsTransactionsModalOpen(true);
      return;
    }
    
    // Open Day Videos Modal with hovered interval or most recent date
    if (submissions.length > 0) {
      let targetDate: Date;
      let videosForInterval: VideoSubmission[];
      let ppVideosForInterval: VideoSubmission[] = [];
      let clicksForInterval: LinkClick[] = [];
      let ppClicksForInterval: LinkClick[] = [];
      let ppIntervalData: TimeInterval | null = null;
      
      // Use hovered interval if available (from tooltip hover)
      if (hoveredInterval) {
        targetDate = new Date(hoveredInterval.startDate);
        
        // Filter videos for the entire interval (day, week, month, or year!)
        videosForInterval = submissions.filter(video => {
          const uploadDate = video.uploadDate ? new Date(video.uploadDate) : new Date(video.dateSubmitted);
          if (DataAggregationService.isDateInInterval(uploadDate, hoveredInterval)) {
            return true;
          }

          const snapshots = video.snapshots || [];
          return snapshots.some(snapshot => {
            const snapshotDate = new Date(snapshot.capturedAt);
            return DataAggregationService.isDateInInterval(snapshotDate, hoveredInterval);
          });
        });
        
        // Filter out invalid/empty videos (0 views, no caption, no data)
        videosForInterval = videosForInterval.filter(v => {
          const hasStats = (v.views || 0) > 0 || (v.likes || 0) > 0 || (v.comments || 0) > 0;
          const hasContent = (v.title && v.title !== '(No caption)') || (v.caption && v.caption !== '(No caption)');
          return hasStats || hasContent;
        });
        
        // Filter link clicks for this interval
        clicksForInterval = linkClicks.filter(click => {
          const clickDate = new Date(click.timestamp);
          return DataAggregationService.isDateInInterval(clickDate, hoveredInterval);
        });
        
        // Calculate PP interval based on date filter, not interval length
        // This ensures that clicking on a day shows the same day from the comparison period
        if (dateFilter !== 'all') {
          // Calculate how far back to go based on date filter
          let daysBack = 1; // Default to yesterday
          
          if (dateFilter === 'last7days') {
            daysBack = 7;
          } else if (dateFilter === 'last14days') {
            daysBack = 14;
          } else if (dateFilter === 'last30days') {
            daysBack = 30;
          } else if (dateFilter === 'last90days') {
            daysBack = 90;
          } else if (customRange) {
            // For custom ranges, calculate the period length in days
            const rangeLength = Math.ceil((customRange.endDate.getTime() - customRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
            daysBack = rangeLength;
          }
          
          // Calculate PP interval by going back by the date filter period
          const intervalLength = hoveredInterval.endDate.getTime() - hoveredInterval.startDate.getTime();
          const ppEndDate = new Date(hoveredInterval.endDate.getTime() - (daysBack * 24 * 60 * 60 * 1000));
          const ppStartDate = new Date(ppEndDate.getTime() - intervalLength);
          
          ppIntervalData = {
            startDate: ppStartDate,
            endDate: ppEndDate,
            timestamp: ppStartDate.getTime(),
            intervalType: hoveredInterval.intervalType,
            label: DataAggregationService.formatIntervalLabel(ppStartDate, hoveredInterval.intervalType)
          };
          
          // Filter PP videos using all submissions
          ppVideosForInterval = (allSubmissions || submissions).filter(video => {
            const uploadDate = video.uploadDate ? new Date(video.uploadDate) : new Date(video.dateSubmitted);
            return DataAggregationService.isDateInInterval(uploadDate, ppIntervalData!);
          });
          
          // Filter PP link clicks
          ppClicksForInterval = linkClicks.filter(click => {
            const clickDate = new Date(click.timestamp);
            return DataAggregationService.isDateInInterval(clickDate, ppIntervalData!);
          });
        }
        
        // Store the interval for modal display
        setSelectedInterval(hoveredInterval);
        setSelectedPPInterval(ppIntervalData);
      } else {
        // Fallback: find most recent date and filter for that single day
        const sortedSubmissions = [...submissions].sort((a, b) => 
          new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
        );
        targetDate = new Date(sortedSubmissions[0].uploadDate);
        
        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        videosForInterval = submissions.filter(video => {
          const primaryDate = video.uploadDate ? new Date(video.uploadDate) : new Date(video.dateSubmitted);
          if (primaryDate >= dayStart && primaryDate <= dayEnd) {
            return true;
          }

          const snapshots = video.snapshots || [];
          return snapshots.some(snapshot => {
            const snapshotDate = new Date(snapshot.capturedAt);
            return snapshotDate >= dayStart && snapshotDate <= dayEnd;
          });
        });
        
        // Filter out invalid/empty videos (0 views, no caption, no data)
        videosForInterval = videosForInterval.filter(v => {
          const hasStats = (v.views || 0) > 0 || (v.likes || 0) > 0 || (v.comments || 0) > 0;
          const hasContent = (v.title && v.title !== '(No caption)') || (v.caption && v.caption !== '(No caption)');
          return hasStats || hasContent;
        });
        
        // Filter link clicks for this day
        clicksForInterval = linkClicks.filter(click => {
          const clickDate = new Date(click.timestamp);
          clickDate.setHours(0, 0, 0, 0);
          return clickDate >= dayStart && clickDate <= dayEnd;
        });
        
        // Calculate PP data even for fallback case if date filter is active
        if (dateFilter !== 'all') {
          // Calculate previous period day based on date filter
          // For example, if filter is 'last7days', go back 7 days
          // If filter is 'last30days', go back 30 days
          let daysBack = 1; // Default to yesterday
          
          if (dateFilter === 'last7days') {
            daysBack = 7;
          } else if (dateFilter === 'last14days') {
            daysBack = 14;
          } else if (dateFilter === 'last30days') {
            daysBack = 30;
          } else if (dateFilter === 'last90days') {
            daysBack = 90;
          } else if (customRange) {
            // For custom ranges, calculate the period length in days
            const rangeLength = Math.ceil((customRange.endDate.getTime() - customRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
            daysBack = rangeLength;
          }
          
          const ppDayStart = new Date(dayStart);
          ppDayStart.setDate(ppDayStart.getDate() - daysBack);
          const ppDayEnd = new Date(ppDayStart);
          ppDayEnd.setHours(23, 59, 59, 999);
          
          ppIntervalData = {
            startDate: ppDayStart,
            endDate: ppDayEnd,
            timestamp: ppDayStart.getTime(),
            intervalType: 'day',
            label: DataAggregationService.formatIntervalLabel(ppDayStart, 'day')
          };
          
          // Filter PP videos
          ppVideosForInterval = (allSubmissions || submissions).filter(video => {
            const videoDate = new Date(video.uploadDate);
            videoDate.setHours(0, 0, 0, 0);
            return videoDate >= ppDayStart && videoDate <= ppDayEnd;
          });
          
          // Filter PP link clicks
          ppClicksForInterval = linkClicks.filter(click => {
            const clickDate = new Date(click.timestamp);
            clickDate.setHours(0, 0, 0, 0);
            return clickDate >= ppDayStart && clickDate <= ppDayEnd;
          });
        }
        
        // Set interval for fallback case (single day)
        setSelectedInterval({
          startDate: dayStart,
          endDate: dayEnd,
          timestamp: dayStart.getTime(),
          intervalType: 'day',
          label: DataAggregationService.formatIntervalLabel(dayStart, 'day')
        });
        setSelectedPPInterval(ppIntervalData);
      }
      
      setSelectedDate(targetDate);
      setSelectedDayVideos(videosForInterval);
      setSelectedPPVideos(ppVideosForInterval);
      setSelectedLinkClicks(clicksForInterval);
      setSelectedPPLinkClicks(ppClicksForInterval);
      setDayModalMetric(metricLabel);
      setIsDayModalOpen(true);
    }
  };

  // Use extracted card generation logic
  const kpiData = useMemo(() => {
    const result = generateKPICardData({
      submissions,
      allSubmissions,
      linkClicks,
      links,
      dateFilter,
      customRange,
      granularity,
      revenueMetrics,
      revenueIntegrations,
      onOpenRevenueSettings
    });
    
    // Return the generated cards
    return result.cards;
  }, [submissions, allSubmissions, linkClicks, links, dateFilter, customRange, granularity, revenueMetrics, revenueIntegrations]);
  // Note: onOpenRevenueSettings removed from deps - it's just a callback, doesn't affect calculated data

  // Memoize sorted and filtered cards to prevent recalculation
  const sortedCards = useMemo(() => {
    // Filter cards based on visibility
    let visibleCards = kpiData.filter(card => cardVisibility[card.id] !== false);
    
    // Sort cards based on saved order
    if (cardOrder.length > 0) {
      visibleCards.sort((a, b) => {
        const aIndex = cardOrder.indexOf(a.id);
        const bIndex = cardOrder.indexOf(b.id);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }
    
    return visibleCards;
  }, [kpiData, cardOrder, cardVisibility]);

  return (
    <>
      <div className="grid gap-3 sm:gap-4 md:gap-5 xl:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ overflow: 'visible' }}>
        {sortedCards.map((card) => {
            // Special handling for link-clicks KPI card
            if (card.id === 'link-clicks') {
              return (
                <TrackedLinksKPICard
                  key={card.id}
                  label={card.label}
                  value={card.value}
                  growth={card.delta?.absoluteValue}
                  isIncreasing={card.delta?.isPositive ?? true}
                  icon={card.icon as any}
                  sparklineData={card.sparklineData?.map(d => ({
                    timestamp: d.timestamp || Date.now(),
                    value: d.value,
                    clicks: linkClicks.filter(click => {
                      if (!d.timestamp) return false;
                      const clickDate = new Date(click.timestamp).setHours(0, 0, 0, 0);
                      const intervalDate = new Date(d.timestamp).setHours(0, 0, 0, 0);
                      return clickDate === intervalDate;
                    })
                  })) || []}
                  links={links}
                  accounts={accountsMap}
                  isCensored={censoredCards[card.id] || false}
                  onToggleCensor={() => toggleCardCensor(card.id)}
                  onClick={(date, clicks) => {
                    if (!isEditMode) {
                    setSelectedDayClicksDate(date);
                    setSelectedDayClicks(clicks);
                    setIsDayClicksModalOpen(true);
                    }
                  }}
                  onLinkClick={(shortCode) => {
                    const link = links.find(l => l.shortCode === shortCode);
                    if (link) {
                      setSelectedLink(link);
                      setIsLinkAnalyticsModalOpen(true);
                    }
                  }}
                  isEditMode={isEditMode}
                  isDragging={draggedCard === card.id}
                  isDragOver={dragOverCard === card.id}
                  onDragStart={() => {
                    if (isEditMode) setDraggedCard(card.id);
                  }}
                  onDragEnd={() => {
                    setDraggedCard(null);
                    setDragOverCard(null);
                  }}
                  onDragOver={(e) => {
                    if (isEditMode) {
                      e.preventDefault();
                      setDragOverCard(card.id);
                    }
                  }}
                  onDragLeave={() => {
                    setDragOverCard(null);
                  }}
                  onDrop={() => {
                    if (isEditMode && draggedCard && draggedCard !== card.id) {
                      const currentOrder = cardOrder.length > 0 ? cardOrder : kpiData.map(c => c.id);
                      const draggedIndex = currentOrder.indexOf(draggedCard);
                      const targetIndex = currentOrder.indexOf(card.id);
                      
                      if (draggedIndex !== -1 && targetIndex !== -1) {
                        const newOrder = [...currentOrder];
                        newOrder.splice(draggedIndex, 1);
                        newOrder.splice(targetIndex, 0, draggedCard);
                        onReorder?.(newOrder);
                      }
                    }
                    setDraggedCard(null);
                    setDragOverCard(null);
                  }}
                />
              );
            }
            
            // Regular KPI card for all other metrics
            return (
              <KPICard 
                key={card.id} 
                data={card} 
                onClick={() => !isEditMode && handleCardClick(card.id, card.label)}
                onIntervalHover={setHoveredInterval}
                timePeriod={timePeriod}
                submissions={submissions}
                linkClicks={linkClicks}
                dateFilter={dateFilter}
                customRange={customRange}
                isEditMode={isEditMode}
                isDragging={draggedCard === card.id}
                isDragOver={dragOverCard === card.id}
                isCensored={censoredCards[card.id] || false}
                onToggleCensor={() => toggleCardCensor(card.id)}
                onDragStart={() => {
                  if (isEditMode) setDraggedCard(card.id);
                }}
                onDragEnd={() => {
                  setDraggedCard(null);
                  setDragOverCard(null);
                }}
                onDragOver={(e) => {
                  if (isEditMode) {
                    e.preventDefault();
                    setDragOverCard(card.id);
                  }
                }}
                onDragLeave={() => {
                  setDragOverCard(null);
                }}
                onDrop={() => {
                  if (isEditMode && draggedCard && draggedCard !== card.id) {
                    const currentOrder = cardOrder.length > 0 ? cardOrder : kpiData.map(c => c.id);
                    const draggedIndex = currentOrder.indexOf(draggedCard);
                    const targetIndex = currentOrder.indexOf(card.id);
                    
                    if (draggedIndex !== -1 && targetIndex !== -1) {
                      const newOrder = [...currentOrder];
                      newOrder.splice(draggedIndex, 1);
                      newOrder.splice(targetIndex, 0, draggedCard);
                      onReorder?.(newOrder);
                    }
                  }
                  setDraggedCard(null);
                  setDragOverCard(null);
                }}
              />
            );
          })}
      </div>

      {/* Trash Drop Zone - Only visible when dragging a KPI card */}
      {isEditMode && draggedCard && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsOverTrash(true);
          }}
          onDragLeave={() => setIsOverTrash(false)}
          onDrop={() => {
            if (draggedCard && onToggleCard) {
              // Hide the card by toggling its visibility
              onToggleCard(draggedCard);
            }
            setDraggedCard(null);
            setIsOverTrash(false);
          }}
          className={`
            fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[100]
            flex flex-col items-center justify-center gap-2
            px-6 py-4 rounded-xl border-2 border-dashed
            transition-all duration-200
            ${isOverTrash 
              ? 'bg-red-500/20 border-red-500 scale-105' 
              : 'bg-red-500/5 border-red-500/40 hover:bg-red-500/10'
            }
          `}
        >
          <svg className={`w-8 h-8 transition-all ${isOverTrash ? 'text-red-400' : 'text-red-400/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className={`text-xs font-medium transition-all ${isOverTrash ? 'text-red-300' : 'text-red-400/60'}`}>
            {isOverTrash ? 'Release to hide card' : 'Drag here to hide card'}
          </span>
        </div>
      )}

      {/* Old Metrics Modal Removed - Now using Day Videos Modal */}

      {selectedDate && (
        <DayVideosModal
          isOpen={isDayModalOpen}
          onClose={() => setIsDayModalOpen(false)}
          date={selectedDate}
          videos={selectedDayVideos}
          metricLabel={dayModalMetric}
          onVideoClick={onVideoClick}
          interval={selectedInterval}
          ppVideos={selectedPPVideos}
          ppInterval={selectedPPInterval}
          linkClicks={selectedLinkClicks}
          ppLinkClicks={selectedPPLinkClicks}
          selectedPeriodRange={dateFilter !== 'all' && customRange ? customRange : undefined}
        />
      )}

      {/* Day Transactions Modal for Revenue & Downloads */}
      {selectedDate && (
        <DayTransactionsModal
          isOpen={isTransactionsModalOpen}
          onClose={() => setIsTransactionsModalOpen(false)}
          date={selectedDate}
          revenueMetrics={revenueMetrics || null}
          metricType={transactionsMetricType}
          interval={selectedInterval}
          ppInterval={selectedPPInterval}
        />
      )}

      {/* Day Clicks Modal for Link Analytics */}
      {isDayClicksModalOpen && selectedDayClicksDate && (
        <DayClicksModal
          isOpen={isDayClicksModalOpen}
          onClose={() => {
            setIsDayClicksModalOpen(false);
            setSelectedDayClicksDate(null);
            setSelectedDayClicks([]);
          }}
          date={selectedDayClicksDate}
          clicks={selectedDayClicks}
          links={links}
          accounts={accountsMap}
          onLinkClick={(link) => {
            setIsDayClicksModalOpen(false);
            setSelectedLink(link);
            setIsLinkAnalyticsModalOpen(true);
          }}
        />
      )}

      {/* Link Analytics Modal */}
      {selectedLink && (
        <LinkAnalyticsModalEnhanced
          isOpen={isLinkAnalyticsModalOpen}
          onClose={() => {
            setIsLinkAnalyticsModalOpen(false);
            setSelectedLink(null);
          }}
          link={selectedLink}
        />
      )}
    </>
  );
};

// Custom comparison function for React.memo to prevent unnecessary re-renders
const arePropsEqual = (prevProps: KPICardsProps, nextProps: KPICardsProps) => {
  // Only re-render if these specific props actually change
  return (
    prevProps.submissions === nextProps.submissions &&
    prevProps.allSubmissions === nextProps.allSubmissions &&
    prevProps.linkClicks === nextProps.linkClicks &&
    prevProps.dateFilter === nextProps.dateFilter &&
    prevProps.timePeriod === nextProps.timePeriod &&
    prevProps.granularity === nextProps.granularity &&
    prevProps.isEditMode === nextProps.isEditMode &&
    JSON.stringify(prevProps.customRange) === JSON.stringify(nextProps.customRange) &&
    JSON.stringify(prevProps.cardOrder) === JSON.stringify(nextProps.cardOrder) &&
    JSON.stringify(prevProps.cardVisibility) === JSON.stringify(nextProps.cardVisibility) &&
    prevProps.revenueMetrics === nextProps.revenueMetrics
  );
};

// Memoize the component for performance with custom comparison
const KPICards = React.memo(KPICardsComponent, arePropsEqual);
KPICards.displayName = 'KPICards';

// Separate component to handle sparkline rendering consistently (kept for reference)
// @ts-ignore - Keeping for potential future use
const _KPISparkline: React.FC<{
  data: Array<{ value: number; timestamp?: number; previousValue?: number }>;
  id: string;
  gradient: string[];
  stroke: string;
  timePeriod?: TimePeriodType;
  totalValue?: string | number;
  metricLabel?: string;
}> = ({ data, id, gradient, stroke, timePeriod = 'days', totalValue: _totalValue, metricLabel }) => {
  
  const formatTooltipDate = (timestamp?: number) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    if (timePeriod === 'weeks') {
      const weekEnd = new Date(timestamp + (6 * 24 * 60 * 60 * 1000));
      return `${monthNames[date.getMonth()]} ${date.getDate()}–${date.getMonth() === weekEnd.getMonth() ? weekEnd.getDate() : monthNames[weekEnd.getMonth()] + ' ' + weekEnd.getDate()}`;
    } else if (timePeriod === 'months') {
      return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    } else {
      // Default to days format (for 'days' or any other case)
      return `${monthNames[date.getMonth()]} ${date.getDate()}`;
    }
  };
  
  return (
    <div 
      onMouseLeave={() => {
        // Force clear tooltips on mouse leave
        const tooltips = document.querySelectorAll('[class*="recharts-tooltip-wrapper"]');
        tooltips.forEach(tooltip => {
          if (tooltip instanceof HTMLElement) {
            tooltip.style.display = 'none';
          }
        });
      }}
      style={{ width: '100%', height: 56 }}
    >
    <ResponsiveContainer width="100%" height={56}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradient[0]} stopOpacity={0.4} />
            <stop offset="50%" stopColor={gradient[0]} stopOpacity={0.2} />
            <stop offset="100%" stopColor={gradient[1]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          position={{ y: -60 }}
          offset={40}
          allowEscapeViewBox={{ x: false, y: true }}
          isAnimationActive={false}
          animationDuration={0}
          wrapperStyle={{ 
            zIndex: 99999,
            position: 'fixed',
            pointerEvents: 'none'
          }}
          content={({ active, payload }: { active?: boolean; payload?: any[] }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              const value = data.value;
              const timestamp = data.timestamp;
              const previousValue = data.previousValue;
              
              const dateStr = formatTooltipDate(timestamp);
              const showComparison = false; // Hourly comparison removed
              
              const diff = previousValue !== undefined ? value - previousValue : 0;
              let trendText = '';
              if (showComparison && previousValue !== undefined) {
                const percentChange = previousValue > 0 ? ((diff / previousValue) * 100).toFixed(1) : '0';
                const isPositive = diff >= 0;
                const trendIcon = isPositive ? '↑' : '↓';
                trendText = `${trendIcon} ${Math.abs(Number(percentChange))}% vs yesterday`;
              }
              
              // Format value based on metric type
              const isEngagementRate = id === 'engagementRate';
              
              // Helper function to format numbers (1M, 200K, etc.)
              const formatDisplayNumber = (num: number): string => {
                if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
                if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
                return num.toLocaleString();
              };
              
              const displayValue = isEngagementRate 
                ? `${value?.toLocaleString()}%` 
                : formatDisplayNumber(value);
              
              return (
                <div className="bg-[#1a1a1a] backdrop-blur-xl text-white px-5 py-3 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-sm space-y-2 min-w-[240px] border border-white/10 pointer-events-none" style={{ zIndex: 999999, position: 'relative' }}>
                  {/* Show date at top */}
                  {dateStr && (
                    <p className="text-xs text-gray-400 font-medium tracking-wider">
                      {dateStr}
                    </p>
                  )}
                  {/* Show value prominently */}
                  <p className="text-lg text-white font-bold">
                    {displayValue} {metricLabel?.toLowerCase()}
                  </p>
                  {/* Show trend comparison if available */}
                  {showComparison && trendText && (
                    <p className={`text-xs font-semibold ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trendText}
                    </p>
                  )}
                </div>
              );
            }
            return null;
          }}
          cursor={{ stroke: stroke, strokeWidth: 1, strokeDasharray: '3 3' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={2.5}
          fill={`url(#gradient-${id})`}
          isAnimationActive={true}
          animationDuration={400}
          animationEasing="ease-out"
          animationBegin={0}
          connectNulls={true}
          dot={false}
          activeDot={{ 
            r: 3, 
            fill: stroke, 
            strokeWidth: 1.5, 
            stroke: 'rgba(255, 255, 255, 0.3)',
            style: { cursor: 'pointer' }
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  );
};

export default KPICards;
