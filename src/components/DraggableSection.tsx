import React, { useState } from 'react';
import { GripVertical } from 'lucide-react';

interface DraggableSectionProps {
  id: string;
  title?: string;
  isEditMode: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  children: React.ReactNode;
}

/**
 * DraggableSection Component
 * 
 * Wraps dashboard sections to make them draggable and reorderable.
 * Shows a drag handle in edit mode.
 */
export const DraggableSection: React.FC<DraggableSectionProps> = ({
  id,
  title,
  isEditMode,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  children
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const dragHandleRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow dragging if clicking on the drag handle area
    if (isEditMode && dragHandleRef.current && !dragHandleRef.current.contains(e.target as Node)) {
      // Clicking on content, not the handle - don't allow section drag
      e.stopPropagation();
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={handleMouseDown}
      className={`
        relative transition-all duration-200
        ${isDragging ? 'opacity-50 scale-[0.98]' : ''}
        ${isDragOver ? 'ring-2 ring-emerald-500 rounded-lg' : ''}
      `}
    >
      {/* Drag Handle Bar (Edit Mode Only) */}
      {isEditMode && (
        <div
          ref={dragHandleRef}
          draggable={true}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="flex items-center gap-2 px-3 py-2 mb-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg cursor-move hover:bg-emerald-500/20 transition-colors z-50"
        >
          <GripVertical className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          {title && (
            <span className="text-sm font-medium text-emerald-400">
              {title}
            </span>
          )}
          <div className="ml-auto text-xs text-emerald-400/60">
            Drag to reorder
          </div>
        </div>
      )}

      {/* Section Content - Keep pointer events enabled for nested draggables */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {children}
      </div>

      {/* Drop Indicator */}
      {isDragOver && (
        <div className="absolute inset-0 border-2 border-dashed border-emerald-500 rounded-lg pointer-events-none bg-emerald-500/5 z-40" />
      )}
    </div>
  );
};

