import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { 
  ArrowLeft, ChevronDown, Search, Filter, CheckCircle2, Circle, Plus, Trash2,
  Play, Heart, MessageCircle, Share2, Video, AtSign, Activity, DollarSign, Download, Link as LinkIcon, Edit2, RefreshCw,
  Users, Clock, TrendingUp, BarChart3, X, Pencil, CheckCircle
} from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import { Modal } from '../components/ui/Modal';
import { VideoSubmissionsTable } from '../components/VideoSubmissionsTable';
import { AddVideoModal } from '../components/AddVideoModal';
import { AddTypeSelector } from '../components/AddTypeSelector';
import { TikTokSearchModal } from '../components/TikTokSearchModal';
import KPICards from '../components/KPICards';
import { KPICardEditor } from '../components/KPICardEditor';
import { DraggableSection } from '../components/DraggableSection';
import DateRangeFilter, { DateFilterType } from '../components/DateRangeFilter';
import VideoAnalyticsModal from '../components/VideoAnalyticsModal';
import { MarkAsReadService } from '../services/MarkAsReadService';
import TopPerformersSection from '../components/TopPerformersSection';
import TopPerformersRaceChart from '../components/TopPerformersRaceChart';
import HeatmapByHour from '../components/HeatmapByHour';
import TopTeamCreatorsList from '../components/TopTeamCreatorsList';
import TopPlatformsRaceChart from '../components/TopPlatformsRaceChart';
import ComparisonGraph from '../components/ComparisonGraph';
import PostingActivityHeatmap from '../components/PostingActivityHeatmap';
import DayVideosModal from '../components/DayVideosModal';
import { BlurEmptyState } from '../components/ui/BlurEmptyState';
import AccountsPage, { AccountsPageRef } from '../components/AccountsPage';
import SettingsPage from '../components/SettingsPage';
import SubscriptionPage from '../components/SubscriptionPage';
import CronManagementPage from '../components/CronManagementPage';
import TrackedLinksPage, { TrackedLinksPageRef } from '../components/TrackedLinksPage';
import CreatorPortalPage from '../components/CreatorPortalPage';
import CreatorsManagementPage, { CreatorsManagementPageRef } from '../components/CreatorsManagementPage';
import CampaignsManagementPage from '../components/CampaignsManagementPage';
import TeamManagementPage from '../components/TeamManagementPage';
import RevenueManagementPage from '../components/RevenueManagementPage';
import SelectCreatorModal from '../components/SelectCreatorModal';
import PaywallOverlay from '../components/PaywallOverlay';
import DemoBanner from '../components/DemoBanner';
import { CampaignStatus } from '../types/campaigns';
import ExtensionPromoModal from '../components/ExtensionPromoModal';
import RevenueIntegrationsModal from '../components/RevenueIntegrationsModal';
import SignOutModal from '../components/SignOutModal';
import OrganizationService from '../services/OrganizationService';
import SubscriptionService from '../services/SubscriptionService';
import DemoOrgService from '../services/DemoOrgService';
import CreatorLinksService from '../services/CreatorLinksService';
import DashboardPreferencesService from '../services/DashboardPreferencesService';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import { PlatformIcon } from '../components/ui/PlatformIcon';
import { VideoSubmission, InstagramVideoData } from '../types';
import DateFilterService from '../services/DateFilterService';
import ThemeService from '../services/ThemeService';
import profileAnimation from '../../public/lottie/Profile.json';
import videoMaterialAnimation from '../../public/lottie/Posting Picture.json';
import FirestoreDataService from '../services/FirestoreDataService';
import LinkClicksService, { LinkClick } from '../services/LinkClicksService';
import RulesService from '../services/RulesService';
import RevenueDataService from '../services/RevenueDataService';
import { RevenueMetrics, RevenueIntegration } from '../types/revenue';
import { cssVariables } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { useDemoContext } from './DemoPage';
import { Timestamp, collection, getDocs, onSnapshot, query, where, orderBy, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../services/firebase';
import { fixVideoPlatforms } from '../services/FixVideoPlatform';
import { TrackedAccount, TrackedLink } from '../types/firestore';
import { TrackingRule, RuleCondition, RuleConditionType } from '../types/rules';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Skeleton Loader Component for fast loading UX
const DashboardSkeleton: React.FC<{ height?: string }> = ({ height = 'h-96' }) => (
  <div className={`${height} bg-zinc-900/40 rounded-2xl border border-white/5 animate-pulse`}>
    <div className="p-6 space-y-4">
      <div className="h-6 bg-white/5 rounded w-1/4"></div>
      <div className="h-4 bg-white/5 rounded w-1/2"></div>
      <div className="space-y-3 mt-6">
        <div className="h-20 bg-white/5 rounded"></div>
        <div className="h-20 bg-white/5 rounded"></div>
        <div className="h-20 bg-white/5 rounded"></div>
      </div>
    </div>
  </div>
);

// Helper function to generate table header based on date filter
const getVideoTableHeader = (dateFilter: DateFilterType): string => {
  switch (dateFilter) {
    case 'today':
      return 'New Videos Today';
    case 'yesterday':
      return 'Videos from Yesterday';
    case 'last7days':
      return 'New Videos Last 7 Days';
    case 'last14days':
      return 'New Videos Last 14 Days';
    case 'last30days':
      return 'New Videos Last 30 Days';
    case 'last90days':
      return 'New Videos Last 90 Days';
    case 'mtd':
      return 'New Videos This Month';
    case 'ytd':
      return 'New Videos This Year';
    case 'all':
      return 'All Videos';
    case 'custom':
      return 'New Videos (Custom Range)';
    default:
      return 'Recent Videos';
  }
};

function DashboardPage({ initialTab, initialSettingsTab }: { initialTab?: string; initialSettingsTab?: string } = {}) {
  // Get authentication state, current organization, and current project
  const { user, currentOrgId: authOrgId, currentProjectId: authProjectId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we're in demo mode - demo IDs ALWAYS override auth IDs
  let demoContext;
  try {
    demoContext = useDemoContext();
  } catch {
    demoContext = { isDemoMode: false, demoOrgId: '', demoProjectId: '' };
  }
  
  const isDemoMode = demoContext.isDemoMode;
  
  // CRITICAL: Use demo IDs if in demo mode, IGNORE auth IDs completely
  const currentOrgId = isDemoMode ? demoContext.demoOrgId : authOrgId;
  const currentProjectId = isDemoMode ? demoContext.demoProjectId : authProjectId;
  
  // Force override check
  if (isDemoMode) {
    console.log('🎭 DEMO MODE ACTIVE - Using hardcoded demo IDs');
    console.log('Demo Org ID:', demoContext.demoOrgId);
    console.log('Demo Project ID:', demoContext.demoProjectId);
  }
  
  console.log('🔍 Dashboard Data Source:', { 
    isDemoMode, 
    usingOrgId: currentOrgId, 
    usingProjectId: currentProjectId,
    authOrgId, 
    authProjectId,
    demoOrgId: demoContext.demoOrgId,
    demoProjectId: demoContext.demoProjectId
  });

  // Subscription & Paywall State
  const [showPaywall, setShowPaywall] = useState(false);
  const [isDemoOrg, setIsDemoOrg] = useState(isDemoMode);

  // State
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [linkClicks, setLinkClicks] = useState<LinkClick[]>([]);
  const [links, setLinks] = useState<TrackedLink[]>([]);
  const [trackedAccounts, setTrackedAccounts] = useState<TrackedAccount[]>([]);
  const [allRules, setAllRules] = useState<TrackingRule[]>([]);
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics | null>(null);
  const [revenueIntegrations, setRevenueIntegrations] = useState<RevenueIntegration[]>([]);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [showCreateRuleForm, setShowCreateRuleForm] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [conditions, setConditions] = useState<RuleCondition[]>([
    { id: '1', type: 'description_contains', value: '', operator: 'AND' }
  ]);
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTikTokSearchOpen, setIsTikTokSearchOpen] = useState(false);
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<'all' | CampaignStatus>('all');
  const [campaignCounts, setCampaignCounts] = useState({ active: 0, draft: 0, completed: 0, cancelled: 0 });
  
  // Loading/pending state for immediate UI feedback
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [pendingVideos, setPendingVideos] = useState<VideoSubmission[]>([]);
  const [pendingAccounts, setPendingAccounts] = useState<TrackedAccount[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilterType>(() => {
    const saved = localStorage.getItem('dashboardDateFilter');
    return (saved as DateFilterType) || 'last30days';
  });
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(() => {
    const saved = localStorage.getItem('dashboardCustomDateRange');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        startDate: new Date(parsed.startDate),
        endDate: new Date(parsed.endDate)
      };
    }
    return undefined;
  });
  const [selectedVideoForAnalytics, setSelectedVideoForAnalytics] = useState<VideoSubmission | null>(null);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month' | 'year'>(() => {
    const saved = localStorage.getItem('dashboardGranularity');
    return (saved as 'day' | 'week' | 'month' | 'year') || 'day';
  });
  
  // Day Videos Modal state (for account clicks from race chart)
  const [isDayVideosModalOpen, setIsDayVideosModalOpen] = useState(false);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string | undefined>();
  const [dayVideosDate, setDayVideosDate] = useState<Date>(new Date());
  const activeTab = initialTab || 'dashboard';
  const [isEditingLayout, setIsEditingLayout] = useState(false);

  // Account/Creator filtering from navigation state
  const [accountFilterId, setAccountFilterId] = useState<string | null>(null);
  const [creatorFilterId, setCreatorFilterId] = useState<string | null>(null);
  const [showLinkCreatorModal, setShowLinkCreatorModal] = useState(false);
  const [accountToLinkCreator, setAccountToLinkCreator] = useState<TrackedAccount | null>(null);
  const [accountCreatorName, setAccountCreatorName] = useState<string | null>(null);

  // Handle URL query parameter filters (from clicking accounts or creators)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const accountParam = searchParams.get('accounts');
    const creatorParam = searchParams.get('creator');
    
    if (accountParam) {
      console.log('🎯 Applying account filter from URL:', accountParam);
      setAccountFilterId(accountParam);
      setCreatorFilterId(null);
      // Update the visual filter dropdown to show the selected account
      setSelectedAccountIds([accountParam]);
    } else if (creatorParam) {
      console.log('🎨 Applying creator filter from URL:', creatorParam);
      setCreatorFilterId(creatorParam);
      setAccountFilterId(null);
      // Clear the visual dropdown since we're filtering by creator's accounts
      setSelectedAccountIds([]);
    } else {
      // No filters in URL, clear them
      setAccountFilterId(null);
      setCreatorFilterId(null);
    }
  }, [location.search]);

  // Mark items as read when entering tabs
  useEffect(() => {
    if (!currentOrgId || !currentProjectId || isDemoMode) return;

    if (activeTab === 'videos') {
      MarkAsReadService.markVideosAsRead(currentOrgId, currentProjectId);
    } else if (activeTab === 'accounts') {
      MarkAsReadService.markAccountsAsRead(currentOrgId, currentProjectId);
    }
  }, [activeTab, currentOrgId, currentProjectId, isDemoMode]);

  // Add spacebar keyboard shortcut to open type selector
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if on dashboard tab and not in an input field
      if (
        activeTab === 'dashboard' &&
        e.code === 'Space' &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        setIsTypeSelectorOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeTab]);
  const [isCardEditorOpen, setIsCardEditorOpen] = useState(false);
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);
  const [isOverSectionTrash, setIsOverSectionTrash] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [kpiCardOrder, setKpiCardOrder] = useState<string[]>(() => {
    // Load saved card order from localStorage
    const saved = localStorage.getItem('kpiCardOrder');
    return saved ? JSON.parse(saved) : [];
  });
  const [kpiCardVisibility, setKpiCardVisibility] = useState<Record<string, boolean>>(() => {
    // Load saved card visibility from localStorage
    const saved = localStorage.getItem('kpiCardVisibility');
    if (saved) {
      return JSON.parse(saved);
    }
    // Default: all cards visible (revenue & downloads hidden for now)
    return {
      views: true,
      likes: true,
      comments: true,
      shares: true,
      videos: true,
      accounts: true,
      engagementRate: true,
      revenue: false, // Hidden - will reactivate later
      downloads: false, // Hidden - will reactivate later
      'link-clicks': true
    };
  });
  
  const [dashboardSectionOrder, setDashboardSectionOrder] = useState<string[]>(() => {
    const defaultOrder = ['kpi-cards', 'posting-activity', 'top-performers', 'top-platforms', 'videos-table', 'tracked-accounts'];
    const saved = localStorage.getItem('dashboardSectionOrder');
    
    if (saved) {
      const parsedOrder = JSON.parse(saved);
      // Merge old order with new sections that might be missing
      const merged = [...parsedOrder];
      defaultOrder.forEach(sectionId => {
        if (!merged.includes(sectionId)) {
          merged.push(sectionId);
        }
      });
      console.log('🔧 Merged section order:', { old: parsedOrder, new: merged });
      // Save the merged order back to localStorage
      localStorage.setItem('dashboardSectionOrder', JSON.stringify(merged));
      return merged;
    }
    
    return defaultOrder;
  });

  // Check subscription plan and show paywall if on free plan
  useEffect(() => {
    const checkSubscription = async () => {
      console.log('🔍 Checking subscription...', { isDemoMode, userEmail: user?.email, activeTab });
      
      // Skip paywall check if in demo mode (public /demo page)
      if (isDemoMode) {
        console.log('🎭 Demo mode active - paywall disabled');
        setIsDemoOrg(true);
        setShowPaywall(false);
        return;
      }
      
      if (!user) {
        // No user means we're on public demo route - disable paywall
        setShowPaywall(false);
        return;
      }
      
      // Check if demo user - NEVER show paywall for demo account
      const isDemo = DemoOrgService.isDemoUser(user.email);
      setIsDemoOrg(isDemo);
      
      if (isDemo) {
        console.log('🎭 Demo user logged in - paywall permanently disabled');
        setShowPaywall(false);
        return;
      }
      
      if (!currentOrgId) return;
      
      try {
        const tier = await SubscriptionService.getPlanTier(currentOrgId);
        
        console.log('💳 Plan tier:', tier, 'Tab:', activeTab);
        
        // Show paywall if free plan and NOT on settings tab
        const shouldShowPaywall = tier === 'free' && activeTab !== 'settings';
        console.log('🚧 Show paywall?', shouldShowPaywall);
        setShowPaywall(shouldShowPaywall);
      } catch (error) {
        console.error('Failed to check subscription:', error);
      }
    };
    
    checkSubscription();
  }, [currentOrgId, activeTab, user, isDemoMode]);
  
  const [dashboardSectionVisibility, setDashboardSectionVisibility] = useState<Record<string, boolean>>(() => {
    const defaults = {
      'kpi-cards': true,
      'top-performers': true,
      'posting-activity': false,
      'tracked-accounts': false,
      'videos-table': true
    };
    
    const saved = localStorage.getItem('dashboardSectionVisibility');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge defaults first, then overlay saved values
      // This ensures new sections get their default values
      const merged = { ...defaults, ...parsed };
      return merged;
    }
    return defaults;
  });

  // Top Performers subsection visibility (similar to KPI cards)
  const [topPerformersSubsectionVisibility, setTopPerformersSubsectionVisibility] = useState<Record<string, boolean>>(() => {
    const defaults = {
      'top-videos': true,
      'top-accounts': true,
      'top-gainers': false,
      'top-creators': false,
      'posting-times': false,
      'top-platforms': false,
      'comparison': true // Visible by default
    };
    
    // One-time migration: check if we need to enable comparison for existing users
    const migrationKey = 'topPerformersSubsectionVisibility_v2';
    const migrationDone = localStorage.getItem(migrationKey);
    
    const saved = localStorage.getItem('topPerformersSubsectionVisibility');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // If migration hasn't been done and comparison is false or undefined, set it to true once
        if (!migrationDone && parsed.comparison === false) {
          parsed.comparison = true;
          localStorage.setItem('topPerformersSubsectionVisibility', JSON.stringify(parsed));
          localStorage.setItem(migrationKey, 'true');
        } else if (!migrationDone) {
          // Mark migration as done even if comparison was already true or didn't exist
          localStorage.setItem(migrationKey, 'true');
        }
        
        // Merge with defaults to ensure new keys are added
        return { ...defaults, ...parsed };
      } catch (e) {
        console.error('Failed to parse topPerformersSubsectionVisibility from localStorage', e);
        return defaults;
      }
    }
    
    // Mark migration as done for new users
    if (!migrationDone) {
      localStorage.setItem(migrationKey, 'true');
    }
    
    return defaults;
  });
  
  const [dashboardSectionTitles, setDashboardSectionTitles] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('dashboardSectionTitles');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      'kpi-cards': 'KPI Cards',
      'top-performers': 'Top Performers',
      'videos-table': 'Videos Table'
    };
  });
  const [userRole, setUserRole] = useState<string>('');
  
  // Accounts page state (UI-specific, not filters - filters are shared with dashboard)
  const [accountsViewMode, setAccountsViewMode] = useState<'table' | 'details'>(() => {
    const saved = localStorage.getItem('accountsViewMode');
    return (saved as 'table' | 'details') || 'table';
  });
  const [accountsSearchQuery, setAccountsSearchQuery] = useState('');
  const accountsPageRef = useRef<AccountsPageRef | null>(null);
  const trackedLinksPageRef = useRef<TrackedLinksPageRef | null>(null);
  const creatorsPageRef = useRef<CreatorsManagementPageRef | null>(null);
  const [linkFilter, setLinkFilter] = useState<string>('all'); // 'all' or link ID
  const [allLinks, setAllLinks] = useState<any[]>([]); // Store all links for dropdown

  // Dashboard platform filter state
  const [dashboardPlatformFilter, setDashboardPlatformFilter] = useState<'all' | 'instagram' | 'tiktok' | 'youtube' | 'twitter'>(() => {
    const saved = localStorage.getItem('dashboardPlatformFilter');
    return (saved as 'all' | 'instagram' | 'tiktok' | 'youtube' | 'twitter') || 'all';
  });
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);
  
  // Dashboard accounts filter state - PROJECT-SCOPED
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() => {
    // Use project-scoped key to prevent account IDs from other projects
    const projectKey = currentProjectId ? `dashboardSelectedAccountIds_${currentProjectId}` : 'dashboardSelectedAccountIds';
    const saved = localStorage.getItem(projectKey);
    return saved ? JSON.parse(saved) : [];
  });

  // Load creator name when single account is selected
  useEffect(() => {
    if (currentOrgId && currentProjectId && selectedAccountIds.length === 1) {
      const accountId = selectedAccountIds[0];
      CreatorLinksService.getCreatorNameForAccount(currentOrgId, currentProjectId, accountId)
        .then(name => setAccountCreatorName(name))
        .catch(() => setAccountCreatorName(null));
    } else {
      setAccountCreatorName(null);
    }
  }, [selectedAccountIds, currentOrgId, currentProjectId]);

  // Dashboard rule filter state - support multiple rule selection
  // Will be loaded from Firebase along with rules
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [rulesLoadedFromFirebase, setRulesLoadedFromFirebase] = useState(false);
  const [dataLoadedFromFirebase, setDataLoadedFromFirebase] = useState(false);
  
  // Compute ACTIVE rules count - only count rules that exist in current project
  // This prevents showing stale counts when switching projects
  const activeRulesCount = useMemo(() => {
    const validRuleIds = new Set(allRules.map(r => r.id));
    return selectedRuleIds.filter(id => validRuleIds.has(id)).length;
  }, [selectedRuleIds, allRules]);
  
  // Loading state for skeleton display (only check if data has been loaded, not if it's empty)
  const isInitialLoading = !rulesLoadedFromFirebase || !dataLoadedFromFirebase;
  
  const [linksDateFilter, setLinksDateFilter] = useState<DateFilterType>(() => {
    const saved = localStorage.getItem('linksDateFilter');
    return (saved as DateFilterType) || 'last30days';
  });
  const [linksCustomDateRange, setLinksCustomDateRange] = useState<DateRange | undefined>(() => {
    const saved = localStorage.getItem('linksCustomDateRange');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        startDate: new Date(parsed.startDate),
        endDate: new Date(parsed.endDate)
      };
    }
    return undefined;
  });
  
  // Creators date filter state
  const [creatorsDateFilter, setCreatorsDateFilter] = useState<DateFilterType>(() => {
    const saved = localStorage.getItem('creatorsDateFilter');
    return (saved as DateFilterType) || 'all';
  });

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Save dashboard filters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('dashboardDateFilter', dateFilter);
  }, [dateFilter]);

  useEffect(() => {
    if (customDateRange) {
      localStorage.setItem('dashboardCustomDateRange', JSON.stringify(customDateRange));
    } else {
      localStorage.removeItem('dashboardCustomDateRange');
    }
  }, [customDateRange]);

  useEffect(() => {
    localStorage.setItem('dashboardGranularity', granularity);
  }, [granularity]);

  useEffect(() => {
    localStorage.setItem('dashboardPlatformFilter', dashboardPlatformFilter);
  }, [dashboardPlatformFilter]);

  useEffect(() => {
    // Use project-scoped key to prevent account IDs from contaminating other projects
    if (currentProjectId) {
      const projectKey = `dashboardSelectedAccountIds_${currentProjectId}`;
      localStorage.setItem(projectKey, JSON.stringify(selectedAccountIds));
    }
  }, [selectedAccountIds, currentProjectId]);

  // Validate selectedAccountIds against loaded accounts
  // Remove any account IDs that don't exist in this project
  useEffect(() => {
    if (trackedAccounts.length > 0 && selectedAccountIds.length > 0) {
      const validAccountIds = new Set(trackedAccounts.map(a => a.id));
      const filteredIds = selectedAccountIds.filter(id => validAccountIds.has(id));
      
      if (filteredIds.length !== selectedAccountIds.length) {
        console.warn(`⚠️ Filtered out ${selectedAccountIds.length - filteredIds.length} invalid account IDs from other projects`);
        setSelectedAccountIds(filteredIds);
      }
    }
  }, [trackedAccounts]); // Only run when accounts are loaded, not on every selectedAccountIds change

  // Save selected rules to Firestore (per user, per project)
  // Only save after initial load to avoid overwriting on mount
  useEffect(() => {
    // 🎯 CREATORS: Skip rule saving (check BEFORE any logs)
    if (userRole === 'creator' || userRole === '') {
      return;
    }
    
    console.log('💾 Save effect triggered:', {
      hasUser: !!user,
      hasOrg: !!currentOrgId,
      hasProject: !!currentProjectId,
      rulesLoaded: rulesLoadedFromFirebase,
      selectedCount: selectedRuleIds.length
    });
    
    if (!user || !currentOrgId || !currentProjectId) {
      console.log('⏭️ Skipping save: missing user/org/project');
      return;
    }
    
    if (!rulesLoadedFromFirebase) {
      console.log('⏭️ Skipping save: rules not yet loaded from Firebase');
      return;
    }
    
    const saveSelectedRules = async () => {
      try {
        const userPrefsRef = doc(
          db, 
          'organizations', 
          currentOrgId, 
          'projects', 
          currentProjectId, 
          'userPreferences', 
          user.uid
        );
        
        console.log('💾 Saving to path:', `organizations/${currentOrgId}/projects/${currentProjectId}/userPreferences/${user.uid}`);
        
        await setDoc(userPrefsRef, {
          selectedRuleIds,
          updatedAt: new Date()
        }, { merge: true });
        
        console.log('✅ Successfully saved selected rules to Firebase:', selectedRuleIds);
      } catch (error) {
        console.error('❌ Failed to save selected rules:', error);
      }
    };
    
    saveSelectedRules();
  }, [selectedRuleIds, user, currentOrgId, currentProjectId, rulesLoadedFromFirebase, userRole]);

  // Debug: Log when rules or selectedRuleIds change
  useEffect(() => {
    // 🎯 CREATORS: Skip debug logs (check BEFORE any logs)
    if (userRole === 'creator' || userRole === '') {
      return;
    }
    
    console.log('🔄 Rules or selection changed:');
    console.log('  - Selected Rule IDs:', selectedRuleIds);
    console.log('  - Available Rules:', allRules.length);
    console.log('  - Matched Rules:', allRules.filter(r => selectedRuleIds.includes(r.id)).length);
  }, [selectedRuleIds, allRules, userRole]);

  // Save accounts page view mode to localStorage
  useEffect(() => {
    localStorage.setItem('accountsViewMode', accountsViewMode);
  }, [accountsViewMode]);

  // Save tracked links filters to localStorage
  useEffect(() => {
    localStorage.setItem('linksDateFilter', linksDateFilter);
  }, [linksDateFilter]);

  useEffect(() => {
    if (linksCustomDateRange) {
      localStorage.setItem('linksCustomDateRange', JSON.stringify(linksCustomDateRange));
    } else {
      localStorage.removeItem('linksCustomDateRange');
    }
  }, [linksCustomDateRange]);

  // Save creators date filter to localStorage
  useEffect(() => {
    localStorage.setItem('creatorsDateFilter', creatorsDateFilter);
  }, [creatorsDateFilter]);

  // Refresh data when switching tabs
  useEffect(() => {
    if (!currentOrgId || !currentProjectId) return;
    
    
    // Trigger refresh for the active tab
    switch (activeTab) {
      case 'accounts':
        // AccountsPage has its own real-time listeners, just trigger a manual refresh
        accountsPageRef.current?.refreshData?.();
        break;
      case 'analytics':
        // TrackedLinksPage will refresh via its own mechanisms
        trackedLinksPageRef.current?.refreshData?.();
        break;
      case 'creators':
        // CreatorsManagementPage will refresh via its own mechanisms
        creatorsPageRef.current?.refreshData?.();
        break;
      case 'dashboard':
        // Dashboard data is already handled by real-time listeners above
        break;
    }
  }, [activeTab, currentOrgId, currentProjectId]);

  // Load user role
  useEffect(() => {
    if (!user || !currentOrgId) return;
    
    const loadUserRole = async () => {
      try {
        const role = await OrganizationService.getUserRole(currentOrgId, user.uid);
        setUserRole(role || 'member');
        
        // 🎯 AUTO-REDIRECT CREATORS TO CAMPAIGNS TAB (they don't see dashboard)
        if (role === 'creator' && activeTab === 'dashboard') {
          console.log('🎯 Creator detected! Redirecting to campaigns tab...');
          navigate('/campaigns');
          localStorage.setItem('activeTab', 'campaigns');
        }
      } catch (error) {
        console.error('Failed to load user role:', error);
        setUserRole('member');
      }
    };
    
    loadUserRole();
  }, [user, currentOrgId]); // Removed activeTab - user role doesn't change on tab switch!

  // Load user's dashboard preferences from Firebase
  useEffect(() => {
    if (!user || !currentOrgId) return;
    
    const loadDashboardPreferences = async () => {
      try {
        console.log('📊 Loading dashboard preferences for user:', user.uid);
        const prefs = await DashboardPreferencesService.getUserPreferences(currentOrgId, user.uid);
        
        if (prefs) {
          console.log('✅ Loaded preferences from Firebase:', {
            hasKpiOrder: prefs.kpiCardOrder.length > 0,
            inheritedFrom: prefs.inheritedFromUserId || 'own layout'
          });
          
          // Apply preferences
          if (prefs.kpiCardOrder.length > 0) {
            setKpiCardOrder(prefs.kpiCardOrder);
          }
          setKpiCardVisibility(prefs.kpiCardVisibility);
          setDashboardSectionOrder(prefs.dashboardSectionOrder);
          setDashboardSectionVisibility(prefs.dashboardSectionVisibility);
          
          // Sync to localStorage as backup
          localStorage.setItem('kpiCardOrder', JSON.stringify(prefs.kpiCardOrder));
          localStorage.setItem('kpiCardVisibility', JSON.stringify(prefs.kpiCardVisibility));
          localStorage.setItem('dashboardSectionOrder', JSON.stringify(prefs.dashboardSectionOrder));
          localStorage.setItem('dashboardSectionVisibility', JSON.stringify(prefs.dashboardSectionVisibility));
        }
      } catch (error) {
        console.error('Failed to load dashboard preferences:', error);
      }
    };
    
    loadDashboardPreferences();
  }, [user?.uid, currentOrgId]); // Load when user or org changes

  // One-time data loading (no real-time listeners)
  useEffect(() => {
    if (!user || !currentOrgId || !currentProjectId) {
      // Reset loading states when context is missing
      setRulesLoadedFromFirebase(false);
      setDataLoadedFromFirebase(false);
      setLoadingDashboard(false);
      return;
    }

    // Start loading - set loading state to true
    setLoadingDashboard(true);

    // 🎯 CREATORS: Skip loading ALL organization data - they only need campaigns
    // Also skip if role not loaded yet to prevent unnecessary cache loading
    if (userRole === 'creator' || userRole === '') {
      if (userRole === 'creator') {
        console.log('🎯 Creator role detected - skipping organization data load');
        setRulesLoadedFromFirebase(true);
        setDataLoadedFromFirebase(true);
        setLoadingDashboard(false);
      }
      return;
    }
    
    // Initialize theme
    ThemeService.initializeTheme();
    
    // Load cached data FIRST for instant display (under 100ms!)
    console.time('⚡ Cache load');
    const cacheKey = `dashboard_${currentOrgId}_${currentProjectId}`;
    let hasCached = false;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { accounts, submissions, rules, selectedRuleIds: cachedRuleIds, links: cachedLinks, linkClicks: cachedClicks, timestamp } = JSON.parse(cached);
        const cacheAge = Date.now() - timestamp;
        
        // Use cache if less than 5 minutes old
        if (cacheAge < 5 * 60 * 1000) {
          // CRITICAL: Filter cached rule IDs to only include rules that exist in this project
          const validCachedRuleIds = new Set((rules || []).map((r: TrackingRule) => r.id));
          const filteredCachedRuleIds = (cachedRuleIds || []).filter((id: string) => validCachedRuleIds.has(id));
          
          if (filteredCachedRuleIds.length !== (cachedRuleIds || []).length) {
            console.warn(`⚠️ Cache: Filtered out ${(cachedRuleIds || []).length - filteredCachedRuleIds.length} invalid rule IDs`);
          }
          
          setTrackedAccounts(accounts || []);
          setSubmissions(submissions || []);
          setAllRules(rules || []);
          setSelectedRuleIds(filteredCachedRuleIds);
          setLinks(cachedLinks || []);
          setLinkClicks(cachedClicks || []);
          setRulesLoadedFromFirebase(true);
          setDataLoadedFromFirebase(true);
          setLoadingDashboard(false);
          hasCached = true;
          console.log(`⚡ Loaded from cache (${Math.round(cacheAge / 1000)}s old) - including ${cachedLinks?.length || 0} links & ${cachedClicks?.length || 0} clicks`);
        }
      }
    } catch (error) {
      console.error('Cache load error:', error);
    }
    console.timeEnd('⚡ Cache load');
    
    // Load ALL data in TRUE PARALLEL for maximum speed!
    (async () => {
      console.time('🚀 Parallel Firebase load');
      
    try {
      // PHASE 1: Load ALL top-level collections in parallel
      const [accountsSnapshot, videosSnapshot, rulesSnapshot, allLinks, allClicks, allIntegrations, userPrefsDoc] = await Promise.all([
        // 1. Accounts
        getDocs(query(
          collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts'),
          orderBy('dateAdded', 'desc')
        )),
        
        // 2. Videos  
        getDocs(query(
          collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'videos'),
          orderBy('dateAdded', 'desc'),
          limit(1000)
        )),
        
        // 3. Rules
        getDocs(collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackingRules')),
        
        // 4. Links
        FirestoreDataService.getLinks(currentOrgId, currentProjectId),
        
        // 5. Link Clicks (OPTIMIZED!)
        LinkClicksService.getProjectLinkClicks(currentOrgId, currentProjectId),
        
        // 6. Revenue Integrations
        RevenueDataService.getAllIntegrations(currentOrgId, currentProjectId),
        
        // 7. User Preferences
        getDoc(doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'userPreferences', user.uid))
      ]);
      
      // Process accounts
      const accounts: TrackedAccount[] = accountsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TrackedAccount));
      setTrackedAccounts(accounts);
      const accountsMap = new Map(accounts.map(acc => [acc.id, acc]));
      
      
      // PHASE 2: Load video snapshots (depends on videoIds from phase 1)
      const videoIds = videosSnapshot.docs.map(doc => doc.id);
      const snapshotsMap = await FirestoreDataService.getVideoSnapshotsBatch(
        currentOrgId, 
        currentProjectId, 
        videoIds
      );
      
      // Process videos
      const allSubmissions: VideoSubmission[] = videosSnapshot.docs.map(doc => {
        const video = { id: doc.id, ...doc.data() } as any;
        const account = video.trackedAccountId ? accountsMap.get(video.trackedAccountId) : null;
        const snapshots = snapshotsMap.get(video.id) || [];
        
        const caption = video.caption || video.videoTitle || '';
        const title = video.videoTitle || video.caption || '';
        
        return {
          id: video.id,
          url: video.videoUrl || video.url || '',
          platform: video.platform as 'instagram' | 'tiktok' | 'youtube',
          thumbnail: video.thumbnail || '',
          title: title,
          caption: caption,
          uploader: account?.displayName || account?.username || '',
          uploaderHandle: account?.username || '',
          uploaderProfilePicture: account?.profilePicture,
          followerCount: account?.followerCount,
          status: video.status === 'archived' ? 'rejected' : 'approved',
          views: video.views || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          duration: video.duration || 0,
          dateSubmitted: video.dateAdded?.toDate?.() || new Date(),
          uploadDate: video.uploadDate?.toDate?.() || new Date(),
          lastRefreshed: video.lastRefreshed?.toDate?.(),
          snapshots: snapshots
        };
      });
      setSubmissions(allSubmissions);
    
      // Process rules
      const rules = rulesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TrackingRule[];
      
      const savedSelectedRuleIds = userPrefsDoc.exists() ? (userPrefsDoc.data()?.selectedRuleIds || []) : [];
      const validRuleIds = new Set(rules.map(r => r.id));
      const filteredSelectedRuleIds = savedSelectedRuleIds.filter((id: string) => validRuleIds.has(id));
      
      if (filteredSelectedRuleIds.length !== savedSelectedRuleIds.length) {
        console.warn(`⚠️ Filtered out ${savedSelectedRuleIds.length - filteredSelectedRuleIds.length} invalid rule IDs from other projects`);
      }
      
      setAllRules(rules);
      setSelectedRuleIds(filteredSelectedRuleIds);
      
      // Set links and clicks (already loaded in parallel!)
      setLinks(allLinks);
      setLinkClicks(allClicks);
      
      // Process revenue integrations
      const enabledIntegrations = allIntegrations.filter(i => i.enabled);
      setRevenueIntegrations(enabledIntegrations);
      
      // Load revenue metrics if integrations exist
      if (enabledIntegrations.length > 0) {
        const metrics = await RevenueDataService.getLatestMetrics(currentOrgId, currentProjectId);
        setRevenueMetrics(metrics);
      }
      
      setRulesLoadedFromFirebase(true);
      setDataLoadedFromFirebase(true);
      setLoadingDashboard(false);
      console.timeEnd('🚀 Parallel Firebase load');
      console.log('✅ All data loaded in parallel!');
      
      // Cache everything including links and clicks!
      if (!hasCached) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            accounts,
            submissions: allSubmissions,
            rules,
            selectedRuleIds: savedSelectedRuleIds,
            links: allLinks,
            linkClicks: allClicks,
            timestamp: Date.now()
          }));
          console.log('💾 Dashboard cached (including links & clicks)');
        } catch (error) {
          console.error('Cache save error:', error);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load data:', error);
      setDataLoadedFromFirebase(true);
      setRulesLoadedFromFirebase(true);
      setLoadingDashboard(false);
      console.timeEnd('🚀 Parallel Firebase load');
    }
    
    })(); // End of async IIFE
  }, [user, currentOrgId, currentProjectId, userRole]); // Reload when project changes or role is loaded!

  // Auto-sync revenue data when date filters change
  useEffect(() => {
    if (!user || !currentOrgId || !currentProjectId) return;
    if (userRole === 'creator') return; // 🎯 Creators don't see revenue metrics
    if (revenueIntegrations.length === 0) return;

    const syncRevenue = async () => {
      try {
        // Calculate date range based on current filter
        const range = DateFilterService.getDateRange(dateFilter, customDateRange, submissions);
        const startDate = range.startDate;
        const endDate = range.endDate;

        console.log(`🔄 Syncing revenue data for ${dateFilter}:`, { startDate, endDate });

        // Check which integrations need API syncing vs webhook-only
        const needsApiSync = revenueIntegrations.some(i => 
          i.provider === 'revenuecat' || i.provider === 'apple'
        );

        if (needsApiSync) {
          // Sync API-based integrations (RevenueCat, Apple)
          await RevenueDataService.syncAllIntegrations(
            currentOrgId,
            currentProjectId,
            startDate,
            endDate
          );
        }

        // Check if we have Apple integration (uses summary data, not transactions)
        const hasAppleIntegration = revenueIntegrations.some(i => i.provider === 'apple' && i.enabled);
        
        if (hasAppleIntegration) {
          // For Apple, just fetch the summary metrics (don't calculate from transactions)
          const metrics = await RevenueDataService.getLatestMetrics(currentOrgId, currentProjectId);
          setRevenueMetrics(metrics);
          console.log('✅ Apple revenue metrics loaded:', metrics);
        } else {
          // For other providers (RevenueCat, etc.), recalculate from transactions
          const metrics = await RevenueDataService.calculateMetricsFromTransactions(
            currentOrgId,
            currentProjectId,
            startDate,
            endDate
          );
          setRevenueMetrics(metrics);
          console.log('✅ Revenue data synced and metrics calculated');
        }
      } catch (error) {
        console.error('❌ Failed to sync revenue for date range:', error);
      }
    };

    syncRevenue();
  }, [user, currentOrgId, currentProjectId, dateFilter, customDateRange, revenueIntegrations]);

  // Smart sync monitoring - Auto-refresh when accounts finish syncing
  useEffect(() => {
    if (!user || !currentOrgId || !currentProjectId) return;
    if (userRole === 'creator') return; // 🎯 Creators don't sync accounts


    const accountsRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts');
    const syncingQuery = query(accountsRef, where('syncStatus', 'in', ['pending', 'syncing']));

    let previousSyncingCount = 0;

    const unsubscribe = onSnapshot(syncingQuery, async (snapshot) => {
      const currentSyncingCount = snapshot.docs.length;
      
      // If syncing count decreased (someone finished), reload videos
      if (previousSyncingCount > 0 && currentSyncingCount < previousSyncingCount) {
        
        // Reload videos
        try {
          const videosRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'videos');
          const videosQuery = query(videosRef, orderBy('dateAdded', 'desc'), limit(1000));
          const videosSnapshot = await getDocs(videosQuery);
          
          const accounts = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
          const accountsMap = new Map(accounts.map(acc => [acc.id, acc]));
          
          const videoIds = videosSnapshot.docs.map(doc => doc.id);
          const snapshotsMap = await FirestoreDataService.getVideoSnapshotsBatch(currentOrgId, currentProjectId, videoIds);
          
          const allSubmissions: VideoSubmission[] = videosSnapshot.docs.map(doc => {
            const video = { id: doc.id, ...doc.data() } as any;
            const account = video.trackedAccountId ? accountsMap.get(video.trackedAccountId) : null;
            const snapshots = snapshotsMap.get(video.id) || [];
            
            const caption = video.caption || video.videoTitle || '';
            const title = video.videoTitle || video.caption || '';
            
            return {
              id: video.id,
              url: video.videoUrl || video.url || '',
              platform: video.platform as 'instagram' | 'tiktok' | 'youtube',
              thumbnail: video.thumbnail || '',
              title: title,
              caption: caption,
              uploader: account?.displayName || account?.username || '',
              uploaderHandle: account?.username || '',
              uploaderProfilePicture: account?.profilePicture,
              followerCount: account?.followerCount,
              status: video.status === 'archived' ? 'rejected' : 'approved',
              views: video.views || 0,
              likes: video.likes || 0,
              comments: video.comments || 0,
              shares: video.shares || 0,
              duration: video.duration || 0,
              dateSubmitted: video.dateAdded?.toDate?.() || new Date(),
              uploadDate: video.uploadDate?.toDate?.() || new Date(),
              lastRefreshed: video.lastRefreshed?.toDate?.(),
              snapshots: snapshots
            };
          });
          
          setSubmissions(allSubmissions);
        } catch (error) {
          console.error('❌ Failed to auto-refresh videos:', error);
        }
      }
      
      previousSyncingCount = currentSyncingCount;
    });

    return () => {
      unsubscribe();
    };
  }, [user, currentOrgId, currentProjectId, userRole]);

  // Apply CSS variables to the root and expose fix function
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    // Expose fix function to console for one-time fixes
    if (typeof window !== 'undefined') {
      (window as any).fixVideoPlatforms = fixVideoPlatforms;
    }
  }, []);

  // Keyboard shortcut: Spacebar to trigger + button action
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger on spacebar
      if (e.code !== 'Space' && e.key !== ' ') return;
      
      // Don't trigger if user is typing in an input, textarea, or contenteditable element
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable ||
                      target.closest('[contenteditable="true"]');
      
      if (isTyping) return;
      
      // Don't trigger if any modal is already open
      if (isModalOpen || isTikTokSearchOpen || isAnalyticsModalOpen) return;
      
      // Only trigger on tabs where + button is visible
      if (activeTab === 'settings' || activeTab === 'subscription' || activeTab === 'extension' || activeTab === 'cron' || activeTab === 'creators') {
        return;
      }
      
      // Prevent default spacebar behavior (page scroll)
      e.preventDefault();
      
      // Trigger the appropriate action based on active tab
      if (activeTab === 'dashboard') {
        setIsModalOpen(true);
      } else if (activeTab === 'accounts') {
        accountsPageRef.current?.openAddModal();
      } else if (activeTab === 'videos') {
        setIsModalOpen(true);
      } else if (activeTab === 'analytics') {
        trackedLinksPageRef.current?.openCreateModal();
      } else if (activeTab === 'campaigns') {
        navigate('/campaigns/create');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, isModalOpen, isTikTokSearchOpen, isAnalyticsModalOpen]);

  // Apply platform, account, and rule filters (but NOT date filter) - for PP calculation
  // Create a stable dependency for rules that detects changes to rule properties
  const rulesFingerprint = useMemo(() => {
    return JSON.stringify(
      allRules.map(r => ({
        id: r.id,
        isActive: r.isActive,
        conditions: r.conditions,
        appliesTo: r.appliesTo
      }))
    );
  }, [allRules]);

  const submissionsWithoutDateFilter = useMemo(() => {
    // 🎯 CREATORS: Skip all video filtering calculations
    // Also skip if role not loaded yet (userRole === '')
    if (userRole === 'creator' || userRole === '') {
      return [];
    }
    
    console.log('🔄 Recalculating submissionsWithoutDateFilter with rule filters...');
    console.log('📊 Raw submissions count:', submissions.length);
    console.log('🎯 Active rules count:', allRules.filter(r => r.isActive).length);
    console.log('🔍 Selected rule IDs:', selectedRuleIds);
    
    let filtered = submissions;
    const initialCount = filtered.length;
    
    // Apply platform filter
    if (dashboardPlatformFilter !== 'all') {
      filtered = filtered.filter(video => video.platform === dashboardPlatformFilter);
      console.log(`📱 After platform filter (${dashboardPlatformFilter}):`, filtered.length, `(removed ${initialCount - filtered.length})`);
    }
    
    // Apply accounts filter
    if (selectedAccountIds.length > 0) {
      const beforeAccountFilter = filtered.length;
      // Create a set of platform_username keys from selected accounts
      const selectedAccountKeys = new Set(
        trackedAccounts
          .filter(account => selectedAccountIds.includes(account.id))
          .map(account => `${account.platform}_${account.username.toLowerCase()}`)
      );
      
      filtered = filtered.filter(video => {
        if (!video.uploaderHandle) return false;
        const videoKey = `${video.platform}_${video.uploaderHandle.toLowerCase()}`;
        return selectedAccountKeys.has(videoKey);
      });
      console.log(`👥 After accounts filter (${selectedAccountIds.length} accounts):`, filtered.length, `(removed ${beforeAccountFilter - filtered.length})`);
    }
    
    // Apply specific rule filter(s) if selected
    // When no rules are selected, show ALL videos (default behavior)
    if (selectedRuleIds && selectedRuleIds.length > 0) {
      const beforeRuleFilter = filtered.length;
      const selectedRules = allRules.filter(rule => rule && selectedRuleIds.includes(rule.id));
      
      console.log(`🎯 Trying to apply ${selectedRuleIds.length} selected rule ID(s):`, selectedRuleIds);
      console.log(`📚 Found ${selectedRules.length} matching rules in allRules (${allRules.length} total)`);
      
      if (selectedRules.length > 0) {
        console.log(`📋 Applying ${selectedRules.length} specific rule(s)...`);
        const activeSelectedRules = selectedRules.filter(r => r && r.isActive);
        
        if (activeSelectedRules.length > 0) {
          // Log TikTok videos for debugging
          const tiktokVideos = filtered.filter(v => v.platform === 'tiktok');
          if (tiktokVideos.length > 0) {
            console.log(`🎬 TikTok videos before rule filter: ${tiktokVideos.length}`);
            console.log(`📝 Sample TikTok video:`, {
              id: tiktokVideos[0].id,
              title: tiktokVideos[0].title,
              caption: tiktokVideos[0].caption,
              titleLength: tiktokVideos[0].title?.length || 0,
              captionLength: tiktokVideos[0].caption?.length || 0
            });
          }
          
          filtered = filtered.filter(video => {
            // Check if video matches ANY of the selected rules (OR logic)
            const matches = activeSelectedRules.some(selectedRule => {
              const result = RulesService.checkVideoMatchesRule(video as any, selectedRule);
              if (video.platform === 'tiktok') {
                console.log(`🎬 TikTok rule check:`, {
                  videoId: video.id?.substring(0, 15),
                  ruleId: selectedRule.id,
                  matches: result.matches,
                  hasTitle: !!video.title,
                  hasCaption: !!video.caption
                });
              }
              return result.matches;
            });
            return matches;
          });
          console.log(`✅ After specific rule filter:`, filtered.length, `(removed ${beforeRuleFilter - filtered.length})`);
        } else {
          console.log(`⚠️ All selected rules are INACTIVE, showing 0 videos`);
          filtered = []; // All inactive rules = no videos
        }
      } else {
        // Rules are selected but not found in allRules
        // This shouldn't happen since they load together, but log it just in case
        console.warn(`⚠️ Rules selected but not found in allRules. Selected: ${selectedRuleIds.length}, All rules: ${allRules.length}`);
      }
    } else {
      // NO rules selected - show ALL videos (no filtering by rules)
      console.log('📝 No rules selected - showing all videos without rule filtering');
    }
    
    console.log(`🎬 FINAL filtered count:`, filtered.length);
    console.log('─'.repeat(50));
    
    return filtered;
  }, [submissions, dashboardPlatformFilter, selectedAccountIds, trackedAccounts, allRules, selectedRuleIds, rulesFingerprint, userRole]);

  // Filter submissions based on date range, platform, and accounts (memoized to prevent infinite loops)
  const filteredSubmissions = useMemo(() => {
    // 🎯 CREATORS: Skip all date filtering calculations
    // Also skip if role not loaded yet (userRole === '')
    if (userRole === 'creator' || userRole === '') {
      return [];
    }
    
    console.log('📅 Applying date filter to rule-filtered submissions...');
    console.log('📊 Input (submissionsWithoutDateFilter):', submissionsWithoutDateFilter.length);
    console.log('📆 Date filter:', dateFilter);
    
    // Use strictMode: FALSE to include videos with snapshots in period
    // This ensures videos with snapshot activity in the period are included for KPI calculations
    let filtered = DateFilterService.filterVideosByDateRange(
      submissionsWithoutDateFilter, 
      dateFilter, 
      customDateRange,
      false // strictMode: false = include videos with snapshots OR uploaded in period
    );
    
    console.log('✅ After date filter (NON-STRICT):', filtered.length, `(removed ${submissionsWithoutDateFilter.length - filtered.length})`);
    console.log('🎯 These videos were either UPLOADED or have SNAPSHOTS in the selected date range');
    console.log('📋 Display components will show videos with activity in period');
    console.log('🔄 KPI Cards will calculate growth from snapshots in period');
    console.log('═'.repeat(50));
    
    return filtered;
  }, [submissionsWithoutDateFilter, dateFilter, customDateRange, userRole]);

  // Combine real submissions with pending videos for immediate UI feedback
  const combinedSubmissions = useMemo(() => {
    const combined = [...pendingVideos, ...filteredSubmissions];
    return combined;
  }, [pendingVideos, filteredSubmissions]);

  // Filter link clicks to only include clicks from existing links (exclude deleted links)
  const filteredLinkClicks = useMemo(() => {
    if (links.length === 0) return linkClicks;
    
    const validLinkIds = new Set(links.map(link => link.id));
    const filtered = linkClicks.filter(click => validLinkIds.has(click.linkId));
    
    if (filtered.length !== linkClicks.length) {
      console.log(`🔗 Filtered out ${linkClicks.length - filtered.length} clicks from deleted links`);
    }
    
    return filtered;
  }, [linkClicks, links]);

  // Handle date filter changes and auto-adjust granularity
  const handleDateFilterChange = useCallback((filter: DateFilterType, customRange?: DateRange) => {
    setDateFilter(filter);
    setCustomDateRange(customRange);
    
    // Auto-adjust granularity based on time range
    let newGranularity: 'day' | 'week' | 'month' | 'year' = 'day';
    
    switch (filter) {
      case 'today':
      case 'yesterday':
      case 'last7days':
        newGranularity = 'day';
        break;
      case 'last14days':
        newGranularity = 'day';
        break;
      case 'last30days':
        newGranularity = 'week';
        break;
      case 'last90days':
        newGranularity = 'month';
        break;
      case 'mtd':
        newGranularity = 'week';
        break;
      case 'ytd':
        newGranularity = 'month';
        break;
      case 'all':
        newGranularity = 'month';
        break;
      case 'custom':
        // For custom ranges, calculate the number of days
        if (customRange) {
          const daysDiff = Math.ceil(
            (customRange.endDate.getTime() - customRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          if (daysDiff <= 14) {
            newGranularity = 'day';
          } else if (daysDiff <= 60) {
            newGranularity = 'week';
          } else if (daysDiff <= 365) {
            newGranularity = 'month';
          } else {
            newGranularity = 'year';
          }
        }
        break;
    }
    
    setGranularity(newGranularity);
    localStorage.setItem('dashboardGranularity', newGranularity);
  }, []);

  const handleVideoClick = useCallback(async (video: VideoSubmission) => {
    if (!currentOrgId || !currentProjectId) return;
    
    try {
      // Fetch snapshots for this video
      const snapshots = await FirestoreDataService.getVideoSnapshots(
        currentOrgId, 
        currentProjectId, 
        video.id || ''
      );
      
      // Update video with snapshots
      const videoWithSnapshots: VideoSubmission = {
        ...video,
        snapshots: snapshots
      };
      
      setSelectedVideoForAnalytics(videoWithSnapshots);
      setIsAnalyticsModalOpen(true);
    } catch (error) {
      console.error('❌ Failed to load snapshots:', error);
      // Still open modal without snapshots
      setSelectedVideoForAnalytics(video);
      setIsAnalyticsModalOpen(true);
    }
  }, [currentOrgId, currentProjectId]);
  
  // Calculate total creator videos for the selected video
  const totalCreatorVideos = useMemo(() => {
    if (!selectedVideoForAnalytics) return undefined;
    
    // Count videos from the same creator (using uploaderHandle)
    return filteredSubmissions.filter(
      v => v.uploaderHandle === selectedVideoForAnalytics.uploaderHandle
    ).length;
  }, [selectedVideoForAnalytics, filteredSubmissions]);

  const handleCloseAnalyticsModal = useCallback(() => {
    setIsAnalyticsModalOpen(false);
    setSelectedVideoForAnalytics(null);
  }, []);

  // Trigger manual video refresh
  const handleManualRefresh = useCallback(async () => {
    if (!currentOrgId || !currentProjectId || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      console.log('🔄 Triggering manual video refresh...');
      const response = await fetch('/api/cron-refresh-videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          manual: true,
          organizationId: currentOrgId,
          projectId: currentProjectId,
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log('✅ Video refresh completed:', result);
        // Optionally show a success message to the user
        alert(`✅ Refresh completed!\n\n${result.summary || 'Videos updated successfully'}`);
      } else {
        console.error('❌ Video refresh failed:', result);
        alert(`❌ Refresh failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Failed to trigger refresh:', error);
      alert('❌ Failed to trigger refresh. Please check console for details.');
    } finally {
      setIsRefreshing(false);
    }
  }, [currentOrgId, currentProjectId, isRefreshing]);

  // Helper function to get human-readable date filter label
  const getDateFilterLabel = useCallback((filter: DateFilterType): string => {
    const labels: Record<DateFilterType, string> = {
      'all': 'All Time',
      'today': 'Today',
      'yesterday': 'Yesterday',
      'last7days': 'Last 7 Days',
      'last14days': 'Last 14 Days',
      'last30days': 'Last 30 Days',
      'last90days': 'Last 90 Days',
      'lastmonth': 'Last Month',
      'mtd': 'Month to Date',
      'ytd': 'Year to Date',
      'custom': customDateRange 
        ? `${customDateRange.startDate.toLocaleDateString()} - ${customDateRange.endDate.toLocaleDateString()}`
        : 'Custom Range'
    };
    return labels[filter] || 'All Time';
  }, [customDateRange]);

  const handleAccountClick = useCallback((username: string) => {
    // Use the most recent date or the current date range end
    const targetDate = customDateRange?.endDate || new Date();
    setDayVideosDate(targetDate);
    setSelectedAccountFilter(username);
    setIsDayVideosModalOpen(true);
  }, [customDateRange]);

  // Legacy function - kept for reference but replaced by handleAddVideosWithAccounts
  // const handleAddVideo = useCallback(async (videoUrl: string, uploadDate: Date) => { ... }


  const handleAddVideosWithAccounts = useCallback(async (platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter', videoUrls: string[]) => {
    if (!user || !currentOrgId || !currentProjectId) {
      throw new Error('User not authenticated or no organization selected');
    }


    // Create placeholder videos immediately for instant UI feedback
    const placeholderVideos: VideoSubmission[] = videoUrls.map((url, index) => ({
      id: `pending-${Date.now()}-${index}`,
      url: url,
      platform: platform,
      thumbnail: '',
      title: 'Processing...',
      caption: 'Video queued for processing...',
      uploader: 'Processing...',
      uploaderHandle: 'processing',
      status: 'pending' as const,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      dateSubmitted: new Date(),
      uploadDate: new Date(),
      isLoading: true // Custom flag for loading state
    } as VideoSubmission & { isLoading: boolean }));

    // Add placeholders to state immediately
    setPendingVideos(prev => [...prev, ...placeholderVideos]);

    let successCount = 0;
    let failureCount = 0;

    // Queue videos for background processing (like accounts)
    for (const videoUrl of videoUrls) {
      try {
        
        // Create a pending video record
        const videoId = await FirestoreDataService.addVideo(currentOrgId, currentProjectId, user.uid, {
          platform,
          url: videoUrl,
          videoId: `temp-${Date.now()}`, // Temporary ID until processed
          thumbnail: '',
          title: 'Processing...',
          description: '',
          uploadDate: Timestamp.now(),
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          status: 'active',
          isSingular: false,
          // Background processing fields
          syncStatus: 'pending',
          syncRequestedBy: user.uid,
          syncRequestedAt: Timestamp.now(),
          syncRetryCount: 0
        });

        
        // Trigger immediate processing (like accounts)
        fetch('/api/process-single-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId,
            orgId: currentOrgId,
            projectId: currentProjectId
          })
        }).catch(err => {
          console.error('Failed to trigger immediate processing:', err);
          // Non-critical - cron will pick it up
        });

        successCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to queue video ${videoUrl}:`, errorMessage);
        console.error('Full error:', error);
        failureCount++;
      }
    }


    // Handle results
    if (successCount > 0) {
      // Reload after 8 seconds to allow processing to complete
      setTimeout(() => {
        setPendingVideos([]);
        setPendingAccounts([]);
        window.location.reload();
      }, 8000); // 8 seconds for Apify API + processing
    } else if (failureCount > 0) {
      setPendingVideos([]);
      setPendingAccounts([]);
      alert(`Failed to queue ${failureCount} video(s). Check console for details.`);
    }
  }, [user, currentOrgId, currentProjectId]);

  const handleDelete = useCallback(async (id: string) => {
    if (!user || !currentOrgId || !currentProjectId) return;
    
    const confirmed = window.confirm('Are you sure you want to delete this video? This action cannot be undone.');
    if (!confirmed) return;
    
    try {
      console.log('🗑️ Deleting video:', id);
      
      // Delete from Firestore
      await FirestoreDataService.deleteVideo(currentOrgId, currentProjectId, id);
      
      // Update state
      setSubmissions(prev => prev.filter(submission => submission.id !== id));
      
      console.log('✅ Video deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete video:', error);
      alert('Failed to delete video. Please try again.');
    }
  }, [user, currentOrgId, currentProjectId]);

  const handleTikTokVideosFound = useCallback((videos: InstagramVideoData[]) => {
    
    const newSubmissions: VideoSubmission[] = videos.map((video, index) => ({
      id: `${Date.now()}_${index}`,
      url: video.id, // TikTok URL will be in webVideoUrl or constructed
      platform: 'tiktok' as const,
      thumbnail: video.thumbnail_url,
      title: video.caption.split('\n')[0] || 'Untitled TikTok Video',
      uploader: video.username,
      uploaderHandle: video.username,
      uploaderProfilePicture: video.profile_pic_url,
      followerCount: video.follower_count,
      status: 'pending' as const,
      views: video.view_count || 0,
      likes: video.like_count,
      comments: video.comment_count,
      shares: (video as any).share_count || 0,
      dateSubmitted: new Date(),
      uploadDate: video.timestamp ? new Date(video.timestamp) : new Date(), // Use timestamp or fallback to current date
      timestamp: video.timestamp,
    }));

    // Note: Submissions are now saved to Firestore, not localStorage
    // TODO: Implement Firestore save for TikTok search results

    // Update state
    setSubmissions(prev => [...newSubmissions, ...prev]);
    
  }, []);

  // Rule management functions
  const addCondition = useCallback(() => {
    const newId = (Math.max(...conditions.map(c => Number(c.id)), 0) + 1).toString();
    setConditions(prev => [...prev, { 
      id: newId, 
      type: 'description_contains', 
      value: '', 
      operator: 'AND' 
    }]);
  }, [conditions]);

  const removeCondition = useCallback((id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateCondition = useCallback((id: string, field: string, value: any) => {
    setConditions(prev => prev.map(condition => 
      condition.id === id 
        ? { ...condition, [field]: value }
        : condition
    ));
  }, []);

  const handleShowCreateForm = useCallback(() => {
    setShowCreateRuleForm(true);
  }, []);

  const handleSaveRule = useCallback(async () => {
    if (!user || !currentOrgId || !currentProjectId) return;
    if (!ruleName.trim() || conditions.filter(c => c.value !== '').length === 0) return;

    try {
      const ruleData = {
        name: ruleName,
        conditions: conditions.filter(c => c.value !== ''),
        appliesTo: {
          platforms: [], // Empty means applies to all platforms
          accountIds: [] // Empty means available to all accounts
        },
        isActive: true
      };

      await RulesService.createRule(currentOrgId, currentProjectId, user.uid, ruleData);
      
      // Reload rules
      const rules = await RulesService.getRules(currentOrgId, currentProjectId);
      setAllRules(rules as TrackingRule[]);
      
      // Reset form and show list
      setShowCreateRuleForm(false);
      setRuleName('');
      setConditions([{ id: '1', type: 'description_contains', value: '', operator: 'AND' }]);
      
    } catch (error) {
      console.error('Failed to create rule:', error);
      alert('Failed to create rule. Please try again.');
    }
  }, [user, currentOrgId, currentProjectId, ruleName, conditions]);

  const handleOpenRuleModal = useCallback(async () => {
    setIsRuleModalOpen(true);
    
    // Reload rules when modal opens to ensure fresh data
    if (currentOrgId && currentProjectId) {
      try {
        const rules = await RulesService.getRules(currentOrgId, currentProjectId);
        setAllRules(rules as TrackingRule[]);
      } catch (error) {
        console.error('❌ Failed to reload rules:', error);
      }
    }
  }, [currentOrgId, currentProjectId]);

  const handleCloseRuleModal = useCallback(() => {
    setIsRuleModalOpen(false);
    setShowCreateRuleForm(false);
    setRuleName('');
    setConditions([{ id: '1', type: 'description_contains', value: '', operator: 'AND' }]);
  }, []);

  // KPI Card Editor handlers
  const handleToggleCard = useCallback((cardId: string) => {
    if (!user || !currentOrgId) return;
    
    // Check if it's a section, a KPI card, or a Top Performers subsection
    const allSections = ['kpi-cards', 'top-performers', 'posting-activity', 'tracked-accounts', 'videos-table'];
    const topPerformersSubsections = ['top-videos', 'top-accounts', 'top-gainers', 'top-creators', 'posting-times', 'top-platforms', 'comparison'];
    
    if (allSections.includes(cardId)) {
      // It's a main section
      setDashboardSectionVisibility(prev => {
        const updated = { ...prev, [cardId]: !prev[cardId] };
        localStorage.setItem('dashboardSectionVisibility', JSON.stringify(updated));
        // Save to Firebase
        DashboardPreferencesService.saveUserPreferences(currentOrgId, user.uid, {
          dashboardSectionVisibility: updated
        });
        return updated;
      });
    } else if (topPerformersSubsections.includes(cardId)) {
      // It's a Top Performers subsection
      setTopPerformersSubsectionVisibility(prev => {
        const updated = { ...prev, [cardId]: !prev[cardId] };
        localStorage.setItem('topPerformersSubsectionVisibility', JSON.stringify(updated));
        // Save to Firebase
        DashboardPreferencesService.saveUserPreferences(currentOrgId, user.uid, {
          topPerformersSubsectionVisibility: updated
        });
        return updated;
      });
    } else {
      // It's a KPI card
      setKpiCardVisibility(prev => {
        const updated = { ...prev, [cardId]: !prev[cardId] };
        localStorage.setItem('kpiCardVisibility', JSON.stringify(updated));
        // Save to Firebase
        DashboardPreferencesService.saveUserPreferences(currentOrgId, user.uid, {
          kpiCardVisibility: updated
        });
        return updated;
      });
    }
  }, [user, currentOrgId]);

  const handleReorderCard = useCallback((cardId: string, direction: 'up' | 'down') => {
    // Check if it's a section or a KPI card
    const allSections = ['kpi-cards', 'top-performers', 'top-platforms', 'posting-activity', 'tracked-accounts', 'videos-table'];
    if (allSections.includes(cardId)) {
      // It's a section
      setDashboardSectionOrder(prev => {
        const currentOrder = prev.length > 0 ? prev : allSections;
        
        const currentIndex = currentOrder.indexOf(cardId);
        if (currentIndex === -1) return currentOrder;
        
        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= currentOrder.length) return currentOrder;
        
        const newOrder = [...currentOrder];
        [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
        
        localStorage.setItem('dashboardSectionOrder', JSON.stringify(newOrder));
        return newOrder;
      });
    } else {
      // It's a KPI card
      setKpiCardOrder(prev => {
        const currentOrder = prev.length > 0 ? prev : [
          'views', 'likes', 'comments', 'shares', 'videos', 'accounts', 
          'engagementRate', /* 'revenue', 'downloads', */ 'link-clicks' // Revenue & Downloads hidden
        ];
        
        const currentIndex = currentOrder.indexOf(cardId);
        if (currentIndex === -1) return currentOrder;
        
        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= currentOrder.length) return currentOrder;
        
        const newOrder = [...currentOrder];
        [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
        
        localStorage.setItem('kpiCardOrder', JSON.stringify(newOrder));
        return newOrder;
      });
    }
  }, []);

  // Compute KPI preview data for the editor
  const kpiPreviewData = useMemo(() => {
    // Helper to generate sparkline data
    const generateMiniSparkline = (total: number, forceShow: boolean = false): Array<{ value: number }> => {
      const points = 10;
      if (total === 0) {
        // If forceShow is true, create a flat line at 0 or small values to still show the graph
        if (forceShow) {
          return Array.from({ length: points }, () => ({
            value: Math.random() * 2 + 1 // Small random values between 1-3 for visual interest
          }));
        }
        return [];
      }
      return Array.from({ length: points }, (_, i) => ({
        value: Math.round(total * (0.3 + (i / points) * 0.7)) // Show growth from 30% to 100%
      }));
    };

    // Calculate basic metrics from filtered submissions
    const totalViews = filteredSubmissions.reduce((sum, v) => sum + (v.views || 0), 0);
    const totalLikes = filteredSubmissions.reduce((sum, v) => sum + (v.likes || 0), 0);
    const totalComments = filteredSubmissions.reduce((sum, v) => sum + (v.comments || 0), 0);
    const totalShares = filteredSubmissions.reduce((sum, v) => sum + (v.shares || 0), 0);
    const totalVideos = filteredSubmissions.length;
    const totalAccounts = new Set(filteredSubmissions.map(v => v.uploaderHandle)).size;
    const totalEngagement = totalLikes + totalComments + totalShares;
    const engagementRate = totalViews > 0 ? ((totalEngagement / totalViews) * 100) : 0;
    
    // Count total link clicks (already filtered to existing links only)
    const totalLinkClicks = linkClicks.length;
    
    // Format numbers
    const formatNum = (num: number): string => {
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
      return num.toString();
    };

    return {
      views: {
        value: formatNum(totalViews),
        sparklineData: totalViews > 0 ? generateMiniSparkline(totalViews) : generateMiniSparkline(0, true),
        accent: 'emerald' as const,
        delta: totalViews > 0 ? { value: 12.5, isPositive: true } : undefined
      },
      likes: {
        value: formatNum(totalLikes),
        sparklineData: totalLikes > 0 ? generateMiniSparkline(totalLikes) : generateMiniSparkline(0, true),
        accent: 'pink' as const,
        delta: totalLikes > 0 ? { value: 8.3, isPositive: true } : undefined
      },
      comments: {
        value: formatNum(totalComments),
        sparklineData: totalComments > 0 ? generateMiniSparkline(totalComments) : generateMiniSparkline(0, true),
        accent: 'blue' as const,
        delta: totalComments > 0 ? { value: 5.2, isPositive: false } : undefined // Example negative trend
      },
      shares: {
        value: formatNum(totalShares),
        sparklineData: totalShares > 0 ? generateMiniSparkline(totalShares) : generateMiniSparkline(0, true),
        accent: 'violet' as const,
        delta: totalShares > 0 ? { value: 10.2, isPositive: true } : undefined
      },
      videos: {
        value: totalVideos.toString(),
        sparklineData: totalVideos > 0 ? generateMiniSparkline(totalVideos) : generateMiniSparkline(0, true),
        accent: 'teal' as const,
        delta: totalVideos > 0 ? { value: 5.0, isPositive: true } : undefined
      },
      accounts: {
        value: totalAccounts.toString(),
        sparklineData: totalAccounts > 0 ? generateMiniSparkline(totalAccounts) : generateMiniSparkline(0, true),
        accent: 'orange' as const,
        delta: totalAccounts > 0 ? { value: 0, isPositive: true } : undefined
      },
      engagementRate: {
        value: `${engagementRate.toFixed(1)}%`,
        sparklineData: engagementRate > 0 ? generateMiniSparkline(engagementRate * 10) : generateMiniSparkline(0, true),
        accent: 'emerald' as const,
        delta: engagementRate > 0 ? { value: 3.4, isPositive: false } : undefined // Example negative trend
      },
      revenue: {
        value: revenueMetrics ? `$${(revenueMetrics.totalRevenue / 100).toFixed(0)}` : '$0',
        sparklineData: revenueMetrics && revenueMetrics.totalRevenue > 0 
          ? generateMiniSparkline(revenueMetrics.totalRevenue / 100) 
          : generateMiniSparkline(0, true), // Force show graph even if 0
        accent: 'emerald' as const,
        delta: revenueMetrics && revenueMetrics.totalRevenue > 0 ? { value: 18.5, isPositive: true } : undefined
      },
      downloads: {
        value: revenueMetrics?.activeSubscriptions?.toString() || '0',
        sparklineData: revenueMetrics && revenueMetrics.activeSubscriptions && revenueMetrics.activeSubscriptions > 0
          ? generateMiniSparkline(revenueMetrics.activeSubscriptions)
          : generateMiniSparkline(0, true), // Force show graph even if 0
        accent: 'blue' as const,
        delta: revenueMetrics && revenueMetrics.activeSubscriptions && revenueMetrics.activeSubscriptions > 0 
          ? { value: 22.3, isPositive: true } 
          : undefined
      },
      'link-clicks': {
        value: totalLinkClicks.toString(),
        sparklineData: totalLinkClicks > 0 ? generateMiniSparkline(totalLinkClicks) : generateMiniSparkline(0, true),
        accent: 'violet' as const,
        delta: totalLinkClicks > 0 ? { value: 14.8, isPositive: true } : undefined
      }
    };
  }, [filteredSubmissions, filteredLinkClicks, revenueMetrics]);

  // Define Top Performers subsection options
  const topPerformersSubsectionOptions = useMemo(() => [
    { id: 'top-videos', label: 'Top Videos', description: 'Best performing videos', icon: Video },
    { id: 'top-accounts', label: 'Top Accounts', description: 'Best performing accounts', icon: AtSign },
    { id: 'top-gainers', label: 'Top Gainers', description: 'Videos with highest growth from snapshots', icon: TrendingUp },
    { id: 'top-creators', label: 'Top Creators', description: 'Best performing team creators', icon: Users },
    { id: 'posting-times', label: 'Best Posting Times', description: 'Engagement by day & hour', icon: Clock },
    { id: 'top-platforms', label: 'Top Platforms', description: 'Platform performance comparison', icon: Activity },
    { id: 'comparison', label: 'Platform Comparison', description: 'Multi-platform trend analysis', icon: BarChart3 },
  ].map(option => ({
    ...option,
    isVisible: topPerformersSubsectionVisibility[option.id] ?? false,
    category: 'top-performers-subsection' as const
  })), [topPerformersSubsectionVisibility]);

  // Define KPI card and section options for the editor
  const kpiCardOptions = useMemo(() => {
    // Dashboard sections come first
    const sections = [
      { id: 'kpi-cards', label: 'KPI Cards', description: 'Performance metrics overview', icon: Activity, category: 'sections' as const },
      { id: 'top-performers', label: 'Top Performers', description: 'Top videos, accounts, creators, posting times, platforms & comparison', icon: Activity, category: 'sections' as const },
      { id: 'posting-activity', label: 'Posting Activity', description: 'Daily posting frequency', icon: Activity, category: 'sections' as const },
      { id: 'tracked-accounts', label: 'Tracked Accounts', description: 'Full accounts dashboard', icon: AtSign, category: 'sections' as const },
      { id: 'videos-table', label: 'Videos Table', description: 'All video submissions', icon: Video, category: 'sections' as const },
    ];
    
    // Then KPI cards (nested under the KPI Cards section conceptually)
    const kpiCards = [
      { id: 'views', label: 'Views', description: 'Total video views', icon: Play, category: 'kpi' as const },
      { id: 'likes', label: 'Likes', description: 'Total likes received', icon: Heart, category: 'kpi' as const },
      { id: 'comments', label: 'Comments', description: 'Total comments', icon: MessageCircle, category: 'kpi' as const },
      { id: 'shares', label: 'Shares', description: 'Total shares/sends', icon: Share2, category: 'kpi' as const },
      { id: 'videos', label: 'Published Videos', description: 'Total videos published', icon: Video, category: 'kpi' as const },
      { id: 'accounts', label: 'Active Accounts', description: 'Number of tracked accounts', icon: AtSign, category: 'kpi' as const },
      { id: 'engagementRate', label: 'Engagement Rate', description: 'Average engagement percentage', icon: Activity, category: 'kpi' as const },
      { id: 'revenue', label: 'Revenue', description: 'Total revenue from app stores', icon: DollarSign, category: 'kpi' as const },
      { id: 'downloads', label: 'Downloads', description: 'App downloads/subscriptions', icon: Download, category: 'kpi' as const },
      { id: 'link-clicks', label: 'Link Clicks', description: 'Tracked link clicks', icon: LinkIcon, category: 'kpi' as const },
    ];
    
    // Sort sections
    const sortedSections = sections
      .sort((a, b) => {
        const aIndex = dashboardSectionOrder.indexOf(a.id);
        const bIndex = dashboardSectionOrder.indexOf(b.id);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      })
      .map(section => ({
        ...section,
        isVisible: dashboardSectionVisibility[section.id] !== false
      }));
    
    // Sort KPI cards
    const currentCardOrder = kpiCardOrder.length > 0 ? kpiCardOrder : [
      'views', 'likes', 'comments', 'shares', 'videos', 'accounts', 
      'engagementRate', 'revenue', 'downloads', 'link-clicks'
    ];
    
    const sortedCards = kpiCards
      .sort((a, b) => {
        const aIndex = currentCardOrder.indexOf(a.id);
        const bIndex = currentCardOrder.indexOf(b.id);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      })
      .map(card => ({
        ...card,
        isVisible: kpiCardVisibility[card.id] !== false
      }));
    
    // Combine: sections first, then cards, then Top Performers subsections
    return [...sortedSections, ...sortedCards, ...topPerformersSubsectionOptions];
  }, [kpiCardOrder, kpiCardVisibility, dashboardSectionOrder, dashboardSectionVisibility, topPerformersSubsectionOptions]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] relative">
      {/* Fixed Sidebar - Always visible */}
      <Sidebar 
        onCollapsedChange={setIsSidebarCollapsed}
        initialCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onMobileToggle={setIsMobileSidebarOpen}
      />
      
      {/* Sidebar overlay when in edit mode */}
      {isEditingLayout && (
        <div className="fixed inset-y-0 left-0 w-64 bg-black/30 backdrop-blur-sm z-40 pointer-events-none" />
      )}

      {/* Paywall Overlay - Only covers main content area */}
      {showPaywall && (
        <div 
          className="fixed top-0 right-0 bottom-0 z-50 flex items-center justify-center p-6 transition-all duration-300"
          style={{ left: isSidebarCollapsed ? '4rem' : '16rem' }}
        >
          {/* Blur Background */}
          <div className="absolute inset-0 bg-[#0A0A0A]/90 backdrop-blur-lg"></div>

          {/* Pricing Cards */}
          <PaywallOverlay isActive={true} />
        </div>
      )}

      {/* Main Content - Blur when paywall active */}
      <div className={showPaywall ? 'filter blur-sm pointer-events-none' : ''}>
      
      {/* Demo Banner - Shows at top if demo account */}
      {isDemoOrg && (
        <div className={clsx(
          'fixed top-0 right-0 z-30 transition-all duration-300',
          {
            'left-64': !isSidebarCollapsed,
            'left-16': isSidebarCollapsed,
          }
        )}>
          <DemoBanner />
        </div>
      )}
      
      {/* Account Filter Banner - Shows when filtering by specific account (only when 1 account selected AND on dashboard tab) */}
      {activeTab === 'dashboard' && selectedAccountIds.length === 1 && (() => {
        const filteredAccount = trackedAccounts.find(acc => acc.id === selectedAccountIds[0]);
        if (!filteredAccount) return null;
        
        const topOffset = isDemoOrg ? 'top-[60px]' : 'top-0';
        
        return (
          <div className={clsx(
            'fixed right-0 z-30 transition-all duration-300 bg-[#111111] border-b border-gray-800',
            topOffset,
            {
              'left-64': !isSidebarCollapsed,
              'left-16': isSidebarCollapsed,
            }
          )}>
            <div className="px-4 md:px-6 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                  {/* Profile Image */}
                  <div className="relative flex-shrink-0">
                    {filteredAccount.profilePicture ? (
                      <img 
                        src={filteredAccount.profilePicture} 
                        alt={filteredAccount.username}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover ring-2 ring-white/10"
                      />
                    ) : (
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center ring-2 ring-white/10">
                        <Users className="w-5 h-5 md:w-6 md:h-6 text-white/60" />
                      </div>
                    )}
                    {/* Verified Badge - Blue like Instagram */}
                    {filteredAccount.isVerified && (
                      <div className="absolute -bottom-0.5 -right-0.5 bg-blue-500 rounded-full p-0.5 flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 md:w-3.5 md:h-3.5 text-white fill-white stroke-blue-500 stroke-2" style={{ strokeWidth: 2.5 }} />
                      </div>
                    )}
                  </div>
                  
                  {/* Account Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm md:text-base font-semibold text-white truncate">
                        {filteredAccount.displayName || filteredAccount.username}
                      </h3>
                      <span className="text-xs md:text-sm text-white/40">@{filteredAccount.username}</span>
                    </div>
                    <div className="flex items-center gap-3 md:gap-4 mt-0.5 text-[11px] md:text-xs text-white/50 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        {(filteredAccount.followerCount || 0).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        {(() => {
                          if (!filteredAccount.dateAdded) return 'N/A';
                          try {
                            const date = filteredAccount.dateAdded.toDate ? filteredAccount.dateAdded.toDate() : new Date(filteredAccount.dateAdded.seconds * 1000);
                          return date.toLocaleDateString();
                          } catch (e) {
                            return 'N/A';
                          }
                        })()}
                      </span>
                      {/* Creator Link */}
                      <button 
                        className="flex items-center gap-1 hover:text-white/70 transition-colors group"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAccountToLinkCreator(filteredAccount);
                          setShowLinkCreatorModal(true);
                        }}
                      >
                        <Pencil className="w-3 h-3 md:w-3.5 md:h-3.5 group-hover:rotate-12 transition-transform" />
                        <span className="hidden sm:inline">
                          Creator: {accountCreatorName || 'None'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Close Button */}
                <button
                  onClick={() => {
                    setAccountFilterId(null);
                    setSelectedAccountIds([]);
                    navigate('/dashboard');
                  }}
                  className="flex-shrink-0 p-1.5 md:p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5 text-white/40 hover:text-white/70" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* Fixed Header */}
      <header className={clsx(
        'fixed right-0 bg-white dark:bg-[#111111] border-b border-gray-200 dark:border-gray-800 z-20 transition-all duration-300',
        'px-3 sm:px-4 md:px-6 py-3 md:py-4', // Responsive padding
        {
          'left-0 md:left-64': !isSidebarCollapsed, // Full width on mobile, adjust for sidebar on desktop
          'left-0 md:left-16': isSidebarCollapsed,
          'top-0': !isDemoOrg && (activeTab !== 'dashboard' || selectedAccountIds.length !== 1),
          'top-[60px]': isDemoOrg && (activeTab !== 'dashboard' || selectedAccountIds.length !== 1), // Push down if demo banner is showing
          'top-[128px]': isDemoOrg && activeTab === 'dashboard' && selectedAccountIds.length === 1, // Push down for both banners (60px demo + 68px account)
          'top-[68px]': !isDemoOrg && activeTab === 'dashboard' && selectedAccountIds.length === 1, // Push down for account banner only
        }
      )}>
        <div className="flex items-center justify-between w-full gap-2 md:gap-4">
          {/* Left Section: Hamburger + Title + Back Button */}
          <div className="flex items-center space-x-2 md:space-x-4 flex-1 min-w-0">
            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
            >
              <svg className="w-6 h-6 text-gray-900 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            {activeTab === 'accounts' && accountsViewMode === 'details' && (
              <button
                onClick={() => accountsPageRef.current?.handleBackToTable()}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">
                {activeTab === 'dashboard' && (isEditingLayout ? 'EDIT MODE' : 'Dashboard')}
                {activeTab === 'accounts' && 'Tracked Accounts'}
                {activeTab === 'videos' && 'Videos'}
                {activeTab === 'subscription' && 'Subscription Plans'}
                {activeTab === 'analytics' && 'Tracked Links'}
                {activeTab === 'creators' && 'Creators'}
                {activeTab === 'campaigns' && 'Campaigns'}
                {activeTab === 'extension' && 'Extension'}
                {activeTab === 'cron' && 'Cron Jobs'}
                {activeTab === 'settings' && 'Settings'}
              </h1>
              {activeTab !== 'analytics' && (
                <p className="hidden sm:block text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                  {activeTab === 'dashboard' && isEditingLayout && 'Drag sections around to make your unique dashboard'}
                  {activeTab === 'accounts' && 'Monitor entire Instagram and TikTok accounts'}
                  {activeTab === 'videos' && 'View and manage all tracked videos'}
                  {activeTab === 'subscription' && 'Choose the perfect plan to scale your tracking'}
                  {activeTab === 'creators' && 'Manage and discover content creators'}
                  {activeTab === 'campaigns' && 'Create and manage creator campaigns with rewards'}
                  {activeTab === 'extension' && 'Supercharge your workflow with our browser extension'}
                  {activeTab === 'cron' && 'Manage automated video refreshes'}
                  {activeTab === 'settings' && 'Configure your preferences'}
                </p>
              )}
            </div>
          </div>
          {activeTab === 'settings' && (
            <button
              onClick={() => setIsSignOutModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors border border-gray-200 dark:border-white/10"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="font-medium">Sign Out</span>
            </button>
          )}
          {activeTab === 'dashboard' && (
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              {!isEditingLayout ? (
                <>
                  {/* Mobile Filter Button - Shows on small screens, opens modal */}
                  <button
                    onClick={() => setIsMobileFiltersOpen(true)}
                    className="lg:hidden p-2 bg-white/5 dark:bg-white/5 text-white/90 rounded-lg border border-white/10 hover:border-white/20 transition-all backdrop-blur-sm relative"
                    title="Filters"
                  >
                    <Filter className="w-4 h-4" />
                    {(selectedAccountIds.length > 0 || dashboardPlatformFilter !== 'all' || activeRulesCount > 0) && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-gray-900"></span>
                    )}
                  </button>

                  {/* All filters aligned to the right */}
                  {/* Accounts Filter - Hide on mobile */}
                  <div className="hidden lg:block">
                  <MultiSelectDropdown
                    options={trackedAccounts.map(account => ({
                      id: account.id,
                      label: account.displayName || `@${account.username}`,
                      avatar: account.profilePicture
                    }))}
                    selectedIds={selectedAccountIds}
                    onChange={setSelectedAccountIds}
                    placeholder="All Accounts"
                  />
                  </div>
                  
                  {/* Platform Filter - Icon Based - Hide text on mobile */}
                  <div className="relative hidden sm:block">
                    <button
                      onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
                      onBlur={() => setTimeout(() => setPlatformDropdownOpen(false), 200)}
                      className="flex items-center gap-2 pl-2 sm:pl-3 pr-6 sm:pr-8 py-2 bg-white/5 dark:bg-white/5 text-white/90 rounded-lg text-xs sm:text-sm font-medium border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm min-w-[100px] sm:min-w-[140px]"
                      title={dashboardPlatformFilter === 'all' ? 'All Platforms' : dashboardPlatformFilter.charAt(0).toUpperCase() + dashboardPlatformFilter.slice(1)}
                    >
                      {dashboardPlatformFilter === 'all' ? (
                        <span>All Platforms</span>
                      ) : (
                        <>
                          <PlatformIcon platform={dashboardPlatformFilter as 'instagram' | 'tiktok' | 'youtube' | 'twitter'} size="sm" />
                          <span className="capitalize">{dashboardPlatformFilter === 'twitter' ? 'X' : dashboardPlatformFilter}</span>
                        </>
                      )}
                      <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-white/50" />
                    </button>
                    
                    {platformDropdownOpen && (
                      <div className="absolute top-full mt-1 w-48 bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
                        <button
                          onClick={() => {
                            setDashboardPlatformFilter('all');
                            localStorage.setItem('dashboardPlatformFilter', 'all');
                            setPlatformDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                            dashboardPlatformFilter === 'all' 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'text-white/90 hover:bg-white/5'
                          }`}
                        >
                          <span>All Platforms</span>
                        </button>
                        <button
                          onClick={() => {
                            setDashboardPlatformFilter('instagram');
                            localStorage.setItem('dashboardPlatformFilter', 'instagram');
                            setPlatformDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                            dashboardPlatformFilter === 'instagram' 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'text-white/90 hover:bg-white/5'
                          }`}
                        >
                          <PlatformIcon platform="instagram" size="sm" />
                          <span>Instagram</span>
                        </button>
                        <button
                          onClick={() => {
                            setDashboardPlatformFilter('tiktok');
                            localStorage.setItem('dashboardPlatformFilter', 'tiktok');
                            setPlatformDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                            dashboardPlatformFilter === 'tiktok' 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'text-white/90 hover:bg-white/5'
                          }`}
                        >
                          <PlatformIcon platform="tiktok" size="sm" />
                          <span>TikTok</span>
                        </button>
                        <button
                          onClick={() => {
                            setDashboardPlatformFilter('youtube');
                            localStorage.setItem('dashboardPlatformFilter', 'youtube');
                            setPlatformDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                            dashboardPlatformFilter === 'youtube' 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'text-white/90 hover:bg-white/5'
                          }`}
                        >
                          <PlatformIcon platform="youtube" size="sm" />
                          <span>YouTube</span>
                        </button>
                        <button
                          onClick={() => {
                            setDashboardPlatformFilter('twitter');
                            localStorage.setItem('dashboardPlatformFilter', 'twitter');
                            setPlatformDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                            dashboardPlatformFilter === 'twitter' 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'text-white/90 hover:bg-white/5'
                          }`}
                        >
                          <PlatformIcon platform="twitter" size="sm" />
                          <span>X (Twitter)</span>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Granularity Selector - Dropdown - Hide on small screens */}
                  <div className="relative hidden md:block">
                    <select
                      value={granularity}
                      onChange={(e) => setGranularity(e.target.value as 'day' | 'week' | 'month' | 'year')}
                      className="appearance-none pl-3 pr-8 py-2 bg-white/5 dark:bg-white/5 text-white/90 rounded-lg text-sm font-medium border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm"
                    >
                      <option value="day" className="bg-gray-900">Daily</option>
                      <option value="week" className="bg-gray-900">Weekly</option>
                      <option value="month" className="bg-gray-900">Monthly</option>
                      <option value="year" className="bg-gray-900">Yearly</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-white/50 pointer-events-none" />
                  </div>
                  
                  <div className="hidden sm:block">
                  <DateRangeFilter
                    selectedFilter={dateFilter}
                    customRange={customDateRange}
                    onFilterChange={handleDateFilterChange}
                  />
                  </div>
                  
                  {/* Rule Filter Button - Icon with Badge - Hidden on mobile */}
                  <button
                    onClick={handleOpenRuleModal}
                    className="hidden lg:block relative p-2 bg-white/5 dark:bg-white/5 text-white/90 rounded-lg border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm"
                    title={activeRulesCount === 0 ? 'All Videos' : `${activeRulesCount} rule${activeRulesCount > 1 ? 's' : ''} applied`}
                  >
                    <Filter className="w-4 h-4" />
                    {activeRulesCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full border-2 border-gray-900">
                        {activeRulesCount}
                      </span>
                    )}
                  </button>
                  
                  {/* Edit Layout Button - Icon Only (Hidden in demo mode and on mobile) */}
                  {!isDemoMode && (
                  <button
                    onClick={() => setIsEditingLayout(true)}
                    className="hidden sm:block p-2 rounded-lg transition-all bg-white/5 text-white/90 border border-white/10 hover:border-white/20"
                    title="Customize dashboard layout"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  )}
                  
                  {/* Manual Refresh Button - Temporary for testing (Hidden in demo mode and on mobile) */}
                  {!isDemoMode && (
                  <button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className={`hidden sm:block p-2 rounded-lg transition-all border ${
                      isRefreshing 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-wait' 
                        : 'bg-white/5 text-white/90 border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400'
                    }`}
                    title="Manually refresh all video data"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                  )}
                </>
               ) : (
                 <>
                   {/* Edit Mode Controls */}
                   <button
                     onClick={() => setIsCardEditorOpen(true)}
                     className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30"
                     title="Add or remove dashboard cards"
                   >
                     <Plus className="w-4 h-4" />
                     Add Item
                   </button>
                   
                   <button
                     onClick={() => setIsEditingLayout(false)}
                     className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-white/10 text-white hover:bg-white/20"
                   >
                     Done
                   </button>
                 </>
               )}
            </div>
          )}
          {activeTab === 'accounts' && (
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              {/* Mobile Filter Button */}
              <button
                onClick={() => setIsMobileFiltersOpen(true)}
                className="sm:hidden p-2 bg-white/5 dark:bg-white/5 text-white/90 rounded-lg border border-white/10 hover:border-white/20 transition-all backdrop-blur-sm relative"
                title="Filters"
              >
                <Filter className="w-4 h-4" />
                {(dashboardPlatformFilter !== 'all' || activeRulesCount > 0) && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-gray-900"></span>
                )}
              </button>

              {/* Search Bar - Responsive width */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={accountsSearchQuery}
                  onChange={(e) => setAccountsSearchQuery(e.target.value)}
                  className="pl-10 pr-2 sm:pr-4 py-2 w-24 sm:w-40 md:w-64 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white"
                />
              </div>
              
              {/* Platform Filter - Icon Based - Hidden on mobile */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
                  onBlur={() => setTimeout(() => setPlatformDropdownOpen(false), 200)}
                  className="flex items-center gap-2 pl-3 pr-8 py-2 bg-white/5 dark:bg-white/5 text-white/90 rounded-lg text-sm font-medium border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm min-w-[140px]"
                  title={dashboardPlatformFilter === 'all' ? 'All Platforms' : dashboardPlatformFilter.charAt(0).toUpperCase() + dashboardPlatformFilter.slice(1)}
                >
                  {dashboardPlatformFilter === 'all' ? (
                    <span>All Platforms</span>
                  ) : (
                    <>
                      <PlatformIcon platform={dashboardPlatformFilter as 'instagram' | 'tiktok' | 'youtube'} size="sm" />
                      <span className="capitalize">{dashboardPlatformFilter}</span>
                    </>
                  )}
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-white/50" />
                </button>
                
                {platformDropdownOpen && (
                  <div className="absolute top-full mt-1 w-48 bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
                    <button
                      onClick={() => {
                        setDashboardPlatformFilter('all');
                        localStorage.setItem('dashboardPlatformFilter', 'all');
                        setPlatformDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        dashboardPlatformFilter === 'all' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'text-white/90 hover:bg-white/5'
                      }`}
                    >
                      <span>All Platforms</span>
                    </button>
                    <button
                      onClick={() => {
                        setDashboardPlatformFilter('instagram');
                        localStorage.setItem('dashboardPlatformFilter', 'instagram');
                        setPlatformDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        dashboardPlatformFilter === 'instagram' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'text-white/90 hover:bg-white/5'
                      }`}
                    >
                      <PlatformIcon platform="instagram" size="sm" />
                      <span>Instagram</span>
                    </button>
                    <button
                      onClick={() => {
                        setDashboardPlatformFilter('tiktok');
                        localStorage.setItem('dashboardPlatformFilter', 'tiktok');
                        setPlatformDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        dashboardPlatformFilter === 'tiktok' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'text-white/90 hover:bg-white/5'
                      }`}
                    >
                      <PlatformIcon platform="tiktok" size="sm" />
                      <span>TikTok</span>
                    </button>
                    <button
                      onClick={() => {
                        setDashboardPlatformFilter('youtube');
                        localStorage.setItem('dashboardPlatformFilter', 'youtube');
                        setPlatformDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        dashboardPlatformFilter === 'youtube' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'text-white/90 hover:bg-white/5'
                      }`}
                    >
                      <PlatformIcon platform="youtube" size="sm" />
                      <span>YouTube</span>
                    </button>
                  </div>
                )}
              </div>
              
              {/* Date Range Filter - Hidden on mobile */}
              <div className="hidden sm:block">
              <DateRangeFilter
                selectedFilter={dateFilter}
                customRange={customDateRange}
                onFilterChange={handleDateFilterChange}
              />
              </div>
              
              {/* Rule Filter Button - Icon with Badge - Hidden on mobile */}
              <button
                onClick={handleOpenRuleModal}
                className="hidden sm:block relative p-2 bg-white/5 dark:bg-white/5 text-white/90 rounded-lg border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm"
                title={activeRulesCount === 0 ? 'All Videos' : `${activeRulesCount} rule${activeRulesCount > 1 ? 's' : ''} applied`}
              >
                <Filter className="w-4 h-4" />
                {activeRulesCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full border-2 border-gray-900">
                    {activeRulesCount}
                  </span>
                )}
              </button>
            </div>
          )}
          {activeTab === 'videos' && (
            <div className="flex items-center space-x-2 flex-shrink-0">
              {/* Mobile Filter Button - Shows on small screens */}
              <button
                onClick={() => setIsMobileFiltersOpen(true)}
                className="lg:hidden p-2 bg-white/5 dark:bg-white/5 text-white/90 rounded-lg border border-white/10 hover:border-white/20 transition-all backdrop-blur-sm relative"
                title="Filters"
              >
                <Filter className="w-4 h-4" />
                {(selectedAccountIds.length > 0 || dashboardPlatformFilter !== 'all' || activeRulesCount > 0) && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-gray-900"></span>
                )}
              </button>

              {/* Accounts Filter - Hide on mobile */}
              <div className="hidden lg:block">
              <MultiSelectDropdown
                options={trackedAccounts.map(account => ({
                  id: account.id,
                  label: account.displayName || `@${account.username}`,
                  avatar: account.profilePicture
                }))}
                selectedIds={selectedAccountIds}
                onChange={setSelectedAccountIds}
                placeholder="All Accounts"
              />
              </div>
              
              {/* Platform Filter - Icon Based - Hide on mobile */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
                  onBlur={() => setTimeout(() => setPlatformDropdownOpen(false), 200)}
                  className="flex items-center gap-2 pl-3 pr-8 py-2 bg-white/5 dark:bg-white/5 text-white/90 rounded-lg text-sm font-medium border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm min-w-[140px]"
                  title={dashboardPlatformFilter === 'all' ? 'All Platforms' : dashboardPlatformFilter.charAt(0).toUpperCase() + dashboardPlatformFilter.slice(1)}
                >
                  {dashboardPlatformFilter === 'all' ? (
                    <span>All Platforms</span>
                  ) : (
                    <>
                      <PlatformIcon platform={dashboardPlatformFilter as 'instagram' | 'tiktok' | 'youtube'} size="sm" />
                      <span className="capitalize">{dashboardPlatformFilter}</span>
                    </>
                  )}
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-white/50" />
                </button>
                
                {platformDropdownOpen && (
                  <div className="absolute top-full mt-1 w-48 bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
                    <button
                      onClick={() => {
                        setDashboardPlatformFilter('all');
                        localStorage.setItem('dashboardPlatformFilter', 'all');
                        setPlatformDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        dashboardPlatformFilter === 'all' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'text-white/90 hover:bg-white/5'
                      }`}
                    >
                      <span>All Platforms</span>
                    </button>
                    <button
                      onClick={() => {
                        setDashboardPlatformFilter('instagram');
                        localStorage.setItem('dashboardPlatformFilter', 'instagram');
                        setPlatformDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        dashboardPlatformFilter === 'instagram' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'text-white/90 hover:bg-white/5'
                      }`}
                    >
                      <PlatformIcon platform="instagram" size="sm" />
                      <span>Instagram</span>
                    </button>
                    <button
                      onClick={() => {
                        setDashboardPlatformFilter('tiktok');
                        localStorage.setItem('dashboardPlatformFilter', 'tiktok');
                        setPlatformDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        dashboardPlatformFilter === 'tiktok' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'text-white/90 hover:bg-white/5'
                      }`}
                    >
                      <PlatformIcon platform="tiktok" size="sm" />
                      <span>TikTok</span>
                    </button>
                    <button
                      onClick={() => {
                        setDashboardPlatformFilter('youtube');
                        localStorage.setItem('dashboardPlatformFilter', 'youtube');
                        setPlatformDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        dashboardPlatformFilter === 'youtube' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'text-white/90 hover:bg-white/5'
                      }`}
                    >
                      <PlatformIcon platform="youtube" size="sm" />
                      <span>YouTube</span>
                    </button>
                  </div>
                )}
              </div>
              
              <div className="hidden sm:block">
              <DateRangeFilter
                selectedFilter={dateFilter}
                customRange={customDateRange}
                onFilterChange={handleDateFilterChange}
              />
              </div>
              
              {/* Rule Filter Button - Icon with Badge - Hide on mobile */}
              <button
                onClick={handleOpenRuleModal}
                className="hidden lg:block relative p-2 bg-white/5 dark:bg-white/5 text-white/90 rounded-lg border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm"
                title={activeRulesCount === 0 ? 'All Videos' : `${activeRulesCount} rule${activeRulesCount > 1 ? 's' : ''} applied`}
              >
                <Filter className="w-4 h-4" />
                {activeRulesCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full border-2 border-gray-900">
                    {activeRulesCount}
                  </span>
                )}
              </button>
            </div>
          )}
          {activeTab === 'campaigns' && (
            <div className="flex items-center gap-2">
              {(['all', 'active', 'draft', 'completed', 'cancelled'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setCampaignStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    campaignStatusFilter === status
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  {status !== 'all' && (
                    <span className="ml-1.5 text-xs opacity-60">
                      ({campaignCounts[status as keyof typeof campaignCounts] || 0})
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {activeTab === 'analytics' && (
            <div className="flex items-center space-x-4">
              {/* Link Filter Dropdown */}
              <select
                value={linkFilter}
                onChange={(e) => setLinkFilter(e.target.value)}
                className="px-4 py-2 bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors text-sm font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">All Links ({allLinks.length})</option>
                {allLinks.map(link => (
                  <option key={link.id} value={link.id}>
                    {link.title || link.shortCode}
                  </option>
                ))}
              </select>
              
              <DateRangeFilter
                selectedFilter={linksDateFilter}
                customRange={linksCustomDateRange}
                onFilterChange={(filter, range) => {
                  setLinksDateFilter(filter);
                  if (range) {
                    setLinksCustomDateRange(range);
                  }
                }}
              />
            </div>
          )}
          {activeTab === 'creators' && (
            <div className="flex items-center space-x-4">
              <DateRangeFilter
                selectedFilter={creatorsDateFilter}
                onFilterChange={(filter) => setCreatorsDateFilter(filter)}
              />
            </div>
          )}
        </div>
      </header>

      {/* Main Content with dynamic margins for sidebar and header */}
      <main className={clsx(
        'overflow-auto min-h-screen transition-all duration-300',
        {
          'pt-16 md:pt-24': !isDemoOrg && (activeTab !== 'dashboard' || selectedAccountIds.length !== 1), // Default top padding
          'pt-[5.5rem] md:pt-[7.5rem]': isDemoOrg && (activeTab !== 'dashboard' || selectedAccountIds.length !== 1), // Extra padding when demo banner is showing
          'pt-[9rem] md:pt-[10rem]': !isDemoOrg && activeTab === 'dashboard' && selectedAccountIds.length === 1, // Extra padding for account banner
          'pt-[10rem] md:pt-[11rem]': isDemoOrg && activeTab === 'dashboard' && selectedAccountIds.length === 1, // Extra padding for both banners
          'ml-0 md:ml-64': !isSidebarCollapsed, // No left margin on mobile
          'ml-0 md:ml-16': isSidebarCollapsed,
        }
      )} style={{ overflowX: 'hidden', overflowY: 'auto' }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-8" style={{ overflow: 'visible' }}>
          {/* Dashboard Tab - Only render when active to prevent unnecessary calculations */}
          {activeTab === 'dashboard' && (
            <div>
              {/* Empty State - Show when no accounts AND no videos (and not loading) */}
              {!loadingDashboard && trackedAccounts.length === 0 && submissions.length === 0 && (
                <BlurEmptyState
                  title="Start Tracking Your Content"
                  description="Add your first social media account or video to start monitoring performance and growing your audience."
                  animation={videoMaterialAnimation}
                  tooltipText="Track Instagram, TikTok, YouTube, and X accounts. Monitor video performance, engagement rates, and audience growth in real-time."
                  actions={[
                    {
                      label: 'Add Account',
                      onClick: () => {
                        navigate('/accounts');
                        localStorage.setItem('activeTab', 'accounts');
                      },
                      icon: Users,
                      primary: true
                    },
                    {
                      label: 'Add Video',
                      onClick: () => navigate('/videos'),
                      icon: Video
                    }
                  ]}
                />
              )}
              
              {/* Dashboard Content - Show when there's data */}
              {(trackedAccounts.length > 0 || submissions.length > 0) && (
              <div>
              {/* Render dashboard sections in order */}
              {dashboardSectionOrder
                .filter(sectionId => dashboardSectionVisibility[sectionId] !== false)
                .map((sectionId, index) => {
                  const handleSectionDragStart = () => {
                    if (isEditingLayout) setDraggedSection(sectionId);
                  };
                  
                  const handleSectionDragEnd = () => {
                    setDraggedSection(null);
                    setDragOverSection(null);
                  };
                  
                  const handleSectionDragOver = (e: React.DragEvent) => {
                    if (isEditingLayout) {
                      e.preventDefault();
                      setDragOverSection(sectionId);
                    }
                  };
                  
                  const handleSectionDragLeave = () => {
                    setDragOverSection(null);
                  };
                  
                  const handleSectionDrop = () => {
                    if (isEditingLayout && draggedSection && draggedSection !== sectionId) {
                      const currentOrder = [...dashboardSectionOrder];
                      const draggedIndex = currentOrder.indexOf(draggedSection);
                      const targetIndex = currentOrder.indexOf(sectionId);
                      
                      if (draggedIndex !== -1 && targetIndex !== -1) {
                        const newOrder = [...currentOrder];
                        newOrder.splice(draggedIndex, 1);
                        newOrder.splice(targetIndex, 0, draggedSection);
                        setDashboardSectionOrder(newOrder);
                        localStorage.setItem('dashboardSectionOrder', JSON.stringify(newOrder));
                        // Save to Firebase
                        if (user && currentOrgId) {
                          DashboardPreferencesService.saveUserPreferences(currentOrgId, user.uid, {
                            dashboardSectionOrder: newOrder
                          });
                        }
                      }
                    }
                    setDraggedSection(null);
                    setDragOverSection(null);
                  };
                  
                  const getSectionTitle = (id: string) => {
                    return dashboardSectionTitles[id] || id;
                  };
                  
                  const renderSectionContent = () => {
                    // Show skeleton while data is loading
                    if (isInitialLoading) {
                      return <DashboardSkeleton height={sectionId === 'kpi-cards' ? 'h-48' : 'h-96'} />;
                    }
                    
                    switch (sectionId) {
                      case 'kpi-cards':
                        return (
                          <KPICards 
                            submissions={filteredSubmissions}
                            allSubmissions={submissionsWithoutDateFilter}
                            linkClicks={filteredLinkClicks}
                            links={links}
                            accounts={trackedAccounts}
                            dateFilter={dateFilter}
                            customRange={customDateRange}
                            timePeriod="days"
                            granularity={granularity}
                            onVideoClick={handleVideoClick}
                            onOpenRevenueSettings={() => setIsRevenueModalOpen(true)}
                            revenueMetrics={revenueMetrics}
                            revenueIntegrations={revenueIntegrations}
                            isEditMode={isEditingLayout}
                            cardOrder={kpiCardOrder}
                            cardVisibility={kpiCardVisibility}
                            onReorder={(newOrder) => {
                              setKpiCardOrder(newOrder);
                              localStorage.setItem('kpiCardOrder', JSON.stringify(newOrder));
                              // Save to Firebase
                              if (user && currentOrgId) {
                                DashboardPreferencesService.saveUserPreferences(currentOrgId, user.uid, {
                                  kpiCardOrder: newOrder
                                });
                              }
                            }}
                            onToggleCard={handleToggleCard}
                          />
                        );
                      case 'top-performers':
                        {
                          const topPerformersDateRange = DateFilterService.getDateRange(dateFilter, customDateRange, submissions);
                          return (
                            <TopPerformersSection
                              submissions={filteredSubmissions}
                              onVideoClick={handleVideoClick}
                              onAccountClick={handleAccountClick}
                              onHeatmapCellClick={({ dayIndex, hour, range }) => {
                                console.log('🎯 Heatmap cell clicked:', { dayIndex, hour, range });
                                setDayVideosDate(range.start);
                                setSelectedAccountFilter(undefined); // Clear account filter for heatmap clicks
                                // Store day and hour for filtering
                                (window as any).__heatmapDayOfWeek = dayIndex;
                                (window as any).__heatmapHourRange = { start: hour, end: hour + 1 };
                                console.log('💾 Stored filters:', { 
                                  dayOfWeek: (window as any).__heatmapDayOfWeek,
                                  hourRange: (window as any).__heatmapHourRange
                                });
                                setIsDayVideosModalOpen(true);
                              }}
                              subsectionVisibility={topPerformersSubsectionVisibility}
                              isEditMode={isEditingLayout}
                              onToggleSubsection={handleToggleCard}
                              granularity={granularity}
                              dateRange={topPerformersDateRange}
                            />
                          );
                        }
                      case 'posting-activity':
                        return (
                          <PostingActivityHeatmap 
                            submissions={filteredSubmissions}
                            onVideoClick={handleVideoClick}
                            dateFilter={dateFilter}
                            customRange={customRange}
                          />
                        );
                      case 'tracked-accounts':
                        return (
                          <AccountsPage 
                            ref={accountsPageRef}
                            dateFilter={dateFilter}
                            platformFilter={dashboardPlatformFilter}
                            searchQuery={accountsSearchQuery}
                            onViewModeChange={setAccountsViewMode}
                            pendingAccounts={pendingAccounts}
                            selectedRuleIds={selectedRuleIds}
                            dashboardRules={allRules}
                            accountFilterId={accountFilterId}
                            creatorFilterId={creatorFilterId}
                          />
                        );
                      case 'videos-table':
                        return combinedSubmissions.length === 0 ? (
                          <BlurEmptyState
                            title="Track Your First Video"
                            description="Add your first video to start monitoring views, engagement, and performance across platforms."
                            animation={videoMaterialAnimation}
                            tooltipText="Track videos from Instagram, TikTok, YouTube, and X to analyze engagement, reach, and performance trends."
                            actions={[
                              {
                                label: 'Add Video',
                                onClick: () => setIsModalOpen(true),
                                icon: Video,
                                primary: true
                              }
                            ]}
                          />
                        ) : (
                          <VideoSubmissionsTable
                            submissions={combinedSubmissions}
                            onDelete={handleDelete}
                            onVideoClick={handleVideoClick}
                            headerTitle={getVideoTableHeader(dateFilter)}
                          />
                        );
                      default:
                        return null;
                    }
                  };
                  
                  return (
                    <div key={sectionId} className={index > 0 ? 'mt-6' : ''}>
                      <DraggableSection
                        id={sectionId}
                        title={getSectionTitle(sectionId)}
                        isEditMode={isEditingLayout}
                        isDragging={draggedSection === sectionId}
                        isDragOver={dragOverSection === sectionId}
                        onDragStart={handleSectionDragStart}
                        onDragEnd={handleSectionDragEnd}
                        onDragOver={handleSectionDragOver}
                        onDragLeave={handleSectionDragLeave}
                        onDrop={handleSectionDrop}
                      >
                        {renderSectionContent()}
                      </DraggableSection>
                    </div>
                  );
                })}
              
              {/* Section Trash Drop Zone - Only visible when dragging a section */}
              {isEditingLayout && draggedSection && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsOverSectionTrash(true);
                  }}
                  onDragLeave={() => setIsOverSectionTrash(false)}
                  onDrop={() => {
                    if (draggedSection && handleToggleCard) {
                      // Hide the section by toggling its visibility
                      handleToggleCard(draggedSection);
                    }
                    setDraggedSection(null);
                    setIsOverSectionTrash(false);
                  }}
                  className={`
                    fixed bottom-4 md:bottom-8 left-1/2 transform -translate-x-1/2 z-[100]
                    flex flex-col items-center justify-center gap-2
                    px-4 py-3 md:px-6 md:py-4 rounded-xl border-2 border-dashed
                    transition-all duration-200
                    ${isOverSectionTrash 
                      ? 'bg-red-500/20 border-red-500 scale-105' 
                      : 'bg-red-500/5 border-red-500/40 hover:bg-red-500/10'
                    }
                  `}
                >
                  <svg className={`w-8 h-8 transition-all ${isOverSectionTrash ? 'text-red-400' : 'text-red-400/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className={`text-xs font-medium transition-all ${isOverSectionTrash ? 'text-red-300' : 'text-red-400/60'}`}>
                    {isOverSectionTrash ? 'Release to hide section' : 'Drag here to hide section'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Accounts Tab and Videos Tab are now separate routes (/accounts, /videos)
              This code is legacy and not used since activeTab is always 'dashboard' in this component */}
          {false && (
            <div className="space-y-6">
              {isInitialLoading ? (
                <DashboardSkeleton height="h-96" />
              ) : (
                <>
                  {/* Top Performers Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Videos */}
                    <div className="group relative">
                      <TopPerformersRaceChart
                        submissions={filteredSubmissions}
                        onVideoClick={handleVideoClick}
                        onAccountClick={(username) => {
                          // Handle account click - could navigate to account details
                          console.log('Account clicked:', username);
                        }}
                        type="videos"
                      />
                    </div>

                    {/* Top Gainers */}
                    <div className="group relative">
                      <TopPerformersRaceChart
                        submissions={filteredSubmissions}
                        onVideoClick={handleVideoClick}
                        onAccountClick={(username) => {
                          console.log('Account clicked:', username);
                        }}
                        type="gainers"
                      />
                    </div>
                  </div>

                  {/* Videos Table */}
                  <div className="bg-white dark:bg-[#161616] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                <VideoSubmissionsTable 
                  submissions={filteredSubmissions}
                  onVideoClick={handleVideoClick}
                  headerTitle="All Videos"
                />
                  </div>
                </>
              )}
              </div>
              )}
            </div>
          )}

          {/* Accounts Tab */}
          {activeTab === 'accounts' && (
            <AccountsPage 
              ref={accountsPageRef}
              dateFilter={dateFilter}
              platformFilter={dashboardPlatformFilter}
              searchQuery={accountsSearchQuery}
              onViewModeChange={setAccountsViewMode}
              pendingAccounts={pendingAccounts}
              selectedRuleIds={selectedRuleIds}
              dashboardRules={allRules}
              organizationId={currentOrgId || undefined}
              projectId={currentProjectId || undefined}
              accountFilterId={accountFilterId}
              creatorFilterId={creatorFilterId}
            />
          )}

          {/* Videos Tab */}
          {activeTab === 'videos' && (
            isInitialLoading ? (
              <div className="space-y-4">
                {/* Loading skeleton for videos */}
                <div className="bg-white dark:bg-[#161616] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="p-6 space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 animate-pulse">
                        <div className="w-24 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                        </div>
                        <div className="flex gap-4">
                          <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : !loadingDashboard && combinedSubmissions.length === 0 ? (
              <BlurEmptyState
                title="Track Your First Video"
                description="Add your first video to start monitoring views, engagement, and performance across platforms."
                animation={videoMaterialAnimation}
                tooltipText="Track videos from Instagram, TikTok, YouTube, and X to analyze engagement, reach, and performance trends."
                actions={[
                  {
                    label: 'Add Video',
                    onClick: () => setIsModalOpen(true),
                    icon: Video,
                    primary: true
                  }
                ]}
              />
            ) : (
              <VideoSubmissionsTable
                submissions={combinedSubmissions}
                onDelete={handleDelete}
                onVideoClick={handleVideoClick}
                headerTitle={getVideoTableHeader(dateFilter)}
              />
            )
          )}

          {/* Subscription Tab */}
          {activeTab === 'subscription' && <SubscriptionPage />}

          {/* Extension Tab - Shows promo modal */}
          {activeTab === 'extension' && (
            <ExtensionPromoModal
              isOpen={true}
              onClose={() => navigate('/dashboard')}
            />
          )}

          {/* Settings Tab (includes Team tab inside) */}
          {activeTab === 'settings' && <SettingsPage initialTab={initialSettingsTab} />}

          {/* Cron Management Tab */}
          {activeTab === 'cron' && <CronManagementPage />}

          {/* Tracked Links Tab */}
          {activeTab === 'analytics' && (
            <TrackedLinksPage 
              ref={trackedLinksPageRef} 
              linkClicks={linkClicks}
              dateFilter={linksDateFilter}
              customDateRange={linksCustomDateRange}
              organizationId={currentOrgId || undefined}
              projectId={currentProjectId || undefined}
              linkFilter={linkFilter}
              onLinksLoad={(links) => setAllLinks(links)}
            />
          )}

          {/* Creators Tab - Show appropriate view based on role */}
          {activeTab === 'creators' && (
            userRole === 'creator' ? <CreatorPortalPage /> : <CreatorsManagementPage ref={creatorsPageRef} dateFilter={creatorsDateFilter} organizationId={currentOrgId || undefined} projectId={currentProjectId || undefined} />
          )}

          {/* Campaigns Tab */}
          {activeTab === 'campaigns' && (
            <CampaignsManagementPage 
              selectedStatus={campaignStatusFilter}
              onStatusChange={setCampaignStatusFilter}
              onCampaignsLoaded={setCampaignCounts}
              organizationId={currentOrgId || undefined}
              projectId={currentProjectId || undefined}
            />
          )}

          {/* Team Members Tab */}
          {activeTab === 'team' && <TeamManagementPage />}

          {/* Revenue Tab */}
          {activeTab === 'revenue' && <RevenueManagementPage />}

          {/* Other Tabs - Placeholder */}
          {!['dashboard', 'accounts', 'videos', 'subscription', 'settings', 'analytics', 'creators', 'campaigns', 'cron', 'team', 'revenue', 'invitations'].includes(activeTab) && (
            <div className="bg-white dark:bg-[#161616] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚧</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Coming Soon</h3>
              <p className="text-gray-500 dark:text-gray-400">
                This feature is under development and will be available soon.
              </p>
            </div>
          )}
        </div>
      </main>

      <AddTypeSelector
        isOpen={isTypeSelectorOpen}
        onClose={() => setIsTypeSelectorOpen(false)}
        onSelectType={(type) => {
          // Close type selector first, then open the selected modal after a brief delay
          setIsTypeSelectorOpen(false);
          setTimeout(() => {
            if (type === 'video') {
              setIsModalOpen(true);
            } else if (type === 'account') {
              accountsPageRef.current?.openAddModal();
            }
          }, 100);
        }}
      />

      <AddVideoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddVideo={handleAddVideosWithAccounts}
      />

      <TikTokSearchModal
        isOpen={isTikTokSearchOpen}
        onClose={() => setIsTikTokSearchOpen(false)}
        onVideosFound={handleTikTokVideosFound}
      />

      {/* Video Analytics Modal - Only render for non-creators */}
      {userRole !== 'creator' && (
        <VideoAnalyticsModal
          video={selectedVideoForAnalytics}
          isOpen={isAnalyticsModalOpen}
          onClose={handleCloseAnalyticsModal}
          totalCreatorVideos={totalCreatorVideos}
          hideDateFilter={true}
        />
      )}

      {/* KPI Card Editor Modal */}
      <KPICardEditor
        isOpen={isCardEditorOpen}
        onClose={() => setIsCardEditorOpen(false)}
        cardOptions={kpiCardOptions}
        onToggleCard={handleToggleCard}
        onReorder={handleReorderCard}
        sectionTitles={dashboardSectionTitles}
        kpiPreviewData={kpiPreviewData}
        onRenameSection={(sectionId, newTitle) => {
          const updated = { ...dashboardSectionTitles, [sectionId]: newTitle };
          setDashboardSectionTitles(updated);
          localStorage.setItem('dashboardSectionTitles', JSON.stringify(updated));
        }}
        renderSectionPreview={(sectionId) => {
          // Show skeleton while data is loading
          if (isInitialLoading) {
            return <DashboardSkeleton height={sectionId === 'kpi-cards' ? 'h-48' : 'h-96'} />;
          }
          
          // Render live preview of each section
          switch (sectionId) {
            case 'kpi-cards':
              return (
                <KPICards 
                  submissions={filteredSubmissions}
                  allSubmissions={submissionsWithoutDateFilter}
                  linkClicks={filteredLinkClicks}
                  links={links}
                  accounts={trackedAccounts}
                  dateFilter={dateFilter}
                  customRange={customDateRange}
                  timePeriod="days"
                  granularity={granularity}
                  onVideoClick={handleVideoClick}
                  onOpenRevenueSettings={() => setIsRevenueModalOpen(true)}
                  revenueMetrics={revenueMetrics}
                  revenueIntegrations={revenueIntegrations}
                  isEditMode={false}
                  cardOrder={kpiCardOrder}
                  cardVisibility={kpiCardVisibility}
                  onReorder={() => {}}
                  onToggleCard={() => {}}
                />
              );
            case 'top-performers':
              {
                const topPerformersDateRangePreview = DateFilterService.getDateRange(dateFilter, customDateRange, submissions);
                return (
                  <TopPerformersSection
                    submissions={filteredSubmissions}
                    onVideoClick={handleVideoClick}
                    onAccountClick={handleAccountClick}
                    onHeatmapCellClick={() => {}}
                    subsectionVisibility={topPerformersSubsectionVisibility}
                    isEditMode={false}
                    onToggleSubsection={handleToggleCard}
                    granularity={granularity}
                    dateRange={topPerformersDateRangePreview}
                  />
                );
              }
            case 'posting-activity':
              return (
                <PostingActivityHeatmap 
                  submissions={filteredSubmissions}
                  onVideoClick={handleVideoClick}
                  dateFilter={dateFilter}
                  customRange={customRange}
                />
              );
            case 'tracked-accounts':
              return trackedAccounts.length === 0 ? (
                <BlurEmptyState
                  title="Add Your First Account to Track"
                  description="Track social media accounts to monitor followers, engagement, and content performance."
                  animation={profileAnimation}
                  tooltipText="Track Instagram, TikTok, YouTube, and X accounts to monitor followers, engagement, and content performance over time."
                  actions={[
                    {
                      label: 'Add Account',
                      onClick: () => navigate('/accounts'),
                      icon: AtSign,
                      primary: true
                    }
                  ]}
                />
              ) : (
                <div className="bg-zinc-900 rounded-lg p-4 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4">Tracked Accounts</h3>
                  <div className="text-white/60 text-sm">
                    <div className="grid grid-cols-5 gap-4 pb-2 border-b border-white/10 font-semibold mb-2">
                      <div>Account</div>
                      <div>Platform</div>
                      <div>Followers</div>
                      <div>Posts</div>
                      <div>Engagement</div>
                    </div>
                    {trackedAccounts.slice(0, 3).map((account, i) => (
                      <div key={i} className="grid grid-cols-5 gap-4 py-2 border-b border-white/5">
                        <div className="text-white">@{account.username}</div>
                        <div className="capitalize">{account.platform}</div>
                        <div>{account.followerCount?.toLocaleString() || '—'}</div>
                        <div>{account.postCount || 0}</div>
                        <div className="text-emerald-400">6.8%</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            case 'videos-table':
              return combinedSubmissions.length === 0 ? (
                <BlurEmptyState
                  title="Track Your First Video"
                  description="Add videos to monitor views, likes, comments, and engagement across all platforms."
                  animation={videoMaterialAnimation}
                  tooltipText="Track videos from Instagram, TikTok, YouTube, and X to analyze engagement, reach, and performance trends."
                  actions={[
                    {
                      label: 'Add Video',
                      onClick: () => setIsModalOpen(true),
                      icon: Video,
                      primary: true
                    }
                  ]}
                />
              ) : (
                <VideoSubmissionsTable
                  submissions={combinedSubmissions.slice(0, 5)}
                  onDelete={() => {}}
                  onVideoClick={handleVideoClick}
                  headerTitle={getVideoTableHeader(dateFilter)}
                />
              );
            
            // Top Performers Subsections
            case 'top-videos':
              return (
                <TopPerformersRaceChart
                  submissions={filteredSubmissions}
                  onVideoClick={handleVideoClick}
                  onAccountClick={handleAccountClick}
                  type="videos"
                />
              );
            
            case 'top-accounts':
              return (
                <TopPerformersRaceChart
                  submissions={filteredSubmissions}
                  onVideoClick={handleVideoClick}
                  onAccountClick={handleAccountClick}
                  type="accounts"
                />
              );
            
            case 'top-gainers':
              return (
                <TopPerformersRaceChart
                  submissions={filteredSubmissions}
                  onVideoClick={handleVideoClick}
                  onAccountClick={handleAccountClick}
                  type="gainers"
                />
              );
            
            case 'posting-times':
              return (
                <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 p-6">
                  <h3 className="text-xl font-bold text-white mb-1">Best Posting Times</h3>
                  <p className="text-sm text-gray-400 mb-4">Engagement by day & hour</p>
                  <HeatmapByHour
                    data={filteredSubmissions.map(video => ({
                      timestamp: video.uploadDate || video.dateSubmitted,
                      views: video.views,
                      likes: video.likes,
                      comments: video.comments,
                      shares: video.shares,
                      videos: [{
                        id: video.id,
                        title: video.title || video.caption || 'Untitled',
                        thumbnailUrl: video.thumbnail
                      }]
                    }))}
                    metric="views"
                    onCellClick={() => {}}
                  />
                </div>
              );
            
            case 'top-creators':
              return (
                <TopTeamCreatorsList
                  submissions={filteredSubmissions}
                  onCreatorClick={handleAccountClick}
                />
              );
            
            case 'top-platforms':
              return (
                <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 p-6">
                  <TopPlatformsRaceChart
                    submissions={filteredSubmissions}
                  />
                </div>
              );
            
            case 'comparison':
              // Get current filter's date range to pass to ComparisonGraph
              const currentDateRange = DateFilterService.getDateRange(dateFilter, customDateRange, submissions);
              return (
                <ComparisonGraph
                  submissions={filteredSubmissions}
                  granularity={granularity}
                  dateRange={currentDateRange}
                />
              );
            
            default:
              return <div className="text-white/50 text-sm">Preview not available</div>;
          }
        }}
      />

      {/* Day Videos Modal for Account Clicks */}
      <DayVideosModal
        isOpen={isDayVideosModalOpen}
        onClose={() => {
          setIsDayVideosModalOpen(false);
          // Clear heatmap filter data
          (window as any).__heatmapDayOfWeek = undefined;
          (window as any).__heatmapHourRange = undefined;
        }}
        date={dayVideosDate}
        videos={combinedSubmissions}
        metricLabel="Videos"
        accountFilter={selectedAccountFilter}
        dateRangeLabel={getDateFilterLabel(dateFilter)}
        dayOfWeek={(window as any).__heatmapDayOfWeek}
        hourRange={(window as any).__heatmapHourRange}
        onVideoClick={handleVideoClick}
      />

      {/* Rule Filter Modal */}
      <Modal
        isOpen={isRuleModalOpen}
        onClose={handleCloseRuleModal}
        title={showCreateRuleForm ? 'Create Tracking Rule' : 'Filter by Tracking Rule'}
      >
        {showCreateRuleForm ? (
          // Create Rule Form
          <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
            {/* Rule Name */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Rule Name
              </label>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g., High Engagement Posts"
                className="w-full px-4 py-3 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-white">
                  Conditions
                </label>
                <button
                  onClick={addCondition}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-gray-400 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add Condition
                </button>
              </div>

              <div className="space-y-3">
                {conditions.map((condition, index) => (
                  <div key={condition.id} className="space-y-2">
                    {index > 0 && (
                      <div className="flex items-center gap-2">
                        <select
                          value={conditions[index - 1].operator || 'AND'}
                          onChange={(e) => updateCondition(conditions[index - 1].id, 'operator', e.target.value as 'AND' | 'OR')}
                          className="px-3 py-1 text-sm border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex gap-2 items-start p-3 border border-gray-700 rounded-lg bg-gray-800/50">
                        <select
                          value={condition.type}
                          onChange={(e) => updateCondition(condition.id, 'type', e.target.value as RuleConditionType)}
                          className="flex-1 px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="description_contains">Description contains</option>
                          <option value="description_not_contains">Description does not contain</option>
                          <option value="hashtag_includes">Hashtag includes</option>
                          <option value="hashtag_not_includes">Hashtag does not include</option>
                          <option value="views_greater_than">Views greater than</option>
                          <option value="views_less_than">Views less than</option>
                          <option value="likes_greater_than">Likes greater than</option>
                          <option value="engagement_rate_greater_than">Engagement rate &gt;</option>
                          <option value="posted_after_date">Posted after date</option>
                          <option value="posted_before_date">Posted before date</option>
                        </select>

                        <input
                          type={
                            condition.type.includes('date') ? 'date' :
                            condition.type.includes('greater') || condition.type.includes('less') ? 'number' :
                            'text'
                          }
                          value={condition.value}
                          onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                          placeholder={
                            condition.type.includes('description') ? 'e.g., @brand.com' :
                            condition.type.includes('hashtag') ? 'e.g., ad or #ad' :
                            condition.type.includes('views') ? 'e.g., 10000' :
                            'Value'
                          }
                          className="flex-1 px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />

                        {conditions.length > 1 && (
                          <button
                            onClick={() => removeCondition(condition.id)}
                            className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      {/* Case-sensitive toggle for text-based conditions */}
                      {(condition.type.includes('description') || condition.type.includes('hashtag')) && (
                        <label className="flex items-center gap-2 px-3 text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                          <input
                            type="checkbox"
                            checked={condition.caseSensitive || false}
                            onChange={(e) => updateCondition(condition.id, 'caseSensitive', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:ring-offset-0"
                          />
                          <span>Case sensitive</span>
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Info message */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-gray-900 dark:text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                    Available to All Accounts
                  </h4>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    This rule will be available for filtering across all tracked accounts and platforms.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-700">
              <button
                onClick={() => setShowCreateRuleForm(false)}
                className="flex-1 px-4 py-2 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSaveRule}
                disabled={!ruleName.trim() || conditions.filter(c => c.value !== '').length === 0}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
              >
                Create Rule
              </button>
            </div>
          </div>
        ) : allRules.length === 0 ? (
          <div className="text-center py-12">
            <Filter className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">No tracking rules created yet</p>
            <button
              onClick={handleShowCreateForm}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10"
            >
              Create Your First Rule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400">
                Select multiple rules to filter videos. Videos matching ANY selected rule will be shown.
              </p>
              {activeRulesCount > 0 && (
                <button
                  onClick={() => {
                    console.log('🗑️ Clear All clicked - removing all selections');
                    setSelectedRuleIds([]);
                  }}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2">
              {/* Individual Rules - Compact Line Items */}
              {allRules
                .filter(rule => rule.isActive)
                .map((rule) => {
                  const isSelected = selectedRuleIds.includes(rule.id);
                  
                  return (
                    <div
                      key={rule.id}
                      className={clsx(
                        'px-3 py-2 rounded border transition-all cursor-pointer group flex items-center gap-2',
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      )}
                      onClick={() => {
                        console.log('🖱️ Rule clicked:', rule.name, rule.id);
                        setSelectedRuleIds(prev => {
                          const isCurrentlySelected = prev.includes(rule.id);
                          const newSelection = isCurrentlySelected
                            ? prev.filter(id => id !== rule.id)
                            : [...prev, rule.id];
                          console.log('📝 Updating selectedRuleIds:', {
                            previous: prev,
                            action: isCurrentlySelected ? 'REMOVE' : 'ADD',
                            new: newSelection
                          });
                          return newSelection;
                        });
                      }}
                    >
                      <div className="flex-shrink-0">
                        {isSelected ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-500 group-hover:text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={clsx(
                            "text-sm font-medium truncate",
                            isSelected ? "text-white" : "text-gray-300"
                          )}>
                            {rule.name}
                          </span>
                          {rule.conditions.length > 0 && (
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              {rule.conditions.length} condition{rule.conditions.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {rule.description && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{rule.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="pt-4 border-t border-gray-700 flex items-center justify-between">
              <button
                onClick={handleShowCreateForm}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Create New Rule →
              </button>
              <button
                onClick={handleCloseRuleModal}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Context-Aware Floating Action Button */}
      {activeTab !== 'settings' && activeTab !== 'subscription' && activeTab !== 'cron' && activeTab !== 'invitations' && activeTab !== 'creators' && (
        <button
          onClick={() => {
            if (activeTab === 'dashboard') {
              setIsTypeSelectorOpen(true);
            } else if (activeTab === 'accounts') {
              accountsPageRef.current?.openAddModal();
            } else if (activeTab === 'analytics') {
              trackedLinksPageRef.current?.openCreateModal();
            } else if (activeTab === 'campaigns') {
              navigate('/campaigns/create');
            } else if (activeTab === 'team') {
              const event = new CustomEvent('openInviteModal');
              window.dispatchEvent(event);
            }
          }}
          className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50 flex items-center justify-center p-3 md:p-4 rounded-full transition-all transform hover:scale-105 active:scale-95 bg-white/10 hover:bg-white/15 text-white border border-white/20 hover:border-white/30 shadow-2xl group"
          aria-label={
            activeTab === 'dashboard' ? 'Track Content' :
            activeTab === 'accounts' ? 'Track Account' :
            activeTab === 'analytics' ? 'Create Link' :
            activeTab === 'campaigns' ? 'Create Campaign' :
            activeTab === 'team' ? 'Invite Team Member' :
            'Add'
          }
        >
          <svg 
            className="w-6 h-6" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 4v16m8-8H4" 
            />
          </svg>
          <span className="absolute -top-12 right-0 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {activeTab === 'dashboard' && 'Track Content'}
            {activeTab === 'accounts' && 'Track Account'}
            {activeTab === 'analytics' && 'Create Link'}
            {activeTab === 'campaigns' && 'Create Campaign'}
            {activeTab === 'team' && 'Invite Team Member'}
          </span>
        </button>
      )}

      {/* Revenue Integrations Modal */}
      {currentOrgId && currentProjectId && (
        <RevenueIntegrationsModal
          isOpen={isRevenueModalOpen}
          onClose={() => setIsRevenueModalOpen(false)}
          organizationId={currentOrgId}
          projectId={currentProjectId}
        />
      )}

      {/* Sign Out Confirmation Modal */}
      <SignOutModal
        isOpen={isSignOutModalOpen}
        onConfirm={async () => {
          try {
            await signOut(auth);
            window.location.href = '/login';
          } catch (error) {
            console.error('Failed to sign out:', error);
          }
        }}
        onCancel={() => setIsSignOutModalOpen(false)}
      />

      {/* Mobile Filters Modal */}
      {isMobileFiltersOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileFiltersOpen(false)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-[#1A1A1A] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-[#1A1A1A] border-b border-white/10 px-4 py-3 flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold text-white">Filters</h3>
              <button
                onClick={() => setIsMobileFiltersOpen(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Filters Content */}
            <div className="p-4 space-y-6">
              {/* Accounts Filter - Only show for dashboard and videos tabs */}
              {(activeTab === 'dashboard' || activeTab === 'videos') && (
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Accounts</label>
                  <MultiSelectDropdown
                    options={trackedAccounts.map(account => ({
                      id: account.id,
                      label: account.displayName || `@${account.username}`,
                      avatar: account.profilePicture
                    }))}
                    selectedIds={selectedAccountIds}
                    onChange={setSelectedAccountIds}
                    placeholder="All Accounts"
                  />
                </div>
              )}

              {/* Platform Filter */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Platform</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setDashboardPlatformFilter('all');
                      localStorage.setItem('dashboardPlatformFilter', 'all');
                    }}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      dashboardPlatformFilter === 'all' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                        : 'bg-white/5 text-white/90 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    All Platforms
                  </button>
                  <button
                    onClick={() => {
                      setDashboardPlatformFilter('instagram');
                      localStorage.setItem('dashboardPlatformFilter', 'instagram');
                    }}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      dashboardPlatformFilter === 'instagram' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                        : 'bg-white/5 text-white/90 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <PlatformIcon platform="instagram" size="sm" />
                    Instagram
                  </button>
                  <button
                    onClick={() => {
                      setDashboardPlatformFilter('tiktok');
                      localStorage.setItem('dashboardPlatformFilter', 'tiktok');
                    }}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      dashboardPlatformFilter === 'tiktok' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                        : 'bg-white/5 text-white/90 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <PlatformIcon platform="tiktok" size="sm" />
                    TikTok
                  </button>
                  <button
                    onClick={() => {
                      setDashboardPlatformFilter('youtube');
                      localStorage.setItem('dashboardPlatformFilter', 'youtube');
                    }}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      dashboardPlatformFilter === 'youtube' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                        : 'bg-white/5 text-white/90 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <PlatformIcon platform="youtube" size="sm" />
                    YouTube
                  </button>
                  <button
                    onClick={() => {
                      setDashboardPlatformFilter('twitter');
                      localStorage.setItem('dashboardPlatformFilter', 'twitter');
                    }}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      dashboardPlatformFilter === 'twitter' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                        : 'bg-white/5 text-white/90 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <PlatformIcon platform="twitter" size="sm" />
                    X (Twitter)
                  </button>
                </div>
              </div>

              {/* Granularity Filter - Only show for dashboard tab */}
              {activeTab === 'dashboard' && (
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Granularity</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setGranularity('day')}
                      className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                        granularity === 'day' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                          : 'bg-white/5 text-white/90 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      Daily
                    </button>
                    <button
                      onClick={() => setGranularity('week')}
                      className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                        granularity === 'week' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                          : 'bg-white/5 text-white/90 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      onClick={() => setGranularity('month')}
                      className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                        granularity === 'month' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                          : 'bg-white/5 text-white/90 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setGranularity('year')}
                      className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                        granularity === 'year' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                          : 'bg-white/5 text-white/90 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      Yearly
                    </button>
                  </div>
                </div>
              )}

              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Date Range</label>
                <DateRangeFilter
                  selectedFilter={dateFilter}
                  customRange={customDateRange}
                  onFilterChange={handleDateFilterChange}
                />
              </div>

              {/* Rules Filter */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Rules</label>
                <button
                  onClick={() => {
                    setIsMobileFiltersOpen(false);
                    handleOpenRuleModal();
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/5 text-white/90 rounded-lg text-sm font-medium border border-white/10 hover:border-white/20 transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    {activeRulesCount === 0 ? 'All Videos' : `${activeRulesCount} rule${activeRulesCount > 1 ? 's' : ''} applied`}
                  </span>
                  <ChevronDown className="w-4 h-4 text-white/50 -rotate-90" />
                </button>
              </div>
            </div>

            {/* Footer with Reset button */}
            <div className="sticky bottom-0 bg-[#1A1A1A] border-t border-white/10 px-4 py-3">
              <button
                onClick={() => {
                  // Reset filters based on active tab
                  if (activeTab === 'dashboard' || activeTab === 'videos') {
                    setSelectedAccountIds([]);
                    setGranularity('day');
                  }
                  setDashboardPlatformFilter('all');
                  localStorage.setItem('dashboardPlatformFilter', 'all');
                  setDateFilter('last7days');
                  setSelectedRuleIds([]);
                  localStorage.setItem('dashboardSelectedRuleIds', JSON.stringify([]));
                }}
                className="w-full px-4 py-2.5 bg-white/5 text-white/90 rounded-lg text-sm font-medium border border-white/10 hover:border-white/20 transition-all"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      {/* Close blur wrapper */}

      {/* Select Creator for Account Modal */}
      {showLinkCreatorModal && accountToLinkCreator && (
        <SelectCreatorModal
          accountId={accountToLinkCreator.id}
          accountName={accountToLinkCreator.displayName || accountToLinkCreator.username}
          currentCreatorId={accountCreatorName ? undefined : null} // Will be loaded from CreatorLinksService
          onClose={() => {
            setShowLinkCreatorModal(false);
            setAccountToLinkCreator(null);
          }}
          onSuccess={() => {
            setShowLinkCreatorModal(false);
            setAccountToLinkCreator(null);
            // Reload creator name
            if (currentOrgId && currentProjectId && accountToLinkCreator) {
              CreatorLinksService.getCreatorNameForAccount(currentOrgId, currentProjectId, accountToLinkCreator.id)
                .then(name => setAccountCreatorName(name))
                .catch(() => setAccountCreatorName(null));
            }
          }}
        />
      )}
    </div>
  );
}

export default DashboardPage;
