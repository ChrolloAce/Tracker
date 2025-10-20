import React from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
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

interface KPICardEditorProps {
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
  // onReorder - kept for potential future use
  sectionTitles = {},
  // onRenameSection - kept for potential future use
  renderSectionPreview,
  kpiPreviewData = {}
}) => {
  if (!isOpen) return null;

  const visibleCount = cardOptions.filter(card => card.isVisible).length;
  
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
          <div className="flex items-center gap-2.5 flex-1">
            <div className="transition-all">
              <Icon className={`w-4 h-4 ${item.isVisible ? 'text-white/60' : 'text-white/30'}`} />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className={`
                text-xs font-semibold transition-colors
                ${item.isVisible ? 'text-white' : 'text-white/40'}
              `}>
                {sectionTitles[item.id] || item.label}
              </h3>
              <p className={`
                text-[11px] mt-0.5 transition-colors leading-tight
                ${item.isVisible ? 'text-white/50' : 'text-white/30'}
              `}>
                {item.description}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Status indicator (non-interactive) */}
            <div
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all
                ${item.isVisible
                  ? 'bg-white/10 text-white/80 border border-emerald-500/30'
                  : 'bg-white/5 text-white/40 border border-transparent'
                }
              `}
            >
              {item.isVisible ? (
                <>
                  <Eye className="w-3 h-3" />
                  <span>Visible</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3" />
                  <span>Hidden</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Preview Section - Shows for all sections */}
        {isSection && renderSectionPreview && (
          <div className="p-3 bg-black/20 border-t border-white/10">
            <div className={`text-[10px] mb-1.5 font-medium uppercase tracking-wide ${item.isVisible ? 'text-white/50' : 'text-white/30'}`}>
              Preview
            </div>
            <div className={`bg-zinc-900 rounded-md p-2 max-h-[120px] overflow-hidden relative pointer-events-none ${!item.isVisible ? 'opacity-50' : ''}`}>
              <div className="transform scale-[0.6] origin-top-left" style={{ width: '167%', height: '167%' }}>
                {renderSectionPreview(item.id)}
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900 pointer-events-none"></div>
            </div>
          </div>
        )}
        
        {/* Preview Section - Shows for Top Performers subsections */}
        {isTopPerformersSubsection && renderSectionPreview && (
          <div className="p-3 bg-black/20 border-t border-white/10">
            <div className={`text-[10px] mb-1.5 font-medium uppercase tracking-wide ${item.isVisible ? 'text-white/50' : 'text-white/30'}`}>
              Preview
            </div>
            <div className={`bg-zinc-900 rounded-md p-2 max-h-[120px] overflow-hidden relative pointer-events-none ${!item.isVisible ? 'opacity-50' : ''}`}>
              <div className="transform scale-[0.6] origin-top-left" style={{ width: '167%', height: '167%' }}>
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
          
          // Get color scheme based on delta (positive = green, negative = red, no delta = gray)
          const getColors = () => {
            if (!previewData?.delta) {
              // No delta - use neutral gray
              return { stroke: 'rgb(148, 163, 184)', gradient: ['rgba(148, 163, 184, 0.2)', 'rgba(148, 163, 184, 0)'] };
            }
            
            if (previewData.delta.isPositive) {
              // Positive trend - green
              return { stroke: 'rgb(16, 185, 129)', gradient: ['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0)'] };
            } else {
              // Negative trend - red
              return { stroke: 'rgb(239, 68, 68)', gradient: ['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0)'] };
            }
          };
          
          const colors = getColors();
          
          return (
            <div className="p-3 bg-black/20 border-t border-white/10">
              {hasData ? (
                <>
                  {/* Real sparkline graph */}
                  <div className={`h-16 rounded-lg overflow-hidden pointer-events-none`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart 
                        data={previewData.sparklineData}
                        margin={{ top: 4, right: 0, bottom: 4, left: 0 }}
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
                          strokeWidth={2}
                          fill={`url(#preview-gradient-${item.id})`}
                          isAnimationActive={false}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Value and delta */}
                  <div className={`mt-1.5 text-right ${item.isVisible ? '' : 'opacity-50'}`}>
                    <div className="text-lg font-bold" style={{ color: colors.stroke }}>
                      {previewData.value}
                    </div>
                    {previewData.delta && (
                      <div className={`text-[10px] ${previewData.delta.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {previewData.delta.isPositive ? '↑' : '↓'} {Math.abs(previewData.delta.value).toFixed(1)}% vs last period
                      </div>
                    )}
                    {!previewData.delta && (
                      <div className="text-[10px] text-white/40">
                        Current period
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Fallback: static bars if no data */}
                  <div className={`h-16 rounded-lg ${item.isVisible ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5' : 'bg-white/5'} p-2 flex items-end justify-between gap-1 pointer-events-none`}>
                    {[40, 55, 35, 65, 80, 60, 90, 75, 95, 85].map((height, i) => (
                      <div 
                        key={i}
                        className={`flex-1 rounded-sm transition-all ${item.isVisible ? 'bg-emerald-500/60' : 'bg-white/20'}`}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                  <div className={`mt-1.5 text-right ${item.isVisible ? 'text-emerald-400' : 'text-white/30'}`}>
                    <div className="text-lg font-bold">
                      {item.id === 'revenue' ? '$2.4K' : 
                       item.id === 'downloads' ? '156' :
                       item.id === 'views' ? '1.2M' :
                       item.id === 'likes' ? '84.5K' :
                       item.id === 'comments' ? '12.3K' :
                       item.id === 'shares' ? '8.9K' :
                       item.id === 'videos' ? '24' :
                       item.id === 'accounts' ? '8' :
                       item.id === 'engagementRate' ? '6.8%' :
                       item.id === 'link-clicks' ? '432' : '0'}
                    </div>
                    <div className={`text-[10px] ${item.isVisible ? 'text-white/40' : 'text-white/20'}`}>
                      {item.isVisible ? 'No data' : 'Hidden'}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}
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
          <div className="px-8 py-6 border-b border-white/10">
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
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8">
            {/* Dashboard Sections */}
            {sectionCards.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2 uppercase tracking-wide">
                  <span>Dashboard Sections</span>
                  <span className="text-xs text-white/30 font-normal normal-case">
                    ({sectionCards.filter(c => c.isVisible).length}/{sectionCards.length} visible)
                  </span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sectionCards.map(item => renderItemCard(item))}
                </div>
              </div>
            )}
            
            {/* KPI Cards */}
            {kpiCards.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2 uppercase tracking-wide">
                  <span>KPI Metrics</span>
                  <span className="text-xs text-white/30 font-normal normal-case">
                    ({kpiCards.filter(c => c.isVisible).length}/{kpiCards.length} visible)
                  </span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {kpiCards.map(item => renderItemCard(item))}
                </div>
              </div>
            )}
            
            {/* Top Performers Subsections */}
            {topPerformersSubsections.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2 uppercase tracking-wide">
                  <span>Top Performers Components</span>
                  <span className="text-xs text-white/30 font-normal normal-case">
                    ({topPerformersSubsections.filter(c => c.isVisible).length}/{topPerformersSubsections.length} visible)
                  </span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {topPerformersSubsections.map(item => renderItemCard(item))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-5 border-t border-white/10 flex items-center justify-between">
            <div className="text-sm text-white/50">
              Changes are saved automatically
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white font-medium rounded-lg transition-colors border border-white/10"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
