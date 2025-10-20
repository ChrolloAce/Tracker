import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import { collection, query, where, getDocs, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import Lottie from 'lottie-react';
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
  Edit2,
  CheckCircle2,
  Circle,
  Link as LinkIcon,
  X,
  ChevronDown,
  MoreVertical
  } from 'lucide-react';
import pricingPlansAnimation from '../../public/lottie/Pricing Plans.json';
import { AccountVideo } from '../types/accounts';
import { TrackedAccount } from '../types/firestore';
import { VideoSubmissionsTable } from './VideoSubmissionsTable';
import { AccountTrackingServiceFirebase } from '../services/AccountTrackingServiceFirebase';
import FirestoreDataService from '../services/FirestoreDataService';
import RulesService from '../services/RulesService';
import CreatorLinksService from '../services/CreatorLinksService';
import { TrackingRule, RuleCondition, RuleConditionType } from '../types/rules';
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
import { Modal } from './ui/Modal';
import { UrlParserService } from '../services/UrlParserService';
import Pagination from './ui/Pagination';
import ColumnPreferencesService from '../services/ColumnPreferencesService';
import KPICards from './KPICards';
import DateFilterService from '../services/DateFilterService';
import CreateLinkModal from './CreateLinkModal';
import LinkClicksService, { LinkClick } from '../services/LinkClicksService';
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
  ({ dateFilter, platformFilter, searchQuery = '', onViewModeChange, pendingAccounts = [] }, ref) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<AccountWithFilteredStats[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<TrackedAccount | null>(null);
  
  // Track if we've already done the initial restoration from localStorage
  const hasRestoredFromLocalStorage = useRef(false);
  const [accountVideos, setAccountVideos] = useState<AccountVideo[]>([]);
  const [allAccountVideos, setAllAccountVideos] = useState<AccountVideo[]>([]); // Unfiltered for PP calculation
  const [activeRulesCount, setActiveRulesCount] = useState(0);
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
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [allRules, setAllRules] = useState<TrackingRule[]>([]);
  const [accountRules, setAccountRules] = useState<string[]>([]); // Rule IDs applied to the account
  const [loadingRules, setLoadingRules] = useState(false);
  const [showCreateRuleForm, setShowCreateRuleForm] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [conditions, setConditions] = useState<RuleCondition[]>([
    { id: '1', type: 'description_contains', value: '', operator: 'AND' }
  ]);
  
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

  // Helper function to count how many rules are applied to an account
  const getRulesCountForAccount = useCallback((accountId: string) => {
    return allRules.filter(rule => {
      if (!rule.isActive) return false;
      const { accountIds } = rule.appliesTo;
      return accountIds && accountIds.length > 0 && accountIds.includes(accountId);
    }).length;
  }, [allRules]);

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

  // Handle back to table navigation
  const handleBackToTable = useCallback(() => {
    setSelectedAccount(null);
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
    
    // Apply rules to filter videos
    
    // Get active rules for this account
    const accountRules = await RulesService.getRulesForAccount(
      currentOrgId,
      currentProjectId,
      accountId,
      account.platform
    );
    setActiveRulesCount(accountRules.length);
    
    const rulesFilteredVideos = await RulesService.filterVideosByRules(
      currentOrgId,
      currentProjectId,
      accountId,
      account.platform,
      videos
    );
    
    
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
  }, [currentOrgId, currentProjectId, accounts, dateFilter]);

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

  // Load videos and rules when an account is selected
  useEffect(() => {
    if (selectedAccount && currentOrgId && currentProjectId) {
      loadAccountVideos(selectedAccount.id);
      setViewMode('details');
      onViewModeChange('details');
      // Save to localStorage for restoration
      localStorage.setItem('selectedAccountId', selectedAccount.id);
    }
  }, [selectedAccount?.id, currentOrgId, currentProjectId]);

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

      // Auto-cleanup: Remove from processing if account now exists in real list
      setProcessingAccounts(prev => {
        const accountKeys = new Set(loadedAccounts.map(acc => `${acc.platform}_${acc.username}`));
        const remaining = prev.filter(proc => !accountKeys.has(`${proc.platform}_${proc.username}`));
        if (remaining.length < prev.length) {
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

  // Load all rules for the project
  useEffect(() => {
    const loadRules = async () => {
      if (!currentOrgId || !currentProjectId) return;

      try {
        const rules = await RulesService.getRules(currentOrgId, currentProjectId);
        setAllRules(rules);
      } catch (error) {
        console.error('❌ Failed to load rules:', error);
      }
    };

    loadRules();
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
          
          // 🔑 STEP 1: Apply rules filtering (if account has rules)
          const accountRules = allRules.filter(r => 
            r.appliesTo.accountIds && r.appliesTo.accountIds.includes(account.id)
          );
          const rulesFilteredVideos = accountRules.length > 0
            ? accountVideos.filter(video => RulesService.videoMatchesRules(video, accountRules))
            : accountVideos;

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
  }, [accounts, currentOrgId, currentProjectId, dateFilter, viewMode, allRules]);

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

  // REAL-TIME listener for selected account's videos
  useEffect(() => {
    if (!selectedAccount || !currentOrgId || !currentProjectId) {
      setViewMode('table');
      onViewModeChange('table');
      setAccountVideos([]);
      localStorage.removeItem('selectedAccountId');
      return;
    }

    setViewMode('details');
    onViewModeChange('details');
    localStorage.setItem('selectedAccountId', selectedAccount.id);
    setCurrentPage(1);

    // Load videos from the MAIN videos collection, filtered by trackedAccountId
    const videosRef = collection(
      db, 
      'organizations', currentOrgId, 
      'projects', currentProjectId, 
      'videos'
    );
    const videosQuery = query(
      videosRef, 
      where('trackedAccountId', '==', selectedAccount.id),
      orderBy('uploadDate', 'desc')
    );

    // One-time load for videos (replaced real-time listener)
    (async () => {
      try {
        const snapshot = await getDocs(videosQuery);
      
      const videos: AccountVideo[] = snapshot.docs.map(doc => {
        const data = doc.data();
        
        return {
          id: doc.id,
          accountId: selectedAccount.id,
          videoId: data.videoId || '',
          url: data.videoUrl || data.url || '',
          thumbnail: data.thumbnail || '',
          caption: data.caption || data.videoTitle || '',
          title: data.videoTitle || data.caption || '',
          uploadDate: data.uploadDate?.toDate() || new Date(),
          views: data.views || 0,
          viewsCount: data.views || 0,
          likes: data.likes || 0,
          likesCount: data.likes || 0,
          comments: data.comments || 0,
          commentsCount: data.comments || 0,
          shares: data.shares || 0,
          sharesCount: data.shares || 0,
          duration: data.duration || 0,
          isSponsored: data.isSponsored || false,
          hashtags: data.hashtags || [],
          mentions: data.mentions || []
        } as AccountVideo;
      });

      // Apply rules filtering
      const rulesFilteredVideos = await RulesService.filterVideosByRules(
        currentOrgId,
        currentProjectId,
        selectedAccount.id,
        selectedAccount.platform,
        videos
      );

      // Apply date filtering
      const videoSubmissions: VideoSubmission[] = rulesFilteredVideos.map(v => ({
        id: v.id || v.videoId || '',
        url: v.url || '',
        platform: selectedAccount.platform,
        thumbnail: v.thumbnail || '',
        title: v.caption || v.title || '',
        caption: v.caption || v.title || '',
        uploader: selectedAccount.displayName || selectedAccount.username,
        uploaderHandle: selectedAccount.username,
        uploaderProfilePicture: selectedAccount.profilePicture,
        followerCount: selectedAccount.followerCount,
        status: 'approved' as const,
        views: v.views || 0,
        likes: v.likes || 0,
        comments: v.comments || 0,
        shares: v.shares || 0,
        dateSubmitted: v.uploadDate || new Date(),
        uploadDate: v.uploadDate || new Date(),
        snapshots: []
      }));

      // Store unfiltered videos for PP calculation
      setAllAccountVideos(rulesFilteredVideos);

      const dateFilteredSubmissions = DateFilterService.filterVideosByDateRange(
        videoSubmissions,
        dateFilter
      );

      // Convert back to AccountVideo
      const finalFilteredVideos: AccountVideo[] = dateFilteredSubmissions.map(sub => {
        const originalVideo = rulesFilteredVideos.find(v => (v.id || v.videoId) === sub.id);
        return originalVideo || sub as any;
      });

      setAccountVideos(finalFilteredVideos);
      } catch (error) {
        console.error('❌ Failed to load videos:', error);
      }
    })();
  }, [selectedAccount, currentOrgId, currentProjectId, onViewModeChange, dateFilter]);

  const handleSyncAccount = useCallback(async (accountId: string) => {
    if (!currentOrgId || !currentProjectId || !user) return;

    setIsSyncing(accountId);
    setSyncError(null);
    try {
      const videoCount = await AccountTrackingServiceFirebase.syncAccountVideos(currentOrgId, currentProjectId, user.uid, accountId);
      
      // Update accounts list
      const updatedAccounts = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
      setAccounts(updatedAccounts);
      
      // Update videos if this account is selected
      if (selectedAccount?.id === accountId) {
        const videos = await AccountTrackingServiceFirebase.getAccountVideos(currentOrgId, currentProjectId, accountId);
        
        // Apply rules to filter
        const filteredVideos = await RulesService.filterVideosByRules(
          currentOrgId,
          currentProjectId,
          accountId,
          selectedAccount.platform,
          videos
        );
        setAccountVideos(filteredVideos);
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
  }, [selectedAccount, currentOrgId, user]);

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
    if (deleteConfirmText !== accountToDelete.username) return;

    try {
      await AccountTrackingServiceFirebase.removeAccount(currentOrgId, currentProjectId, accountToDelete.id);
      setAccounts(prev => prev.filter(a => a.id !== accountToDelete.id));
      
      if (selectedAccount?.id === accountToDelete.id) {
        setSelectedAccount(null);
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

  // Rule management functions
  const handleOpenRuleModal = useCallback(async () => {
    if (!currentOrgId || !currentProjectId || !selectedAccount) return;
    
    setLoadingRules(true);
    setIsRuleModalOpen(true);
    
    try {
      // Load all rules for the project
      const rules = await RulesService.getRules(currentOrgId, currentProjectId);
      setAllRules(rules);
      
      // Get rules currently applied to this account
      const appliedRules = await RulesService.getRulesForAccount(
        currentOrgId,
        currentProjectId,
        selectedAccount.id,
        selectedAccount.platform
      );
      setAccountRules(appliedRules.map(r => r.id));
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoadingRules(false);
    }
  }, [currentOrgId, currentProjectId, selectedAccount]);

  const handleToggleRule = useCallback(async (ruleId: string) => {
    if (!currentOrgId || !currentProjectId || !selectedAccount) return;
    
    const rule = allRules.find(r => r.id === ruleId);
    if (!rule) return;
    
    try {
      const isCurrentlyApplied = accountRules.includes(ruleId);
      let updatedAccountIds: string[] = [];
      
      if (isCurrentlyApplied) {
        // Remove account from rule
        updatedAccountIds = (rule.appliesTo.accountIds || []).filter((id: string) => id !== selectedAccount.id);
      } else {
        // Add account to rule
        updatedAccountIds = [...(rule.appliesTo.accountIds || []), selectedAccount.id];
      }
      
      // Update rule in Firestore
      await RulesService.updateRule(currentOrgId, currentProjectId, ruleId, {
        appliesTo: {
          ...rule.appliesTo,
          accountIds: updatedAccountIds // Keep as array even if empty (empty = not applied to any account)
        }
      });
      
      // Update local state
      if (isCurrentlyApplied) {
        setAccountRules(prev => prev.filter(id => id !== ruleId));
      } else {
        setAccountRules(prev => [...prev, ruleId]);
      }
      
      // Reload all rules to stay in sync
      const updatedRules = await RulesService.getRules(currentOrgId, currentProjectId);
      setAllRules(updatedRules);
      
      // Recalculate active rules count
      const appliedRules = await RulesService.getRulesForAccount(
        currentOrgId,
        currentProjectId,
        selectedAccount.id,
        selectedAccount.platform
      );
      setActiveRulesCount(appliedRules.length);
      
      // Reload videos with updated rules
      await loadAccountVideos(selectedAccount.id);
      
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      alert('Failed to update rule. Please try again.');
    }
  }, [currentOrgId, currentProjectId, selectedAccount, allRules, accountRules, loadAccountVideos]);

  // Rule creation functions
  const handleShowCreateForm = useCallback(() => {
    setShowCreateRuleForm(true);
    setRuleName('');
    setConditions([{ id: '1', type: 'description_contains', value: '', operator: 'AND' }]);
  }, []);

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

  const handleSaveRule = useCallback(async () => {
    if (!user || !currentOrgId || !currentProjectId || !selectedAccount) return;
    if (!ruleName.trim() || conditions.filter(c => c.value !== '').length === 0) return;

    try {
      const ruleData = {
        name: ruleName,
        conditions: conditions.filter(c => c.value !== ''),
        appliesTo: {
          platforms: [selectedAccount.platform],
          accountIds: [selectedAccount.id]
        },
        isActive: true
      };

      await RulesService.createRule(currentOrgId, currentProjectId, user.uid, ruleData);
      
      // Reload rules
      const rules = await RulesService.getRules(currentOrgId, currentProjectId);
      setAllRules(rules);
      
      // Get applied rules for this account
      const appliedRules = await RulesService.getRulesForAccount(
        currentOrgId,
        currentProjectId,
        selectedAccount.id,
        selectedAccount.platform
      );
      setAccountRules(appliedRules.map(r => r.id));
      setActiveRulesCount(appliedRules.length);
      
      // Reset form and show list
      setShowCreateRuleForm(false);
      setRuleName('');
      setConditions([{ id: '1', type: 'description_contains', value: '', operator: 'AND' }]);
      
      // Reload videos with new rule
      setSelectedAccount({ ...selectedAccount });
      
    } catch (error) {
      console.error('Failed to create rule:', error);
      alert('Failed to create rule. Please try again.');
    }
  }, [user, currentOrgId, currentProjectId, selectedAccount, ruleName, conditions]);

  const handleCloseRuleModal = useCallback(() => {
    setIsRuleModalOpen(false);
    setShowCreateRuleForm(false);
    setRuleName('');
    setConditions([{ id: '1', type: 'description_contains', value: '', operator: 'AND' }]);
  }, []);

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
          <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 overflow-hidden">
          {accounts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-64 h-64 mx-auto mb-4">
                <Lottie animationData={pricingPlansAnimation} loop={true} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No accounts tracked yet</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Start tracking Instagram or TikTok accounts to monitor their content performance
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-zinc-900/40 border-b border-gray-200 dark:border-white/5">
                  <tr>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/40 transition-colors"
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
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Platform
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                      Rules
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                      Creator
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last post
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/40 transition-colors"
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
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/40 transition-colors"
                      onClick={() => {
                        if (sortBy === 'videos') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('videos');
                          setSortOrder('desc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        Posts
                        {sortBy === 'videos' && (
                          <span className="text-white">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/40 transition-colors"
                      onClick={() => {
                        if (sortBy === 'views') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('views');
                          setSortOrder('desc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        Views
                        {sortBy === 'views' && (
                          <span className="text-white">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/40 transition-colors"
                      onClick={() => {
                        if (sortBy === 'likes') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('likes');
                          setSortOrder('desc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        Likes
                        {sortBy === 'likes' && (
                          <span className="text-white">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/40 transition-colors"
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
                  {/* Processing Accounts */}
                  {processingAccounts.map((procAccount, index) => (
                    <tr 
                      key={`processing-${index}`}
                      className="bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5 dark:from-blue-500/10 dark:via-purple-500/10 dark:to-blue-500/10 border-l-4 border-blue-500 animate-pulse-slow"
                    >
                      {/* Username Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="relative w-10 h-10">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center relative overflow-hidden">
                              {/* Animated gradient background */}
                              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 animate-spin-slow"></div>
                              <div className="absolute inset-[2px] bg-[#0A0A0A] rounded-full"></div>
                              <RefreshCw className="w-5 h-5 text-blue-400 animate-spin relative z-10" />
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">
                              @{procAccount.username}
                            </div>
                            <div className="text-xs text-blue-400 font-medium flex items-center gap-1">
                              <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                              Adding account...
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

                      {/* Rules Column - placeholder */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-12 h-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full animate-pulse"></div>
                      </td>

                      {/* Other columns with loading placeholders */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-16 h-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-12 h-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-12 h-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-16 h-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-12 h-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-12 h-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
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
                  ))}

                  {/* Regular Accounts */}
                  {(() => {
                    // Apply pagination to processed accounts
                    const startIndex = (accountsCurrentPage - 1) * accountsItemsPerPage;
                    const endIndex = startIndex + accountsItemsPerPage;
                    const paginatedAccounts = processedAccounts.slice(startIndex, endIndex);
                    
                    // Combine pending accounts (always show at top, not paginated) with paginated accounts
                    const allAccountsToRender = [...pendingAccounts, ...paginatedAccounts];
                    
                    return allAccountsToRender.map((account) => {
                      const isAccountSyncing = syncingAccounts.has(account.id);
                      
                      return (
                      <tr 
                        key={account.id}
                        className={clsx(
                          'transition-colors',
                          {
                            'bg-gray-200 dark:bg-gray-800': selectedAccount?.id === account.id && !isAccountSyncing,
                            'bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5 dark:from-blue-500/10 dark:via-purple-500/10 dark:to-blue-500/10 border-l-4 border-blue-500 animate-pulse-slow': isAccountSyncing,
                            'hover:bg-white/5 dark:hover:bg-white/5 cursor-pointer': !isAccountSyncing,
                          }
                        )}
                        onClick={() => !isAccountSyncing && setSelectedAccount(account)}
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

                        {/* Rules Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const rulesCount = getRulesCountForAccount(account.id);
                            return rulesCount > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-400 border border-blue-500/30">
                                <Filter className="w-3 h-3 mr-1" />
                                {rulesCount} {rulesCount === 1 ? 'rule' : 'rules'}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-gray-600">—</span>
                            );
                          })()}
                        </td>

                        {/* Creator Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const creatorName = accountCreatorNames.get(account.id);
                            return creatorName ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-900/30 text-purple-400 border border-purple-500/30">
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
                                  className="fixed inset-0 z-10" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDropdownId(null);
                                  }}
                                />
                                <div className="absolute right-0 top-8 mt-1 w-48 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl z-20 py-1">
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
                    });
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
                  {selectedAccount.profilePicture && (
                    <img
                      src={selectedAccount.profilePicture}
                      alt={`@${selectedAccount.username}`}
                      className="w-24 h-24 rounded-2xl object-cover border-4 border-gray-100"
                      onError={(e) => {
                        // Fallback to placeholder if image fails to load
                        e.currentTarget.style.display = 'none';
                        const placeholder = e.currentTarget.parentElement?.querySelector('.placeholder-icon');
                        if (placeholder) {
                          placeholder.classList.remove('hidden');
                        }
                      }}
                    />
                  )}
                  <div className={`placeholder-icon w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center border-4 border-gray-100 ${selectedAccount.profilePicture ? 'hidden' : ''}`}>
                      <Users className="w-12 h-12 text-gray-500" />
                    </div>
                  <div className="absolute -bottom-2 -right-2">
                    <PlatformIcon platform={selectedAccount.platform} size="lg" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedAccount.displayName || `@${selectedAccount.username}`}
                    </h2>
                    {activeRulesCount > 0 && (
                      <button
                        onClick={handleOpenRuleModal}
                        className="flex items-center gap-1.5 px-3 py-1 bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/10 rounded-full hover:bg-white/10 dark:hover:bg-white/10 transition-colors group"
                      >
                        <Filter className="w-3.5 h-3.5 text-gray-400 dark:text-gray-400" />
                        <span className="text-xs font-semibold text-gray-300 dark:text-gray-300">
                          {activeRulesCount} {activeRulesCount === 1 ? 'Rule' : 'Rules'} Active
                        </span>
                        <Edit2 className="w-3 h-3 text-gray-400 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                    {activeRulesCount === 0 && (
                      <button
                        onClick={handleOpenRuleModal}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors border border-white/10"
                      >
                        <Plus className="w-3 h-3" />
                        Add Rule
                      </button>
                    )}
                    {(() => {
                      const creatorName = accountCreatorNames.get(selectedAccount.id);
                      return creatorName ? (
                        <button
                          onClick={() => setShowAttachCreatorModal(true)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/30 hover:bg-purple-900/50 text-purple-400 text-xs font-medium rounded-lg transition-colors border border-purple-500/30"
                        >
                          <Users className="w-3 h-3" />
                          {creatorName}
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowAttachCreatorModal(true)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 dark:bg-white hover:bg-purple-700 text-white dark:text-gray-900 text-xs font-medium rounded-lg transition-colors"
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
                    onVideoClick={(video) => {
                      setSelectedVideoForPlayer(video);
                      setVideoPlayerOpen(true);
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
                  disabled={!newAccountUrl.trim() && !accountInputs.slice(1).some(input => input.url.trim() && input.platform)}
                  className="px-4 py-2 text-sm font-bold text-black bg-white rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  Track Accounts
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
      />

      {/* Rule Management Modal */}
      <Modal
        isOpen={isRuleModalOpen}
        onClose={handleCloseRuleModal}
        title={showCreateRuleForm ? 'Create Tracking Rule' : `Manage Rules for @${selectedAccount?.username || ''}`}
      >
        {loadingRules ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-700 border-t-blue-500"></div>
          </div>
        ) : showCreateRuleForm ? (
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
                placeholder="e.g., Track Snapout.co tagged posts"
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
                            condition.type.includes('description') ? 'e.g., @snapout.co' :
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
                    Auto-Applied to @{selectedAccount?.username}
                  </h4>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    This rule will automatically be applied to @{selectedAccount?.username} and will filter videos on this account based on the conditions you set.
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
            <p className="text-gray-400 mb-4">No rules created yet</p>
            <button
              onClick={handleShowCreateForm}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10"
            >
              Create Your First Rule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400 mb-4">
              Select which rules to apply to this account. Videos will be filtered based on active rules.
            </p>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {allRules.map((rule) => {
                const isApplied = accountRules.includes(rule.id);
                
                return (
                  <div
                    key={rule.id}
                    className={clsx(
                      'p-4 rounded-lg border transition-all cursor-pointer group',
                      isApplied
                        ? 'bg-white/10 border-white/20'
                        : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    )}
                    onClick={() => handleToggleRule(rule.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {isApplied ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-500 group-hover:text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-white">{rule.name}</h4>
                          {!rule.isActive && (
                            <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {rule.conditions.slice(0, 2).map((condition: RuleCondition, index: number) => (
                            <div key={condition.id} className="flex items-center gap-2 text-xs">
                              {index > 0 && (
                                <span className="text-gray-900 dark:text-white font-semibold">
                                  {rule.conditions[index - 1].operator || 'AND'}
                                </span>
                              )}
                              <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded">
                                <span className="text-gray-400">
                                  {RulesService.getConditionTypeLabel(condition.type)}:
                                </span>
                                <span className="font-mono text-white">
                                  {String(condition.value)}
                                </span>
                              </div>
                            </div>
                          ))}
                          {rule.conditions.length > 2 && (
                            <p className="text-xs text-gray-500">
                              +{rule.conditions.length - 2} more condition{rule.conditions.length - 2 > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
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
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && accountToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 dark:bg-zinc-900 rounded-2xl p-8 w-full max-w-md shadow-2xl border border-red-500/20">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Delete Account</h2>
              <p className="text-gray-400">
                This action cannot be undone. All videos and data for this account will be permanently removed.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                <div className="flex items-center gap-3 mb-3">
                  {accountToDelete.profilePicture ? (
                    <img 
                      src={accountToDelete.profilePicture} 
                      alt={accountToDelete.username}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-white">@{accountToDelete.username}</div>
                    <div className="text-sm text-gray-400 capitalize">{accountToDelete.platform}</div>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  {accountToDelete.totalVideos} videos • {formatNumber(accountToDelete.followerCount || 0)} followers
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type <span className="font-bold text-white">{accountToDelete.username}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Enter username to confirm"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setAccountToDelete(null);
                    setDeleteConfirmText('');
                  }}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteAccount}
                  disabled={deleteConfirmText !== accountToDelete.username}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600"
                >
                  Delete Account
                </button>
              </div>
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
                <Users className="w-8 h-8 text-purple-500" />
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
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
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
                      className="flex-1 px-4 py-3 bg-gray-900 dark:bg-white hover:bg-purple-700 text-white dark:text-gray-900 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="inline-flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg text-sm text-purple-300">
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
