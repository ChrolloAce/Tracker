/**
 * API Keys Manager Component
 * Allows users to create, view, and revoke API keys
 */

import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Eye, 
  EyeOff,
  AlertTriangle,
  Clock,
  Activity,
  Shield,
  Loader2,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ApiKeyResponse, ApiKeyCreateResponse, ApiKeyScope } from '../types/apiKeys';

interface ApiKeysManagerProps {
  organizationId: string;
}

const AVAILABLE_SCOPES: { value: ApiKeyScope; label: string; description: string }[] = [
  { value: 'accounts:read', label: 'Read Accounts', description: 'View tracked accounts' },
  { value: 'accounts:write', label: 'Write Accounts', description: 'Add/remove tracked accounts' },
  { value: 'videos:read', label: 'Read Videos', description: 'View tracked videos' },
  { value: 'videos:write', label: 'Write Videos', description: 'Add/remove tracked videos' },
  { value: 'analytics:read', label: 'Read Analytics', description: 'View analytics data' },
  { value: 'projects:read', label: 'Read Projects', description: 'View projects' },
  { value: 'projects:write', label: 'Write Projects', description: 'Create/update projects' },
  { value: 'organizations:read', label: 'Read Organization', description: 'View organization info' },
];

export const ApiKeysManager: React.FC<ApiKeysManagerProps> = ({ organizationId }) => {
  const { getIdToken } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKeyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>(['accounts:read', 'videos:read', 'analytics:read']);
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  
  // Newly created key (show once)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<ApiKeyCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Revoke confirmation
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Load API keys
  useEffect(() => {
    loadApiKeys();
  }, [organizationId]);

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = await getIdToken();
      const response = await fetch(`/api/api-keys?orgId=${organizationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to load API keys');
      }
      
      const data = await response.json();
      setApiKeys(data.data.keys);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim() || selectedScopes.length === 0) return;
    
    try {
      setCreating(true);
      setError(null);
      
      const token = await getIdToken();
      const response = await fetch(`/api/api-keys?orgId=${organizationId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newKeyName.trim(),
          scopes: selectedScopes,
          expiresInDays
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to create API key');
      }
      
      const data = await response.json();
      setNewlyCreatedKey(data.data);
      setShowCreateModal(false);
      setNewKeyName('');
      setSelectedScopes(['accounts:read', 'videos:read', 'analytics:read']);
      setExpiresInDays(undefined);
      
      // Reload keys list
      loadApiKeys();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const revokeApiKey = async (keyId: string) => {
    try {
      setRevoking(true);
      
      const token = await getIdToken();
      const response = await fetch(`/api/api-keys?orgId=${organizationId}&keyId=${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to revoke API key');
      }
      
      setKeyToRevoke(null);
      loadApiKeys();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRevoking(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scope: ApiKeyScope) => {
    setSelectedScopes(prev => 
      prev.includes(scope) 
        ? prev.filter(s => s !== scope)
        : [...prev, scope]
    );
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-purple-400" />
            API Keys
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Manage API keys for programmatic access to ViewTrack
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {/* Newly created key display */}
      {newlyCreatedKey && (
        <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white">API Key Created</h4>
                <p className="text-sm text-emerald-400">Save this key now - you won't be able to see it again!</p>
              </div>
            </div>
            <button 
              onClick={() => setNewlyCreatedKey(null)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="bg-black/40 rounded-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <code className="text-sm text-emerald-300 font-mono break-all">
                {newlyCreatedKey.key}
              </code>
              <button
                onClick={() => copyToClipboard(newlyCreatedKey.key)}
                className="flex-shrink-0 p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Keys List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="text-center py-12 bg-black/20 rounded-xl border border-white/5">
          <Key className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-white mb-2">No API Keys</h4>
          <p className="text-gray-400 mb-4">Create an API key to start using the ViewTrack API</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Create Your First Key
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {apiKeys.map(key => (
            <div 
              key={key.id}
              className={`p-4 rounded-xl border transition-colors ${
                key.status === 'active' 
                  ? 'bg-black/40 border-white/10 hover:border-white/20' 
                  : 'bg-black/20 border-white/5 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-white">{key.name}</h4>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      key.status === 'active' 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {key.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="font-mono bg-black/40 px-2 py-1 rounded">
                      {key.keyPrefix}...
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="w-4 h-4" />
                      {key.usageCount} requests
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Last used: {formatDate(key.lastUsedAt)}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {key.scopes.map(scope => (
                      <span 
                        key={scope}
                        className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
                
                {key.status === 'active' && (
                  <button
                    onClick={() => setKeyToRevoke(key.id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Revoke key"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              {key.expiresAt && (
                <div className="mt-3 pt-3 border-t border-white/5 text-sm text-gray-400">
                  Expires: {formatDate(key.expiresAt)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">Create API Key</h3>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Key Name */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Key Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API, Mobile App"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              {/* Scopes */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Permissions
                </label>
                <div className="space-y-2">
                  {AVAILABLE_SCOPES.map(scope => (
                    <label 
                      key={scope.value}
                      className="flex items-start gap-3 p-3 bg-black/20 rounded-lg cursor-pointer hover:bg-black/40 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope.value)}
                        onChange={() => toggleScope(scope.value)}
                        className="mt-1 w-4 h-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <span className="text-white font-medium">{scope.label}</span>
                        <p className="text-sm text-gray-400">{scope.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Expiration (Optional)
                </label>
                <select
                  value={expiresInDays || ''}
                  onChange={e => setExpiresInDays(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">Never expires</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="180">6 months</option>
                  <option value="365">1 year</option>
                </select>
              </div>
            </div>
            
            <div className="p-6 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createApiKey}
                disabled={creating || !newKeyName.trim() || selectedScopes.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Key
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {keyToRevoke && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-2xl border border-white/10 w-full max-w-md p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Revoke API Key?</h3>
                <p className="text-sm text-gray-400">This action cannot be undone.</p>
              </div>
            </div>
            
            <p className="text-gray-300 mb-6">
              Any applications using this API key will immediately lose access to the ViewTrack API.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setKeyToRevoke(null)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => revokeApiKey(keyToRevoke)}
                disabled={revoking}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                {revoking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Revoking...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Revoke Key
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeysManager;
