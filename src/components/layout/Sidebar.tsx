import React, { useState } from 'react';
import { 
  BarChart3, 
  Video, 
  Users, 
  Settings, 
  Bell, 
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  FileText,
  HelpCircle,
  FileSignature,
  Eye,
  Link,
  RefreshCw
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  onAddVideo?: () => void;
  onTikTokSearch?: () => void;
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  initialCollapsed?: boolean;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  badge?: number;
  isActive?: boolean;
  onClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onAddVideo, 
  onTikTokSearch, 
  onRefreshAll, 
  isRefreshing,
  onCollapsedChange,
  initialCollapsed = false,
  activeTab = 'dashboard',
  onTabChange
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  const navigationItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Video Views',
      icon: Eye,
      isActive: activeTab === 'dashboard',
      onClick: () => onTabChange?.('dashboard'),
    },
    {
      id: 'accounts',
      label: 'Tracked Accounts',
      icon: Users,
      isActive: activeTab === 'accounts',
      onClick: () => onTabChange?.('accounts'),
    },
    {
      id: 'analytics',
      label: 'Tracked Links',
      icon: Link,
      isActive: activeTab === 'analytics',
      onClick: () => onTabChange?.('analytics'),
    },
    {
      id: 'creators',
      label: 'Creators',
      icon: Video,
      isActive: activeTab === 'creators',
      onClick: () => onTabChange?.('creators'),
    },
    {
      id: 'contracts',
      label: 'Contracts',
      icon: FileSignature,
      isActive: activeTab === 'contracts',
      onClick: () => onTabChange?.('contracts'),
    },
  ];

  const bottomItems: NavItem[] = [
    {
      id: 'reports',
      label: 'Reports',
      icon: FileText,
      isActive: activeTab === 'reports',
      onClick: () => onTabChange?.('reports'),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: 3,
      isActive: activeTab === 'notifications',
      onClick: () => onTabChange?.('notifications'),
    },
    {
      id: 'help',
      label: 'Help & Support',
      icon: HelpCircle,
      isActive: activeTab === 'help',
      onClick: () => onTabChange?.('help'),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      isActive: activeTab === 'settings',
      onClick: () => onTabChange?.('settings'),
    },
  ];

  const NavItemComponent: React.FC<{ item: NavItem }> = ({ item }) => {
    const Icon = item.icon;
    
    return (
      <button
        onClick={item.onClick}
        className={clsx(
          'w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group',
          {
            'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-r-2 border-blue-600': item.isActive,
            'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700': !item.isActive,
          }
        )}
      >
        <Icon 
          className={clsx(
            'flex-shrink-0 w-5 h-5 transition-colors duration-200',
            {
              'text-blue-600': item.isActive,
              'text-gray-400 group-hover:text-gray-600': !item.isActive,
            }
          )} 
        />
        {!isCollapsed && (
          <>
            <span className="ml-3 truncate">{item.label}</span>
            {item.badge && (
              <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                {item.badge}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  return (
    <div className={clsx(
      'fixed left-0 top-0 flex flex-col h-screen bg-white dark:bg-[#111111] border-r border-gray-200 dark:border-gray-800 transition-all duration-300 z-30',
      {
        'w-64': !isCollapsed,
        'w-16': isCollapsed,
      }
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">VideoAnalytics</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Pro</p>
            </div>
          </div>
        )}
        <button
          onClick={() => {
            const newCollapsed = !isCollapsed;
            setIsCollapsed(newCollapsed);
            onCollapsedChange?.(newCollapsed);
          }}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Quick Actions */}
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-100">
          <div className="space-y-2">
            <button
              onClick={onAddVideo}
              className="w-full flex items-center justify-center px-4 py-2.5 bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Video
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onTikTokSearch}
                className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors duration-200"
              >
                <Search className="w-4 h-4 mr-1" />
                Search
              </button>
              <button
                onClick={onRefreshAll}
                disabled={isRefreshing}
                className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors duration-200 disabled:opacity-50"
              >
                <RefreshCw className={clsx('w-4 h-4 mr-1', { 'animate-spin': isRefreshing })} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => (
          <NavItemComponent key={item.id} item={item} />
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-800 space-y-1">
        {bottomItems.map((item) => (
          <NavItemComponent key={item.id} item={item} />
        ))}
      </div>

      {/* User Profile */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">U</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                User Account
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                user@example.com
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
