import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Shield,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  RefreshCw,
  Code2,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SuperAdminService from '../services/SuperAdminService';
import ApiKeyService from '../services/ApiKeyService';
import type { ApiKeyResponse, ApiKeyCreateResponse, ApiKeyScope } from '../types/apiKeys';

// ─── Constants ────────────────────────────────────────────

const ALL_SCOPES: { value: ApiKeyScope; label: string; group: string }[] = [
  { value: 'videos:read', label: 'Read Videos', group: 'Videos' },
  { value: 'videos:write', label: 'Write Videos', group: 'Videos' },
  { value: 'accounts:read', label: 'Read Accounts', group: 'Accounts' },
  { value: 'accounts:write', label: 'Write Accounts', group: 'Accounts' },
  { value: 'analytics:read', label: 'Read Analytics', group: 'Analytics' },
  { value: 'projects:read', label: 'Read Projects', group: 'Projects' },
  { value: 'projects:write', label: 'Write Projects', group: 'Projects' },
  { value: 'organizations:read', label: 'Read Org', group: 'Organization' },
];

const API_BASE = 'https://viewtrack.app/api/v1';

// ─── Page ─────────────────────────────────────────────────

const ApiManagementPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = SuperAdminService.isSuperAdmin(user?.email);

  const [keys, setKeys] = useState<ApiKeyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<ApiKeyCreateResponse | null>(null);

  // Super admin guard
  useEffect(() => {
    if (!isSuperAdmin) navigate('/dashboard');
  }, [isSuperAdmin, navigate]);

  // Load keys — we need to pick an org. Super admin can use a default.
  const orgId = (user as any)?.organizationId || 'default';

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ApiKeyService.list(orgId);
      setKeys(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load keys');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (isSuperAdmin) loadKeys();
  }, [isSuperAdmin, loadKeys]);

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-lg transition-all">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center border border-emerald-500/20">
            <Key className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">API Management</h1>
            <p className="text-sm text-gray-500">Create and manage API keys for the ViewTrack API</p>
          </div>
        </div>

        {/* Quick Reference */}
        <QuickReference />

        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">API Keys</h2>
          <div className="flex items-center gap-2">
            <button onClick={loadKeys} className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setShowCreate(true); setNewKeyResult(null); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-medium text-white transition-all"
            >
              <Plus className="w-4 h-4" /> Generate Key
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Keys table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
          </div>
        ) : keys.length === 0 ? (
          <EmptyState onGenerate={() => setShowCreate(true)} />
        ) : (
          <KeysTable keys={keys} orgId={orgId} onRevoked={loadKeys} />
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateKeyModal
          orgId={orgId}
          result={newKeyResult}
          onCreated={(res) => { setNewKeyResult(res); loadKeys(); }}
          onClose={() => { setShowCreate(false); setNewKeyResult(null); }}
        />
      )}
    </div>
  );
};

// ─── Quick Reference Card ─────────────────────────────────

const QuickReference: React.FC = () => {
  const [showRef, setShowRef] = useState(false);

  return (
    <div className="mb-8 mt-4">
      <button
        onClick={() => setShowRef(!showRef)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-all"
      >
        <Code2 className="w-4 h-4" />
        {showRef ? 'Hide' : 'Show'} API Reference
      </button>

      {showRef && (
        <div className="mt-3 rounded-2xl bg-white/[0.03] border border-white/10 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Quick Start</h3>
          <p className="text-xs text-gray-500">All requests require an <code className="text-emerald-400">x-api-key</code> header.</p>

          <div className="space-y-2">
            <EndpointRow method="GET" path="/api/v1/videos" desc="List tracked videos" />
            <EndpointRow method="POST" path="/api/v1/videos" desc="Add video to track" />
            <EndpointRow method="GET" path="/api/v1/videos/:id" desc="Get video details + snapshots" />
            <EndpointRow method="GET" path="/api/v1/accounts" desc="List tracked accounts" />
            <EndpointRow method="POST" path="/api/v1/accounts" desc="Add account to track" />
            <EndpointRow method="GET" path="/api/v1/analytics/overview" desc="Full analytics overview" />
            <EndpointRow method="GET" path="/api/v1/refreshes" desc="Refresh history & stats" />
          </div>

          <div className="mt-4 rounded-xl bg-black/50 p-4">
            <p className="text-[11px] text-gray-500 mb-2 uppercase tracking-wider font-semibold">Example</p>
            <code className="text-xs text-emerald-400 whitespace-pre">{`curl -H "x-api-key: vt_live_xxxxxxxx" \\
  ${API_BASE}/videos?limit=10`}</code>
          </div>
        </div>
      )}
    </div>
  );
};

const EndpointRow: React.FC<{ method: string; path: string; desc: string }> = ({ method, path, desc }) => {
  const methodColor = method === 'POST' ? 'text-amber-400 bg-amber-400/10' : 'text-emerald-400 bg-emerald-400/10';
  return (
    <div className="flex items-center gap-3">
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${methodColor} w-14 text-center`}>{method}</span>
      <code className="text-xs text-white/70 flex-1 font-mono">{path}</code>
      <span className="text-xs text-gray-500">{desc}</span>
    </div>
  );
};

// ─── Empty State ──────────────────────────────────────────

const EmptyState: React.FC<{ onGenerate: () => void }> = ({ onGenerate }) => (
  <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
      <Key className="w-8 h-8 text-gray-600" />
    </div>
    <h3 className="text-lg font-medium text-white mb-2">No API Keys</h3>
    <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
      Generate your first API key to start using the ViewTrack API programmatically.
    </p>
    <button
      onClick={onGenerate}
      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-medium text-white transition-all"
    >
      Generate Key
    </button>
  </div>
);

// ─── Keys Table ───────────────────────────────────────────

const KeysTable: React.FC<{ keys: ApiKeyResponse[]; orgId: string; onRevoked: () => void }> = ({
  keys,
  orgId,
  onRevoked,
}) => {
  const [revoking, setRevoking] = useState<string | null>(null);

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    setRevoking(keyId);
    try {
      await ApiKeyService.revoke(orgId, keyId);
      onRevoked();
    } catch {
      alert('Failed to revoke key');
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Key Prefix</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Scopes</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Usage</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {keys.map((k) => (
            <tr key={k.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3 text-sm text-white font-medium">{k.name}</td>
              <td className="px-4 py-3">
                <code className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">{k.keyPrefix}…</code>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {k.scopes.slice(0, 3).map((s) => (
                    <span key={s} className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">{s}</span>
                  ))}
                  {k.scopes.length > 3 && (
                    <span className="text-[10px] text-gray-500">+{k.scopes.length - 3}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={k.status} />
              </td>
              <td className="px-4 py-3 text-xs text-gray-400">{k.usageCount.toLocaleString()} calls</td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '—'}
              </td>
              <td className="px-4 py-3">
                {k.status === 'active' && (
                  <button
                    onClick={() => handleRevoke(k.id)}
                    disabled={revoking === k.id}
                    className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-50"
                    title="Revoke key"
                  >
                    {revoking === k.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    active: 'text-emerald-400 bg-emerald-400/10',
    revoked: 'text-red-400 bg-red-400/10',
    expired: 'text-amber-400 bg-amber-400/10',
  };
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${styles[status] || 'text-gray-400 bg-white/5'}`}>
      {status}
    </span>
  );
};

// ─── Create Key Modal ─────────────────────────────────────

const CreateKeyModal: React.FC<{
  orgId: string;
  result: ApiKeyCreateResponse | null;
  onCreated: (res: ApiKeyCreateResponse) => void;
  onClose: () => void;
}> = ({ orgId, result, onCreated, onClose }) => {
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>([
    'videos:read', 'accounts:read', 'analytics:read',
  ]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const toggleScope = (scope: ApiKeyScope) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (selectedScopes.length === 0) { setError('Select at least one scope'); return; }
    setCreating(true);
    setError(null);
    try {
      const res = await ApiKeyService.create(orgId, name.trim(), selectedScopes);
      onCreated(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const copyKey = () => {
    if (result?.key) {
      navigator.clipboard.writeText(result.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#111113] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{result ? 'API Key Created' : 'Generate API Key'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-all text-xl">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {result ? (
            /* ── Success: show key ── */
            <>
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-400">Save this key now</p>
                  <p className="text-xs text-amber-300/70 mt-1">This is the only time the full key will be shown. Copy it and store it securely.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">API Key</label>
                <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5">
                  <code className="flex-1 text-sm text-emerald-400 font-mono truncate">
                    {showKey ? result.key : result.keyPrefix + '•'.repeat(24)}
                  </code>
                  <button onClick={() => setShowKey(!showKey)} className="text-gray-500 hover:text-white transition-all">
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={copyKey} className="text-gray-500 hover:text-white transition-all">
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                  <span className="text-gray-500">Name</span>
                  <p className="text-white font-medium">{result.name}</p>
                </div>
                <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                  <span className="text-gray-500">Scopes</span>
                  <p className="text-white font-medium">{result.scopes.length} permissions</p>
                </div>
              </div>
            </>
          ) : (
            /* ── Form ── */
            <>
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">{error}</div>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Key Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production API, Dashboard Integration"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-2">Permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_SCOPES.map((scope) => (
                    <button
                      key={scope.value}
                      onClick={() => toggleScope(scope.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all border ${
                        selectedScopes.includes(scope.value)
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-white/[0.02] border-white/10 text-gray-400 hover:bg-white/5'
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      {scope.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-all">
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Generate
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiManagementPage;
