import React, { useState } from 'react';
import { 
  Video, 
  Users, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  FileSignature,
  Eye,
  Link,
  Filter,
  UserPlus
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import ProjectSwitcher from '../ProjectSwitcher';
import OrganizationSwitcher from '../OrganizationSwitcher';
import blackLogo from '../blacklogo.png';
import whiteLogo from '../whitelogo.png';

interface SidebarProps {
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
  onCollapsedChange,
  initialCollapsed = false,
  activeTab = 'dashboard',
  onTabChange
}) => {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  const navigationItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
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
      id: 'rules',
      label: 'Rules',
      icon: Filter,
      isActive: activeTab === 'rules',
      onClick: () => onTabChange?.('rules'),
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
      id: 'team',
      label: 'Team',
      icon: UserPlus,
      isActive: activeTab === 'team',
      onClick: () => onTabChange?.('team'),
    },
    {
      id: 'creators',
      label: 'Creators',
      icon: Video,
      isActive: activeTab === 'creators',
      onClick: () => onTabChange?.('creators'),
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
            'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-r-2 border-gray-300 dark:border-gray-600': item.isActive,
            'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700': !item.isActive,
          }
        )}
      >
        <Icon 
          className={clsx(
            'flex-shrink-0 w-5 h-5 transition-colors duration-200',
            {
              'text-gray-900 dark:text-white': item.isActive,
              'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300': !item.isActive,
            }
          )} 
        />
        {!isCollapsed && (
          <>
            <span className="ml-3 truncate">{item.label}</span>
            {item.badge && (
              <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-gray-900 bg-white dark:text-white dark:bg-gray-700 rounded-full">
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

      {/* Organization & Project Switchers */}
      {!isCollapsed && (
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 space-y-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
              Organization
            </label>
            <OrganizationSwitcher />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
              Project
            </label>
            <ProjectSwitcher onCreateProject={() => window.location.href = '/create-project'} />
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
      {!isCollapsed && user && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-3">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'User'} 
                className="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
              />
            ) : (
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                <span className="text-sm font-bold text-gray-900 dark:text-white">
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
        </div>
      )}

      {/* Collapsed User Profile */}
      {isCollapsed && user && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="w-full flex items-center justify-center">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'User'} 
                className="w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
              />
            ) : (
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  {user.displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default Sidebar;
