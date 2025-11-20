import React, { useState } from 'react';
import { X, Eye, EyeOff, ChevronDown, ChevronRight, LayoutGrid, Activity, TrendingUp } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

interface KPICardOption {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isVisible: boolean;
  category?: 'kpi' | 'sections' | 'top-performers-subsection';
}

interface KPIPreviewData {
  value: string | number;
  sparklineData?: Array<{ value: number; timestamp?: number }>;
  accent: 'emerald' | 'pink' | 'blue' | 'violet' | 'teal' | 'orange' | 'slate';
  delta?: { value: number; isPositive: boolean };
}

interface KPICardEditorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  cardOptions: KPICardOption[];
  onToggleCard: (cardId: string) => void;
  onReorder: (cardId: string, direction: 'up' | 'down') => void;
  sectionTitles?: Record<string, string>;
  onRenameSection?: (sectionId: string, newTitle: string) => void;
  renderSectionPreview?: (sectionId: string) => React.ReactNode;
  kpiPreviewData?: Record<string, KPIPreviewData>;
}

/**
 * KPICardEditorSidebar Component
 * 
 * Responsive right sidebar for managing dashboard sections and KPIs.
 * Features collapsible sections for quick browsing and selection.
 */
export const KPICardEditorSidebar: React.FC<KPICardEditorSidebarProps> = ({
  isOpen,
  onClose,
  cardOptions,
  onToggleCard,
  sectionTitles = {},
  renderSectionPreview,
  kpiPreviewData = {}
}) => {
  // Collapsible section state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['kpi', 'sections', 'top-performers'])
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  if (!isOpen) return null;
  
  // Group cards by category
  const kpiCards = cardOptions.filter(card => card.category === 'kpi');
  const sectionCards = cardOptions.filter(card => card.category === 'sections');
  const topPerformersSubsections = cardOptions.filter(card => card.category === 'top-performers-subsection');

  const renderItemCard = (item: KPICardOption) => {
    const Icon = item.icon;
    const isSection = item.category === 'sections';
    const isKPI = item.category === 'kpi';
    const isTopPerformersSubsection = item.category === 'top-performers-subsection';
    
    return (
      <div
        key={item.id}
        onClick={() => onToggleCard(item.id)}
        className={`
          group relative rounded-lg border transition-all overflow-hidden cursor-pointer
          ${item.isVisible 
            ? 'bg-white/[0.02] border-white/10 hover:border-white/20' 
            : 'bg-white/[0.01] border-white/5 hover:border-white/10 opacity-50'
          }
        `}
      >
        {/* Header */}
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="transition-all flex-shrink-0">
              <Icon className={`w-4 h-4 ${item.isVisible ? 'text-white/60' : 'text-white/30'}`} />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className={`
                text-xs font-semibold transition-colors truncate
                ${item.isVisible ? 'text-white' : 'text-white/40'}
              `}>
                {sectionTitles[item.id] || item.label}
              </h3>
              <p className={`
                text-[11px] mt-0.5 transition-colors leading-tight line-clamp-2
                ${item.isVisible ? 'text-white/50' : 'text-white/30'}
              `}>
                {item.description}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Status indicator */}
            <div
              className={`
                flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all
                ${item.isVisible
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-white/5 text-white/40 border border-transparent'
                }
              `}
            >
              {item.isVisible ? (
                <Eye className="w-3 h-3" />
              ) : (
                <EyeOff className="w-3 h-3" />
              )}
            </div>
          </div>
        </div>
        
        {/* Preview Section - Shows for sections and subsections */}
        {(isSection || isTopPerformersSubsection) && renderSectionPreview && (
          <div className="p-2 bg-black/20 border-t border-white/10">
            <div className={`bg-zinc-900 rounded-md p-1.5 max-h-[100px] overflow-hidden relative pointer-events-none ${!item.isVisible ? 'opacity-50' : ''}`}>
              <div className="transform scale-[0.5] origin-top-left" style={{ width: '200%', height: '200%' }}>
                {renderSectionPreview(item.id)}
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900 pointer-events-none"></div>
            </div>
          </div>
        )}
        
        {/* Mini Graph Preview - Shows for KPI metrics */}
        {isKPI && (() => {
          const previewData = kpiPreviewData[item.id];
          const hasData = previewData && previewData.sparklineData && previewData.sparklineData.length > 0;
          
          const getColors = () => {
            if (!previewData?.delta) {
              return { stroke: 'rgb(148, 163, 184)', gradient: ['rgba(148, 163, 184, 0.2)', 'rgba(148, 163, 184, 0)'] };
            }
            
            if (previewData.delta.isPositive) {
              return { stroke: 'rgb(16, 185, 129)', gradient: ['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0)'] };
            } else {
              return { stroke: 'rgb(239, 68, 68)', gradient: ['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0)'] };
            }
          };
          
          const colors = getColors();
          
          return (
            <div className="p-2 bg-black/20 border-t border-white/10">
              {hasData ? (
                <>
                  <div className={`h-12 rounded-lg overflow-hidden pointer-events-none`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart 
                        data={previewData.sparklineData}
                        margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
                      >
                        <defs>
                          <linearGradient id={`preview-gradient-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={colors.stroke} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <YAxis domain={[0, 'auto']} hide={true} />
                        <Area
                          type="monotoneX"
                          dataKey="value"
                          stroke={colors.stroke}
                          strokeWidth={1.5}
                          fill={`url(#preview-gradient-${item.id})`}
                          isAnimationActive={false}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className={`mt-1 text-right ${item.isVisible ? '' : 'opacity-50'}`}>
                    <div className="text-sm font-bold" style={{ color: colors.stroke }}>
                      {previewData.value}
                    </div>
                    {previewData.delta && (
                      <div className={`text-[10px] ${previewData.delta.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {previewData.delta.isPositive ? '↑' : '↓'} {Math.abs(previewData.delta.value).toFixed(1)}%
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className={`h-12 rounded-lg ${item.isVisible ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5' : 'bg-white/5'} p-1.5 flex items-end justify-between gap-0.5 pointer-events-none`}>
                  {[40, 55, 35, 65, 80, 60, 90, 75].map((height, i) => (
                    <div 
                      key={i}
                      className={`flex-1 rounded-sm transition-all ${item.isVisible ? 'bg-emerald-500/60' : 'bg-white/20'}`}
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  const renderCollapsibleSection = (
    id: string,
    title: string,
    icon: React.ComponentType<{ className?: string }>,
    items: KPICardOption[]
  ) => {
    const Icon = icon;
    const isExpanded = expandedSections.has(id);
    const visibleCount = items.filter(i => i.isVisible).length;

    return (
      <div className="border-b border-white/5">
        <button
          onClick={() => toggleSection(id)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-white/60" />
            <div className="text-left">
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="text-xs text-white/40">
                {visibleCount}/{items.length} visible
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-white/40" />
          ) : (
            <ChevronRight className="w-5 h-5 text-white/40" />
          )}
        </button>
        
        {isExpanded && (
          <div className="px-4 pb-4 space-y-2">
            {items.map(item => renderItemCard(item))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] lg:w-[560px] bg-zinc-900 shadow-2xl border-l border-white/10 z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Customize Dashboard</h2>
            <p className="text-xs text-white/50 mt-1">
              Toggle sections and metrics
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Collapsible sections */}
        <div className="flex-1 overflow-y-auto">
          {sectionCards.length > 0 && renderCollapsibleSection(
            'sections',
            'Dashboard Sections',
            LayoutGrid,
            sectionCards
          )}
          
          {kpiCards.length > 0 && renderCollapsibleSection(
            'kpi',
            'KPI Metrics',
            Activity,
            kpiCards
          )}
          
          {topPerformersSubsections.length > 0 && renderCollapsibleSection(
            'top-performers',
            'Top Performers Components',
            TrendingUp,
            topPerformersSubsections
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-white/40">
            Changes saved automatically
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </>
  );
};

