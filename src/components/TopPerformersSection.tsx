import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Masonry from 'react-masonry-css';
import { Activity, Info } from 'lucide-react';
import { VideoSubmission } from '../types';
import TopPerformersRaceChart from './TopPerformersRaceChart';
import HeatmapByHour from './HeatmapByHour';
import TopTeamCreatorsList from './TopTeamCreatorsList';
import TopPlatformsRaceChart from './TopPlatformsRaceChart';
import ComparisonGraph from './ComparisonGraph';
import TopCreatorsRanking, {
  RankingAccount,
  RankingCreator,
  RankingCreatorLink,
} from './TopCreatorsRanking';
import { DateFilterType } from './DateRangeFilter';

interface TopPerformersSectionProps {
  submissions: VideoSubmission[];
  onVideoClick?: (video: VideoSubmission) => void;
  onAccountClick?: (username: string) => void;
  /** Optional richer callback for creator-row clicks (e.g. Top Performers'
   *  creators list) — receives the creator's id, displayName, and the full
   *  list of usernames linked to them. Falls back to onAccountClick when not
   *  provided (legacy behavior). */
  onCreatorRowClick?: (info: { creatorId: string; displayName: string; usernames: string[] }) => void;
  /** Fired when a row in the Top Platforms race chart is clicked. */
  onPlatformClick?: (platform: VideoSubmission['platform']) => void;
  onHeatmapCellClick?: (params: {
    dayIndex: number;
    hour: number;
    range: { start: Date; end: Date };
  }) => void;
  subsectionVisibility: Record<string, boolean>;
  isEditMode?: boolean;
  onToggleSubsection?: (id: string) => void;
  granularity?: 'hour' | 'day' | 'week' | 'month' | 'year';
  dateRange?: { startDate: Date; endDate: Date }; // Date range from filter
  dateFilter?: DateFilterType; // Date filter type
  customRange?: { startDate: Date; endDate: Date }; // Custom date range
  /**
   * Optional props for the data-driven `top-creators-ranking` subsection.
   * When provided (and the subsection is visible), renders TopCreatorsRanking
   * inside the masonry grid. Used by the public share page.
   */
  rankingCreators?: RankingCreator[];
  rankingCreatorLinks?: RankingCreatorLink[];
  rankingAccounts?: RankingAccount[];
  /**
   * Layout mode. `masonry` (default) packs cards with varying heights via
   * react-masonry-css — the main dashboard's current behavior. `grid` renders
   * a uniform 2-column CSS grid with fixed row height, so every card is the
   * same size. Used by the public share page.
   */
  layout?: 'masonry' | 'grid';
}

type SubSectionId =
  | 'top-videos'
  | 'top-accounts'
  | 'top-gainers'
  | 'posting-times'
  | 'top-creators'
  | 'top-creators-ranking'
  | 'top-platforms'
  | 'comparison';

const TopPerformersSection = React.memo<TopPerformersSectionProps>(({
  submissions,
  onVideoClick,
  onAccountClick,
  onCreatorRowClick,
  onPlatformClick,
  onHeatmapCellClick,
  subsectionVisibility,
  isEditMode = false,
  onToggleSubsection,
  granularity = 'week',
  dateRange,
  dateFilter = 'all',
  customRange,
  rankingCreators,
  rankingCreatorLinks,
  rankingAccounts,
  layout = 'masonry'
}) => {
  const isGridLayout = layout === 'grid';
  console.log('🎯 TopPerformersSection rendering', { 
    subsectionVisibility,
    isEditMode,
    dateFilter 
  });
  
  // Load subsection order from localStorage
  const [subsectionOrder, setSubsectionOrder] = useState<SubSectionId[]>(() => {
    const defaultOrder: SubSectionId[] = ['top-videos', 'top-accounts', 'top-gainers', 'posting-times', 'top-creators', 'top-creators-ranking', 'top-platforms', 'comparison'];
    const saved = localStorage.getItem('topPerformersSubsectionOrder');
    
    if (saved) {
      try {
        const parsedOrder: SubSectionId[] = JSON.parse(saved);
        // Merge with defaults to include any new subsections
        const merged = [...new Set([...parsedOrder, ...defaultOrder])];
        
        // Save the merged order back if it changed
        if (merged.length !== parsedOrder.length) {
          localStorage.setItem('topPerformersSubsectionOrder', JSON.stringify(merged));
        }
        
        return merged as SubSectionId[];
      } catch (e) {
        console.error('Failed to parse topPerformersSubsectionOrder', e);
        return defaultOrder;
      }
    }
    
    return defaultOrder;
  });

  // Drag and drop state
  const [draggedSection, setDraggedSection] = useState<SubSectionId | null>(null);
  const [dragOverSection, setDragOverSection] = useState<SubSectionId | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  
  // Info tooltip state
  const [showPostingTimesInfo, setShowPostingTimesInfo] = useState(false);

  // Memoize heatmap data transformation
  const heatmapData = useMemo(() => {
    return submissions.map(video => ({
      timestamp: video.uploadDate || video.dateSubmitted,
      views: video.views,
      likes: video.likes,
      comments: video.comments,
      shares: video.shares,
      videos: [{
        id: video.id,
        title: video.title || video.caption || 'Untitled',
        thumbnailUrl: video.thumbnail,
        views: video.views,
        uploaderHandle: video.uploaderHandle
      }]
    }));
  }, [submissions]);

  // Save order to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('topPerformersSubsectionOrder', JSON.stringify(subsectionOrder));
  }, [subsectionOrder]);

  // Filter subsections based on visibility settings
  const visibleSubsections = useMemo(() => {
    const visible = subsectionOrder.filter(id => subsectionVisibility[id] === true);
    console.log('🔍 Top Performers Subsections:', { 
      subsectionVisibility, 
      subsectionOrder, 
      visibleSubsections: visible 
    });
    return visible;
  }, [subsectionOrder, subsectionVisibility]);

  // Masonry breakpoint configuration
  const breakpointColumns = useMemo(() => ({
    default: 2,  // 2 columns by default
    1280: 2,     // 2 columns on xl screens
    1024: 2,     // 2 columns on lg screens
    768: 1,      // 1 column on md screens and below
  }), []);

  // Create drag handlers for a subsection
  const createDragHandlers = useCallback((id: SubSectionId) => ({
    draggable: isEditMode,
    onDragStart: () => {
      if (isEditMode) {
        console.log('🚀 Drag started:', id, 'isEditMode:', isEditMode);
        setDraggedSection(id);
      }
    },
    onDragEnd: () => {
      console.log('🏁 Drag ended');
      setDraggedSection(null);
      setDragOverSection(null);
      setIsOverTrash(false);
    },
    onDragOver: (e: React.DragEvent) => {
      if (isEditMode) {
        e.preventDefault();
        setDragOverSection(id);
      }
    },
    onDragLeave: () => {
      setDragOverSection(null);
    },
    onDrop: () => {
      if (isEditMode && draggedSection && draggedSection !== id) {
        const draggedIndex = subsectionOrder.indexOf(draggedSection);
        const targetIndex = subsectionOrder.indexOf(id);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
          const newOrder = [...subsectionOrder];
          newOrder.splice(draggedIndex, 1);
          newOrder.splice(targetIndex, 0, draggedSection);
          setSubsectionOrder(newOrder);
        }
      }
      setDraggedSection(null);
      setDragOverSection(null);
    }
  }), [isEditMode, draggedSection, subsectionOrder]);

  // Get drag classes for visual feedback. When in uniform-grid mode every
  // wrapper gets `h-full` so cards stretch to their 480px grid row height.
  const getDragClasses = useCallback((id: SubSectionId, baseClasses: string) => {
    const isDragging = draggedSection === id;
    const isDragOver = dragOverSection === id;

    return `
      ${baseClasses}
      ${isGridLayout ? 'h-full' : ''}
      ${isEditMode ? 'cursor-move' : ''}
      ${isDragging ? 'opacity-50 scale-95' : ''}
      ${isDragOver ? 'ring-2 ring-emerald-500 border-emerald-500/50 scale-105' : ''}
      transition-all duration-300
    `;
  }, [draggedSection, dragOverSection, isEditMode, isGridLayout]);

  // Render a subsection
  const renderSubsection = (id: SubSectionId) => {
    const dragHandlers = createDragHandlers(id);

    switch (id) {
      case 'top-videos':
        return (
          <div 
            {...dragHandlers}
            className={getDragClasses(id, "group relative")}
          >
            <TopPerformersRaceChart
              submissions={submissions}
              onVideoClick={onVideoClick}
              onAccountClick={onAccountClick}
              type="videos"
              dateFilter={dateFilter}
              customRange={customRange}
            />
          </div>
        );
      
      case 'top-accounts':
        return (
          <div 
            {...dragHandlers}
            className={getDragClasses(id, "group relative")}
          >
            <TopPerformersRaceChart
              submissions={submissions}
              onVideoClick={onVideoClick}
              onAccountClick={onAccountClick}
              type="accounts"
              dateFilter={dateFilter}
              customRange={customRange}
            />
          </div>
        );
      
      case 'top-gainers':
        return (
          <div 
            {...dragHandlers}
            className={getDragClasses(id, "group relative")}
          >
            <TopPerformersRaceChart
              submissions={submissions}
              onVideoClick={onVideoClick}
              onAccountClick={onAccountClick}
              type="gainers"
              dateFilter={dateFilter}
              customRange={customRange}
            />
          </div>
        );
      
      case 'posting-times':
        return (
          <div 
            {...dragHandlers}
            className={getDragClasses(id, "rounded-2xl bg-surface-secondary border border-border shadow-theme p-6")}
          >
            
            {/* Header */}
            <div className="relative z-10 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-content">Best Posting Times</h3>
                <div className="relative">
                  <button
                    onMouseEnter={() => setShowPostingTimesInfo(true)}
                    onMouseLeave={() => setShowPostingTimesInfo(false)}
                    className="text-content-muted hover:text-content-secondary transition-colors"
                  >
                    <Info className="w-4 h-4" style={{ opacity: 0.5 }} />
                  </button>
                  
                  {/* Info Tooltip */}
                  {showPostingTimesInfo && (
                    <div 
                      className="absolute left-0 top-full mt-2 w-64 p-4 rounded-xl border shadow-[0_8px_32px_rgba(0,0,0,0.8)] z-50 bg-surface-tertiary backdrop-blur-xl border-border"
                    >
                      <p className="text-xs text-content-secondary leading-relaxed">
                        Shows when you post most frequently throughout the week. Brighter cells indicate more videos posted during those hours.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-content-secondary">Posting frequency by day & hour</p>
            </div>

            {/* Heatmap */}
            <div className="relative z-10">
              <HeatmapByHour
                data={heatmapData}
                metric="views"
                onCellClick={onHeatmapCellClick || (() => {})}
              />
            </div>
          </div>
        );
      
      case 'top-creators':
        return (
          <div
            {...dragHandlers}
            className={getDragClasses(id, "group relative")}
          >
            <TopTeamCreatorsList
              submissions={submissions}
              onCreatorClick={onAccountClick}
              onCreatorRowClick={onCreatorRowClick}
              dateFilter={dateFilter}
              customRange={customRange}
            />
          </div>
        );

      case 'top-creators-ranking':
        // Data-driven creators ranking (public share page). Falls through to
        // nothing on the main dashboard because the ranking props are absent.
        if (!rankingCreators || !rankingCreatorLinks || !rankingAccounts) {
          return null;
        }
        return (
          <div
            {...dragHandlers}
            className={getDragClasses(id, "group relative")}
          >
            <TopCreatorsRanking
              videos={submissions}
              accounts={rankingAccounts}
              creators={rankingCreators}
              creatorLinks={rankingCreatorLinks}
            />
          </div>
        );

      case 'top-platforms':
        return (
          <div
            {...dragHandlers}
            className={getDragClasses(
              id,
              `rounded-2xl bg-surface-secondary border border-border shadow-theme p-6 ${
                isGridLayout ? 'flex flex-col' : ''
              }`
            )}
          >
            {/* Content */}
            <div className={`relative z-10 ${isGridLayout ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
              <TopPlatformsRaceChart
                submissions={submissions}
                dateFilter={dateFilter}
                customRange={customRange}
                onPlatformClick={onPlatformClick}
              />
            </div>
          </div>
        );
      
      case 'comparison':
        console.log('📊 Rendering comparison subsection with dateRange:', dateRange);
        return (
          <div 
            {...dragHandlers}
            className={getDragClasses(id, "group relative")}
          >
            <ComparisonGraph
              submissions={submissions}
              granularity={granularity}
              dateRange={dateRange}
              dateFilter={dateFilter}
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  // Show message if no subsections are visible
  if (visibleSubsections.length === 0) {
    return (
      <div className="relative rounded-2xl bg-surface-secondary backdrop-blur border border-border-subtle shadow-lg p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-surface-hover rounded-full border border-border">
            <Activity className="w-8 h-8 text-content-muted" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-content mb-2">
              No Components Selected
            </h3>
            <p className="text-sm text-content-muted">
              Toggle components on in the editor to see them here
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {isGridLayout ? (
        // Uniform 2-column grid with fixed 480px rows — every card is the
        // same size (share page).
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 [grid-auto-rows:480px]">
          {visibleSubsections.map((subsectionId) => (
            <div key={subsectionId} className="h-full min-h-0">
              {renderSubsection(subsectionId)}
            </div>
          ))}
        </div>
      ) : (
        <Masonry
          breakpointCols={breakpointColumns}
          className="masonry-grid"
          columnClassName="masonry-grid-column"
        >
          {visibleSubsections.map((subsectionId) => (
            <div key={subsectionId} className="masonry-item">
              {renderSubsection(subsectionId)}
            </div>
          ))}
        </Masonry>
      )}

      {/* Trash Drop Zone - Only visible when dragging a subsection */}
      {isEditMode && draggedSection && onToggleSubsection && (() => {
        console.log('🗑️ Trash zone rendering! isEditMode:', isEditMode, 'draggedSection:', draggedSection, 'hasHandler:', !!onToggleSubsection);
        return true;
      })() && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsOverTrash(true);
          }}
          onDragLeave={() => setIsOverTrash(false)}
          onDrop={(e) => {
            e.preventDefault();
            console.log('🗑️ Dropping section:', draggedSection);
            if (draggedSection && onToggleSubsection) {
              // Hide the subsection by toggling its visibility
              onToggleSubsection(draggedSection);
            }
            setDraggedSection(null);
            setIsOverTrash(false);
          }}
          className={`
            fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[9999]
            flex flex-col items-center justify-center gap-2
            px-6 py-4 rounded-xl border-2 border-dashed
            transition-all duration-200 pointer-events-auto
            ${isOverTrash 
              ? 'bg-red-500/20 border-red-500 scale-105 shadow-2xl' 
              : 'bg-red-500/5 border-red-500/40 hover:bg-red-500/10'
            }
          `}
          style={{ backdropFilter: 'blur(12px)' }}
        >
          <svg className={`w-8 h-8 transition-all ${isOverTrash ? 'text-red-400' : 'text-red-400/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className={`text-xs font-medium transition-all ${isOverTrash ? 'text-red-300' : 'text-red-400/60'}`}>
            {isOverTrash ? 'Release to hide component' : 'Drag here to hide component'}
          </span>
        </div>
      )}
    </>
  );
});

TopPerformersSection.displayName = 'TopPerformersSection';

export default TopPerformersSection;
