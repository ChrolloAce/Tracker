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
  const [isDraggingFromHandle, setIsDraggingFromHandle] = useState(false);
  const topHandleRef = React.useRef<HTMLDivElement>(null);
  const bottomHandleRef = React.useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDraggingFromHandle(true);
    onDragStart();
  };

  const handleDragEnd = () => {
    setIsDraggingFromHandle(false);
    onDragEnd();
  };

  return (
    <div
      className={`
        relative transition-all duration-200
        ${isDragging ? 'opacity-50 scale-[0.98]' : ''}
      `}
    >
      {/* Top Drag Handle (Edit Mode Only) */}
      {isEditMode && (
        <div
          ref={topHandleRef}
          draggable={true}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-50 cursor-move"
        >
          <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/50 rounded-lg backdrop-blur-sm hover:bg-emerald-500/30 transition-colors">
            <GripVertical className="w-4 h-4 text-emerald-400" />
            {title && (
              <span className="text-xs font-medium text-emerald-400 whitespace-nowrap">
                {title}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Section Content - Keep pointer events enabled for nested draggables */}
      <div
        onDragOver={(e) => {
          // Only show drop indicator if dragging from handle (entire section)
          if (isDraggingFromHandle) {
            onDragOver(e);
          }
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={isDraggingFromHandle && isDragOver ? 'ring-2 ring-emerald-500 rounded-lg' : ''}
      >
        {children}
      </div>

      {/* Bottom Drag Handle (Edit Mode Only) */}
      {isEditMode && (
        <div
          ref={bottomHandleRef}
          draggable={true}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 z-50 cursor-move"
        >
          <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/50 rounded-lg backdrop-blur-sm hover:bg-emerald-500/30 transition-colors">
            <GripVertical className="w-4 h-4 text-emerald-400" />
            {title && (
              <span className="text-xs font-medium text-emerald-400 whitespace-nowrap">
                {title}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Drop Indicator - Only show when dragging from handle */}
      {isDraggingFromHandle && isDragOver && (
        <div className="absolute inset-0 border-2 border-dashed border-emerald-500 rounded-lg pointer-events-none bg-emerald-500/5 z-40" />
      )}
    </div>
  );
};

