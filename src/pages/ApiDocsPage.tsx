import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface APIEndpoint {
  id: string;
  name: string;
  method: HTTPMethod;
  path: string;
  description: string;
  parameters?: Array<{ name: string; type: string; required: boolean; description: string }>;
  response?: string;
}

interface APISection {
  id: string;
  title: string;
  endpoints: APIEndpoint[];
}

const apiSections: APISection[] = [
  {
    id: 'tracked-accounts',
    title: 'Tracked Accounts',
    endpoints: [
      {
        id: 'list-accounts',
        name: 'List all tracked accounts',
        method: 'GET',
        path: '/api/accounts',
        description: 'Retrieve a list of all tracked social media accounts in your organization.',
        parameters: [
          { name: 'orgId', type: 'string', required: true, description: 'Organization ID' },
          { name: 'projectId', type: 'string', required: true, description: 'Project ID' },
          { name: 'platform', type: 'string', required: false, description: 'Filter by platform (instagram, tiktok, youtube, twitter)' }
        ],
        response: `{
  "success": true,
  "accounts": [
    {
      "id": "acc_123",
      "username": "example_user",
      "platform": "instagram",
      "followerCount": 125000,
      "totalVideos": 45
    }
  ]
}`
      },
      {
        id: 'add-account',
        name: 'Add tracked account',
        method: 'POST',
        path: '/api/accounts',
        description: 'Add a new social media account to track.',
        parameters: [
          { name: 'username', type: 'string', required: true, description: 'Account username' },
          { name: 'platform', type: 'string', required: true, description: 'Platform (instagram, tiktok, youtube, twitter)' },
          { name: 'accountType', type: 'string', required: false, description: 'Type: "my" or "competitor"' }
        ]
      },
      {
        id: 'get-account-count',
        name: 'Get total count of tracked accounts',
        method: 'GET',
        path: '/api/accounts/count',
        description: 'Get the total number of tracked accounts.'
      },
      {
        id: 'refresh-accounts',
        name: 'Refresh tracked accounts data',
        method: 'POST',
        path: '/api/accounts/refresh',
        description: 'Trigger a refresh of all tracked accounts data.'
      },
      {
        id: 'update-max-videos',
        name: 'Update account max videos limit',
        method: 'PUT',
        path: '/api/accounts/{accountId}/max-videos',
        description: 'Update the maximum number of videos to track for an account.'
      },
      {
        id: 'bulk-update-limits',
        name: 'Bulk update account max videos limits',
        method: 'PUT',
        path: '/api/accounts/bulk/max-videos',
        description: 'Update max video limits for multiple accounts at once.'
      }
    ]
  },
  {
    id: 'tracked-videos',
    title: 'Tracked Individual Videos',
    endpoints: [
      {
        id: 'list-videos',
        name: 'List all tracked videos',
        method: 'GET',
        path: '/api/videos',
        description: 'Retrieve all tracked videos with their performance metrics.',
        response: `{
  "success": true,
  "videos": [
    {
      "id": "vid_123",
      "title": "Amazing content",
      "platform": "instagram",
      "views": 50000,
      "likes": 2500,
      "comments": 150
    }
  ]
}`
      },
      {
        id: 'add-video',
        name: 'Add individual video',
        method: 'POST',
        path: '/api/videos',
        description: 'Add a single video to track by URL.'
      },
      {
        id: 'get-video',
        name: 'Get video details',
        method: 'GET',
        path: '/api/videos/{videoId}',
        description: 'Retrieve detailed information about a specific video.'
      },
      {
        id: 'delete-video',
        name: 'Delete tracked video',
        method: 'DELETE',
        path: '/api/videos/{videoId}',
        description: 'Remove a video from tracking.'
      },
      {
        id: 'bulk-delete-videos',
        name: 'Bulk delete videos',
        method: 'DELETE',
        path: '/api/videos/bulk',
        description: 'Delete multiple videos at once.'
      }
    ]
  },
  {
    id: 'account-analytics',
    title: 'Account Analytics',
    endpoints: [
      {
        id: 'account-overview',
        name: 'Get account analytics overview',
        method: 'GET',
        path: '/api/analytics/accounts/{accountId}',
        description: 'Get comprehensive analytics for a specific account.'
      },
      {
        id: 'account-growth',
        name: 'Get account growth metrics',
        method: 'GET',
        path: '/api/analytics/accounts/{accountId}/growth',
        description: 'Retrieve follower growth and engagement trends.'
      },
      {
        id: 'top-performers',
        name: 'Get top performing videos',
        method: 'GET',
        path: '/api/analytics/accounts/{accountId}/top-videos',
        description: 'Get the best performing videos for an account.'
      }
    ]
  },
  {
    id: 'video-analytics',
    title: 'Video Analytics',
    endpoints: [
      {
        id: 'video-snapshots',
        name: 'Get video performance snapshots',
        method: 'GET',
        path: '/api/analytics/videos/{videoId}/snapshots',
        description: 'Retrieve historical performance data for a video.'
      },
      {
        id: 'video-trends',
        name: 'Get video trend analysis',
        method: 'GET',
        path: '/api/analytics/videos/{videoId}/trends',
        description: 'Analyze view velocity and engagement trends.'
      },
      {
        id: 'compare-videos',
        name: 'Compare multiple videos',
        method: 'POST',
        path: '/api/analytics/videos/compare',
        description: 'Compare performance metrics across multiple videos.'
      }
    ]
  },
  {
    id: 'general-analytics',
    title: 'General Analytics',
    endpoints: [
      {
        id: 'dashboard-summary',
        name: 'Get dashboard summary',
        method: 'GET',
        path: '/api/analytics/dashboard',
        description: 'Get aggregated analytics for the dashboard.'
      },
      {
        id: 'platform-breakdown',
        name: 'Get platform performance breakdown',
        method: 'GET',
        path: '/api/analytics/platforms',
        description: 'Compare performance across different platforms.'
      },
      {
        id: 'export-analytics',
        name: 'Export analytics data',
        method: 'POST',
        path: '/api/analytics/export',
        description: 'Export analytics data to CSV format.'
      }
    ]
  },
  {
    id: 'projects',
    title: 'Projects',
    endpoints: [
      {
        id: 'list-projects',
        name: 'List all projects',
        method: 'GET',
        path: '/api/projects',
        description: 'Get all projects in your organization.'
      },
      {
        id: 'create-project',
        name: 'Create new project',
        method: 'POST',
        path: '/api/projects',
        description: 'Create a new project to organize your tracking.'
      },
      {
        id: 'update-project',
        name: 'Update project',
        method: 'PUT',
        path: '/api/projects/{projectId}',
        description: 'Update project details.'
      },
      {
        id: 'delete-project',
        name: 'Delete project',
        method: 'DELETE',
        path: '/api/projects/{projectId}',
        description: 'Permanently delete a project.'
      }
    ]
  },
  {
    id: 'organizations',
    title: 'Organizations',
    endpoints: [
      {
        id: 'get-organization',
        name: 'Get organization details',
        method: 'GET',
        path: '/api/organizations/{orgId}',
        description: 'Retrieve organization information.'
      },
      {
        id: 'update-organization',
        name: 'Update organization',
        method: 'PUT',
        path: '/api/organizations/{orgId}',
        description: 'Update organization settings.'
      },
      {
        id: 'usage-limits',
        name: 'Get usage limits',
        method: 'GET',
        path: '/api/organizations/{orgId}/limits',
        description: 'Check current usage and limits.'
      }
    ]
  }
];

const methodColors: Record<HTTPMethod, string> = {
  GET: 'bg-green-500/10 text-green-400 border-green-500/20',
  POST: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PUT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  DELETE: 'bg-red-500/10 text-red-400 border-red-500/20'
};

const codeLanguages = [
  { id: 'shell', name: 'Shell', icon: '$' },
  { id: 'node', name: 'Node.js', icon: 'JS' },
  { id: 'python', name: 'Python', icon: 'PY' },
  { id: 'ruby', name: 'Ruby', icon: 'RB' }
];

export default function ApiDocsPage() {
  const [activeEndpoint, setActiveEndpoint] = useState('list-accounts');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(apiSections.map(s => s.id)));
  const [selectedLanguage, setSelectedLanguage] = useState('shell');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const currentEndpoint = apiSections
    .flatMap(s => s.endpoints)
    .find(e => e.id === activeEndpoint);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const generateCodeSample = (endpoint: APIEndpoint | undefined, language: string) => {
    if (!endpoint) return '';

    if (language === 'shell') {
      return `curl -X ${endpoint.method} https://api.viewtrack.app${endpoint.path} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"${endpoint.method !== 'GET' ? ` \\
  -d '{"key": "value"}'` : ''}`;
    }

    if (language === 'node') {
      return `const response = await fetch('https://api.viewtrack.app${endpoint.path}', {
  method: '${endpoint.method}',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }${endpoint.method !== 'GET' ? `,
  body: JSON.stringify({ key: 'value' })` : ''}
});

const data = await response.json();`;
    }

    if (language === 'python') {
      return `import requests

response = requests.${endpoint.method.toLowerCase()}(
    'https://api.viewtrack.app${endpoint.path}',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    }${endpoint.method !== 'GET' ? `,
    json={'key': 'value'}` : ''}
)

data = response.json()`;
    }

    if (language === 'ruby') {
      return `require 'net/http'
require 'json'

uri = URI('https://api.viewtrack.app${endpoint.path}')
req = Net::HTTP::${endpoint.method.charAt(0) + endpoint.method.slice(1).toLowerCase()}.new(uri)
req['Authorization'] = 'Bearer YOUR_API_KEY'
req['Content-Type'] = 'application/json'${endpoint.method !== 'GET' ? `
req.body = {key: 'value'}.to_json` : ''}

response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
  http.request(req)
end

data = JSON.parse(response.body)`;
    }

    return '';
  };

  return (
    <div className="h-screen flex bg-[#0D0D0D] text-white overflow-hidden">
      {/* Left Sidebar - Navigation */}
      <div className="w-72 bg-[#111111] border-r border-white/5 flex flex-col overflow-hidden">
        {/* Logo/Header */}
        <div className="p-6 border-b border-white/5">
          <h1 className="text-xl font-bold text-white">ViewTrack API</h1>
          <p className="text-xs text-gray-500 mt-1">v1.0.0</p>
        </div>

        {/* Navigation Tree */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {apiSections.map((section) => (
            <div key={section.id} className="mb-6">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="flex items-center gap-2 w-full text-left mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-white transition-colors"
              >
                {expandedSections.has(section.id) ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                {section.title}
              </button>

              {/* Endpoints */}
              {expandedSections.has(section.id) && (
                <div className="space-y-1">
                  {section.endpoints.map((endpoint) => (
                    <button
                      key={endpoint.id}
                      onClick={() => {
                        setActiveEndpoint(endpoint.id);
                      }}
                      className={`
                        w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm
                        transition-all group
                        ${activeEndpoint === endpoint.id
                          ? 'bg-[#8B5CF6]/10 text-white border-l-2 border-[#8B5CF6]'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }
                      `}
                    >
                      <span className="flex-1 text-left truncate text-xs leading-relaxed">
                        {endpoint.name}
                      </span>
                      <span className={`
                        px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border
                        ${methodColors[endpoint.method]}
                      `}>
                        {endpoint.method}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Center - Documentation Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto p-12">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-2 py-1 bg-[#8B5CF6]/10 text-[#8B5CF6] text-xs font-mono rounded border border-[#8B5CF6]/20">
                v1.0.0
              </span>
              <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs font-mono rounded border border-green-500/20">
                OAS 3.1.1
              </span>
            </div>
            <h1 className="text-4xl font-bold mb-4">ViewTrack API</h1>
            <p className="text-lg text-gray-400 leading-relaxed">
              Monitor and analyze social media content across Instagram, TikTok, YouTube, and Twitter.
              Track performance metrics, manage accounts, and access comprehensive analytics.
            </p>
            <div className="mt-4 flex items-center gap-4">
              <a
                href="#"
                className="text-sm text-[#8B5CF6] hover:text-[#A78BFA] flex items-center gap-2 transition-colors"
              >
                Download OpenAPI Document
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Current Endpoint Details */}
          {currentEndpoint && (
            <div>
              {/* Endpoint Title */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`
                    px-3 py-1 rounded-md text-xs font-mono font-bold border
                    ${methodColors[currentEndpoint.method]}
                  `}>
                    {currentEndpoint.method}
                  </span>
                  <code className="text-sm font-mono text-gray-400">
                    {currentEndpoint.path}
                  </code>
                </div>
                <h2 className="text-3xl font-bold mb-3">{currentEndpoint.name}</h2>
                <p className="text-gray-400 leading-relaxed">
                  {currentEndpoint.description}
                </p>
              </div>

              {/* Parameters */}
              {currentEndpoint.parameters && currentEndpoint.parameters.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-4">Parameters</h3>
                  <div className="bg-[#1A1A1A] rounded-lg border border-white/5 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Name</th>
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Type</th>
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Required</th>
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentEndpoint.parameters.map((param, idx) => (
                          <tr key={idx} className="border-b border-white/5 last:border-0">
                            <td className="p-4">
                              <code className="text-sm font-mono text-[#8B5CF6]">{param.name}</code>
                            </td>
                            <td className="p-4">
                              <code className="text-xs font-mono text-gray-400">{param.type}</code>
                            </td>
                            <td className="p-4">
                              {param.required ? (
                                <span className="text-xs text-red-400 font-medium">Required</span>
                              ) : (
                                <span className="text-xs text-gray-500">Optional</span>
                              )}
                            </td>
                            <td className="p-4 text-sm text-gray-400">{param.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Response Example */}
              {currentEndpoint.response && (
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-4">Response Example</h3>
                  <div className="relative bg-[#1A1A1A] rounded-lg border border-white/5 p-4">
                    <button
                      onClick={() => copyCode(currentEndpoint.response!, 'response')}
                      className="absolute top-3 right-3 p-2 hover:bg-white/5 rounded transition-colors"
                    >
                      {copiedCode === 'response' ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <pre className="text-sm font-mono text-gray-300 overflow-x-auto custom-scrollbar pr-12">
                      <code>{currentEndpoint.response}</code>
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Code Samples */}
      <div className="w-96 bg-[#111111] border-l border-white/5 overflow-y-auto custom-scrollbar p-6">
        {/* Server Info */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Server</h3>
          <div className="bg-[#1A1A1A] rounded-lg border border-white/5 p-3">
            <code className="text-sm font-mono text-[#8B5CF6]">https://api.viewtrack.app</code>
          </div>
        </div>

        {/* Authentication */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Authentication</h3>
          <div className="bg-[#1A1A1A] rounded-lg border border-white/5 p-4">
            <div className="mb-2">
              <span className="text-xs text-gray-500">Bearer Token</span>
            </div>
            <code className="text-xs font-mono text-gray-400 block mb-2">Authorization: Bearer YOUR_API_KEY</code>
            <input
              type="text"
              placeholder="Enter your API key..."
              className="w-full bg-[#0D0D0D] border border-white/5 rounded px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-[#8B5CF6]/50"
            />
          </div>
        </div>

        {/* Code Samples */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Client Libraries</h3>
          
          {/* Language Tabs */}
          <div className="flex gap-1 mb-3">
            {codeLanguages.map((lang) => (
              <button
                key={lang.id}
                onClick={() => setSelectedLanguage(lang.id)}
                className={`
                  px-3 py-1.5 rounded-md text-xs font-mono transition-colors
                  ${selectedLanguage === lang.id
                    ? 'bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                {lang.name}
              </button>
            ))}
          </div>

          {/* Code Block */}
          <div className="relative bg-[#1A1A1A] rounded-lg border border-white/5 p-4">
            <button
              onClick={() => copyCode(generateCodeSample(currentEndpoint, selectedLanguage), 'code')}
              className="absolute top-3 right-3 p-2 hover:bg-white/5 rounded transition-colors z-10"
            >
              {copiedCode === 'code' ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <pre className="text-xs font-mono text-gray-300 overflow-x-auto custom-scrollbar pr-12">
              <code>{generateCodeSample(currentEndpoint, selectedLanguage)}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}

