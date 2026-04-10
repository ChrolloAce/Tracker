import React from 'react';
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
  // id is kept for potential future use but marked as unused
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
                className="w-full flex items-center gap-3 px-4 py-3 mb-4 bg-surface-secondary border-2 border-orange-500/30 rounded-lg cursor-move hover:border-orange-500/50 hover:bg-orange-50 transition-all shadow-sm z-50"
              >
                <GripVertical className="w-5 h-5 text-orange-500 flex-shrink-0" />
                {title && (
                  <span className="text-base font-semibold text-content">
                    {title}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2 text-xs text-content-muted font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  Drag to reorder section
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

