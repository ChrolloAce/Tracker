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
      {/* Drag Handle Overlay (Edit Mode Only) */}
      {isEditMode && (
        <div
          ref={dragHandleRef}
          draggable={true}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className={`
            absolute -left-3 top-0 bottom-0 flex items-center justify-center
            transition-opacity duration-200 z-50 cursor-move
            ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          `}
        >
          <div className="flex flex-col items-center gap-0.5 p-2 bg-emerald-500/20 border border-emerald-500/50 rounded-lg backdrop-blur-sm">
            <GripVertical className="w-5 h-5 text-emerald-400" />
            {title && (
              <span className="text-[10px] font-medium text-emerald-400 whitespace-nowrap rotate-180 writing-mode-vertical-rl">
                {title}
              </span>
            )}
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

