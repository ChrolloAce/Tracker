import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Shield,
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  RefreshCw,
  Code2,
  Loader2,
  Play,
  Send,
  ChevronDown,
  Terminal,
  Clock,
  CheckCircle2,
  XCircle,
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

        {/* API Playground */}
        <ApiPlayground />

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

// ─── API Playground ───────────────────────────────────────

interface PlaygroundEndpoint {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  label: string;
  params?: { key: string; placeholder: string; required?: boolean }[];
  bodyFields?: { key: string; placeholder: string; type: string; required?: boolean }[];
}

const PLAYGROUND_ENDPOINTS: PlaygroundEndpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/videos',
    label: 'List Videos',
    params: [
      { key: 'projectId', placeholder: 'Project ID', required: false },
      { key: 'platform', placeholder: 'tiktok, instagram, youtube', required: false },
      { key: 'limit', placeholder: '50', required: false },
      { key: 'offset', placeholder: '0', required: false },
    ],
  },
  {
    method: 'POST',
    path: '/api/v1/videos',
    label: 'Add Video',
    bodyFields: [
      { key: 'url', placeholder: 'https://tiktok.com/@user/video/123', type: 'text', required: true },
      { key: 'projectId', placeholder: 'Project ID', type: 'text', required: false },
    ],
  },
  {
    method: 'GET',
    path: '/api/v1/videos/:id',
    label: 'Get Video Details',
    params: [{ key: 'id', placeholder: 'Video document ID', required: true }],
  },
  {
    method: 'DELETE',
    path: '/api/v1/videos/:id',
    label: 'Delete Video',
    params: [{ key: 'id', placeholder: 'Video document ID', required: true }],
  },
  {
    method: 'GET',
    path: '/api/v1/accounts',
    label: 'List Accounts',
    params: [
      { key: 'projectId', placeholder: 'Project ID', required: false },
      { key: 'platform', placeholder: 'tiktok, instagram, youtube', required: false },
      { key: 'limit', placeholder: '50', required: false },
    ],
  },
  {
    method: 'POST',
    path: '/api/v1/accounts',
    label: 'Add Account',
    bodyFields: [
      { key: 'platform', placeholder: 'tiktok', type: 'text', required: true },
      { key: 'handle', placeholder: '@username', type: 'text', required: true },
      { key: 'projectId', placeholder: 'Project ID', type: 'text', required: false },
    ],
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/overview',
    label: 'Analytics Overview',
    params: [
      { key: 'projectId', placeholder: 'Project ID', required: false },
      { key: 'period', placeholder: '7d, 30d, 90d', required: false },
    ],
  },
  {
    method: 'GET',
    path: '/api/v1/refreshes',
    label: 'Refresh History',
    params: [
      { key: 'projectId', placeholder: 'Project ID', required: true },
      { key: 'platform', placeholder: 'tiktok, instagram', required: false },
      { key: 'status', placeholder: 'active, error', required: false },
      { key: 'startDate', placeholder: '2025-01-01', required: false },
      { key: 'endDate', placeholder: '2025-12-31', required: false },
      { key: 'limit', placeholder: '50', required: false },
    ],
  },
  {
    method: 'GET',
    path: '/api/v1/projects',
    label: 'List Projects',
  },
];

const ApiPlayground: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState<PlaygroundEndpoint>(PLAYGROUND_ENDPOINTS[0]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [bodyValues, setBodyValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<{ status: number; body: any; time: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // Reset values when endpoint changes
  const selectEndpoint = (ep: PlaygroundEndpoint) => {
    setSelectedEndpoint(ep);
    setParamValues({});
    setBodyValues({});
    setResponse(null);
    setShowDropdown(false);
  };

  // Build the URL
  const buildUrl = () => {
    let path = selectedEndpoint.path;

    // Replace :id style params
    if (path.includes(':id') && paramValues['id']) {
      path = path.replace(':id', paramValues['id']);
    }

    // Build query string from non-path params
    const queryParams = (selectedEndpoint.params || [])
      .filter((p) => p.key !== 'id' && paramValues[p.key]?.trim())
      .map((p) => `${p.key}=${encodeURIComponent(paramValues[p.key])}`)
      .join('&');

    const base = window.location.origin;
    return queryParams ? `${base}${path}?${queryParams}` : `${base}${path}`;
  };

  // Build curl command
  const buildCurl = () => {
    const url = buildUrl().replace(window.location.origin, API_BASE.replace('/api/v1', ''));
    const fullUrl = url.replace('/api/', `${API_BASE.split('/api/v1')[0]}/api/`);
    let curlUrl = url;

    // Use the production URL in curl
    if (!url.startsWith('https://')) {
      curlUrl = `https://viewtrack.app${selectedEndpoint.path}`;
      // add query params
      const queryParams = (selectedEndpoint.params || [])
        .filter((p) => p.key !== 'id' && paramValues[p.key]?.trim())
        .map((p) => `${p.key}=${encodeURIComponent(paramValues[p.key])}`)
        .join('&');
      if (selectedEndpoint.path.includes(':id') && paramValues['id']) {
        curlUrl = curlUrl.replace(':id', paramValues['id']);
      }
      if (queryParams) curlUrl += `?${queryParams}`;
    }

    let cmd = `curl -X ${selectedEndpoint.method}`;
    cmd += ` \\\n  -H "x-api-key: ${apiKey || 'YOUR_API_KEY'}"`;

    if (selectedEndpoint.method === 'POST') {
      cmd += ` \\\n  -H "Content-Type: application/json"`;
      const body: Record<string, string> = {};
      (selectedEndpoint.bodyFields || []).forEach((f) => {
        if (bodyValues[f.key]?.trim()) body[f.key] = bodyValues[f.key];
      });
      if (Object.keys(body).length > 0) {
        cmd += ` \\\n  -d '${JSON.stringify(body)}'`;
      }
    }

    cmd += ` \\\n  "${curlUrl}"`;
    return cmd;
  };

  const copyCurl = () => {
    navigator.clipboard.writeText(buildCurl());
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  // Send the request
  const sendRequest = async () => {
    if (!apiKey.trim()) return;
    setSending(true);
    setResponse(null);

    const url = buildUrl();
    const start = Date.now();

    try {
      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      };

      if (selectedEndpoint.method === 'POST' && selectedEndpoint.bodyFields) {
        const body: Record<string, string> = {};
        selectedEndpoint.bodyFields.forEach((f) => {
          if (bodyValues[f.key]?.trim()) body[f.key] = bodyValues[f.key];
        });
        options.body = JSON.stringify(body);
      }

      const res = await fetch(url, options);
      const elapsed = Date.now() - start;
      let body;
      try {
        body = await res.json();
      } catch {
        body = await res.text();
      }
      setResponse({ status: res.status, body, time: elapsed });
    } catch (err) {
      setResponse({ status: 0, body: { error: err instanceof Error ? err.message : 'Network error' }, time: Date.now() - start });
    } finally {
      setSending(false);
    }
  };

  const methodColors: Record<string, string> = {
    GET: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    POST: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    DELETE: 'text-red-400 bg-red-400/10 border-red-400/20',
  };

  return (
    <div className="mb-8">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-all"
      >
        <Terminal className="w-4 h-4" />
        {open ? 'Hide' : 'Show'} API Playground
      </button>

      {open && (
        <div className="mt-3 rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
          {/* Header bar */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-lg flex items-center justify-center border border-purple-500/20">
              <Play className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">API Playground</h3>
              <p className="text-[11px] text-gray-500">Test endpoints live with your API key</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* API Key input */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="vt_live_xxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm font-mono focus:outline-none focus:border-emerald-500/30"
              />
            </div>

            {/* Endpoint selector + Send */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-left hover:bg-white/[0.07] transition-all"
                >
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${methodColors[selectedEndpoint.method]} shrink-0`}>
                    {selectedEndpoint.method}
                  </span>
                  <span className="text-white/80 font-mono text-xs flex-1 truncate">{selectedEndpoint.path}</span>
                  <span className="text-gray-500 text-xs truncate hidden sm:inline">{selectedEndpoint.label}</span>
                  <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                </button>

                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#111113] border border-white/10 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                    {PLAYGROUND_ENDPOINTS.map((ep) => (
                      <button
                        key={`${ep.method}-${ep.path}`}
                        onClick={() => selectEndpoint(ep)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-all text-sm ${
                          ep === selectedEndpoint ? 'bg-white/[0.03]' : ''
                        }`}
                      >
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${methodColors[ep.method]} shrink-0`}>
                          {ep.method}
                        </span>
                        <span className="text-white/70 font-mono text-xs flex-1 truncate">{ep.path}</span>
                        <span className="text-gray-500 text-[11px] truncate">{ep.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={sendRequest}
                disabled={sending || !apiKey.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-all shrink-0"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </div>

            {/* Parameters (for GET/DELETE) */}
            {selectedEndpoint.params && selectedEndpoint.params.length > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-2">Parameters</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedEndpoint.params.map((p) => (
                    <div key={p.key} className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 w-20 shrink-0 text-right font-mono">
                        {p.key}
                        {p.required && <span className="text-red-400">*</span>}
                      </span>
                      <input
                        type="text"
                        value={paramValues[p.key] || ''}
                        onChange={(e) => setParamValues((prev) => ({ ...prev, [p.key]: e.target.value }))}
                        placeholder={p.placeholder}
                        className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 text-xs font-mono focus:outline-none focus:border-white/20"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Body fields (for POST) */}
            {selectedEndpoint.bodyFields && selectedEndpoint.bodyFields.length > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-2">Request Body</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedEndpoint.bodyFields.map((f) => (
                    <div key={f.key} className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 w-20 shrink-0 text-right font-mono">
                        {f.key}
                        {f.required && <span className="text-red-400">*</span>}
                      </span>
                      <input
                        type={f.type}
                        value={bodyValues[f.key] || ''}
                        onChange={(e) => setBodyValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 text-xs font-mono focus:outline-none focus:border-white/20"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* cURL preview */}
            <div className="rounded-xl bg-black/50 border border-white/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">cURL</span>
                <button onClick={copyCurl} className="text-gray-500 hover:text-white transition-all">
                  {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <code className="text-[11px] text-emerald-400/80 whitespace-pre-wrap break-all font-mono leading-relaxed">
                {buildCurl()}
              </code>
            </div>

            {/* Response */}
            {response && (
              <div className="rounded-xl border border-white/10 overflow-hidden">
                <div className={`px-4 py-2.5 flex items-center justify-between ${
                  response.status >= 200 && response.status < 300 ? 'bg-emerald-500/10' : 'bg-red-500/10'
                }`}>
                  <div className="flex items-center gap-2">
                    {response.status >= 200 && response.status < 300 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className={`text-sm font-semibold ${
                      response.status >= 200 && response.status < 300 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {response.status || 'ERR'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {response.status === 200 ? 'OK' : response.status === 201 ? 'Created' : response.status === 400 ? 'Bad Request' : response.status === 401 ? 'Unauthorized' : response.status === 403 ? 'Forbidden' : response.status === 404 ? 'Not Found' : response.status === 429 ? 'Rate Limited' : response.status === 500 ? 'Server Error' : ''}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {response.time}ms
                  </span>
                </div>
                <div className="p-4 bg-black/30 max-h-80 overflow-y-auto">
                  <pre className="text-xs text-white/80 font-mono whitespace-pre-wrap break-words leading-relaxed">
                    {typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
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
