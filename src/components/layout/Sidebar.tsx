import React, { useState, useMemo } from 'react';
import { 
  Video, 
  Users, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  Eye,
  Link,
  Film,
  Puzzle,
  Trophy
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import ProjectSwitcher from '../ProjectSwitcher';
import OrganizationSwitcher from '../OrganizationSwitcher';
import CreateProjectModal from '../CreateProjectModal';
import RefreshCountdown from '../RefreshCountdown';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import newLogo from '/vtlogo.png';

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
  showSeparatorBefore?: boolean; // Add separator line before this item
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onCollapsedChange,
  initialCollapsed = false,
  activeTab: _unusedActiveTab,
  onTabChange: _unusedOnTabChange
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const { can, loading: permissionsLoading } = usePermissions();
  const { userRole } = useAuth();
  const location = useLocation();

  // Show ALL navigation items immediately for instant UI, filter by permissions after loaded
  const navigationItems: NavItem[] = useMemo(() => {
    const allItems: NavItem[] = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: Eye,
        href: '/dashboard',
      },
      {
        id: 'accounts',
        label: 'Tracked Accounts',
        icon: Users,
        href: '/accounts',
      },
      {
        id: 'videos',
        label: 'Videos',
        icon: Film,
        href: '/videos',
      },
      {
        id: 'analytics',
        label: 'Tracked Links',
        icon: Link,
        href: '/links',
      },
      {
        id: 'creators',
        label: userRole === 'creator' ? 'Payouts' : 'Creators',
        icon: Video,
        href: '/creators',
      },
      {
        id: 'campaigns',
        label: 'Campaigns',
        icon: Trophy,
        href: '/campaigns',
        showSeparatorBefore: true, // Separator before campaigns
      },
      {
        id: 'extension',
        label: 'Extension',
        icon: Puzzle,
        href: '/extension',
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        href: '/settings',
      },
    ];

    // If permissions are still loading, show all items for instant UI
    if (permissionsLoading) {
      return allItems;
    }

    // After permissions load, filter items based on access
    return allItems.filter(item => {
      if (item.id === 'dashboard') return can.accessTab('dashboard');
      if (item.id === 'accounts') return can.accessTab('trackedAccounts');
      if (item.id === 'videos') return can.accessTab('videos');
      if (item.id === 'analytics') return can.accessTab('trackedLinks');
      if (item.id === 'creators') return can.accessTab('creators');
      if (item.id === 'campaigns') return can.accessTab('campaigns');
      if (item.id === 'extension') return can.accessTab('extension');
      if (item.id === 'settings') return can.accessTab('settings');
      return true;
    });
  }, [can, permissionsLoading, userRole, location]);

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
    <>
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
              src={newLogo} 
              alt="Viewtrack Logo" 
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Viewtrack</h1>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <img 
              src={newLogo} 
              alt="Viewtrack" 
              className="w-10 h-10 object-contain"
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

      {/* Project Switcher */}
      {!isCollapsed && (
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
              Project
            </label>
            <ProjectSwitcher onCreateProject={() => setShowCreateProject(true)} />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => (
          <React.Fragment key={item.id}>
            {item.showSeparatorBefore && (
              <div className="my-3 border-t border-gray-200 dark:border-gray-700" />
            )}
            <NavItemComponent item={item} />
          </React.Fragment>
        ))}
      </nav>

      {/* Refresh Countdown Timer */}
      {!isCollapsed && (
        <RefreshCountdown />
      )}

      {/* Organization Switcher at Bottom */}
      {!isCollapsed && (
        <OrganizationSwitcher />
      )}

    </div>

    {/* Create Project Modal */}
    <CreateProjectModal
      isOpen={showCreateProject}
      onClose={() => setShowCreateProject(false)}
      onSuccess={() => {
        setShowCreateProject(false);
        window.location.reload(); // Refresh to load new project
      }}
    />
    </>
  );
};

export default Sidebar;
