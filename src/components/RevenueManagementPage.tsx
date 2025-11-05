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
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      setSaving(true);
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
    } finally {
      setSaving(false);
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
          {/* Coming Soon Banner */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-8 text-center">
            <TrendingUp className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">Revenue Analytics Coming Soon</h3>
            <p className="text-white/60 mb-6 max-w-2xl mx-auto">
              Once you've connected your app store accounts and the backend sync is implemented, you'll be able to view comprehensive revenue reports, transaction history, and analytics here.
            </p>
          </div>

          {/* What You'll See */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Revenue Overview */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-emerald-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Revenue Overview</h4>
              <p className="text-white/60 text-sm">
                View total revenue, trends, and breakdowns by product, platform, and time period.
              </p>
            </div>

            {/* Transaction History */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-blue-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Transaction History</h4>
              <p className="text-white/60 text-sm">
                Browse all purchases, renewals, refunds, and cancellations with detailed information.
              </p>
            </div>

            {/* Export Reports */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <Download className="w-6 h-6 text-purple-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Export Reports</h4>
              <p className="text-white/60 text-sm">
                Download revenue reports in CSV or PDF format for accounting and analysis.
              </p>
            </div>
          </div>

          {/* Required Implementation */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-amber-300 mb-3">🔧 Backend Implementation Required</h4>
            <p className="text-amber-200/80 text-sm mb-4">
              To see revenue data here, you need to implement the backend Cloud Function that:
            </p>
            <ol className="text-amber-200/70 text-sm space-y-2 ml-4 list-decimal">
              <li>Reads encrypted credentials from Firestore</li>
              <li>Generates JWT tokens for Apple API authentication</li>
              <li>Fetches sales/financial reports from App Store Connect API</li>
              <li>Stores revenue transactions in Firestore</li>
              <li>Runs on a schedule (every 24 hours)</li>
            </ol>
            <div className="mt-4 pt-4 border-t border-amber-500/20">
              <p className="text-amber-200/60 text-xs">
                Once implemented, revenue data will automatically sync and appear in this analytics tab.
              </p>
            </div>
          </div>

          {/* If integrations exist, show manual sync button */}
          {integrations.length > 0 && (
            <div className="bg-white/5 rounded-xl border border-white/10 p-6 text-center">
              <h4 className="text-lg font-semibold text-white mb-3">Manual Sync (Coming Soon)</h4>
              <p className="text-white/60 text-sm mb-4">
                Once the backend is set up, you'll be able to manually trigger a revenue sync from here.
              </p>
              <button
                disabled
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white/40 rounded-lg font-medium cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                Sync Revenue Data
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

