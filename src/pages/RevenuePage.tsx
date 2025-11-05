import React, { useState } from 'react';
import { Plus, DollarSign } from 'lucide-react';

const RevenuePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'connections' | 'analytics'>('connections');

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6">
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

        <button className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-white/90 text-black rounded-lg font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Add Connection
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        {/* Table Header */}
        <div className="bg-white/5 border-b border-white/10">
          <div className="grid grid-cols-7 gap-4 px-6 py-3 text-xs font-medium text-white/60 uppercase tracking-wider">
            <div>Provider</div>
            <div>App Name</div>
            <div>App ID</div>
            <div>Status</div>
            <div>Last Sync</div>
            <div>Connected at</div>
            <div>Connected by</div>
          </div>
        </div>

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

        {/* Footer */}
        <div className="bg-white/5 border-t border-white/10 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <span>Items per page:</span>
            <select className="bg-white/10 text-white border border-white/20 rounded px-2 py-1 text-sm">
              <option>10</option>
              <option>25</option>
              <option>50</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-white/60">Page 1 of 1</span>
            <div className="flex gap-1">
              <button
                disabled
                className="px-3 py-1 text-sm text-white/40 border border-white/20 rounded bg-white/5 cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled
                className="px-3 py-1 text-sm text-white/40 border border-white/20 rounded bg-white/5 cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenuePage;

