import React, { useState } from 'react';
import { X, Eye, EyeOff, Edit2, Check } from 'lucide-react';

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
  renderSectionPreview?: (sectionId: string) => React.ReactNode;
}

/**
 * KPICardEditor Component
 * 
 * Stripe-style centered modal for managing dashboard sections and KPIs.
 * Shows live previews of each section/card for better visualization.
 */
export const KPICardEditor: React.FC<KPICardEditorProps> = ({
  isOpen,
  onClose,
  cardOptions,
  onToggleCard,
  onReorder,
  sectionTitles = {},
  onRenameSection,
  renderSectionPreview
}) => {
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  
  if (!isOpen) return null;

  const visibleCount = cardOptions.filter(card => card.isVisible).length;
  
  // Group cards by category
  const kpiCards = cardOptions.filter(card => card.category === 'kpi');
  const sectionCards = cardOptions.filter(card => card.category === 'sections');
  
  const handleStartEditing = (cardId: string, currentLabel: string) => {
    setEditingSection(cardId);
    setEditingValue(sectionTitles[cardId] || currentLabel);
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

  const renderItemCard = (item: KPICardOption) => {
    const Icon = item.icon;
    const isSection = item.category === 'sections';
    
    return (
      <div
        key={item.id}
        onClick={() => setSelectedItem(selectedItem === item.id ? null : item.id)}
        className={`
          group relative rounded-xl border-2 transition-all cursor-pointer overflow-hidden
          ${item.isVisible 
            ? 'bg-gradient-to-br from-white/5 to-white/[0.02] border-emerald-500/30 hover:border-emerald-500/50' 
            : 'bg-white/[0.01] border-white/5 hover:border-white/10 opacity-60'
          }
          ${selectedItem === item.id ? 'ring-2 ring-emerald-500 border-emerald-500' : ''}
        `}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between bg-gradient-to-r from-white/5 to-transparent">
          <div className="flex items-center gap-3 flex-1">
            <div className={`
              p-2.5 rounded-lg transition-all
              ${item.isVisible ? 'bg-emerald-500/20' : 'bg-white/5'}
            `}>
              <Icon className={`w-5 h-5 ${item.isVisible ? 'text-emerald-400' : 'text-white/40'}`} />
            </div>
            
            <div className="flex-1 min-w-0">
              {editingSection === item.id ? (
                <input
                  type="text"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(item.id);
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-2 py-1 text-sm font-semibold bg-white/10 border border-emerald-500/50 rounded text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              ) : (
                <>
                  <h3 className={`
                    text-sm font-semibold transition-colors
                    ${item.isVisible ? 'text-white' : 'text-white/40'}
                  `}>
                    {sectionTitles[item.id] || item.label}
                  </h3>
                  <p className={`
                    text-xs mt-0.5 transition-colors
                    ${item.isVisible ? 'text-white/50' : 'text-white/30'}
                  `}>
                    {item.description}
                  </p>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {/* Edit button for sections */}
            {isSectionCard(item.id) && editingSection !== item.id && (
              <button
                onClick={() => handleStartEditing(item.id, item.label)}
                className="p-2 text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                title="Rename section"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            
            {/* Save button when editing */}
            {editingSection === item.id && (
              <button
                onClick={() => handleSaveEdit(item.id)}
                className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"
                title="Save"
              >
                <Check className="w-4 h-4" />
              </button>
            )}
            
            {/* Toggle button */}
            <button
              onClick={() => onToggleCard(item.id)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${item.isVisible
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }
              `}
            >
              {item.isVisible ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Visible</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hidden</span>
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Preview Section - Shows when selected and visible */}
        {selectedItem === item.id && item.isVisible && isSection && renderSectionPreview && (
          <div className="p-4 bg-black/20 border-t border-white/10">
            <div className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wide">Live Preview</div>
            <div className="bg-zinc-900 rounded-lg p-3 max-h-[200px] overflow-hidden relative">
              <div className="transform scale-75 origin-top-left" style={{ width: '133%', height: '133%' }}>
                {renderSectionPreview(item.id)}
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900 pointer-events-none"></div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-8"
        onClick={onClose}
      >
        {/* Modal */}
        <div 
          className="relative w-full max-w-6xl max-h-[90vh] bg-zinc-900 rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Customize Dashboard</h2>
                <p className="text-sm text-white/60 mt-1">
                  Show, hide, and reorganize your dashboard sections
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Stats */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5">
              <div>
                <div className="text-xs text-white/50 font-medium uppercase tracking-wide">Visible Items</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">{visibleCount}</div>
              </div>
              <div>
                <div className="text-xs text-white/50 font-medium uppercase tracking-wide">Total Items</div>
                <div className="text-2xl font-bold text-white mt-1">{cardOptions.length}</div>
              </div>
              <div className="flex-1"></div>
              <div className="text-xs text-white/40 italic">
                💡 Click on a section to see its preview
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8">
            {/* Dashboard Sections */}
            {sectionCards.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span>📊 Dashboard Sections</span>
                  <span className="text-xs text-white/40 font-normal">
                    ({sectionCards.filter(c => c.isVisible).length}/{sectionCards.length} visible)
                  </span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sectionCards.map(item => renderItemCard(item))}
                </div>
              </div>
            )}
            
            {/* KPI Cards */}
            {kpiCards.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span>📈 KPI Metrics</span>
                  <span className="text-xs text-white/40 font-normal">
                    ({kpiCards.filter(c => c.isVisible).length}/{kpiCards.length} visible)
                  </span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {kpiCards.map(item => renderItemCard(item))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-5 border-t border-white/10 bg-gradient-to-r from-white/5 to-transparent flex items-center justify-between">
            <div className="text-sm text-white/50">
              Changes are saved automatically
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
