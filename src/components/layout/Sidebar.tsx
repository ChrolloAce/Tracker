import React, { useState, useMemo, useEffect } from 'react';
import { 
  Video, 
  Users, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Link,
  Film,
  Puzzle,
  Trophy,
  X,
  LayoutDashboard,
  Boxes,
  UserPlus,
  DollarSign
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import ProjectSwitcher from '../ProjectSwitcher';
import OrganizationSwitcher from '../OrganizationSwitcher';
import CreateProjectModal from '../CreateProjectModal';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import { useUnreadCounts } from '../../hooks/useUnreadCounts';
import { Badge } from '../ui/Badge';
import RefreshCountdown from '../RefreshCountdown';
import newLogo from '/vtlogo.png';

interface SidebarProps {
  onCollapsedChange?: (collapsed: boolean) => void;
  initialCollapsed?: boolean;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  isMobileOpen?: boolean;
  onMobileToggle?: (open: boolean) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  badge?: number;
  loading?: boolean;
  isActive?: boolean;
  onClick?: () => void;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onCollapsedChange,
  initialCollapsed = false,
  activeTab: _unusedActiveTab,
  onTabChange: _unusedOnTabChange,
  isMobileOpen = false,
  onMobileToggle
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['tracking', 'manage', 'integrations'])); // Start with sections expanded
  const { can, loading: permissionsLoading } = usePermissions();
  const { userRole, currentOrgId, currentProjectId } = useAuth();
  const location = useLocation();
  const { unreadCounts, loading: loadingCounts } = useUnreadCounts(currentOrgId, currentProjectId);

  // Check if we're in demo mode
  const isDemoMode = location.pathname.startsWith('/demo');

  // Close mobile menu on route change
  useEffect(() => {
    if (isMobileOpen && onMobileToggle) {
      onMobileToggle(false);
    }
  }, [location.pathname]);

  // Dashboard item (standalone at top)
  const dashboardItem: NavItem | null = useMemo(() => {
    const baseHref = isDemoMode ? '/demo' : '';
    if (permissionsLoading || can.accessTab('dashboard')) {
      return {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        href: `${baseHref}/dashboard`,
      };
    }
    return null;
  }, [can, permissionsLoading, isDemoMode]);

  // Navigation sections with dropdown
  const navigationSections: NavSection[] = useMemo(() => {
    const baseHref = isDemoMode ? '/demo' : '';
    
    const sections: NavSection[] = [
      {
        id: 'tracking',
        label: 'Tracking',
        items: [
      {
        id: 'accounts',
        label: 'Tracked Accounts',
        icon: Users,
        href: `${baseHref}/accounts`,
        badge: unreadCounts.accounts,
        loading: loadingCounts.accounts,
      },
      {
        id: 'videos',
            label: 'Tracked Videos',
        icon: Film,
        href: `${baseHref}/videos`,
        badge: unreadCounts.videos,
        loading: loadingCounts.videos,
      },
      {
        id: 'analytics',
            label: 'Tracking Links',
        icon: Link,
        href: `${baseHref}/links`,
          },
        ]
      },
      {
        id: 'manage',
        label: 'Manage',
        items: [
      {
        id: 'creators',
        label: userRole === 'creator' ? 'Payouts' : 'Creators',
        icon: Video,
        href: `${baseHref}/creators`,
      },
      {
        id: 'campaigns',
        label: 'Campaigns',
        icon: Trophy,
        href: `${baseHref}/campaigns`,
          },
          {
            id: 'integrations',
            label: 'Integrations',
            icon: Boxes,
            href: `${baseHref}/integrations`,
          },
          {
            id: 'team',
            label: 'Team Members',
            icon: UserPlus,
            href: `${baseHref}/team`,
          },
        ]
      },
      {
        id: 'integrations-section',
        label: 'Integrations',
        items: [
          {
            id: 'revenue',
            label: 'Revenue',
            icon: DollarSign,
            href: `${baseHref}/revenue`,
      },
      {
        id: 'extension',
            label: 'Extensions',
        icon: Puzzle,
        href: `${baseHref}/extension`,
      },
        ]
      },
    ];

    // Filter items based on permissions
    if (!permissionsLoading && !isDemoMode) {
      sections.forEach(section => {
        section.items = section.items.filter(item => {
          if (item.id === 'accounts') return can.accessTab('trackedAccounts');
          if (item.id === 'videos') return can.accessTab('videos');
          if (item.id === 'analytics') return can.accessTab('trackedLinks');
          if (item.id === 'extension') return can.accessTab('extension');
          if (item.id === 'creators') return can.accessTab('creators');
          if (item.id === 'campaigns') return can.accessTab('campaigns');
          if (item.id === 'integrations') return can.accessTab('settings'); // Integrations under settings permissions
          if (item.id === 'team') return can.accessTab('settings'); // Team members under settings permissions
          if (item.id === 'revenue') return can.accessTab('settings'); // Revenue under settings permissions
          return true;
        });
      });
    }

    // In demo mode, filter out extension, integrations, team, and revenue
    if (isDemoMode) {
      sections.forEach(section => {
        section.items = section.items.filter(item => 
          item.id !== 'extension' && 
          item.id !== 'integrations' && 
          item.id !== 'team' && 
          item.id !== 'revenue'
        );
      });
    }

    // Remove empty sections
    return sections.filter(section => section.items.length > 0);
  }, [can, permissionsLoading, userRole, isDemoMode, unreadCounts, loadingCounts]);

  // Settings item (standalone at bottom)
  const settingsItem: NavItem | null = useMemo(() => {
    const baseHref = isDemoMode ? '/demo' : '';
    if (!isDemoMode && (permissionsLoading || can.accessTab('settings'))) {
      return {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        href: `${baseHref}/settings`,
      };
    }
    return null;
  }, [can, permissionsLoading, isDemoMode]);

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

  const NavItemComponent: React.FC<{ item: NavItem }> = ({ item }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.href || location.pathname.startsWith((item.href || '') + '/');
    
    if (!item.href) return null;
    
    return (
      <NavLink
        to={item.href}
        className={clsx(
          'w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group',
          {
            'bg-white/10 text-white border-l-2 border-white': isActive,
            'text-white/60 hover:bg-white/5 hover:text-white/80': !isActive,
          }
        )}
      >
        <Icon 
          className={clsx(
            'flex-shrink-0 w-5 h-5 transition-colors duration-200',
            {
              'text-white': isActive,
              'text-white/60 group-hover:text-white/80': !isActive,
            }
          )} 
        />
        {!isCollapsed && (
          <>
            <span className="ml-3 truncate">{item.label}</span>
            {(item.badge || item.loading) && (
              <div className="ml-auto">
                <Badge count={item.badge} loading={item.loading} />
              </div>
            )}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <>
    {/* Mobile Backdrop */}
    {isMobileOpen && (
      <div 
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={() => onMobileToggle?.(false)}
      />
    )}

    <div className={clsx(
      'fixed left-0 top-0 flex flex-col h-screen bg-white dark:bg-[#111111] border-r border-gray-200 dark:border-gray-800 transition-all duration-300 z-50',
      {
        'w-64': !isCollapsed,
        'w-16': isCollapsed,
        // Mobile: hide by default, show when open
        '-translate-x-full md:translate-x-0': !isMobileOpen,
        'translate-x-0': isMobileOpen,
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
        {/* Mobile Close Button */}
        <button
          onClick={() => onMobileToggle?.(false)}
          className="md:hidden p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        {/* Desktop Collapse Button */}
        <button
          onClick={() => {
            const newCollapsed = !isCollapsed;
            setIsCollapsed(newCollapsed);
            onCollapsedChange?.(newCollapsed);
          }}
          className={clsx(
            "hidden md:block p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors",
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

      {/* Project Switcher - Always visible on mobile when sidebar is open */}
      {(!isCollapsed || isMobileOpen) && (
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
      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
        {/* Dashboard - Standalone at top */}
        {dashboardItem && <NavItemComponent item={dashboardItem} />}

        {/* Section Dropdowns */}
        {navigationSections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          
          return (
            <div key={section.id} className="space-y-1">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors rounded-md',
                  'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5',
                  {'justify-center': isCollapsed}
                )}
              >
                {!isCollapsed && <span>{section.label}</span>}
                {!isCollapsed && (
                  isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )
                )}
              </button>

              {/* Section Items */}
              {isExpanded && (
                <div className="space-y-1 pl-2">
                  {section.items.map(item => (
                    <NavItemComponent key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Settings - Standalone at bottom with separator */}
        {settingsItem && (
          <>
            <div className="my-4 border-t border-gray-200 dark:border-gray-700" />
            <NavItemComponent item={settingsItem} />
          </>
        )}
      </nav>

      {/* Organization Switcher at Bottom - Show on mobile when open */}
      {(!isCollapsed || isMobileOpen) && (
        <OrganizationSwitcher />
      )}

      {/* Refresh Countdown */}
      {(!isCollapsed || isMobileOpen) && !isDemoMode && (
        <RefreshCountdown />
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
