import React, { useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { VideoSubmission } from '../types';
import TopVideosCard from './TopVideosCard';
import TopAccountsCard from './TopAccountsCard';
import TopPlatformsCard from './TopPlatformsCard';
import NewUploadsCard from './NewUploadsCard';

interface TopPerformersGridProps {
  submissions: VideoSubmission[];
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  onVideoClick?: (video: VideoSubmission) => void;
  onAccountClick?: (username: string) => void;
  isEditMode?: boolean;
  cardOrder: string[];
  cardVisibility: Record<string, boolean>;
  onReorder?: (newOrder: string[]) => void;
  onToggleCard?: (cardId: string) => void;
}

/**
 * TopPerformersGrid Component
 * 
 * A flexible grid for displaying various "top performers" cards.
 * Similar to KPICards but for performance rankings (videos, accounts, platforms, etc.)
 * Supports drag-and-drop reordering and visibility toggling in edit mode.
 */
const TopPerformersGrid: React.FC<TopPerformersGridProps> = ({
  submissions,
  dateRangeStart,
  dateRangeEnd,
  onVideoClick,
  onAccountClick,
  isEditMode = false,
  cardOrder,
  cardVisibility,
  onReorder,
  onToggleCard,
}) => {
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [dragOverCard, setDragOverCard] = useState<string | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);

  // Available cards with their configurations
  const allCards = [
    { id: 'top-videos', label: 'Top Videos', component: TopVideosCard },
    { id: 'top-accounts', label: 'Top Accounts', component: TopAccountsCard },
    { id: 'top-platforms', label: 'Top Platforms', component: TopPlatformsCard },
    { id: 'new-uploads', label: 'New Uploads', component: NewUploadsCard },
  ];

  // Filter and sort cards based on visibility and order
  const visibleCards = allCards
    .filter(card => cardVisibility[card.id] !== false)
    .sort((a, b) => {
      const indexA = cardOrder.indexOf(a.id);
      const indexB = cardOrder.indexOf(b.id);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

  const handleDragStart = (cardId: string) => {
    setDraggedCard(cardId);
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
    setDragOverCard(null);
    setIsOverTrash(false);
  };

  const handleDragOver = (e: React.DragEvent, cardId: string) => {
    e.preventDefault();
    if (draggedCard && draggedCard !== cardId) {
      setDragOverCard(cardId);
    }
  };

  const handleDragLeave = () => {
    setDragOverCard(null);
  };

  const handleDrop = (targetCardId: string) => {
    if (!draggedCard || !onReorder || draggedCard === targetCardId) return;

    const newOrder = [...cardOrder];
    const draggedIndex = newOrder.indexOf(draggedCard);
    const targetIndex = newOrder.indexOf(targetCardId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedCard);
      onReorder(newOrder);
    }

    setDragOverCard(null);
    setDraggedCard(null);
  };

  const handleTrashDrop = () => {
    if (draggedCard && onToggleCard) {
      onToggleCard(draggedCard);
    }
    setIsOverTrash(false);
    setDraggedCard(null);
  };

  if (visibleCards.length === 0 && !isEditMode) {
    return null;
  }

  return (
    <div className="relative">
      {/* 2x1 Grid (2 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visibleCards.map((card) => {
          const CardComponent = card.component;
          const isDragging = draggedCard === card.id;
          const isDragOver = dragOverCard === card.id;

          return (
            <div
              key={card.id}
              draggable={isEditMode}
              onDragStart={() => handleDragStart(card.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, card.id)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(card.id)}
              className={`
                relative transition-all duration-200
                ${isEditMode ? 'cursor-move' : ''}
                ${isDragging ? 'opacity-50 scale-95' : ''}
                ${isDragOver ? 'ring-2 ring-emerald-500 rounded-lg' : ''}
              `}
            >
              {/* Drag Handle (Edit Mode Only) */}
              {isEditMode && (
                <div className="absolute top-4 left-4 z-10 p-2 bg-emerald-500/20 rounded-lg cursor-move">
                  <GripVertical className="w-5 h-5 text-emerald-400" />
                </div>
              )}

              {/* Card Component */}
              <CardComponent 
                submissions={submissions}
                dateRangeStart={card.id === 'new-uploads' ? dateRangeStart : undefined}
                dateRangeEnd={card.id === 'new-uploads' ? dateRangeEnd : undefined}
                onVideoClick={onVideoClick}
                onAccountClick={onAccountClick}
              />
            </div>
          );
        })}
      </div>

      {/* Trash Bin Drop Zone (Edit Mode Only) */}
      {isEditMode && draggedCard && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsOverTrash(true);
          }}
          onDragLeave={() => setIsOverTrash(false)}
          onDrop={handleTrashDrop}
          className={`
            fixed bottom-8 right-8 z-50
            flex items-center gap-3 px-6 py-4 rounded-xl
            transition-all duration-200
            ${isOverTrash 
              ? 'bg-red-500/30 border-2 border-red-500 scale-110' 
              : 'bg-white/5 border-2 border-white/20'
            }
            backdrop-blur-sm shadow-lg
          `}
        >
          <Trash2 className={`w-5 h-5 ${isOverTrash ? 'text-red-400' : 'text-white/60'}`} />
          <span className={`text-sm font-medium ${isOverTrash ? 'text-red-400' : 'text-white/60'}`}>
            {isOverTrash ? 'Drop to hide' : 'Drag here to hide'}
          </span>
        </div>
      )}
    </div>
  );
};

export default TopPerformersGrid;

