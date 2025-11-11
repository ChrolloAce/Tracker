import React, { useState } from 'react';
import { Search, Plus, Settings, User, Hash, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import ProjectSwitcher from '../ProjectSwitcher';
import CreateProjectModal from '../CreateProjectModal';

interface TopNavigationProps {
  onAddVideo: () => void;
  onTikTokSearch: () => void;
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
  isDemoMode?: boolean;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({ onAddVideo, onTikTokSearch, onRefreshAll, isRefreshing = false, isDemoMode = false }) => {
  const [showCreateProject, setShowCreateProject] = useState(false);

  return (
    <>
      <header className="bg-white dark:bg-[#161616] border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left section - Logo & Project Switcher */}
          <div className="flex items-center space-x-8">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">VT</span>
              </div>
              <span className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">
                ViewTrack
              </span>
            </div>
            
            {/* Project Switcher */}
            <ProjectSwitcher />
          </div>

          {/* Center section - Search */}
          <div className="flex-1 max-w-lg mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search data..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Right section - Actions and Profile */}
          <div className="flex items-center space-x-4">
            <Button 
              variant="secondary" 
              disabled={isRefreshing || !onRefreshAll}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh All'}</span>
            </Button>
            
            <Button 
              onClick={onTikTokSearch} 
              variant="secondary" 
              className="flex items-center space-x-2"
            >
              <Hash className="w-4 h-4" />
              <span>Search TikTok</span>
            </Button>
            
            <div className="relative group">
              <Button 
                onClick={isDemoMode ? undefined : onAddVideo} 
                className="flex items-center space-x-2"
                disabled={isDemoMode}
                title={isDemoMode ? "You can't add videos in demo mode - this is not your organization" : "Add Video"}
              >
              <Plus className="w-4 h-4" />
              <span>Add Video</span>
            </Button>
              {isDemoMode && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  Can't add videos - not your organization
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              
              <button className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
      />
    </>
  );
};
