import React, { useState } from 'react';
import {
  Copy,
  Check,
  Loader2,
  Play,
  Send,
  ChevronDown,
  Terminal,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────

interface PlaygroundEndpoint {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  label: string;
  params?: { key: string; placeholder: string; required?: boolean }[];
  bodyFields?: { key: string; placeholder: string; type: string; required?: boolean }[];
}

// ─── Endpoints ───────────────────────────────────────────

const API_BASE = 'https://viewtrack.app/api/v1';

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
      { key: 'sync', placeholder: 'true — wait for data (up to 90s)', type: 'checkbox', required: false },
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
      { key: 'username', placeholder: '@username', type: 'text', required: true },
      { key: 'projectId', placeholder: 'Project ID', type: 'text', required: false },
      { key: 'maxVideos', placeholder: '10 (default, max 50)', type: 'text', required: false },
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
  {
    method: 'POST',
    path: '/api/v1/projects',
    label: 'Create Project',
    bodyFields: [
      { key: 'name', placeholder: 'My New Project', type: 'text', required: true },
      { key: 'description', placeholder: 'Optional description', type: 'text', required: false },
      { key: 'color', placeholder: '#3B82F6 (optional hex color)', type: 'text', required: false },
    ],
  },
];

// ─── Component ───────────────────────────────────────────

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

  const selectEndpoint = (ep: PlaygroundEndpoint) => {
    setSelectedEndpoint(ep);
    setParamValues({});
    setBodyValues({});
    setResponse(null);
    setShowDropdown(false);
  };

  const buildUrl = () => {
    let path = selectedEndpoint.path;
    if (path.includes(':id') && paramValues['id']) {
      path = path.replace(':id', paramValues['id']);
    }
    const queryParams = (selectedEndpoint.params || [])
      .filter((p) => p.key !== 'id' && paramValues[p.key]?.trim())
      .map((p) => `${p.key}=${encodeURIComponent(paramValues[p.key])}`)
      .join('&');
    const base = window.location.origin;
    return queryParams ? `${base}${path}?${queryParams}` : `${base}${path}`;
  };

  const buildCurl = () => {
    const url = buildUrl().replace(window.location.origin, API_BASE.replace('/api/v1', ''));
    let curlUrl = url;
    if (!url.startsWith('https://')) {
      curlUrl = `https://viewtrack.app${selectedEndpoint.path}`;
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
      const body: Record<string, string | boolean> = {};
      (selectedEndpoint.bodyFields || []).forEach((f) => {
        if (bodyValues[f.key]?.trim()) {
          body[f.key] = f.type === 'checkbox' ? bodyValues[f.key] === 'true' : bodyValues[f.key];
        }
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

  const sendRequest = async () => {
    if (!apiKey.trim()) return;
    setSending(true);
    setResponse(null);
    const url = buildUrl();
    const start = Date.now();

    try {
      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      };
      if (selectedEndpoint.method === 'POST' && selectedEndpoint.bodyFields) {
        const body: Record<string, string | boolean> = {};
        selectedEndpoint.bodyFields.forEach((f) => {
          if (bodyValues[f.key]?.trim()) {
            body[f.key] = f.type === 'checkbox' ? bodyValues[f.key] === 'true' : bodyValues[f.key];
          }
        });
        options.body = JSON.stringify(body);
      }
      const res = await fetch(url, options);
      const elapsed = Date.now() - start;
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }
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
                      {f.type === 'checkbox' ? (
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={bodyValues[f.key] === 'true'}
                            onChange={(e) => setBodyValues((prev) => ({ ...prev, [f.key]: e.target.checked ? 'true' : '' }))}
                            className="w-4 h-4 rounded bg-white/5 border border-white/20 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-emerald-500"
                          />
                          <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors">{f.placeholder}</span>
                        </label>
                      ) : (
                        <input
                          type={f.type}
                          value={bodyValues[f.key] || ''}
                          onChange={(e) => setBodyValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 text-xs font-mono focus:outline-none focus:border-white/20"
                        />
                      )}
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

export default ApiPlayground;
