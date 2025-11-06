import React, { useState, useEffect } from 'react';
import { Plus, DollarSign, CheckCircle, XCircle, Clock, Trash2, RefreshCw, Download, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AppleAppStoreWizard, { AppleAppStoreCredentials } from './AppleAppStoreWizard';
import RevenueDataService from '../services/RevenueDataService';
import { RevenueIntegration } from '../types/revenue';
import { formatDistanceToNow } from 'date-fns';

const RevenueManagementPage: React.FC = () => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [activeTab, setActiveTab] = useState<'connections' | 'analytics'>('connections');
  const [showWizard, setShowWizard] = useState(false);
  const [integrations, setIntegrations] = useState<RevenueIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadIntegrations();
  }, [currentOrgId, currentProjectId]);

  const loadIntegrations = async () => {
    if (!currentOrgId || !currentProjectId) return;

    try {
      setLoading(true);
      const allIntegrations = await RevenueDataService.getAllIntegrations(currentOrgId, currentProjectId);
      setIntegrations(allIntegrations);
    } catch (error) {
      console.error('Failed to load integrations:', error);
      setErrorMessage('Failed to load revenue connections');
    } finally {
      setLoading(false);
    }
  };

  const handleWizardComplete = async (credentials: AppleAppStoreCredentials) => {
    if (!currentOrgId || !currentProjectId) {
      throw new Error('Organization or project not found');
    }

    try {
      setErrorMessage(null);
      
      // Check if Apple integration already exists
      const existingIntegration = await RevenueDataService.getIntegration(
        currentOrgId,
        currentProjectId,
        'apple'
      );

      if (existingIntegration) {
        throw new Error('Apple App Store Connect is already connected. Please remove the existing connection first.');
      }
      
      console.log('✅ Saving Apple App Store credentials (private key is encrypted):', {
        issuerID: credentials.issuerID,
        keyID: credentials.keyID,
        vendorNumber: credentials.vendorNumber,
        privateKeyFileName: credentials.privateKeyFileName,
        privateKeyLength: credentials.privateKey.length,
        isEncrypted: true
      });
      
      // Save encrypted credentials to Firestore
      const integrationId = await RevenueDataService.saveIntegration(
        currentOrgId,
        currentProjectId,
        'apple',
        {
          issuerId: credentials.issuerID,
          keyId: credentials.keyID,
          vendorNumber: credentials.vendorNumber,
          apiKey: credentials.privateKey, // Encrypted .p8 key stored as apiKey
        },
        {
          autoSync: true,
          syncInterval: 1440, // 24 hours in minutes
          currency: 'USD',
          timezone: 'UTC',
        }
      );
      
      console.log('✅ Integration saved successfully:', integrationId);
      
      // Close wizard
      setShowWizard(false);
      
      // Show success message
      setSuccessMessage('Apple App Store Connect integration added successfully!');
      setTimeout(() => setSuccessMessage(null), 5000);
      
      // Refresh connections list
      await loadIntegrations();
    } catch (error: any) {
      console.error('Failed to save credentials:', error);
      setErrorMessage(error.message || 'Failed to save Apple App Store credentials');
      throw error;
    }
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    if (!currentOrgId || !currentProjectId) return;
    
    if (!confirm('Are you sure you want to remove this revenue connection? This cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(integrationId);
      setErrorMessage(null);

      await RevenueDataService.deleteIntegration(currentOrgId, currentProjectId, integrationId);
      
      setSuccessMessage('Revenue connection removed successfully');
      setTimeout(() => setSuccessMessage(null), 5000);
      
      // Refresh list
      await loadIntegrations();
    } catch (error: any) {
      console.error('Failed to delete integration:', error);
      setErrorMessage(error.message || 'Failed to remove connection');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSyncRevenue = async () => {
    if (!currentOrgId || !currentProjectId) return;

    try {
      setSyncing(true);
      setErrorMessage(null);

      console.log('🔄 Triggering manual revenue sync...');

      const response = await fetch('/api/sync-apple-revenue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: currentOrgId,
          projectId: currentProjectId,
          manual: true
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync revenue');
      }

      console.log('✅ Revenue sync completed:', data);

      setSuccessMessage(`Revenue sync completed! ${data.data?.recordCount || 0} records processed.`);
      setTimeout(() => setSuccessMessage(null), 5000);

      // Refresh integrations to show updated lastSynced time
      await loadIntegrations();

    } catch (error: any) {
      console.error('Failed to sync revenue:', error);
      setErrorMessage(error.message || 'Failed to sync revenue data');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Revenue</h1>
        <p className="text-white/60">Connect app stores and track revenue data</p>
      </div>

      {/* Tabs and Add Button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex space-x-1 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('connections')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'connections'
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Connections
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'analytics'
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Analytics
          </button>
        </div>

        <button 
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-white/90 text-black rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Connection
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-emerald-300 text-sm">{successMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Connections Tab Content */}
      {activeTab === 'connections' && (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full"></div>
          </div>
        ) : integrations.length === 0 ? (
          <>
            {/* Empty State */}
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                <DollarSign className="w-8 h-8 text-white/40" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No revenue connections yet</h3>
              <p className="text-white/60 text-center max-w-md mb-6">
                Connect your app store accounts to sync revenue data automatically.
              </p>

              {/* Setup Instructions */}
              <div className="text-center max-w-2xl space-y-2">
                <p className="text-sm text-white/50">
                  Connect Apple App Store Connect or Google Play Console to track your app revenue.
                </p>
                <p className="text-sm text-white/50">
                  Revenue data will sync automatically every 24 hours once connected.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Table Header */}
            <div className="bg-white/5 border-b border-white/10 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Provider</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Issuer ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Key ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Vendor #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Last Sync</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Connected</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-white/60 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {integrations.map((integration) => (
                    <tr key={integration.id} className="hover:bg-white/5 transition-colors">
                      {/* Provider */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                            <svg viewBox="0 0 814 1000" className="w-6 h-6" fill="currentColor">
                              <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">Apple App Store</div>
                            <div className="text-xs text-white/50">App Store Connect API</div>
                          </div>
                        </div>
                      </td>

                      {/* Issuer ID */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-white/70 font-mono">
                          {integration.credentials.issuerId?.slice(0, 8)}...
                        </span>
                      </td>

                      {/* Key ID */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-white/70 font-mono">
                          {integration.credentials.keyId}
                        </span>
                      </td>

                      {/* Vendor Number */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-white/70 font-mono">
                          {integration.credentials.vendorNumber}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {integration.enabled ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-300 border border-gray-500/30">
                            <XCircle className="w-3 h-3" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Last Sync */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-white/40" />
                          <span className="text-sm text-white/70">
                            {integration.lastSynced
                              ? formatDistanceToNow(integration.lastSynced, { addSuffix: true })
                              : 'Never'
                            }
                          </span>
                        </div>
                      </td>

                      {/* Connected At */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-white/70">
                          {formatDistanceToNow(integration.createdAt, { addSuffix: true })}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteIntegration(integration.id)}
                          disabled={deletingId === integration.id}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove connection"
                        >
                          {deletingId === integration.id ? (
                            <div className="animate-spin w-4 h-4 border-2 border-red-400/20 border-t-red-400 rounded-full" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="bg-white/5 border-t border-white/10 px-6 py-3 flex items-center justify-between">
              <div className="text-sm text-white/60">
                {integrations.length} {integrations.length === 1 ? 'connection' : 'connections'}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-white/60">Page 1 of 1</span>
              </div>
            </div>
          </>
        )}
        </div>
      )}

      {/* Analytics Tab Content */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Revenue Analytics */}
          {integrations.length > 0 ? (
            <>
              {/* Manual Sync */}
              <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-2">Revenue Data Sync</h4>
                    <p className="text-white/60 text-sm">
                      Last synced: {integrations[0]?.lastSynced 
                        ? formatDistanceToNow(integrations[0].lastSynced, { addSuffix: true })
                        : 'Never'
                      }
                    </p>
                  </div>
                  <button
                    onClick={handleSyncRevenue}
                    disabled={syncing}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                </div>
              </div>

              {/* Coming Soon: Revenue analytics dashboard will appear here */}
              <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
                <TrendingUp className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Revenue Analytics</h3>
                <p className="text-white/60 text-sm">
                  Revenue charts and transaction history will appear here once data is synced
                </p>
              </div>
            </>
          ) : (
            <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
              <DollarSign className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Revenue Connections</h3>
              <p className="text-white/60 text-sm mb-6">
                Connect your app store to start tracking revenue
              </p>
              <button
                onClick={() => setActiveTab('connections')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Connection
              </button>
            </div>
          )}
        </div>
      )}

      {/* Apple App Store Wizard */}
      {showWizard && (
        <AppleAppStoreWizard
          onClose={() => setShowWizard(false)}
          onComplete={handleWizardComplete}
        />
      )}
    </div>
  );
};

export default RevenueManagementPage;

