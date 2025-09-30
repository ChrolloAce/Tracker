import React from 'react';
import { FileText, Plus, Search, Filter } from 'lucide-react';

/**
 * ContractsPage Component
 * 
 * Purpose: Display and manage contracts (empty placeholder for now)
 * Future features: Contract list, creation, editing, status tracking
 */
const ContractsPage: React.FC = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              Contracts
            </h1>
            <p className="mt-2 text-gray-600">
              Manage your brand deals and sponsorship contracts
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200">
            <Plus className="w-4 h-4" />
            New Contract
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="mb-6 flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search contracts..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200">
          <Filter className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Filter</span>
        </button>
      </div>

      {/* Empty State */}
      <div className="bg-white rounded-xl border border-gray-200 p-12">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Contracts Yet
          </h3>
          <p className="text-gray-600 mb-6">
            Start by creating your first contract to track brand deals, sponsorships, and collaboration agreements.
          </p>
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200">
            <Plus className="w-5 h-5" />
            Create Your First Contract
          </button>
        </div>
      </div>

      {/* Future Sections (commented for reference) */}
      {/*
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Active Contracts</span>
            <span className="text-2xl font-bold text-green-600">0</span>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Pending</span>
            <span className="text-2xl font-bold text-yellow-600">0</span>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Value</span>
            <span className="text-2xl font-bold text-blue-600">$0</span>
          </div>
        </div>
      </div>
      */}
    </div>
  );
};

export default ContractsPage;
