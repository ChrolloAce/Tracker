/**
 * Revenue Integrations Settings Component
 * Allows users to configure RevenueCat and Superwall integrations
 */

import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { RevenueIntegration, RevenueProvider } from '../types/revenue';
import RevenueDataService from '../services/RevenueDataService';

interface RevenueIntegrationsSettingsProps {
  organizationId: string;
  projectId: string;
}

export const RevenueIntegrationsSettings: React.FC<RevenueIntegrationsSettingsProps> = ({
  organizationId,
  projectId,
}) => {
  const [integrations, setIntegrations] = useState<RevenueIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Load integrations on mount
  useEffect(() => {
    loadIntegrations();
  }, [organizationId, projectId]);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const data = await RevenueDataService.getAllIntegrations(organizationId, projectId);
      setIntegrations(data);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days

      const result = await RevenueDataService.syncAllIntegrations(
        organizationId,
        projectId,
        startDate,
        endDate
      );

      if (result.success) {
        alert(`✅ Synced revenue data!\n${result.results.map(r => 
          `${r.provider}: ${r.count} transactions, $${(r.revenue / 100).toFixed(2)}`
        ).join('\n')}`);
        await loadIntegrations();
      } else {
        alert('❌ No integrations synced. Please check your configuration.');
      }
    } catch (error) {
      console.error('Sync failed:', error);
      alert('❌ Failed to sync revenue data. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (integrationId: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) {
      return;
    }

    try {
      await RevenueDataService.deleteIntegration(organizationId, projectId, integrationId);
      await loadIntegrations();
    } catch (error) {
      console.error('Failed to delete integration:', error);
      alert('❌ Failed to delete integration');
    }
  };

  const handleToggleEnabled = async (integrationId: string, enabled: boolean) => {
    try {
      await RevenueDataService.updateIntegration(organizationId, projectId, integrationId, {
        enabled,
      });
      await loadIntegrations();
    } catch (error) {
      console.error('Failed to update integration:', error);
    }
  };

  const getProviderLogo = (_provider: RevenueProvider) => {
    return (
      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
        <DollarSign className="w-5 h-5 text-emerald-400" />
      </div>
    );
  };

  const getProviderName = (provider: RevenueProvider) => {
    const names: Record<RevenueProvider, string> = {
      revenuecat: 'RevenueCat',
      superwall: 'Superwall',
      stripe: 'Stripe',
      manual: 'Manual Entry',
    };
    return names[provider];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Revenue Integrations</h3>
          <p className="text-sm text-gray-400 mt-1">
            Connect your revenue sources to track performance alongside video metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncAll}
            disabled={syncing || integrations.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync All
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Integration
          </button>
        </div>
      </div>

      {/* Integrations List */}
      {integrations.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-lg p-8 text-center">
          <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-white mb-2">No revenue integrations yet</h4>
          <p className="text-sm text-gray-400 mb-4">
            Connect RevenueCat or Superwall to start tracking revenue alongside your video performance
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Your First Integration
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/[0.07] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {getProviderLogo(integration.provider)}
                  <div>
                    <h4 className="text-base font-semibold text-white">
                      {getProviderName(integration.provider)}
                    </h4>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {integration.lastSynced 
                        ? `Last synced ${new Date(integration.lastSynced).toLocaleDateString()}`
                        : 'Never synced'
                      }
                    </p>
                  </div>
                  {integration.enabled ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Active</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-500/10 text-gray-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Disabled</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggleEnabled(integration.id, !integration.enabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      integration.enabled ? 'bg-emerald-500' : 'bg-gray-600'
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        integration.enabled ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(integration.id)}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete integration"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Settings Preview */}
              {integration.settings && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Auto Sync</p>
                      <p className="text-white font-medium mt-1">
                        {integration.settings.autoSync ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Sync Interval</p>
                      <p className="text-white font-medium mt-1">
                        {integration.settings.syncInterval || 60} minutes
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Currency</p>
                      <p className="text-white font-medium mt-1">
                        {integration.settings.currency || 'USD'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Integration Modal */}
      {showAddModal && (
        <AddIntegrationModal
          organizationId={organizationId}
          projectId={projectId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadIntegrations();
          }}
        />
      )}
    </div>
  );
};

// Add Integration Modal Component
interface AddIntegrationModalProps {
  organizationId: string;
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const AddIntegrationModal: React.FC<AddIntegrationModalProps> = ({
  organizationId,
  projectId,
  onClose,
  onSuccess,
}) => {
  const [provider, setProvider] = useState<RevenueProvider>('revenuecat');
  const [apiKey, setApiKey] = useState('');
  const [appId, setAppId] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      const result = await RevenueDataService.testIntegration(provider, {
        apiKey,
        appId: provider === 'superwall' ? appId : undefined,
      });

      setTestResult(result ? 'success' : 'error');
    } catch (error) {
      console.error('Test failed:', error);
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey) {
      alert('Please enter an API key');
      return;
    }

    if (provider === 'superwall' && !appId) {
      alert('Please enter an App ID for Superwall');
      return;
    }

    try {
      setSaving(true);

      await RevenueDataService.saveIntegration(
        organizationId,
        projectId,
        provider,
        {
          apiKey,
          appId: provider === 'superwall' ? appId : undefined,
        }
      );

      onSuccess();
    } catch (error) {
      console.error('Failed to save integration:', error);
      alert('❌ Failed to save integration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Add Revenue Integration</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Revenue Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as RevenueProvider)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="revenuecat">RevenueCat</option>
              <option value="superwall">Superwall</option>
            </select>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Key *
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
                className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/5 rounded transition-colors"
              >
                {showApiKey ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* App ID (Superwall only) */}
          {provider === 'superwall' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                App ID *
              </label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="Enter your Superwall App ID"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Test Connection */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTest}
              disabled={testing || !apiKey || (provider === 'superwall' && !appId)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              Test Connection
            </button>
            {testResult && (
              <div className={`flex items-center gap-2 text-sm ${
                testResult === 'success' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {testResult === 'success' ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Connection successful!</span>
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" />
                    <span>Connection failed</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Help Text */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              {provider === 'revenuecat' && (
                <>
                  Find your API key in RevenueCat dashboard under <strong>Settings → API Keys</strong>
                </>
              )}
              {provider === 'superwall' && (
                <>
                  Find your API key and App ID in Superwall dashboard under <strong>Settings → API</strong>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !apiKey || (provider === 'superwall' && !appId)}
            className="px-6 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Integration'}
          </button>
        </div>
      </div>
    </div>
  );
};

