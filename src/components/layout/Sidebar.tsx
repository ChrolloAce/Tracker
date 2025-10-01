import React, { useState } from 'react';
import { 
  Video, 
  Users, 
  Settings, 
  Bell, 
  Plus,
  ChevronLeft,
  ChevronRight,
  FileText,
  HelpCircle,
  FileSignature,
  Eye,
  Link,
  LogOut,
  Crown
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import blackLogo from '../blacklogo.png';
import whiteLogo from '../whitelogo.png';

interface SidebarProps {
  onAddVideo?: () => void;
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
  onCollapsedChange,
  initialCollapsed = false,
  activeTab = 'dashboard',
  onTabChange
}) => {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      try {
        await logout();
      } catch (error) {
        console.error('Failed to logout:', error);
      }
    }
  };

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
    {
      id: 'subscription',
      label: 'Upgrade',
      icon: Crown,
      isActive: activeTab === 'subscription',
      onClick: () => onTabChange?.('subscription'),
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
        {!isCollapsed ? (
          <div className="flex items-center space-x-3">
            <img 
              src={blackLogo} 
              alt="ViewTrack Logo" 
              className="w-8 h-8 object-contain dark:hidden"
            />
            <img 
              src={whiteLogo} 
              alt="ViewTrack Logo" 
              className="w-8 h-8 object-contain hidden dark:block"
            />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">ViewTrack</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Pro</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <img 
              src={blackLogo} 
              alt="ViewTrack" 
              className="w-8 h-8 object-contain dark:hidden"
            />
            <img 
              src={whiteLogo} 
              alt="ViewTrack" 
              className="w-8 h-8 object-contain hidden dark:block"
            />
          </div>
        )}
        <button
          onClick={() => {
            const newCollapsed = !isCollapsed;
            setIsCollapsed(newCollapsed);
            onCollapsedChange?.(newCollapsed);
          }}
          className={clsx(
            "p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors",
            isCollapsed && "absolute -right-3 top-5 bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700"
          )}
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
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={onAddVideo}
            className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 backdrop-blur-md bg-white/10 dark:bg-white/5 border border-gray-200/20 dark:border-white/10 text-gray-900 dark:text-white hover:bg-white/20 dark:hover:bg-white/10 hover:border-gray-300/30 dark:hover:border-white/20 shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Video
          </button>
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
      {!isCollapsed && user && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-3 mb-3">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'User'} 
                className="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                <span className="text-sm font-bold text-white">
                  {user.displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {user.displayName || 'User Account'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user.email}
              </p>
            </div>
          </div>
          
          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors duration-200"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* Collapsed User Profile */}
      {isCollapsed && user && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="w-full flex items-center justify-center p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
