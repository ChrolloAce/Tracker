import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import { collection, query, where, getDocs, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  Plus, 
  AlertCircle,
  } from 'lucide-react';
import profileAnimation from '../../public/lottie/Target Audience.json';
import { AccountVideo, AccountWithFilteredStats } from '../types/accounts';
import { TrackedAccount } from '../types/firestore';
import { AccountTrackingServiceFirebase } from '../services/AccountTrackingServiceFirebase';
import FirestoreDataService from '../services/FirestoreDataService';
import { BlurEmptyState } from './ui/BlurEmptyState';
import RulesService from '../services/RulesService';
import CreatorLinksService from '../services/CreatorLinksService';
import { TrackingRule } from '../types/rules';
import { useAuth } from '../contexts/AuthContext';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import { VideoSubmission, VideoSnapshot } from '../types';
import VideoPlayerModal from './VideoPlayerModal';
import VideoAnalyticsModal from './VideoAnalyticsModal';
import { DateFilterType } from './DateRangeFilter';
import { ExportVideosModal } from './ExportVideosModal';
import { exportAccountsToCSV } from '../utils/accountCsvExport';
import { Toast } from './ui/Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import Pagination from './ui/Pagination';
import DateFilterService from '../services/DateFilterService';
import CreateLinkModal from './CreateLinkModal';
import LinkClicksService, { LinkClick } from '../services/LinkClicksService';
import UsageTrackingService from '../services/UsageTrackingService';
import AdminService from '../services/AdminService';
import { useNavigate } from 'react-router-dom';
import { Creator, TrackedLink as FirestoreTrackedLink } from '../types/firestore';
import { AddAccountModal } from './accounts/AddAccountModal';
import { AttachCreatorModal } from './accounts/AttachCreatorModal';
import { DeleteAccountModal } from './accounts/DeleteAccountModal';
import { AccountDetailsView } from './accounts/AccountDetailsView';
import { AccountsTable } from './accounts/AccountsTable';
import { AccountsHeader } from './accounts/AccountsHeader';

export interface AccountsPageProps {
  dateFilter: DateFilterType;
  platformFilter: ('instagram' | 'tiktok' | 'youtube' | 'twitter')[];
  searchQuery?: string;
  onViewModeChange: (mode: 'table' | 'details') => void;
  pendingAccounts?: TrackedAccount[];
  organizationId?: string;
  projectId?: string;
  selectedRuleIds?: string[];
  dashboardRules?: TrackingRule[];
  accountFilterId?: string | null; // Filter by specific account ID
  creatorFilterId?: string | null; // Filter by creator's linked accounts
  isDemoMode?: boolean;
}

export interface AccountsPageRef {
  handleBackToTable: () => void;
  openAddModal: () => void;
  refreshData?: () => Promise<void>;
}



const AccountsPage = forwardRef<AccountsPageRef, AccountsPageProps>(
  ({ dateFilter, platformFilter, searchQuery = '', onViewModeChange, pendingAccounts = [], selectedRuleIds = [], dashboardRules = [], organizationId, projectId, accountFilterId, creatorFilterId, isDemoMode = false }, ref) => {
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
  const [creatorLinkedAccountIds, setCreatorLinkedAccountIds] = useState<string[]>([]);
  
  // Track if we've already done the initial restoration from localStorage
  const hasRestoredFromLocalStorage = useRef(false);
  const [accountVideos, setAccountVideos] = useState<AccountVideo[]>([]);
  const [allAccountVideos, setAllAccountVideos] = useState<AccountVideo[]>([]);
  const [accountVideosSnapshots, setAccountVideosSnapshots] = useState<Map<string, VideoSnapshot[]>>(new Map()); // Rules-filtered (no date filter) for PP calculation
  const [viewMode, setViewMode] = useState<'table' | 'details'>('table');
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<{url: string; title: string; platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' } | null>(null);
  const [selectedVideoForAnalytics, setSelectedVideoForAnalytics] = useState<VideoSubmission | null>(null);
  const [isVideoAnalyticsModalOpen, setIsVideoAnalyticsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAccountDetail, setLoadingAccountDetail] = useState(false);
  const [sortBy, setSortBy] = useState<'username' | 'followers' | 'videos' | 'views' | 'likes' | 'comments' | 'shares' | 'bookmarks' | 'engagementRate' | 'highestViewed' | 'lastRefresh' | 'postingStreak' | 'postingFrequency' | 'dateAdded' | 'lastRefreshed'>('dateAdded');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<TrackedAccount | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [showAttachCreatorModal, setShowAttachCreatorModal] = useState(false);
  const [showCreateLinkModal, setShowCreateLinkModal] = useState(false);
  const [creators, setCreators] = useState<Creator[]>([]);
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
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const actionsMenuRef = useRef<HTMLButtonElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Debug: Watch showDeleteConfirm state changes
  useEffect(() => {
    console.log('🟡 [AccountsPage] showDeleteConfirm state changed to:', showDeleteConfirm);
  }, [showDeleteConfirm]);
  

  // Pagination state for accounts table (list view)
  const [accountsCurrentPage, setAccountsCurrentPage] = useState(1);
  const [accountsItemsPerPage, setAccountsItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('accounts_itemsPerPage');
    return saved ? Number(saved) : 10;
  });
  
  


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
      if (!currentOrgId || !user) return;
      
      try {
        // Admin users with bypass enabled bypass limits
        const shouldBypass = await AdminService.shouldBypassLimits(user.uid);
        
        if (shouldBypass) {
          setUsageLimits({
            accountsLeft: 999999,
            videosLeft: 999999,
            isAtAccountLimit: false,
            isAtVideoLimit: false
          });
          return;
        }
        
        // Normal users or admins viewing as normal user - check limits
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
  }, [currentOrgId, accounts.length, user]); // Reload when accounts change or user changes

  // Handle back to table navigation
  const handleBackToTable = useCallback(() => {
    setSelectedAccount(null);
    navigate('/accounts');
    setAccountVideos([]);
    setAccountVideosSnapshots(new Map());
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
    
    // Load snapshots for all videos
    console.log('📸 Loading snapshots for', videos.length, 'videos...');
    const videoIds = videos.map(v => v.id || v.videoId || '').filter(Boolean);
    const snapshotsMap = await FirestoreDataService.getVideoSnapshotsBatch(
      currentOrgId,
      currentProjectId,
      videoIds
    );
    console.log('✅ Loaded snapshots for', snapshotsMap.size, 'videos');
    setAccountVideosSnapshots(snapshotsMap);
    
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
    const videoSubmissions: VideoSubmission[] = rulesFilteredVideos.map(video => {
      const videoId = video.id || video.videoId || '';
      const snapshots = snapshotsMap.get(videoId) || [];
      
      return {
        id: videoId,
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
        snapshots: snapshots
      };
    });
    
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

  // Real-time listener for accounts (FIXED: Now uses onSnapshot for instant updates!)
  useEffect(() => {
    if (!currentOrgId || !currentProjectId) {
      setLoading(false);
      return;
    }

    console.log('👂 Setting up real-time listener for accounts...');
    const accountsRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts');
    const accountsQuery = query(accountsRef);

    // Use onSnapshot for real-time updates instead of getDocs
    const unsubscribe = onSnapshot(accountsQuery, (snapshot) => {
      try {
      const loadedAccounts: TrackedAccount[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TrackedAccount));
      
        console.log(`✅ Accounts updated via real-time listener:`, loadedAccounts.length, 'accounts');
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
    }, (error) => {
      console.error('❌ Real-time listener error:', error);
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => {
      console.log('🔌 Disconnecting accounts real-time listener');
      unsubscribe();
    };
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
        console.log('⏭️ Skipping calculateFilteredStats:', {
          hasOrg: !!currentOrgId,
          hasProject: !!currentProjectId,
          accountsLength: accounts.length,
          viewMode
        });
        return;
      }

      console.log('📊 Calculating filtered stats for', accounts.length, 'accounts');
      
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
        const videosWithoutAccount: any[] = [];
        videosSnapshot.docs.forEach(doc => {
          const video = { id: doc.id, ...doc.data() } as any;
          const accountId = video.trackedAccountId;
          if (accountId) {
            if (!videosByAccount.has(accountId)) {
              videosByAccount.set(accountId, []);
            }
            videosByAccount.get(accountId)!.push(video);
          } else {
            // Track videos without trackedAccountId for debugging
            videosWithoutAccount.push({ id: doc.id, platform: video.platform, videoId: video.videoId });
          }
        });
        
        if (videosWithoutAccount.length > 0) {
          console.warn(`⚠️ Found ${videosWithoutAccount.length} videos without trackedAccountId:`, videosWithoutAccount);
        }

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

          // 🔑 STEP 4: Calculate advanced metrics (use rulesFilteredVideos - all videos after rules, no date filter)
          
          // Find highest viewed video
          const highestViewedVideo = rulesFilteredVideos.length > 0 
            ? rulesFilteredVideos.reduce((max, video) => 
                (video.views || 0) > (max.views || 0) ? video : max
              , rulesFilteredVideos[0])
            : null;

          // Calculate posting streak (consecutive days of posting)
          let postingStreak = 0;
          if (rulesFilteredVideos.length > 0) {
            const sortedVideos = [...rulesFilteredVideos].sort((a, b) => {
              const dateA = a.uploadDate?.toDate?.() || new Date(0);
              const dateB = b.uploadDate?.toDate?.() || new Date(0);
              return dateB.getTime() - dateA.getTime(); // newest first
            });
            
            let currentStreak = 0;
            let lastDate: Date | null = null;
            
            for (const video of sortedVideos) {
              const uploadDate = video.uploadDate?.toDate?.() || new Date();
              const dateOnly = new Date(uploadDate.getFullYear(), uploadDate.getMonth(), uploadDate.getDate());
              
              if (lastDate === null) {
                currentStreak = 1;
                lastDate = dateOnly;
              } else {
                const daysDiff = Math.round((lastDate.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));
                if (daysDiff === 1) {
                  // Consecutive day
                  currentStreak++;
                  lastDate = dateOnly;
                } else if (daysDiff === 0) {
                  // Same day, continue streak
                  continue;
                } else {
                  // Gap in posting
                  break;
                }
              }
            }
            postingStreak = currentStreak;
          }

          // Calculate posting frequency from oldest to newest video
          let postingFrequency = 'N/A';
          if (dateFiltered.length > 0) {
            let daysDiff: number;
            const postCount = dateFiltered.length;
            
            if (dateFilter !== 'all') {
              // Use date filter range
              const dateRange = DateFilterService.getDateRange(dateFilter);
              daysDiff = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
            } else {
              // For "all time", calculate from oldest to newest video
              const videoDates = dateFiltered
                .map(v => v.uploadDate ? new Date(v.uploadDate).getTime() : null)
                .filter((d): d is number => d !== null)
                .sort((a, b) => a - b);
              
              if (videoDates.length >= 2) {
                const oldestDate = videoDates[0];
                const newestDate = videoDates[videoDates.length - 1];
                daysDiff = Math.ceil((newestDate - oldestDate) / (1000 * 60 * 60 * 24));
              } else {
                daysDiff = 0;
              }
            }
            
            if (daysDiff > 0) {
              const postsPerDay = postCount / daysDiff;
              
              if (postsPerDay >= 1) {
                // Multiple posts per day
                postingFrequency = `${postsPerDay.toFixed(1)}/day`;
              } else if (postsPerDay >= 0.14) {
                // Posts per week (0.14 posts/day = ~1 post/week)
                const postsPerWeek = postsPerDay * 7;
                postingFrequency = `${postsPerWeek.toFixed(1)}x/week`;
              } else {
                // Days between posts
                const daysBetweenPosts = 1 / postsPerDay;
                postingFrequency = `every ${Math.round(daysBetweenPosts)} days`;
              }
            }
          }

          // Calculate average engagement rate across videos in the time period
          const avgEngagementRate = dateFiltered.length > 0 
            ? dateFiltered.reduce((sum, v) => {
                const views = v.views || 0;
                if (views === 0) return sum;
                const engagements = (v.likes || 0) + (v.comments || 0) + (v.shares || 0);
                return sum + (engagements / views);
              }, 0) / dateFiltered.length
            : 0;

          return {
            ...account,
            filteredTotalVideos: dateFiltered.length,
            filteredTotalViews: dateFiltered.reduce((sum, v) => sum + v.views, 0),
            filteredTotalLikes: dateFiltered.reduce((sum, v) => sum + v.likes, 0),
            filteredTotalComments: dateFiltered.reduce((sum, v) => sum + v.comments, 0),
            filteredTotalShares: dateFiltered.reduce((sum, v) => sum + (v.shares || 0), 0),
            filteredTotalBookmarks: dateFiltered.reduce((sum, v) => sum + (v.bookmarks || 0), 0),
            highestViewedVideo: highestViewedVideo ? {
              title: highestViewedVideo.videoTitle || highestViewedVideo.caption || 'Untitled',
              views: highestViewedVideo.views || 0,
              videoId: highestViewedVideo.id || ''
            } : undefined,
            postingStreak,
            postingFrequency,
            avgEngagementRate
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
    console.log('🔧 Processing accounts:', {
      totalAccounts: accounts.length,
      filteredAccountsLength: filteredAccounts.length,
      accountFilterId,
      creatorFilterId,
      platformFilterLength: platformFilter.length,
      searchQuery
    });
    
    let result: AccountWithFilteredStats[] = filteredAccounts.length > 0 ? filteredAccounts : accounts.map(acc => ({
      ...acc,
      filteredTotalVideos: acc.totalVideos || 0,
      filteredTotalViews: acc.totalViews || 0,
      filteredTotalLikes: acc.totalLikes || 0,
      filteredTotalComments: acc.totalComments || 0,
      filteredTotalShares: acc.totalShares || 0,
      filteredTotalBookmarks: 0,
      highestViewedVideo: undefined,
      postingStreak: undefined,
      postingFrequency: undefined,
      avgEngagementRate: undefined
    }));
    console.log('🔧 Starting with result length:', result.length);
    
    // Apply account filter (filter by specific account ID)
    if (accountFilterId) {
      const before = result.length;
      result = result.filter(account => account.id === accountFilterId);
      console.log(`🔧 Account filter (${accountFilterId}): ${before} → ${result.length}`, 
        result[0] ? { username: result[0].username, creatorType: result[0].creatorType } : 'NO MATCH');
    }
    
    // Apply creator filter (filter by creator's linked accounts)
    if (creatorFilterId && creatorLinkedAccountIds.length > 0) {
      const before = result.length;
      result = result.filter(account => creatorLinkedAccountIds.includes(account.id));
      console.log(`🔧 Creator filter (${creatorFilterId}): ${before} → ${result.length}`);
    }
    
    // Apply platform filter (multi-select)
    if (platformFilter.length > 0) {
      const before = result.length;
      result = result.filter(account => platformFilter.includes(account.platform as any));
      console.log(`🔧 Platform filter: ${before} → ${result.length}`);
    }
    
    // Apply search filter
    if (searchQuery) {
      const before = result.length;
      result = result.filter(account => 
        account.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      console.log(`🔧 Search filter: ${before} → ${result.length}`);
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
          comparison = a.filteredTotalVideos - b.filteredTotalVideos;
          break;
        case 'views':
          comparison = a.filteredTotalViews - b.filteredTotalViews;
          break;
        case 'likes':
          comparison = a.filteredTotalLikes - b.filteredTotalLikes;
          break;
        case 'comments':
          comparison = a.filteredTotalComments - b.filteredTotalComments;
          break;
        case 'shares':
          comparison = (a.totalShares || 0) - (b.totalShares || 0);
          break;
        case 'bookmarks':
          comparison = 0; // totalSaves not tracked at account level
          break;
        case 'engagementRate': {
          const aEngagements = (a.totalLikes || 0) + (a.totalComments || 0) + (a.totalShares || 0);
          const bEngagements = (b.totalLikes || 0) + (b.totalComments || 0) + (b.totalShares || 0);
          const aViews = a.totalViews || 0;
          const bViews = b.totalViews || 0;
          const aRate = aViews > 0 ? aEngagements / aViews : 0;
          const bRate = bViews > 0 ? bEngagements / bViews : 0;
          comparison = aRate - bRate;
          break;
        }
        case 'highestViewed':
          comparison = ((a as AccountWithFilteredStats).highestViewedVideo?.views || 0) - ((b as AccountWithFilteredStats).highestViewedVideo?.views || 0);
          break;
        case 'lastRefresh': {
          const aTime = a.lastSynced ? (a.lastSynced.toDate ? a.lastSynced.toDate().getTime() : (a.lastSynced.seconds * 1000)) : 0;
          const bTime = b.lastSynced ? (b.lastSynced.toDate ? b.lastSynced.toDate().getTime() : (b.lastSynced.seconds * 1000)) : 0;
          comparison = aTime - bTime;
          break;
        }
        case 'postingStreak':
          comparison = ((a as AccountWithFilteredStats).postingStreak || 0) - ((b as AccountWithFilteredStats).postingStreak || 0);
          break;
        case 'postingFrequency': {
          // Sort by posting frequency string (N/A goes last)
          const aFreq = (a as AccountWithFilteredStats).postingFrequency || 'N/A';
          const bFreq = (b as AccountWithFilteredStats).postingFrequency || 'N/A';
          if (aFreq === 'N/A' && bFreq !== 'N/A') comparison = 1;
          else if (aFreq !== 'N/A' && bFreq === 'N/A') comparison = -1;
          else comparison = aFreq.localeCompare(bFreq);
          break;
        }
        case 'dateAdded':
          comparison = ((a.createdAt || a.dateAdded)?.toDate().getTime() || 0) - ((b.createdAt || b.dateAdded)?.toDate().getTime() || 0);
          break;
        case 'lastRefreshed':
          comparison = (a.lastRefreshed?.toDate().getTime() || 0) - (b.lastRefreshed?.toDate().getTime() || 0);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [filteredAccounts, accounts, platformFilter, searchQuery, sortBy, sortOrder, accountFilterId, creatorFilterId, creatorLinkedAccountIds]);


  // Load creator linked accounts when creator filter is applied
  useEffect(() => {
    if (creatorFilterId && currentOrgId && currentProjectId) {
      console.log('📋 Loading linked accounts for creator:', creatorFilterId);
      CreatorLinksService.getCreatorLinkedAccounts(currentOrgId, currentProjectId, creatorFilterId)
        .then(links => {
          const accountIds = links.map(link => link.accountId);
          console.log('📋 Creator linked account IDs:', accountIds);
          setCreatorLinkedAccountIds(accountIds);
        })
        .catch(error => {
          console.error('Failed to load creator linked accounts:', error);
          setCreatorLinkedAccountIds([]);
        });
    } else {
      setCreatorLinkedAccountIds([]);
    }
  }, [creatorFilterId, currentOrgId, currentProjectId]);

  // Listen for URL-based account opening
  useEffect(() => {
    const handleOpenAccount = (event: any) => {
      const accountId = event.detail?.accountId;
      if (accountId && accounts.length > 0) {
        const account = accounts.find(a => a.id === accountId);
        if (account) {
          console.log('🎯 Opening account details from URL:', account.username);
          setSelectedAccount(account);
          setViewMode('details');
          onViewModeChange('details');
        } else {
          console.warn('⚠️ Account not found:', accountId);
        }
      } else if (accountId && accounts.length === 0) {
        console.log('⏳ Accounts not loaded yet, waiting...');
      }
    };
    
    window.addEventListener('openAccount', handleOpenAccount);
    return () => window.removeEventListener('openAccount', handleOpenAccount);
  }, [accounts, onViewModeChange]);

  // Auto-open account details when filtered to a single account
  useEffect(() => {
    console.log('🔍 Auto-open check:', {
      accountFilterId,
      creatorFilterId,
      processedAccountsLength: processedAccounts.length,
      accountsLength: accounts.length,
      selectedAccountId: selectedAccount?.id,
      firstProcessedAccount: processedAccounts[0] ? {
        id: processedAccounts[0].id,
        username: processedAccounts[0].username,
        creatorType: processedAccounts[0].creatorType
      } : null
    });
    
    // Only auto-open if we have an account filter and exactly one account
    if ((accountFilterId || creatorFilterId) && processedAccounts.length === 1) {
      const account = processedAccounts[0];
      // Only open if not already selected
      if (selectedAccount?.id !== account.id) {
        console.log('🎯 Auto-opening account details for filtered account:', {
          username: account.username,
          id: account.id,
          creatorType: account.creatorType,
          totalVideos: account.totalVideos
        });
        setSelectedAccount(account);
        setViewMode('details');
        // Load videos for this account
        loadAccountVideos(account.id);
      } else {
        console.log('⏭️ Account already selected, skipping auto-open');
      }
    } else if (accountFilterId || creatorFilterId) {
      console.warn('⚠️ Filter active but condition not met:', {
        filterActive: !!(accountFilterId || creatorFilterId),
        processedAccountsLength: processedAccounts.length,
        reason: processedAccounts.length === 0 ? 'No processed accounts found' : 
                processedAccounts.length > 1 ? 'Multiple accounts found (expected 1)' : 'Unknown'
      });
    }
  }, [accountFilterId, creatorFilterId, processedAccounts, selectedAccount, loadAccountVideos]);

  // NOTE: Removed duplicate useEffect - video loading is now handled by loadAccountVideos() 
  // which is called from the useEffect at line ~450 with dashboard rules properly applied

  // Selection and action handlers for accounts
  const handleSelectAllAccounts = useCallback(() => {
    // Select ALL accounts in processed list
    if (selectedAccounts.size === processedAccounts.length) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(processedAccounts.map(a => a.id)));
    }
  }, [processedAccounts, selectedAccounts.size]);

  const handleSelectAccount = useCallback((accountId: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedAccounts(newSelected);
  }, [selectedAccounts]);

  const handleCopyAccountLinks = useCallback(() => {
    const selected = processedAccounts.filter(a => selectedAccounts.has(a.id));
    const links = selected.map(a => {
      switch (a.platform) {
        case 'instagram':
          return `https://www.instagram.com/${a.username}`;
        case 'tiktok':
          return `https://www.tiktok.com/@${a.username}`;
        case 'youtube':
          return `https://www.youtube.com/@${a.username}`;
        case 'twitter':
          return `https://twitter.com/${a.username}`;
        default:
          return '';
      }
    }).join('\n');
    navigator.clipboard.writeText(links);
    setShowActionsMenu(false);
    setShowToast({ message: `Copied ${selected.length} account link${selected.length !== 1 ? 's' : ''} to clipboard`, type: 'success' });
    console.log(`✅ Copied ${selected.length} account links to clipboard`);
  }, [processedAccounts, selectedAccounts]);

  const handleBulkDeleteAccounts = useCallback(async () => {
    console.log('🔴🔴🔴 [BULK DELETE ACCOUNTS] Button clicked!');
    console.log('  Current Org ID:', currentOrgId);
    console.log('  Current Project ID:', currentProjectId);
    console.log('  Selected accounts count:', selectedAccounts.size);
    console.log('  Processed accounts count:', processedAccounts.length);
    console.log('  Current showDeleteConfirm:', showDeleteConfirm);
    console.log('  Current showActionsMenu:', showActionsMenu);
    
    if (!currentOrgId || !currentProjectId) {
      console.error('❌ Missing org or project ID');
      setShowToast({ message: 'Organization or Project not loaded. Please refresh the page.', type: 'error' });
      return;
    }
    
    if (selectedAccounts.size === 0) {
      console.warn('⚠️ No accounts selected');
      setShowToast({ message: 'Please select accounts to delete first.', type: 'info' });
      return;
    }
    
    const selected = processedAccounts.filter(a => selectedAccounts.has(a.id));
    const count = selected.length;
    const totalVideos = selected.reduce((sum, acc) => sum + (acc.totalVideos || 0), 0);
    
    console.log('  Accounts to delete:', count);
    console.log('  Total videos to delete:', totalVideos);
    
    if (count === 0) {
      console.error('❌ No matching accounts found');
      setShowToast({ message: 'No accounts found to delete. Please try again.', type: 'error' });
      return;
    }
    
    // Close menu first, then show dialog after a tiny delay
    console.log('🔴 Setting showActionsMenu to FALSE');
    setShowActionsMenu(false);
    
    // Delay opening the dialog to ensure menu is fully closed
    console.log('🔴 Setting timeout to show delete confirm');
    setTimeout(() => {
      console.log('🔴 Opening delete confirmation dialog NOW');
      setShowDeleteConfirm(true);
    }, 10);
  }, [processedAccounts, selectedAccounts, currentOrgId, currentProjectId, showDeleteConfirm, showActionsMenu]);

  const confirmBulkDeleteAccounts = useCallback(async () => {
    const selected = processedAccounts.filter(a => selectedAccounts.has(a.id));
    const count = selected.length;
    const selectedIds = new Set(selected.map(a => a.id));
      
      console.log(`🗑️ [BULK DELETE] Starting deletion for ${count} accounts`);
      
      // ✅ STEP 1: IMMEDIATELY remove from UI (optimistic update)
      setShowActionsMenu(false);
      setSelectedAccounts(new Set());
      
      // Remove from accounts list immediately
      setAccounts(prev => prev.filter(a => !selectedIds.has(a.id)));
      setFilteredAccounts(prev => prev.filter(a => !selectedIds.has(a.id)));
      
      // Clear selected account if it was one of the deleted ones
      if (selectedAccount && selectedIds.has(selectedAccount.id)) {
        navigate('/accounts');
        setAccountVideos([]);
        setAccountVideosSnapshots(new Map());
      }
      
      console.log(`✅ [BULK DELETE] Accounts removed from UI instantly`);
      
      // ✅ STEP 2: Process deletions in background (don't await)
      (async () => {
        try {
          console.log(`🔄 [BACKGROUND] Processing ${count} account deletions...`);
          
          // Delete accounts in parallel
          await Promise.all(
            selected.map(account =>
              AccountTrackingServiceFirebase.removeAccount(
                currentOrgId!,
                currentProjectId!,
                account.id,
                account.username,
                account.platform
              ).catch(error => {
                console.error(`❌ Failed to delete @${account.username}:`, error);
                return null; // Continue with other deletions
              })
            )
          );
          
          console.log(`✅ [BACKGROUND] ${count} accounts fully deleted from database`);
        } catch (error) {
          console.error('❌ [BACKGROUND] Failed to complete bulk deletion:', error);
        }
      })();
      
      console.log(`✅ [BULK DELETE] Deletion initiated, UI updated instantly`);
      setShowToast({ message: `Deleting ${count} account${count !== 1 ? 's' : ''}...`, type: 'success' });
  }, [processedAccounts, selectedAccounts, currentOrgId, currentProjectId, selectedAccount, navigate]);

  const deleteTotalVideosCount = useMemo(() => {
    const selected = processedAccounts.filter(a => selectedAccounts.has(a.id));
    return selected.reduce((sum, acc) => sum + (acc.totalVideos || 0), 0);
  }, [processedAccounts, selectedAccounts]);

  const handleExportAccounts = useCallback((filename: string) => {
    const selected = processedAccounts.filter(a => selectedAccounts.has(a.id));
    exportAccountsToCSV(selected, filename);
    setShowExportModal(false);
    setSelectedAccounts(new Set());
  }, [processedAccounts, selectedAccounts]);

  // Backdrop handles outside clicks now, so this is removed to prevent conflicts

  const handleSyncAccount = useCallback(async (accountId: string) => {
    if (!currentOrgId || !currentProjectId || !user) return;

    // Get account name for better messages
    const account = processedAccounts.find(a => a.id === accountId);
    const accountName = account?.username || 'account';

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
      
      // Show appropriate message
      if (videoCount === 0) {
        setShowToast({ 
          message: `⚠️ No new videos found for @${accountName}. Account may be private or filtered by rules.`, 
          type: 'info' 
        });
        setSyncError('No videos found or filtered by rules. Check if rules are too restrictive, or this might be a private account.');
      } else {
        // Show success toast
        setShowToast({ 
          message: `✅ Synced @${accountName} - ${videoCount} video${videoCount !== 1 ? 's' : ''} processed!`, 
          type: 'success' 
        });
        // Clear any previous errors on success
        setSyncError(null);
      }
    } catch (error) {
      console.error('❌ Sync failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setSyncError(`Sync failed: ${errorMessage}`);
      setShowToast({ 
        message: `❌ Failed to sync @${accountName}: ${errorMessage}`, 
        type: 'error' 
      });
    } finally {
      setIsSyncing(null);
    }
  }, [selectedAccount, currentOrgId, currentProjectId, user, loadAccountVideos, processedAccounts]);

  const handleVideoClick = useCallback(async (video: VideoSubmission) => {
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
  }, [currentOrgId, currentProjectId]);


  const handleAccountsAdded = useCallback(async (accountsToAdd: Array<{url: string, username: string, platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter', videoCount: number}>) => {
    if (!currentOrgId || !currentProjectId || !user) return;

    // Add all to processing accounts immediately AT THE TOP
    setProcessingAccounts(prev => [
      ...accountsToAdd.map(acc => ({ username: acc.username, platform: acc.platform, startedAt: Date.now() })),
      ...prev
    ]);
    
    // Close modal immediately
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
  }, [currentOrgId, currentProjectId, user]);

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
    const account = filteredAccounts.find(a => a.id === accountId);
    if (!account) return;
    
    // Use filtered video count for accurate display
    const accountWithVideoCount = {
      ...account,
      totalVideos: account.filteredTotalVideos || account.totalVideos || 0
    };
    
    setAccountToDelete(accountWithVideoCount);
    setShowDeleteModal(true);
    setDeleteConfirmText('');
  }, [filteredAccounts]);

  const handleCancelSync = useCallback(async (account: TrackedAccount) => {
    if (!currentOrgId || !currentProjectId) return;
    
    if (window.confirm(`Cancel sync for @${account.username}? This will clear the syncing state.`)) {
      try {
        const accountRef = doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts', account.id);
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
  }, [currentOrgId, currentProjectId]);

  const handleToggleType = useCallback(async (account: TrackedAccount) => {
    if (!currentOrgId || !currentProjectId) {
      alert('Missing organization or project ID');
      return;
    }
    
    const currentType = account.creatorType || 'automatic';
    const newType = currentType === 'automatic' ? 'static' : 'automatic';
    
    try {
      const accountRef = doc(
        db,
        'organizations',
        currentOrgId,
        'projects',
        currentProjectId,
        'trackedAccounts',
        account.id
      );
      await updateDoc(accountRef, { creatorType: newType });
      
      const typeLabel = newType === 'automatic' ? 'Automatic' : 'Static';
      alert(`Account converted to ${typeLabel} mode`);
    } catch (error) {
      console.error('Failed to update account type:', error);
      alert('Failed to update account type');
    }
  }, [currentOrgId, currentProjectId]);

  const handleAccountSort = useCallback((key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key as any);
      setSortOrder('asc');
    }
  }, [sortBy, sortOrder]);

  const handleCancelProcessing = useCallback((index: number) => {
    setProcessingAccounts(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleImageError = useCallback((id: string) => {
    setImageErrors(prev => new Set(prev).add(id));
  }, []);

  const retryFailedAccount = useCallback(async (accountId: string, username: string) => {
    if (!currentOrgId || !currentProjectId || !user) return;
    
    try {
      console.log(`🔄 Retrying failed account: @${username}`);
      
      // Clear error status
      const accountRef = doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts', accountId);
      await updateDoc(accountRef, {
        syncStatus: 'idle',
        hasError: false,
        lastSyncError: null,
        syncRetryCount: 0
      });
      
      // Queue for immediate re-sync
      const token = await user.getIdToken();
      const response = await fetch('/api/queue-manual-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orgId: currentOrgId,
          projectId: currentProjectId,
          accountId
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to queue account retry');
      }
      
      console.log(`✅ Account @${username} queued for retry`);
      
    } catch (error) {
      console.error('Failed to retry account:', error);
      alert('Failed to retry account. Please try again.');
    }
  }, [currentOrgId, currentProjectId, user]);

  const dismissAccountError = useCallback(async (accountId: string, username: string) => {
    if (!currentOrgId || !currentProjectId) return;
    
    try {
      console.log(`🗑️ Dismissing error for account: @${username}`);
      
      // Clear error status without retrying
      const accountRef = doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts', accountId);
      await updateDoc(accountRef, {
        syncStatus: 'idle',
        hasError: false,
        lastSyncError: null,
        syncRetryCount: 0
      });
      
      console.log(`✅ Error dismissed for @${username}`);
      
    } catch (error) {
      console.error('Failed to dismiss error:', error);
      alert('Failed to dismiss error. Please try again.');
    }
  }, [currentOrgId, currentProjectId]);

  const confirmDeleteAccount = useCallback(async () => {
    if (!currentOrgId || !currentProjectId || !accountToDelete) return;
    
    const accountId = accountToDelete.id;
    const accountUsername = accountToDelete.username;
    const videoCount = accountToDelete.totalVideos || 0;

    console.log(`🗑️ [UI] Starting INSTANT deletion for: @${accountUsername} (${videoCount} videos)`);

    // ✅ STEP 1: IMMEDIATELY remove from UI (optimistic update)
    setShowDeleteModal(false);
    setAccountToDelete(null);
    setDeleteConfirmText('');
    
    // Remove from accounts list immediately
    setAccounts(prev => prev.filter(a => a.id !== accountId));
    setFilteredAccounts(prev => prev.filter(a => a.id !== accountId));
    
    // Clear selected account if it was this one
    if (selectedAccount?.id === accountId) {
        navigate('/accounts');
        setAccountVideos([]);
        setAccountVideosSnapshots(new Map());
      }
      
    console.log(`✅ [UI] Account removed from UI instantly`);

    // ✅ STEP 2: Process deletion in background (don't await)
    (async () => {
      try {
        console.log(`🔄 [BACKGROUND] Processing deletion for @${accountUsername}...`);
        const accountData = accounts.find(a => a.id === accountId);
        await AccountTrackingServiceFirebase.removeAccount(
          currentOrgId, 
          currentProjectId, 
          accountId, 
          accountData?.username, 
          accountData?.platform
        );
        console.log(`✅ [BACKGROUND] Account @${accountUsername} fully deleted from database`);
        console.log('✅ Account deletion complete - UI already updated, no reload needed');
        // No reload needed - UI was already updated instantly when deletion started
    } catch (error) {
        console.error('❌ [BACKGROUND] Failed to complete account deletion:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Show error notification but DON'T restore the account to UI
        // (it's likely partially deleted and would cause issues)
        alert(`Account was removed from view but background cleanup encountered an error:\n${errorMessage}\n\nThe account will not reappear. Check console for details.`);
    }
    })();
    
    console.log(`✅ [UI] Deletion initiated, UI updated instantly`);
  }, [accountToDelete, deleteConfirmText, selectedAccount, currentOrgId, currentProjectId, navigate]);

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
                  label: isDemoMode ? "Can't Add - Not Your Org" : 'Add Account',
                  onClick: () => {
                    if (!isDemoMode) {
                      setIsAddModalOpen(true);
                    }
                  },
                  icon: Plus,
                  primary: true,
                  disabled: isDemoMode
                }
              ]}
            />
          ) : (
          <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 overflow-hidden">
            <AccountsHeader
              dateFilter={dateFilter}
              selectedCount={selectedAccounts.size}
              showActionsMenu={showActionsMenu}
              setShowActionsMenu={setShowActionsMenu}
              actionsMenuRef={actionsMenuRef}
              onCopyLinks={handleCopyAccountLinks}
              onExport={() => setShowExportModal(true)}
              onDelete={handleBulkDeleteAccounts}
            />
          {(
            <AccountsTable 
              realAccounts={processedAccounts.slice((accountsCurrentPage - 1) * accountsItemsPerPage, (accountsCurrentPage - 1) * accountsItemsPerPage + accountsItemsPerPage)} 
              processingAccounts={processingAccounts} 
              pendingAccounts={pendingAccounts} 
              selectedAccounts={selectedAccounts} 
              syncingAccounts={syncingAccounts} 
              sortBy={sortBy} 
                      sortOrder={sortOrder}
              accountCreatorNames={accountCreatorNames} 
              imageErrors={imageErrors} 
              onSort={handleAccountSort} 
              onSelectAccount={handleSelectAccount} 
              onSelectAll={handleSelectAllAccounts} 
              onCancelProcessing={handleCancelProcessing} 
              onCancelSync={handleCancelSync} 
              onRetrySync={(account) => retryFailedAccount(account.id, account.username)} 
              onDismissError={(account) => dismissAccountError(account.id, account.username)} 
              onRemoveAccount={handleRemoveAccount} 
              onToggleType={handleToggleType} 
              onNavigate={(url) => navigate(url)} 
              onImageError={handleImageError} 
            />          )}
          
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
          <AccountDetailsView
            selectedAccount={selectedAccount}
            loading={loadingAccountDetail}
            accountVideos={accountVideos}
            allAccountVideos={allAccountVideos}
            accountVideosSnapshots={accountVideosSnapshots}
                    dateFilter={dateFilter}
            trackedLinks={trackedLinks}
            linkClicks={linkClicks}
            accountCreatorNames={accountCreatorNames}
            isSyncing={isSyncing}
            onSyncAccount={handleSyncAccount}
            onAttachCreator={() => setShowAttachCreatorModal(true)}
                    onCreateLink={() => setShowCreateLinkModal(true)}
            onVideoClick={handleVideoClick}
          />
        )
      )}


      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAccountsAdded}
        usageLimits={usageLimits}
      />

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
        onDelete={async () => {
          console.log('🔄 Video deleted - refreshing account videos...');
          // Refresh the current account's videos instead of full page reload
          if (selectedAccount && currentOrgId && currentProjectId) {
            try {
              await loadAccountVideos(selectedAccount.id);
              console.log('✅ Account videos refreshed');
            } catch (error) {
              console.error('⚠️ Failed to refresh videos:', error);
            }
          }
        }}
        totalCreatorVideos={
          selectedVideoForAnalytics
            ? allAccountVideos.filter(
                v => v.uploaderHandle === selectedVideoForAnalytics.uploaderHandle
              ).length
            : undefined
        }
        orgId={currentOrgId}
        projectId={currentProjectId}
      />

      {/* Delete Confirmation Modal */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => {
                    setShowDeleteModal(false);
                    setAccountToDelete(null);
                  }}
        onConfirm={confirmDeleteAccount}
        account={accountToDelete}
      />

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
      <AttachCreatorModal
        isOpen={showAttachCreatorModal}
        onClose={() => setShowAttachCreatorModal(false)}
        selectedAccount={selectedAccount}
        creators={creators}
        orgId={currentOrgId || ''}
        projectId={currentProjectId || ''}
        userId={user?.uid || ''}
        onSuccess={(creatorName) => {
          if (selectedAccount) {
                              setAccountCreatorNames(prev => {
                                const updated = new Map(prev);
                                updated.set(selectedAccount.id, creatorName);
                                return updated;
                              });
          }
        }}
      />

      {/* Export Accounts Modal */}
      <ExportVideosModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExportAccounts}
        selectedCount={selectedAccounts.size}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Accounts"
        message={`⚠️ You are about to delete ${selectedAccounts.size} account${selectedAccounts.size !== 1 ? 's' : ''}\n\nThis will permanently delete:\n• ${selectedAccounts.size} account${selectedAccounts.size !== 1 ? 's' : ''}\n• ${deleteTotalVideosCount} video${deleteTotalVideosCount !== 1 ? 's' : ''}\n• All associated snapshots and data\n\nThis action CANNOT be undone!`}
        confirmText="Delete Accounts"
        cancelText="Cancel"
        requireTyping={true}
        typingConfirmation="DELETE"
        onConfirm={confirmBulkDeleteAccounts}
        onCancel={() => {
          console.log('🔴 Cancel clicked - closing dialog');
          setShowDeleteConfirm(false);
        }}
        isDanger={true}
      />

      {/* Toast Notification */}
      {showToast && (
        <Toast
          message={showToast.message}
          type={showToast.type}
          onClose={() => setShowToast(null)}
        />
      )}
    </div>
  );
});

AccountsPage.displayName = 'AccountsPage';

export default AccountsPage;
