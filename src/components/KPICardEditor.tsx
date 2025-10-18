import React, { useState } from 'react';
import { X, Eye, EyeOff, GripVertical, Edit2, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface KPICardOption {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isVisible: boolean;
  category?: 'kpi' | 'sections';
}

interface KPICardEditorProps {
  isOpen: boolean;
  onClose: () => void;
  cardOptions: KPICardOption[];
  onToggleCard: (cardId: string) => void;
  onReorder: (cardId: string, direction: 'up' | 'down') => void;
  sectionTitles?: Record<string, string>;
  onRenameSection?: (sectionId: string, newTitle: string) => void;
}

/**
 * KPICardEditor Component
 * 
 * Stripe-style modal for managing dashboard KPI cards.
 * Allows users to show/hide cards, reorder them, and rename sections.
 */
export const KPICardEditor: React.FC<KPICardEditorProps> = ({
  isOpen,
  onClose,
  cardOptions,
  onToggleCard,
  onReorder,
  sectionTitles = {},
  onRenameSection
}) => {
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['sections', 'kpi']));
  
  if (!isOpen) return null;

  const visibleCount = cardOptions.filter(card => card.isVisible).length;
  
  // Group cards by category
  const kpiCards = cardOptions.filter(card => card.category === 'kpi');
  const sectionCards = cardOptions.filter(card => card.category === 'sections');
  
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };
  
  const handleStartEditing = (cardId: string, currentLabel: string) => {
    setEditingSection(cardId);
    // Remove tree characters from label
    const cleanLabel = currentLabel.replace(/^[├─└─\s]+/, '');
    setEditingValue(sectionTitles[cardId] || cleanLabel);
  };
  
  const handleSaveEdit = (cardId: string) => {
    if (onRenameSection && editingValue.trim()) {
      onRenameSection(cardId, editingValue.trim());
    }
    setEditingSection(null);
    setEditingValue('');
  };
  
  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditingValue('');
  };
  
  const isSectionCard = (id: string) => {
    return ['kpi-cards', 'top-performers', 'top-platforms', 'posting-activity', 'tracked-accounts', 'videos-table'].includes(id);
  };
  
  const renderCardItem = (card: KPICardOption, index: number, allCards: KPICardOption[]) => {
    const Icon = card.icon;
    return (
      <div
        key={card.id}
        className={`
          group relative rounded-lg border transition-all
          ${card.isVisible 
            ? 'bg-white/5 border-white/10 hover:bg-white/10' 
            : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
          }
        `}
      >
        <div className="flex items-center gap-3 p-4">
          {/* Drag handle */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => index > 0 && onReorder(card.id, 'up')}
              disabled={index === 0}
              className={`
                p-1 rounded transition-colors
                ${index === 0 
                  ? 'text-white/20 cursor-not-allowed' 
                  : 'text-white/40 hover:text-white hover:bg-white/10'
                }
              `}
              title="Move up"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={() => index < allCards.length - 1 && onReorder(card.id, 'down')}
              disabled={index === allCards.length - 1}
              className={`
                p-1 rounded transition-colors
                ${index === allCards.length - 1
                  ? 'text-white/20 cursor-not-allowed' 
                  : 'text-white/40 hover:text-white hover:bg-white/10'
                }
              `}
              title="Move down"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Icon */}
          <div className={`
            p-2 rounded-lg transition-opacity
            ${card.isVisible ? 'opacity-100' : 'opacity-40'}
          `}>
            <Icon className="w-5 h-5 text-white" />
          </div>

          {/* Card info */}
          <div className="flex-1 min-w-0">
            {editingSection === card.id ? (
              <input
                type="text"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit(card.id);
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                className="w-full px-2 py-1 text-sm font-medium bg-white/10 border border-white/20 rounded text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            ) : (
              <h3 className={`
                text-sm font-medium transition-opacity
                ${card.isVisible ? 'text-white' : 'text-white/40'}
              `}>
                {card.label}
              </h3>
            )}
            {editingSection !== card.id && (
              <p className={`
                text-xs mt-0.5 transition-opacity
                ${card.isVisible ? 'text-white/60' : 'text-white/30'}
              `}>
                {card.description}
              </p>
            )}
          </div>
          
          {/* Edit button for sections */}
          {isSectionCard(card.id) && editingSection !== card.id && (
            <button
              onClick={() => handleStartEditing(card.id, card.label)}
              className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Rename section"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          
          {/* Save button when editing */}
          {editingSection === card.id && (
            <button
              onClick={() => handleSaveEdit(card.id)}
              className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors"
              title="Save"
            >
              <Check className="w-4 h-4" />
            </button>
          )}

          {/* Toggle button */}
          <button
            onClick={() => onToggleCard(card.id)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${card.isVisible
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }
            `}
          >
            {card.isVisible ? (
              <>
                <Eye className="w-4 h-4" />
                <span>Visible</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4" />
                <span>Hidden</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Side panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[400px] bg-zinc-900 border-l border-white/10 shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-white/10 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Edit dashboard</h2>
            <p className="text-sm text-white/60 mt-1">
              Customize your dashboard layout
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="px-6 py-4 bg-white/5 border-b border-white/10">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Visible sections</span>
            <span className="text-white font-medium">{visibleCount} of {cardOptions.length}</span>
          </div>
        </div>

        {/* Card list */}
        <div className="px-6 py-4 space-y-4">
          {/* Dashboard Sections */}
          <div>
            <button
              onClick={() => toggleCategory('sections')}
              className="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors mb-2"
            >
              <span className="text-sm font-semibold text-white">Dashboard Sections</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">
                  {sectionCards.filter(c => c.isVisible).length}/{sectionCards.length}
                </span>
                {expandedCategories.has('sections') ? (
                  <ChevronUp className="w-4 h-4 text-white/60" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/60" />
                )}
              </div>
            </button>
            {expandedCategories.has('sections') && (
              <div className="space-y-2">
                {sectionCards.map((card, index) => renderCardItem(card, index, sectionCards))}
              </div>
            )}
          </div>
          
          {/* KPI Cards */}
          <div>
            <button
              onClick={() => toggleCategory('kpi')}
              className="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors mb-2"
            >
              <span className="text-sm font-semibold text-white">KPI Metrics</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">
                  {kpiCards.filter(c => c.isVisible).length}/{kpiCards.length}
                </span>
                {expandedCategories.has('kpi') ? (
                  <ChevronUp className="w-4 h-4 text-white/60" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/60" />
                )}
              </div>
            </button>
            {expandedCategories.has('kpi') && (
              <div className="space-y-2">
                {kpiCards.map((card, index) => renderCardItem(card, index, kpiCards))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-zinc-900/95 backdrop-blur border-t border-white/10 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
};

