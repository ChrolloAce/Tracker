import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { clsx } from 'clsx';
import { 
  ArrowLeft, ChevronDown, Search, Filter, CheckCircle2, Circle, Plus, Trash2,
  Play, Heart, MessageCircle, Share2, Video, AtSign, Activity, DollarSign, Download, Link as LinkIcon, Edit2, RefreshCw,
  Users, Clock, TrendingUp, BarChart3
} from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import { Modal } from '../components/ui/Modal';
import { VideoSubmissionsTable } from '../components/VideoSubmissionsTable';
import { AddVideoModal } from '../components/AddVideoModal';
import { TikTokSearchModal } from '../components/TikTokSearchModal';
import KPICards from '../components/KPICards';
import { KPICardEditor } from '../components/KPICardEditor';
import { DraggableSection } from '../components/DraggableSection';
import DateRangeFilter, { DateFilterType } from '../components/DateRangeFilter';
import VideoAnalyticsModal from '../components/VideoAnalyticsModal';
import TopPerformersSection from '../components/TopPerformersSection';
import TopPerformersRaceChart from '../components/TopPerformersRaceChart';
import HeatmapByHour from '../components/HeatmapByHour';
import TopTeamCreatorsList from '../components/TopTeamCreatorsList';
import TopPlatformsRaceChart from '../components/TopPlatformsRaceChart';
import ComparisonGraph from '../components/ComparisonGraph';
import PostingActivityHeatmap from '../components/PostingActivityHeatmap';
import DayVideosModal from '../components/DayVideosModal';
import AccountsPage, { AccountsPageRef } from '../components/AccountsPage';
import SettingsPage from '../components/SettingsPage';
import SubscriptionPage from '../components/SubscriptionPage';
import CronManagementPage from '../components/CronManagementPage';
import TrackedLinksPage, { TrackedLinksPageRef } from '../components/TrackedLinksPage';
import CreatorPortalPage from '../components/CreatorPortalPage';
import CreatorsManagementPage, { CreatorsManagementPageRef } from '../components/CreatorsManagementPage';
import OrganizationService from '../services/OrganizationService';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import { PlatformIcon } from '../components/ui/PlatformIcon';
import { VideoSubmission, InstagramVideoData } from '../types';
import DateFilterService from '../services/DateFilterService';
import ThemeService from '../services/ThemeService';
import FirestoreDataService from '../services/FirestoreDataService';
import LinkClicksService, { LinkClick } from '../services/LinkClicksService';
import RulesService from '../services/RulesService';
import RevenueDataService from '../services/RevenueDataService';
import { RevenueMetrics, RevenueIntegration } from '../types/revenue';
import { cssVariables } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { Timestamp, collection, getDocs, onSnapshot, query, where, orderBy, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { fixVideoPlatforms } from '../services/FixVideoPlatform';
import { TrackedAccount } from '../types/firestore';
import { TrackingRule, RuleCondition, RuleConditionType } from '../types/rules';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

function DashboardPage() {
  // Get authentication state, current organization, and current project
  const { user, currentOrgId, currentProjectId } = useAuth();


  // State
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [linkClicks, setLinkClicks] = useState<LinkClick[]>([]);
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTikTokSearchOpen, setIsTikTokSearchOpen] = useState(false);
  
  // Loading/pending state for immediate UI feedback
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
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month' | 'year'>(() => {
    const saved = localStorage.getItem('dashboardGranularity');
    return (saved as 'day' | 'week' | 'month' | 'year') || 'day';
  });
  
  // Day Videos Modal state (for account clicks from race chart)
  const [isDayVideosModalOpen, setIsDayVideosModalOpen] = useState(false);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string | undefined>();
  const [dayVideosDate, setDayVideosDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState(() => {
    // Restore active tab from localStorage on mount
    const savedTab = localStorage.getItem('activeTab');
    return savedTab || 'dashboard';
  });
  const [isEditingLayout, setIsEditingLayout] = useState(false);
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
    // Default: all cards visible
    return {
      views: true,
      likes: true,
      comments: true,
      shares: true,
      videos: true,
      accounts: true,
      engagementRate: true,
      revenue: true,
      downloads: true,
      'link-clicks': true
    };
  });
  
  const [dashboardSectionOrder, setDashboardSectionOrder] = useState<string[]>(() => {
    const defaultOrder = ['kpi-cards', 'top-performers', 'top-platforms', 'posting-activity', 'tracked-accounts', 'videos-table'];
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
  
  // Accounts page state
  const [accountsDateFilter, setAccountsDateFilter] = useState<DateFilterType>(() => {
    const saved = localStorage.getItem('accountsDateFilter');
    return (saved as DateFilterType) || 'all';
  });
  const [accountsViewMode, setAccountsViewMode] = useState<'table' | 'details'>(() => {
    const saved = localStorage.getItem('accountsViewMode');
    return (saved as 'table' | 'details') || 'table';
  });
  const [accountsPlatformFilter, setAccountsPlatformFilter] = useState<'all' | 'instagram' | 'tiktok' | 'youtube'>(() => {
    const saved = localStorage.getItem('accountsPlatformFilter');
    return (saved as 'all' | 'instagram' | 'tiktok' | 'youtube') || 'all';
  });
  const [accountsSearchQuery, setAccountsSearchQuery] = useState('');
  const accountsPageRef = useRef<AccountsPageRef | null>(null);
  const trackedLinksPageRef = useRef<TrackedLinksPageRef | null>(null);
  const creatorsPageRef = useRef<CreatorsManagementPageRef | null>(null);

  // Dashboard platform filter state
  const [dashboardPlatformFilter, setDashboardPlatformFilter] = useState<'all' | 'instagram' | 'tiktok' | 'youtube'>(() => {
    const saved = localStorage.getItem('dashboardPlatformFilter');
    return (saved as 'all' | 'instagram' | 'tiktok' | 'youtube') || 'all';
  });
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);
  
  // Dashboard accounts filter state
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('dashboardSelectedAccountIds');
    return saved ? JSON.parse(saved) : [];
  });

  // Dashboard rule filter state - support multiple rule selection
  // Will be loaded from Firebase along with rules
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [rulesLoadedFromFirebase, setRulesLoadedFromFirebase] = useState(false);
  
  // Tracked Links search state
  const [linksSearchQuery, setLinksSearchQuery] = useState('');
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
    localStorage.setItem('dashboardSelectedAccountIds', JSON.stringify(selectedAccountIds));
  }, [selectedAccountIds]);

  // Save selected rules to Firestore (per user, per project)
  // Only save after initial load to avoid overwriting on mount
  useEffect(() => {
    if (!user || !currentOrgId || !currentProjectId || !rulesLoadedFromFirebase) return;
    
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
        
        await setDoc(userPrefsRef, {
          selectedRuleIds,
          updatedAt: new Date()
        }, { merge: true });
        
        console.log('✅ Saved selected rules to Firebase:', selectedRuleIds);
      } catch (error) {
        console.error('❌ Failed to save selected rules:', error);
      }
    };
    
    saveSelectedRules();
  }, [selectedRuleIds, user, currentOrgId, currentProjectId, rulesLoadedFromFirebase]);

  // Debug: Log when rules or selectedRuleIds change
  useEffect(() => {
    console.log('🔄 Rules or selection changed:');
    console.log('  - Selected Rule IDs:', selectedRuleIds);
    console.log('  - Available Rules:', allRules.length);
    console.log('  - Matched Rules:', allRules.filter(r => selectedRuleIds.includes(r.id)).length);
  }, [selectedRuleIds, allRules]);

  // Save accounts page filters to localStorage
  useEffect(() => {
    localStorage.setItem('accountsDateFilter', accountsDateFilter);
  }, [accountsDateFilter]);

  useEffect(() => {
    localStorage.setItem('accountsViewMode', accountsViewMode);
  }, [accountsViewMode]);

  useEffect(() => {
    localStorage.setItem('accountsPlatformFilter', accountsPlatformFilter);
  }, [accountsPlatformFilter]);

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
      } catch (error) {
        console.error('Failed to load user role:', error);
        setUserRole('member');
      }
    };
    
    loadUserRole();
  }, [user, currentOrgId]);

  // One-time data loading (no real-time listeners)
  useEffect(() => {
    if (!user || !currentOrgId || !currentProjectId) {
      return;
    }

    
    // Initialize theme
    ThemeService.initializeTheme();
    
    // Async IIFE to load all data (UI shows immediately with empty states)
    (async () => {
      // One-time load for tracked accounts
    const accountsRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts');
    const accountsQuery = query(accountsRef, orderBy('dateAdded', 'desc'));
    
    try {
      const accountsSnapshot = await getDocs(accountsQuery);
      const accounts: TrackedAccount[] = accountsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TrackedAccount));
      
      setTrackedAccounts(accounts);
    } catch (error) {
      console.error('❌ Failed to load accounts:', error);
    }
    
    // One-time load for videos
    const videosRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'videos');
    const videosQuery = query(videosRef, orderBy('dateAdded', 'desc'), limit(1000));
    
    try {
      const videosSnapshot = await getDocs(videosQuery);
      
      // Get current accounts for mapping
      const accounts = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
      const accountsMap = new Map(accounts.map(acc => [acc.id, acc]));
      
      // Get video IDs for snapshot fetching
      const videoIds = videosSnapshot.docs.map(doc => doc.id);
      
      // Fetch snapshots for all videos in parallel
      const snapshotsMap = await FirestoreDataService.getVideoSnapshotsBatch(
        currentOrgId, 
        currentProjectId, 
        videoIds
      );
      
      const allSubmissions: VideoSubmission[] = videosSnapshot.docs.map(doc => {
        const video = { id: doc.id, ...doc.data() } as any;
        const account = video.trackedAccountId ? accountsMap.get(video.trackedAccountId) : null;
        const snapshots = snapshotsMap.get(video.id) || [];
        
        // Load caption from Firestore fields - use actual field names from Firestore
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
      console.error('❌ Error loading videos:', error);
    }
    
    // One-time load for rules AND user's selected rules
    try {
      const rulesRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'rules');
      const rulesSnapshot = await getDocs(rulesRef);
      const rules = rulesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TrackingRule[];
      
      // Load user's selected rules from their preferences
      const userPrefsRef = doc(
        db, 
        'organizations', 
        currentOrgId, 
        'projects', 
        currentProjectId, 
        'userPreferences', 
        user.uid
      );
      const userPrefsDoc = await getDoc(userPrefsRef);
      const savedSelectedRuleIds = userPrefsDoc.exists() ? (userPrefsDoc.data()?.selectedRuleIds || []) : [];
      
      console.log('✅ Loaded rules:', rules.length);
      console.log('✅ Loaded selected rules from Firebase:', savedSelectedRuleIds);
      
      // Set both at the same time to avoid race conditions
      setAllRules(rules);
      setSelectedRuleIds(savedSelectedRuleIds);
      setRulesLoadedFromFirebase(true);
    } catch (error) {
      console.error('❌ Failed to load rules:', error);
    }
    
    // One-time load for link clicks
    try {
      const allClicks = await LinkClicksService.getProjectLinkClicks(currentOrgId, currentProjectId);
      setLinkClicks(allClicks);
    } catch (error) {
      console.error('❌ Failed to load link clicks:', error);
    }
    
    // Load revenue integrations (syncing will be handled by date filter effect)
    try {
      const integrations = await RevenueDataService.getAllIntegrations(currentOrgId, currentProjectId);
      setRevenueIntegrations(integrations);
      
      // Load existing metrics immediately (syncing will happen via date filter effect)
      if (integrations.some(i => i.enabled)) {
        const metrics = await RevenueDataService.getLatestMetrics(currentOrgId, currentProjectId);
        setRevenueMetrics(metrics);
      }
    } catch (error) {
      console.error('❌ Failed to load revenue data:', error);
    }
    
    })(); // End of async IIFE
  }, [user, currentOrgId, currentProjectId]); // Reload when project changes!

  // Auto-sync revenue data when date filters change
  useEffect(() => {
    if (!user || !currentOrgId || !currentProjectId) return;
    if (revenueIntegrations.length === 0 || !revenueIntegrations.some(i => i.enabled)) return;

    const syncRevenue = async () => {
      try {
        // Calculate date range based on current filter
        const range = DateFilterService.getDateRange(dateFilter, customDateRange);
        const startDate = range.startDate;
        const endDate = range.endDate;

        console.log(`🔄 Syncing revenue data for ${dateFilter}:`, { startDate, endDate });

        // Sync all integrations with the new date range
        await RevenueDataService.syncAllIntegrations(
          currentOrgId,
          currentProjectId,
          startDate,
          endDate
        );

        // Reload metrics after sync
        const metrics = await RevenueDataService.getLatestMetrics(currentOrgId, currentProjectId);
        setRevenueMetrics(metrics);

        console.log('✅ Revenue data synced for date range');
      } catch (error) {
        console.error('❌ Failed to sync revenue for date range:', error);
      }
    };

    syncRevenue();
  }, [user, currentOrgId, currentProjectId, dateFilter, customDateRange, revenueIntegrations]);

  // Smart sync monitoring - Auto-refresh when accounts finish syncing
  useEffect(() => {
    if (!user || !currentOrgId || !currentProjectId) return;


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
  }, [user, currentOrgId, currentProjectId]);

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
      if (activeTab === 'settings' || activeTab === 'subscription' || activeTab === 'cron' || activeTab === 'creators') {
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
    if (selectedRuleIds.length > 0) {
      const beforeRuleFilter = filtered.length;
      const selectedRules = allRules.filter(rule => selectedRuleIds.includes(rule.id));
      
      console.log(`🎯 Trying to apply ${selectedRuleIds.length} selected rule ID(s):`, selectedRuleIds);
      console.log(`📚 Found ${selectedRules.length} matching rules in allRules (${allRules.length} total)`);
      
      if (selectedRules.length > 0) {
        console.log(`📋 Applying ${selectedRules.length} specific rule(s)...`);
        const activeSelectedRules = selectedRules.filter(r => r.isActive);
        
        if (activeSelectedRules.length > 0) {
          filtered = filtered.filter(video => {
            // Check if video matches ANY of the selected rules (OR logic)
            const matches = activeSelectedRules.some(selectedRule => {
              const result = RulesService.checkVideoMatchesRule(video as any, selectedRule);
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
      // Apply default rules filtering for tracked accounts (all active rules)
      if (allRules.length > 0) {
        const beforeRulesFilter = filtered.length;
        const activeRules = allRules.filter(r => r.isActive);
        console.log(`📋 Applying ${activeRules.length} active rules...`);
        
        filtered = filtered.filter(video => {
          if (!video.uploaderHandle) return true; // Keep videos without uploader handle
          
          // Find the account for this video (match by both username AND platform)
          const account = trackedAccounts.find(
            acc => acc.username.toLowerCase() === video.uploaderHandle?.toLowerCase() &&
                   acc.platform === video.platform
          );
          
          if (!account) return true; // Keep videos without matching account
          
          // Get rules that apply to this account
          const accountRules = activeRules.filter(rule => {
            const { platforms, accountIds } = rule.appliesTo;
            
            // Check platform match
            const platformMatch = !platforms || platforms.length === 0 || platforms.includes(account.platform);
            
            // Check account match
            const accountMatch = !accountIds || accountIds.length === 0 || accountIds.includes(account.id);
            
            return platformMatch && accountMatch;
          });
          
          if (accountRules.length === 0) return true; // No rules = show all videos
          
          // Check if video matches any of the account's rules
          const matches = accountRules.some((rule: any) => 
            RulesService.checkVideoMatchesRule(video as any, rule).matches
          );
          
          return matches;
        });
        console.log(`✅ After default rules filter:`, filtered.length, `(removed ${beforeRulesFilter - filtered.length})`);
      }
    }
    
    console.log(`🎬 FINAL filtered count:`, filtered.length);
    console.log('─'.repeat(50));
    
    return filtered;
  }, [submissions, dashboardPlatformFilter, selectedAccountIds, trackedAccounts, allRules, selectedRuleIds, rulesFingerprint]);

  // Rules are loaded from Firebase along with selectedRuleIds, so no loading state needed
  const isLoadingRules = false;

  // Filter submissions based on date range, platform, and accounts (memoized to prevent infinite loops)
  const filteredSubmissions = useMemo(() => {
    console.log('📅 Applying date filter to rule-filtered submissions...');
    console.log('📊 Input (submissionsWithoutDateFilter):', submissionsWithoutDateFilter.length);
    console.log('📆 Date filter:', dateFilter);
    
    // Use strictMode: TRUE for display (Top Videos, Top Accounts, etc.)
    // This ensures only videos uploaded in the selected period are shown
    let filtered = DateFilterService.filterVideosByDateRange(
      submissionsWithoutDateFilter, 
      dateFilter, 
      customDateRange,
      true // strictMode: true = ONLY show videos uploaded in the period
    );
    
    console.log('✅ After date filter (STRICT):', filtered.length, `(removed ${submissionsWithoutDateFilter.length - filtered.length})`);
    console.log('🎯 These videos were UPLOADED in the selected date range');
    console.log('📋 Display components will show ONLY these videos');
    console.log('🔄 KPI Cards will use allSubmissions (with snapshots) for PP calculations');
    console.log('═'.repeat(50));
    
    return filtered;
  }, [submissionsWithoutDateFilter, dateFilter, customDateRange]);

  // Combine real submissions with pending videos for immediate UI feedback
  const combinedSubmissions = useMemo(() => {
    const combined = [...pendingVideos, ...filteredSubmissions];
    return combined;
  }, [pendingVideos, filteredSubmissions]);


  // Handle date filter changes
  const handleDateFilterChange = useCallback((filter: DateFilterType, customRange?: DateRange) => {
    setDateFilter(filter);
    setCustomDateRange(customRange);
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

  const handleStatusUpdate = useCallback(async (id: string, status: VideoSubmission['status']) => {
    if (!user || !currentOrgId) return;
    
    
    try {
      // Update in Firestore
      await FirestoreDataService.updateTrackedAccount(currentOrgId, currentProjectId!, id, {
        status: status === 'rejected' ? 'archived' : 'active'
      } as any);
      
      // Update state
      setSubmissions(prev => prev.map(submission => 
        submission.id === id ? { ...submission, status } : submission
      ));
      
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }, [user, currentOrgId]);

  const handleDelete = useCallback(async (id: string) => {
    if (!user || !currentOrgId) return;
    
    
    try {
      // Delete from Firestore (archive it)
      await FirestoreDataService.updateTrackedAccount(currentOrgId, currentProjectId!, id, {
        status: 'archived'
      } as any);
      
      // Update state
      setSubmissions(prev => prev.filter(submission => submission.id !== id));
      
    } catch (error) {
      console.error('Failed to delete video:', error);
    }
  }, [user, currentOrgId]);

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
    // Check if it's a section, a KPI card, or a Top Performers subsection
    const allSections = ['kpi-cards', 'top-performers', 'posting-activity', 'tracked-accounts', 'videos-table'];
    const topPerformersSubsections = ['top-videos', 'top-accounts', 'top-gainers', 'top-creators', 'posting-times', 'top-platforms', 'comparison'];
    
    if (allSections.includes(cardId)) {
      // It's a main section
      setDashboardSectionVisibility(prev => {
        const updated = { ...prev, [cardId]: !prev[cardId] };
        localStorage.setItem('dashboardSectionVisibility', JSON.stringify(updated));
        return updated;
      });
    } else if (topPerformersSubsections.includes(cardId)) {
      // It's a Top Performers subsection
      setTopPerformersSubsectionVisibility(prev => {
        const updated = { ...prev, [cardId]: !prev[cardId] };
        localStorage.setItem('topPerformersSubsectionVisibility', JSON.stringify(updated));
        return updated;
      });
    } else {
      // It's a KPI card
      setKpiCardVisibility(prev => {
        const updated = { ...prev, [cardId]: !prev[cardId] };
        localStorage.setItem('kpiCardVisibility', JSON.stringify(updated));
        return updated;
      });
    }
  }, []);

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
          'engagementRate', 'revenue', 'downloads', 'link-clicks'
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
        value: revenueMetrics ? `$${(revenueMetrics.mrr / 100).toFixed(0)}` : '$0',
        sparklineData: revenueMetrics && revenueMetrics.mrr > 0 
          ? generateMiniSparkline(revenueMetrics.mrr) 
          : generateMiniSparkline(0, true), // Force show graph even if 0
        accent: 'emerald' as const,
        delta: revenueMetrics && revenueMetrics.mrr > 0 ? { value: 18.5, isPositive: true } : undefined
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
  }, [filteredSubmissions, linkClicks, revenueMetrics]);

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
      { id: 'revenue', label: 'Revenue', description: 'Total revenue (MRR)', icon: DollarSign, category: 'kpi' as const },
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
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
      {/* Fixed Sidebar */}
      <Sidebar 
        onCollapsedChange={setIsSidebarCollapsed}
        initialCollapsed={isSidebarCollapsed}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      
      {/* Sidebar overlay when in edit mode */}
      {isEditingLayout && (
        <div className="fixed inset-y-0 left-0 w-64 bg-black/30 backdrop-blur-sm z-40 pointer-events-none" />
      )}
      
      {/* Fixed Header */}
      <header className={clsx(
        'fixed top-0 right-0 bg-white dark:bg-[#111111] border-b border-gray-200 dark:border-gray-800 px-6 py-4 z-20 transition-all duration-300',
        {
          'left-64': !isSidebarCollapsed,
          'left-16': isSidebarCollapsed,
        }
      )}>
        <div className="flex items-center justify-between w-full gap-4">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            {activeTab === 'accounts' && accountsViewMode === 'details' && (
              <button
                onClick={() => accountsPageRef.current?.handleBackToTable()}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
                {activeTab === 'dashboard' && (isEditingLayout ? 'EDIT MODE' : 'Dashboard')}
                {activeTab === 'accounts' && 'Tracked Accounts'}
                {activeTab === 'videos' && 'Videos'}
                {activeTab === 'subscription' && 'Subscription Plans'}
                {activeTab === 'analytics' && 'Tracked Links'}
                {activeTab === 'creators' && 'Creators'}
                {activeTab === 'cron' && 'Cron Jobs'}
                {activeTab === 'settings' && 'Settings'}
              </h1>
              {activeTab !== 'analytics' && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                  {activeTab === 'dashboard' && isEditingLayout && 'Drag sections around to make your unique dashboard'}
                  {activeTab === 'accounts' && 'Monitor entire Instagram and TikTok accounts'}
                  {activeTab === 'videos' && 'View and manage all tracked videos'}
                  {activeTab === 'subscription' && 'Choose the perfect plan to scale your tracking'}
                  {activeTab === 'creators' && 'Manage and discover content creators'}
                  {activeTab === 'cron' && 'Manage automated video refreshes'}
                  {activeTab === 'settings' && 'Configure your preferences'}
                </p>
              )}
            </div>
          </div>
          {activeTab === 'dashboard' && (
            <div className="flex items-center space-x-2 flex-shrink-0">
              {!isEditingLayout ? (
                <>
                  {/* All filters aligned to the right */}
                  {/* Accounts Filter */}
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
                  
                  {/* Platform Filter - Icon Based */}
                  <div className="relative">
                    <button
                      onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
                      onBlur={() => setTimeout(() => setPlatformDropdownOpen(false), 200)}
                      className="flex items-center gap-2 pl-3 pr-8 py-2 bg-white/5 dark:bg-white/5 text-white/90 rounded-lg text-sm font-medium border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm min-w-[140px]"
                      title={dashboardPlatformFilter === 'all' ? 'All Platforms' : dashboardPlatformFilter.charAt(0).toUpperCase() + dashboardPlatformFilter.slice(1)}
                    >
                      {dashboardPlatformFilter === 'all' ? (
                        <>
                          <div className="relative flex items-center" style={{ width: '20px', height: '16px' }}>
                            <div className="absolute left-0" style={{ zIndex: 3 }}>
                              <PlatformIcon platform="instagram" size="sm" />
                            </div>
                            <div className="absolute left-1.5" style={{ zIndex: 2 }}>
                              <PlatformIcon platform="tiktok" size="sm" />
                            </div>
                            <div className="absolute left-3" style={{ zIndex: 1 }}>
                              <PlatformIcon platform="youtube" size="sm" />
                            </div>
                          </div>
                          <span className="ml-2">All</span>
                        </>
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
                          <div className="relative flex items-center" style={{ width: '20px', height: '16px' }}>
                            <div className="absolute left-0" style={{ zIndex: 3 }}>
                              <PlatformIcon platform="instagram" size="sm" />
                            </div>
                            <div className="absolute left-1.5" style={{ zIndex: 2 }}>
                              <PlatformIcon platform="tiktok" size="sm" />
                            </div>
                            <div className="absolute left-3" style={{ zIndex: 1 }}>
                              <PlatformIcon platform="youtube" size="sm" />
                            </div>
                          </div>
                          <span className="ml-2">All Platforms</span>
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
                  
                  {/* Granularity Selector - Dropdown */}
                  <div className="relative">
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
                  
                  <DateRangeFilter
                    selectedFilter={dateFilter}
                    customRange={customDateRange}
                    onFilterChange={handleDateFilterChange}
                  />
                  
                  {/* Rule Filter Button - Icon with Badge */}
                  <button
                    onClick={handleOpenRuleModal}
                    className="relative p-2 bg-white/5 dark:bg-white/5 text-white/90 rounded-lg border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm"
                    title={selectedRuleIds.length === 0 ? 'All Videos' : `${selectedRuleIds.length} rule${selectedRuleIds.length > 1 ? 's' : ''} applied`}
                  >
                    <Filter className="w-4 h-4" />
                    {selectedRuleIds.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full border-2 border-gray-900">
                        {selectedRuleIds.length}
                      </span>
                    )}
                  </button>
                  
                  {/* Edit Layout Button - Icon Only */}
                  <button
                    onClick={() => setIsEditingLayout(true)}
                    className="p-2 rounded-lg transition-all bg-white/5 text-white/90 border border-white/10 hover:border-white/20"
                    title="Customize dashboard layout"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  
                  {/* Manual Refresh Button - Temporary for testing */}
                  <button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className={`p-2 rounded-lg transition-all border ${
                      isRefreshing 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-wait' 
                        : 'bg-white/5 text-white/90 border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400'
                    }`}
                    title="Manually refresh all video data"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
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
            <div className="flex items-center space-x-4">
              {/* Platform Filter Dropdown */}
              <div className="relative">
                <select
                  value={accountsPlatformFilter}
                  onChange={(e) => setAccountsPlatformFilter(e.target.value as 'all' | 'instagram' | 'tiktok' | 'youtube')}
                  className="appearance-none pl-4 pr-10 py-2 bg-white/5 dark:bg-white/5 text-white/90 rounded-lg text-sm font-medium border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm"
                >
                  <option value="all" className="bg-gray-900">All Platforms</option>
                  <option value="instagram" className="bg-gray-900">Instagram</option>
                  <option value="tiktok" className="bg-gray-900">TikTok</option>
                  <option value="youtube" className="bg-gray-900">YouTube</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={accountsSearchQuery}
                  onChange={(e) => setAccountsSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-64 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white"
                />
              </div>
              
              <DateRangeFilter
                selectedFilter={accountsDateFilter}
                onFilterChange={(filter) => setAccountsDateFilter(filter)}
              />
            </div>
          )}
          {activeTab === 'analytics' && (
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search links..."
                  value={linksSearchQuery}
                  onChange={(e) => setLinksSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-80 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white"
                />
              </div>
              
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
        'pt-24 overflow-auto min-h-screen transition-all duration-300',
        {
          'ml-64': !isSidebarCollapsed,
          'ml-16': isSidebarCollapsed,
        }
      )} style={{ overflowX: 'hidden', overflowY: 'auto' }}>
        <div className="max-w-7xl mx-auto px-6 py-8" style={{ overflow: 'visible' }}>
          {/* Dashboard Tab */}
          <div className={activeTab === 'dashboard' ? '' : 'hidden'}>
            <>
              {/* Loading banner when rules are being applied */}
              {isLoadingRules && (
                <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-emerald-400">
                      Applying {selectedRuleIds.length} rule{selectedRuleIds.length > 1 ? 's' : ''}...
                    </p>
                    <p className="text-xs text-emerald-400/70 mt-0.5">
                      Loading filters from database
                    </p>
                  </div>
                </div>
              )}
              
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
                      }
                    }
                    setDraggedSection(null);
                    setDragOverSection(null);
                  };
                  
                  const getSectionTitle = (id: string) => {
                    return dashboardSectionTitles[id] || id;
                  };
                  
                  const renderSectionContent = () => {
                    switch (sectionId) {
                      case 'kpi-cards':
                        return (
                          <KPICards 
                            submissions={filteredSubmissions}
                            allSubmissions={submissionsWithoutDateFilter}
                            linkClicks={linkClicks}
                            dateFilter={dateFilter}
                            customRange={customDateRange}
                            timePeriod="days"
                            granularity={granularity}
                            onVideoClick={handleVideoClick}
                            revenueMetrics={revenueMetrics}
                            revenueIntegrations={revenueIntegrations}
                            isEditMode={isEditingLayout}
                            cardOrder={kpiCardOrder}
                            cardVisibility={kpiCardVisibility}
                            onReorder={(newOrder) => {
                              setKpiCardOrder(newOrder);
                              localStorage.setItem('kpiCardOrder', JSON.stringify(newOrder));
                            }}
                            onToggleCard={handleToggleCard}
                          />
                        );
                      case 'top-performers':
                        return (
                          <TopPerformersSection
                            submissions={filteredSubmissions}
                            onVideoClick={handleVideoClick}
                            onAccountClick={handleAccountClick}
                            onHeatmapCellClick={({ range }) => {
                              setDayVideosDate(range.start);
                              setIsDayVideosModalOpen(true);
                            }}
                            subsectionVisibility={topPerformersSubsectionVisibility}
                            isEditMode={isEditingLayout}
                            onToggleSubsection={handleToggleCard}
                            granularity={granularity}
                          />
                        );
                      case 'posting-activity':
                        return (
                          <PostingActivityHeatmap 
                            submissions={filteredSubmissions}
                            onVideoClick={handleVideoClick}
                          />
                        );
                      case 'tracked-accounts':
                        return (
                          <AccountsPage 
                            ref={accountsPageRef}
                            dateFilter={accountsDateFilter}
                            platformFilter={accountsPlatformFilter}
                            searchQuery={accountsSearchQuery}
                            onViewModeChange={setAccountsViewMode}
                            pendingAccounts={pendingAccounts}
                          />
                        );
                      case 'videos-table':
                        return (
                          <VideoSubmissionsTable
                            submissions={combinedSubmissions}
                            onStatusUpdate={handleStatusUpdate}
                            onDelete={handleDelete}
                            onVideoClick={handleVideoClick}
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
                    fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[100]
                    flex flex-col items-center justify-center gap-2
                    px-6 py-4 rounded-xl border-2 border-dashed
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
              </>
          </div>

          {/* Accounts Tab */}
          {activeTab === 'accounts' && (
            <AccountsPage 
              ref={accountsPageRef}
              dateFilter={accountsDateFilter}
              platformFilter={accountsPlatformFilter}
              searchQuery={accountsSearchQuery}
              onViewModeChange={setAccountsViewMode}
              pendingAccounts={pendingAccounts}
            />
          )}

          {/* Videos Tab */}
          {activeTab === 'videos' && (
            <div className="bg-white dark:bg-[#161616] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
              <VideoSubmissionsTable 
                submissions={filteredSubmissions}
                onVideoClick={handleVideoClick}
                headerTitle="All Videos"
              />
            </div>
          )}

          {/* Subscription Tab */}
          {activeTab === 'subscription' && <SubscriptionPage />}

          {/* Settings Tab (includes Team tab inside) */}
          {activeTab === 'settings' && <SettingsPage />}

          {/* Cron Management Tab */}
          {activeTab === 'cron' && <CronManagementPage />}

          {/* Tracked Links Tab */}
          {activeTab === 'analytics' && (
            <TrackedLinksPage 
              ref={trackedLinksPageRef} 
              searchQuery={linksSearchQuery} 
              linkClicks={linkClicks}
              dateFilter={linksDateFilter}
              customDateRange={linksCustomDateRange}
            />
          )}

          {/* Creators Tab - Show appropriate view based on role */}
          {activeTab === 'creators' && (
            userRole === 'creator' ? <CreatorPortalPage /> : <CreatorsManagementPage ref={creatorsPageRef} dateFilter={creatorsDateFilter} />
          )}

          {/* Other Tabs - Placeholder */}
          {!['dashboard', 'accounts', 'videos', 'subscription', 'settings', 'analytics', 'creators', 'cron', 'team', 'invitations'].includes(activeTab) && (
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

      <VideoAnalyticsModal
        video={selectedVideoForAnalytics}
        isOpen={isAnalyticsModalOpen}
        onClose={handleCloseAnalyticsModal}
        totalCreatorVideos={totalCreatorVideos}
      />

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
          // Render live preview of each section
          switch (sectionId) {
            case 'kpi-cards':
              return (
                <KPICards 
                  submissions={filteredSubmissions}
                  allSubmissions={submissionsWithoutDateFilter}
                  linkClicks={linkClicks}
                  dateFilter={dateFilter}
                  customRange={customDateRange}
                  timePeriod="days"
                  granularity={granularity}
                  onVideoClick={handleVideoClick}
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
                />
              );
            case 'posting-activity':
              return (
                <PostingActivityHeatmap 
                  submissions={filteredSubmissions}
                  onVideoClick={handleVideoClick}
                />
              );
            case 'tracked-accounts':
              return (
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
              return (
                <VideoSubmissionsTable
                  submissions={combinedSubmissions.slice(0, 5)}
                  onStatusUpdate={() => {}}
                  onDelete={() => {}}
                  onVideoClick={handleVideoClick}
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
              return (
                <ComparisonGraph
                  submissions={filteredSubmissions}
                  granularity={granularity}
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
        onClose={() => setIsDayVideosModalOpen(false)}
        date={dayVideosDate}
        videos={combinedSubmissions}
        metricLabel="Videos"
        accountFilter={selectedAccountFilter}
        dateRangeLabel={getDateFilterLabel(dateFilter)}
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
              {selectedRuleIds.length > 0 && (
                <button
                  onClick={() => setSelectedRuleIds([])}
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
                        setSelectedRuleIds(prev => 
                          prev.includes(rule.id)
                            ? prev.filter(id => id !== rule.id)
                            : [...prev, rule.id]
                        );
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
      {activeTab !== 'settings' && activeTab !== 'subscription' && activeTab !== 'cron' && activeTab !== 'team' && activeTab !== 'invitations' && activeTab !== 'creators' && (
        <button
          onClick={() => {
            if (activeTab === 'dashboard') {
              setIsModalOpen(true);
            } else if (activeTab === 'accounts') {
              accountsPageRef.current?.openAddModal();
            } else if (activeTab === 'analytics') {
              trackedLinksPageRef.current?.openCreateModal();
            }
          }}
          className="fixed bottom-8 right-8 z-50 bg-gray-900 dark:bg-white hover:bg-black dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-full p-4 shadow-2xl transition-all duration-200 hover:scale-110 group"
          aria-label={
            activeTab === 'dashboard' ? 'Add Video' :
            activeTab === 'accounts' ? 'Track Account' :
            activeTab === 'analytics' ? 'Create Link' :
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
          <span className="absolute -top-12 right-0 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {activeTab === 'dashboard' && 'Add Video'}
            {activeTab === 'accounts' && 'Track Account'}
            {activeTab === 'analytics' && 'Create Link'}
          </span>
        </button>
      )}
    </div>
  );
}

export default DashboardPage;
