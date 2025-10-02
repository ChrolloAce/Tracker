import { useState, useEffect, useCallback } from 'react';
import { Plus, Filter, Trash2, Edit2, CheckCircle, XCircle } from 'lucide-react';
import { TrackingRule, RuleCondition, RuleConditionType } from '../types/rules';
import { TrackedAccount } from '../types/accounts';
import RulesService from '../services/RulesService';
import { AccountTrackingServiceFirebase } from '../services/AccountTrackingServiceFirebase';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { Modal } from './ui/Modal';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';

const RulesPage = () => {
  const { currentOrgId, currentProjectId, user } = useAuth();
  const [rules, setRules] = useState<TrackingRule[]>([]);
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TrackingRule | null>(null);

  // Form state
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<('instagram' | 'tiktok' | 'youtube')[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Load rules and accounts
  useEffect(() => {
    const loadData = async () => {
      if (!currentOrgId || !currentProjectId) return;
      
      setLoading(true);
      try {
        const [loadedRules, loadedAccounts] = await Promise.all([
          RulesService.getRules(currentOrgId, currentProjectId),
          AccountTrackingServiceFirebase.getTrackedAccounts(currentOrgId, currentProjectId)
        ]);
        setRules(loadedRules);
        setAccounts(loadedAccounts);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentOrgId, currentProjectId]);

  const handleOpenCreate = useCallback(() => {
    setEditingRule(null);
    setRuleName('');
    setRuleDescription('');
    setConditions([{
      id: crypto.randomUUID(),
      type: 'description_contains',
      value: '',
      operator: 'AND'
    }]);
    setSelectedPlatforms([]);
    setSelectedAccounts([]);
    setIsActive(true);
    setIsCreateModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((rule: TrackingRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setRuleDescription(rule.description || '');
    setConditions(rule.conditions.length > 0 ? rule.conditions : [{
      id: crypto.randomUUID(),
      type: 'description_contains',
      value: '',
      operator: 'AND'
    }]);
    setSelectedPlatforms(rule.appliesTo.platforms || []);
    setSelectedAccounts(rule.appliesTo.accountIds || []);
    setIsActive(rule.isActive);
    setIsCreateModalOpen(true);
  }, []);

  const handleSaveRule = useCallback(async () => {
    if (!currentOrgId || !currentProjectId || !user) return;
    if (!ruleName.trim() || conditions.length === 0) {
      alert('Please provide a rule name and at least one condition');
      return;
    }

    try {
      const ruleData = {
        name: ruleName.trim(),
        description: ruleDescription.trim(),
        conditions: conditions.filter(c => c.value !== ''),
        isActive,
        appliesTo: {
          platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
          accountIds: selectedAccounts.length > 0 ? selectedAccounts : undefined,
        },
      };

      if (editingRule) {
        await RulesService.updateRule(currentOrgId, currentProjectId, editingRule.id, ruleData);
      } else {
        await RulesService.createRule(currentOrgId, currentProjectId, user.uid, ruleData);
      }

      // Reload rules
      const updatedRules = await RulesService.getRules(currentOrgId, currentProjectId);
      setRules(updatedRules);
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('Failed to save rule:', error);
      alert('Failed to save rule. Please try again.');
    }
  }, [currentOrgId, currentProjectId, user, ruleName, ruleDescription, conditions, isActive, selectedPlatforms, selectedAccounts, editingRule]);

  const handleDeleteRule = useCallback(async (ruleId: string) => {
    if (!currentOrgId || !currentProjectId) return;
    if (!window.confirm('Are you sure you want to delete this rule?')) return;

    try {
      await RulesService.deleteRule(currentOrgId, currentProjectId, ruleId);
      setRules(prev => prev.filter(r => r.id !== ruleId));
    } catch (error) {
      console.error('Failed to delete rule:', error);
      alert('Failed to delete rule');
    }
  }, [currentOrgId, currentProjectId]);

  const handleToggleActive = useCallback(async (ruleId: string, currentActive: boolean) => {
    if (!currentOrgId || !currentProjectId) return;

    try {
      await RulesService.updateRule(currentOrgId, currentProjectId, ruleId, {
        isActive: !currentActive,
      });
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isActive: !currentActive } : r));
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  }, [currentOrgId, currentProjectId]);

  const addCondition = useCallback(() => {
    setConditions(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'description_contains',
      value: '',
      operator: 'AND'
    }]);
  }, []);

  const removeCondition = useCallback((id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateCondition = useCallback((id: string, field: keyof RuleCondition, value: any) => {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }, []);

  if (loading) {
    return <PageLoadingSkeleton type="dashboard" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tracking Rules</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Define rules to filter which videos are tracked from your accounts
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Rule
        </button>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Rules Yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Create your first tracking rule to filter videos based on tags, views, engagement, and more
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create First Rule
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {rules.map(rule => (
            <div
              key={rule.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{rule.name}</h3>
                    <button
                      onClick={() => handleToggleActive(rule.id, rule.isActive)}
                      className={clsx(
                        'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors',
                        rule.isActive
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      )}
                    >
                      {rule.isActive ? (
                        <><CheckCircle className="w-3 h-3" /> Active</>
                      ) : (
                        <><XCircle className="w-3 h-3" /> Inactive</>
                      )}
                    </button>
                  </div>
                  {rule.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{rule.description}</p>
                  )}
                  
                  {/* Conditions */}
                  <div className="space-y-2">
                    {rule.conditions.map((condition, index) => (
                      <div key={condition.id} className="flex items-center gap-2 text-sm">
                        {index > 0 && (
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                            {rule.conditions[index - 1].operator || 'AND'}
                          </span>
                        )}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <Filter className="w-3 h-3 text-gray-400" />
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {RulesService.getConditionTypeLabel(condition.type)}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">:</span>
                          <span className="font-mono text-gray-900 dark:text-white">
                            {String(condition.value)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Platforms */}
                  {rule.appliesTo.platforms && rule.appliesTo.platforms.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Platforms:</span>
                      {rule.appliesTo.platforms.map(platform => (
                        <span
                          key={platform}
                          className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs font-medium capitalize"
                        >
                          {platform}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Accounts */}
                  {rule.appliesTo.accountIds && rule.appliesTo.accountIds.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Accounts:</span>
                      <div className="flex flex-wrap gap-1">
                        {rule.appliesTo.accountIds.map(accountId => {
                          const account = accounts.find(a => a.id === accountId);
                          return account ? (
                            <span
                              key={accountId}
                              className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium"
                            >
                              @{account.username}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleOpenEdit(rule)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingRule ? 'Edit Rule' : 'Create Tracking Rule'}
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
          {/* Rule Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Rule Name
            </label>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="e.g., Track Snapout.co tagged posts"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Description (optional)
            </label>
            <textarea
              value={ruleDescription}
              onChange={(e) => setRuleDescription(e.target.value)}
              placeholder="Describe when this rule should apply..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Apply to Platforms (leave empty for all)
            </label>
            <div className="flex gap-2">
              {(['instagram', 'tiktok', 'youtube'] as const).map(platform => (
                <button
                  key={platform}
                  onClick={() => {
                    setSelectedPlatforms(prev => 
                      prev.includes(platform) 
                        ? prev.filter(p => p !== platform)
                        : [...prev, platform]
                    );
                  }}
                  className={clsx(
                    'px-4 py-2 rounded-lg border-2 transition-colors capitalize',
                    selectedPlatforms.includes(platform)
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                  )}
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>

          {/* Specific Accounts */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Apply to Specific Accounts (leave empty for all)
            </label>
            <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-700 rounded-lg p-2 space-y-1">
              {accounts.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 p-2">No tracked accounts yet</p>
              ) : (
                accounts.map(account => (
                  <label
                    key={account.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAccounts.includes(account.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAccounts(prev => [...prev, account.id]);
                        } else {
                          setSelectedAccounts(prev => prev.filter(id => id !== account.id));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">
                      @{account.username}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      ({account.platform})
                    </span>
                  </label>
                ))
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Rule will only apply to selected accounts. Leave empty to apply to all accounts.
            </p>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white">
                Conditions
              </label>
              <button
                onClick={addCondition}
                className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Condition
              </button>
            </div>

            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div key={condition.id} className="space-y-2">
                  {index > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={conditions[index - 1].operator || 'AND'}
                        onChange={(e) => updateCondition(conditions[index - 1].id, 'operator', e.target.value as 'AND' | 'OR')}
                        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                    </div>
                  )}
                  
                  <div className="flex gap-2 items-start p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                    <select
                      value={condition.type}
                      onChange={(e) => updateCondition(condition.id, 'type', e.target.value as RuleConditionType)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="description_contains">Description contains</option>
                      <option value="description_not_contains">Description does not contain</option>
                      <option value="hashtag_includes">Hashtag includes</option>
                      <option value="hashtag_not_includes">Hashtag does not include</option>
                      <option value="views_greater_than">Views greater than</option>
                      <option value="views_less_than">Views less than</option>
                      <option value="likes_greater_than">Likes greater than</option>
                      <option value="engagement_rate_greater_than">Engagement rate &gt;</option>
                      <option value="posted_after_date">Posted after date</option>
                      <option value="posted_before_date">Posted before date</option>
                    </select>

                    <input
                      type={
                        condition.type.includes('date') ? 'date' :
                        condition.type.includes('greater') || condition.type.includes('less') ? 'number' :
                        'text'
                      }
                      value={condition.value}
                      onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                      placeholder={
                        condition.type.includes('description') ? 'e.g., @snapout.co' :
                        condition.type.includes('hashtag') ? 'e.g., ad or #ad' :
                        condition.type.includes('views') ? 'e.g., 10000' :
                        'Value'
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />

                    {conditions.length > 1 && (
                      <button
                        onClick={() => removeCondition(condition.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="rule-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="rule-active" className="text-sm text-gray-700 dark:text-gray-300">
              Activate this rule immediately
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRule}
              disabled={!ruleName.trim() || conditions.filter(c => c.value !== '').length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RulesPage;

