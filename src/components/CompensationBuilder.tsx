import React, { useState } from 'react';
import { Plus, X, DollarSign, Eye, Target, Award, TrendingUp, Calendar } from 'lucide-react';
import { CompensationRule, CompensationRuleType, CompensationStructure } from '../types/campaigns';

interface CompensationBuilderProps {
  value: CompensationStructure;
  onChange: (structure: CompensationStructure) => void;
}

const CompensationBuilder: React.FC<CompensationBuilderProps> = ({ value, onChange }) => {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const ruleTypeInfo: Record<CompensationRuleType, { icon: React.ReactNode; label: string; description: string }> = {
    base_per_video: {
      icon: <DollarSign className="w-5 h-5" />,
      label: 'Base Per Video',
      description: 'Fixed payment for each video posted'
    },
    cpm: {
      icon: <Eye className="w-5 h-5" />,
      label: 'CPM (Per 1K Views)',
      description: 'Pay per 1,000 views received'
    },
    total_views_target: {
      icon: <Target className="w-5 h-5" />,
      label: 'Total Views Target',
      description: 'One-time payment for reaching view goal'
    },
    bonus_tier: {
      icon: <Award className="w-5 h-5" />,
      label: 'Performance Bonus',
      description: 'Bonus when reaching performance threshold'
    },
    engagement_bonus: {
      icon: <TrendingUp className="w-5 h-5" />,
      label: 'Engagement Bonus',
      description: 'Bonus for maintaining high engagement rate'
    },
    milestone_bonus: {
      icon: <Calendar className="w-5 h-5" />,
      label: 'Milestone Bonus',
      description: 'Bonus for reaching specific milestones'
    }
  };

  const addRule = (type: CompensationRuleType) => {
    const newRule: CompensationRule = {
      id: Date.now().toString(),
      type,
      description: generateDefaultDescription(type),
      enabled: true
    };

    onChange({
      ...value,
      rules: [...value.rules, newRule]
    });
    setShowAddMenu(false);
  };

  const updateRule = (id: string, updates: Partial<CompensationRule>) => {
    onChange({
      ...value,
      rules: value.rules.map(rule => 
        rule.id === id ? { ...rule, ...updates } : rule
      )
    });
  };

  const removeRule = (id: string) => {
    onChange({
      ...value,
      rules: value.rules.filter(rule => rule.id !== id)
    });
  };

  const generateDefaultDescription = (type: CompensationRuleType): string => {
    switch (type) {
      case 'base_per_video': return 'Base payment per video';
      case 'cpm': return 'Payment per 1,000 views';
      case 'total_views_target': return 'Payment for reaching view target';
      case 'bonus_tier': return 'Performance-based bonus';
      case 'engagement_bonus': return 'Engagement rate bonus';
      case 'milestone_bonus': return 'Milestone completion bonus';
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const calculateEstimatedPayout = (rule: CompensationRule, assumedVideos = 10, assumedViews = 500000): string => {
    switch (rule.type) {
      case 'base_per_video':
        return rule.amountPerVideo ? `$${(rule.amountPerVideo * assumedVideos).toFixed(0)}` : '$0';
      case 'cpm':
        return rule.cpmRate ? `$${((rule.cpmRate * assumedViews) / 1000).toFixed(0)}` : '$0';
      case 'total_views_target':
        return rule.targetAmount && assumedViews >= (rule.targetViews || 0) ? `$${rule.targetAmount}` : '$0';
      case 'bonus_tier':
        return rule.tierAmount || '$0';
      case 'engagement_bonus':
        return rule.engagementBonusAmount ? `$${rule.engagementBonusAmount}` : '$0';
      case 'milestone_bonus':
        return rule.milestoneAmount ? `$${rule.milestoneAmount}` : '$0';
      default:
        return '$0';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Compensation Structure</h3>
          <p className="text-sm text-white/50 mt-1">Add multiple payment rules to create flexible compensation</p>
        </div>
      </div>

      {/* Existing Rules */}
      <div className="space-y-3">
        {value.rules.length === 0 ? (
          <div className="px-6 py-8 bg-white/5 border border-white/10 border-dashed rounded-lg text-center">
            <DollarSign className="w-8 h-8 text-white/30 mx-auto mb-3" />
            <p className="text-white/50 text-sm">No compensation rules added yet</p>
            <p className="text-white/30 text-xs mt-1">Click "Add Payment Rule" to get started</p>
          </div>
        ) : (
          value.rules.map((rule, index) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              index={index}
              ruleTypeInfo={ruleTypeInfo[rule.type]}
              onUpdate={(updates) => updateRule(rule.id, updates)}
              onRemove={() => removeRule(rule.id)}
              formatNumber={formatNumber}
              calculateEstimatedPayout={calculateEstimatedPayout}
            />
          ))
        )}
      </div>

      {/* Add Rule Button */}
      <div className="relative">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 rounded-lg text-emerald-400 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span className="font-medium">Add Payment Rule</span>
        </button>

        {/* Add Menu Dropdown */}
        {showAddMenu && (
          <>
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setShowAddMenu(false)}
            />
            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden">
              {(Object.entries(ruleTypeInfo) as [CompensationRuleType, typeof ruleTypeInfo[CompensationRuleType]][]).map(([type, info]) => (
                <button
                  key={type}
                  onClick={() => addRule(type)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-b-0"
                >
                  <div className="p-2 rounded-lg bg-white/5 text-emerald-400">
                    {info.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-sm">{info.label}</div>
                    <div className="text-xs text-white/50 mt-0.5">{info.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-2">
          Additional Notes (Optional)
        </label>
        <textarea
          value={value.notes || ''}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder="Add any additional compensation details or requirements..."
          rows={3}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 resize-none"
        />
      </div>
    </div>
  );
};

interface RuleCardProps {
  rule: CompensationRule;
  index: number;
  ruleTypeInfo: { icon: React.ReactNode; label: string; description: string };
  onUpdate: (updates: Partial<CompensationRule>) => void;
  onRemove: () => void;
  formatNumber: (num: number) => string;
  calculateEstimatedPayout: (rule: CompensationRule) => string;
}

const RuleCard: React.FC<RuleCardProps> = ({ 
  rule, 
  index, 
  ruleTypeInfo, 
  onUpdate, 
  onRemove,
  formatNumber,
  calculateEstimatedPayout
}) => {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border-b border-white/5">
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
          {ruleTypeInfo.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white text-sm">{ruleTypeInfo.label}</div>
          <div className="text-xs text-white/50 mt-0.5">Est. payout: {calculateEstimatedPayout(rule)}</div>
        </div>
        <button
          onClick={onRemove}
          className="p-2 hover:bg-white/5 rounded-lg text-white/50 hover:text-red-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form */}
      <div className="p-4 space-y-3">
        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">Description</label>
          <input
            type="text"
            value={rule.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Describe this payment rule..."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Type-specific fields */}
        {rule.type === 'base_per_video' && (
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">Amount Per Video</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
              <span className="text-white/50">$</span>
              <input
                type="number"
                value={rule.amountPerVideo || ''}
                onChange={(e) => onUpdate({ amountPerVideo: Number(e.target.value) })}
                step="0.01"
                min="0"
                placeholder="50.00"
                className="flex-1 bg-transparent text-white text-sm focus:outline-none"
              />
              <span className="text-white/30 text-xs">per video</span>
            </div>
          </div>
        )}

        {rule.type === 'cpm' && (
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">CPM Rate</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
              <span className="text-white/50">$</span>
              <input
                type="number"
                value={rule.cpmRate || ''}
                onChange={(e) => onUpdate({ cpmRate: Number(e.target.value) })}
                step="0.01"
                min="0"
                placeholder="1.50"
                className="flex-1 bg-transparent text-white text-sm focus:outline-none"
              />
              <span className="text-white/30 text-xs">per 1K views</span>
            </div>
          </div>
        )}

        {rule.type === 'total_views_target' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5">Target Views</label>
              <input
                type="number"
                value={rule.targetViews || ''}
                onChange={(e) => onUpdate({ targetViews: Number(e.target.value) })}
                step="1000"
                min="0"
                placeholder="1500000"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
              />
              <div className="text-xs text-white/30 mt-1">
                {rule.targetViews ? formatNumber(rule.targetViews) : '0'} views
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5">Payment Amount</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
                <span className="text-white/50">$</span>
                <input
                  type="number"
                  value={rule.targetAmount || ''}
                  onChange={(e) => onUpdate({ targetAmount: Number(e.target.value) })}
                  step="100"
                  min="0"
                  placeholder="3000"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {rule.type === 'bonus_tier' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5">Bonus Metric</label>
              <select
                value={rule.tierMetric || 'views'}
                onChange={(e) => onUpdate({ tierMetric: e.target.value as any })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50"
              >
                <option value="views">Total Views</option>
                <option value="likes">Total Likes</option>
                <option value="comments">Total Comments</option>
                <option value="shares">Total Shares</option>
                <option value="engagement_rate">Engagement Rate</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">Threshold</label>
                <input
                  type="number"
                  value={rule.tierThreshold || ''}
                  onChange={(e) => onUpdate({ tierThreshold: Number(e.target.value) })}
                  step={rule.tierMetric === 'engagement_rate' ? '0.1' : '1000'}
                  min="0"
                  placeholder={rule.tierMetric === 'engagement_rate' ? '5.0' : '500000'}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">Bonus Amount</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
                  <span className="text-white/50">$</span>
                  <input
                    type="number"
                    value={rule.tierAmount || ''}
                    onChange={(e) => onUpdate({ tierAmount: Number(e.target.value) })}
                    step="50"
                    min="0"
                    placeholder="500"
                    className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {rule.type === 'engagement_bonus' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5">Min. Engagement Rate</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
                <input
                  type="number"
                  value={rule.minEngagementRate || ''}
                  onChange={(e) => onUpdate({ minEngagementRate: Number(e.target.value) })}
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="5.0"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                />
                <span className="text-white/30 text-xs">%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5">Bonus Amount</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
                <span className="text-white/50">$</span>
                <input
                  type="number"
                  value={rule.engagementBonusAmount || ''}
                  onChange={(e) => onUpdate({ engagementBonusAmount: Number(e.target.value) })}
                  step="10"
                  min="0"
                  placeholder="100"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {rule.type === 'milestone_bonus' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5">Milestone Type</label>
              <select
                value={rule.milestoneType || 'views'}
                onChange={(e) => onUpdate({ milestoneType: e.target.value as any })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50"
              >
                <option value="views">Total Views Milestone</option>
                <option value="videos">Number of Videos</option>
                <option value="days">Days Active</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">Milestone Value</label>
                <input
                  type="number"
                  value={rule.milestoneValue || ''}
                  onChange={(e) => onUpdate({ milestoneValue: Number(e.target.value) })}
                  step={rule.milestoneType === 'views' ? '10000' : '1'}
                  min="0"
                  placeholder={
                    rule.milestoneType === 'views' ? '1000000' :
                    rule.milestoneType === 'videos' ? '10' : '30'
                  }
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">Bonus Amount</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
                  <span className="text-white/50">$</span>
                  <input
                    type="number"
                    value={rule.milestoneAmount || ''}
                    onChange={(e) => onUpdate({ milestoneAmount: Number(e.target.value) })}
                    step="50"
                    min="0"
                    placeholder="250"
                    className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompensationBuilder;

