import React, { useState } from 'react';
import { Copy, Check, ChevronRight, ChevronDown } from 'lucide-react';

interface ApiEndpoint {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
}

interface ApiSection {
  title: string;
  endpoints: ApiEndpoint[];
  isOpen: boolean;
}

const ApiDocsPage: React.FC = () => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('shell');
  const [sections, setSections] = useState<ApiSection[]>([
    {
      title: 'Accounts',
      isOpen: true,
      endpoints: [
        { name: 'List all tracked accounts', method: 'GET', path: '/v1/accounts' },
        { name: 'Add tracked account', method: 'POST', path: '/v1/accounts' },
        { name: 'Get account details', method: 'GET', path: '/v1/accounts/{id}' },
        { name: 'Delete tracked account', method: 'DELETE', path: '/v1/accounts/{id}' },
      ]
    },
    {
      title: 'Videos',
      isOpen: false,
      endpoints: [
        { name: 'List all tracked videos', method: 'GET', path: '/v1/videos' },
        { name: 'Add video to track', method: 'POST', path: '/v1/videos' },
        { name: 'Get video details', method: 'GET', path: '/v1/videos/{id}' },
        { name: 'Delete tracked video', method: 'DELETE', path: '/v1/videos/{id}' },
      ]
    },
    {
      title: 'Analytics',
      isOpen: false,
      endpoints: [
        { name: 'Get analytics overview', method: 'GET', path: '/v1/analytics/overview' },
      ]
    },
    {
      title: 'Projects',
      isOpen: false,
      endpoints: [
        { name: 'List all projects', method: 'GET', path: '/v1/projects' },
        { name: 'Create new project', method: 'POST', path: '/v1/projects' },
      ]
    },
  ]);

  const toggleSection = (index: number) => {
    setSections(prev => prev.map((section, i) => 
      i === index ? { ...section, isOpen: !section.isOpen } : section
    ));
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'POST': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'PUT': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'DELETE': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const codeExamples = {
    shell: `curl -X GET "https://viewtrack.app/api/v1/accounts" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    
    javascript: `const response = await fetch('https://viewtrack.app/api/v1/accounts', {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();`,

    python: `import requests

headers = {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
}

response = requests.get(
    'https://viewtrack.app/api/v1/accounts',
    headers=headers
)

data = response.json()`,

    ruby: `require 'net/http'
require 'json'

uri = URI('https://viewtrack.app/api/v1/accounts')
request = Net::HTTP::Get.new(uri)
request['x-api-key'] = 'YOUR_API_KEY'
request['Content-Type'] = 'application/json'

response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
  http.request(request)
end

data = JSON.parse(response.body)`
  };

  return (
    <div className="flex h-screen bg-[#161616] text-white overflow-hidden">
      {/* Left Sidebar - Navigation */}
      <div className="w-[280px] bg-[#111111] border-r border-white/5 overflow-y-auto flex-shrink-0">
        <div className="p-6">
          <h1 className="text-lg font-bold text-white mb-2">ViewTrack API</h1>
          <p className="text-xs text-gray-500">v1.0.0</p>
        </div>

        <nav className="px-3 pb-8">
          {/* Introduction */}
          <div className="mb-6">
            <div className="px-3 mb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Introduction</h3>
            </div>
            <a href="#intro" className="block px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors">
              Getting Started
            </a>
            <a href="#auth" className="block px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors">
              Authentication
            </a>
          </div>

          {/* API Sections */}
          {sections.map((section, index) => (
            <div key={index} className="mb-4">
              <button
                onClick={() => toggleSection(index)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded transition-colors"
              >
                <span>{section.title}</span>
                {section.isOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
              
              {section.isOpen && (
                <div className="mt-1 space-y-0.5">
                  {section.endpoints.map((endpoint, endpointIndex) => (
                    <a
                      key={endpointIndex}
                      href={`#${endpoint.path}`}
                      className="group flex items-center justify-between px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors pl-6"
                    >
                      <span className="truncate flex-1">{endpoint.name}</span>
                      <span className={`ml-2 px-1.5 py-0.5 text-[10px] font-bold uppercase rounded border ${getMethodColor(endpoint.method)} flex-shrink-0`}>
                        {endpoint.method}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Center - Main Documentation */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-12">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-2 py-1 text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded">
                v1.0.0
              </span>
              <span className="px-2 py-1 text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded">
                OAS 3.1.1
              </span>
            </div>
            
            <h1 className="text-4xl font-bold text-white mb-4">ViewTrack API</h1>
            
            <p className="text-lg text-gray-400 mb-6">
              API for ViewTrack - Short-form video analytics platform for TikTok, Instagram, and YouTube.
            </p>

            <p className="text-sm text-gray-500 mb-4">
              Authenticate using your API key in the <code className="px-2 py-1 bg-[#1F1F1F] rounded text-purple-400">x-api-key</code> header. 
              Get your API key from API Keys in the ViewTrack dashboard.
            </p>

            <a href="#" className="text-sm text-purple-400 hover:text-purple-300 underline">
              Download OpenAPI Document →
            </a>
          </div>

          {/* Introduction Section */}
          <section id="intro" className="mb-16">
            <h2 className="text-2xl font-bold text-white mb-4">Getting Started</h2>
            <div className="bg-[#1F1F1F] rounded-lg p-6 border border-white/5">
              <p className="text-gray-300 mb-4">
                The ViewTrack API is organized around REST. Our API has predictable resource-oriented URLs, 
                accepts JSON-encoded request bodies, returns JSON-encoded responses, and uses standard HTTP 
                response codes, authentication, and verbs.
              </p>
              <p className="text-gray-300">
                You can use the ViewTrack API in test mode, which doesn't affect your live data. The API key 
                you use to authenticate the request determines whether the request is live mode or test mode.
              </p>
            </div>
          </section>

          {/* Authentication Section */}
          <section id="auth" className="mb-16">
            <h2 className="text-2xl font-bold text-white mb-4">Authentication</h2>
            <div className="bg-[#1F1F1F] rounded-lg p-6 border border-white/5">
              <p className="text-gray-300 mb-4">
                The ViewTrack API uses API keys to authenticate requests. You can view and manage your API keys 
                in the ViewTrack Dashboard.
              </p>
              <p className="text-gray-300 mb-6">
                Your API keys carry many privileges, so be sure to keep them secure! Do not share your secret 
                API keys in publicly accessible areas such as GitHub, client-side code, and so forth.
              </p>
              
              <div className="bg-[#0D0D0D] rounded-lg p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Example Request</span>
                  <button 
                    onClick={() => handleCopy(codeExamples[selectedLanguage as keyof typeof codeExamples], 'auth-example')}
                    className="p-1.5 hover:bg-white/5 rounded transition-colors"
                  >
                    {copiedCode === 'auth-example' ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
                <pre className="text-sm text-gray-300 font-mono overflow-x-auto">
                  <code>{codeExamples[selectedLanguage as keyof typeof codeExamples]}</code>
                </pre>
              </div>
            </div>
          </section>

          {/* API Endpoints Documentation */}
          <section className="space-y-12">
            {sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="space-y-6">
                <h2 className="text-2xl font-bold text-white">{section.title}</h2>
                <p className="text-gray-400 -mt-2">Manage and monitor {section.title.toLowerCase()}</p>
                
                {section.endpoints.map((endpoint, endpointIndex) => (
                  <div 
                    key={endpointIndex}
                    id={endpoint.path}
                    className="bg-[#1F1F1F] rounded-lg border border-white/5 overflow-hidden"
                  >
                    <div className="p-6 border-b border-white/5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-2">{endpoint.name}</h3>
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 text-xs font-bold uppercase rounded border ${getMethodColor(endpoint.method)}`}>
                              {endpoint.method}
                            </span>
                            <code className="text-sm text-gray-400 font-mono">
                              {endpoint.path}
                            </code>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400">
                        {endpoint.method === 'GET' && 'Retrieve information about '}
                        {endpoint.method === 'POST' && 'Create or add new '}
                        {endpoint.method === 'PUT' && 'Update existing '}
                        {endpoint.method === 'DELETE' && 'Remove '}
                        {endpoint.name.toLowerCase()}.
                      </p>
                    </div>
                    
                    <div className="p-6">
                      <h4 className="text-sm font-semibold text-white mb-3">Parameters</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-4">
                          <code className="text-purple-400 font-mono">x-api-key</code>
                          <span className="text-gray-500">string</span>
                          <span className="text-red-400 text-xs">required</span>
                          <span className="text-gray-400 flex-1">Your API key for authentication</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>
        </div>
      </div>

      {/* Right Sidebar - Code & Details */}
      <div className="w-[340px] bg-[#111111] border-l border-white/5 overflow-y-auto flex-shrink-0 p-6">
        <div className="space-y-6">
          {/* Server */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Server</h3>
            <div className="bg-[#1F1F1F] rounded-lg p-3 border border-white/5">
              <p className="text-sm text-white font-mono">https://viewtrack.app/api/v1</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">API Server</p>
          </div>

          {/* Authentication */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Authentication <span className="text-red-400">Required</span>
            </h3>
            <div className="bg-[#1F1F1F] rounded-lg p-4 border border-white/5 space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Name:</p>
                <code className="text-sm text-purple-400 font-mono">x-api-key</code>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Value:</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm text-gray-400 font-mono truncate flex-1">
                    QUxMIFIPVlgQkFT...
                  </code>
                  <button className="p-1 hover:bg-white/5 rounded">
                    <Copy className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              API key authentication. Use your API key in the x-api-key header.
            </p>
          </div>

          {/* Client Libraries */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Client Libraries</h3>
            <div className="flex gap-2 mb-3 flex-wrap">
              {['shell', 'javascript', 'python', 'ruby'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    selectedLanguage === lang
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {lang === 'shell' ? 'Shell' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                </button>
              ))}
            </div>
            
            <div className="bg-[#0D0D0D] rounded-lg border border-white/5 overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-white/5">
                <span className="text-xs text-gray-500 uppercase tracking-wider">
                  {selectedLanguage === 'shell' ? 'Shell' : selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1)} curl
                </span>
                <button 
                  onClick={() => handleCopy(codeExamples[selectedLanguage as keyof typeof codeExamples], 'code-sample')}
                  className="p-1 hover:bg-white/5 rounded transition-colors"
                >
                  {copiedCode === 'code-sample' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-gray-500" />
                  )}
                </button>
              </div>
              <div className="p-4 overflow-x-auto">
                <pre className="text-xs text-gray-300 font-mono">
                  <code>{codeExamples[selectedLanguage as keyof typeof codeExamples]}</code>
                </pre>
              </div>
            </div>
          </div>

          {/* Response Example */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Response</h3>
            <div className="bg-[#0D0D0D] rounded-lg border border-white/5 p-4">
              <pre className="text-xs text-gray-300 font-mono overflow-x-auto">
{`{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "acc_123",
        "username": "example",
        "platform": "tiktok",
        "totalVideos": 42
      }
    ]
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiDocsPage;
