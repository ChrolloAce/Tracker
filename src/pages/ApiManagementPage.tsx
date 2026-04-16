import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Copy,
  Check,
  Plus,
  Trash2,
  Shield,
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ApiKeyService from '../services/ApiKeyService';
import type { ApiKeyResponse, ApiKeyCreateResponse, ApiKeyScope } from '../types/apiKeys';

// ─── Constants ────────────────────────────────────────────

const ALL_SCOPES: { value: ApiKeyScope; label: string; group: string }[] = [
  { value: 'videos:read', label: 'Read Videos', group: 'Videos' },
  { value: 'videos:write', label: 'Write Videos', group: 'Videos' },
  { value: 'videos:analyze', label: 'Analyze Videos (AI)', group: 'Videos' },
  { value: 'accounts:read', label: 'Read Accounts', group: 'Accounts' },
  { value: 'accounts:write', label: 'Write Accounts', group: 'Accounts' },
  { value: 'analytics:read', label: 'Read Analytics', group: 'Analytics' },
  { value: 'projects:read', label: 'Read Projects', group: 'Projects' },
  { value: 'projects:write', label: 'Write Projects', group: 'Projects' },
  { value: 'organizations:read', label: 'Read Org', group: 'Organization' },
  { value: 'viral:write', label: 'Write Viral', group: 'Viral' },
  { value: 'creators:read', label: 'Read Creators', group: 'Creators' },
];

// ─── Page ─────────────────────────────────────────────────

const ApiManagementPage: React.FC<{ onRequiresPaidPlan?: (context: string) => boolean }> = ({ onRequiresPaidPlan }) => {
  const { user, currentOrgId } = useAuth();
  const [keys, setKeys] = useState<ApiKeyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<ApiKeyCreateResponse | null>(null);


  const orgId = currentOrgId || '';
  const isDemoMode = !user || orgId === 'Vx2UpxGCV3uD8Xj2ioX4' || !orgId;

  const loadKeys = useCallback(async () => {
    if (isDemoMode) {
      // Show fake keys in demo mode
      setKeys([
        {
          id: 'demo-key-1',
          name: 'Production Key',
          prefix: 'vt_live_a3x',
          scopes: ['videos:read', 'accounts:read', 'analytics:read'],
          createdAt: new Date('2026-01-15').toISOString(),
          lastUsedAt: new Date('2026-03-23').toISOString(),
          isActive: true,
          status: 'active',
          usageCount: 12847,
        } as any,
        {
          id: 'demo-key-2',
          name: 'Open Claw Agent',
          prefix: 'vt_live_k8m',
          scopes: ['videos:read', 'accounts:read', 'analytics:read', 'viral:read'],
          createdAt: new Date('2026-02-20').toISOString(),
          lastUsedAt: new Date('2026-03-24').toISOString(),
          isActive: true,
          status: 'active',
          usageCount: 34219,
        } as any,
      ]);
      setLoading(false);
      return;
    }
    if (!orgId) { setLoading(false); return; }
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
  }, [orgId, isDemoMode]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  return (
    <div className="relative">
      <div className="max-w-6xl mx-auto">

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Persistent action header — visible whether there are 0 keys or many.
            Restored after commit 09e63313 dropped it into the empty-state only. */}
        {!loading && keys.length > 0 && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => {
                if (onRequiresPaidPlan?.('to bring your self-learning agent to life')) return;
                setShowCreate(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all"
            >
              <Plus className="w-4 h-4" />
              Generate Key
            </button>
          </div>
        )}

        {/* Keys table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-content-muted animate-spin" />
          </div>
        ) : keys.length === 0 ? (
          <EmptyState onGenerate={() => { if (onRequiresPaidPlan?.('to bring your self-learning agent to life')) return; setShowCreate(true); }} />
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

// ─── Empty State ──────────────────────────────────────────

const EmptyState: React.FC<{ onGenerate: () => void }> = ({ onGenerate }) => (
  <div className="rounded-2xl bg-surface-hover border border-border p-12 text-center">
    <div className="w-16 h-16 bg-surface-hover rounded-2xl flex items-center justify-center mx-auto mb-4">
      <Key className="w-8 h-8 text-content-muted" />
    </div>
    <h3 className="text-lg font-medium text-content mb-2">No API Keys</h3>
    <p className="text-content-muted text-sm max-w-sm mx-auto mb-6">
      Generate your first API key to start using the ViewTrack API programmatically.
    </p>
    <button
      onClick={onGenerate}
      className="px-6 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-semibold shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all"
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
    <div className="rounded-2xl bg-surface-secondary border border-border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-xs font-semibold text-content-muted uppercase tracking-wider">Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-content-muted uppercase tracking-wider">Key Prefix</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-content-muted uppercase tracking-wider">Scopes</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-content-muted uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-content-muted uppercase tracking-wider">Usage</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-content-muted uppercase tracking-wider">Created</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {keys.map((k) => (
            <tr key={k.id} className="hover:bg-surface-hover">
              <td className="px-4 py-3 text-sm text-content font-medium">{k.name}</td>
              <td className="px-4 py-3">
                <code className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">{k.keyPrefix}…</code>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {k.scopes.slice(0, 3).map((s) => (
                    <span key={s} className="text-[10px] text-content-muted bg-surface-hover px-1.5 py-0.5 rounded">{s}</span>
                  ))}
                  {k.scopes.length > 3 && (
                    <span className="text-[10px] text-content-muted">+{k.scopes.length - 3}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={k.status} />
              </td>
              <td className="px-4 py-3 text-xs text-content-muted">{k.usageCount.toLocaleString()} calls</td>
              <td className="px-4 py-3 text-xs text-content-muted">
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
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${styles[status] || 'text-content-muted bg-surface-hover'}`}>
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
      <div className="bg-surface-secondary border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold text-content">{result ? 'API Key Created' : 'Generate API Key'}</h3>
          <button onClick={onClose} className="text-content-muted hover:text-content transition-all text-xl">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {result ? (
            <>
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-400">Save this key now</p>
                  <p className="text-xs text-amber-300/70 mt-1">This is the only time the full key will be shown. Copy it and store it securely.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs text-content-muted mb-1.5">API Key</label>
                <div className="flex items-center gap-2 bg-surface-inset border border-border rounded-xl px-3 py-2.5">
                  <code className="flex-1 text-sm text-emerald-400 font-mono truncate">
                    {showKey ? result.key : result.keyPrefix + '•'.repeat(24)}
                  </code>
                  <button onClick={() => setShowKey(!showKey)} className="text-content-muted hover:text-content transition-all">
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={copyKey} className="text-content-muted hover:text-content transition-all">
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-surface-secondary rounded-lg px-3 py-2">
                  <span className="text-content-muted">Name</span>
                  <p className="text-content font-medium">{result.name}</p>
                </div>
                <div className="bg-surface-secondary rounded-lg px-3 py-2">
                  <span className="text-content-muted">Scopes</span>
                  <p className="text-content font-medium">{result.scopes.length} permissions</p>
                </div>
              </div>
            </>
          ) : (
            <>
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">{error}</div>
              )}

              <div>
                <label className="block text-xs text-content-muted mb-1.5">Key Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production API, Dashboard Integration"
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded-xl text-content placeholder-content-muted text-sm focus:outline-none focus:border-border-strong"
                />
              </div>

              <div>
                <label className="block text-xs text-content-muted mb-2">Permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_SCOPES.map((scope) => (
                    <button
                      key={scope.value}
                      onClick={() => toggleScope(scope.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all border ${
                        selectedScopes.includes(scope.value)
                          ? 'bg-orange-500/10 border-orange-500/30 text-orange-500'
                          : 'bg-surface-secondary border-border text-content-muted hover:bg-surface-hover'
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

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-content bg-surface-secondary border border-border rounded-lg shadow-[0_2px_0_0_var(--border)] hover:shadow-[0_1px_0_0_var(--border)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all">
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-50 flex items-center gap-2"
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
