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
  X,
  LayoutDashboard,
  UserPlus,
  Lock,
  MessageCircle,
  Shield,
  Flame,
  Bookmark,
  Key,
  DollarSign
} from 'lucide-react';
import SuperAdminService from '../../services/SuperAdminService';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import { useUnreadCounts } from '../../hooks/useUnreadCounts';
import { Badge } from '../ui/Badge';
import RefreshCountdown from '../RefreshCountdown';
import ProjectSwitcher from '../ProjectSwitcher';
import SupportModal from '../SupportModal';
import { useTheme } from '../../contexts/ThemeContext';
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
  locked?: boolean;
  comingSoon?: string;
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['tracking', 'manage', 'integrations', 'openclaw-section', 'discover-section']));
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const { theme } = useTheme();
  const { can, loading: permissionsLoading } = usePermissions();
  const { userRole, currentOrgId, currentProjectId } = useAuth();
  const location = useLocation();
  const { unreadCounts, loading: loadingCounts } = useUnreadCounts(currentOrgId, currentProjectId);

  // Check if we're in demo mode or view-as mode
  const isDemoMode = location.pathname.startsWith('/demo');
  const isViewAsMode = location.pathname.startsWith('/view-as');
  const viewAsOrgId = isViewAsMode ? location.pathname.split('/view-as/')[1]?.split('/')[0] : null;

  // Close mobile menu on route change
  useEffect(() => {
    if (isMobileOpen && onMobileToggle) {
      onMobileToggle(false);
    }
  }, [location.pathname]);

  // Determine base href based on mode
  const baseHref = useMemo(() => {
    if (isDemoMode) return '/demo';
    if (isViewAsMode && viewAsOrgId) return `/view-as/${viewAsOrgId}`;
    return '';
  }, [isDemoMode, isViewAsMode, viewAsOrgId]);

  // Dashboard item (standalone at top)
  const dashboardItem: NavItem | null = useMemo(() => {
    if (permissionsLoading || can.accessTab('dashboard')) {
      return {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        href: `${baseHref}/dashboard`,
      };
    }
    return null;
  }, [can, permissionsLoading, baseHref]);

  // Open Claw item (standalone)
  const openClawItem: NavItem | null = useMemo(() => {
    return {
      id: 'openclaw-keys',
      label: 'API Keys',
      icon: Key,
      href: `${baseHref}/openclaw`,
    };
  }, [baseHref]);

  // Creators item (standalone, right under Dashboard)
  const creatorsItem: NavItem | null = useMemo(() => {
    if (isDemoMode || permissionsLoading || can.accessTab('creators')) {
      return {
        id: 'creators',
        label: userRole === 'creator' ? 'Payouts' : 'Creators',
        icon: Video,
        href: `${baseHref}/creators`,
      };
    }
    return null;
  }, [can, permissionsLoading, baseHref, userRole, isDemoMode]);

  // Navigation sections with dropdown
  const navigationSections: NavSection[] = useMemo(() => {
    
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
      {
        id: 'revenue',
        label: 'Revenue',
        icon: DollarSign,
        href: `${baseHref}/revenue`,
          },
        ]
      },
      {
        id: 'manage',
        label: 'Manage',
        items: [
          {
            id: 'team',
            label: 'Team Members',
            icon: UserPlus,
            href: `${baseHref}/team`,
          },
        ]
      },
      {
        id: 'discover-section',
        label: 'Discover',
        items: [
          {
            id: 'viral',
            label: 'Viral Content',
            icon: Flame,
            href: `${baseHref}/viral`,
          },
          {
            id: 'saved',
            label: 'Saved',
            icon: Bookmark,
            href: `${baseHref}/saved`,
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
          if (item.id === 'integrations') return can.accessTab('settings'); // Integrations under settings permissions
          if (item.id === 'team') return can.accessTab('settings'); // Team members under settings permissions
          return true;
        });
      });
    }

    // In demo mode, filter out extension, integrations, and team
    if (isDemoMode) {
      sections.forEach(section => {
        section.items = section.items.filter(item =>
          item.id !== 'extension' &&
          item.id !== 'integrations' &&
          item.id !== 'team'
        );
      });
    }

    // For creators, hide everything except Dashboard and Settings
    // Dashboard shows their portal with videos, earnings, and submission
    if (userRole === 'creator') {
      sections.forEach(section => {
        section.items = section.items.filter(item =>
          item.id !== 'team' &&
          item.id !== 'accounts' &&
          item.id !== 'videos' &&
          item.id !== 'analytics' &&
          item.id !== 'extension' &&
          item.id !== 'creators' &&
          item.id !== 'revenue' &&
          item.id !== 'viral' && // Hide Discover/Viral Content for creators
          item.id !== 'saved' // Hide Saved for creators
        );
      });
    }

    // Remove empty sections
    return sections.filter(section => section.items.length > 0);
  }, [can, permissionsLoading, userRole, baseHref, unreadCounts, loadingCounts]);

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

  // Super Admin item (only for super admins)
  const { user } = useAuth();
  const isSuperAdmin = SuperAdminService.isSuperAdmin(user?.email);
  const superAdminItem: NavItem | null = useMemo(() => {
    if (isSuperAdmin && !isDemoMode) {
      return {
        id: 'super-admin',
        label: 'Super Admin',
        icon: Shield,
        href: '/super-admin',
      };
    }
    return null;
  }, [isSuperAdmin, isDemoMode]);


  // Support item (standalone at bottom)
  const supportItem: NavItem = useMemo(() => ({
    id: 'support',
    label: 'Support',
    icon: MessageCircle,
    onClick: () => setIsSupportModalOpen(true),
  }), []);

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
    
    // Handle items with onClick (like Support button)
    if (item.onClick) {
      return (
        <button
          onClick={item.onClick}
          className={clsx(
            'w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group',
            'text-content-secondary hover:bg-surface-hover hover:text-content'
          )}
        >
          <Icon
            className="flex-shrink-0 w-5 h-5 text-content-muted group-hover:text-content-secondary transition-colors duration-200"
          />
          {!isCollapsed && (
            <span className="ml-3 truncate">{item.label}</span>
          )}
        </button>
      );
    }
    
    if (!item.href) return null;
    
    return (
      <NavLink
        to={item.href}
        data-spotlight={`nav-${item.id}`}
        className={clsx(
          'w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group',
          {
            'bg-surface-active text-content font-semibold': isActive,
            'text-content-secondary hover:bg-surface-hover hover:text-content': !isActive,
          }
        )}
      >
        <Icon 
          className={clsx(
            'flex-shrink-0 w-5 h-5 transition-colors duration-200',
            {
              'text-content': isActive,
              'text-content-muted group-hover:text-content-secondary': !isActive,
            }
          )} 
        />
        {!isCollapsed && (
          <>
            <span className="ml-3 truncate">{item.label}</span>
            {item.comingSoon ? (
              <div className="ml-auto">
                <span className="text-[10px] font-bold bg-surface-tertiary text-content px-1.5 py-0.5 rounded border border-border-subtle whitespace-nowrap">
                  {item.comingSoon}
                </span>
              </div>
            ) : item.locked ? (
              <div className="ml-auto flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-400" />
              </div>
            ) : (item.badge || item.loading) ? (
              <div className="ml-auto">
                <Badge count={item.badge} loading={item.loading} />
              </div>
            ) : null}
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
      'fixed left-0 top-0 flex flex-col h-screen bg-surface-secondary border-r border-border transition-all duration-300 z-50',
      {
        'w-64': !isCollapsed,
        'w-16': isCollapsed,
        // Mobile: hide by default, show when open
        '-translate-x-full md:translate-x-0': !isMobileOpen,
        'translate-x-0': isMobileOpen,
      }
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!isCollapsed ? (
          <div className="flex items-center space-x-3">
            <img
              src={newLogo}
              alt="Viewtrack Logo"
              className={`w-10 h-10 object-contain ${theme === 'light' ? 'invert' : ''}`}
            />
            <div>
              <h1 className="text-lg font-bold text-content">Viewtrack</h1>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <img
              src={newLogo}
              alt="Viewtrack"
              className={`w-10 h-10 object-contain ${theme === 'light' ? 'invert' : ''}`}
            />
          </div>
        )}
        {/* Mobile Close Button */}
        <button
          onClick={() => onMobileToggle?.(false)}
          className="md:hidden p-1.5 text-content-muted hover:text-content-secondary hover:bg-surface-hover rounded-md transition-colors"
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
            "hidden md:block p-1.5 text-content-muted hover:text-content-secondary hover:bg-surface-hover rounded-md transition-colors",
            isCollapsed && "absolute -right-3 top-5 bg-surface-secondary shadow-md border border-border rounded-full"
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
      {!isDemoMode && <ProjectSwitcher isCollapsed={isCollapsed} />}

      {/* Navigation */}
      <nav data-spotlight="sidebar-nav" className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
        {/* Dashboard - Standalone at top */}
        {dashboardItem && <NavItemComponent item={dashboardItem} />}

        {/* Creators - Standalone right under Dashboard */}
        {creatorsItem && <NavItemComponent item={creatorsItem} />}

        {/* Section Dropdowns */}
        {navigationSections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          
          return (
            <div key={section.id} className="space-y-1">
              {/* Section Header - hidden when collapsed */}
              {!isCollapsed && (
                <button
                  data-section-id={section.id}
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors rounded-md text-content-muted hover:bg-surface-hover"
                >
                  <span>{section.label}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              )}

              {/* Section Items - no left padding when collapsed */}
              {(isExpanded || isCollapsed) && (
                <div className={clsx('space-y-1', { 'pl-2': !isCollapsed })}>
                  {section.items.map(item => (
                    <NavItemComponent key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Support & Settings - Standalone at bottom with separator */}
          <>
            <div className="my-4 border-t border-border" />
          {openClawItem && userRole !== 'creator' && <NavItemComponent item={openClawItem} />}
          {userRole !== 'creator' && <NavItemComponent item={supportItem} />}
          {settingsItem && <NavItemComponent item={settingsItem} />}
          {superAdminItem && <NavItemComponent item={superAdminItem} />}
          </>
      </nav>

      {/* Refresh Countdown */}
      {(!isCollapsed || isMobileOpen) && !isDemoMode && (
        <RefreshCountdown />
      )}
    </div>

    {/* Support Modal */}
    <SupportModal
      isOpen={isSupportModalOpen}
      onClose={() => setIsSupportModalOpen(false)}
    />
    </>
  );
};

export default Sidebar;
