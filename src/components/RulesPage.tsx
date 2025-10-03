import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Plus, Filter, Trash2, Edit2, CheckCircle, XCircle } from 'lucide-react';
import { TrackingRule, RuleCondition, RuleConditionType } from '../types/rules';
import { TrackedAccount } from '../types/accounts';
import RulesService from '../services/RulesService';
import { AccountTrackingServiceFirebase } from '../services/AccountTrackingServiceFirebase';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { Modal } from './ui/Modal';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';

export interface RulesPageRef {
  openCreateModal: () => void;
}

const RulesPage = forwardRef<RulesPageRef, {}>((props, ref) => {
  const { currentOrgId, currentProjectId, user } = useAuth();
  const [rules, setRules] = useState<TrackingRule[]>([]);
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TrackingRule | null>(null);

  // Form state
  const [ruleName, setRuleName] = useState('');
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Expose openCreateModal to parent component
  useImperativeHandle(ref, () => ({
    openCreateModal: handleOpenCreate
  }), [handleOpenCreate]);

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
    setConditions([{
      id: crypto.randomUUID(),
      type: 'description_contains',
      value: '',
      operator: 'AND'
    }]);
    setSelectedAccounts([]);
    setIsActive(true);
    setIsCreateModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((rule: TrackingRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setConditions(rule.conditions.length > 0 ? rule.conditions : [{
      id: crypto.randomUUID(),
      type: 'description_contains',
      value: '',
      operator: 'AND'
    }]);
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
        description: '',
        conditions: conditions.filter(c => c.value !== ''),
        isActive,
        appliesTo: {
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
  }, [currentOrgId, currentProjectId, user, ruleName, conditions, isActive, selectedAccounts, editingRule]);

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
      {/* Rules Table - Matching Accounts Style */}
      {rules.length === 0 ? (
        <div className="text-center py-12 bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl border border-white/10">
          <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Rules Yet</h3>
          <p className="text-gray-400 mb-4">
            Create your first tracking rule to filter videos
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
        <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Rule Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Conditions
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Applies To
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{rule.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {rule.conditions.map((condition, index) => (
                        <div key={condition.id} className="flex items-center gap-2 text-sm">
                          {index > 0 && (
                            <span className="text-xs font-semibold text-blue-400">
                              {rule.conditions[index - 1].operator || 'AND'}
                            </span>
                          )}
                          <div className="flex items-center gap-2 px-2 py-1 bg-gray-800/50 rounded text-xs">
                            <span className="text-gray-400">
                              {RulesService.getConditionTypeLabel(condition.type)}:
                            </span>
                            <span className="font-mono text-white">
                              {String(condition.value)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {rule.appliesTo.accountIds && rule.appliesTo.accountIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {rule.appliesTo.accountIds.slice(0, 3).map(accountId => {
                          const account = accounts.find(a => a.id === accountId);
                          return account ? (
                            <span
                              key={accountId}
                              className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs"
                            >
                              @{account.username}
                            </span>
                          ) : null;
                        })}
                        {rule.appliesTo.accountIds.length > 3 && (
                          <span className="px-2 py-1 bg-gray-800 text-gray-400 rounded text-xs">
                            +{rule.appliesTo.accountIds.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">All accounts</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(rule.id, rule.isActive)}
                      className={clsx(
                        'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors',
                        rule.isActive
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-gray-800 text-gray-400'
                      )}
                    >
                      {rule.isActive ? (
                        <><CheckCircle className="w-3 h-3" /> Active</>
                      ) : (
                        <><XCircle className="w-3 h-3" /> Inactive</>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(rule)}
                        className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="Edit rule"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Delete rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal - Dark Theme */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingRule ? 'Edit Rule' : 'Create Tracking Rule'}
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
          {/* Rule Name */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Rule Name
            </label>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="e.g., Track Snapout.co tagged posts"
              className="w-full px-4 py-3 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-white">
                Conditions
              </label>
              <button
                onClick={addCondition}
                className="flex items-center gap-1 px-3 py-1 text-sm text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
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
                        className="px-3 py-1 text-sm border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                    </div>
                  )}
                  
                  <div className="flex gap-2 items-start p-3 border border-gray-700 rounded-lg bg-gray-800/50">
                    <select
                      value={condition.type}
                      onChange={(e) => updateCondition(condition.id, 'type', e.target.value as RuleConditionType)}
                      className="flex-1 px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                      className="flex-1 px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />

                    {conditions.length > 1 && (
                      <button
                        onClick={() => removeCondition(condition.id)}
                        className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Apply to Accounts */}
          <div>
            <label className="block text-sm font-semibold text-white mb-3">
              Apply to Accounts
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto p-3 border border-gray-700 rounded-lg bg-gray-800/50">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-700">
                <input
                  type="checkbox"
                  id="all-accounts"
                  checked={selectedAccounts.length === 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedAccounts([]);
                    }
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="all-accounts" className="text-sm font-medium text-white">
                  All Accounts (Default)
                </label>
              </div>
              
              {accounts.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No accounts available. Add accounts first.</p>
              ) : (
                accounts.map((account) => (
                  <div key={account.id} className="flex items-center gap-2 p-2 hover:bg-gray-700/50 rounded">
                    <input
                      type="checkbox"
                      id={`account-${account.id}`}
                      checked={selectedAccounts.includes(account.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAccounts(prev => [...prev, account.id]);
                        } else {
                          setSelectedAccounts(prev => prev.filter(id => id !== account.id));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <label htmlFor={`account-${account.id}`} className="flex items-center gap-2 text-sm text-white cursor-pointer flex-1">
                      <span className="font-medium">@{account.username}</span>
                      <span className="text-xs text-gray-400 capitalize">({account.platform})</span>
                    </label>
                  </div>
                ))
              )}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {selectedAccounts.length === 0 
                ? 'This rule will apply to all accounts in this project'
                : `This rule will apply to ${selectedAccounts.length} selected account${selectedAccounts.length > 1 ? 's' : ''}`
              }
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="flex-1 px-4 py-2 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
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
});

RulesPage.displayName = 'RulesPage';

export default RulesPage;
