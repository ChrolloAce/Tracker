import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  DollarSign, 
  Eye, 
  Calendar, 
  Target, 
  Video,
  CheckCircle2,
  GripVertical,
  Percent
} from 'lucide-react';
import { PaymentTier, PaymentTierType, TieredPaymentStructure, PAYMENT_TIER_TEMPLATES } from '../types/payments';
import clsx from 'clsx';

interface TieredPaymentBuilderProps {
  value: TieredPaymentStructure | null;
  onChange: (structure: TieredPaymentStructure) => void;
}

const TIER_TYPE_OPTIONS: { 
  value: PaymentTierType; 
  label: string; 
  icon: React.ReactNode; 
  description: string;
  color: string;
}[] = [
  { 
    value: 'upfront', 
    label: 'Upfront Payment', 
    icon: <DollarSign className="w-4 h-4" />, 
    description: 'Payment before work begins',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
  },
  { 
    value: 'on_delivery', 
    label: 'On Delivery', 
    icon: <Video className="w-4 h-4" />, 
    description: 'Payment when video(s) delivered',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/30'
  },
  { 
    value: 'view_milestone', 
    label: 'View Milestone', 
    icon: <Eye className="w-4 h-4" />, 
    description: 'Payment after reaching view goal',
    color: 'bg-green-500/10 text-green-400 border-green-500/30'
  },
  { 
    value: 'engagement_milestone', 
    label: 'Engagement Milestone', 
    icon: <Target className="w-4 h-4" />, 
    description: 'Payment after engagement threshold',
    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
  },
  { 
    value: 'time_based', 
    label: 'Time-Based', 
    icon: <Calendar className="w-4 h-4" />, 
    description: 'Payment after X days',
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/30'
  },
  { 
    value: 'completion', 
    label: 'Final Payment', 
    icon: <CheckCircle2 className="w-4 h-4" />, 
    description: 'Final payment on completion',
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
  },
  { 
    value: 'custom', 
    label: 'Custom', 
    icon: <Target className="w-4 h-4" />, 
    description: 'Custom payment condition',
    color: 'bg-gray-500/10 text-gray-400 border-gray-500/30'
  }
];

const TieredPaymentBuilder: React.FC<TieredPaymentBuilderProps> = ({ value, onChange }) => {
  const [structure, setStructure] = useState<TieredPaymentStructure | null>(value);
  const [showAddTier, setShowAddTier] = useState(false);
  const [showTemplates, setShowTemplates] = useState(!value);

  useEffect(() => {
    setStructure(value);
  }, [value]);

  const handleInitializeFromTemplate = (templateId: string) => {
    const template = PAYMENT_TIER_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    const newStructure: TieredPaymentStructure = {
      id: `payment-${Date.now()}`,
      name: template.name,
      totalAmount: 0,
      currency: 'USD',
      tiers: template.tiers.map((tier, index) => ({
        ...tier,
        id: `tier-${Date.now()}-${index}`,
        isPaid: false
      })),
      isActive: true,
      totalPaid: 0,
      remainingBalance: 0,
      createdAt: new Date() as any,
      createdBy: ''
    };

    setStructure(newStructure);
    onChange(newStructure);
    setShowTemplates(false);
  };

  const handleUpdateStructure = (updates: Partial<TieredPaymentStructure>) => {
    if (!structure) return;

    const updated = { ...structure, ...updates };
    
    // Recalculate remaining balance
    updated.remainingBalance = updated.totalAmount - updated.totalPaid;
    
    setStructure(updated);
    onChange(updated);
  };

  const handleAddTier = (type: PaymentTierType) => {
    if (!structure) return;

    const newTier: PaymentTier = {
      id: `tier-${Date.now()}`,
      type,
      order: structure.tiers.length,
      amountType: 'percentage',
      amount: 0,
      label: TIER_TYPE_OPTIONS.find(t => t.value === type)?.label || '',
      isPaid: false
    };

    handleUpdateStructure({
      tiers: [...structure.tiers, newTier]
    });
    setShowAddTier(false);
  };

  const handleUpdateTier = (tierId: string, updates: Partial<PaymentTier>) => {
    if (!structure) return;

    const updatedTiers = structure.tiers.map(tier =>
      tier.id === tierId ? { ...tier, ...updates } : tier
    );

    handleUpdateStructure({ tiers: updatedTiers });
  };

  const handleDeleteTier = (tierId: string) => {
    if (!structure) return;

    const updatedTiers = structure.tiers
      .filter(tier => tier.id !== tierId)
      .map((tier, index) => ({ ...tier, order: index }));

    handleUpdateStructure({ tiers: updatedTiers });
  };

  const calculateTierAmount = (tier: PaymentTier): number => {
    if (!structure) return 0;
    
    if (tier.amountType === 'percentage') {
      return (structure.totalAmount * tier.amount) / 100;
    }
    return tier.amount;
  };

  const calculateTotalAllocated = (): number => {
    if (!structure) return 0;
    
    return structure.tiers.reduce((sum, tier) => {
      if (tier.amountType === 'percentage') {
        return sum + tier.amount;
      }
      return sum + tier.amount;
    }, 0);
  };

  const getTotalDollarAmount = (): number => {
    if (!structure) return 0;
    
    return structure.tiers.reduce((sum, tier) => {
      return sum + calculateTierAmount(tier);
    }, 0);
  };

  const renderTierForm = (tier: PaymentTier) => {
    const tierType = TIER_TYPE_OPTIONS.find(t => t.value === tier.type);
    const tierAmount = calculateTierAmount(tier);

    return (
      <div
        key={tier.id}
        className={clsx(
          "border rounded-lg p-4 transition-all",
          tier.isPaid
            ? "bg-green-500/5 border-green-500/20"
            : "bg-white/5 border-white/10"
        )}
      >
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          <div className="flex-shrink-0 mt-2 text-gray-500 cursor-move">
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Tier Icon */}
          <div className={clsx(
            "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border",
            tierType?.color || 'bg-gray-500/10 text-gray-400 border-gray-500/30'
          )}>
            {tierType?.icon}
          </div>

          {/* Tier Content */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Tier Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={tier.label}
                  onChange={(e) => handleUpdateTier(tier.id, { label: e.target.value })}
                  placeholder="Payment stage name..."
                  className="w-full px-2 py-1 bg-transparent border-none text-white font-medium text-sm focus:outline-none focus:ring-0"
                />
                <p className="text-xs text-gray-400 mt-0.5">{tierType?.description}</p>
              </div>
              
              {/* Tier Amount Display */}
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-bold text-white">
                  ${tierAmount.toLocaleString()}
                </div>
                {tier.amountType === 'percentage' && (
                  <div className="text-xs text-gray-400">{tier.amount}% of total</div>
                )}
              </div>

              {/* Delete Button */}
              <button
                onClick={() => handleDeleteTier(tier.id)}
                className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Amount Configuration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">
                  Amount Type
                </label>
                <select
                  value={tier.amountType}
                  onChange={(e) => handleUpdateTier(tier.id, { 
                    amountType: e.target.value as 'percentage' | 'fixed_amount' 
                  })}
                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed_amount">Fixed Amount ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">
                  {tier.amountType === 'percentage' ? 'Percentage' : 'Amount'}
                </label>
                <div className="relative">
                  {tier.amountType === 'percentage' && (
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  )}
                  {tier.amountType === 'fixed_amount' && (
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  )}
                  <input
                    type="number"
                    value={tier.amount || ''}
                    onChange={(e) => handleUpdateTier(tier.id, { amount: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    step={tier.amountType === 'percentage' ? '1' : '0.01'}
                    className="w-full pl-9 pr-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                </div>
              </div>
            </div>

            {/* Condition-Specific Fields */}
            {tier.type === 'view_milestone' && (
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">
                  Views Required
                </label>
                <input
                  type="number"
                  value={tier.viewsRequired || ''}
                  onChange={(e) => handleUpdateTier(tier.id, { viewsRequired: parseInt(e.target.value) || 0 })}
                  placeholder="10000"
                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                />
              </div>
            )}

            {tier.type === 'engagement_milestone' && (
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">
                  Total Engagement Required (Likes + Comments)
                </label>
                <input
                  type="number"
                  value={tier.engagementRequired || ''}
                  onChange={(e) => handleUpdateTier(tier.id, { engagementRequired: parseInt(e.target.value) || 0 })}
                  placeholder="1000"
                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                />
              </div>
            )}

            {tier.type === 'on_delivery' && (
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">
                  Number of Videos Required
                </label>
                <input
                  type="number"
                  value={tier.videosRequired || ''}
                  onChange={(e) => handleUpdateTier(tier.id, { videosRequired: parseInt(e.target.value) || 0 })}
                  placeholder="1"
                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                />
              </div>
            )}

            {tier.type === 'time_based' && (
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">
                  Days After Contract Start
                </label>
                <input
                  type="number"
                  value={tier.daysAfterStart || ''}
                  onChange={(e) => handleUpdateTier(tier.id, { daysAfterStart: parseInt(e.target.value) || 0 })}
                  placeholder="30"
                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                />
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">
                Description (optional)
              </label>
              <textarea
                value={tier.description || ''}
                onChange={(e) => handleUpdateTier(tier.id, { description: e.target.value })}
                placeholder="Add any additional details about this payment..."
                rows={2}
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50 resize-none"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Template Selection View
  if (showTemplates && !structure) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Choose a Payment Structure Template</h3>
          <p className="text-sm text-gray-400">Select a template to get started, or build from scratch</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {PAYMENT_TIER_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => handleInitializeFromTemplate(template.id)}
              className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all text-left"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{template.icon}</div>
                <div className="flex-1">
                  <h4 className="text-white font-medium">{template.name}</h4>
                  <p className="text-sm text-gray-400 mt-1">{template.description}</p>
                  {template.tiers.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {template.tiers.length} payment stage{template.tiers.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowTemplates(false)}
          className="w-full px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors"
        >
          Skip Templates
        </button>
      </div>
    );
  }

  // Main Builder View
  if (!structure) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 mb-4">No payment structure configured</p>
        <button
          onClick={() => setShowTemplates(true)}
          className="px-4 py-2 bg-white/90 hover:bg-white text-gray-900 rounded-lg font-medium text-sm transition-colors"
        >
          Get Started
        </button>
      </div>
    );
  }

  const totalAllocated = calculateTotalAllocated();
  const totalDollars = getTotalDollarAmount();
  const hasPercentages = structure.tiers.some(t => t.amountType === 'percentage');

  return (
    <div className="space-y-4">
      {/* Contract Overview */}
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Contract Name
            </label>
            <input
              type="text"
              value={structure.name}
              onChange={(e) => handleUpdateStructure({ name: e.target.value })}
              placeholder="e.g., Q1 2024 Campaign"
              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Total Contract Amount ($)
            </label>
            <input
              type="number"
              value={structure.totalAmount || ''}
              onChange={(e) => handleUpdateStructure({ totalAmount: parseFloat(e.target.value) || 0 })}
              placeholder="1000"
              step="0.01"
              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Payment Stages
            </label>
            <div className="px-3 py-2 bg-gray-800/30 border border-gray-600/30 rounded-lg">
              <div className="text-white font-bold">{structure.tiers.length} stage{structure.tiers.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>

        {/* Allocation Summary */}
        {hasPercentages && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Total Allocated:</span>
              <span className={clsx(
                "font-bold",
                totalAllocated === 100 ? "text-green-400" : totalAllocated > 100 ? "text-red-400" : "text-yellow-400"
              )}>
                {totalAllocated.toFixed(0)}% 
                {structure.totalAmount > 0 && ` ($${totalDollars.toLocaleString()})`}
              </span>
            </div>
            {totalAllocated !== 100 && (
              <p className={clsx(
                "text-xs mt-1",
                totalAllocated > 100 ? "text-red-400" : "text-yellow-400"
              )}>
                {totalAllocated > 100 
                  ? `Over-allocated by ${(totalAllocated - 100).toFixed(0)}%` 
                  : `${(100 - totalAllocated).toFixed(0)}% remaining to allocate`
                }
              </p>
            )}
          </div>
        )}
      </div>

      {/* Payment Tiers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white">Payment Stages</h4>
          <span className="text-xs text-gray-400">
            {structure.tiers.filter(t => t.isPaid).length} of {structure.tiers.length} paid
          </span>
        </div>

        {structure.tiers.length === 0 ? (
          <div className="text-center py-8 bg-white/5 border border-white/10 rounded-lg">
            <p className="text-gray-400 text-sm mb-3">No payment stages yet</p>
            <p className="text-gray-500 text-xs">Add your first payment stage to get started</p>
          </div>
        ) : (
          structure.tiers
            .sort((a, b) => a.order - b.order)
            .map(tier => renderTierForm(tier))
        )}
      </div>

      {/* Add Tier Button */}
      {!showAddTier ? (
        <button
          onClick={() => setShowAddTier(true)}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-lg transition-all flex items-center justify-center gap-2 text-white font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Payment Stage
        </button>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-white mb-2">Select Payment Stage Type</h4>
          <div className="grid grid-cols-2 gap-2">
            {TIER_TYPE_OPTIONS.map((type) => (
              <button
                key={type.value}
                onClick={() => handleAddTier(type.value)}
                className={clsx(
                  "p-3 rounded-lg border transition-all text-left hover:bg-white/10",
                  "bg-gray-800/50 border-gray-700/50"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={clsx("w-6 h-6 rounded flex items-center justify-center border", type.color)}>
                    {type.icon}
                  </div>
                  <span className="text-xs font-medium text-white">{type.label}</span>
                </div>
                <p className="text-xs text-gray-400">{type.description}</p>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAddTier(false)}
            className="w-full px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default TieredPaymentBuilder;

