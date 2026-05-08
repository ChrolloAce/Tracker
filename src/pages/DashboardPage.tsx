import { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, ChevronDown, Search, Filter, CheckCircle2, Circle, Plus, Trash2,
  Play, Heart, MessageCircle, Share2, Video, AtSign, Activity, Link as LinkIcon, Edit2,
  Users, Clock, TrendingUp, BarChart3, X, Pencil, Check, ExternalLink, RotateCcw
} from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import ShareProjectModal from '../components/ShareProjectModal';
import { Modal } from '../components/ui/Modal';
import { VideoSubmissionsTable } from '../components/VideoSubmissionsTable';
import { AddVideoModal } from '../components/AddVideoModal';
import { AddAccountModal } from '../components/accounts/AddAccountModal';
import { AddTypeSelector } from '../components/AddTypeSelector';
import { TikTokSearchModal } from '../components/TikTokSearchModal';
import KPICards from '../components/KPICards';
import { KPICardEditorSidebar } from '../components/KPICardEditorSidebar';
import { DraggableSection } from '../components/DraggableSection';
import DateRangeFilter, { DateFilterType } from '../components/DateRangeFilter';
import VideoAnalyticsModal from '../components/VideoAnalyticsModal';
import { MarkAsReadService } from '../services/MarkAsReadService';
import AuthenticatedApiService from '../services/AuthenticatedApiService';
import TopPerformersSection from '../components/TopPerformersSection';
import TopPerformersRaceChart from '../components/TopPerformersRaceChart';
import HeatmapByHour from '../components/HeatmapByHour';
import TopTeamCreatorsList from '../components/TopTeamCreatorsList';
import TopPlatformsRaceChart from '../components/TopPlatformsRaceChart';
import ComparisonGraph from '../components/ComparisonGraph';
import UnifiedMetricsChart from '../components/UnifiedMetricsChart';
import SuperwallService, { SUPERWALL_METRICS, type SuperwallMetricKey } from '../services/SuperwallService';
import VideoSliderSection from '../components/VideoSliderSection';
import PostingActivityHeatmap from '../components/PostingActivityHeatmap';
import DayVideosModal from '../components/DayVideosModal';
import { BlurEmptyState } from '../components/ui/BlurEmptyState';
import AccountsPage, { AccountsPageRef } from '../components/AccountsPage';
import SettingsPage from '../components/SettingsPage';
import SubscriptionPage from '../components/SubscriptionPage';
import CronManagementPage from '../components/CronManagementPage';
import TrackedLinksPage, { TrackedLinksPageRef } from '../components/TrackedLinksPage';
import TeamManagementPage from '../components/TeamManagementPage';
import SelectCreatorModal from '../components/SelectCreatorModal';
import BulkAssignCreatorModal from '../components/BulkAssignCreatorModal';
import PaywallOverlay from '../components/PaywallOverlay';
import SignOutModal from '../components/SignOutModal';
import ComingSoonLocked from '../components/ComingSoonLocked';
import CreatorsManagementPage from '../components/CreatorsManagementPage';
import CampaignsManagementPage from '../components/CampaignsManagementPage';
// CreatorPortalPage removed — legacy portal replaced by share link portals at /c/:token
import ViralContentPage from '../components/ViralContentPage';
import SavedViralPage from './SavedViralPage';
import ApiManagementPage from './ApiManagementPage';
import { AccountTrackingServiceFirebase } from '../services/AccountTrackingServiceFirebase';
import SuperAdminService from '../services/SuperAdminService';
import AdminService from '../services/AdminService';
import OrganizationService from '../services/OrganizationService';
import SubscriptionService from '../services/SubscriptionService';
import DemoOrgService from '../services/DemoOrgService';
import CreatorLinksService from '../services/CreatorLinksService';
import DashboardPreferencesService from '../services/DashboardPreferencesService';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import { PlatformIcon } from '../components/ui/PlatformIcon';
import { VideoSubmission, InstagramVideoData } from '../types';
import DateFilterService from '../services/DateFilterService';
import { computeKPITotals, computePerVideoMetricInRange } from '../components/kpi/kpiDataProcessing';
import ThemeService from '../services/ThemeService';
// Lottie animation JSON loaded lazily to reduce initial bundle size
let _profileAnimation: any = null;
let _videoMaterialAnimation: any = null;
import FirestoreDataService from '../services/FirestoreDataService';
import LinkClicksService, { LinkClick } from '../services/LinkClicksService';
import RulesService from '../services/RulesService';
import UsageTrackingService from '../services/UsageTrackingService';
import { cssVariables } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { useDemoContext } from './DemoPage';
import { useViewAsContext } from './ViewAsPage';
import { Timestamp, collection, getDocs, onSnapshot, query, where, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../services/firebase';
import { fixVideoPlatforms } from '../services/FixVideoPlatform';
import { TrackedAccount, TrackedLink, Creator, CreatorLink, OrgMember, CreatorLabel } from '../types/firestore';
import CreatorLabelService from '../services/CreatorLabelService';
import { getLabelColorClass } from '../components/creators/CreatorLabelBadges';
import { TrackingRule, RuleCondition, RuleConditionType } from '../types/rules';
import { Toast } from '../components/ui/Toast';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Skeleton Loader Component for fast loading UX
const DashboardSkeleton: React.FC<{ height?: string }> = memo(({ height = 'h-96' }) => (
  <div className={`${height} bg-surface-secondary/40 rounded-2xl border border-border-subtle animate-pulse`}>
    <div className="p-6 space-y-4">
      <div className="h-6 bg-surface-hover rounded w-1/4"></div>
      <div className="h-4 bg-surface-hover rounded w-1/2"></div>
      <div className="space-y-3 mt-6">
        <div className="h-20 bg-surface-hover rounded"></div>
        <div className="h-20 bg-surface-hover rounded"></div>
        <div className="h-20 bg-surface-hover rounded"></div>
      </div>
    </div>
  </div>
));

// Skeleton for KPI cards — matches the real KPI card grid layout
const KPICardsSkeleton: React.FC = memo(() => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        className="bg-surface-secondary/60 backdrop-blur rounded-2xl border border-border-subtle p-4 md:p-5 animate-pulse"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-20 bg-surface-tertiary rounded" />
          <div className="h-5 w-5 bg-surface-tertiary rounded" />
        </div>
        <div className="h-8 w-24 bg-surface-tertiary rounded mb-2" />
        <div className="h-3 w-16 bg-surface-tertiary rounded" />
      </div>
    ))}
  </div>
));

// Skeleton for chart/top-performers sections — a simple rectangular placeholder
const ChartSkeleton: React.FC<{ height?: string }> = memo(({ height = 'h-80' }) => (
  <div className={`${height} bg-surface-secondary/60 backdrop-blur rounded-2xl border border-border-subtle animate-pulse`}>
    <div className="p-6">
      <div className="h-5 w-40 bg-surface-tertiary rounded mb-2" />
      <div className="h-3 w-64 bg-surface-tertiary rounded mb-6" />
      <div className="flex items-end space-x-2" style={{ height: 'calc(100% - 80px)' }}>
        {[45, 70, 55, 85, 40, 65, 50].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-surface-tertiary rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  </div>
));

// Skeleton for the video slider section
const VideoSliderSkeleton: React.FC = memo(() => (
  <div className="bg-surface-secondary/60 backdrop-blur rounded-2xl border border-border-subtle p-4 md:p-6 animate-pulse">
    <div className="h-5 w-32 bg-surface-tertiary rounded mb-4" />
    <div className="flex space-x-4 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-40 md:w-48">
          <div className="aspect-[9/16] bg-surface-tertiary rounded-xl mb-2" />
          <div className="h-3 w-full bg-surface-tertiary rounded mb-1" />
          <div className="h-3 w-2/3 bg-surface-tertiary rounded" />
        </div>
      ))}
    </div>
  </div>
));

// Skeleton for the video table section
const VideoTableSkeleton: React.FC = memo(() => (
  <div className="bg-surface-secondary/60 backdrop-blur rounded-2xl border border-border-subtle p-4 md:p-6 animate-pulse">
    <div className="h-5 w-48 bg-surface-tertiary rounded mb-4" />
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <div className="w-16 h-10 bg-surface-tertiary rounded" />
          <div className="flex-1">
            <div className="h-4 w-3/4 bg-surface-tertiary rounded mb-1" />
            <div className="h-3 w-1/2 bg-surface-tertiary rounded" />
          </div>
          <div className="h-4 w-16 bg-surface-tertiary rounded" />
          <div className="h-4 w-16 bg-surface-tertiary rounded" />
        </div>
      ))}
    </div>
  </div>
));

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

const getTrendPeriodDays = (dateFilter: DateFilterType): number => {
  switch (dateFilter) {
    case 'today':
    case 'yesterday':
      return 1;
    case 'last7days':
      return 7;
    case 'last14days':
      return 14;
    case 'last30days':
    case 'mtd':
      return 30;
    case 'last90days':
      return 90;
    case 'ytd':
      return 365;
    case 'all':
      return 365; // Default to 1 year for all-time
    case 'custom':
      return 30; // Default to 30 days for custom range
    default:
      return 7;
  }
};

// Get the social profile URL for a given platform and username
const getPlatformProfileUrl = (platform: string, username: string): string => {
  const cleanUsername = username.replace('@', '');
  switch (platform.toLowerCase()) {
    case 'tiktok':
      return `https://www.tiktok.com/@${cleanUsername}`;
    case 'instagram':
      return `https://www.instagram.com/${cleanUsername}`;
    case 'youtube':
      return `https://www.youtube.com/@${cleanUsername}`;
    case 'x':
    case 'twitter':
      return `https://x.com/${cleanUsername}`;
    default:
      return '#';
  }
};

// Get display name for platform (for button text)
const getPlatformDisplayName = (platform: string): string => {
  switch (platform.toLowerCase()) {
    case 'tiktok':
      return 'TikTok';
    case 'instagram':
      return 'Instagram';
    case 'youtube':
      return 'YouTube';
    case 'x':
    case 'twitter':
      return 'X';
    default:
      return platform;
  }
};

function DashboardPage({ initialTab, initialSettingsTab }: { initialTab?: string; initialSettingsTab?: string } = {}) {
  // Get authentication state, current organization, and current project
  const { user, currentOrgId: authOrgId, currentProjectId: authProjectId, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if current user is a super admin (unlocks manual refresh)
  const isSuperAdmin = SuperAdminService.isSuperAdmin(user?.email);

  // Check if we're in demo mode - demo IDs ALWAYS override auth IDs
  let demoContext;
  try {
    demoContext = useDemoContext();
  } catch {
    demoContext = { isDemoMode: false, demoOrgId: '', demoProjectId: '' };
  }
  
  // Check if we're in "view as" mode (super admin viewing another org)
  let viewAsContext;
  try {
    viewAsContext = useViewAsContext();
  } catch {
    viewAsContext = { isViewAsMode: false, viewAsOrgId: '', viewAsProjectId: '', viewAsOrgName: '', viewAsData: null };
  }
  
  // isDemoMode = actual demo page (shows demo banner)
  // isViewAsMode = super admin viewing another org (no demo banner, full access)
  const isDemoMode = demoContext.isDemoMode;
  const isViewAsMode = viewAsContext.isViewAsMode;
  
  // Combined check for "not the user's own org" (for skipping certain behaviors)
  const isOverrideMode = isDemoMode || isViewAsMode;
  
  // CRITICAL: Use demo/viewAs IDs if in those modes, IGNORE auth IDs completely
  const currentOrgId = demoContext.isDemoMode 
    ? demoContext.demoOrgId 
    : viewAsContext.isViewAsMode 
      ? viewAsContext.viewAsOrgId 
      : authOrgId;
  const currentProjectId = demoContext.isDemoMode 
    ? demoContext.demoProjectId 
    : viewAsContext.isViewAsMode 
      ? viewAsContext.viewAsProjectId 
      : authProjectId;
  
  // Guard: Redirect if no org/project (not in demo/viewAs mode)
  useEffect(() => {
    if (!isOverrideMode && (!currentOrgId || !currentProjectId)) {
      navigate('/onboarding', { replace: true });
    }
  }, [isOverrideMode, currentOrgId, currentProjectId, navigate]);

  // Subscription & Paywall State
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallContext, setPaywallContext] = useState<string>('');
  const [planTier, setPlanTier] = useState<string | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [, setIsDemoOrg] = useState(isDemoMode); // Only true for actual demo, NOT view-as mode

  // Check if user needs to pay before performing an action
  // Uses a ref so useCallback handlers always get the latest check
  const planTierRef = useRef<string | null>(null);
  const planLoadedRef = useRef(false);
  planTierRef.current = planTier;
  planLoadedRef.current = planLoaded;

  const requiresPaidPlan = useCallback((context: string): boolean => {
    const tier = planTierRef.current;
    const loaded = planLoadedRef.current;
    // Demo mode: never block
    if (isDemoMode) return false;
    // Plan loaded and IS free: block
    if (loaded && tier === 'free') {
      setPaywallContext(context);
      setShowPaywall(true);
      return true;
    }
    // Everything else: let through
    return false;
  }, [isDemoMode]);

  // Lazily load Lottie animation JSON to reduce initial bundle size
  const [profileAnimation, setProfileAnimation] = useState<any>(_profileAnimation);
  const [videoMaterialAnimation, setVideoMaterialAnimation] = useState<any>(_videoMaterialAnimation);
  useEffect(() => {
    if (!_videoMaterialAnimation) {
      import('../../public/lottie/Posting Picture.json').then(m => {
        _videoMaterialAnimation = m.default;
        setVideoMaterialAnimation(m.default);
      });
    }
    if (!_profileAnimation) {
      import('../../public/lottie/Profile.json').then(m => {
        _profileAnimation = m.default;
        setProfileAnimation(m.default);
      });
    }
  }, []);

  // State
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [linkClicks, setLinkClicks] = useState<LinkClick[]>([]);
  const [links, setLinks] = useState<TrackedLink[]>([]);
  const [trackedAccounts, setTrackedAccounts] = useState<TrackedAccount[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [creatorLinks, setCreatorLinks] = useState<CreatorLink[]>([]);
  const [creatorMembers, setCreatorMembers] = useState<OrgMember[]>([]);
  const [allRules, setAllRules] = useState<TrackingRule[]>([]);
  // Project-scoped CreatorLabel taxonomy + the admin's current selection.
  // Driven by the Labels filter pill in the dashboard header. When at least
  // one label is selected the video stream is filtered to videos whose creator
  // (resolved through accountId → creatorLink → creator) carries that label.
  const [creatorLabels, setCreatorLabels] = useState<CreatorLabel[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);
  
  // Total counts (unfiltered) - for empty state check
  const [totalAccountsInOrg, setTotalAccountsInOrg] = useState(0);
  const [totalVideosInOrg, setTotalVideosInOrg] = useState(0);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [showCreateRuleForm, setShowCreateRuleForm] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [conditions, setConditions] = useState<RuleCondition[]>([
    { id: '1', type: 'description_contains', value: '', operator: 'AND' }
  ]);
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isTikTokSearchOpen, setIsTikTokSearchOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [bulkAssignCreatorState, setBulkAssignCreatorState] = useState<{ isOpen: boolean; videoIds: string[]; accountIds: string[]; label: string }>({ isOpen: false, videoIds: [], accountIds: [], label: '' });
  const [usageLimits, setUsageLimits] = useState<{
    accountsLeft: number;
    videosLeft: number;
    isAtAccountLimit: boolean;
    isAtVideoLimit: boolean;
  }>({
    accountsLeft: 0,
    videosLeft: 0,
    isAtAccountLimit: false,
    isAtVideoLimit: false,
  });
  
  // Loading/pending state for immediate UI feedback
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  // dataFullyLoaded: true ONLY after ALL video data is fetched and submissions state is set
  // Used to show skeleton placeholders for KPI cards and charts until data is ready
  const [dataFullyLoaded, setDataFullyLoaded] = useState(false);
  const [pendingVideos, setPendingVideos] = useState<VideoSubmission[]>([]);
  const [pendingAccounts, setPendingAccounts] = useState<TrackedAccount[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilterType>(() => {
    const saved = localStorage.getItem('dashboardDateFilter');
    return (saved as DateFilterType) || 'all';
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
  const [showDeleteVideoModal, setShowDeleteVideoModal] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<VideoSubmission | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [bulkAddToast, setBulkAddToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isShareProjectModalOpen, setIsShareProjectModalOpen] = useState(false);
  const [manualGranularity, setManualGranularity] = useState<'day' | 'week' | 'month' | 'year' | null>(null);

  // Unified vs Classic graph view
  const [dashboardViewMode, setDashboardViewMode] = useState<'classic' | 'unified'>(() => {
    const saved = localStorage.getItem('dashboardViewMode');
    return saved === 'unified' ? 'unified' : 'classic';
  });
  // Marks a fresh classic→unified transition so the unified chart plays its
  // bigger merge-in entrance instead of a plain mount fade.
  const [isMergingToUnified, setIsMergingToUnified] = useState(false);

  // Superwall revenue (per-day map keyed by YYYY-MM-DD). Only populated when
  // the org has a Superwall integration configured. Powers the Revenue metric
  // in the unified chart picker.
  const [superwallAppId, setSuperwallAppId] = useState<string | null>(null);
  // Hard-coded to 'organic' — the dashboard always excludes Spark
  // (paid-ad) views from headline KPIs and chart bars. Setter retained
  // as a no-op so other code paths (settings page persistence, etc.)
  // don't break, but the value never changes.
  const [orgDefaultReportingView] = useState<'organic'>('organic');
  const setOrgDefaultReportingView = (_: any) => {};
  const [revenueByDate, setRevenueByDate] = useState<Record<string, number> | undefined>(undefined);
  // Active revenue metric on the unified chart. Drives the Superwall fetch
  // below + flows into UnifiedMetricsChart's hover submenu so the user can
  // swap revenue type without leaving the Dashboard.
  const [selectedRevenueMetric, setSelectedRevenueMetric] = useState<SuperwallMetricKey>('grossRevenue');
  // Multi-select: which revenue types render simultaneously on the chart.
  // First entry mirrors `selectedRevenueMetric` so the existing single-fetch
  // path (KPI summaries / etc.) keeps working unchanged.
  const [selectedRevenueMetrics, setSelectedRevenueMetrics] = useState<SuperwallMetricKey[]>(['grossRevenue']);
  // Per-revenue-option daily series — populated by the parallel multi-fetch
  // and forwarded to UnifiedMetricsChart so each toggled option becomes a
  // distinct series.
  const [revenueByDateByOption, setRevenueByDateByOption] = useState<Record<string, Record<string, number>>>({});
  // Which revenue keys are currently being fetched. Drives chip shimmer +
  // chart skeleton so newly-toggled options don't show $0 until data lands.
  const [pendingRevenueKeys, setPendingRevenueKeys] = useState<string[]>([]);
  // True while the Superwall fetch for the active revenue metric is in flight.
  // Drives the chart's skeleton so swapping revenue type shows the loading
  // animation immediately (without waiting for `dataFullyLoaded` to flip).
  const [revenueLoading, setRevenueLoading] = useState(false);
  
  // Auto-calculate granularity based on date filter (updates in same render!)
  const granularity = useMemo<'day' | 'week' | 'month' | 'year'>(() => {
    // If user manually set granularity, use that
    if (manualGranularity) return manualGranularity;
    
    // Otherwise, auto-calculate based on date filter
    let autoGranularity: 'day' | 'week' | 'month' | 'year' = 'day';
    
    switch (dateFilter) {
      case 'today':
      case 'yesterday':
        // Single day = daily granularity (1 data point per day)
        autoGranularity = 'day';
        break;
      case 'last7days':
      case 'last14days':
        autoGranularity = 'day';
        break;
      case 'last30days':
      case 'mtd':
        autoGranularity = 'week';
        break;
      case 'last90days':
      case 'ytd':
        autoGranularity = 'month';
        break;
      case 'all': {
        // Smart granularity for "All Time": check actual data spread
        // If data spans less than 60 days, use daily/weekly instead of monthly
        const videos = submissions || [];
        if (videos.length > 0) {
          const dates = videos
            .map(v => (v.uploadDate || v.dateSubmitted)?.getTime?.() || 0)
            .filter(d => d > 0);
          if (dates.length > 0) {
            const span = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
            if (span <= 14) autoGranularity = 'day';
            else if (span <= 60) autoGranularity = 'week';
            else autoGranularity = 'month';
          }
        }
        break;
      }
      case 'custom':
        if (customDateRange) {
          const daysDiff = Math.ceil(
            (customDateRange.endDate.getTime() - customDateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          // Single day = daily granularity (1 data point)
          if (daysDiff <= 1) {
            autoGranularity = 'day';
          } else if (daysDiff <= 14) {
            autoGranularity = 'day';
          } else if (daysDiff <= 60) {
            autoGranularity = 'week';
          } else if (daysDiff <= 365) {
            autoGranularity = 'month';
          } else {
            autoGranularity = 'year';
          }
        }
        break;
    }
    
    return autoGranularity;
  }, [dateFilter, customDateRange, manualGranularity, submissions]);
  
  // Day Videos Modal state (for account clicks from race chart). Filter is
  // either one username (single-account click) or an array (creator-row click,
  // where every linked account on every platform should be included).
  const [isDayVideosModalOpen, setIsDayVideosModalOpen] = useState(false);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string | string[] | undefined>();
  const [selectedCreatorDisplayName, setSelectedCreatorDisplayName] = useState<string | undefined>();
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState<'instagram' | 'tiktok' | 'youtube' | 'twitter' | undefined>();
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
      
      // 🔧 FIX: If account doesn't exist in list yet (newly added), refresh accounts
      const accountExists = trackedAccounts.some(acc => acc.id === accountParam);
      if (!accountExists && currentOrgId && currentProjectId) {
        console.log('⚠️ Account not found in list, refreshing accounts...');
        FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId)
          .then(updatedAccounts => {
            console.log('✅ Accounts refreshed:', updatedAccounts.length);
            setTrackedAccounts(updatedAccounts);
          })
          .catch(err => console.error('Failed to refresh accounts:', err));
      }
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
    if (!currentOrgId || !currentProjectId || isOverrideMode) return;

    if (activeTab === 'videos') {
      MarkAsReadService.markVideosAsRead(currentOrgId, currentProjectId);
    } else if (activeTab === 'accounts') {
      MarkAsReadService.markAccountsAsRead(currentOrgId, currentProjectId);
    }
  }, [activeTab, currentOrgId, currentProjectId, isOverrideMode]);

  // Load creators + creator-links + creator-role members so the "All Accounts"
  // filter can group accounts under their creator. We resolve a creatorId to a
  // display name/photo via a fallback chain: project-scoped Creator profile →
  // org-wide OrgMember (role=='creator'). This matters because a creator added
  // through the team/invite flow can have a CreatorLink in the project before
  // their project-scoped Creator doc is materialized — without the OrgMember
  // fallback, those accounts would render as "ungrouped" at the top.
  useEffect(() => {
    if (!currentOrgId || !currentProjectId) return;
    let cancelled = false;
    const membersRef = collection(db, 'organizations', currentOrgId, 'members');
    Promise.all([
      CreatorLinksService.getAllCreators(currentOrgId, currentProjectId),
      CreatorLinksService.getAllCreatorLinks(currentOrgId, currentProjectId),
      getDocs(query(membersRef, where('role', '==', 'creator'))),
    ])
      .then(([loadedCreators, loadedLinks, membersSnapshot]) => {
        if (cancelled) return;
        const members = membersSnapshot.docs.map(d => ({ ...(d.data() as OrgMember) }));
        setCreators(loadedCreators);
        setCreatorLinks(loadedLinks);
        setCreatorMembers(members);
      })
      .catch(err => console.error('Failed to load creators for accounts filter:', err));

    // Load project label taxonomy in parallel for the Labels filter pill.
    // Pass user.uid as `seedingUserId` so the UGC/Influencer/Faceless triplet
    // is materialized on first read for new projects.
    CreatorLabelService.listLabels(currentOrgId, currentProjectId, user?.uid)
      .then(list => { if (!cancelled) setCreatorLabels(list); })
      .catch(err => console.error('Failed to load creator labels:', err));

    return () => { cancelled = true; };
  }, [currentOrgId, currentProjectId, user?.uid]);

  const [isCardEditorOpen, setIsCardEditorOpen] = useState(false);
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);
  const [isOverSectionTrash, setIsOverSectionTrash] = useState(false);
  
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
    // Default: all cards visible
    return {
      views: true,
      likes: true,
      comments: true,
      shares: true,
      videos: true,
      accounts: true,
      engagementRate: true,
      'link-clicks': true
    };
  });
  
  const [dashboardSectionOrder, setDashboardSectionOrder] = useState<string[]>(() => {
    const defaultOrder = ['video-slider', 'kpi-cards', 'posting-activity', 'top-performers', 'videos-table', 'tracked-accounts'];
    const saved = localStorage.getItem('dashboardSectionOrder');

    if (saved) {
      const parsedOrder = JSON.parse(saved);
      // Deduplicate: keep first occurrence of each section, remove 'top-platforms' (it's a subsection, not a main section)
      const seen = new Set<string>();
      const deduped = (parsedOrder as string[]).filter((id: string) => {
        if (id === 'top-platforms' || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      // Merge with new sections that might be missing
      defaultOrder.forEach(sectionId => {
        if (!deduped.includes(sectionId)) {
          deduped.push(sectionId);
        }
      });
      console.log('🔧 Merged section order:', { old: parsedOrder, new: deduped });
      // Save the cleaned order back to localStorage
      localStorage.setItem('dashboardSectionOrder', JSON.stringify(deduped));
      return deduped;
    }

    return defaultOrder;
  });

  // Check subscription plan and show paywall if on free plan
  useEffect(() => {
    const checkSubscription = async () => {
      console.log('🔍 Checking subscription...', { isDemoMode, userEmail: user?.email, activeTab });
      
      // Skip paywall check if in demo mode (public /demo page)
      if (isDemoMode) {
        setIsDemoOrg(true);
        setPlanTier('demo');
        setPlanLoaded(true);
        setShowPaywall(false);
        return;
      }

      if (!user) {
        setPlanTier('demo');
        setPlanLoaded(true);
        setShowPaywall(false);
        return;
      }

      // Check if demo user - NEVER show paywall for demo account
      const isDemo = DemoOrgService.isDemoUser(user.email);
      setIsDemoOrg(isDemo);

      if (isDemo) {
        setPlanTier('demo');
        setPlanLoaded(true);
        setShowPaywall(false);
        return;
      }

      // Check if super admin / admin - NEVER show paywall for admins
      try {
        const shouldBypass = await AdminService.shouldBypassLimits(user.uid);
        if (shouldBypass) {
          setPlanTier('admin');
          setPlanLoaded(true);
          setShowPaywall(false);
          return;
        }
      } catch {
        // If admin check fails, assume paid
        setPlanTier('unknown');
        setPlanLoaded(true);
      }

      if (!currentOrgId) return;

      try {
        const tier = await SubscriptionService.getPlanTier(currentOrgId);
        setPlanTier(tier);
        setPlanLoaded(true);
        setShowPaywall(false);
      } catch {
        // If subscription check fails, assume paid (don't block)
        setPlanTier('unknown');
        setPlanLoaded(true);
        setShowPaywall(false);
      }
    };
    
    checkSubscription();
  }, [currentOrgId, user, isDemoMode]);
  
  const [dashboardSectionVisibility, setDashboardSectionVisibility] = useState<Record<string, boolean>>(() => {
    const defaults = {
      'kpi-cards': true,
      'top-performers': true,
      'posting-activity': false,
      'tracked-accounts': false,
      'videos-table': true,
      'video-slider': true
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
  // const creatorsPageRef = useRef<CreatorsManagementPageRef | null>(null); // Coming Soon
  const [linkFilter, setLinkFilter] = useState<string>('all'); // 'all' or link ID
  const [allLinks, setAllLinks] = useState<any[]>([]); // Store all links for dropdown

  // Dashboard platform filter state
  // Platform filter - now supports multi-select
  const [dashboardPlatformFilter, setDashboardPlatformFilter] = useState<('instagram' | 'tiktok' | 'youtube' | 'twitter')[]>(() => {
    const saved = localStorage.getItem('dashboardPlatformFilter');
    if (saved && saved !== 'all') {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return []; // Empty array = all platforms
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
  
  // Track which tab's data is ready to prevent showing stale data
  const [tabDataReady, setTabDataReady] = useState<Record<string, boolean>>({
    dashboard: false,
    videos: false,
    accounts: false,
    analytics: false,
  });
  
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
  // Header search query for the Creators tab. Lives at the dashboard level
  // so it can sit in the sticky header next to the date filter (matching the
  // Tracked Accounts tab) and gets passed down to CreatorsManagementPage.
  const [creatorsSearchQuery, setCreatorsSearchQuery] = useState('');

  // Mark tab data as ready when it finishes loading
  useEffect(() => {
    if (dataLoadedFromFirebase && !loadingDashboard) {
      setTabDataReady(prev => ({
        ...prev,
        dashboard: true,
        videos: true,
        accounts: true,
        analytics: true,
      }));
    }
  }, [dataLoadedFromFirebase, loadingDashboard]);

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

  // ── Detect Superwall integration on the org ─────────────────────────
  useEffect(() => {
    if (!currentOrgId) {
      setSuperwallAppId(null);
      setRevenueByDate(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const settingsSnap = await getDocs(
          query(collection(db, 'organizations', currentOrgId, 'settings'))
        );
        const general = settingsSnap.docs.find(d => d.id === 'general');
        const swAppId = general?.data()?.integrations?.superwall?.applicationId || null;
        const reportingView = general?.data()?.defaultReportingView as 'organic' | 'total' | 'split' | undefined;
        if (!cancelled) {
          setSuperwallAppId(swAppId);
          setOrgDefaultReportingView(reportingView);
          if (!swAppId) setRevenueByDate(undefined);
        }
      } catch (err) {
        console.warn('[Dashboard] Failed to read superwall integration:', err);
        if (!cancelled) setSuperwallAppId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrgId]);

  // ── Fetch Superwall revenue series for the active date range ────────
  useEffect(() => {
    if (!currentOrgId || !superwallAppId) return;
    if (dashboardViewMode !== 'unified') return; // Don't pay for the call when classic view is showing
    let cancelled = false;
    setRevenueLoading(true);
    (async () => {
      try {
        const dr = DateFilterService.getDateRange(dateFilter, customDateRange, submissions);
        if (!dr) return;
        // The right xAxis (`purchaseDate` vs `installDate` etc.) varies by
        // metric — getMetricAxis maps it for us so non-revenue metrics like
        // newUsers also work correctly.
        const { xAxis, dimension } = SuperwallService.getMetricAxis(selectedRevenueMetric);
        const dateFilterObj: any = {
          dimension,
          preset: 'custom',
          range: {
            from: new Date(dr.startDate).toISOString().split('.')[0],
            to: new Date(dr.endDate).toISOString().split('.')[0],
          },
        };
        const res = await SuperwallService.fetchChartData({
          orgId: currentOrgId,
          applicationId: superwallAppId,
          yAxis: selectedRevenueMetric,
          xAxis,
          dateFilter: dateFilterObj,
          dateInterval: 'day',
        });
        const map: Record<string, number> = {};
        (res.data || []).forEach(point => {
          const dateKey = (point.x || '').split('T')[0];
          if (!dateKey) return;
          // Read the active metric's value out of the response — Superwall
          // keys the values bag by yAxis name.
          const entry = (point.values as any)?.[selectedRevenueMetric];
          const value = (entry && typeof entry === 'object' && 'y' in entry) ? (entry as any).y : 0;
          map[dateKey] = (map[dateKey] || 0) + value;
        });
        if (!cancelled) setRevenueByDate(map);
      } catch (err) {
        console.warn('[Dashboard] Failed to fetch superwall revenue:', err);
        if (!cancelled) setRevenueByDate({});
      } finally {
        if (!cancelled) setRevenueLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrgId, superwallAppId, dashboardViewMode, dateFilter, customDateRange, submissions, selectedRevenueMetric]);

  // ── Fetch ALL toggled-on revenue options in parallel ──────────────
  // Powers the multi-revenue overlay on the Dashboard chart. Skips work
  // when only the primary metric is selected (single-fetch effect above
  // already covers that case via revenueByDate).
  useEffect(() => {
    if (!currentOrgId || !superwallAppId) return;
    if (dashboardViewMode !== 'unified') return;
    if (selectedRevenueMetrics.length === 0) return;
    let cancelled = false;
    setPendingRevenueKeys([...selectedRevenueMetrics]);
    (async () => {
      try {
        const dr = DateFilterService.getDateRange(dateFilter, customDateRange, submissions);
        if (!dr) return;
        const fromIso = new Date(dr.startDate).toISOString().split('.')[0];
        const toIso = new Date(dr.endDate).toISOString().split('.')[0];

        const results = await Promise.all(selectedRevenueMetrics.map(async (key) => {
          const { xAxis, dimension } = SuperwallService.getMetricAxis(key);
          const res = await SuperwallService.fetchChartData({
            orgId: currentOrgId,
            applicationId: superwallAppId,
            yAxis: key,
            xAxis,
            dateFilter: { dimension, preset: 'custom', range: { from: fromIso, to: toIso } } as any,
            dateInterval: 'day',
          });
          return { key, data: res.data || [] };
        }));

        if (cancelled) return;
        const next: Record<string, Record<string, number>> = {};
        for (const { key, data } of results) {
          const map: Record<string, number> = {};
          data.forEach(point => {
            const dateKey = (point.x || '').split('T')[0];
            if (!dateKey) return;
            const entry = (point.values as any)?.[key];
            const v = (entry && typeof entry === 'object' && 'y' in entry) ? (entry as any).y : 0;
            map[dateKey] = (map[dateKey] || 0) + v;
          });
          next[key] = map;
        }
        setRevenueByDateByOption(next);
      } catch (err) {
        console.warn('[Dashboard] Failed to fetch multi-revenue series:', err);
      } finally {
        if (!cancelled) setPendingRevenueKeys([]);
      }
    })();
    return () => { cancelled = true; };
  }, [currentOrgId, superwallAppId, dashboardViewMode, dateFilter, customDateRange, submissions, selectedRevenueMetrics]);

  useEffect(() => {
    localStorage.setItem('dashboardPlatformFilter', JSON.stringify(dashboardPlatformFilter));
  }, [dashboardPlatformFilter]);

  // Load usage limits for account tracking
  useEffect(() => {
    if (isDemoMode) return;
    const loadUsageLimits = async () => {
      if (!currentOrgId) return;
      
      try {
        // Admin users have unlimited everything
        if (isAdmin) {
          setUsageLimits({
            accountsLeft: 999999,
            videosLeft: 999999,
            isAtAccountLimit: false,
            isAtVideoLimit: false
          });
          return;
        }
        
        const [usage, limits] = await Promise.all([
          UsageTrackingService.getUsage(currentOrgId),
          UsageTrackingService.getLimits(currentOrgId)
        ]);
        
        const accountsLeft = limits.maxAccounts === -1 ? 999999 : Math.max(0, limits.maxAccounts - usage.trackedAccounts);
        const videosLeft = limits.maxVideos === -1 ? 999999 : Math.max(0, limits.maxVideos - usage.trackedVideos);
        
        setUsageLimits({
          accountsLeft,
          videosLeft,
          isAtAccountLimit: accountsLeft === 0,
          isAtVideoLimit: videosLeft === 0
        });
      } catch (error) {
        console.error('Failed to load usage limits:', error);
      }
    };
    
    loadUsageLimits();
  }, [currentOrgId, pendingAccounts.length, isAdmin]); // Reload when accounts change or admin status changes

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
    if (!isDemoMode && (userRole === 'creator' || userRole === '')) {
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
        
        // 🔧 CRITICAL FIX: Update cache immediately to prevent stale data from being reloaded
        const cacheKey = `dashboard_${currentOrgId}_${currentProjectId}`;
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const cachedData = JSON.parse(cached);
            cachedData.selectedRuleIds = selectedRuleIds;
            cachedData.timestamp = Date.now(); // Update timestamp
            localStorage.setItem(cacheKey, JSON.stringify(cachedData));
            console.log('🔄 Updated cache with new selectedRuleIds');
          }
        } catch (cacheError) {
          console.warn('⚠️ Failed to update cache:', cacheError);
        }
      } catch (error) {
        console.error('❌ Failed to save selected rules:', error);
      }
    };
    
    saveSelectedRules();
  }, [selectedRuleIds, user, currentOrgId, currentProjectId, rulesLoadedFromFirebase, userRole]);

  // Debug: Log when rules or selectedRuleIds change
  useEffect(() => {
    // 🎯 CREATORS: Skip debug logs (check BEFORE any logs)
    if (!isDemoMode && (userRole === 'creator' || userRole === '')) {
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
        // Coming Soon - Dec 20
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
        
        // Creators stay on dashboard - they see CreatorPortalPage
        // No redirect needed anymore - campaigns have been removed
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

          // Deduplicate section order from Firebase (removes stale 'top-platforms' entries and duplicates)
          const dedupedOrder = prefs.dashboardSectionOrder.filter((id: string, idx: number, arr: string[]) =>
            id !== 'top-platforms' && arr.indexOf(id) === idx
          );
          setDashboardSectionOrder(dedupedOrder);
          setDashboardSectionVisibility(prefs.dashboardSectionVisibility);

          // Sync to localStorage as backup
          localStorage.setItem('kpiCardOrder', JSON.stringify(prefs.kpiCardOrder));
          localStorage.setItem('kpiCardVisibility', JSON.stringify(prefs.kpiCardVisibility));
          localStorage.setItem('dashboardSectionOrder', JSON.stringify(dedupedOrder));
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
    // Guard against stale fetches when user switches projects rapidly.
    // When the effect re-runs (deps change), cleanup sets cancelled=true so
    // the old async IIFE stops writing to state.
    let cancelled = false;

    console.log('🚨 DATA LOAD EFFECT:', { user: !!user, isDemoMode, currentOrgId, currentProjectId });
    if ((!user && !isDemoMode) || !currentOrgId || !currentProjectId) {
      console.log('⛔ SKIPPING DATA LOAD:', { user: !!user, isDemoMode, currentOrgId, currentProjectId });
      // Reset loading states when context is missing (allow demo mode without user)
      setRulesLoadedFromFirebase(false);
      setDataLoadedFromFirebase(false);
      setLoadingDashboard(false);
      setDataFullyLoaded(false);
      return () => { cancelled = true; };
    }

    // 🔐 SUPER ADMIN VIEW-AS MODE: Use pre-fetched data from API
    if (viewAsContext.isViewAsMode && viewAsContext.viewAsData) {
      console.log('🔐 Super Admin View-As Mode: Using pre-fetched data');
      const { videos, accounts, links } = viewAsContext.viewAsData;
      
      // Process accounts
      const processedAccounts: TrackedAccount[] = (accounts || []).map((acc: any) => ({
        id: acc.id,
        ...acc,
        dateAdded: acc.dateAdded ? new Date(acc.dateAdded) : new Date(),
        lastUpdated: acc.lastUpdated ? new Date(acc.lastUpdated) : undefined,
        lastSynced: acc.lastSynced ? new Date(acc.lastSynced) : undefined,
      }));
      setTrackedAccounts(processedAccounts);
      const accountsMap = new Map(processedAccounts.map(acc => [acc.id, acc]));
      
      // Process videos
      const processedVideos: VideoSubmission[] = (videos || []).map((video: any) => {
        const account = video.trackedAccountId ? accountsMap.get(video.trackedAccountId) : null;
        return {
          id: video.id,
          url: video.videoUrl || video.url || '',
          platform: video.platform as 'instagram' | 'tiktok' | 'youtube',
          thumbnail: video.thumbnail || '',
          title: video.videoTitle || video.caption || video.title || '',
          caption: video.caption || video.videoTitle || '',
          uploader: account?.displayName || account?.username || video.uploaderHandle || '',
          uploaderHandle: account?.username || video.uploaderHandle || '',
          uploaderProfilePicture: account?.profilePicture || video.uploaderProfilePicture,
          followerCount: account?.followerCount,
          trackedAccountId: video.trackedAccountId || undefined,
          status: video.status === 'archived' ? 'rejected' : 'approved',
          views: video.views || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          duration: video.duration || 0,
          dateSubmitted: video.dateAdded ? new Date(video.dateAdded) : new Date(),
          uploadDate: video.uploadDate ? new Date(video.uploadDate) : new Date(),
          lastRefreshed: video.lastRefreshed ? new Date(video.lastRefreshed) : undefined,
          isStale: video.isStale || false,
          snapshots: (video.snapshots || []).map((s: any) => ({
            ...s,
            timestamp: s.timestamp ? new Date(s.timestamp) : new Date()
          }))
        };
      });
      setSubmissions(processedVideos);
      
      // Process links
      const processedLinks: TrackedLink[] = (links || []).map((link: any) => ({
        id: link.id,
        ...link,
        createdAt: link.createdAt ? new Date(link.createdAt) : new Date(),
        updatedAt: link.updatedAt ? new Date(link.updatedAt) : undefined,
      }));
      setLinks(processedLinks);
      
      // Set totals
      setTotalAccountsInOrg(processedAccounts.length);
      setTotalVideosInOrg(processedVideos.length);
      
      // Mark as loaded
      setRulesLoadedFromFirebase(true);
      setDataLoadedFromFirebase(true);
      setLoadingDashboard(false);
      setDataFullyLoaded(true);

      // Debug: Count total snapshots
      const totalSnapshots = processedVideos.reduce((sum, v) => sum + (v.snapshots?.length || 0), 0);
      console.log(`✅ View-As loaded: ${processedVideos.length} videos, ${processedAccounts.length} accounts, ${processedLinks.length} links`);
      console.log(`📸 View-As snapshots: ${totalSnapshots} total snapshots loaded`);
      const firstVideo = processedVideos[0];
      const firstSnapshot = firstVideo?.snapshots?.[0];
      if (firstVideo && firstSnapshot) {
        console.log(`   Sample: First video has ${firstVideo.snapshots?.length || 0} snapshots`);
        console.log(`   Latest: views=${firstSnapshot.views}, timestamp=${firstSnapshot.timestamp}`);
      }
      return () => { cancelled = true; };
    }

    // Start loading - set loading state to true
    setLoadingDashboard(true);
    setDataFullyLoaded(false);

    // 🎯 CREATORS: Skip loading ALL organization data - they only need campaigns
    // Also skip if role not loaded yet to prevent unnecessary cache loading
    // BUT allow demo mode to proceed regardless of role
    if (!isDemoMode && (userRole === 'creator' || userRole === '')) {
      if (userRole === 'creator') {
        console.log('🎯 Creator role detected - skipping organization data load');
        setRulesLoadedFromFirebase(true);
        setDataLoadedFromFirebase(true);
        setLoadingDashboard(false);
        setDataFullyLoaded(true);
      }
      return () => { cancelled = true; };
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
        
        // Use cache if less than 5 minutes old (30 minutes for demo)
        const maxCacheAge = isDemoMode ? 30 * 60 * 1000 : 5 * 60 * 1000;
        if (cacheAge < maxCacheAge) {
          // CRITICAL: Filter cached rule IDs to only include rules that exist in this project
          const validCachedRuleIds = new Set((rules || []).map((r: TrackingRule) => r.id));
          const filteredCachedRuleIds = (cachedRuleIds || []).filter((id: string) => validCachedRuleIds.has(id));
          
          if (filteredCachedRuleIds.length !== (cachedRuleIds || []).length) {
            console.warn(`⚠️ Cache: Filtered out ${(cachedRuleIds || []).length - filteredCachedRuleIds.length} invalid rule IDs`);
          }
          
          setTrackedAccounts(accounts || []);
          setSubmissions(submissions || []);
          setTotalVideosInOrg((submissions || []).length);
          setTotalAccountsInOrg((accounts || []).length);
          setAllRules(rules || []);
          setSelectedRuleIds(filteredCachedRuleIds);
          setLinks(cachedLinks || []);
          setLinkClicks(cachedClicks || []);
          setRulesLoadedFromFirebase(true);
          setDataLoadedFromFirebase(true);
          setLoadingDashboard(false);
          // NOTE: Do NOT set dataFullyLoaded(true) here. Cache only stores ~100 videos,
          // so KPI totals would flash incorrect values from the cached subset before
          // Firebase loads the full dataset. Let KPI skeletons stay visible until
          // Firebase data arrives. The cached submissions still populate the video table.
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
      if (cancelled) return;
      console.log('🚀 Starting Parallel Firebase load...');
      console.time('🚀 Parallel Firebase load');

    try {
      // PHASE 1: Load ALL top-level collections in parallel
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore query timeout after 15s')), 15000)
      );

      const dataPromise = Promise.all([
        // 1. Accounts
        getDocs(query(
          collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts'),
          orderBy('dateAdded', 'desc')
        )).then(r => { console.log('✅ Accounts loaded:', r.size); return r; }),
        
        // 2. Videos
        FirestoreDataService.getVideos(currentOrgId, currentProjectId, { limitCount: 10000 })
          .then(r => { console.log('✅ Videos loaded:', r.length); return r; }),

        // 3. Rules
        getDocs(collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackingRules'))
          .then(r => { console.log('✅ Rules loaded:', r.size); return r; }),

        // 4. Links
        FirestoreDataService.getLinks(currentOrgId, currentProjectId)
          .then(r => { console.log('✅ Links loaded:', r.length); return r; }),

        // 5. Link Clicks — fetch all (was 200, caused wrong KPI totals)
        LinkClicksService.getProjectLinkClicks(currentOrgId, currentProjectId, 5000)
          .then(r => { console.log('✅ Clicks loaded:', r.length); return r; }),

        // 6. User Preferences (skip in demo mode - no user)
        user?.uid
          ? getDoc(doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'userPreferences', user.uid))
          : Promise.resolve(null)
      ]);

      const [accountsSnapshot, videoDocs, rulesSnapshot, allLinks, allClicks, userPrefsDoc] = await Promise.race([dataPromise, timeoutPromise]) as any;

      // Bail out if the effect was re-triggered (e.g. user switched projects)
      if (cancelled) return;

      // Process accounts
      const accounts: TrackedAccount[] = accountsSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      } as TrackedAccount));
      setTrackedAccounts(accounts);
      const accountsMap = new Map(accounts.map(acc => [acc.id, acc]));
      
      
      // PHASE 2: Load video snapshots (depends on videoIds from phase 1)
      let snapshotsMap: Map<string, any[]>;
      if (isDemoMode) {
        snapshotsMap = new Map();
      } else {
        const videoIds = videoDocs.map((v: any) => v.id);
        snapshotsMap = await FirestoreDataService.getVideoSnapshotsBatch(
          currentOrgId,
          currentProjectId,
          videoIds
        );
      }
      
      // Bail out again after snapshot fetch (can be slow for large orgs)
      if (cancelled) return;

      // Process videos (videoDocs already filtered for deleted videos)
      const allSubmissions: VideoSubmission[] = videoDocs.map((videoDoc: any) => {
        const video = videoDoc as any;
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
          trackedAccountId: video.trackedAccountId || undefined,
          status: video.status === 'archived' ? 'rejected' : 'approved',
          views: video.views || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          duration: video.duration || 0,
          dateSubmitted: video.dateAdded?.toDate?.() || new Date(),
          uploadDate: video.uploadDate?.toDate?.() || new Date(),
          lastRefreshed: video.lastRefreshed?.toDate?.(),
          isStale: video.isStale || false,
          // Spark fields — without these the modal sees the video as
          // never-sparked on every reopen and the chart's organic/total
          // toggle has no spark events to subtract.
          sparkedAt: (video as any).sparkedAt?.toDate?.() || undefined,
          sparkViewLogs: (video as any).sparkViewLogs || undefined,
          snapshots: snapshots
        };
      });
      setSubmissions(allSubmissions);
      
      // Set total counts (unfiltered) for empty state check
      setTotalAccountsInOrg(accountsSnapshot.size);
      setTotalVideosInOrg(allSubmissions.length);
    
      // Process rules
      const rules = rulesSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as TrackingRule[];
      
      const savedSelectedRuleIds = userPrefsDoc?.exists?.() ? (userPrefsDoc.data()?.selectedRuleIds || []) : [];
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

      setRulesLoadedFromFirebase(true);
      setDataLoadedFromFirebase(true);
      setLoadingDashboard(false);
      setDataFullyLoaded(true);
      console.timeEnd('🚀 Parallel Firebase load');
      console.log('✅ All data loaded in parallel!');
      
      // Cache data (stripped down to fit localStorage ~5MB limit)
      if (!hasCached) {
        try {
          // Strip snapshots from submissions (largest payload) and limit to 100 most recent
          const strippedSubmissions = allSubmissions
            .sort((a: any, b: any) => (b.created_at || 0) - (a.created_at || 0))
            .slice(0, 100)
            .map(({ snapshots, ...rest }: any) => rest);

          localStorage.setItem(cacheKey, JSON.stringify({
            accounts,
            submissions: strippedSubmissions,
            rules,
            selectedRuleIds: filteredSelectedRuleIds,
            links: allLinks,
            timestamp: Date.now()
          }));
          console.log(`💾 Dashboard cached (${strippedSubmissions.length} submissions, no snapshots, no linkClicks)`);
        } catch (error) {
          console.error('Cache save error:', error);
        }
      }
    } catch (error: any) {
      if (cancelled) return;
      console.error('❌ Failed to load data:', error);
      document.title = `ERROR: ${error?.message || error}`;
      setDataLoadedFromFirebase(true);
      setRulesLoadedFromFirebase(true);
      setLoadingDashboard(false);
      setDataFullyLoaded(true);
      console.timeEnd('🚀 Parallel Firebase load');
    }

    })(); // End of async IIFE

    return () => { cancelled = true; };
  }, [user, currentOrgId, currentProjectId, userRole, viewAsContext.isViewAsMode, viewAsContext.viewAsData]); // Reload when project changes, role is loaded, or view-as data changes!

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
          setDataFullyLoaded(false);
          const videoDocs = await FirestoreDataService.getVideos(currentOrgId, currentProjectId, { limitCount: 10000 });
          
          const accounts = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
          const accountsMap = new Map(accounts.map(acc => [acc.id, acc]));
          
          const videoIds = videoDocs.map((v: any) => v.id);
          const snapshotsMap = await FirestoreDataService.getVideoSnapshotsBatch(currentOrgId, currentProjectId, videoIds);
          
          const allSubmissions: VideoSubmission[] = videoDocs.map((videoDoc: any) => {
            const video = videoDoc as any;
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
              trackedAccountId: video.trackedAccountId || undefined,
              status: video.status === 'archived' ? 'rejected' : 'approved',
              views: video.views || 0,
              likes: video.likes || 0,
              comments: video.comments || 0,
              shares: video.shares || 0,
              duration: video.duration || 0,
              dateSubmitted: video.dateAdded?.toDate?.() || new Date(),
              uploadDate: video.uploadDate?.toDate?.() || new Date(),
              lastRefreshed: video.lastRefreshed?.toDate?.(),
              isStale: (video as any).isStale || false,
              sparkedAt: (video as any).sparkedAt?.toDate?.() || undefined,
              sparkViewLogs: (video as any).sparkViewLogs || undefined,
              snapshots: snapshots
            };
          });

          setSubmissions(allSubmissions);
          setDataFullyLoaded(true);
        } catch (error) {
          console.error('❌ Failed to auto-refresh videos:', error);
          setDataFullyLoaded(true);
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
      
      // Block spacebar action in demo/view-as mode or for creators
      if (isOverrideMode || userRole === 'creator') return;
      
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
      // ✅ Show AddTypeSelector on dashboard, accounts, and videos tabs
      if (activeTab === 'dashboard' || activeTab === 'accounts' || activeTab === 'videos') {
        setIsTypeSelectorOpen(true);
      } else if (activeTab === 'analytics') {
        if (requiresPaidPlan('to create tracking links')) return;
        trackedLinksPageRef.current?.openCreateModal();
      } else if (activeTab === 'campaigns') {
        navigate('/campaigns/create');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, isModalOpen, isTikTokSearchOpen, isAnalyticsModalOpen, isOverrideMode, userRole]);

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
    // Also skip if role not loaded yet (userRole === '') — but allow demo mode
    if (!isDemoMode && (userRole === 'creator' || userRole === '')) {
      return [];
    }
    
    console.log('🔄 Recalculating submissionsWithoutDateFilter with rule filters...');
    console.log('📊 Raw submissions count:', submissions.length);
    console.log('🎯 Active rules count:', allRules.filter(r => r.isActive).length);
    console.log('🔍 Selected rule IDs:', selectedRuleIds);
    
    let filtered = submissions;
    const initialCount = filtered.length;
    
    // Apply platform filter (multi-select)
    if (dashboardPlatformFilter.length > 0) {
      filtered = filtered.filter(video => dashboardPlatformFilter.includes(video.platform as any));
      console.log(`📱 After platform filter (${dashboardPlatformFilter.join(', ')}):`, filtered.length, `(removed ${initialCount - filtered.length})`);
    }
    
    // Apply Labels filter (creators carrying the selected labels). We resolve
    // each video → its tracked account → the linked creator → the creator's
    // labelIds. A video matches if its creator has at least one of the
    // selected labels (OR logic, mirroring how rules behave).
    if (selectedLabelIds.length > 0) {
      const beforeLabelFilter = filtered.length;
      const labelSet = new Set(selectedLabelIds);

      // accountId → creatorId
      const accountToCreator = new Map<string, string>();
      for (const link of creatorLinks) {
        if (!accountToCreator.has(link.accountId)) {
          accountToCreator.set(link.accountId, link.creatorId);
        }
      }
      // creatorId → labelIds
      const creatorLabelIds = new Map<string, string[]>();
      for (const c of creators) creatorLabelIds.set(c.id, c.labelIds || []);

      // (platform, lowercased uploaderHandle) → accountId for the video → account match
      const accountKeyToId = new Map<string, string>();
      for (const acc of trackedAccounts) {
        accountKeyToId.set(`${acc.platform}_${acc.username.toLowerCase()}`, acc.id);
      }

      filtered = filtered.filter(video => {
        if (!video.uploaderHandle) return false;
        const accId = accountKeyToId.get(`${video.platform}_${video.uploaderHandle.toLowerCase()}`);
        if (!accId) return false;
        const creatorId = accountToCreator.get(accId);
        if (!creatorId) return false;
        const ids = creatorLabelIds.get(creatorId) || [];
        return ids.some(id => labelSet.has(id));
      });
      console.log(`🏷️ After labels filter (${selectedLabelIds.length} labels):`, filtered.length, `(removed ${beforeLabelFilter - filtered.length})`);
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
  }, [submissions, dashboardPlatformFilter, selectedAccountIds, selectedLabelIds, creators, creatorLinks, trackedAccounts, allRules, selectedRuleIds, rulesFingerprint, userRole]);

  // Filter submissions based on date range, platform, and accounts (memoized to prevent infinite loops)
  const filteredSubmissions = useMemo(() => {
    // 🎯 CREATORS: Skip all date filtering calculations
    // Also skip if role not loaded yet (userRole === '') — but allow demo mode
    if (!isDemoMode && (userRole === 'creator' || userRole === '')) {
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

  // Strict filter for "New Videos" table - only videos UPLOADED in the period (not just refreshed)
  const strictFilteredSubmissions = useMemo(() => {
    if (!isDemoMode && (userRole === 'creator' || userRole === '')) {
      return [];
    }
    
    console.log('📅 [STRICT] Applying STRICT upload date filter for "New Videos" table...');
    
    // Use strictMode: TRUE to only include videos uploaded in period
    let strictFiltered = DateFilterService.filterVideosByDateRange(
      submissionsWithoutDateFilter, 
      dateFilter, 
      customDateRange,
      true // strictMode: true = ONLY videos uploaded in period
    );
    
    console.log('✅ [STRICT] After strict filter:', strictFiltered.length, 'videos actually uploaded in this period');
    
    return strictFiltered;
  }, [submissionsWithoutDateFilter, dateFilter, customDateRange, userRole]);

  // Combine real submissions with pending videos for immediate UI feedback
  // For "New Videos" table: use STRICT filter (only videos uploaded in period, not just refreshed)
  const combinedSubmissions = useMemo(() => {
    const combined = [...pendingVideos, ...strictFilteredSubmissions];
    return combined;
  }, [pendingVideos, strictFilteredSubmissions]);

  // Per-account / per-creator post counts for the All-Accounts dropdown.
  // Honors the date filter and the platform filter, but NOT the account filter
  // (we don't want the counts to change as the user clicks accounts in the
  // dropdown). Strict mode = only videos UPLOADED in the period.
  const accountActivityCounts = useMemo(() => {
    const byAccountId = new Map<string, number>();
    const byCreatorId = new Map<string, number>();
    if (!isDemoMode && (userRole === 'creator' || userRole === '')) {
      return { byAccountId, byCreatorId };
    }

    let pool = submissions;
    if (dashboardPlatformFilter.length > 0) {
      pool = pool.filter(v => dashboardPlatformFilter.includes(v.platform as any));
    }
    pool = DateFilterService.filterVideosByDateRange(pool, dateFilter, customDateRange, true);

    // Build lookup tables for account resolution.
    const accountByPlatformHandle = new Map<string, string>();
    for (const a of trackedAccounts) {
      accountByPlatformHandle.set(`${a.platform}_${a.username.toLowerCase()}`, a.id);
    }
    const creatorIdByAccountId = new Map<string, string>();
    for (const link of creatorLinks) {
      if (!creatorIdByAccountId.has(link.accountId)) {
        creatorIdByAccountId.set(link.accountId, link.creatorId);
      } else {
        // Prefer real userIds over synthetic creatorShare:/cron: ids — same
        // dedupe rule used by the dropdown's grouping logic.
        const existing = creatorIdByAccountId.get(link.accountId)!;
        const existingSynthetic = !existing ||
          existing.startsWith('creatorShare:') ||
          existing.startsWith('cron:') ||
          existing === 'system' || existing === 'api';
        const candidateSynthetic = !link.creatorId ||
          link.creatorId.startsWith('creatorShare:') ||
          link.creatorId.startsWith('cron:') ||
          link.creatorId === 'system' || link.creatorId === 'api';
        if (existingSynthetic && !candidateSynthetic) {
          creatorIdByAccountId.set(link.accountId, link.creatorId);
        }
      }
    }

    for (const v of pool) {
      // Resolve to a tracked account: prefer trackedAccountId field, fall
      // back to (platform, uploaderHandle) match for older videos.
      let accountId = (v as any).trackedAccountId as string | undefined;
      if (!accountId && v.uploaderHandle) {
        accountId = accountByPlatformHandle.get(`${v.platform}_${v.uploaderHandle.toLowerCase()}`);
      }
      if (accountId) {
        byAccountId.set(accountId, (byAccountId.get(accountId) || 0) + 1);
      }

      // Cumulative per creator: via creatorLink, AND via direct
      // assignedCreatorId on the video itself (portal-submitted videos).
      const linkedCreatorId = accountId ? creatorIdByAccountId.get(accountId) : undefined;
      const assignedCreatorId = (v as any).assignedCreatorId as string | undefined;
      const creditCreators = new Set<string>();
      if (linkedCreatorId) creditCreators.add(linkedCreatorId);
      if (assignedCreatorId) creditCreators.add(assignedCreatorId);
      for (const cid of creditCreators) {
        byCreatorId.set(cid, (byCreatorId.get(cid) || 0) + 1);
      }
    }

    return { byAccountId, byCreatorId };
  }, [submissions, dashboardPlatformFilter, dateFilter, customDateRange, trackedAccounts, creatorLinks, isDemoMode, userRole]);

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

  // Handle date filter changes (granularity auto-calculates via useMemo - no separate render!)
  const handleDateFilterChange = useCallback((filter: DateFilterType, customRange?: DateRange) => {
    setDateFilter(filter);
    setCustomDateRange(customRange);
    setManualGranularity(null); // Reset manual override when filter changes
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

  const handleVideoDeleted = useCallback(() => {
    console.log('🔄 Video deleted - reloading page data...');
    // Reload the entire page to refresh all data
    window.location.reload();
  }, []);

  // Super admin: manually re-fetch a single video's data from the platform
  const handleRefreshVideo = useCallback(async (video: VideoSubmission) => {
    if (!currentOrgId || !currentProjectId || !video.url) return;
    try {
      console.log(`🔄 [Super Admin] Refreshing video: ${video.url}`);
      await AuthenticatedApiService.processVideo(video.url, currentOrgId, currentProjectId);
      alert(`✅ Refresh queued for "${video.title || video.url}". Data will update shortly.`);
      // Reload after a delay to let the processing finish
      setTimeout(() => window.location.reload(), 8000);
    } catch (error) {
      console.error('❌ Failed to refresh video:', error);
      alert(`Failed to refresh video: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [currentOrgId, currentProjectId]);

  // Super admin: bulk refresh selected videos
  const handleBulkRefreshVideos = useCallback(async (videos: VideoSubmission[]) => {
    if (!currentOrgId || !currentProjectId) return;
    const videosWithUrls = videos.filter(v => v.url);
    if (videosWithUrls.length === 0) {
      alert('No videos with URLs to refresh.');
      return;
    }
    const confirmed = window.confirm(`Refresh ${videosWithUrls.length} video(s)? This will re-fetch data from the platform for each one.`);
    if (!confirmed) return;

    console.log(`🔄 [Super Admin] Bulk refreshing ${videosWithUrls.length} videos...`);
    let successCount = 0;
    let failCount = 0;
    for (const video of videosWithUrls) {
      try {
        await AuthenticatedApiService.processVideo(video.url, currentOrgId, currentProjectId);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to refresh ${video.url}:`, error);
        failCount++;
      }
    }
    alert(`✅ Refresh queued: ${successCount} succeeded, ${failCount} failed. Data will update shortly.`);
    setTimeout(() => window.location.reload(), 8000);
  }, [currentOrgId, currentProjectId]);

  // Toggle stale (freeze/unfreeze) on a single video
  const handleToggleStale = useCallback(async (video: VideoSubmission) => {
    if (!currentOrgId || !currentProjectId) return;
    const newStale = !video.isStale;
    try {
      await FirestoreDataService.setVideoStale(currentOrgId, currentProjectId, video.id, newStale);
      setSubmissions(prev => prev.map(v => v.id === video.id ? { ...v, isStale: newStale } : v));
      setBulkAddToast({ message: newStale ? 'Video frozen — it won\'t auto-refresh.' : 'Video unfrozen — it will auto-refresh again.', type: 'success' });
    } catch (error) {
      console.error('Failed to toggle stale:', error);
      setBulkAddToast({ message: 'Failed to update video.', type: 'error' });
    }
  }, [currentOrgId, currentProjectId]);

  // Bulk toggle stale on multiple videos
  const handleBulkToggleStale = useCallback(async (videos: VideoSubmission[], isStale: boolean) => {
    if (!currentOrgId || !currentProjectId) return;
    const ids = videos.map(v => v.id);
    try {
      await FirestoreDataService.setVideosStale(currentOrgId, currentProjectId, ids, isStale);
      setSubmissions(prev => prev.map(v => ids.includes(v.id) ? { ...v, isStale } : v));
      setBulkAddToast({ message: isStale ? `${ids.length} video${ids.length !== 1 ? 's' : ''} frozen.` : `${ids.length} video${ids.length !== 1 ? 's' : ''} unfrozen.`, type: 'success' });
    } catch (error) {
      console.error('Failed to bulk toggle stale:', error);
      setBulkAddToast({ message: 'Failed to update videos.', type: 'error' });
    }
  }, [currentOrgId, currentProjectId]);

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
    setSelectedCreatorDisplayName(undefined);
    setSelectedPlatformFilter(undefined);
    setIsDayVideosModalOpen(true);
  }, [customDateRange]);

  // Top-platform row click: opens the day-videos modal pre-filtered to all
  // videos on that platform within the active date range.
  const handlePlatformClick = useCallback(
    (platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter') => {
      const targetDate = customDateRange?.endDate || new Date();
      setDayVideosDate(targetDate);
      setSelectedAccountFilter(undefined);
      setSelectedCreatorDisplayName(undefined);
      setSelectedPlatformFilter(platform);
      setIsDayVideosModalOpen(true);
    },
    [customDateRange]
  );

  // Creator-row click in the Top Performers list: opens the same Day-Videos
  // modal but pre-filtered to ALL of the creator's linked tracked-account
  // usernames so the videos and KPI cards aggregate across every platform
  // that creator posts to.
  const handleCreatorRowClick = useCallback(
    (info: { creatorId: string; displayName: string; usernames: string[] }) => {
      const targetDate = customDateRange?.endDate || new Date();
      setDayVideosDate(targetDate);
      // Pass the array straight through; an empty array would silently match
      // nothing, so fall back to displayName so the modal at least opens with
      // a recognizable filter (rare edge case — a creator with zero links).
      setSelectedAccountFilter(info.usernames.length ? info.usernames : info.displayName);
      setSelectedCreatorDisplayName(info.displayName);
      setSelectedPlatformFilter(undefined);
      setIsDayVideosModalOpen(true);
    },
    [customDateRange]
  );

  // Legacy function - kept for reference but replaced by handleAddVideosWithAccounts
  // const handleAddVideo = useCallback(async (videoUrl: string, uploadDate: Date) => { ... }


  const handleAddVideosWithAccounts = useCallback(async (platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter', videoUrls: string[], assignedCreatorId?: string, isStale?: boolean) => {
    if (requiresPaidPlan('to start tracking videos')) return;
    if (!user || !currentOrgId || !currentProjectId) {
      throw new Error('User not authenticated or no organization selected');
    }


    // Pre-check: how many video slots are available?
    let videosToAdd = videoUrls;
    let skippedDueToLimit = 0;

    const isAdmin = await AdminService.shouldBypassLimits(user.uid);
    if (!isAdmin) {
      try {
        const [usage, limits] = await Promise.all([
          UsageTrackingService.getUsage(currentOrgId),
          UsageTrackingService.getLimits(currentOrgId)
        ]);
        const maxVideos = limits.maxVideos;
        if (maxVideos !== -1) {
          const slotsAvailable = Math.max(0, maxVideos - usage.trackedVideos);
          if (slotsAvailable === 0) {
            setBulkAddToast({ message: `Video limit reached (${usage.trackedVideos}/${maxVideos}). Upgrade your plan to add more.`, type: 'error' });
            return;
          }
          if (videoUrls.length > slotsAvailable) {
            skippedDueToLimit = videoUrls.length - slotsAvailable;
            videosToAdd = videoUrls.slice(0, slotsAvailable);
          }
        }
      } catch (err) {
        console.warn('Failed to pre-check video limits, proceeding anyway:', err);
      }
    }

    // Create placeholder videos for instant UI feedback (only for videos we'll actually add)
    const placeholderVideos: VideoSubmission[] = videosToAdd.map((url, index) => ({
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

    setPendingVideos(prev => [...prev, ...placeholderVideos]);

    // Create a batch tracking document so the backend sends ONE email when all finish
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    try {
      const batchRef = doc(db, 'videoBatches', batchId);
      await setDoc(batchRef, {
        orgId: currentOrgId,
        projectId: currentProjectId,
        userId: user.uid,
        totalVideos: videosToAdd.length,
        completedVideos: 0,
        platform,
        createdAt: Timestamp.now(),
      });
    } catch (batchErr) {
      console.warn('Failed to create batch doc (non-critical):', batchErr);
    }

    let successCount = 0;
    let failureCount = 0;

    for (const videoUrl of videosToAdd) {
      try {
        const videoId = await FirestoreDataService.addVideo(currentOrgId, currentProjectId, user.uid, {
          platform,
          url: videoUrl,
          videoId: `temp-${Date.now()}`,
          thumbnail: '',
          title: 'Processing...',
          description: '',
          uploadDate: Timestamp.now(),
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          status: 'processing',
          isSingular: false,
          syncStatus: 'pending',
          syncRequestedBy: user.uid,
          syncRequestedAt: Timestamp.now(),
          syncRetryCount: 0,
          ...(assignedCreatorId && { assignedCreatorId }),
          ...(isStale && { isStale: true }),
        });

        AuthenticatedApiService.processVideo(videoId, currentOrgId, currentProjectId, batchId, assignedCreatorId).catch((err: any) => {
          console.error('Failed to trigger immediate processing:', err);
        });

        successCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to queue video ${videoUrl}:`, errorMessage);
        failureCount++;
      }
    }


    // Show visible feedback to the user
    if (successCount > 0 && failureCount === 0 && skippedDueToLimit === 0) {
      setBulkAddToast({ message: `${successCount} video${successCount !== 1 ? 's' : ''} queued for processing.`, type: 'success' });
    } else if (successCount > 0 && (failureCount > 0 || skippedDueToLimit > 0)) {
      const skippedTotal = failureCount + skippedDueToLimit;
      setBulkAddToast({ message: `${successCount} video${successCount !== 1 ? 's' : ''} queued. ${skippedTotal} skipped (plan limit reached). Upgrade for more.`, type: 'info' });
    } else {
      setBulkAddToast({ message: `Failed to add videos. You may have hit your plan limit.`, type: 'error' });
    }

    // Handle results
    if (successCount > 0) {
      // Reload after 8 seconds to allow processing to complete
      setTimeout(() => {
        setPendingVideos([]);
        setPendingAccounts([]);
        window.location.reload();
      }, 8000); // 8 seconds for Apify API + processing
    } else {
      setPendingVideos([]);
      setPendingAccounts([]);
    }
  }, [user, currentOrgId, currentProjectId]);

  const handleAddAccounts = useCallback(async (accounts: Array<{url: string, username: string, platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter', videoCount: number, youtubeVideoType?: 'shorts' | 'long' | 'both'}>) => {
    if (requiresPaidPlan('to start tracking accounts')) return;
    if (!currentOrgId || !currentProjectId || !user) return;

    setIsAddAccountModalOpen(false);

    try {
      const addPromises = accounts.map(account => 
        AccountTrackingServiceFirebase.addAccount(
          currentOrgId,
          currentProjectId,
          user.uid,
          account.username,
          account.platform,
          'my',
          account.videoCount,
          account.youtubeVideoType
        )
      );

      await Promise.all(addPromises);
      
      // Refresh accounts list
      if (currentOrgId && currentProjectId) {
        const updatedAccounts = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
        setTrackedAccounts(updatedAccounts);
        console.log('✅ Accounts list refreshed:', updatedAccounts.length, 'accounts');
      }
    } catch (error) {
      console.error('Failed to add accounts:', error);
    }
  }, [currentOrgId, currentProjectId, user]);

  const handleDelete = useCallback((id: string) => {
    if (!user || !currentOrgId || !currentProjectId) return;
    
    // Find the video to delete and open confirmation modal
    const video = submissions.find(s => s.id === id);
    if (video) {
      setVideoToDelete(video);
      setShowDeleteVideoModal(true);
    }
  }, [user, currentOrgId, currentProjectId, submissions]);

  const confirmDeleteVideo = useCallback(async () => {
    if (!user || !currentOrgId || !currentProjectId || !videoToDelete) return;
    
    const videoId = videoToDelete.id;
    const videoTitle = videoToDelete.title || videoToDelete.caption || 'Video';
    
    console.log(`🗑️ [UI] Starting video deletion: ${videoTitle}`);
    
    // Close modal immediately (optimistic update)
    setShowDeleteVideoModal(false);
    setVideoToDelete(null);
    
    try {
      console.log('🗑️ Deleting video:', videoId);
      
      // Delete from Firestore
      await FirestoreDataService.deleteVideo(currentOrgId, currentProjectId, videoId);
      
      // Update state
      setSubmissions(prev => prev.filter(submission => submission.id !== videoId));
      
      console.log('✅ Video deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete video:', error);
      alert('Failed to delete video. Please try again.');
    }
  }, [user, currentOrgId, currentProjectId, videoToDelete]);

  const handleBulkDelete = useCallback(async (videoIds: string[]) => {
    if (!user || !currentOrgId || !currentProjectId) return;
    
    const count = videoIds.length;
    console.log(`🗑️ [BULK DELETE] Starting deletion of ${count} videos`);
    
    // Delete all videos in parallel
    const deletePromises = videoIds.map(async (videoId) => {
      try {
        await FirestoreDataService.deleteVideo(currentOrgId, currentProjectId, videoId);
        console.log(`✅ Deleted video: ${videoId}`);
      } catch (error) {
        console.error(`❌ Failed to delete video ${videoId}:`, error);
        throw error; // Re-throw to handle in the bulk operation
      }
    });
    
    try {
      await Promise.all(deletePromises);
      
      // Update state to remove all deleted videos
      setSubmissions(prev => prev.filter(submission => !videoIds.includes(submission.id)));
      
      console.log(`✅ [BULK DELETE] Successfully deleted ${count} videos`);
    } catch (error) {
      console.error('❌ [BULK DELETE] Some videos failed to delete:', error);
      // Still update state to remove successfully deleted videos
      setSubmissions(prev => prev.filter(submission => !videoIds.includes(submission.id)));
      throw error; // Re-throw to show error to user
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
    const allSections = ['video-slider', 'kpi-cards', 'posting-activity', 'top-performers', 'tracked-accounts', 'videos-table'];
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
    const allSections = ['video-slider', 'kpi-cards', 'posting-activity', 'top-performers', 'tracked-accounts', 'videos-table'];
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
          'engagementRate', 'link-clicks'
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

    // Period-bound totals via the same helper the live KPI cards and
    // the unified chart use — keeps the editor preview in sync with
    // what the user sees on the dashboard. Lifetime sums (the prior
    // implementation) over-counted because they ignored the date
    // filter and double-counted post-period growth.
    const dr = DateFilterService.getDateRange(dateFilter, customDateRange, submissions);
    const totals = computeKPITotals(filteredSubmissions, dr.startDate, dr.endDate, orgDefaultReportingView);
    const totalViews = totals.views;
    const totalLikes = totals.likes;
    const totalComments = totals.comments;
    const totalShares = totals.shares;
    const totalVideos = totals.videos;
    const totalAccounts = totals.accounts;
    const totalEngagement = totalLikes + totalComments + totalShares;
    const engagementRate = totals.engagement;
    
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
      'link-clicks': {
        value: totalLinkClicks.toString(),
        sparklineData: totalLinkClicks > 0 ? generateMiniSparkline(totalLinkClicks) : generateMiniSparkline(0, true),
        accent: 'violet' as const,
        delta: totalLinkClicks > 0 ? { value: 14.8, isPositive: true } : undefined
      }
    };
  }, [filteredSubmissions, filteredLinkClicks, dateFilter, customDateRange, submissions, orgDefaultReportingView]);

  // Define Top Performers subsection options
  const topPerformersSubsectionOptions = useMemo(() => [
    { id: 'top-videos', label: 'Top New Videos', description: 'Videos uploaded during the selected period', icon: Video },
    { id: 'top-accounts', label: 'Top Accounts', description: 'Best performing accounts', icon: AtSign },
    { id: 'top-gainers', label: 'Top Refreshed Videos', description: 'Old videos with highest growth during the period', icon: TrendingUp },
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
      { id: 'video-slider', label: 'Video Slider', description: 'Full-height video carousel sorted by views', icon: Video, category: 'sections' as const },
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
      'engagementRate', 'link-clicks'
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
    <div className="min-h-screen bg-surface relative">
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

      {/* Paywall Overlay - Triggered on specific actions */}
      {showPaywall && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-surface/90 backdrop-blur-xl" />
          <div className="relative z-10 min-h-full flex flex-col items-center justify-start py-8 sm:py-12 px-4">
            {/* Close button */}
            <button
              onClick={() => setShowPaywall(false)}
              className="fixed top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-surface-secondary hover:bg-surface-hover border border-border rounded-full flex items-center justify-center text-content-muted hover:text-content transition-colors z-30 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            {paywallContext && (
              <p className="text-sm mb-6 text-content-secondary capitalize">Upgrade <span className="text-orange-500 font-semibold">{paywallContext}</span></p>
            )}
            <div className="w-full max-w-6xl">
              <PaywallOverlay isActive={true} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Blur when paywall active */}
      <div className={showPaywall ? 'filter blur-sm pointer-events-none' : ''}>
      
      {/* Account Filter Banner - Shows when filtering by specific account (only when 1 account selected AND on dashboard tab) */}
      {activeTab === 'dashboard' && selectedAccountIds.length === 1 && (() => {
        const filteredAccount = trackedAccounts.find(acc => acc.id === selectedAccountIds[0]);
        if (!filteredAccount) return null;
        
        const topOffset = 'top-0';
        
        return (
          <div className={clsx(
            'fixed right-0 z-30 transition-all duration-300 bg-surface-inset border-b border-border',
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
                        className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover ring-2 ring-border"
                      />
                    ) : (
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-surface-secondary flex items-center justify-center ring-2 ring-border">
                        <Users className="w-5 h-5 md:w-6 md:h-6 text-content-muted" />
                      </div>
                    )}
                    {/* Verified Badge - Twitter Blue Checkmark */}
                    {filteredAccount.isVerified && (
                      <div className="absolute -bottom-0.5 -right-0.5">
                        <img 
                          src="/verified-badge.png" 
                          alt="Verified" 
                          className="w-4 h-4 md:w-5 md:h-5"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Account Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm md:text-base font-semibold text-content truncate">
                        {filteredAccount.displayName || filteredAccount.username}
                      </h3>
                      <span className="text-xs md:text-sm text-content-muted">@{filteredAccount.username}</span>
                    </div>
                    <div className="flex items-center gap-3 md:gap-4 mt-0.5 text-[11px] md:text-xs text-content-muted flex-wrap">
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
                        className="flex items-center gap-1 hover:text-content-secondary transition-colors group"
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
                
                {/* View on Platform Button */}
                <a
                  href={getPlatformProfileUrl(filteredAccount.platform, filteredAccount.username)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-surface-hover hover:bg-surface-active border border-border hover:border-border-strong rounded-xl text-content hover:text-content transition-all group"
                >
                  <PlatformIcon platform={filteredAccount.platform} className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">
                    View on {getPlatformDisplayName(filteredAccount.platform)}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </a>
                
                {/* Close Button */}
                <button
                  onClick={() => {
                    setAccountFilterId(null);
                    setSelectedAccountIds([]);
                    navigate('/dashboard');
                  }}
                  className="flex-shrink-0 p-1.5 md:p-2 hover:bg-surface-hover rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5 text-content-muted hover:text-content-secondary" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* Fixed Header */}
      <header className={clsx(
        'fixed right-0 bg-surface-secondary border-b border-border z-20 transition-all duration-300',
        'px-3 sm:px-4 md:px-6 py-3 md:py-4', // Responsive padding
        {
          'left-0 md:left-64': !isSidebarCollapsed, // Full width on mobile, adjust for sidebar on desktop
          'left-0 md:left-16': isSidebarCollapsed,
          'top-0': activeTab !== 'dashboard' || selectedAccountIds.length !== 1,
          'top-[68px]': activeTab === 'dashboard' && selectedAccountIds.length === 1, // Push down for account banner
        }
      )}>
        <div className="flex items-center justify-between w-full gap-2 md:gap-4">
          {/* Left Section: Hamburger + Title + Back Button */}
          <div className="flex items-center space-x-2 md:space-x-4 flex-1 min-w-0">
            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 hover:bg-surface-hover rounded-lg transition-colors flex-shrink-0"
            >
              <svg className="w-6 h-6 text-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            {activeTab === 'accounts' && accountsViewMode === 'details' && (
              <button
                onClick={() => accountsPageRef.current?.handleBackToTable()}
                className="p-2 hover:bg-surface-hover rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-content" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-content truncate">
                {activeTab === 'dashboard' && (isEditingLayout ? 'EDIT MODE' : 'Dashboard')}
                {activeTab === 'accounts' && 'Tracked Accounts'}
                {activeTab === 'videos' && 'Videos'}
                {activeTab === 'subscription' && 'Subscription Plans'}
                {activeTab === 'analytics' && 'Tracked Links'}
                {activeTab === 'creators' && 'Creators'}
                {activeTab === 'campaigns' && 'Campaigns'}
                {activeTab === 'viral' && 'Viral Content'}
                {activeTab === 'saved' && 'Saved Content'}
                {activeTab === 'team' && 'Team Members'}
                {activeTab === 'openclaw' && 'API Keys'}
                {activeTab === 'extension' && 'Extension'}
                {activeTab === 'cron' && 'Cron Jobs'}
                {activeTab === 'settings' && 'Settings'}
              </h1>
              {activeTab !== 'analytics' && (
                <p className="hidden sm:block text-xs md:text-sm text-content-muted mt-1 truncate">
                  {activeTab === 'dashboard' && isEditingLayout && 'Drag sections around to make your unique dashboard'}
                  {activeTab === 'accounts' && 'Monitor entire Instagram and TikTok accounts'}
                  {activeTab === 'videos' && 'View and manage all tracked videos'}
                  {activeTab === 'subscription' && 'Choose the perfect plan to scale your tracking'}
                  {activeTab === 'creators' && 'Manage and discover content creators'}
                  {activeTab === 'team' && 'Manage your team and invite new members'}
                  {activeTab === 'campaigns' && 'Create and manage creator campaigns with rewards'}
                  {activeTab === 'viral' && 'Discover trending content across platforms'}
                  {activeTab === 'saved' && 'Your bookmarked viral videos organized in folders'}
                  {activeTab === 'extension' && 'Supercharge your workflow with our browser extension'}
                  {activeTab === 'openclaw' && (<>Create and manage API keys. <a href="/api-docs" className="text-orange-500 hover:text-orange-600 underline underline-offset-2">Explore our docs</a></>)}
                  {activeTab === 'cron' && 'Manage automated video refreshes'}
                  {activeTab === 'settings' && 'Configure your preferences'}
                </p>
              )}
            </div>
          </div>
          {activeTab === 'settings' && (
            <button
              onClick={() => setIsSignOutModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-content-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-border"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="font-medium">Sign Out</span>
            </button>
          )}
          {activeTab === 'dashboard' && (
            <div data-spotlight="filters" className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              {!isEditingLayout ? (
                <>
                  {/* Mobile Filter Button - Shows on small screens, opens modal */}
                  <button
                    onClick={() => setIsMobileFiltersOpen(true)}
                    className="lg:hidden p-2 bg-surface-secondary text-content rounded-lg border border-border hover:border-border-strong transition-all relative"
                    title="Filters"
                  >
                    <Filter className="w-4 h-4" />
                    {(selectedAccountIds.length > 0 || dashboardPlatformFilter.length > 0 || activeRulesCount > 0) && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-surface"></span>
                    )}
                  </button>

                  {/* All filters aligned to the right */}
                  {/* Accounts Filter - Hide on mobile */}
                  <div className="hidden lg:block">
                  {(() => {
                    // accountId → creatorId. The public-portal pipeline can write
                    // creatorLinks docs with synthetic ids like "creatorShare:<token>"
                    // alongside the real ones, so the same accountId may appear in
                    // multiple links. Prefer a real userId; only fall back to a
                    // synthetic id if no real link exists for that account.
                    const isSyntheticCreatorId = (cid: string) =>
                      !cid ||
                      cid.startsWith('creatorShare:') ||
                      cid.startsWith('cron:') ||
                      cid === 'system' ||
                      cid === 'api';
                    const accountToCreator = new Map<string, string>();
                    for (const link of creatorLinks) {
                      const existing = accountToCreator.get(link.accountId);
                      if (!existing) {
                        accountToCreator.set(link.accountId, link.creatorId);
                      } else if (isSyntheticCreatorId(existing) && !isSyntheticCreatorId(link.creatorId)) {
                        accountToCreator.set(link.accountId, link.creatorId);
                      }
                    }

                    // Lookup tables for resolving a creatorId → name / photo.
                    const creatorById = new Map(creators.map(c => [c.id, c]));
                    const memberByUserId = new Map(creatorMembers.map(m => [m.userId, m]));

                    // Only build groups for creatorIds that an account actually links to,
                    // and that resolve to a real account on the current trackedAccounts list.
                    const trackedAccountIds = new Set(trackedAccounts.map(a => a.id));
                    const creatorIdsInUse = new Set<string>();
                    for (const [accountId, creatorId] of accountToCreator) {
                      if (trackedAccountIds.has(accountId)) creatorIdsInUse.add(creatorId);
                    }

                    // Per-creator: find the profile pic of their linked Instagram
                    // account first (highest-fidelity, branded). Fall back to the
                    // creator/member photoURL if they don't have an Instagram.
                    const accountById = new Map(trackedAccounts.map(a => [a.id, a]));
                    const accountIdsByCreator = new Map<string, string[]>();
                    for (const link of creatorLinks) {
                      if (!accountIdsByCreator.has(link.creatorId)) accountIdsByCreator.set(link.creatorId, []);
                      accountIdsByCreator.get(link.creatorId)!.push(link.accountId);
                    }
                    const preferredAvatarFor = (creatorId: string): string | undefined => {
                      const accountIds = accountIdsByCreator.get(creatorId) || [];
                      for (const id of accountIds) {
                        const a = accountById.get(id);
                        if (a && a.platform === 'instagram' && a.profilePicture) return a.profilePicture;
                      }
                      return undefined;
                    };

                    const ORPHAN_GROUP_ID = '__unknown_creator__';
                    let hasOrphan = false;
                    const groups: { id: string; label: string; avatar?: string; count?: number }[] = [];
                    for (const creatorId of creatorIdsInUse) {
                      const profile = creatorById.get(creatorId);
                      const member = memberByUserId.get(creatorId);
                      const label = profile?.displayName || member?.displayName || member?.email;
                      const avatar = preferredAvatarFor(creatorId) || profile?.photoURL || member?.photoURL;
                      if (label) {
                        groups.push({
                          id: creatorId,
                          label,
                          avatar,
                          count: accountActivityCounts.byCreatorId.get(creatorId) || 0,
                        });
                      } else {
                        hasOrphan = true;
                      }
                    }
                    if (hasOrphan) {
                      groups.push({ id: ORPHAN_GROUP_ID, label: 'Unknown creator', count: 0 });
                    }

                    // For accounts whose creatorId exists but didn't resolve, route them to
                    // the orphan group so they don't fall into the "ungrouped" loose section.
                    const resolvedCreatorIds = new Set(groups.map(g => g.id));

                    return (
                      <MultiSelectDropdown
                        options={trackedAccounts.map(account => {
                          const creatorId = accountToCreator.get(account.id);
                          let groupId: string | undefined;
                          if (creatorId) {
                            groupId = resolvedCreatorIds.has(creatorId) ? creatorId : ORPHAN_GROUP_ID;
                          }
                          return {
                            id: account.id,
                            label: account.displayName || `@${account.username}`,
                            avatar: account.profilePicture,
                            platform: account.platform,
                            groupId,
                            count: accountActivityCounts.byAccountId.get(account.id) || 0,
                          };
                        })}
                        selectedIds={selectedAccountIds}
                        onChange={setSelectedAccountIds}
                        placeholder="All Accounts"
                        groups={groups}
                        sortByCount
                        dimNonPosters
                        collapsibleGroups
                        triggerVariant="creators-posted"
                      />
                    );
                  })()}
                  </div>

                  {/* Labels Filter — multi-select pill. Filters videos to those whose
                      creator carries one of the selected labels (UGC/Influencer/Faceless
                      or any custom label). Hidden when the project has no labels yet. */}
                  {creatorLabels.length > 0 && (
                    <div className="relative hidden sm:block">
                      <button
                        onClick={() => setLabelDropdownOpen(o => !o)}
                        onBlur={() => setTimeout(() => setLabelDropdownOpen(false), 200)}
                        className="flex items-center gap-2 pl-3 pr-8 py-2 bg-surface-secondary text-content rounded-lg text-xs sm:text-sm font-medium border border-border hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-border-strong transition-all cursor-pointer min-w-[110px] sm:min-w-[140px]"
                        title={selectedLabelIds.length === 0
                          ? 'All Labels'
                          : creatorLabels.filter(l => selectedLabelIds.includes(l.id)).map(l => l.name).join(', ')}
                      >
                        {selectedLabelIds.length === 0 ? (
                          <span>All Labels</span>
                        ) : selectedLabelIds.length === 1 ? (
                          (() => {
                            const l = creatorLabels.find(x => x.id === selectedLabelIds[0]);
                            return l
                              ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${getLabelColorClass(l.color)}`}>{l.name}</span>
                              : <span>1 Label</span>;
                          })()
                        ) : (
                          <span>{selectedLabelIds.length} Labels</span>
                        )}
                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-content-muted" />
                      </button>

                      {labelDropdownOpen && (
                        <div className="absolute top-full mt-1 w-56 bg-surface-tertiary border border-border rounded-lg shadow-xl overflow-hidden z-50">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedLabelIds([]); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-content-muted hover:text-content hover:bg-surface-hover transition-colors border-b border-border-subtle"
                          >
                            <span>Clear All</span>
                          </button>
                          {creatorLabels.map(label => {
                            const isSelected = selectedLabelIds.includes(label.id);
                            return (
                              <button
                                key={label.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLabelIds(prev =>
                                    isSelected ? prev.filter(id => id !== label.id) : [...prev, label.id]
                                  );
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-content hover:bg-surface-hover transition-colors"
                              >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'bg-content border-content' : 'border-border-strong'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 text-content-inverse" strokeWidth={3} />}
                                </div>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${getLabelColorClass(label.color)}`}>
                                  {label.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Platform Filter - Multi-select - Hide text on mobile */}
                  <div className="relative hidden sm:block">
                    <button
                      onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
                      onBlur={() => setTimeout(() => setPlatformDropdownOpen(false), 200)}
                      className="flex items-center gap-2 pl-2 sm:pl-3 pr-6 sm:pr-8 py-2 bg-surface-secondary text-content rounded-lg text-xs sm:text-sm font-medium border border-border hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-border-strong transition-all cursor-pointer min-w-[100px] sm:min-w-[140px]"
                      title={dashboardPlatformFilter.length === 0 ? 'All Platforms' : dashboardPlatformFilter.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                    >
                      {dashboardPlatformFilter.length === 0 ? (
                        <span>All Platforms</span>
                      ) : dashboardPlatformFilter.length === 1 ? (
                        <>
                          <PlatformIcon platform={dashboardPlatformFilter[0] as 'instagram' | 'tiktok' | 'youtube' | 'twitter'} size="sm" />
                          <span className="capitalize">{dashboardPlatformFilter[0] === 'twitter' ? 'X' : dashboardPlatformFilter[0]}</span>
                        </>
                      ) : (
                        <span>{dashboardPlatformFilter.length} Platforms</span>
                      )}
                      <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-content-muted" />
                    </button>
                    
                    {platformDropdownOpen && (
                      <div className="absolute top-full mt-1 w-56 bg-surface-tertiary border border-border rounded-lg shadow-xl overflow-hidden z-50">
                        {/* Clear All */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDashboardPlatformFilter([]);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-content-muted hover:text-content hover:bg-surface-hover transition-colors border-b border-border-subtle"
                        >
                          <span>Clear All</span>
                        </button>
                        
                        {/* Platform Options */}
                        {[
                          { value: 'instagram' as const, label: 'Instagram', icon: 'instagram' as const },
                          { value: 'tiktok' as const, label: 'TikTok', icon: 'tiktok' as const },
                          { value: 'youtube' as const, label: 'YouTube', icon: 'youtube' as const },
                          { value: 'twitter' as const, label: 'X', icon: 'twitter' as const }
                        ].map((platform) => {
                          const isSelected = dashboardPlatformFilter.includes(platform.value);
                          return (
                            <button
                              key={platform.value}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDashboardPlatformFilter(prev => 
                                  isSelected 
                                    ? prev.filter(p => p !== platform.value)
                                    : [...prev, platform.value]
                                );
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-content hover:bg-surface-hover transition-colors"
                            >
                              {/* Checkbox */}
                              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                isSelected 
                                  ? 'bg-content border-content' 
                                  : 'border-border-strong'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-content-inverse" strokeWidth={3} />}
                              </div>
                              
                              {/* Platform Icon */}
                              <PlatformIcon platform={platform.icon} size="sm" />
                              
                              {/* Platform Label */}
                              <span>{platform.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Granularity Selector - Dropdown - Hide on small screens */}
                  <div className="relative hidden md:block">
                    <select
                      value={granularity}
                      onChange={(e) => setManualGranularity(e.target.value as 'day' | 'week' | 'month' | 'year')}
                      className="appearance-none pl-3 pr-8 py-2 bg-surface-secondary text-content rounded-lg text-sm font-medium border border-border hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-border-strong transition-all cursor-pointer"
                    >
                      <option value="day" className="bg-surface-tertiary">Daily</option>
                      <option value="week" className="bg-surface-tertiary">Weekly</option>
                      <option value="month" className="bg-surface-secondary">Monthly</option>
                      <option value="year" className="bg-surface-secondary">Yearly</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-content-muted pointer-events-none" />
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
                    className="hidden lg:block relative p-2 bg-surface-secondary text-content rounded-lg border border-border hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-border-strong transition-all cursor-pointer"
                    title={activeRulesCount === 0 ? 'All Videos' : `${activeRulesCount} rule${activeRulesCount > 1 ? 's' : ''} applied`}
                  >
                    <Filter className="w-4 h-4" />
                    {activeRulesCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full border-2 border-surface">
                        {activeRulesCount}
                      </span>
                    )}
                  </button>
                  
                  {/* Share Project Button - brutalist primary (Hidden in demo/view-as mode) */}
                  {!isOverrideMode && currentOrgId && currentProjectId && (
                    <button
                      onClick={() => setIsShareProjectModalOpen(true)}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all bg-orange-500 text-white shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px]"
                      title="Share this project publicly"
                    >
                      <Share2 className="w-4 h-4" />
                      <span className="hidden md:inline">Share</span>
                    </button>
                  )}

                  {/* Edit Layout Button - Icon Only (Hidden in demo/view-as mode and on mobile) */}
                  {!isOverrideMode && (
                  <button
                    onClick={() => setIsEditingLayout(true)}
                    className="hidden sm:block p-2 rounded-lg transition-all bg-surface-secondary text-content border border-border hover:border-border-strong"
                    title="Customize dashboard layout"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  )}
                </>
               ) : (
                 <>
                   {/* Edit Mode Controls */}
                   <button
                     onClick={() => setIsCardEditorOpen(true)}
                     className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-orange-500 text-white shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px]"
                     title="Add or remove dashboard cards"
                   >
                     <Plus className="w-4 h-4" />
                     Add Item
                   </button>
                   
                   <button
                     onClick={() => {
                       const defaultOrder = ['video-slider', 'kpi-cards', 'posting-activity', 'top-performers', 'videos-table', 'tracked-accounts'];
                       const defaultVisibility: Record<string, boolean> = {
                         'kpi-cards': true,
                         'top-performers': true,
                         'posting-activity': false,
                         'tracked-accounts': false,
                         'videos-table': true,
                         'video-slider': true
                       };
                       setDashboardSectionOrder(defaultOrder);
                       setDashboardSectionVisibility(defaultVisibility);
                       localStorage.setItem('dashboardSectionOrder', JSON.stringify(defaultOrder));
                       localStorage.setItem('dashboardSectionVisibility', JSON.stringify(defaultVisibility));
                       if (user && currentOrgId) {
                         DashboardPreferencesService.saveUserPreferences(currentOrgId, user.uid, {
                           dashboardSectionOrder: defaultOrder,
                           dashboardSectionVisibility: defaultVisibility
                         });
                       }
                     }}
                     className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-orange-500 text-white shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px]"
                     title="Reset dashboard layout to defaults"
                   >
                     <RotateCcw className="w-4 h-4" />
                     Reset to Default
                   </button>

                   <button
                     onClick={() => setIsEditingLayout(false)}
                     className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-surface-secondary text-content border border-border shadow-[0_2px_0_0_var(--border)] hover:shadow-[0_1px_0_0_var(--border)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px]"
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
                className="sm:hidden p-2 bg-surface-hover text-content rounded-lg border border-border hover:border-border-strong transition-all backdrop-blur-sm relative"
                title="Filters"
              >
                <Filter className="w-4 h-4" />
                {(dashboardPlatformFilter.length > 0 || activeRulesCount > 0) && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-surface"></span>
                )}
              </button>

              {/* Search Bar - Responsive width */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-muted w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={accountsSearchQuery}
                  onChange={(e) => setAccountsSearchQuery(e.target.value)}
                  className="pl-10 pr-2 sm:pr-4 py-2 w-24 sm:w-40 md:w-64 border border-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent bg-surface-tertiary text-content"
                />
              </div>
              
              {/* Platform Filter - Multi-select - Hidden on mobile */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
                  onBlur={() => setTimeout(() => setPlatformDropdownOpen(false), 200)}
                  className="flex items-center gap-2 pl-3 pr-8 py-2 bg-surface-hover text-content rounded-lg text-sm font-medium border border-border hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-border-strong transition-all cursor-pointer backdrop-blur-sm min-w-[140px]"
                  title={dashboardPlatformFilter.length === 0 ? 'All Platforms' : dashboardPlatformFilter.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                >
                  {dashboardPlatformFilter.length === 0 ? (
                    <span>All Platforms</span>
                  ) : dashboardPlatformFilter.length === 1 ? (
                    <>
                      <PlatformIcon platform={dashboardPlatformFilter[0] as 'instagram' | 'tiktok' | 'youtube' | 'twitter'} size="sm" />
                      <span className="capitalize">{dashboardPlatformFilter[0] === 'twitter' ? 'X' : dashboardPlatformFilter[0]}</span>
                    </>
                  ) : (
                    <span>{dashboardPlatformFilter.length} Platforms</span>
                  )}
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-content-muted" />
                </button>
                
                {platformDropdownOpen && (
                  <div className="absolute top-full mt-1 w-56 bg-surface-tertiary border border-border rounded-lg shadow-xl overflow-hidden z-50">
                    {/* Clear All */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDashboardPlatformFilter([]);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-content-muted hover:text-content hover:bg-surface-hover transition-colors border-b border-border-subtle"
                    >
                      <span>Clear All</span>
                    </button>
                    
                    {/* Platform Options */}
                    {[
                      { value: 'instagram' as const, label: 'Instagram', icon: 'instagram' as const },
                      { value: 'tiktok' as const, label: 'TikTok', icon: 'tiktok' as const },
                      { value: 'youtube' as const, label: 'YouTube', icon: 'youtube' as const },
                      { value: 'twitter' as const, label: 'X', icon: 'twitter' as const }
                    ].map((platform) => {
                      const isSelected = dashboardPlatformFilter.includes(platform.value);
                      return (
                        <button
                          key={platform.value}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDashboardPlatformFilter(prev => 
                              isSelected 
                                ? prev.filter(p => p !== platform.value)
                                : [...prev, platform.value]
                            );
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-content hover:bg-surface-hover transition-colors"
                        >
                          {/* Checkbox */}
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                            isSelected 
                              ? 'bg-content border-content' 
                              : 'border-border-strong'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-content-inverse" strokeWidth={3} />}
                          </div>
                          
                          {/* Platform Icon */}
                          <PlatformIcon platform={platform.icon} size="sm" />
                          
                          {/* Platform Label */}
                          <span>{platform.label}</span>
                        </button>
                      );
                    })}
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
                className="hidden sm:block relative p-2 bg-surface-hover text-content rounded-lg border border-border hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-border-strong transition-all cursor-pointer backdrop-blur-sm"
                title={activeRulesCount === 0 ? 'All Videos' : `${activeRulesCount} rule${activeRulesCount > 1 ? 's' : ''} applied`}
              >
                <Filter className="w-4 h-4" />
                {activeRulesCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full border-2 border-surface">
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
                className="lg:hidden p-2 bg-surface-hover text-content rounded-lg border border-border hover:border-border-strong transition-all backdrop-blur-sm relative"
                title="Filters"
              >
                <Filter className="w-4 h-4" />
                {(selectedAccountIds.length > 0 || dashboardPlatformFilter.length > 0 || activeRulesCount > 0) && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-surface"></span>
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
              
              {/* Platform Filter - Multi-select - Hide on mobile */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
                  onBlur={() => setTimeout(() => setPlatformDropdownOpen(false), 200)}
                  className="flex items-center gap-2 pl-3 pr-8 py-2 bg-surface-hover text-content rounded-lg text-sm font-medium border border-border hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-border-strong transition-all cursor-pointer backdrop-blur-sm min-w-[140px]"
                  title={dashboardPlatformFilter.length === 0 ? 'All Platforms' : dashboardPlatformFilter.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                >
                  {dashboardPlatformFilter.length === 0 ? (
                    <span>All Platforms</span>
                  ) : dashboardPlatformFilter.length === 1 ? (
                    <>
                      <PlatformIcon platform={dashboardPlatformFilter[0] as 'instagram' | 'tiktok' | 'youtube' | 'twitter'} size="sm" />
                      <span className="capitalize">{dashboardPlatformFilter[0] === 'twitter' ? 'X' : dashboardPlatformFilter[0]}</span>
                    </>
                  ) : (
                    <span>{dashboardPlatformFilter.length} Platforms</span>
                  )}
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-content-muted" />
                </button>
                
                {platformDropdownOpen && (
                  <div className="absolute top-full mt-1 w-56 bg-surface-tertiary border border-border rounded-lg shadow-xl overflow-hidden z-50">
                    {/* Clear All */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDashboardPlatformFilter([]);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-content-muted hover:text-content hover:bg-surface-hover transition-colors border-b border-border-subtle"
                    >
                      <span>Clear All</span>
                    </button>
                    
                    {/* Platform Options */}
                    {[
                      { value: 'instagram' as const, label: 'Instagram', icon: 'instagram' as const },
                      { value: 'tiktok' as const, label: 'TikTok', icon: 'tiktok' as const },
                      { value: 'youtube' as const, label: 'YouTube', icon: 'youtube' as const },
                      { value: 'twitter' as const, label: 'X', icon: 'twitter' as const }
                    ].map((platform) => {
                      const isSelected = dashboardPlatformFilter.includes(platform.value);
                      return (
                        <button
                          key={platform.value}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDashboardPlatformFilter(prev => 
                              isSelected 
                                ? prev.filter(p => p !== platform.value)
                                : [...prev, platform.value]
                            );
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-content hover:bg-surface-hover transition-colors"
                        >
                          {/* Checkbox */}
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                            isSelected 
                              ? 'bg-content border-content' 
                              : 'border-border-strong'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-content-inverse" strokeWidth={3} />}
                          </div>
                          
                          {/* Platform Icon */}
                          <PlatformIcon platform={platform.icon} size="sm" />
                          
                          {/* Platform Label */}
                          <span>{platform.label}</span>
                        </button>
                      );
                    })}
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
                className="hidden lg:block relative p-2 bg-surface-hover text-content rounded-lg border border-border hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-border-strong transition-all cursor-pointer backdrop-blur-sm"
                title={activeRulesCount === 0 ? 'All Videos' : `${activeRulesCount} rule${activeRulesCount > 1 ? 's' : ''} applied`}
              >
                <Filter className="w-4 h-4" />
                {activeRulesCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full border-2 border-surface">
                    {activeRulesCount}
                  </span>
                )}
              </button>
            </div>
          )}
          {activeTab === 'analytics' && (
            <div className="flex items-center space-x-4">
              {/* Link Filter Dropdown */}
              <select
                value={linkFilter}
                onChange={(e) => setLinkFilter(e.target.value)}
                className="px-4 py-2 bg-surface-tertiary text-content rounded-lg border border-border-strong hover:bg-surface-hover transition-colors text-sm font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
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
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Search bar — mirrors the Accounts tab header. Filters the
                  creators list by display name, email, or any linked @handle. */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-muted w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={creatorsSearchQuery}
                  onChange={(e) => setCreatorsSearchQuery(e.target.value)}
                  className="pl-10 pr-2 sm:pr-4 py-2 w-24 sm:w-40 md:w-64 border border-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent bg-surface-tertiary text-content"
                />
              </div>
              <DateRangeFilter
                selectedFilter={creatorsDateFilter}
                onFilterChange={(filter) => setCreatorsDateFilter(filter)}
              />
            </div>
          )}
        </div>
      </header>

      {/* Main Content with dynamic margins for sidebar and header */}
      <main data-spotlight="main-content" className={clsx(
        'overflow-auto min-h-screen transition-all duration-300',
        {
          'pt-16 md:pt-24': activeTab !== 'dashboard' || selectedAccountIds.length !== 1, // Default top padding
          'pt-[9rem] md:pt-[10rem]': activeTab === 'dashboard' && selectedAccountIds.length === 1, // Extra padding for account banner
          'ml-0 md:ml-64': !isSidebarCollapsed, // No left margin on mobile
          'ml-0 md:ml-16': isSidebarCollapsed,
        }
      )} style={{ overflowX: 'hidden', overflowY: 'auto' }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-8" style={{ overflow: 'visible' }}>
          {/* Dashboard Tab - Only render when active to prevent unnecessary calculations */}
          {activeTab === 'dashboard' && (
            <>
            <div>
              {/* Empty State - Show ONLY when absolutely NO accounts AND NO videos exist in org (not just filtered) */}
              {!loadingDashboard && totalAccountsInOrg === 0 && totalVideosInOrg === 0 && (
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
              
              {/* Dashboard Content - Show when there's ANY data in org (even if filtered out) */}
              {(totalAccountsInOrg > 0 || totalVideosInOrg > 0) && (
              <div>
              {/* Render dashboard sections in order */}
              {(() => {
                const baseVisible = dashboardSectionOrder.filter(
                  sectionId => dashboardSectionVisibility[sectionId] !== false
                );
                // Only the KPI cards section is replaced by the unified chart.
                // Posting-activity and top-performers are separate components and
                // stay visible in both modes.
                const HIDE_IN_UNIFIED = new Set(['kpi-cards']);
                const finalOrder =
                  dashboardViewMode === 'unified'
                    ? (() => {
                        // Unified mode: drop the breakdown graphs and SWAP the
                        // KPI-cards slot for the unified chart so other sections
                        // (video slider, tables, etc.) keep their relative
                        // position. Fall back to the top if KPI cards aren't in
                        // the order for some reason.
                        const kpiIdx = baseVisible.indexOf('kpi-cards');
                        const result: string[] = [];
                        baseVisible.forEach((id) => {
                          if (id === 'kpi-cards') {
                            result.push('unified-metrics');
                            return;
                          }
                          if (HIDE_IN_UNIFIED.has(id)) return;
                          result.push(id);
                        });
                        if (kpiIdx === -1 && !result.includes('unified-metrics')) {
                          result.unshift('unified-metrics');
                        }
                        return result;
                      })()
                    : baseVisible;
                // The view-mode toggle. Stable key so it doesn't unmount when
                // the chart slot swaps between kpi-cards and unified-metrics.
                // Sleek full-width hairline with the centered pill sitting on top.
                const viewToggle = (
                  <motion.div
                    key="view-toggle"
                    layout
                    className="relative mt-6 mb-3"
                  >
                    {/* Full-width hairline */}
                    <div
                      aria-hidden
                      className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
                      style={{
                        background:
                          'linear-gradient(to right, transparent 0%, var(--border) 12%, var(--border) 88%, transparent 100%)',
                      }}
                    />
                    {/* Pill sits on the line */}
                    <div className="relative flex items-center justify-center">
                      <div
                        className="inline-flex items-center gap-1 rounded-full p-1 bg-surface border border-border-subtle shadow-sm"
                        style={{ backdropFilter: 'blur(6px)' }}
                      >
                        {(
                          [
                            { id: 'classic' as const, label: 'KPI Cards' },
                            { id: 'unified' as const, label: 'Unified Chart' },
                          ]
                        ).map(opt => {
                          const active = dashboardViewMode === opt.id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => {
                                if (opt.id === dashboardViewMode) return;
                                if (opt.id === 'unified') {
                                  setIsMergingToUnified(true);
                                  setTimeout(() => setIsMergingToUnified(false), 1500);
                                }
                                setDashboardViewMode(opt.id);
                                localStorage.setItem('dashboardViewMode', opt.id);
                              }}
                              className={clsx(
                                'relative px-4 py-1.5 text-xs font-semibold rounded-full transition-colors',
                                active ? 'text-white' : 'text-content-muted hover:text-content'
                              )}
                            >
                              {active && (
                                <motion.span
                                  layoutId="dashboard-view-toggle-pill"
                                  className="absolute inset-0 rounded-full"
                                  style={{ backgroundColor: '#fb8a4a' }}
                                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                />
                              )}
                              <span className="relative z-10">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                );

                const rendered: React.ReactNode[] = [];
                finalOrder.forEach((sectionId, index) => {
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
                    // Show skeleton while INITIAL page/auth is loading (before any data)
                    if (!tabDataReady.dashboard || isInitialLoading) {
                      return <DashboardSkeleton height={sectionId === 'kpi-cards' ? 'h-48' : 'h-96'} />;
                    }

                    // Show data-loading skeletons while ALL video data is being fetched
                    // The page shell is visible, but KPI/chart sections show placeholders
                    if (!dataFullyLoaded) {
                      switch (sectionId) {
                        case 'kpi-cards':
                          return <KPICardsSkeleton />;
                        case 'video-slider':
                          return <VideoSliderSkeleton />;
                        case 'top-performers':
                          return <ChartSkeleton height="h-96" />;
                        case 'posting-activity':
                          return <ChartSkeleton height="h-80" />;
                        case 'unified-metrics':
                          return <ChartSkeleton height="h-96" />;
                        case 'videos-table':
                          return <VideoTableSkeleton />;
                        default:
                          // tracked-accounts and other sections show the generic skeleton
                          return <DashboardSkeleton height="h-96" />;
                      }
                    }

                    switch (sectionId) {
                      case 'kpi-cards':
                        return (
                          <div data-spotlight="kpi-cards">
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
                            orgDefaultReportingView={orgDefaultReportingView}
                            onVideoClick={handleVideoClick}
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
                          </div>
                        );
                      case 'video-slider':
                        console.log('🎬 VideoSlider section rendering with', combinedSubmissions.length, 'filtered videos');
                        return (
                          <div data-spotlight="video-slider">
                          <VideoSliderSection
                            videos={combinedSubmissions}
                            onVideoClick={handleVideoClick}
                          />
                          </div>
                        );
                      case 'top-performers':
                        {
                          const topPerformersDateRange = DateFilterService.getDateRange(dateFilter, customDateRange, submissions);
                          return (
                            <TopPerformersSection
                              submissions={filteredSubmissions}
                              onVideoClick={handleVideoClick}
                              onAccountClick={handleAccountClick}
                              onCreatorRowClick={handleCreatorRowClick}
                              onPlatformClick={handlePlatformClick}
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
                              dateFilter={dateFilter}
                              customRange={customDateRange}
                            />
                          );
                        }
                      case 'posting-activity':
                        return (
                          <PostingActivityHeatmap
                            submissions={filteredSubmissions}
                            onVideoClick={handleVideoClick}
                            dateFilter={dateFilter}
                            customDateRange={customDateRange}
                          />
                        );
                      case 'unified-metrics': {
                        const unifiedDateRange = DateFilterService.getDateRange(dateFilter, customDateRange, submissions);
                        return (
                          <UnifiedMetricsChart
                            submissions={filteredSubmissions}
                            allSubmissions={submissionsWithoutDateFilter}
                            linkClicks={filteredLinkClicks}
                            revenueByDate={revenueByDate}
                            revenueByDateByOption={revenueByDateByOption}
                            pendingRevenueKeys={pendingRevenueKeys}
                            revenueOptions={SUPERWALL_METRICS.map(m => ({ key: m.key, label: m.label, valueType: m.valueType }))}
                            selectedRevenueOptions={selectedRevenueMetrics}
                            onRevenueOptionsChange={(keys) => {
                              const next = (keys.length > 0 ? keys : ['grossRevenue']) as SuperwallMetricKey[];
                              setSelectedRevenueMetrics(next);
                              // First option drives the single-fetch effect
                              // (which feeds revenueByDate / KPI summaries) so
                              // the rest of the page stays consistent.
                              setSelectedRevenueMetric(next[0]);
                            }}
                            dateFilter={dateFilter}
                            granularity={granularity}
                            dateRange={unifiedDateRange}
                            onVideoClick={handleVideoClick}
                            isMerging={isMergingToUnified}
                            isLoading={!dataFullyLoaded || revenueLoading}
                            orgDefaultReportingView={orgDefaultReportingView}
                          />
                        );
                      }
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
                            organizationId={currentOrgId || undefined}
                            projectId={currentProjectId || undefined}
                            isDemoMode={isDemoMode}
                          />
                        );
                      case 'videos-table':
                        // Only show "Track Your First Video" when org has NO videos at all
                        // If videos exist but are filtered out, show a different message
                        return totalVideosInOrg === 0 ? (
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
                        ) : combinedSubmissions.length === 0 ? (
                          <div className="bg-surface-secondary/60 backdrop-blur rounded-2xl border border-border p-12 text-center">
                            <Video className="w-12 h-12 text-content-muted mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-content mb-2">No videos match your filters</h3>
                            <p className="text-content-muted text-sm">Try adjusting the date range or clearing some filters to see your videos.</p>
                          </div>
                        ) : (
                          <VideoSubmissionsTable
                            submissions={combinedSubmissions}
                            onDelete={handleDelete}
                            onBulkDelete={handleBulkDelete}
                            onVideoClick={handleVideoClick}
                            onAssignCreator={(videoIds, accountIds, label) => setBulkAssignCreatorState({ isOpen: true, videoIds, accountIds, label })}
                            onRefreshVideo={isSuperAdmin ? handleRefreshVideo : undefined}
                            onBulkRefresh={isSuperAdmin ? handleBulkRefreshVideos : undefined}
                            onToggleStale={handleToggleStale}
                            onBulkToggleStale={handleBulkToggleStale}
                            isSuperAdmin={isSuperAdmin}
                            headerTitle={getVideoTableHeader(dateFilter)}
                            trendPeriodDays={getTrendPeriodDays(dateFilter)}
                          />
                        );
                      default:
                        return null;
                    }
                  };
                  
                  // Only sections that can actually toggle visibility need the
                  // overflow-clip wrapper for the height-collapse exit. Always-on
                  // sections (like the video slider) stay with overflow:visible
                  // so their carousel/peek thumbs don't get clipped.
                  const canCollapse = HIDE_IN_UNIFIED.has(sectionId) || sectionId === 'unified-metrics';
                  const isChartSlot = sectionId === 'kpi-cards' || sectionId === 'unified-metrics';

                  // Render the view toggle directly above whichever slot
                  // the chart occupies, so it always sits with the graph.
                  if (isChartSlot) rendered.push(viewToggle);

                  rendered.push(
                    <motion.div
                      key={sectionId}
                      layout
                      initial={{ opacity: 0, y: 12, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={canCollapse ? {
                        opacity: 0,
                        scale: 0.85,
                        height: 0,
                        marginTop: 0,
                        filter: 'blur(4px)',
                      } : { opacity: 0 }}
                      transition={{
                        duration: 0.45,
                        ease: [0.22, 1, 0.36, 1],
                        opacity: { duration: 0.3 },
                      }}
                      style={canCollapse ? { overflow: 'hidden' } : undefined}
                      // No top margin if the toggle was just rendered above us.
                      className={index > 0 && !isChartSlot ? 'mt-6' : ''}
                    >
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
                    </motion.div>
                  );
                });
                return <AnimatePresence mode="popLayout" initial={false}>{rendered}</AnimatePresence>;
              })()}

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
            </div>
            </>
          )}

          {/* Accounts Tab */}
          {activeTab === 'accounts' && (
            <div data-spotlight="content-accounts">
            {(!isDemoMode && (!tabDataReady.accounts || isInitialLoading)) ? (
              <div className="space-y-4">
                {/* Loading skeleton for accounts */}
                <div className="bg-surface-secondary rounded-xl shadow-sm border border-border overflow-hidden">
                  <div className="p-6 space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 animate-pulse">
                        <div className="w-12 h-12 bg-surface-tertiary rounded-full"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-surface-tertiary rounded w-1/4"></div>
                          <div className="h-3 bg-surface-tertiary rounded w-1/3"></div>
                        </div>
                        <div className="flex gap-4">
                          <div className="h-8 w-20 bg-surface-tertiary rounded"></div>
                          <div className="h-8 w-20 bg-surface-tertiary rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
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
              isDemoMode={isDemoMode}
            />
            )}
          </div>)}

          {/* Videos Tab */}
          {activeTab === 'videos' && (
            <div data-spotlight="content-videos">
            {(!isDemoMode && (!tabDataReady.videos || isInitialLoading)) ? (
              <div className="space-y-4">
                {/* Loading skeleton for videos */}
                <div className="bg-surface-secondary rounded-xl shadow-sm border border-border overflow-hidden">
                  <div className="p-6 space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 animate-pulse">
                        <div className="w-24 h-16 bg-surface-tertiary rounded-lg"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-surface-tertiary rounded w-3/4"></div>
                          <div className="h-3 bg-surface-tertiary rounded w-1/2"></div>
                        </div>
                        <div className="flex gap-4">
                          <div className="h-8 w-16 bg-surface-tertiary rounded"></div>
                          <div className="h-8 w-16 bg-surface-tertiary rounded"></div>
                          <div className="h-8 w-16 bg-surface-tertiary rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : !loadingDashboard && totalVideosInOrg === 0 ? (
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
            ) : combinedSubmissions.length === 0 ? (
              <div className="bg-surface-secondary/60 backdrop-blur rounded-2xl border border-border p-12 text-center">
                <Video className="w-12 h-12 text-content-muted mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-content mb-2">No videos match your filters</h3>
                <p className="text-content-muted text-sm">Try adjusting the date range or clearing some filters to see your videos.</p>
              </div>
            ) : (
              <VideoSubmissionsTable
                submissions={combinedSubmissions}
                onDelete={handleDelete}
                onBulkDelete={handleBulkDelete}
                onVideoClick={handleVideoClick}
                onAssignCreator={(videoIds, accountIds, label) => setBulkAssignCreatorState({ isOpen: true, videoIds, accountIds, label })}
                onRefreshVideo={isSuperAdmin ? handleRefreshVideo : undefined}
                onBulkRefresh={isSuperAdmin ? handleBulkRefreshVideos : undefined}
                onToggleStale={handleToggleStale}
                onBulkToggleStale={handleBulkToggleStale}
                isSuperAdmin={isSuperAdmin}
                headerTitle={getVideoTableHeader(dateFilter)}
                trendPeriodDays={getTrendPeriodDays(dateFilter)}
              />
            )}
          </div>)}

          {/* Subscription Tab */}
          {activeTab === 'subscription' && <SubscriptionPage />}

          {/* Extension Tab - Locked */}
          {activeTab === 'extension' && (
            <ComingSoonLocked 
              title="Extensions"
              description="Powerful browser extensions and integrations are on the way. Soon you'll be able to track and manage content directly from social media platforms."
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
              onRequiresPaidPlan={requiresPaidPlan}
            />
          )}

          {/* Creators Tab */}
          {activeTab === 'creators' && (
            <div data-spotlight="content-creators">
              <CreatorsManagementPage dateFilter={creatorsDateFilter} searchQuery={creatorsSearchQuery} organizationId={currentOrgId || undefined} projectId={currentProjectId || undefined} onRequiresPaidPlan={requiresPaidPlan} />
            </div>
          )}

          {/* Campaigns Tab */}
          {activeTab === 'campaigns' && (
            <CampaignsManagementPage />
          )}

          {/* Viral Content Tab */}
          {activeTab === 'viral' && <div data-spotlight="content-viral"><ViralContentPage onRequiresPaidPlan={planTier === 'free' && !isDemoMode ? requiresPaidPlan : undefined} /></div>}

          {/* Saved Viral Content Tab */}
          {activeTab === 'saved' && <div data-spotlight="content-saved"><SavedViralPage /></div>}

          {/* Open Claw - API Keys Tab */}
          {activeTab === 'openclaw' && (
            <div data-spotlight="content-openclaw">
              <ApiManagementPage onRequiresPaidPlan={requiresPaidPlan} />
            </div>
          )}

          {/* Team Members Tab */}
          {activeTab === 'team' && <TeamManagementPage onRequiresPaidPlan={requiresPaidPlan} />}

          {/* Other Tabs - Placeholder */}
          {!['dashboard', 'accounts', 'videos', 'subscription', 'settings', 'analytics', 'creators', 'campaigns', 'cron', 'team', 'invitations', 'extension', 'viral', 'saved', 'openclaw'].includes(activeTab) && (
            <div className="bg-surface-secondary rounded-xl shadow-sm border border-border p-12 text-center">
              <div className="w-16 h-16 bg-surface-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚧</span>
              </div>
              <h3 className="text-lg font-medium text-content mb-2">Coming Soon</h3>
              <p className="text-content-muted">
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
            // ✅ Open account modal right here (no navigation needed)
            setIsAddAccountModalOpen(true);
          }
          }, 100);
        }}
      />

      <AddVideoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddVideo={handleAddVideosWithAccounts}
        showCreatorSelector
      />

      <AddAccountModal
        isOpen={isAddAccountModalOpen}
        onClose={() => setIsAddAccountModalOpen(false)}
        onAdd={handleAddAccounts}
        usageLimits={usageLimits}
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
          onDelete={handleVideoDeleted}
          totalCreatorVideos={totalCreatorVideos}
          orgId={currentOrgId}
          projectId={currentProjectId}
          onVideoUpdate={(videoId, patch) => {
            // Merge spark/freeze patches into the cached submissions
            // array so a subsequent reopen of this video sees the
            // updated state without a full Firestore reload.
            setSubmissions(prev =>
              prev.map(s => (s.id === videoId ? { ...s, ...patch } : s))
            );
          }}
        />
      )}

      {/* Delete Video Confirmation Modal */}
      {showDeleteVideoModal && videoToDelete && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md border border-border shadow-2xl">
            {/* Header */}
            <div className="px-6 py-5 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </div>
                  <h2 className="text-xl font-bold text-content">Delete Video</h2>
                </div>
                <button
                  onClick={() => {
                    setShowDeleteVideoModal(false);
                    setVideoToDelete(null);
                  }}
                  className="p-2 hover:bg-surface-active rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-content-muted" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <p className="text-content-muted text-sm mb-3">
                Are you sure you want to delete this video?
              </p>
              <p className="text-content-muted text-xs mb-4">
                <span className="text-content font-medium">
                  {videoToDelete.title || videoToDelete.caption || 'Untitled video'}
                </span>
              </p>
              <p className="text-content-muted text-xs">
                This action cannot be undone. The video will be permanently removed from your account.
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteVideoModal(false);
                  setVideoToDelete(null);
                }}
                className="px-6 py-2.5 text-content-muted hover:text-content hover:bg-surface-hover rounded-full transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteVideo}
                className="px-6 py-2.5 bg-red-500 text-white rounded-full font-semibold shadow-[0_2px_0_0_#b91c1c] hover:shadow-[0_1px_0_0_#b91c1c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all"
              >
                Delete Video
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* KPI Card Editor Sidebar */}
      <KPICardEditorSidebar
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

          // Show data-loading skeletons while ALL video data is being fetched
          if (!dataFullyLoaded) {
            if (sectionId === 'kpi-cards') return <KPICardsSkeleton />;
            if (sectionId === 'video-slider') return <VideoSliderSkeleton />;
            if (sectionId === 'top-performers') return <ChartSkeleton height="h-96" />;
            if (sectionId === 'posting-activity') return <ChartSkeleton height="h-80" />;
            if (sectionId === 'videos-table') return <VideoTableSkeleton />;
            return <DashboardSkeleton height="h-96" />;
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
                  orgDefaultReportingView={orgDefaultReportingView}
                  onVideoClick={handleVideoClick}
                  isEditMode={false}
                  cardOrder={kpiCardOrder}
                  cardVisibility={kpiCardVisibility}
                  onReorder={() => {}}
                  onToggleCard={() => {}}
                />
              );
            case 'video-slider':
              console.log('🎬 VideoSlider PREVIEW rendering with', combinedSubmissions.length, 'filtered videos');
              return (
                <VideoSliderSection
                  videos={combinedSubmissions}
                  onVideoClick={handleVideoClick}
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
                    onCreatorRowClick={handleCreatorRowClick}
                    onPlatformClick={handlePlatformClick}
                    onHeatmapCellClick={() => {}}
                    subsectionVisibility={topPerformersSubsectionVisibility}
                    isEditMode={false}
                    onToggleSubsection={handleToggleCard}
                    granularity={granularity}
                    dateRange={topPerformersDateRangePreview}
                    dateFilter={dateFilter}
                    customRange={customDateRange}
                  />
                );
              }
            case 'posting-activity':
              return (
                <PostingActivityHeatmap 
                  submissions={filteredSubmissions}
                  onVideoClick={handleVideoClick}
                  dateFilter={dateFilter}
                  customDateRange={customDateRange}
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
                <div className="bg-surface-secondary rounded-lg p-4 border border-border">
                  <h3 className="text-lg font-semibold text-content mb-4">Tracked Accounts</h3>
                  <div className="text-content-muted text-sm">
                    <div className="grid grid-cols-5 gap-4 pb-2 border-b border-border font-semibold mb-2">
                      <div>Account</div>
                      <div>Platform</div>
                      <div>Followers</div>
                      <div>Posts</div>
                      <div>Engagement</div>
                    </div>
                    {trackedAccounts.slice(0, 3).map((account, i) => (
                      <div key={i} className="grid grid-cols-5 gap-4 py-2 border-b border-border-subtle">
                        <div className="text-content">@{account.username}</div>
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
              return totalVideosInOrg === 0 ? (
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
              ) : combinedSubmissions.length === 0 ? (
                <div className="bg-surface-secondary/60 backdrop-blur rounded-2xl border border-border p-8 text-center">
                  <Video className="w-10 h-10 text-content-muted mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-content mb-1">No videos match filters</h3>
                  <p className="text-content-muted text-xs">Adjust filters to see videos.</p>
                </div>
              ) : (
                <VideoSubmissionsTable
                  submissions={combinedSubmissions.slice(0, 5)}
                  onDelete={() => {}}
                  onBulkDelete={async () => {}}
                  onVideoClick={handleVideoClick}
                  onRefreshVideo={isSuperAdmin ? handleRefreshVideo : undefined}
                  isSuperAdmin={isSuperAdmin}
                  headerTitle={getVideoTableHeader(dateFilter)}
                  trendPeriodDays={getTrendPeriodDays(dateFilter)}
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
                  dateFilter={dateFilter}
                  customRange={customDateRange}
                  orgDefaultReportingView={orgDefaultReportingView}
                />
              );

            case 'top-accounts':
              return (
                <TopPerformersRaceChart
                  submissions={filteredSubmissions}
                  onVideoClick={handleVideoClick}
                  onAccountClick={handleAccountClick}
                  type="accounts"
                  dateFilter={dateFilter}
                  customRange={customDateRange}
                  orgDefaultReportingView={orgDefaultReportingView}
                />
              );

            case 'top-gainers':
              return (
                <TopPerformersRaceChart
                  submissions={filteredSubmissions}
                  onVideoClick={handleVideoClick}
                  onAccountClick={handleAccountClick}
                  type="gainers"
                  dateFilter={dateFilter}
                  customRange={customDateRange}
                  orgDefaultReportingView={orgDefaultReportingView}
                />
              );
            
            case 'posting-times': {
              // Snapshot-aware per-video metrics for the selected period — the
              // raw `video.views/likes/...` fields are LIFETIME totals and would
              // overstate every cell. `computePerVideoMetricInRange` returns the
              // delta credited to this period (matching the KPI cards / unified
              // chart). `excludeSparked: true` drops paid views from the views
              // metric to match the dashboard's organic reporting mode.
              const heatmapDateRange = DateFilterService.getDateRange(dateFilter, customDateRange, submissions);
              return (
                <div className="rounded-2xl bg-surface-secondary/60 backdrop-blur border border-border-subtle p-6">
                  <h3 className="text-xl font-bold text-content mb-1">Best Posting Times</h3>
                  <p className="text-sm text-content-muted mb-4">Engagement by day & hour</p>
                  <HeatmapByHour
                    data={filteredSubmissions.map(video => {
                      const periodViews = computePerVideoMetricInRange(video, 'views', heatmapDateRange.startDate, heatmapDateRange.endDate, { excludeSparked: true });
                      const periodLikes = computePerVideoMetricInRange(video, 'likes', heatmapDateRange.startDate, heatmapDateRange.endDate, { excludeSparked: true });
                      const periodComments = computePerVideoMetricInRange(video, 'comments', heatmapDateRange.startDate, heatmapDateRange.endDate, { excludeSparked: true });
                      const periodShares = computePerVideoMetricInRange(video, 'shares', heatmapDateRange.startDate, heatmapDateRange.endDate, { excludeSparked: true });
                      return {
                        timestamp: video.uploadDate || video.dateSubmitted,
                        views: periodViews,
                        likes: periodLikes,
                        comments: periodComments,
                        shares: periodShares,
                        videos: [{
                          id: video.id,
                          title: video.title || video.caption || 'Untitled',
                          thumbnailUrl: video.thumbnail,
                          views: periodViews,
                        }]
                      };
                    })}
                    metric="views"
                    onCellClick={() => {}}
                  />
                </div>
              );
            }
            
            case 'top-creators':
              return (
                <TopTeamCreatorsList
                  submissions={filteredSubmissions}
                  onCreatorClick={handleAccountClick}
                  onCreatorRowClick={handleCreatorRowClick}
                  dateFilter={dateFilter}
                  customRange={customDateRange}
                />
              );
            
            case 'top-platforms':
              return (
                <div className="rounded-2xl bg-surface-secondary/60 backdrop-blur border border-border-subtle p-6">
                  <TopPlatformsRaceChart
                    submissions={filteredSubmissions}
                    dateFilter={dateFilter}
                    customRange={customDateRange}
                    onPlatformClick={handlePlatformClick}
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
                  dateFilter={dateFilter}
                  onVideoClick={handleVideoClick}
                />
              );

            default:
              return <div className="text-content-muted text-sm">Preview not available</div>;
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
        creatorDisplayName={selectedCreatorDisplayName}
        platformFilter={selectedPlatformFilter}
        dateRangeLabel={getDateFilterLabel(dateFilter)}
        dayOfWeek={(window as any).__heatmapDayOfWeek}
        hourRange={(window as any).__heatmapHourRange}
        onVideoClick={handleVideoClick}
        onDelete={handleDelete}
        selectedPeriodRange={(() => {
          // Always resolve the broader period for the modal — without this,
          // the modal's cap collapses to "interval.endDate" (= the clicked
          // bucket's end) and credits in-bucket uploads only with their
          // first-day snapshot value, not their full at-period-end value.
          // Used to be a conditional that only fired for custom ranges, so
          // 'last7days' / 'last30days' etc. silently broke the cap math.
          const r = DateFilterService.getDateRange(dateFilter, customDateRange, combinedSubmissions);
          return r.startDate ? { startDate: r.startDate, endDate: r.endDate } : undefined;
        })()}
        revenueByDate={revenueByDate}
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
              <label className="block text-sm font-semibold text-content mb-2">
                Rule Name
              </label>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g., High Engagement Posts"
                className="w-full px-4 py-3 border border-border-strong rounded-lg bg-surface-secondary text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-content">
                  Conditions
                </label>
                <button
                  onClick={addCondition}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-content-muted hover:bg-surface-active rounded-lg transition-colors"
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
                          className="px-3 py-1 text-sm border border-border-strong rounded-lg bg-surface-secondary text-content focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex gap-2 items-start p-3 border border-border-strong rounded-lg bg-surface-secondary/50">
                        <select
                          value={condition.type}
                          onChange={(e) => updateCondition(condition.id, 'type', e.target.value as RuleConditionType)}
                          className="flex-1 px-3 py-2 border border-border-strong rounded-lg bg-surface-secondary text-content focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                          className="flex-1 px-3 py-2 border border-border-strong rounded-lg bg-surface-secondary text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                        <label className="flex items-center gap-2 px-3 text-sm text-content-muted cursor-pointer hover:text-content">
                          <input
                            type="checkbox"
                            checked={condition.caseSensitive || false}
                            onChange={(e) => updateCondition(condition.id, 'caseSensitive', e.target.checked)}
                            className="w-4 h-4 rounded border-border bg-surface-secondary text-content focus:ring-2 focus:ring-border-strong focus:ring-offset-0"
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
            <div className="p-4 bg-surface-hover border border-border rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-content" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-content mb-1">
                    Available to All Accounts
                  </h4>
                  <p className="text-xs text-content-secondary">
                    This rule will be available for filtering across all tracked accounts and platforms.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-border-strong">
              <button
                onClick={() => setShowCreateRuleForm(false)}
                className="flex-1 px-4 py-2 bg-orange-500 text-white font-bold rounded-lg border-2 border-black shadow-[3px_3px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all"
              >
                Back
              </button>
              <button
                onClick={handleSaveRule}
                disabled={!ruleName.trim() || conditions.filter(c => c.value !== '').length === 0}
                className="flex-1 px-4 py-2 bg-orange-500 text-white font-bold rounded-lg border-2 border-black shadow-[3px_3px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_0_#000]"
              >
                Create Rule
              </button>
            </div>
          </div>
        ) : allRules.length === 0 ? (
          <div className="text-center py-12">
            <Filter className="w-12 h-12 text-content-muted mx-auto mb-3" />
            <p className="text-content-muted mb-4">No tracking rules created yet</p>
            <button
              onClick={handleShowCreateForm}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all"
            >
              Create Your First Rule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-content-muted">
                Select multiple rules to filter videos. Videos matching ANY selected rule will be shown.
              </p>
              {activeRulesCount > 0 && (
                <button
                  onClick={() => {
                    console.log('🗑️ Clear All clicked - removing all selections');
                    setSelectedRuleIds([]);
                  }}
                  className="text-xs text-content-muted hover:text-content transition-colors"
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
                          : 'bg-surface-secondary/50 border-border-strong hover:border-border'
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
                          <Circle className="w-4 h-4 text-content-muted group-hover:text-content-secondary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={clsx(
                            "text-sm font-medium truncate",
                            isSelected ? "text-content" : "text-content-muted"
                          )}>
                            {rule.name}
                          </span>
                          {rule.conditions.length > 0 && (
                            <span className="text-xs text-content-muted flex-shrink-0">
                              {rule.conditions.length} condition{rule.conditions.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {rule.description && (
                          <p className="text-xs text-content-muted truncate mt-0.5">{rule.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="pt-4 border-t border-border-strong flex items-center justify-between">
              <button
                onClick={handleShowCreateForm}
                className="px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-lg border-2 border-black shadow-[3px_3px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all"
              >
                Create New Rule →
              </button>
              <button
                onClick={handleCloseRuleModal}
                className="px-4 py-2 bg-surface-secondary text-content border border-border rounded-lg shadow-[0_2px_0_0_var(--border)] hover:shadow-[0_1px_0_0_var(--border)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Context-Aware Floating Action Button — hidden for creators */}
      {activeTab !== 'settings' && activeTab !== 'subscription' && activeTab !== 'cron' && activeTab !== 'invitations' && activeTab !== 'creators' && userRole !== 'creator' && (
        <button
          onClick={isOverrideMode ? undefined : () => {
            // ✅ Show AddTypeSelector on dashboard, accounts, and videos tabs
            if (activeTab === 'dashboard' || activeTab === 'accounts' || activeTab === 'videos') {
              setIsTypeSelectorOpen(true);
            } else if (activeTab === 'analytics') {
              if (requiresPaidPlan('to create tracking links')) return;
              trackedLinksPageRef.current?.openCreateModal();
            } else if (activeTab === 'campaigns') {
              navigate('/campaigns/create');
            } else if (activeTab === 'team') {
              if (requiresPaidPlan('to invite team members')) return;
              const event = new CustomEvent('openInviteModal');
              window.dispatchEvent(event);
            }
          }}
          disabled={isOverrideMode}
          className={`fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50 flex items-center gap-2 px-5 py-3 rounded-xl transition-all ${
            isOverrideMode
              ? 'bg-surface-tertiary text-content-muted cursor-not-allowed opacity-60'
              : 'bg-orange-500 text-white shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]'
          }`}
          aria-label="Add"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-sm font-semibold">
            {isOverrideMode ? 'Viewing' :
              activeTab === 'dashboard' ? 'Add Account' :
              activeTab === 'accounts' ? 'Add Account' :
              activeTab === 'videos' ? 'Add Video' :
              activeTab === 'analytics' ? 'Add Link' :
              activeTab === 'creators' ? 'Add Creator' :
              activeTab === 'campaigns' ? 'New Campaign' :
              activeTab === 'viral' ? 'Add Content' :
              activeTab === 'team' ? 'Invite Member' :
              'Add'}
          </span>
        </button>
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
          <div className="relative bg-surface-tertiary border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-surface-tertiary border-b border-border px-4 py-3 flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold text-content">Filters</h3>
              <button
                onClick={() => setIsMobileFiltersOpen(false)}
                className="p-1 hover:bg-surface-active rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-content-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Filters Content */}
            <div className="p-4 space-y-6">
              {/* Accounts Filter - Only show for dashboard and videos tabs */}
              {(activeTab === 'dashboard' || activeTab === 'videos') && (
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-2">Accounts</label>
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

              {/* Platform Filter - Multi-select */}
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-2">Platform</label>
                <div className="space-y-2">
                  {/* Clear All Button */}
                  <button
                    onClick={() => setDashboardPlatformFilter([])}
                    className="w-full px-4 py-2 rounded-lg text-xs text-content-muted hover:text-content bg-surface-hover hover:bg-surface-active border border-border transition-all"
                  >
                    Clear All
                  </button>
                  
                  {/* Platform Options with Checkboxes */}
                  {[
                    { value: 'instagram' as const, label: 'Instagram', icon: 'instagram' as const },
                    { value: 'tiktok' as const, label: 'TikTok', icon: 'tiktok' as const },
                    { value: 'youtube' as const, label: 'YouTube', icon: 'youtube' as const },
                    { value: 'twitter' as const, label: 'X', icon: 'twitter' as const }
                  ].map((platform) => {
                    const isSelected = dashboardPlatformFilter.includes(platform.value);
                    return (
                      <button
                        key={platform.value}
                        onClick={() => {
                          setDashboardPlatformFilter(prev => 
                            isSelected 
                              ? prev.filter(p => p !== platform.value)
                              : [...prev, platform.value]
                          );
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm bg-surface-hover hover:bg-surface-active border border-border hover:border-border-strong transition-all"
                      >
                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                          isSelected 
                            ? 'bg-content border-content' 
                            : 'border-border-strong'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-content-inverse" strokeWidth={3} />}
                        </div>
                        
                        {/* Platform Icon */}
                        <PlatformIcon platform={platform.icon} size="sm" />
                        
                        {/* Platform Label */}
                        <span className="text-content">{platform.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Granularity Filter - Only show for dashboard tab */}
              {activeTab === 'dashboard' && (
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-2">Granularity</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setManualGranularity('day')}
                      className={`px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                        granularity === 'day' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                          : 'bg-surface-hover text-content border border-border hover:border-border-strong'
                      }`}
                    >
                      Daily
                    </button>
                    <button
                      onClick={() => setManualGranularity('week')}
                      className={`px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                        granularity === 'week' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                          : 'bg-surface-hover text-content border border-border hover:border-border-strong'
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      onClick={() => setManualGranularity('month')}
                      className={`px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                        granularity === 'month' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                          : 'bg-surface-hover text-content border border-border hover:border-border-strong'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setManualGranularity('year')}
                      className={`px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                        granularity === 'year' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                          : 'bg-surface-hover text-content border border-border hover:border-border-strong'
                      }`}
                    >
                      Yearly
                    </button>
                  </div>
                </div>
              )}

              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-2">Date Range</label>
                <DateRangeFilter
                  selectedFilter={dateFilter}
                  customRange={customDateRange}
                  onFilterChange={handleDateFilterChange}
                />
              </div>

              {/* Rules Filter */}
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-2">Rules</label>
                <button
                  onClick={() => {
                    setIsMobileFiltersOpen(false);
                    handleOpenRuleModal();
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-surface-secondary text-content rounded-lg text-sm font-medium border border-border shadow-[0_2px_0_0_var(--border)] hover:shadow-[0_1px_0_0_var(--border)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    {activeRulesCount === 0 ? 'All Videos' : `${activeRulesCount} rule${activeRulesCount > 1 ? 's' : ''} applied`}
                  </span>
                  <ChevronDown className="w-4 h-4 text-content-muted -rotate-90" />
                </button>
              </div>
            </div>

            {/* Footer with Reset button */}
            <div className="sticky bottom-0 bg-surface-tertiary border-t border-border px-4 py-3">
              <button
                onClick={() => {
                  // Reset filters based on active tab
                  if (activeTab === 'dashboard' || activeTab === 'videos') {
                    setSelectedAccountIds([]);
                    setManualGranularity('day');
                  }
                  setDashboardPlatformFilter([]);
                  setDateFilter('last7days');
                  setSelectedRuleIds([]);
                  localStorage.setItem('dashboardSelectedRuleIds', JSON.stringify([]));
                }}
                className="w-full px-4 py-2.5 bg-surface-secondary text-content rounded-lg text-sm font-medium border border-border shadow-[0_2px_0_0_var(--border)] hover:shadow-[0_1px_0_0_var(--border)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all"
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

      {/* Bulk Assign Creator Modal (from Videos table) */}
      <BulkAssignCreatorModal
        isOpen={bulkAssignCreatorState.isOpen}
        accountIds={bulkAssignCreatorState.accountIds}
        videoIds={bulkAssignCreatorState.videoIds}
        selectionLabel={bulkAssignCreatorState.label}
        onClose={() => setBulkAssignCreatorState({ isOpen: false, videoIds: [], accountIds: [], label: '' })}
        onSuccess={() => {
          setBulkAssignCreatorState({ isOpen: false, videoIds: [], accountIds: [], label: '' });
        }}
      />

      {bulkAddToast && (
        <Toast
          message={bulkAddToast.message}
          type={bulkAddToast.type}
          duration={bulkAddToast.type === 'error' ? 6000 : 4000}
          onClose={() => setBulkAddToast(null)}
        />
      )}

      {/* Share Project Modal */}
      {currentOrgId && currentProjectId && (
        <ShareProjectModal
          isOpen={isShareProjectModalOpen}
          onClose={() => setIsShareProjectModalOpen(false)}
          orgId={currentOrgId}
          projectId={currentProjectId}
          onToast={(message, type) => setBulkAddToast({ message, type })}
        />
      )}
    </div>
  );
}

export default DashboardPage;
