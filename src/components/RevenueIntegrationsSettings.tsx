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
  Copy,
  Link as LinkIcon,
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
  const [copiedWebhookId, setCopiedWebhookId] = useState<string | null>(null);

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

  /**
   * Generate webhook URL for an integration
   */
  const getWebhookUrl = (integration: RevenueIntegration): string | null => {
    // Only Superwall and RevenueCat support webhooks for now
    if (integration.provider !== 'superwall' && integration.provider !== 'revenuecat') {
      return null;
    }

    const baseUrl = window.location.origin;
    const webhookPath = integration.provider === 'superwall' ? 'superwall-webhook' : 'revenuecat-webhook';
    
    return `${baseUrl}/api/${webhookPath}?orgId=${organizationId}&projectId=${projectId}`;
  };

  /**
   * Copy webhook URL to clipboard
   */
  const copyWebhookUrl = async (integration: RevenueIntegration) => {
    const webhookUrl = getWebhookUrl(integration);
    if (!webhookUrl) return;

    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhookId(integration.id);
      setTimeout(() => setCopiedWebhookId(null), 2000);
    } catch (error) {
      console.error('Failed to copy webhook URL:', error);
      alert('Failed to copy URL');
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
      apple: 'Apple App Store',
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

              {/* Webhook URL */}
              {getWebhookUrl(integration) && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <LinkIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm font-medium text-white">Webhook URL</p>
                        <div className="px-2 py-0.5 bg-blue-500/10 rounded-full">
                          <span className="text-xs font-medium text-blue-400">Real-time Events</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mb-3">
                        Configure this URL in your {getProviderName(integration.provider)} dashboard to receive real-time transaction events
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 px-3 py-2 bg-black/20 border border-white/10 rounded-lg overflow-hidden">
                          <p className="text-xs text-gray-300 font-mono truncate">
                            {getWebhookUrl(integration)}
                          </p>
                        </div>
                        <button
                          onClick={() => copyWebhookUrl(integration)}
                          className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium whitespace-nowrap"
                        >
                          {copiedWebhookId === integration.id ? (
                            <>
                              <Check className="w-4 h-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy URL
                            </>
                          )}
                        </button>
                      </div>
                      <div className="mt-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                        <p className="text-xs text-amber-400 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            Add this webhook URL to your {getProviderName(integration.provider)} dashboard to receive instant updates when transactions occur. No manual syncing needed!
                          </span>
                        </p>
                      </div>
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
  const [keyId, setKeyId] = useState(''); // For Apple
  const [issuerId, setIssuerId] = useState(''); // For Apple
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>(''); // Track uploaded file name
  const [webhookCopied, setWebhookCopied] = useState(false);

  // Handle .p8 file upload for Apple
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file extension
    if (!file.name.endsWith('.p8')) {
      alert('❌ Please upload a .p8 file from Apple');
      return;
    }

    try {
      // Read the file
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        
        // Convert to base64
        const base64 = btoa(content);
        setApiKey(base64);
        setUploadedFileName(file.name);
        
        // Extract Key ID from filename if it matches Apple's format
        // AuthKey_XXXXXXXXXX.p8 -> XXXXXXXXXX
        const match = file.name.match(/AuthKey_([A-Z0-9]+)\.p8/);
        if (match && match[1] && !keyId) {
          setKeyId(match[1]);
        }
      };
      reader.onerror = () => {
        alert('❌ Failed to read file. Please try again.');
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('File upload error:', error);
      alert('❌ Failed to process file');
    }
  };

  /**
   * Generate webhook URL for this provider
   */
  const getWebhookUrl = (): string | null => {
    // Only Superwall and RevenueCat support webhooks
    if (provider !== 'superwall' && provider !== 'revenuecat') {
      return null;
    }

    const baseUrl = window.location.origin;
    const webhookPath = provider === 'superwall' ? 'superwall-webhook' : 'revenuecat-webhook';
    
    return `${baseUrl}/api/${webhookPath}?orgId=${organizationId}&projectId=${projectId}`;
  };

  /**
   * Copy webhook URL to clipboard
   */
  const copyWebhookUrl = async () => {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) return;

    try {
      await navigator.clipboard.writeText(webhookUrl);
      setWebhookCopied(true);
      setTimeout(() => setWebhookCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy webhook URL:', error);
      alert('Failed to copy URL');
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      const result = await RevenueDataService.testIntegration(provider, {
        apiKey,
        appId: provider === 'apple' ? appId : (provider === 'revenuecat' ? appId : undefined),
        keyId: provider === 'apple' ? keyId : undefined,
        issuerId: provider === 'apple' ? issuerId : undefined,
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
    // Superwall doesn't need any credentials - webhook only!
    if (provider !== 'superwall' && !apiKey) {
      alert('Please enter an API key / Private key');
      return;
    }

    if (provider === 'revenuecat' && !appId) {
      alert('Please enter a Project ID for RevenueCat');
      return;
    }

    if (provider === 'apple') {
      if (!appId) {
        alert('Please enter a Bundle ID for Apple');
        return;
      }
      if (!keyId) {
        alert('Please enter a Key ID for Apple');
        return;
      }
      if (!issuerId) {
        alert('Please enter an Issuer ID for Apple');
        return;
      }
    }

    try {
      setSaving(true);

      await RevenueDataService.saveIntegration(
        organizationId,
        projectId,
        provider,
        {
          apiKey,
          appId: (provider === 'revenuecat' || provider === 'apple') ? appId : undefined,
          keyId: provider === 'apple' ? keyId : undefined,
          issuerId: provider === 'apple' ? issuerId : undefined,
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
              <option value="apple">Apple App Store</option>
            </select>
          </div>

          {/* API Key / Private Key */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {provider === 'apple' ? 'Private Key (.p8 file) *' : 'API Key *'}
            </label>
            
            {/* File Upload for Apple */}
            {provider === 'apple' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept=".p8"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="apple-key-upload"
                    />
                    <div className="w-full px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      {uploadedFileName || 'Upload .p8 Key File'}
                    </div>
                  </label>
                </div>
                {uploadedFileName && (
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <CheckCircle className="w-4 h-4" />
                    <span>Uploaded: {uploadedFileName}</span>
                  </div>
                )}
                <p className="text-xs text-gray-400">
                  Upload the AuthKey_XXXXXXXXXX.p8 file you downloaded from App Store Connect
                </p>
              </div>
            )}

            {/* Regular text input for other providers (not Superwall or Apple) */}
            {provider !== 'apple' && provider !== 'superwall' && (
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
            )}
          </div>

          {/* Superwall: No credentials needed! Just webhook */}
          {provider === 'superwall' && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
              <p className="text-sm text-emerald-300">
                ✨ <strong>No API key needed!</strong> Just copy the webhook URL below and add it to your Superwall dashboard.
              </p>
            </div>
          )}

          {/* Project ID (RevenueCat only) */}
          {provider === 'revenuecat' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Project ID *
              </label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="e.g. proj1ab2c3d4"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="mt-2 text-sm text-gray-400">
                Find this in your RevenueCat dashboard under Project Settings → API keys
              </p>
            </div>
          )}

          {/* Superwall only needs API Key - webhook is auto-generated! */}

          {/* Apple App Store fields */}
          {provider === 'apple' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Key ID *
                </label>
                <input
                  type="text"
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  placeholder="e.g. ZDN6JH8DST"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="mt-2 text-sm text-gray-400">
                  {keyId && uploadedFileName ? 
                    '✓ Auto-filled from your filename' : 
                    'Will be auto-filled when you upload your .p8 file, or enter manually'
                  }
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Issuer ID *
                </label>
                <input
                  type="text"
                  value={issuerId}
                  onChange={(e) => setIssuerId(e.target.value)}
                  placeholder="e.g. 57246542-96fe-1a63-e053-0824d011072a"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="mt-2 text-sm text-gray-400">
                  Find in App Store Connect → Users and Access → Keys (top of page)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bundle ID *
                </label>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="e.g. com.yourcompany.appname"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="mt-2 text-sm text-gray-400">
                  Your app's Bundle ID from App Store Connect
                </p>
              </div>
            </>
          )}

          {/* Test Connection - Not needed for Superwall */}
          {provider !== 'superwall' && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleTest}
                disabled={
                  testing || 
                  !apiKey || 
                  (provider === 'apple' && (!appId || !keyId || !issuerId))
                }
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
          )}

          {/* Webhook URL - Show for Superwall and RevenueCat */}
          {getWebhookUrl() && (
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <LinkIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-sm font-semibold text-white">Your Webhook URL</h4>
                    <div className="px-2 py-0.5 bg-blue-500/20 rounded-full">
                      <span className="text-xs font-medium text-blue-400">Real-time Events</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    Copy this URL and add it to your {provider === 'superwall' ? 'Superwall' : 'RevenueCat'} dashboard to receive real-time transaction events
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 bg-black/30 border border-white/10 rounded-lg overflow-hidden">
                      <p className="text-xs text-gray-300 font-mono truncate">
                        {getWebhookUrl()}
                      </p>
                    </div>
                    <button
                      onClick={copyWebhookUrl}
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium whitespace-nowrap"
                    >
                      {webhookCopied ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  {provider === 'superwall' && (
                    <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-xs text-amber-400 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>Next step:</strong> Go to Superwall Dashboard → Settings → Webhooks → Create Webhook and paste this URL. Select all transaction events.
                        </span>
                      </p>
                    </div>
                  )}
                  {provider === 'revenuecat' && (
                    <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-xs text-amber-400 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>Next step:</strong> Go to RevenueCat Dashboard → Settings → Webhooks → Add Webhook and paste this URL.
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
                  Simply copy the webhook URL above and add it to your Superwall dashboard under <strong>Settings → Webhooks</strong>. Select all transaction events. That's it!
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

