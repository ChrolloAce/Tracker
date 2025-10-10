import React, { useState } from 'react';
import { Plus, Trash2, DollarSign, TrendingUp, Target, Video, Eye, ThumbsUp, MessageCircle, Share2, Link as LinkIcon } from 'lucide-react';
import { PaymentRule, PaymentRuleType } from '../services/PaymentCalculationService';
import clsx from 'clsx';

interface PaymentRuleBuilderProps {
  rules: PaymentRule[];
  onChange: (rules: PaymentRule[]) => void;
}

const RULE_TYPES: { value: PaymentRuleType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'flat_upfront', label: 'Upfront Payment', icon: <DollarSign className="w-4 h-4" />, description: 'One-time payment at start' },
  { value: 'flat_fee', label: 'Per Video', icon: <Video className="w-4 h-4" />, description: 'Fixed amount per video' },
  { value: 'cpm', label: 'CPM (Per 1K Views)', icon: <Eye className="w-4 h-4" />, description: 'Rate per 1000 views' },
  { value: 'per_view', label: 'Per View', icon: <Eye className="w-4 h-4" />, description: 'Rate per individual view' },
  { value: 'per_like', label: 'Per Like', icon: <ThumbsUp className="w-4 h-4" />, description: 'Rate per like' },
  { value: 'per_comment', label: 'Per Comment', icon: <MessageCircle className="w-4 h-4" />, description: 'Rate per comment' },
  { value: 'per_share', label: 'Per Share', icon: <Share2 className="w-4 h-4" />, description: 'Rate per share' },
  { value: 'per_click', label: 'Per Click', icon: <LinkIcon className="w-4 h-4" />, description: 'Rate per tracked link click' },
  { value: 'milestone_views', label: 'View Milestone', icon: <Target className="w-4 h-4" />, description: 'Bonus at view threshold' },
  { value: 'milestone_videos', label: 'Video Milestone', icon: <Target className="w-4 h-4" />, description: 'Bonus at video count' },
  { value: 'tiered_views', label: 'Tiered Views', icon: <TrendingUp className="w-4 h-4" />, description: 'Different rates by view range' },
  { value: 'revenue_share', label: 'Revenue Share', icon: <DollarSign className="w-4 h-4" />, description: 'Percentage of revenue' },
  { value: 'retainer', label: 'Monthly Retainer', icon: <DollarSign className="w-4 h-4" />, description: 'Fixed monthly payment' },
];

const PaymentRuleBuilder: React.FC<PaymentRuleBuilderProps> = ({ rules, onChange }) => {
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRuleType, setNewRuleType] = useState<PaymentRuleType>('flat_fee');

  const handleAddRule = () => {
    const newRule: PaymentRule = {
      id: `rule-${Date.now()}`,
      type: newRuleType,
      enabled: true,
      description: '',
    };

    onChange([...rules, newRule]);
    setShowAddRule(false);
  };

  const handleUpdateRule = (id: string, updates: Partial<PaymentRule>) => {
    onChange(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleDeleteRule = (id: string) => {
    onChange(rules.filter(r => r.id !== id));
  };

  const handleToggleRule = (id: string) => {
    onChange(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const generateDescription = (rule: PaymentRule): string => {
    switch (rule.type) {
      case 'flat_upfront':
        return `$${rule.amount || 0} upfront${rule.upfrontCondition?.videosRequired ? ` for ${rule.upfrontCondition.videosRequired} videos` : ''}`;
      case 'flat_fee':
        return `$${rule.amount || 0} per video${rule.minViews ? ` (min ${rule.minViews.toLocaleString()} views)` : ''}`;
      case 'cpm':
        return `$${rule.rate || 0} CPM${rule.minViews ? ` (min ${rule.minViews.toLocaleString()} views)` : ''}`;
      case 'per_view':
        return `$${rule.rate || 0} per view`;
      case 'per_like':
        return `$${rule.rate || 0} per like`;
      case 'per_comment':
        return `$${rule.rate || 0} per comment`;
      case 'per_share':
        return `$${rule.rate || 0} per share`;
      case 'per_click':
        return `$${rule.rate || 0} per click`;
      case 'milestone_views':
        return `$${rule.amount || 0} bonus at ${rule.milestoneThreshold?.toLocaleString() || 0} views`;
      case 'milestone_videos':
        return `$${rule.amount || 0} bonus at ${rule.milestoneThreshold || 0} videos`;
      case 'tiered_views':
        return `$${rule.amount || 0} for ${rule.minViews?.toLocaleString() || 0}-${rule.maxViews?.toLocaleString() || '∞'} views`;
      case 'revenue_share':
        return `${rule.percentage || 0}% revenue share`;
      case 'retainer':
        return `$${rule.amount || 0}/month retainer`;
      default:
        return '';
    }
  };

  const renderRuleForm = (rule: PaymentRule) => {
    const update = (updates: Partial<PaymentRule>) => {
      const description = generateDescription({ ...rule, ...updates });
      handleUpdateRule(rule.id, { ...updates, description });
    };

    return (
      <div className="space-y-3">
        {/* Amount/Rate fields */}
        {['flat_upfront', 'flat_fee', 'milestone_views', 'milestone_videos', 'tiered_views', 'retainer'].includes(rule.type) && (
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Amount ($)</label>
            <input
              type="number"
              value={rule.amount || ''}
              onChange={(e) => update({ amount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        )}

        {['cpm', 'per_view', 'per_like', 'per_comment', 'per_share', 'per_click'].includes(rule.type) && (
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Rate ($)</label>
            <input
              type="number"
              value={rule.rate || ''}
              onChange={(e) => update({ rate: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              step="0.01"
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        )}

        {rule.type === 'revenue_share' && (
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Percentage (%)</label>
            <input
              type="number"
              value={rule.percentage || ''}
              onChange={(e) => update({ percentage: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        )}

        {/* Milestone threshold */}
        {(rule.type === 'milestone_views' || rule.type === 'milestone_videos') && (
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">
              {rule.type === 'milestone_views' ? 'View Threshold' : 'Video Count'}
            </label>
            <input
              type="number"
              value={rule.milestoneThreshold || ''}
              onChange={(e) => update({ milestoneThreshold: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        )}

        {/* View range for tiered */}
        {rule.type === 'tiered_views' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Min Views</label>
              <input
                type="number"
                value={rule.minViews || ''}
                onChange={(e) => update({ minViews: parseInt(e.target.value) || 0 })}
                placeholder="0"
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Max Views</label>
              <input
                type="number"
                value={rule.maxViews || ''}
                onChange={(e) => update({ maxViews: parseInt(e.target.value) || undefined })}
                placeholder="∞"
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
          </div>
        )}

        {/* Minimum views requirement */}
        {['flat_fee', 'cpm', 'per_view'].includes(rule.type) && (
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Min Views Required (optional)</label>
            <input
              type="number"
              value={rule.minViews || ''}
              onChange={(e) => update({ minViews: parseInt(e.target.value) || undefined })}
              placeholder="No minimum"
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        )}

        {/* Upfront condition */}
        {rule.type === 'flat_upfront' && (
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Videos Required (optional)</label>
            <input
              type="number"
              value={rule.upfrontCondition?.videosRequired || ''}
              onChange={(e) => update({ 
                upfrontCondition: { 
                  ...rule.upfrontCondition, 
                  videosRequired: parseInt(e.target.value) || undefined 
                } 
              })}
              placeholder="No requirement"
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Existing Rules */}
      {rules.map((rule) => {
        const ruleType = RULE_TYPES.find(t => t.value === rule.type);
        
        return (
          <div
            key={rule.id}
            className={clsx(
              "border rounded-lg p-3 transition-all",
              rule.enabled
                ? "bg-white/5 border-white/10"
                : "bg-gray-800/30 border-gray-700/30 opacity-60"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                <div className={clsx(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  rule.enabled ? "bg-white/10 text-white" : "bg-gray-700/50 text-gray-500"
                )}>
                  {ruleType?.icon}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <h4 className="text-sm font-medium text-white">{ruleType?.label}</h4>
                    <p className="text-xs text-gray-400">{rule.description || ruleType?.description}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className={clsx(
                        "px-2 py-1 rounded text-xs font-medium transition-colors",
                        rule.enabled
                          ? "bg-white/10 text-white hover:bg-white/20"
                          : "bg-gray-700/50 text-gray-400 hover:bg-gray-700"
                      )}
                    >
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {renderRuleForm(rule)}
              </div>
            </div>
          </div>
        );
      })}

      {/* Add Rule Button */}
      {!showAddRule ? (
        <button
          onClick={() => setShowAddRule(true)}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-lg transition-all flex items-center justify-center gap-2 text-white font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Payment Rule
        </button>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-white mb-2">Select Rule Type</h4>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {RULE_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setNewRuleType(type.value)}
                className={clsx(
                  "p-3 rounded-lg border-2 transition-all text-left",
                  newRuleType === type.value
                    ? "bg-white/10 border-white/50"
                    : "bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded flex items-center justify-center bg-white/10">
                    {type.icon}
                  </div>
                  <span className="text-xs font-medium text-white">{type.label}</span>
                </div>
                <p className="text-xs text-gray-400">{type.description}</p>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddRule}
              className="flex-1 px-4 py-2 bg-white/90 hover:bg-white text-gray-900 rounded-lg font-medium text-sm transition-colors"
            >
              Add Rule
            </button>
            <button
              onClick={() => setShowAddRule(false)}
              className="flex-1 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 && !showAddRule && (
        <div className="text-center py-6 text-gray-400 text-sm">
          No payment rules yet. Add your first rule to start calculating earnings.
        </div>
      )}
    </div>
  );
};

export default PaymentRuleBuilder;

