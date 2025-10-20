import React, { useState, useEffect, useMemo } from 'react';
import Masonry from 'react-masonry-css';
import { Activity, Info } from 'lucide-react';
import { VideoSubmission } from '../types';
import TopPerformersRaceChart from './TopPerformersRaceChart';
import HeatmapByHour from './HeatmapByHour';
import TopTeamCreatorsList from './TopTeamCreatorsList';
import TopPlatformsRaceChart from './TopPlatformsRaceChart';
import ComparisonGraph from './ComparisonGraph';

interface TopPerformersSectionProps {
  submissions: VideoSubmission[];
  onVideoClick?: (video: VideoSubmission) => void;
  onAccountClick?: (username: string) => void;
  onHeatmapCellClick?: (params: {
    dayIndex: number;
    hour: number;
    range: { start: Date; end: Date };
  }) => void;
  subsectionVisibility: Record<string, boolean>;
  isEditMode?: boolean;
  onToggleSubsection?: (id: string) => void;
  granularity?: 'day' | 'week' | 'month' | 'year';
}

type SubSectionId = 'top-videos' | 'top-accounts' | 'top-gainers' | 'posting-times' | 'top-creators' | 'top-platforms' | 'comparison';

const TopPerformersSection: React.FC<TopPerformersSectionProps> = ({
  submissions,
  onVideoClick,
  onAccountClick,
  onHeatmapCellClick,
  subsectionVisibility,
  isEditMode = false,
  onToggleSubsection,
  granularity = 'week'
}) => {
  console.log('🎯 TopPerformersSection rendering', { 
    subsectionVisibility,
    isEditMode 
  });
  
  // Load subsection order from localStorage
  const [subsectionOrder, setSubsectionOrder] = useState<SubSectionId[]>(() => {
    const defaultOrder: SubSectionId[] = ['top-videos', 'top-accounts', 'top-gainers', 'posting-times', 'top-creators', 'top-platforms', 'comparison'];
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
  const breakpointColumns = {
    default: 2,  // 2 columns by default
    1280: 2,     // 2 columns on xl screens
    1024: 2,     // 2 columns on lg screens
    768: 1,      // 1 column on md screens and below
  };

  // Create drag handlers for a subsection
  const createDragHandlers = (id: SubSectionId) => ({
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
  });

  // Get drag classes for visual feedback
  const getDragClasses = (id: SubSectionId, baseClasses: string) => {
    const isDragging = draggedSection === id;
    const isDragOver = dragOverSection === id;
    
    return `
      ${baseClasses}
      ${isEditMode ? 'cursor-move' : ''}
      ${isDragging ? 'opacity-50 scale-95' : ''}
      ${isDragOver ? 'ring-2 ring-emerald-500 border-emerald-500/50 scale-105' : ''}
      transition-all duration-300
    `;
  };

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
            />
          </div>
        );
      
      case 'posting-times':
        return (
          <div 
            {...dragHandlers}
            className={getDragClasses(id, "group relative rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg hover:shadow-xl transition-all duration-300 p-6 overflow-hidden")}
          >
            {/* Depth Gradient Overlay */}
            <div 
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
              }}
            />
            
            {/* Header */}
            <div className="relative z-10 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-white">Best Posting Times</h3>
                <div className="relative">
                  <button
                    onMouseEnter={() => setShowPostingTimesInfo(true)}
                    onMouseLeave={() => setShowPostingTimesInfo(false)}
                    className="text-gray-500 hover:text-gray-400 transition-colors"
                  >
                    <Info className="w-4 h-4" style={{ opacity: 0.5 }} />
                  </button>
                  
                  {/* Info Tooltip */}
                  {showPostingTimesInfo && (
                    <div 
                      className="absolute left-0 top-full mt-2 w-64 p-3 rounded-lg border shadow-xl z-50"
                      style={{
                        backgroundColor: 'rgba(26, 26, 26, 0.98)',
                        borderColor: 'rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      <p className="text-xs text-gray-300 leading-relaxed">
                        Visualizes when your audience is most active throughout the week. Darker cells indicate higher engagement during those hours.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-400">Engagement by day & hour</p>
            </div>

            {/* Heatmap */}
            <div className="relative z-10">
              <HeatmapByHour
                data={submissions.map(video => ({
                  timestamp: video.uploadDate || video.dateSubmitted,
                  views: video.views,
                  likes: video.likes,
                  comments: video.comments,
                  shares: video.shares,
                  videos: [{
                    id: video.id,
                    title: video.title || video.caption || 'Untitled',
                    thumbnailUrl: video.thumbnail
                  }]
                }))}
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
            />
          </div>
        );
      
      case 'top-platforms':
        return (
          <div 
            {...dragHandlers}
            className={getDragClasses(id, "group relative rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg hover:shadow-xl transition-all duration-300 p-6 overflow-hidden")}
          >
            {/* Depth Gradient Overlay */}
            <div 
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
              }}
            />
            
            {/* Content */}
            <div className="relative z-10">
              <TopPlatformsRaceChart
                submissions={submissions}
              />
            </div>
          </div>
        );
      
      case 'comparison':
        console.log('📊 Rendering comparison subsection');
        return (
          <div 
            {...dragHandlers}
            className={getDragClasses(id, "group relative")}
          >
            <ComparisonGraph
              submissions={submissions}
              granularity={granularity}
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
      <div className="relative rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-white/5 rounded-full border border-white/10">
            <Activity className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              No Components Selected
            </h3>
            <p className="text-sm text-gray-400">
              Toggle components on in the editor to see them here
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
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
};

export default TopPerformersSection;
