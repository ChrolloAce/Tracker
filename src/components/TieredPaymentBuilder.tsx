import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Check, X } from 'lucide-react';
import { 
  PaymentTier, 
  PaymentComponent,
  PaymentComponentType,
  TieredPaymentStructure, 
  PAYMENT_TIER_TEMPLATES 
} from '../types/payments';

interface TieredPaymentBuilderProps {
  value: TieredPaymentStructure | null;
  onChange: (structure: TieredPaymentStructure) => void;
  alwaysEdit?: boolean; // If true, always show edit mode, skip collapsed view and templates
}

const COMPONENT_TYPES: { value: PaymentComponentType; label: string; unit: string }[] = [
  { value: 'flat_fee', label: 'Flat Fee', unit: '$' },
  { value: 'cpm', label: 'CPM (per 1K views)', unit: '$ per 1K' },
  { value: 'per_view', label: 'Per View', unit: '$ per view' },
  { value: 'per_engagement', label: 'Per Engagement', unit: '$ per engagement' },
  { value: 'bonus', label: 'Bonus', unit: '$' }
];

const TieredPaymentBuilder: React.FC<TieredPaymentBuilderProps> = ({ value, onChange, alwaysEdit = false }) => {
  const [structure, setStructure] = useState<TieredPaymentStructure | null>(value);
  const [isEditing, setIsEditing] = useState(alwaysEdit);
  const [showTemplates, setShowTemplates] = useState(!value && !alwaysEdit);

  useEffect(() => {
    // Migrate old structure format to new format
    if (value) {
      // Check if tiers is undefined or not an array (old format)
      if (!value.tiers || !Array.isArray(value.tiers)) {
        const migratedStructure: TieredPaymentStructure = {
          ...value,
          tiers: [] // Initialize with empty tiers array
        };
        setStructure(migratedStructure);
        setShowTemplates(false);
        setIsEditing(alwaysEdit);
      } else {
        setStructure(value);
        setShowTemplates(false);
        setIsEditing(alwaysEdit);
      }
    } else if (alwaysEdit) {
      // In always edit mode, initialize empty structure if none exists
      const emptyStructure: TieredPaymentStructure = {
        id: `payment-${Date.now()}`,
        name: 'Creator Contract',
        currency: 'USD',
        tiers: [],
        isActive: true,
        totalPaid: 0,
        createdAt: new Date() as any,
        createdBy: ''
      };
      setStructure(emptyStructure);
      setShowTemplates(false);
      setIsEditing(true);
    } else {
      setStructure(null);
      setShowTemplates(true);
      setIsEditing(false);
    }
  }, [value, alwaysEdit]);

  const handleInitializeFromTemplate = (templateId: string) => {
    const template = PAYMENT_TIER_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    const newStructure: TieredPaymentStructure = {
      id: `payment-${Date.now()}`,
      name: template.name,
      currency: 'USD',
      tiers: template.tiers.map((tier, index) => ({
        ...tier,
        id: `tier-${Date.now()}-${index}`,
        isPaid: false,
        components: tier.components.map((comp, ci) => ({
          ...comp,
          id: `comp-${Date.now()}-${ci}`
        }))
      })),
      isActive: true,
      totalPaid: 0,
      createdAt: new Date() as any,
      createdBy: ''
    };

    setStructure(newStructure);
    onChange(newStructure);
    setShowTemplates(false);
    setIsEditing(true);
  };

  const handleUpdateStructure = (updates: Partial<TieredPaymentStructure>) => {
    if (!structure) return;
    const updated = { ...structure, ...updates };
    setStructure(updated);
    onChange(updated);
  };

  const handleAddTier = () => {
    if (!structure) return;

    const newTier: PaymentTier = {
      id: `tier-${Date.now()}`,
      order: structure.tiers?.length || 0,
      label: 'New Payment Stage',
      appliesTo: 'per_video',
      components: [],
      isPaid: false
    };

    handleUpdateStructure({
      tiers: [...(structure.tiers || []), newTier]
    });
  };

  const handleUpdateTier = (tierId: string, updates: Partial<PaymentTier>) => {
    if (!structure || !structure.tiers) return;

    const updatedTiers = structure.tiers.map(tier =>
      tier.id === tierId ? { ...tier, ...updates } : tier
    );

    handleUpdateStructure({ tiers: updatedTiers });
  };

  const handleDeleteTier = (tierId: string) => {
    if (!structure || !structure.tiers) return;

    const updatedTiers = structure.tiers
      .filter(tier => tier.id !== tierId)
      .map((tier, index) => ({ ...tier, order: index }));

    handleUpdateStructure({ tiers: updatedTiers });
  };

  const handleAddComponent = (tierId: string) => {
    if (!structure || !structure.tiers) return;

    const updatedTiers = structure.tiers.map(tier => {
      if (tier.id === tierId) {
        const newComponent: PaymentComponent = {
          id: `comp-${Date.now()}`,
          type: 'flat_fee',
          amount: 0
        };
        return {
          ...tier,
          components: [...tier.components, newComponent]
        };
      }
      return tier;
    });

    handleUpdateStructure({ tiers: updatedTiers });
  };

  const handleUpdateComponent = (tierId: string, componentId: string, updates: Partial<PaymentComponent>) => {
    if (!structure || !structure.tiers) return;

    const updatedTiers = structure.tiers.map(tier => {
      if (tier.id === tierId) {
        return {
          ...tier,
          components: tier.components.map(comp =>
            comp.id === componentId ? { ...comp, ...updates } : comp
          )
        };
      }
      return tier;
    });

    handleUpdateStructure({ tiers: updatedTiers });
  };

  const handleDeleteComponent = (tierId: string, componentId: string) => {
    if (!structure || !structure.tiers) return;

    const updatedTiers = structure.tiers.map(tier => {
      if (tier.id === tierId) {
        return {
          ...tier,
          components: tier.components.filter(comp => comp.id !== componentId)
        };
      }
      return tier;
    });

    handleUpdateStructure({ tiers: updatedTiers });
  };

  // Generate human-readable summary
  const generateSummary = (): string => {
    if (!structure || !structure.tiers || structure.tiers.length === 0) return '';

    const parts: string[] = [];

    structure.tiers.forEach(tier => {
      const componentDescriptions = tier.components.map(comp => {
        let desc = '';
        if (comp.type === 'flat_fee') {
          desc = `$${comp.amount}`;
        } else if (comp.type === 'cpm') {
          desc = `$${comp.amount} CPM`;
          if (comp.minViews) {
            desc += ` after ${(comp.minViews / 1000).toFixed(0)}K views`;
          }
        } else if (comp.type === 'per_view') {
          desc = `$${comp.amount} per view`;
          if (comp.minViews) {
            desc += ` after ${(comp.minViews / 1000).toFixed(0)}K views`;
          }
        } else if (comp.type === 'bonus') {
          desc = `$${comp.amount} bonus`;
        } else if (comp.type === 'per_engagement') {
          desc = `$${comp.amount} per engagement`;
        }
        return desc;
      });

      if (tier.appliesTo === 'per_video') {
        if (tier.components.length > 0) {
          parts.push(`${componentDescriptions.join(' + ')} per video`);
        }
      } else if (tier.appliesTo === 'milestone' && tier.milestoneCondition) {
        const threshold = tier.milestoneCondition.threshold;
        const thresholdStr = threshold >= 1000 
          ? `${(threshold / 1000).toFixed(0)}K` 
          : threshold.toString();
        parts.push(`${componentDescriptions.join(' + ')} at ${thresholdStr} ${tier.milestoneCondition.type}`);
      } else if (tier.appliesTo === 'per_campaign') {
        parts.push(`${componentDescriptions.join(' + ')} per campaign`);
      }
    });

    return parts.join(', ');
  };

  // Calculate example earnings for a video
  const calculateExample = (views: number): { total: number; breakdown: string[] } => {
    if (!structure || !structure.tiers) return { total: 0, breakdown: [] };

    let total = 0;
    const breakdown: string[] = [];

    structure.tiers.forEach(tier => {
      if (tier.appliesTo === 'per_video') {
        tier.components.forEach(comp => {
          let amount = 0;
          let desc = '';

          if (comp.type === 'flat_fee') {
            amount = comp.amount;
            desc = `$${amount} flat fee`;
          } else if (comp.type === 'cpm') {
            if (!comp.minViews || views >= comp.minViews) {
              const eligibleViews = comp.minViews ? views - comp.minViews : views;
              amount = (eligibleViews / 1000) * comp.amount;
              // Apply cap if set
              if (comp.maxAmount && amount > comp.maxAmount) {
                amount = comp.maxAmount;
                desc = `$${amount.toFixed(2)} (capped)`;
              } else {
                desc = `$${amount.toFixed(2)} (${(eligibleViews / 1000).toFixed(1)}K views × $${comp.amount} CPM)`;
              }
            }
          } else if (comp.type === 'per_view') {
            if (!comp.minViews || views >= comp.minViews) {
              const eligibleViews = comp.minViews ? views - comp.minViews : views;
              amount = eligibleViews * comp.amount;
              desc = `$${amount.toFixed(2)} (${eligibleViews.toLocaleString()} views × $${comp.amount})`;
            }
          }

          if (amount > 0) {
            total += amount;
            breakdown.push(desc);
          }
        });
      } else if (tier.appliesTo === 'milestone' && tier.milestoneCondition) {
        if (tier.milestoneCondition.type === 'views' && views >= tier.milestoneCondition.threshold) {
          tier.components.forEach(comp => {
            if (comp.type === 'bonus') {
              total += comp.amount;
              breakdown.push(`$${comp.amount} bonus (${(tier.milestoneCondition!.threshold / 1000).toFixed(0)}K milestone)`);
            }
          });
        }
      }
    });

    return { total, breakdown };
  };

  // Template Selection View
  if (showTemplates && !structure) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">Payment Structure</h3>
          <p className="text-sm text-gray-400">Choose a payment template to get started</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {PAYMENT_TIER_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => handleInitializeFromTemplate(template.id)}
              className="p-4 bg-[#161616] hover:bg-[#1a1a1a] border border-gray-800 hover:border-gray-700 rounded-xl transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl flex-shrink-0">{template.icon}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-semibold text-base group-hover:text-white mb-1">{template.name}</h4>
                  <p className="text-sm text-gray-400 mb-2">{template.description}</p>
                  {template.example && (
                    <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 mt-2">
                      <p className="text-xs text-gray-300">{template.example}</p>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-800">
          <button
            onClick={() => {
              const emptyStructure: TieredPaymentStructure = {
                id: `payment-${Date.now()}`,
                name: 'Custom Payment Structure',
                currency: 'USD',
                tiers: [],
                isActive: true,
                totalPaid: 0,
                createdAt: new Date() as any,
                createdBy: ''
              };
              setStructure(emptyStructure);
              setShowTemplates(false);
              setIsEditing(true);
              onChange(emptyStructure);
            }}
            className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-white font-medium text-sm transition-all"
          >
            Start from scratch
          </button>
        </div>
      </div>
    );
  }

  if (!structure) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 text-sm mb-4">No payment structure configured</p>
        <button
          onClick={() => setShowTemplates(true)}
          className="px-4 py-2 bg-white/90 hover:bg-white text-gray-900 rounded-lg font-medium text-sm transition-colors"
        >
          Get Started
        </button>
      </div>
    );
  }

  const summary = generateSummary();
  const example1M = calculateExample(1000000);
  const example100K = calculateExample(100000);

  // Collapsed/Read-Only View
  if (!isEditing) {
    return (
      <div className="space-y-4">
        {/* Summary Card */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-medium text-gray-400">Payment Structure</h3>
                {structure.tiers && structure.tiers.length > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 rounded">
                    {structure.tiers.length} stage{structure.tiers.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              
              {summary ? (
                <p className="text-white leading-relaxed">
                  {summary.charAt(0).toUpperCase() + summary.slice(1)}.
                </p>
              ) : (
                <p className="text-gray-500 italic">No payment stages configured</p>
              )}
            </div>

            <button
              onClick={() => setIsEditing(true)}
              className="flex-shrink-0 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>
        </div>

        {/* Example Calculations */}
        {structure.tiers && structure.tiers.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <h4 className="text-xs font-medium text-gray-400 mb-3">Example Earnings</h4>
            
            <div className="space-y-3">
              {/* 100K example */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm text-gray-300">Video with 100K views</span>
                  <span className="text-lg font-bold text-white">${example100K.total.toLocaleString()}</span>
                </div>
                {example100K.breakdown.length > 0 && (
                  <div className="text-xs text-gray-500">
                    {example100K.breakdown.join(' + ')}
                  </div>
                )}
              </div>

              {/* 1M example */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm text-gray-300">Video with 1M views</span>
                  <span className="text-lg font-bold text-white">${example1M.total.toLocaleString()}</span>
                </div>
                {example1M.breakdown.length > 0 && (
                  <div className="text-xs text-gray-500">
                    {example1M.breakdown.join(' + ')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Edit Mode
  return (
    <div className="space-y-4">
      {/* Header */}
      {!alwaysEdit && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-white">Edit Payment Structure</h3>
            <p className="text-xs text-gray-400 mt-0.5">Build your payment stages and components</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (confirm('Switch to a different template? Current changes will be lost.')) {
                  setStructure(null);
                  setShowTemplates(true);
                  setIsEditing(false);
                }
              }}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 rounded-lg text-sm font-medium transition-colors"
            >
              Change Template
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Done
            </button>
          </div>
        </div>
      )}

      {/* Tiers */}
      <div className="space-y-3">
        {structure.tiers && structure.tiers.map((tier) => (
          <div
            key={tier.id}
            className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3"
          >
            {/* Tier Header */}
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={tier.label}
                  onChange={(e) => handleUpdateTier(tier.id, { label: e.target.value })}
                  placeholder="Stage name..."
                  className="w-full px-3 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded text-white text-sm font-medium focus:outline-none focus:ring-1 focus:ring-white/50"
                />
                
                <select
                  value={tier.appliesTo}
                  onChange={(e) => handleUpdateTier(tier.id, { appliesTo: e.target.value as any })}
                  className="w-full px-3 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-white/50"
                >
                  <option value="per_video">Per Video</option>
                  <option value="milestone">Milestone</option>
                  <option value="per_campaign">Per Campaign</option>
                </select>
              </div>

              <button
                onClick={() => handleDeleteTier(tier.id)}
                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Milestone Condition */}
            {tier.appliesTo === 'milestone' && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={tier.milestoneCondition?.type || 'views'}
                  onChange={(e) => handleUpdateTier(tier.id, {
                    milestoneCondition: {
                      type: e.target.value as any,
                      threshold: tier.milestoneCondition?.threshold || 0
                    }
                  })}
                  className="px-3 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-white/50"
                >
                  <option value="views">Views</option>
                  <option value="videos">Videos</option>
                  <option value="time">Days</option>
                  <option value="engagement">Engagement</option>
                </select>
                <input
                  type="number"
                  value={tier.milestoneCondition?.threshold || ''}
                  onChange={(e) => handleUpdateTier(tier.id, {
                    milestoneCondition: {
                      type: tier.milestoneCondition?.type || 'views',
                      threshold: parseInt(e.target.value) || 0
                    }
                  })}
                  placeholder="Threshold..."
                  className="px-3 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-white/50"
                />
              </div>
            )}

            {/* Components */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-400">Payment Components</div>
              {tier.components.map((comp) => {
                return (
                  <div key={comp.id} className="flex items-center gap-2 bg-gray-800/30 p-2 rounded">
                    <select
                      value={comp.type}
                      onChange={(e) => handleUpdateComponent(tier.id, comp.id, { type: e.target.value as PaymentComponentType })}
                      className="flex-1 px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-white/50"
                    >
                      {COMPONENT_TYPES.map(ct => (
                        <option key={ct.value} value={ct.value}>{ct.label}</option>
                      ))}
                    </select>

                    <input
                      type="number"
                      value={comp.amount || ''}
                      onChange={(e) => handleUpdateComponent(tier.id, comp.id, { amount: parseFloat(e.target.value) || 0 })}
                      placeholder="Amount"
                      step="0.01"
                      className="w-24 px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-white/50"
                    />

                    {(comp.type === 'cpm' || comp.type === 'per_view') && (
                      <>
                        <input
                          type="number"
                          value={comp.minViews || ''}
                          onChange={(e) => handleUpdateComponent(tier.id, comp.id, { minViews: parseInt(e.target.value) || undefined })}
                          placeholder="After X views..."
                          className="w-32 px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-white/50"
                        />
                        {comp.type === 'cpm' && (
                          <input
                            type="number"
                            value={comp.maxAmount || ''}
                            onChange={(e) => handleUpdateComponent(tier.id, comp.id, { maxAmount: parseFloat(e.target.value) || undefined })}
                            placeholder="Cap $..."
                            step="0.01"
                            className="w-24 px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-white/50"
                          />
                        )}
                      </>
                    )}

                    <button
                      onClick={() => handleDeleteComponent(tier.id, comp.id)}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              <button
                onClick={() => handleAddComponent(tier.id)}
                className="w-full px-3 py-1.5 bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700/30 hover:border-gray-700/50 rounded text-gray-400 hover:text-white text-xs font-medium transition-all flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Component
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Tier Button */}
      {(!structure.tiers || structure.tiers.length === 0) && (
        <button
          onClick={handleAddTier}
          className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-white font-medium text-sm transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Payment Stage
        </button>
      )}

      {structure.tiers && structure.tiers.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400">
            One payment stage per creator. Delete the existing stage to create a new one.
          </p>
        </div>
      )}
    </div>
  );
};

export default TieredPaymentBuilder;
