import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import { collection, query, where, getDocs, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  Plus, 
  Users, 
  RefreshCw,
  Trash2,
  Filter,
  AlertCircle,
  Play,
  Eye,
  Heart,
  MessageCircle,
  ExternalLink,
  Calendar,
  Share2,
  Activity,
  Link as LinkIcon,
  X,
  ChevronDown,
  MoreVertical
  } from 'lucide-react';
import profileAnimation from '../../public/lottie/Target Audience.json';
import { AccountVideo } from '../types/accounts';
import { TrackedAccount } from '../types/firestore';
import { VideoSubmissionsTable } from './VideoSubmissionsTable';
import { AccountTrackingServiceFirebase } from '../services/AccountTrackingServiceFirebase';
import FirestoreDataService from '../services/FirestoreDataService';
import { ProxiedImage } from './ProxiedImage';
import { BlurEmptyState } from './ui/BlurEmptyState';
import RulesService from '../services/RulesService';
import CreatorLinksService from '../services/CreatorLinksService';
import { TrackingRule } from '../types/rules';
import { PlatformIcon } from './ui/PlatformIcon';
import { clsx } from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import { MiniTrendChart } from './ui/MiniTrendChart';
import { TrendCalculationService } from '../services/TrendCalculationService';
import { VideoSubmission } from '../types';
import VideoPlayerModal from './VideoPlayerModal';
import VideoAnalyticsModal from './VideoAnalyticsModal';
import { DateFilterType } from './DateRangeFilter';
import { UrlParserService } from '../services/UrlParserService';
import Pagination from './ui/Pagination';
import ColumnPreferencesService from '../services/ColumnPreferencesService';
import KPICards from './KPICards';
import DateFilterService from '../services/DateFilterService';
import CreateLinkModal from './CreateLinkModal';
import LinkClicksService, { LinkClick } from '../services/LinkClicksService';
import UsageTrackingService from '../services/UsageTrackingService';
import { useNavigate } from 'react-router-dom';
import { Creator, TrackedLink as FirestoreTrackedLink } from '../types/firestore';

/**
 * Extract username from social media URL
 */
function extractUsernameFromUrl(url: string, platform: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Remove trailing slash
    const cleanPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    
    if (platform === 'instagram') {
      // Instagram: Extract first path segment (username), ignore extras like /reels/, /p/, /reel/
      // Examples: /username/ → username, /username/reels/ → username, /username/p/ABC123/ → username
      const match = cleanPath.match(/^\/([^\/]+)/);
      return match ? match[1] : null;
    }
    
    if (platform === 'tiktok') {
      // TikTok: Extract @username from first segment, ignore extras like /video/123
      // Examples: /@username → username, /@username/video/123 → username
      const match = cleanPath.match(/^\/@?([^\/]+)/);
      return match ? match[1] : null;
    }
    
    if (platform === 'youtube') {
      // YouTube: https://www.youtube.com/@username or /c/username or /user/username
      const match = cleanPath.match(/^\/@?([^\/]+)\/?$/) || 
                   cleanPath.match(/^\/c\/([^\/]+)\/?$/) ||
                   cleanPath.match(/^\/user\/([^\/]+)\/?$/);
      return match ? match[1] : null;
    }
    
    if (platform === 'twitter') {
      // Twitter/X: Extract username from first segment, ignore extras like /status/123
      // Examples: /username → username, /username/status/123 → username
      const match = cleanPath.match(/^\/([^\/]+)/);
      return match ? match[1] : null;
    }
    
    return null;
  } catch {
    return null;
  }
}

export interface AccountsPageProps {
  dateFilter: DateFilterType;
  platformFilter: 'all' | 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  searchQuery?: string;
  onViewModeChange: (mode: 'table' | 'details') => void;
  pendingAccounts?: TrackedAccount[];
  organizationId?: string;
  projectId?: string;
  selectedRuleIds?: string[];
  dashboardRules?: TrackingRule[];
}

export interface AccountsPageRef {
  handleBackToTable: () => void;
  openAddModal: () => void;
  refreshData?: () => Promise<void>;
}

interface AccountWithFilteredStats extends TrackedAccount {
  filteredTotalVideos: number;
  filteredTotalViews: number;
  filteredTotalLikes: number;
  filteredTotalComments: number;
}

const AccountsPage = forwardRef<AccountsPageRef, AccountsPageProps>(
  ({ dateFilter, platformFilter, searchQuery = '', onViewModeChange, pendingAccounts = [], selectedRuleIds = [], dashboardRules = [], organizationId, projectId }, ref) => {
  const { user, currentOrgId: authOrgId, currentProjectId: authProjectId } = useAuth();
  
  // Use props if provided (for demo mode), otherwise use auth
  const currentOrgId = organizationId || authOrgId;
  const currentProjectId = projectId || authProjectId;
  const navigate = useNavigate();
  
  // Debug props
  useEffect(() => {
    console.log('📋 AccountsPage Props:', {
      selectedRuleIds,
      dashboardRulesCount: dashboardRules.length,
      dashboardRulesNames: dashboardRules.map(r => r.name)
    });
  }, [selectedRuleIds, dashboardRules]);
  
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<AccountWithFilteredStats[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<TrackedAccount | null>(null);
  
  // Track if we've already done the initial restoration from localStorage
  const hasRestoredFromLocalStorage = useRef(false);
  const [accountVideos, setAccountVideos] = useState<AccountVideo[]>([]);
  const [allAccountVideos, setAllAccountVideos] = useState<AccountVideo[]>([]); // Rules-filtered (no date filter) for PP calculation
  const [viewMode, setViewMode] = useState<'table' | 'details'>('table');
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<{url: string; title: string; platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' } | null>(null);
  const [selectedVideoForAnalytics, setSelectedVideoForAnalytics] = useState<VideoSubmission | null>(null);
  const [isVideoAnalyticsModalOpen, setIsVideoAnalyticsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [accountInputs, setAccountInputs] = useState<Array<{id: string; url: string; platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | null; error: string | null; videoCount: number}>>([
    { id: '1', url: '', platform: null, error: null, videoCount: 10 }
  ]);
  const [newAccountUrl, setNewAccountUrl] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<'instagram' | 'tiktok' | 'youtube' | 'twitter' | null>(null);
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAccountDetail, setLoadingAccountDetail] = useState(false);
  const [sortBy, setSortBy] = useState<'username' | 'followers' | 'videos' | 'views' | 'likes' | 'comments' | 'dateAdded'>('dateAdded');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<TrackedAccount | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showAttachCreatorModal, setShowAttachCreatorModal] = useState(false);
  const [showCreateLinkModal, setShowCreateLinkModal] = useState(false);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>('');
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [trackedLinks, setTrackedLinks] = useState<FirestoreTrackedLink[]>([]);
  const [linkClicks, setLinkClicks] = useState<LinkClick[]>([]);
  const [accountCreatorNames, setAccountCreatorNames] = useState<Map<string, string>>(new Map());
  const [usageLimits, setUsageLimits] = useState<{ accountsLeft: number; videosLeft: number; isAtAccountLimit: boolean; isAtVideoLimit: boolean }>({
    accountsLeft: 0,
    videosLeft: 0,
    isAtAccountLimit: false,
    isAtVideoLimit: false
  });
  const [processingAccounts, setProcessingAccounts] = useState<Array<{username: string; platform: string; startedAt: number}>>(() => {
    // Restore from localStorage and clean up old entries (> 5 minutes old)
    const saved = localStorage.getItem('processingAccounts');
    if (!saved) return [];
    
    try {
      const parsed = JSON.parse(saved);
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      const filtered = parsed.filter((acc: any) => {
        // Remove accounts that have been processing for more than 5 minutes
        if (!acc.startedAt || acc.startedAt < fiveMinutesAgo) {
          return false;
        }
        return true;
      });
      return filtered;
    } catch {
      return [];
    }
  });
  const [syncingAccounts, setSyncingAccounts] = useState<Set<string>>(new Set());
  
  // Pagination state for videos (details view)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('accountVideos_itemsPerPage');
    return saved ? Number(saved) : 10;
  });

  // Pagination state for accounts table (list view)
  const [accountsCurrentPage, setAccountsCurrentPage] = useState(1);
  const [accountsItemsPerPage, setAccountsItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('accounts_itemsPerPage');
    return saved ? Number(saved) : 10;
  });
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'uploadDate' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Load column preferences from localStorage
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = ColumnPreferencesService.getPreferences('accountVideos');
    return saved || {
    video: true,
    platform: true,
    preview: true,
    trend: true,
    views: true,
    likes: true,
    comments: true,
    shares: true,
    engagement: true,
    uploadDate: true
    };
  });


  // Save column preferences when they change
  useEffect(() => {
    ColumnPreferencesService.savePreferences('accountVideos', visibleColumns);
  }, [visibleColumns]);

  // Save items per page preference for videos
  useEffect(() => {
    localStorage.setItem('accountVideos_itemsPerPage', String(itemsPerPage));
  }, [itemsPerPage]);

  // Save items per page preference for accounts table
  useEffect(() => {
    localStorage.setItem('accounts_itemsPerPage', String(accountsItemsPerPage));
  }, [accountsItemsPerPage]);

  // Reset accounts pagination when search query changes
  useEffect(() => {
    setAccountsCurrentPage(1);
  }, [searchQuery]);

  // Save processing accounts to localStorage
  useEffect(() => {
    localStorage.setItem('processingAccounts', JSON.stringify(processingAccounts));
  }, [processingAccounts]);

  // Auto-cleanup stuck processing accounts every minute
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setProcessingAccounts(prev => {
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const filtered = prev.filter(acc => {
          if (!acc.startedAt || acc.startedAt < fiveMinutesAgo) {
            return false;
          }
          return true;
        });
        return filtered.length !== prev.length ? filtered : prev;
      });
    }, 60000); // Check every minute

    return () => clearInterval(cleanupInterval);
  }, []);

  // Load usage limits
  useEffect(() => {
    const loadUsageLimits = async () => {
      if (!currentOrgId) return;
      
      try {
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
  }, [currentOrgId, accounts.length]); // Reload when accounts change

  // Handle back to table navigation
  const handleBackToTable = useCallback(() => {
    setSelectedAccount(null);
    navigate('/accounts');
    setAccountVideos([]);
    setViewMode('table');
    onViewModeChange('table');
    // Clear localStorage so we don't accidentally restore this account later
    localStorage.removeItem('selectedAccountId');
  }, [onViewModeChange]);

  // Load videos for a specific account
  const loadAccountVideos = useCallback(async (accountId: string) => {
    if (!currentOrgId || !currentProjectId) return;
    
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;
    
    setLoadingAccountDetail(true);
    
    const videos = await AccountTrackingServiceFirebase.getAccountVideos(currentOrgId, currentProjectId, accountId);
    
    // Apply dashboard rules to filter videos
    // When no rules are selected, show ALL videos (default behavior)
    let rulesFilteredVideos = videos;
    
    // Only filter if rules are actively selected
    if (selectedRuleIds && selectedRuleIds.length > 0 && dashboardRules && dashboardRules.length > 0) {
      const activeRules = dashboardRules.filter(r => 
        r && selectedRuleIds.includes(r.id) && r.isActive
      );
      console.log('🎯 Active Rules to Apply:', activeRules.map(r => ({
        id: r.id,
        name: r.name,
        conditions: r.conditions
      })));
      
      // Apply filtering only if we have valid active rules
      if (activeRules.length > 0) {
        rulesFilteredVideos = videos.filter(video => {
          const matches = activeRules.some(rule => {
            const result = RulesService.videoMatchesRules(video, [rule]);
            if (videos.indexOf(video) === 0) { // Log first video for debugging
              console.log('🧪 Testing first video against rule:', {
                videoId: video.id,
                videoCaption: video.caption || video.title,
                ruleName: rule.name,
                matches: result
              });
            }
            return result;
          });
          return matches;
        });
        console.log(`✅ Filtered from ${videos.length} to ${rulesFilteredVideos.length} videos`);
      } else {
        console.log('📝 No active rules selected - showing all videos');
      }
    } else {
      console.log('📝 Rules filtering disabled - showing all videos');
    }
    
    // Store rules-filtered videos (without date filter) for PP calculations
    // This ensures PP comparisons also respect the selected rules
    setAllAccountVideos(rulesFilteredVideos);
    
    console.log('🔍 Rules Filter Debug:', {
      totalVideos: videos.length,
      selectedRuleIds,
      dashboardRulesCount: dashboardRules.length,
      dashboardRules: dashboardRules.map(r => ({ id: r.id, name: r.name, isActive: r.isActive })),
      activeRules: dashboardRules.filter(r => selectedRuleIds.includes(r.id) && r.isActive).map(r => ({ id: r.id, name: r.name })),
      rulesFilteredCount: rulesFilteredVideos.length,
      sampleVideoBeforeFilter: videos[0] ? {
        id: videos[0].id,
        caption: videos[0].caption || videos[0].title
      } : null,
      sampleVideoAfterFilter: rulesFilteredVideos[0] ? {
        id: rulesFilteredVideos[0].id,
        caption: rulesFilteredVideos[0].caption || rulesFilteredVideos[0].title
      } : null
    });
    
    // Apply date filtering on top of rules filtering
    const videoSubmissions: VideoSubmission[] = rulesFilteredVideos.map(video => ({
      id: video.id || video.videoId || '',
      url: video.url || '',
      platform: account.platform,
      thumbnail: video.thumbnail || '',
      title: video.caption || video.title || 'No caption',
      uploader: account.displayName || account.username,
      uploaderHandle: account.username,
      uploaderProfilePicture: account.profilePicture,
      followerCount: account.followerCount,
      status: 'approved' as const,
      views: video.viewsCount || video.views || 0,
      likes: video.likesCount || video.likes || 0,
      comments: video.commentsCount || video.comments || 0,
      shares: video.sharesCount || video.shares || 0,
      dateSubmitted: video.uploadDate || new Date(),
      uploadDate: video.uploadDate || new Date(),
      snapshots: []
    }));
    
    const dateFilteredSubmissions = DateFilterService.filterVideosByDateRange(
      videoSubmissions,
      dateFilter
    );
    
    // Convert back to AccountVideo
    const finalFilteredVideos: AccountVideo[] = dateFilteredSubmissions.map(sub => {
      const originalVideo = rulesFilteredVideos.find(v => (v.id || v.videoId) === sub.id);
      return originalVideo || {
        id: sub.id,
        videoId: sub.id,
        url: sub.url,
        thumbnail: sub.thumbnail,
        caption: sub.title,
        viewsCount: sub.views,
        likesCount: sub.likes,
        commentsCount: sub.comments,
        sharesCount: sub.shares,
        uploadDate: sub.uploadDate,
        timestamp: sub.uploadDate.toISOString()
      };
    });
    
    setAccountVideos(finalFilteredVideos);
    setLoadingAccountDetail(false);
  }, [currentOrgId, currentProjectId, accounts, dateFilter, selectedRuleIds, dashboardRules]);

  // Expose handleBackToTable and openAddModal to parent component
  // Refresh data function for parent to call
  const refreshData = useCallback(async () => {
    if (!currentOrgId || !currentProjectId) return;
    
    
    try {
      // Reload links and clicks
      const [loadedLinks, loadedClicks] = await Promise.all([
        FirestoreDataService.getLinks(currentOrgId, currentProjectId),
        LinkClicksService.getProjectLinkClicks(currentOrgId, currentProjectId)
      ]);
      
      setTrackedLinks(loadedLinks);
      setLinkClicks(loadedClicks);
      
      // Reload selected account's videos if one is selected
      if (selectedAccount) {
        await loadAccountVideos(selectedAccount.id);
      }
      
    } catch (error) {
      console.error('❌ Failed to refresh data:', error);
    }
  }, [currentOrgId, currentProjectId, selectedAccount, loadAccountVideos]);

  useImperativeHandle(ref, () => ({
    handleBackToTable,
    openAddModal: () => setIsAddModalOpen(true),
    refreshData
  }), [handleBackToTable, refreshData]);

  // Auto-detect account URL from clipboard when modal opens
  useEffect(() => {
    if (isAddModalOpen) {
      const checkClipboard = async () => {
        const parsed = await UrlParserService.autoDetectFromClipboard();
        
        if (parsed && parsed.isValid && parsed.platform) {
          setNewAccountUrl(parsed.url);
          setDetectedPlatform(parsed.platform);
        }
      };
      
      checkClipboard();
    } else {
      // Reset when modal closes
      setNewAccountUrl('');
      setDetectedPlatform(null);
      setUrlValidationError(null);
      setAccountInputs([{ id: '1', url: '', platform: null, error: null, videoCount: 10 }]);
    }
  }, [isAddModalOpen]);

  // Load videos and rules when an account is selected OR filters change
  useEffect(() => {
    if (selectedAccount && currentOrgId && currentProjectId) {
      loadAccountVideos(selectedAccount.id);
      
      // Only update view mode on initial account selection (not on filter changes)
      if (viewMode !== 'details') {
      setViewMode('details');
      onViewModeChange('details');
      }
      
      // Save to localStorage for restoration
      localStorage.setItem('selectedAccountId', selectedAccount.id);
    }
  }, [selectedAccount?.id, currentOrgId, currentProjectId, selectedRuleIds, dateFilter, dashboardRules]);

  // Real-time listener for accounts
  useEffect(() => {
    if (!currentOrgId || !currentProjectId) {
      setLoading(false);
      return;
    }

    
    const accountsRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts');
    const accountsQuery = query(accountsRef);

    (async () => {
      try {
        const snapshot = await getDocs(accountsQuery);
      const loadedAccounts: TrackedAccount[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TrackedAccount));
      
      setAccounts(loadedAccounts);

      // Auto-cleanup: Remove from processing if account now exists in real list AND has finished loading
      // We wait for the account to have a profile picture or follower count to ensure it's fully loaded
      setProcessingAccounts(prev => {
        const fullyLoadedAccounts = new Set(
          loadedAccounts
            .filter(acc => acc.profilePicture || (acc.followerCount ?? 0) > 0)
            .map(acc => `${acc.platform}_${acc.username}`)
        );
        const remaining = prev.filter(proc => !fullyLoadedAccounts.has(`${proc.platform}_${proc.username}`));
        if (remaining.length < prev.length) {
          console.log(`✅ Removed ${prev.length - remaining.length} processing accounts that are now fully loaded`);
        }
        return remaining;
      });

      // Only restore from localStorage on INITIAL load, not on every update
      // This prevents unwanted navigation when accounts sync completes
      if (!hasRestoredFromLocalStorage.current && loadedAccounts.length > 0) {
        const savedSelectedAccountId = localStorage.getItem('selectedAccountId');
        if (savedSelectedAccountId) {
          const savedAccount = loadedAccounts.find(a => a.id === savedSelectedAccountId);
          if (savedAccount) {
            setSelectedAccount(savedAccount);
          }
        }
        hasRestoredFromLocalStorage.current = true;
      }
      
      setLoading(false);
      } catch (error) {
        console.error('❌ Failed to load accounts:', error);
        setLoading(false);
      }
    })();
  }, [currentOrgId, currentProjectId]);

  // Load creator names for each account
  useEffect(() => {
    const loadCreatorNames = async () => {
      if (!currentOrgId || !currentProjectId || accounts.length === 0) return;

      const creatorNamesMap = new Map<string, string>();

      // Load creator name for each account
      await Promise.all(
        accounts.map(async (account) => {
          const creatorName = await CreatorLinksService.getCreatorNameForAccount(
            currentOrgId,
            currentProjectId,
            account.id
          );
          if (creatorName) {
            creatorNamesMap.set(account.id, creatorName);
          }
        })
      );

      setAccountCreatorNames(creatorNamesMap);
    };

    loadCreatorNames();
  }, [currentOrgId, currentProjectId, accounts]);

  // Load links and link clicks
  useEffect(() => {
    const loadLinksAndClicks = async () => {
      if (!currentOrgId || !currentProjectId) return;

      try {
        const [loadedLinks, loadedClicks] = await Promise.all([
          FirestoreDataService.getLinks(currentOrgId, currentProjectId),
          LinkClicksService.getProjectLinkClicks(currentOrgId, currentProjectId)
        ]);
        
        setTrackedLinks(loadedLinks);
        setLinkClicks(loadedClicks);
      } catch (error) {
        console.error('❌ Failed to load links and clicks:', error);
      }
    };

    loadLinksAndClicks();
  }, [currentOrgId, currentProjectId]);


  // Smart sync monitoring - Only monitors when accounts are actively syncing
  useEffect(() => {
    if (!currentOrgId || !currentProjectId) return;


    const accountsRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts');
    const syncingQuery = query(accountsRef, where('syncStatus', 'in', ['pending', 'syncing']));

    const unsubscribe = onSnapshot(syncingQuery, async (snapshot) => {
      const syncingIds = new Set<string>();
      const previousSize = syncingAccounts.size;
      const now = Date.now();
      const SYNC_TIMEOUT = 15 * 60 * 1000; // 15 minutes
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const lastSyncedAt = data.lastSyncedAt?.toDate?.() || data.dateAdded?.toDate?.();
        const syncAge = lastSyncedAt ? now - lastSyncedAt.getTime() : 0;
        
        // Auto-cancel if stuck for more than 15 minutes
        if (syncAge > SYNC_TIMEOUT) {
          try {
            const accountRef = doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts', docSnapshot.id);
            await updateDoc(accountRef, {
              syncStatus: 'completed',
              lastSyncedAt: new Date(),
              syncError: 'Auto-cancelled after 15 minutes timeout'
            });
          } catch (error) {
            console.error(`Failed to auto-cancel sync for ${data.username}:`, error);
          }
        } else {
          syncingIds.add(docSnapshot.id);
        }
      }

      setSyncingAccounts(syncingIds);

      // If an account just finished syncing (size decreased), refresh the data
      if (syncingIds.size < previousSize) {
        
        // Reload the accounts list to get updated data
        (async () => {
          try {
            const accountsRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts');
            const accountsQuery = query(accountsRef);
            const accountsSnapshot = await getDocs(accountsQuery);
            const loadedAccounts: TrackedAccount[] = accountsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as TrackedAccount));
            
            setAccounts(loadedAccounts);
            
            // If the selected account was the one syncing, reload its videos
            if (selectedAccount && !syncingIds.has(selectedAccount.id)) {
              loadAccountVideos(selectedAccount.id);
            }
          } catch (error) {
            console.error('❌ Failed to refresh after sync:', error);
          }
        })();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentOrgId, currentProjectId, syncingAccounts.size, selectedAccount, loadAccountVideos]);

  // Fast stats calculation - Load all videos at once, then group by account
  useEffect(() => {
    const calculateFilteredStats = async () => {
      if (!currentOrgId || !currentProjectId || accounts.length === 0 || viewMode !== 'table') {
        return;
      }

      // IMMEDIATELY show table with basic stats (no delay!)
      const accountsWithBasicStats: AccountWithFilteredStats[] = accounts.map(account => ({
        ...account,
        filteredTotalVideos: account.totalVideos || 0,
        filteredTotalViews: account.totalViews || 0,
        filteredTotalLikes: account.totalLikes || 0,
        filteredTotalComments: account.totalComments || 0
      }));
      setFilteredAccounts(accountsWithBasicStats);

      // Load filtered stats in background (much faster - single query!)
      try {
        // Load ALL videos from main collection at once (ONE query instead of N queries!)
        const videosRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'videos');
        const videosQuery = query(videosRef, orderBy('uploadDate', 'desc'));
        const videosSnapshot = await getDocs(videosQuery);
        
        // Group videos by account
        const videosByAccount = new Map<string, any[]>();
        videosSnapshot.docs.forEach(doc => {
          const video = { id: doc.id, ...doc.data() } as any;
          const accountId = video.trackedAccountId;
          if (accountId) {
            if (!videosByAccount.has(accountId)) {
              videosByAccount.set(accountId, []);
            }
            videosByAccount.get(accountId)!.push(video);
          }
        });

        // Calculate filtered stats for each account
        const accountsWithStats: AccountWithFilteredStats[] = accounts.map(account => {
          const accountVideos = videosByAccount.get(account.id) || [];
          
          // 🔑 STEP 1: Apply rules filtering (using dashboard's selected rules)
          // When no rules are selected, show ALL videos (default behavior)
          let rulesFilteredVideos = accountVideos;
          
          // Only filter if rules are actively selected
          if (selectedRuleIds && selectedRuleIds.length > 0 && dashboardRules && dashboardRules.length > 0) {
            const activeRules = dashboardRules.filter(r => 
              r && selectedRuleIds.includes(r.id) && r.isActive
            );
            
            // Apply filtering only if we have valid active rules
            if (activeRules.length > 0) {
              rulesFilteredVideos = accountVideos.filter(video => {
                return activeRules.some(rule => RulesService.videoMatchesRules(video, [rule]));
              });
            }
          }

          // 🔑 STEP 2: Convert to submissions
          const videoSubmissions: VideoSubmission[] = rulesFilteredVideos.map(video => ({
            id: video.id || '',
            url: video.videoUrl || video.url || '',
            platform: account.platform,
            thumbnail: video.thumbnail || '',
            title: video.videoTitle || video.caption || '',
            uploader: account.displayName || account.username,
            uploaderHandle: account.username,
            uploaderProfilePicture: account.profilePicture,
            followerCount: account.followerCount,
            status: 'approved' as const,
            views: video.views || 0,
            likes: video.likes || 0,
            comments: video.comments || 0,
            shares: video.shares || 0,
            dateSubmitted: video.uploadDate?.toDate?.() || new Date(),
            uploadDate: video.uploadDate?.toDate?.() || new Date(),
            snapshots: []
          }));

          // 🔑 STEP 3: Apply date filtering
          const dateFiltered = DateFilterService.filterVideosByDateRange(videoSubmissions, dateFilter);

          return {
            ...account,
            filteredTotalVideos: dateFiltered.length,
            filteredTotalViews: dateFiltered.reduce((sum, v) => sum + v.views, 0),
            filteredTotalLikes: dateFiltered.reduce((sum, v) => sum + v.likes, 0),
            filteredTotalComments: dateFiltered.reduce((sum, v) => sum + v.comments, 0)
          };
        });

        setFilteredAccounts(accountsWithStats);
      } catch (error) {
        console.error('❌ Failed to calculate filtered stats:', error);
        // Keep showing basic stats on error
      }
    };

    calculateFilteredStats();
  }, [accounts, currentOrgId, currentProjectId, dateFilter, viewMode, dashboardRules, selectedRuleIds]);

  // Apply platform filtering and sorting
  const processedAccounts = useMemo(() => {
    let result = filteredAccounts.length > 0 ? filteredAccounts : accounts;
    
    // Apply platform filter
    if (platformFilter !== 'all') {
      result = result.filter(account => account.platform === platformFilter);
    }
    
    // Apply search filter
    if (searchQuery) {
      result = result.filter(account => 
        account.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply sorting
    const sorted = [...result].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'username':
          comparison = a.username.localeCompare(b.username);
          break;
        case 'followers':
          comparison = (a.followerCount || 0) - (b.followerCount || 0);
          break;
        case 'videos':
          const aVideos = ('filteredTotalVideos' in a ? (a as AccountWithFilteredStats).filteredTotalVideos : a.totalVideos);
          const bVideos = ('filteredTotalVideos' in b ? (b as AccountWithFilteredStats).filteredTotalVideos : b.totalVideos);
          comparison = aVideos - bVideos;
          break;
        case 'views':
          const aViews = ('filteredTotalViews' in a ? (a as AccountWithFilteredStats).filteredTotalViews : a.totalViews);
          const bViews = ('filteredTotalViews' in b ? (b as AccountWithFilteredStats).filteredTotalViews : b.totalViews);
          comparison = aViews - bViews;
          break;
        case 'likes':
          const aLikes = ('filteredTotalLikes' in a ? (a as AccountWithFilteredStats).filteredTotalLikes : a.totalLikes);
          const bLikes = ('filteredTotalLikes' in b ? (b as AccountWithFilteredStats).filteredTotalLikes : b.totalLikes);
          comparison = aLikes - bLikes;
          break;
        case 'comments':
          const aComments = ('filteredTotalComments' in a ? (a as AccountWithFilteredStats).filteredTotalComments : a.totalComments);
          const bComments = ('filteredTotalComments' in b ? (b as AccountWithFilteredStats).filteredTotalComments : b.totalComments);
          comparison = aComments - bComments;
          break;
        case 'dateAdded':
          comparison = a.dateAdded.toDate().getTime() - b.dateAdded.toDate().getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [filteredAccounts, accounts, platformFilter, searchQuery, sortBy, sortOrder]);


  // Listen for URL-based account opening
  useEffect(() => {
    const handleOpenAccount = (event: any) => {
      const accountId = event.detail?.accountId;
      if (accountId && accounts.length > 0) {
        const account = accounts.find(a => a.id === accountId);
        if (account) {
          setSelectedAccount(account);
          setViewMode('details');
        }
      }
    };
    
    window.addEventListener('openAccount', handleOpenAccount);
    return () => window.removeEventListener('openAccount', handleOpenAccount);
  }, [accounts]);

  // NOTE: Removed duplicate useEffect - video loading is now handled by loadAccountVideos() 
  // which is called from the useEffect at line ~450 with dashboard rules properly applied

  const handleSyncAccount = useCallback(async (accountId: string) => {
    if (!currentOrgId || !currentProjectId || !user) return;

    setIsSyncing(accountId);
    setSyncError(null);
    try {
      const videoCount = await AccountTrackingServiceFirebase.syncAccountVideos(currentOrgId, currentProjectId, user.uid, accountId);
      
      // Update accounts list
      const updatedAccounts = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
      setAccounts(updatedAccounts);
      
      // Update videos if this account is selected - use loadAccountVideos for consistent filtering
      if (selectedAccount?.id === accountId) {
        await loadAccountVideos(accountId);
      }
      
      
      // Show success message briefly
      if (videoCount === 0) {
        setSyncError('No videos found or filtered by rules. Check if rules are too restrictive, or this might be a private account.');
      } else {
        // Clear any previous errors on success
        setSyncError(null);
      }
    } catch (error) {
      console.error('❌ Sync failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setSyncError(`Sync failed: ${errorMessage}`);
    } finally {
      setIsSyncing(null);
    }
  }, [selectedAccount, currentOrgId, currentProjectId, user, loadAccountVideos]);

  // Handle URL input change and auto-detect platform
  const handleUrlChange = useCallback((url: string) => {
    setNewAccountUrl(url);
    setUrlValidationError(null);
    
    if (!url.trim()) {
      setDetectedPlatform(null);
      return;
    }
    
    const parsed = UrlParserService.parseUrl(url);
    
    if (parsed.platform) {
      setDetectedPlatform(parsed.platform);
      setUrlValidationError(null);
    } else if (url.trim().length > 5) {
      // Only show error if they've typed enough
      setDetectedPlatform(null);
      setUrlValidationError('Please enter a valid Instagram, TikTok, YouTube, or Twitter URL');
    }
  }, []);

  const handleAddAccount = useCallback(async () => {
    if (!currentOrgId || !currentProjectId || !user) return;

    // Collect all valid accounts from ALL inputs (including first one) with their specific video counts
    const accountsToAdd: Array<{url: string; username: string; platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter'; videoCount: number}> = [];
    
    // Check ALL inputs using accountInputs array
    for (let i = 0; i < accountInputs.length; i++) {
      const input = accountInputs[i];
      const url = (i === 0 ? newAccountUrl : input.url).trim();
      const platform = i === 0 ? detectedPlatform : input.platform;
      const videoCount = input.videoCount; // Each input has its own video count
      
      if (url && platform) {
        const username = extractUsernameFromUrl(url, platform);
        if (username) {
          accountsToAdd.push({ url, username, platform, videoCount });
        }
      }
    }
    
    if (accountsToAdd.length === 0) {
      setUrlValidationError('Please enter at least one valid account URL.');
      return;
    }

    // Add all to processing accounts immediately AT THE TOP
    setProcessingAccounts(prev => [
      ...accountsToAdd.map(acc => ({ username: acc.username, platform: acc.platform, startedAt: Date.now() })),
      ...prev
    ]);
    
    // Close modal and reset form immediately
    setNewAccountUrl('');
    setDetectedPlatform(null);
    setUrlValidationError(null);
    setAccountInputs([{ id: '1', url: '', platform: null, error: null, videoCount: 10 }]);
    setIsAddModalOpen(false);

    // Process all accounts in PARALLEL, each with its own video count
    const addPromises = accountsToAdd.map(account => 
      AccountTrackingServiceFirebase.addAccount(
        currentOrgId,
        currentProjectId,
        user.uid,
        account.username,
        account.platform,
        'my', // Default to 'my' account type
        account.videoCount // Pass each account's specific video count
      ).then(() => {
        return { success: true, username: account.username };
      }).catch(error => {
        console.error(`Failed to add account @${account.username}:`, error);
        return { success: false, username: account.username };
      })
    );

    // Wait for all to complete
    await Promise.all(addPromises);
    
    // Note: Real-time listener will automatically update accounts and clean up processing state
    // No need to manually reload - this prevents flickering
    
    // Safety cleanup: Remove from processing after 10 seconds if real-time listener hasn't already
    setTimeout(() => {
      const usernames = accountsToAdd.map(acc => acc.username);
      setProcessingAccounts(prev => {
        const filtered = prev.filter(acc => !usernames.includes(acc.username));
        if (filtered.length < prev.length) {
        }
        return filtered;
      });
    }, 10000);
  }, [newAccountUrl, detectedPlatform, accountInputs, currentOrgId, currentProjectId, user]);

  // Helper to generate short code for links
  const generateShortCode = (length: number = 6): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Handle creating a tracked link
  const handleCreateLink = async (originalUrl: string, title: string, description?: string, tags?: string[], linkedAccountId?: string) => {
    if (!currentOrgId || !currentProjectId || !user) return;
    
    try {
      const shortCode = generateShortCode();
      
      const createData: any = {
        shortCode,
        originalUrl,
        title,
        isActive: true
      };
      
      if (description !== undefined) createData.description = description;
      if (tags !== undefined) createData.tags = tags;
      if (linkedAccountId !== undefined) createData.linkedAccountId = linkedAccountId;
      
      await FirestoreDataService.createLink(currentOrgId, currentProjectId, user.uid, createData);
      
      setShowCreateLinkModal(false);
      
      // Show success message
      alert('✅ Link created successfully!');
    } catch (error) {
      console.error('Failed to create link:', error);
      alert('Failed to create link. Please try again.');
    }
  };

  const handleRemoveAccount = useCallback((accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;
    
    setAccountToDelete(account);
    setShowDeleteModal(true);
    setDeleteConfirmText('');
  }, [accounts]);

  const confirmDeleteAccount = useCallback(async () => {
    if (!currentOrgId || !currentProjectId || !accountToDelete) return;
    // Simplified - no text confirmation needed

    try {
      await AccountTrackingServiceFirebase.removeAccount(currentOrgId, currentProjectId, accountToDelete.id);
      setAccounts(prev => prev.filter(a => a.id !== accountToDelete.id));
      
      if (selectedAccount?.id === accountToDelete.id) {
        navigate('/accounts');
        setAccountVideos([]);
      }
      
      setShowDeleteModal(false);
      setAccountToDelete(null);
      setDeleteConfirmText('');
    } catch (error) {
      console.error('Failed to remove account:', error);
      alert('Failed to remove account. Please try again.');
    }
  }, [accountToDelete, deleteConfirmText, selectedAccount, currentOrgId, currentProjectId]);

  // Fetch creators when attach modal opens
  useEffect(() => {
    const loadCreators = async () => {
      if (showAttachCreatorModal && currentOrgId && currentProjectId) {
        try {
          const creatorsList = await CreatorLinksService.getAllCreators(currentOrgId, currentProjectId);
          setCreators(creatorsList);
        } catch (error) {
          console.error('Failed to load creators:', error);
          setCreators([]);
        }
      }
    };
    loadCreators();
  }, [showAttachCreatorModal, currentOrgId, currentProjectId]);


  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  // Sorting handler
  const handleSort = (column: 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'uploadDate') => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to descending
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Sort videos based on current sort state
  const sortedVideos = useMemo(() => {
    if (!sortColumn) return accountVideos;

    return [...accountVideos].sort((a, b) => {
      let aValue: number | Date;
      let bValue: number | Date;

      switch (sortColumn) {
        case 'views':
          aValue = a.viewsCount || a.views || 0;
          bValue = b.viewsCount || b.views || 0;
          break;
        case 'likes':
          aValue = a.likesCount || a.likes || 0;
          bValue = b.likesCount || b.likes || 0;
          break;
        case 'comments':
          aValue = a.commentsCount || a.comments || 0;
          bValue = b.commentsCount || b.comments || 0;
          break;
        case 'shares':
          aValue = a.sharesCount || a.shares || 0;
          bValue = b.sharesCount || b.shares || 0;
          break;
        case 'engagement': {
          const aViews = a.viewsCount || a.views || 0;
          const bViews = b.viewsCount || b.views || 0;
          const aLikes = a.likesCount || a.likes || 0;
          const bLikes = b.likesCount || b.likes || 0;
          const aComments = a.commentsCount || a.comments || 0;
          const bComments = b.commentsCount || b.comments || 0;
          aValue = aViews > 0 ? ((aLikes + aComments) / aViews) * 100 : 0;
          bValue = bViews > 0 ? ((bLikes + bComments) / bViews) * 100 : 0;
          break;
        }
        case 'uploadDate':
          aValue = new Date(a.uploadDate || 0);
          bValue = new Date(b.uploadDate || 0);
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  }, [accountVideos, sortColumn, sortDirection]);

  // Show loading state
  if (loading) {
    return <PageLoadingSkeleton type="accounts" />;
  }

  // Show loading if not authenticated (don't show sign in message)
  if (!user || !currentOrgId) {
    return <PageLoadingSkeleton type="accounts" />;
  }

  // Generate chart data based on time period and historical tracking
  return (
    <div className="space-y-6">
      {/* Error Display */}
      {syncError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{syncError}</p>
          <button 
            onClick={() => setSyncError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}


      {/* Main Content */}
      {viewMode === 'table' ? (
        <div className="space-y-6">
          {/* Accounts Table */}
          {!loading && accounts.length === 0 && processingAccounts.length === 0 ? (
            <BlurEmptyState
              title="Add Your First Account to Track"
              description="Track Instagram, TikTok, YouTube, and X accounts to monitor followers, engagement, and growth."
              animation={profileAnimation}
              tooltipText="Track Instagram, TikTok, YouTube, and X accounts to monitor followers, engagement rates, content performance, and audience growth over time."
              actions={[
                {
                  label: 'Add Account',
                  onClick: () => setIsAddModalOpen(true),
                  icon: Plus,
                  primary: true
                }
              ]}
            />
          ) : (
          <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 overflow-hidden">
          {(
            <div className="overflow-x-auto -mx-3 sm:-mx-0">
              <table className="w-full min-w-max">
                <thead className="bg-gray-50 dark:bg-zinc-900/40 border-b border-gray-200 dark:border-white/5">
                  <tr>
                    <th 
                      className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/40 transition-colors"
                      onClick={() => {
                        if (sortBy === 'username') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('username');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        Username
                        {sortBy === 'username' && (
                          <span className="text-white">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Platform
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                      Creator
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last post
                    </th>
                    <th 
                      className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/40 transition-colors"
                      onClick={() => {
                        if (sortBy === 'followers') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('followers');
                          setSortOrder('desc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        Followers
                        {sortBy === 'followers' && (
                          <span className="text-white">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/40 transition-colors"
                      onClick={() => {
                        if (sortBy === 'videos') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('videos');
                          setSortOrder('desc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-1 sm:gap-2">
                        Posts
                        {sortBy === 'videos' && (
                          <span className="text-white">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/40 transition-colors"
                      onClick={() => {
                        if (sortBy === 'views') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('views');
                          setSortOrder('desc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-1 sm:gap-2">
                        Views
                        {sortBy === 'views' && (
                          <span className="text-white">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/40 transition-colors"
                      onClick={() => {
                        if (sortBy === 'likes') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('likes');
                          setSortOrder('desc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-1 sm:gap-2">
                        Likes
                        {sortBy === 'likes' && (
                          <span className="text-white">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/40 transition-colors"
                      onClick={() => {
                        if (sortBy === 'comments') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('comments');
                          setSortOrder('desc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        Comments
                        {sortBy === 'comments' && (
                          <span className="text-white">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-900/60 divide-y divide-gray-200 dark:divide-white/5">
                  {/* Processing & Regular Accounts - Merged for smooth transitions */}
                  {(() => {
                    // Apply pagination to processed accounts
                    const startIndex = (accountsCurrentPage - 1) * accountsItemsPerPage;
                    const endIndex = startIndex + accountsItemsPerPage;
                    const paginatedAccounts = processedAccounts.slice(startIndex, endIndex);
                    
                    // Combine pending accounts (always show at top, not paginated) with paginated accounts
                    const allAccountsToRender = [...pendingAccounts, ...paginatedAccounts];
                    
                    // Add processing accounts to the top
                    const processingAccountsKeys = new Set(processingAccounts.map(p => `${p.platform}_${p.username}`));
                    
                    // Filter out real accounts that are in processing state (to avoid duplicates)
                    const realAccountsToRender = allAccountsToRender.filter(acc => 
                      !processingAccountsKeys.has(`${acc.platform}_${acc.username}`)
                    );
                    
                    // Render processing accounts first, then real accounts
                    return (
                      <>
                        {processingAccounts.map((procAccount, index) => {
                          // Check if this processing account has started loading (exists in accounts but not fully loaded)
                          const matchingAccount = allAccountsToRender.find(
                            acc => acc.platform === procAccount.platform && acc.username === procAccount.username
                          );
                          const isPartiallyLoaded = matchingAccount && (!matchingAccount.profilePicture && matchingAccount.followerCount === 0);
                          
                          return (
                    <tr 
                              key={`processing-${procAccount.platform}-${procAccount.username}`}
                              className="bg-white/5 dark:bg-white/5 border-l-2 border-white/20 transition-all duration-500"
                    >
                      {/* Username Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="relative w-10 h-10">
                                    {matchingAccount?.profilePicture ? (
                                      <img
                                        src={matchingAccount.profilePicture}
                                        alt={`@${procAccount.username}`}
                                        className="w-10 h-10 rounded-full object-cover animate-fade-in"
                                      />
                                    ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center relative overflow-hidden bg-white/10">
                              <RefreshCw className="w-5 h-5 text-white/60 animate-spin" />
                            </div>
                                    )}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">
                                      {matchingAccount?.displayName || `@${procAccount.username}`}
                            </div>
                            <div className="text-xs text-white/40 font-medium flex items-center gap-1">
                                      {isPartiallyLoaded || !matchingAccount ? (
                                        <>
                              <span className="inline-block w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse"></span>
                                          Loading account data...
                                        </>
                                      ) : (
                                        `@${procAccount.username}`
                                      )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Platform Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <PlatformIcon platform={procAccount.platform as any} size="sm" />
                          <span className="text-sm text-white font-medium capitalize">{procAccount.platform}</span>
                        </div>
                      </td>

                              {/* Other columns - show data if available, else loading placeholders */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                {matchingAccount && accountCreatorNames.get(matchingAccount.id) ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white border border-white/20 animate-fade-in">
                                    <Users className="w-3 h-3 mr-1" />
                                    {accountCreatorNames.get(matchingAccount.id)}
                                  </span>
                                ) : (
                        <div className="w-16 h-4 bg-white/10 rounded-full animate-pulse"></div>
                                )}
                      </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {matchingAccount?.lastSynced ? (
                                  <span className="text-white animate-fade-in">{formatDate(matchingAccount.lastSynced.toDate())}</span>
                                ) : (
                        <div className="w-12 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                                )}
                      </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {matchingAccount && (matchingAccount.followerCount ?? 0) > 0 ? (
                                  <span className="text-white animate-fade-in">{(matchingAccount.followerCount ?? 0).toLocaleString()}</span>
                                ) : (
                        <div className="w-12 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                )}
                      </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {matchingAccount && (matchingAccount.postCount ?? 0) > 0 ? (
                                  <span className="text-white animate-fade-in">{(matchingAccount.postCount ?? 0).toLocaleString()}</span>
                                ) : (
                        <div className="w-16 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                                )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-12 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-12 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                      </td>

                      {/* Actions Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setProcessingAccounts(prev => prev.filter((_, i) => i !== index));
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                            title="Cancel processing"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                          );
                        })}

                        {/* Regular fully-loaded accounts */}
                        {realAccountsToRender.map((account) => {
                      const isAccountSyncing = syncingAccounts.has(account.id);
                      
                      return (
                      <tr 
                        key={account.id}
                        className={clsx(
                          'transition-colors',
                          {
                            'bg-gray-200 dark:bg-gray-800': selectedAccount?.id === account.id && !isAccountSyncing,
                            'bg-white/5 dark:bg-white/5 border-l-2 border-white/20 animate-pulse-slow': isAccountSyncing,
                            'hover:bg-white/5 dark:hover:bg-white/5 cursor-pointer': !isAccountSyncing,
                          }
                        )}
                        onClick={() => !isAccountSyncing && navigate(`/accounts/${account.id}`)}
                      >
                        {/* Username Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <div className="relative w-10 h-10">
                              {account.profilePicture ? (
                                <img
                                  src={account.profilePicture}
                                  alt={`@${account.username}`}
                                  className="w-10 h-10 rounded-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const placeholder = e.currentTarget.parentElement?.querySelector('.placeholder-icon');
                                    if (placeholder) {
                                      placeholder.classList.remove('hidden');
                                    }
                                  }}
                                />
                              ) : null}
                              <div className={`placeholder-icon w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center ${account.profilePicture ? 'hidden' : ''}`}>
                                <Users className="w-5 h-5 text-gray-500" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {account.displayName || account.username}
                                </div>
                                {isAccountSyncing && (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                                      <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                                      <span className="text-xs text-blue-400 font-medium">
                                        Syncing videos...
                                      </span>
                                    </div>
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`Cancel sync for @${account.username}? This will clear the syncing state.`)) {
                                          try {
                                            const accountRef = doc(db, 'organizations', currentOrgId!, 'projects', currentProjectId!, 'trackedAccounts', account.id);
                                            await updateDoc(accountRef, {
                                              syncStatus: 'completed',
                                              lastSyncedAt: new Date(),
                                              syncError: 'Manually cancelled by user'
                                            });
                                          } catch (error) {
                                            console.error('Failed to cancel sync:', error);
                                            alert('Failed to cancel sync');
                                          }
                                        }
                                      }}
                                      className="px-2 py-0.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                                      title="Cancel sync"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">@{account.username}</div>
                            </div>
                          </div>
                        </td>

                        {/* Platform Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <PlatformIcon platform={account.platform} size="sm" />
                            <span className="text-sm text-gray-900 dark:text-white capitalize">{account.platform}</span>
                          </div>
                        </td>

                        {/* Creator Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const creatorName = accountCreatorNames.get(account.id);
                            return creatorName ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white border border-white/20">
                                <Users className="w-3 h-3 mr-1" />
                                {creatorName}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-gray-600">—</span>
                            );
                          })()}
                        </td>

                        {/* Last Post Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {account.lastSynced ? formatDate(account.lastSynced.toDate()) : 'Never'}
                        </td>

                        {/* Followers Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {account.followerCount ? formatNumber(account.followerCount) : 'N/A'}
                        </td>

                        {/* Posts Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatNumber('filteredTotalVideos' in account ? (account as AccountWithFilteredStats).filteredTotalVideos : account.totalVideos)}
                        </td>

                        {/* Views Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white dark:text-white">
                          {formatNumber('filteredTotalViews' in account ? (account as AccountWithFilteredStats).filteredTotalViews : account.totalViews)}
                        </td>

                        {/* Likes Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatNumber('filteredTotalLikes' in account ? (account as AccountWithFilteredStats).filteredTotalLikes : account.totalLikes)}
                        </td>

                        {/* Comments Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatNumber('filteredTotalComments' in account ? (account as AccountWithFilteredStats).filteredTotalComments : account.totalComments)}
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2 relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(openDropdownId === account.id ? null : account.id);
                              }}
                              disabled={isAccountSyncing}
                              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1 hover:bg-white/5 rounded"
                              title="More options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            
                            {/* Dropdown Menu */}
                            {openDropdownId === account.id && (
                              <>
                                <div 
                                  className="fixed inset-0 z-[9998]" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDropdownId(null);
                                  }}
                                />
                                <div className="absolute right-0 top-8 mt-1 w-48 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl z-[9999] py-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenDropdownId(null);
                                      handleRemoveAccount(account.id);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Remove Account
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination for Accounts Table */}
          <div className="mt-6">
            <Pagination
              currentPage={accountsCurrentPage}
              totalPages={Math.ceil(processedAccounts.length / accountsItemsPerPage)}
              totalItems={processedAccounts.length}
              itemsPerPage={accountsItemsPerPage}
              onPageChange={(page) => {
                setAccountsCurrentPage(page);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onItemsPerPageChange={(newItemsPerPage) => {
                setAccountsItemsPerPage(newItemsPerPage);
                setAccountsCurrentPage(1);
              }}
            />
          </div>
          </div>
          )}
        </div>
      ) : (
        /* Account Details View */
        selectedAccount && (
          loadingAccountDetail ? (
            /* Loading Skeleton */
            <div className="space-y-6 animate-pulse">
              {/* Profile Card Skeleton */}
              <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 p-8">
                <div className="flex items-center space-x-6">
                  <div className="w-24 h-24 bg-zinc-800 rounded-2xl"></div>
                  <div className="flex-1 space-y-3">
                    <div className="h-8 bg-zinc-800 rounded w-1/3"></div>
                    <div className="h-4 bg-zinc-800 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
              {/* KPI Cards Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 p-6">
                    <div className="h-4 bg-zinc-800 rounded w-1/2 mb-4"></div>
                    <div className="h-8 bg-zinc-800 rounded w-full"></div>
                  </div>
                ))}
              </div>
              {/* Videos Table Skeleton */}
              <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 p-6">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-16 bg-zinc-800 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
          <div className="space-y-6">
            {/* Account Profile Card */}
            <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 p-8">
              <div className="flex items-center space-x-6">
                <div className="relative">
                  {selectedAccount.profilePicture ? (
                    <ProxiedImage
                      src={selectedAccount.profilePicture}
                      alt={`@${selectedAccount.username}`}
                      className="w-24 h-24 rounded-2xl object-cover border-4 border-gray-100"
                      fallback={
                        <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center border-4 border-gray-100">
                          <Users className="w-12 h-12 text-gray-500" />
                        </div>
                      }
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center border-4 border-gray-100">
                      <Users className="w-12 h-12 text-gray-500" />
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2">
                    <PlatformIcon platform={selectedAccount.platform} size="lg" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedAccount.displayName || `@${selectedAccount.username}`}
                    </h2>
                    {(() => {
                      const creatorName = accountCreatorNames.get(selectedAccount.id);
                      return creatorName ? (
                        <button
                          onClick={() => setShowAttachCreatorModal(true)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-medium rounded-lg transition-colors border border-white/20"
                        >
                          <Users className="w-3 h-3" />
                          {creatorName}
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowAttachCreatorModal(true)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-medium rounded-lg transition-colors border border-white/20"
                        >
                          <Plus className="w-3 h-3" />
                          Attach to Creator
                        </button>
                      );
                    })()}
                  </div>
                  <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-500 dark:text-gray-500">@{selectedAccount.username}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>Joined {formatDate(selectedAccount.dateAdded.toDate())}</span>
                    </div>
                    {selectedAccount.followerCount && (
                      <div>
                        <span className="font-semibold">{formatNumber(selectedAccount.followerCount)}</span> followers
                      </div>
                    )}
                  </div>
                </div>
              </div>

             </div>

            {/* KPI Cards */}
              {(() => {
              // Convert AccountVideo[] to VideoSubmission[]
              // accountVideos is already filtered by both rules AND date
              const filteredVideoSubmissions: VideoSubmission[] = accountVideos.map(video => ({
                id: video.id || video.videoId || '',
                url: video.url || '',
                platform: selectedAccount.platform,
                thumbnail: video.thumbnail || '',
                title: video.caption || video.title || 'No caption',
                uploader: selectedAccount.displayName || selectedAccount.username,
                uploaderHandle: selectedAccount.username,
                uploaderProfilePicture: selectedAccount.profilePicture,
                followerCount: selectedAccount.followerCount,
                status: 'approved' as const,
                views: video.viewsCount || video.views || 0,
                likes: video.likesCount || video.likes || 0,
                comments: video.commentsCount || video.comments || 0,
                shares: video.sharesCount || video.shares || 0,
                dateSubmitted: video.uploadDate || new Date(),
                uploadDate: video.uploadDate || new Date(),
                snapshots: []
              }));

              // ALL videos (unfiltered by date) for PP calculation
              const allVideoSubmissions: VideoSubmission[] = allAccountVideos.map(video => ({
                id: video.id || video.videoId || '',
                url: video.url || '',
                platform: selectedAccount.platform,
                thumbnail: video.thumbnail || '',
                title: video.caption || video.title || 'No caption',
                uploader: selectedAccount.displayName || selectedAccount.username,
                uploaderHandle: selectedAccount.username,
                uploaderProfilePicture: selectedAccount.profilePicture,
                followerCount: selectedAccount.followerCount,
                status: 'approved' as const,
                views: video.viewsCount || video.views || 0,
                likes: video.likesCount || video.likes || 0,
                comments: video.commentsCount || video.comments || 0,
                shares: video.sharesCount || video.shares || 0,
                dateSubmitted: video.uploadDate || new Date(),
                uploadDate: video.uploadDate || new Date(),
                snapshots: []
              }));

              // Filter link clicks for this account
              // 1. Find all links associated with this account
              const accountLinkIds = trackedLinks
                .filter(link => link.linkedAccountId === selectedAccount.id)
                .map(link => link.id);
              
              // 2. Filter clicks to only those from this account's links
              const accountLinkClicks = linkClicks.filter(click => 
                accountLinkIds.includes(click.linkId)
              );

              return (
                <div className="mb-6">
                  <KPICards 
                    submissions={filteredVideoSubmissions}
                    allSubmissions={allVideoSubmissions}
                    linkClicks={accountLinkClicks}
                    dateFilter={dateFilter}
                    timePeriod="days"
                    onCreateLink={() => setShowCreateLinkModal(true)}
                    onVideoClick={async (video) => {
                      // Load snapshots before opening modal
                      if (!currentOrgId || !currentProjectId) return;
                      
                      try {
                        const snapshots = await FirestoreDataService.getVideoSnapshots(
                          currentOrgId,
                          currentProjectId,
                          video.id
                        );
                        
                        const videoWithSnapshots: VideoSubmission = {
                          ...video,
                          snapshots: snapshots
                        };
                        
                        setSelectedVideoForAnalytics(videoWithSnapshots);
                        setIsVideoAnalyticsModalOpen(true);
                      } catch (error) {
                        console.error('❌ Failed to load snapshots:', error);
                        // Still open modal without snapshots
                        setSelectedVideoForAnalytics(video);
                        setIsVideoAnalyticsModalOpen(true);
                      }
                    }}
                    cardVisibility={{
                      revenue: false,
                      downloads: false
                    }}
                  />
                </div>
              );
              })()}

            {/* Videos Table - Using VideoSubmissionsTable for consistent styling */}
            {(() => {
              // Convert sorted videos to VideoSubmissions for the table
              const videoSubmissions: VideoSubmission[] = sortedVideos.map(video => ({
                id: video.id || video.videoId || '',
                url: video.url || '',
                platform: selectedAccount!.platform,
                thumbnail: video.thumbnail || '',
                title: video.caption || video.title || '',
                caption: video.caption || video.title || '',
                uploader: selectedAccount!.displayName || selectedAccount!.username,
                uploaderHandle: selectedAccount!.username,
                uploaderProfilePicture: selectedAccount!.profilePicture,
                followerCount: selectedAccount!.followerCount,
                status: 'approved' as const,
                views: video.viewsCount || video.views || 0,
                likes: video.likesCount || video.likes || 0,
                comments: video.commentsCount || video.comments || 0,
                shares: video.sharesCount || video.shares || 0,
                dateSubmitted: video.uploadDate || new Date(),
                uploadDate: video.uploadDate || new Date(),
                snapshots: []
              }));

              return (
                <div className="mt-6">
                  <VideoSubmissionsTable 
                    submissions={videoSubmissions}
                    onVideoClick={async (video) => {
                      // Load snapshots before opening modal
                      if (!currentOrgId || !currentProjectId) return;
                      
                      try {
                        const snapshots = await FirestoreDataService.getVideoSnapshots(
                          currentOrgId,
                          currentProjectId,
                          video.id
                        );
                        
                        const videoWithSnapshots: VideoSubmission = {
                          ...video,
                          snapshots: snapshots
                        };
                        
                        setSelectedVideoForAnalytics(videoWithSnapshots);
                        setIsVideoAnalyticsModalOpen(true);
                      } catch (error) {
                        console.error('❌ Failed to load snapshots:', error);
                        // Still open modal without snapshots
                        setSelectedVideoForAnalytics(video);
                        setIsVideoAnalyticsModalOpen(true);
                      }
                    }}
                  />
                </div>
              );
            })()}

            {/* OLD Videos Table - HIDDEN via CSS */}
            <div style={{ display: 'none' }} className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-white/5 bg-zinc-900/40">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Recent Videos</h2>
                  <div className="flex items-center space-x-4">
                    <p className="text-sm text-gray-400">{accountVideos.length} total videos</p>
                    
                    {/* Column Visibility Toggle */}
                    <div className="relative">
                      <button
                        onClick={() => setShowColumnToggle(!showColumnToggle)}
                        className="flex items-center space-x-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg hover:border-white/20 transition-colors"
                      >
                        <Filter className="w-4 h-4" />
                        <span>Columns</span>
                      </button>
                      
                      {showColumnToggle && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-800 border border-white/10 rounded-lg shadow-xl p-4 z-50">
                          <h3 className="text-sm font-semibold text-white mb-3">Toggle Columns</h3>
                          <div className="space-y-2">
                            {Object.entries({
                              video: 'Video',
                              platform: 'Platform',
                              preview: 'Preview',
                              trend: 'Trend',
                              views: 'Views',
                              likes: 'Likes',
                              comments: 'Comments',
                              shares: 'Shares',
                              engagement: 'Engagement Rate',
                              uploadDate: 'Upload Date'
                            }).map(([key, label]) => (
                              <label key={key} className="flex items-center space-x-2 cursor-pointer hover:bg-white/5 p-2 rounded">
                                <input
                                  type="checkbox"
                                  checked={visibleColumns[key as keyof typeof visibleColumns]}
                                  onChange={(e) => setVisibleColumns(prev => ({ ...prev, [key]: e.target.checked }))}
                                  className="w-4 h-4 rounded border-gray-600 text-gray-900 dark:text-white focus:ring-gray-900 dark:focus:ring-white"
                                />
                                <span className="text-sm text-gray-300">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {accountVideos.length > 0 ? (
                <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max">
                    <thead>
                      <tr className="border-b border-white/5">
                        {visibleColumns.video && (
                          <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider sticky left-0 bg-zinc-900/60 backdrop-blur z-10 min-w-[280px]">
                            Video
                          </th>
                        )}
                        {visibleColumns.platform && (
                          <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[100px]">
                            Platform
                          </th>
                        )}
                        {visibleColumns.preview && (
                          <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[100px]">
                            Preview
                          </th>
                        )}
                        {visibleColumns.trend && (
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px]">
                            Trend
                          </th>
                        )}
                        {visibleColumns.views && (
                          <th 
                            className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[120px] cursor-pointer hover:text-white transition-colors select-none"
                            onClick={() => handleSort('views')}
                          >
                            <div className="flex items-center gap-1">
                              Views
                              {sortColumn === 'views' && (
                                <span className="text-white">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                        )}
                        {visibleColumns.likes && (
                          <th 
                            className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[120px] cursor-pointer hover:text-white transition-colors select-none"
                            onClick={() => handleSort('likes')}
                          >
                            <div className="flex items-center gap-1">
                              Likes
                              {sortColumn === 'likes' && (
                                <span className="text-white">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                        )}
                        {visibleColumns.comments && (
                          <th 
                            className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[120px] cursor-pointer hover:text-white transition-colors select-none"
                            onClick={() => handleSort('comments')}
                          >
                            <div className="flex items-center gap-1">
                              Comments
                              {sortColumn === 'comments' && (
                                <span className="text-white">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                        )}
                        {visibleColumns.shares && (
                          <th 
                            className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[120px] cursor-pointer hover:text-white transition-colors select-none"
                            onClick={() => handleSort('shares')}
                          >
                            <div className="flex items-center gap-1">
                              Shares
                              {sortColumn === 'shares' && (
                                <span className="text-white">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                        )}
                        {visibleColumns.engagement && (
                          <th 
                            className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[140px] cursor-pointer hover:text-white transition-colors select-none"
                            onClick={() => handleSort('engagement')}
                          >
                            <div className="flex items-center gap-1">
                              Engagement
                              {sortColumn === 'engagement' && (
                                <span className="text-white">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                        )}
                        {visibleColumns.uploadDate && (
                          <th 
                            className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[120px] cursor-pointer hover:text-white transition-colors select-none"
                            onClick={() => handleSort('uploadDate')}
                          >
                            <div className="flex items-center gap-1">
                              Upload Date
                              {sortColumn === 'uploadDate' && (
                                <span className="text-white">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                        )}
                        <th className="w-12 px-6 py-4 text-left"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-zinc-900/60 divide-y divide-white/5">
                      {(() => {
                        // Pagination calculations (use sortedVideos)
                        const startIndex = (currentPage - 1) * itemsPerPage;
                        const endIndex = startIndex + itemsPerPage;
                        const paginatedVideos = sortedVideos.slice(startIndex, endIndex);
                        
                        return paginatedVideos.map((video) => {
                        const views = video.viewsCount || video.views || 0;
                        const likes = video.likesCount || video.likes || 0;
                        const comments = video.commentsCount || video.comments || 0;
                        const shares = video.sharesCount || video.shares || 0;
                        const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
                        
                        // Convert AccountVideo to VideoSubmission for TrendCalculationService
                        const videoSubmission: VideoSubmission = {
                          id: video.id || video.videoId || '',
                          url: video.url || '',
                          platform: selectedAccount.platform,
                          thumbnail: video.thumbnail || '',
                          title: video.caption || video.title || 'No caption',
                          uploader: selectedAccount.displayName || selectedAccount.username,
                          uploaderHandle: selectedAccount.username,
                          uploaderProfilePicture: selectedAccount.profilePicture,
                          followerCount: selectedAccount.followerCount,
                          status: 'approved' as const,
                          views: views,
                          likes: likes,
                          comments: comments,
                          shares: shares,
                          dateSubmitted: new Date(),
                          uploadDate: video.uploadDate || new Date(),
                          snapshots: []
                        };

                        return (
                          <tr 
                            key={video.id}
                            className="hover:bg-white/5 transition-colors cursor-pointer group"
                            onClick={async () => {
                              if (!currentOrgId || !currentProjectId) return;
                              
                              try {
                                // Fetch snapshots for this video
                                const snapshots = await FirestoreDataService.getVideoSnapshots(
                                  currentOrgId, 
                                  currentProjectId, 
                                  video.id || video.videoId || ''
                                );
                                
                                // Update videoSubmission with snapshots
                                const videoSubmissionWithSnapshots: VideoSubmission = {
                                  ...videoSubmission,
                                  snapshots: snapshots
                                };
                                
                                setSelectedVideoForAnalytics(videoSubmissionWithSnapshots);
                                setIsVideoAnalyticsModalOpen(true);
                              } catch (error) {
                                console.error('❌ Failed to load snapshots:', error);
                                // Still open modal without snapshots
                                setSelectedVideoForAnalytics(videoSubmission);
                                setIsVideoAnalyticsModalOpen(true);
                              }
                            }}
                          >
                            {visibleColumns.video && (
                            <td className="px-6 py-5 sticky left-0 bg-zinc-900/60 backdrop-blur z-10 group-hover:bg-white/5">
                              <div className="flex items-center space-x-4">
                                <div className="relative">
                                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 ring-2 ring-white shadow-sm">
                                    {video.thumbnail ? (
                                      <img 
                                        src={video.thumbnail} 
                                        alt="Thumbnail"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-gray-700">
                                        <Play className="w-4 h-4 text-gray-400" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="absolute -bottom-1 -right-1">
                                    <PlatformIcon platform={selectedAccount.platform} size="sm" />
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1 max-w-[200px]">
                                  <p className="text-sm font-medium text-white truncate" title={video.caption || video.title || 'No caption'}>
                                    {(() => {
                                      const fullCaption = video.caption || video.title || 'No caption';
                                      return fullCaption.length > 20 ? fullCaption.substring(0, 20) + '...' : fullCaption;
                                    })()}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1 truncate">
                                    @{selectedAccount.username}
                                  </p>
                                </div>
                              </div>
                            </td>
                            )}
                            {visibleColumns.platform && (
                            <td className="px-6 py-5">
                              <PlatformIcon platform={selectedAccount.platform} size="md" />
                            </td>
                            )}
                            {visibleColumns.preview && (
                            <td className="px-6 py-5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  
                                  console.log('Opening video player:', {
                                    videoId: video.videoId,
                                    url: video.url,
                                    platform: selectedAccount.platform,
                                    hasUrl: !!video.url
                                  });
                                  
                                  // Validate URL before opening player
                                  if (!video.url || video.url.trim() === '') {
                                    console.error('❌ Video URL is empty, cannot open player');
                                    alert('This video has no URL. Please refresh the account to sync video data.');
                                    return;
                                  }
                                  
                                  setSelectedVideoForPlayer({
                                    url: video.url,
                                    title: video.caption || video.title || 'No caption',
                                    platform: selectedAccount.platform
                                  });
                                  setVideoPlayerOpen(true);
                                }}
                                className="block hover:opacity-80 transition-opacity group/video cursor-pointer"
                              >
                                <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 shadow-sm hover:shadow-md transition-all relative">
                                  {video.thumbnail ? (
                                    <img 
                                      src={video.thumbnail} 
                                      alt="Thumbnail"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-700">
                                      <Play className="w-6 h-6 text-gray-400" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/0 group-hover/video:bg-black/40 transition-colors flex items-center justify-center">
                                    <svg className="w-8 h-8 text-white opacity-0 group-hover/video:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                    </svg>
                                  </div>
                                </div>
                              </button>
                            </td>
                            )}
                            {visibleColumns.trend && (
                            <td className="px-6 py-5">
                              <MiniTrendChart 
                                data={TrendCalculationService.getViewsTrend(videoSubmission)}
                                className="flex items-center justify-center"
                              />
                            </td>
                            )}
                            {visibleColumns.views && (
                            <td className="px-6 py-5">
                              <div className="flex items-center space-x-2">
                                <Eye className="w-4 h-4 text-white" />
                                <span className="text-sm font-medium text-white">
                                  {formatNumber(views)}
                                </span>
                              </div>
                            </td>
                            )}
                            {visibleColumns.likes && (
                            <td className="px-6 py-5">
                              <div className="flex items-center space-x-2">
                                <Heart className="w-4 h-4 text-white" />
                                <span className="text-sm font-medium text-white">
                                  {formatNumber(likes)}
                                </span>
                              </div>
                            </td>
                            )}
                            {visibleColumns.comments && (
                            <td className="px-6 py-5">
                              <div className="flex items-center space-x-2">
                                <MessageCircle className="w-4 h-4 text-white" />
                                <span className="text-sm font-medium text-white">
                                  {formatNumber(comments)}
                                </span>
                              </div>
                            </td>
                            )}
                            {visibleColumns.shares && (
                            <td className="px-6 py-5">
                              <div className="flex items-center space-x-2">
                                <Share2 className="w-4 h-4 text-white" />
                                <span className="text-sm font-medium text-white">
                                  {formatNumber(shares)}
                                </span>
                              </div>
                            </td>
                            )}
                            {visibleColumns.engagement && (
                            <td className="px-6 py-5">
                              <div className="flex items-center space-x-2">
                                <Activity className="w-4 h-4 text-white/70" />
                                <span className="text-sm font-medium text-white">
                                  {engagementRate.toFixed(2)}%
                                </span>
                              </div>
                            </td>
                            )}
                            {visibleColumns.uploadDate && (
                            <td className="px-6 py-5">
                              <div className="text-sm text-zinc-300">
                                {video.uploadDate ? 
                                  new Date(video.uploadDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  }) : 
                                  (video.timestamp ? 
                                    new Date(video.timestamp).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    }) : 
                                    'Unknown'
                                  )
                                }
                              </div>
                            </td>
                            )}
                            <td className="px-6 py-5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(video.url, '_blank');
                                }}
                                className="text-gray-400 hover:text-white transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(sortedVideos.length / itemsPerPage)}
                  itemsPerPage={itemsPerPage}
                  totalItems={sortedVideos.length}
                  onPageChange={(page) => {
                    setCurrentPage(page);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onItemsPerPageChange={(newItemsPerPage) => {
                    setItemsPerPage(newItemsPerPage);
                    setCurrentPage(1);
                  }}
                />
                </>
              
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Play className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-white mb-2">No videos synced</h4>
                  <p className="text-gray-400 mb-6">
                    Click "Sync Videos" to fetch all videos from this account
                  </p>
                  <button
                    onClick={() => handleSyncAccount(selectedAccount.id)}
                    disabled={isSyncing === selectedAccount.id}
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 border border-white/10"
                  >
                    <RefreshCw className={clsx('w-4 h-4', { 'animate-spin': isSyncing === selectedAccount.id })} />
                    <span>{isSyncing === selectedAccount.id ? 'Syncing...' : 'Sync Videos'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          )
        )
      )}


      {/* Add Account Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151515] rounded-[14px] w-full max-w-[580px] shadow-2xl" style={{ padding: '24px' }}>
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Track Accounts</h2>
                <p className="text-sm text-[#A1A1AA]">Enter accounts you want to track videos & analytics for.</p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setNewAccountUrl('');
                  setDetectedPlatform(null);
                  setUrlValidationError(null);
                  setAccountInputs([{ id: '1', url: '', platform: null, error: null, videoCount: 10 }]);
                }}
                className="text-white/80 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>
            
            {/* Input Fields - Multiple */}
            <div className="space-y-3 mb-6 max-h-[400px] overflow-y-auto">
              {accountInputs.map((input, index) => (
                <div key={input.id} className="flex gap-2 items-start">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={index === 0 ? newAccountUrl : input.url}
                      onChange={(e) => {
                        if (index === 0) {
                          handleUrlChange(e.target.value);
                          // Also update accountInputs[0] for consistency
                          const newInputs = [...accountInputs];
                          newInputs[0].url = e.target.value;
                          const result = UrlParserService.parseUrl(e.target.value);
                          newInputs[0].platform = result.platform || null;
                          newInputs[0].error = !result.isValid && e.target.value.trim() ? 'Invalid URL' : null;
                          setAccountInputs(newInputs);
                        } else {
                          const newInputs = [...accountInputs];
                          newInputs[index].url = e.target.value;
                          // Detect platform
                          const result = UrlParserService.parseUrl(e.target.value);
                          newInputs[index].platform = result.platform || null;
                          newInputs[index].error = !result.isValid && e.target.value.trim() ? 'Invalid URL' : null;
                          setAccountInputs(newInputs);
                        }
                      }}
                      placeholder="Enter TikTok, YouTube, Instagram, or X URL"
                      className="w-full pl-4 pr-10 py-2.5 bg-[#1E1E20] border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 text-sm"
                    />
                    {(index === 0 ? detectedPlatform : input.platform) ? (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <PlatformIcon platform={index === 0 ? detectedPlatform! : input.platform!} size="sm" />
                      </div>
                    ) : (
                      <LinkIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
                    )}
                  </div>
                  
                  {/* Video count selector for each input */}
                  <div className="relative">
                    <select
                      value={input.videoCount}
                      onChange={(e) => {
                        const newInputs = [...accountInputs];
                        newInputs[index].videoCount = Number(e.target.value);
                        setAccountInputs(newInputs);
                      }}
                      className="appearance-none pl-3 pr-8 py-2.5 bg-[#1E1E20] border border-gray-700/50 rounded-full text-white text-sm font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/20 whitespace-nowrap"
                    >
                      <option value={10}>10 videos</option>
                      <option value={25}>25 videos</option>
                      <option value={50}>50 videos</option>
                      <option value={100}>100 videos</option>
                      <option value={250}>250 videos</option>
                      <option value={500}>500 videos</option>
                      <option value={1000}>1000 videos</option>
                      <option value={2000}>2000 videos</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>

                  {/* Delete button for additional inputs */}
                  {index > 0 && (
                    <button
                      onClick={() => {
                        setAccountInputs(prev => prev.filter(i => i.id !== input.id));
                      }}
                      className="p-2.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  )}
                  {/* Spacer for first input when alone */}
                  {index === 0 && accountInputs.length === 1 && (
                    <div className="w-10" /> 
                  )}
                </div>
              ))}

              {/* Show validation error */}
              {urlValidationError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-300">
                    {urlValidationError}
                  </span>
                </div>
              )}

              {/* Usage Limit Warnings */}
              {(() => {
                const validAccountsCount = accountInputs.filter(input => input.url.trim() && input.platform).length;
                const totalVideosRequested = accountInputs.reduce((sum, input) => {
                  if (input.url.trim() && input.platform) {
                    return sum + input.videoCount;
                  }
                  return sum;
                }, 0);

                const accountsOverLimit = validAccountsCount > usageLimits.accountsLeft;
                const videosOverLimit = totalVideosRequested > usageLimits.videosLeft;
                const accountsToAdd = Math.min(validAccountsCount, usageLimits.accountsLeft);
                const videosToAdd = Math.min(totalVideosRequested, usageLimits.videosLeft);

                if (usageLimits.isAtAccountLimit) {
                  return (
                    <div className="flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-300 mb-1">
                          Account limit reached!
                        </p>
                        <p className="text-xs text-red-300/80 mb-2">
                          You've reached your maximum of tracked accounts. Upgrade to add more.
                        </p>
                        <button
                          onClick={() => navigate('/subscription')}
                          className="text-xs font-medium text-white bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-md transition-colors"
                        >
                          Upgrade Plan →
                        </button>
                      </div>
                    </div>
                  );
                }

                if (accountsOverLimit || videosOverLimit) {
                  return (
                    <div className="flex items-start gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-300 mb-1">
                          Limit warning
                        </p>
                        <p className="text-xs text-yellow-300/80 mb-2">
                          {accountsOverLimit && (
                            <>Only <span className="font-semibold">{accountsToAdd} of {validAccountsCount} accounts</span> will be tracked. </>
                          )}
                          {videosOverLimit && (
                            <>Only <span className="font-semibold">{videosToAdd} of {totalVideosRequested} videos</span> will be scraped. </>
                          )}
                          {(accountsOverLimit || videosOverLimit) && (
                            <>You have {usageLimits.accountsLeft} account slots and {usageLimits.videosLeft} video slots remaining.</>
                          )}
                        </p>
                        <button
                          onClick={() => navigate('/subscription')}
                          className="text-xs font-medium text-white bg-yellow-500/20 hover:bg-yellow-500/30 px-3 py-1.5 rounded-md transition-colors"
                        >
                          Upgrade for More →
                        </button>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-800/50">
              <div className="flex items-center gap-2 text-[#9B9B9B] text-xs">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Processing takes up to 5 minutes.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Add another input field, copying videoCount from the last input
                    setAccountInputs(prev => {
                      const lastInput = prev[prev.length - 1];
                      const videoCountToCopy = lastInput?.videoCount || 10;
                      return [...prev, { 
                        id: Date.now().toString(), 
                        url: '', 
                        platform: null, 
                        error: null,
                        videoCount: videoCountToCopy 
                      }];
                    });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-300 border border-gray-700 rounded-full hover:border-gray-600 hover:text-white transition-colors"
                >
                  Add More
                </button>
                <button
                  onClick={handleAddAccount}
                  disabled={usageLimits.isAtAccountLimit || (!newAccountUrl.trim() && !accountInputs.slice(1).some(input => input.url.trim() && input.platform))}
                  className="px-4 py-2 text-sm font-bold text-black bg-white rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  {usageLimits.isAtAccountLimit ? 'Limit Reached' : 'Track Accounts'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {selectedVideoForPlayer && (
        <VideoPlayerModal
          isOpen={videoPlayerOpen}
          onClose={() => {
            setVideoPlayerOpen(false);
            setSelectedVideoForPlayer(null);
          }}
          videoUrl={selectedVideoForPlayer.url}
          title={selectedVideoForPlayer.title}
          platform={selectedVideoForPlayer.platform}
        />
      )}

      {/* Video Analytics Modal */}
      <VideoAnalyticsModal
        video={selectedVideoForAnalytics}
        isOpen={isVideoAnalyticsModalOpen}
        onClose={() => {
          setIsVideoAnalyticsModalOpen(false);
          setSelectedVideoForAnalytics(null);
        }}
        totalCreatorVideos={
          selectedVideoForAnalytics
            ? allAccountVideos.filter(
                v => v.uploaderHandle === selectedVideoForAnalytics.uploaderHandle
              ).length
            : undefined
        }
        hideDateFilter={true}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && accountToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0A0A0A] rounded-2xl w-full max-w-md border border-white/10 shadow-2xl">
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Delete Account</h2>
                </div>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setAccountToDelete(null);
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <p className="text-gray-400 text-sm mb-3">
                Are you sure you want to delete <span className="text-white font-medium">@{accountToDelete.username}</span>?
              </p>
              <p className="text-gray-500 text-xs">
                This will permanently delete {accountToDelete.totalVideos || 0} videos and all account data
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setAccountToDelete(null);
                }}
                className="px-6 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAccount}
                className="px-6 py-2.5 bg-white hover:bg-gray-100 text-black rounded-full transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Link Modal */}
      {showCreateLinkModal && selectedAccount && (
        <CreateLinkModal
          isOpen={showCreateLinkModal}
          onClose={() => setShowCreateLinkModal(false)}
          onCreate={handleCreateLink}
          preselectedAccountId={selectedAccount.id}
        />
      )}

      {/* Attach to Creator Modal */}
      {showAttachCreatorModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 dark:bg-zinc-900 rounded-2xl p-8 w-full max-w-md shadow-2xl border border-gray-300 dark:border-gray-700">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Attach to Creator</h2>
              <p className="text-gray-400">
                Link @{selectedAccount.username} to a creator profile
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                <div className="flex items-center gap-3">
                  {selectedAccount.profilePicture ? (
                    <img 
                      src={selectedAccount.profilePicture} 
                      alt={selectedAccount.username}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-white">@{selectedAccount.username}</div>
                    <div className="text-sm text-gray-400 capitalize">{selectedAccount.platform}</div>
                  </div>
                </div>
              </div>

              {creators.length > 0 ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Select Creator
                    </label>
                    <select
                      value={selectedCreatorId}
                      onChange={(e) => setSelectedCreatorId(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Choose a creator...</option>
                      {creators.map((creator) => (
                        <option key={creator.id} value={creator.id}>
                          {creator.displayName} ({creator.email})
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-gray-500">
                      Link this account to a creator for better organization and tracking
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowAttachCreatorModal(false);
                        setSelectedCreatorId('');
                      }}
                      className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (selectedCreatorId && user && currentOrgId && currentProjectId) {
                          try {
                            await CreatorLinksService.linkCreatorToAccounts(
                              currentOrgId,
                              currentProjectId,
                              selectedCreatorId,
                              [selectedAccount.id],
                              user.uid
                            );
                            
                            // Reload creator names to update UI
                            const creatorName = await CreatorLinksService.getCreatorNameForAccount(
                              currentOrgId,
                              currentProjectId,
                              selectedAccount.id
                            );
                            
                            if (creatorName) {
                              setAccountCreatorNames(prev => {
                                const updated = new Map(prev);
                                updated.set(selectedAccount.id, creatorName);
                                return updated;
                              });
                            }
                            
                            setShowAttachCreatorModal(false);
                            setSelectedCreatorId('');
                          } catch (error) {
                            console.error('Failed to attach account to creator:', error);
                            alert('Failed to attach account. Please try again.');
                          }
                        }
                      }}
                      disabled={!selectedCreatorId}
                      className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-white/20"
                    >
                      Attach Account
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-zinc-800/30 rounded-lg p-6 border border-zinc-700/50 text-center">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6 text-gray-900 dark:text-white" />
                    </div>
                    <h3 className="text-white font-medium mb-2">No Creators Found</h3>
                    <p className="text-sm text-gray-400 mb-4">
                      You need to create a creator profile first before linking accounts
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg text-sm text-white/60 border border-white/20">
                      <AlertCircle className="w-4 h-4" />
                      Go to <span className="font-semibold">Creators</span> tab to create one
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowAttachCreatorModal(false)}
                      className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

AccountsPage.displayName = 'AccountsPage';

export default AccountsPage;
