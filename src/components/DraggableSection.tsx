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

  return (
    <div
      draggable={isEditMode}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative transition-all duration-200
        ${isEditMode ? 'cursor-move' : ''}
        ${isDragging ? 'opacity-50 scale-[0.98]' : ''}
        ${isDragOver ? 'ring-2 ring-emerald-500 rounded-lg' : ''}
      `}
    >
      {/* Drag Handle Overlay (Edit Mode Only) */}
      {isEditMode && (
        <div className={`
          absolute -left-3 top-0 bottom-0 flex items-center justify-center
          transition-opacity duration-200 z-10
          ${isHovered ? 'opacity-100' : 'opacity-0'}
        `}>
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

      {/* Section Content */}
      <div className={isEditMode ? 'pointer-events-none' : ''}>
        {children}
      </div>

      {/* Drop Indicator */}
      {isDragOver && (
        <div className="absolute inset-0 border-2 border-dashed border-emerald-500 rounded-lg pointer-events-none bg-emerald-500/5" />
      )}
    </div>
  );
};

