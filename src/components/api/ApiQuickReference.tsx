import React, { useState } from 'react';
import { Code2 } from 'lucide-react';

const API_BASE = 'https://viewtrack.app/api/v1';

const ApiQuickReference: React.FC = () => {
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
            <EndpointRow method="POST" path="/api/v1/videos" desc="Add video to track (sync: true to wait for data)" />
            <EndpointRow method="GET" path="/api/v1/videos/:id" desc="Get video details + snapshots" />
            <EndpointRow method="GET" path="/api/v1/accounts" desc="List tracked accounts" />
            <EndpointRow method="POST" path="/api/v1/accounts" desc="Add account to track" />
            <EndpointRow method="GET" path="/api/v1/analytics/overview" desc="Full analytics overview" />
            <EndpointRow method="GET" path="/api/v1/refreshes" desc="Refresh history & stats" />
            <EndpointRow method="GET" path="/api/v1/projects" desc="List projects" />
            <EndpointRow method="POST" path="/api/v1/projects" desc="Create a new project" />
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

export default ApiQuickReference;
