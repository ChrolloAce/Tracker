import React, { useState } from 'react';
import { 
  BarChart3, 
  Video, 
  TrendingUp, 
  Users, 
  Settings, 
  Bell, 
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Home,
  Calendar,
  FileText,
  HelpCircle
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  onAddVideo?: () => void;
  onTikTokSearch?: () => void;
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
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
  isRefreshing 
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState('dashboard');

  const navigationItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      isActive: activeItem === 'dashboard',
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      isActive: activeItem === 'analytics',
    },
    {
      id: 'videos',
      label: 'Videos',
      icon: Video,
      badge: 12,
      isActive: activeItem === 'videos',
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: TrendingUp,
      isActive: activeItem === 'performance',
    },
    {
      id: 'audience',
      label: 'Audience',
      icon: Users,
      isActive: activeItem === 'audience',
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: Calendar,
      isActive: activeItem === 'calendar',
    },
  ];

  const bottomItems: NavItem[] = [
    {
      id: 'reports',
      label: 'Reports',
      icon: FileText,
      isActive: activeItem === 'reports',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: 3,
      isActive: activeItem === 'notifications',
    },
    {
      id: 'help',
      label: 'Help & Support',
      icon: HelpCircle,
      isActive: activeItem === 'help',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      isActive: activeItem === 'settings',
    },
  ];

  const handleItemClick = (itemId: string) => {
    setActiveItem(itemId);
  };

  const NavItemComponent: React.FC<{ item: NavItem }> = ({ item }) => {
    const Icon = item.icon;
    
    return (
      <button
        onClick={() => handleItemClick(item.id)}
        className={clsx(
          'w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group',
          {
            'bg-blue-50 text-blue-700 border-r-2 border-blue-600': item.isActive,
            'text-gray-600 hover:text-gray-900 hover:bg-gray-50': !item.isActive,
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
      'flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-300',
      {
        'w-64': !isCollapsed,
        'w-16': isCollapsed,
      }
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">VideoAnalytics</h1>
              <p className="text-xs text-gray-500">Dashboard</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
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
              className="w-full flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Video
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onTikTokSearch}
                className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
              >
                <Search className="w-4 h-4 mr-1" />
                Search
              </button>
              <button
                onClick={onRefreshAll}
                disabled={isRefreshing}
                className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200 disabled:opacity-50"
              >
                <TrendingUp className={clsx('w-4 h-4 mr-1', { 'animate-spin': isRefreshing })} />
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
      <div className="px-3 py-4 border-t border-gray-200 space-y-1">
        {bottomItems.map((item) => (
          <NavItemComponent key={item.id} item={item} />
        ))}
      </div>

      {/* User Profile */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">U</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                User Account
              </p>
              <p className="text-xs text-gray-500 truncate">
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
