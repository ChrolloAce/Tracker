import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  MoreVertical,
  TrendingUp,
  Copy,
  User,
  BarChart3,
  Download
  } from 'lucide-react';
import profileAnimation from '../../public/lottie/Target Audience.json';
import { AccountVideo } from '../types/accounts';
import { TrackedAccount } from '../types/firestore';
import { VideoSubmissionsTable } from './VideoSubmissionsTable';
import { AccountTrackingServiceFirebase } from '../services/AccountTrackingServiceFirebase';
import FirestoreDataService from '../services/FirestoreDataService';
import { ProxiedImage } from './ProxiedImage';
import { HeicImage } from './HeicImage';
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
import { VideoSubmission, VideoSnapshot } from '../types';
import VideoPlayerModal from './VideoPlayerModal';
import VideoAnalyticsModal from './VideoAnalyticsModal';
import { DateFilterType } from './DateRangeFilter';
import { FloatingDropdown, DropdownItem, DropdownDivider } from './ui/FloatingDropdown';
import { FloatingTooltip } from './ui/FloatingTooltip';
import { ExportVideosModal } from './ExportVideosModal';
import { exportAccountsToCSV } from '../utils/accountCsvExport';
import { Toast } from './ui/Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import Pagination from './ui/Pagination';
import ColumnPreferencesService from '../services/ColumnPreferencesService';
import KPICards from './KPICards';
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

interface AccountWithFilteredStats extends TrackedAccount {
  filteredTotalVideos: number;
  filteredTotalViews: number;
  filteredTotalLikes: number;
  filteredTotalComments: number;
  filteredTotalShares?: number;
  filteredTotalBookmarks?: number;
  highestViewedVideo?: { title: string; views: number; videoId: string };
  postingStreak?: number;
  postingFrequency?: string; // e.g., "2/day", "every 3 days", "3x/week"
  avgEngagementRate?: number;
}

// Column header with tooltip component
const ColumnHeader: React.FC<{
  label: string;
  tooltip: string;
  sortable?: boolean;
  sortKey?: string;
  currentSortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: () => void;
  sticky?: boolean;
}> = ({ label, tooltip, sortable, sortKey, currentSortBy, sortOrder, onSort, sticky }) => {
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseLeave = () => {
    setTooltipPosition(null);
  };
  
  return (
    <>
      <th 
        className={`px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider ${sortable ? 'cursor-pointer hover:bg-zinc-800/40 transition-colors' : ''} ${sticky ? 'sticky left-0 bg-zinc-900/60 backdrop-blur z-20' : ''}`}
        onClick={sortable ? onSort : undefined}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {sortable && currentSortBy === sortKey && (
            <span className="text-white">
              {sortOrder === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
      </th>
      
      {/* Tooltip portal - follows mouse cursor */}
      {tooltipPosition && createPortal(
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y + 20}px`,
            transform: 'translateX(-50%)',
            maxWidth: '320px',
            width: 'max-content'
          }}
        >
          <div 
            className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10 p-3"
            style={{
              maxWidth: '320px',
              width: 'max-content'
            }}
          >
            <div className="text-xs text-gray-300 leading-relaxed whitespace-normal">
              {tooltip}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

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
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [hoveredTypeId, setHoveredTypeId] = useState<string | null>(null);
  const typeBadgeRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
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
    
    let result = filteredAccounts.length > 0 ? filteredAccounts : accounts;
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
          return a.username;
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
            {/* Table Header */}
            <div className="relative px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 border-b border-white/5 z-10" style={{ backgroundColor: 'rgba(18, 18, 20, 0.6)' }}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {dateFilter === 'all' 
                      ? 'Account stats - All Time' 
                      : dateFilter === 'today'
                      ? 'Account stats - Today'
                      : dateFilter === 'yesterday'
                      ? 'Account stats - Yesterday'
                      : dateFilter === 'last7days'
                      ? 'Account stats - Last 7 days'
                      : dateFilter === 'last14days'
                      ? 'Account stats - Last 14 days'
                      : dateFilter === 'last30days'
                      ? 'Account stats - Last 30 days'
                      : dateFilter === 'last90days'
                      ? 'Account stats - Last 90 days'
                      : dateFilter === 'mtd'
                      ? 'Account stats - Month to Date'
                      : dateFilter === 'lastmonth'
                      ? 'Account stats - Last Month'
                      : dateFilter === 'ytd'
                      ? 'Account stats - Year to Date'
                      : 'Account stats'
                    }
                  </h2>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
                  {/* Actions Dropdown */}
                  <div className="relative">
                    <button
                      ref={actionsMenuRef}
                      onClick={() => setShowActionsMenu(!showActionsMenu)}
                      disabled={selectedAccounts.size === 0}
                      className={clsx(
                        "flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 text-sm border rounded-lg transition-colors",
                        selectedAccounts.size > 0
                          ? "text-white bg-white/10 border-white/20 hover:bg-white/15"
                          : "text-gray-500 border-white/5 cursor-not-allowed opacity-50"
                      )}
                    >
                      <MoreVertical className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        {selectedAccounts.size > 0 ? `Actions (${selectedAccounts.size})` : 'Actions'}
                      </span>
                      <ChevronDown className="w-3 h-3" />
                    </button>

                    {/* Actions Dropdown Menu (Portal) */}
                    {showActionsMenu && selectedAccounts.size > 0 && actionsMenuRef.current && createPortal(
                      <>
                        {/* Backdrop */}
                        <div 
                          className="fixed inset-0 z-[9998]" 
                          onClick={() => setShowActionsMenu(false)}
                        />
                        
                        {/* Dropdown Menu */}
                        <div 
                          className="fixed w-48 bg-[#1A1A1A] border border-gray-800 rounded-lg shadow-xl z-[9999] overflow-hidden"
                          style={{
                            top: `${actionsMenuRef.current.getBoundingClientRect().bottom + 8}px`,
                            left: `${actionsMenuRef.current.getBoundingClientRect().right - 192}px`
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyAccountLinks();
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center space-x-3 transition-colors"
                          >
                            <LinkIcon className="w-4 h-4" />
                            <span>Copy Links</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowExportModal(true);
                              setShowActionsMenu(false);
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center space-x-3 transition-colors border-t border-gray-800"
                          >
                            <Download className="w-4 h-4" />
                            <span>Export to CSV</span>
                          </button>
                          <button
                            onClick={(e) => {
                              console.log('🔴 ACCOUNTS DELETE BUTTON CLICK EVENT FIRED');
                              e.stopPropagation();
                              e.preventDefault();
                              handleBulkDeleteAccounts();
                            }}
                            onMouseDown={() => console.log('🔴 MOUSE DOWN on delete accounts button')}
                            onMouseUp={() => console.log('🔴 MOUSE UP on delete accounts button')}
                            className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center space-x-3 transition-colors border-t border-gray-800"
                            type="button"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete Selected</span>
                          </button>
                        </div>
                      </>,
                      document.body
                    )}
                  </div>

                  {/* Column Visibility Toggle */}
                  <div className="relative">
                    <button
                      onClick={() => setShowColumnToggle(!showColumnToggle)}
                      className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg hover:border-white/20 transition-colors"
                    >
                      <Filter className="w-4 h-4" />
                      <span className="hidden sm:inline">Columns</span>
                    </button>
                    
                    {showColumnToggle && createPortal(
                      <>
                        {/* Backdrop */}
                        <div 
                          className="fixed inset-0 z-[9998]" 
                          onClick={() => setShowColumnToggle(false)}
                        />
                        {/* Dropdown */}
                        <div className="fixed right-4 top-20 w-64 bg-black border border-white/20 rounded-lg shadow-2xl p-4 z-[9999]" style={{ boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)' }}>
                          <h3 className="text-sm font-semibold text-white mb-3">Toggle Columns</h3>
                          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                            <p className="text-xs text-white/50 mb-2">Column visibility is currently fixed for accounts. More customization coming soon!</p>
                          </div>
                        </div>
                      </>,
                      document.body
                    )}
                  </div>
                </div>
              </div>
            </div>
          {(
            <div className="overflow-x-auto -mx-3 sm:-mx-0">
              <table className="w-full min-w-max">
                <thead className="bg-gray-50 dark:bg-zinc-900/40 border-b border-gray-200 dark:border-white/5">
                  <tr>
                    {/* Select All Checkbox */}
                    <th className="w-10 px-2 sm:px-4 py-3 sm:py-4 text-left sticky left-0 z-20 bg-gray-50 dark:bg-zinc-900/40">
                      <div className="flex items-center justify-center" title={`Select all ${processedAccounts.length} accounts`}>
                        <input
                          type="checkbox"
                          checked={processedAccounts.length > 0 && selectedAccounts.size === processedAccounts.length}
                          onChange={handleSelectAllAccounts}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-white focus:ring-2 focus:ring-white/20 cursor-pointer"
                        />
                      </div>
                    </th>
                    <ColumnHeader
                      label="Username"
                      tooltip="The account username along with profile picture. Platform icon shows which social media platform this account is on, and a verified badge appears if the account is verified."
                      sortable
                      sortKey="username"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={() => {
                        if (sortBy === 'username') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('username');
                          setSortOrder('asc');
                        }
                      }}
                      sticky
                    />
                    <ColumnHeader
                      label="Creator"
                      tooltip="The team member or creator associated with this account. This helps you track which accounts belong to which team member."
                      sortable={false}
                    />
                    <ColumnHeader
                      label="Type"
                      tooltip="Account tracking type. Automatic accounts discover new videos on refresh, while Static accounts only update existing videos."
                      sortable={false}
                    />
                    <ColumnHeader
                      label="Date Added"
                      tooltip="The date and time when this account was first added to your tracking list."
                      sortable
                      sortKey="dateAdded"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={() => {
                        if (sortBy === 'dateAdded') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('dateAdded');
                          setSortOrder('desc');
                        }
                      }}
                    />
                    <ColumnHeader
                      label="Last Refreshed"
                      tooltip="The date and time when data for this account was last updated from the platform."
                      sortable
                      sortKey="lastRefreshed"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={() => {
                        if (sortBy === 'lastRefreshed') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('lastRefreshed');
                          setSortOrder('desc');
                        }
                      }}
                    />
                    <ColumnHeader
                      label="Followers"
                      tooltip="Total number of followers this account currently has on the platform. This metric helps gauge account reach and audience size."
                      sortable
                      sortKey="followers"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={() => {
                        if (sortBy === 'followers') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('followers');
                          setSortOrder('desc');
                        }
                      }}
                    />
                    <ColumnHeader
                      label="Last Post"
                      tooltip="The date and time when the most recent content was posted by this account. Helps you track posting frequency and consistency."
                      sortable={false}
                    />
                    <ColumnHeader
                      label="Total Posts"
                      tooltip="Total number of posts published by this account within the selected date range. Use this to monitor content output and activity levels."
                      sortable
                      sortKey="videos"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={() => {
                        if (sortBy === 'videos') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('videos');
                          setSortOrder('desc');
                        }
                      }}
                    />
                    <ColumnHeader
                      label="Views"
                      tooltip="Total view count across all posts in the selected time period. This is a key metric for understanding content reach and visibility."
                      sortable
                      sortKey="views"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={() => {
                        if (sortBy === 'views') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('views');
                          setSortOrder('desc');
                        }
                      }}
                    />
                    <ColumnHeader
                      label="Top Video"
                      tooltip="The highest-performing video by view count in the selected period. Click to see which content resonated most with your audience."
                      sortable
                      sortKey="highestViewed"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={() => {
                        if (sortBy === 'highestViewed') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('highestViewed');
                          setSortOrder('desc');
                        }
                      }}
                    />
                    <ColumnHeader
                      label="Likes"
                      tooltip="Total number of likes received across all posts in the selected date range. This metric reflects content appeal and audience appreciation."
                      sortable
                      sortKey="likes"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={() => {
                        if (sortBy === 'likes') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('likes');
                          setSortOrder('desc');
                        }
                      }}
                    />
                    <ColumnHeader
                      label="Comments"
                      tooltip="Total comments received across all posts in the selected period. High comment counts indicate strong audience engagement and conversation."
                      sortable
                      sortKey="comments"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={() => {
                        if (sortBy === 'comments') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('comments');
                          setSortOrder('desc');
                        }
                      }}
                    />
                    <ColumnHeader
                      label="Shares"
                      tooltip="Total number of times posts were shared or reposted in the selected period. Shares indicate content virality and audience advocacy."
                      sortable
                      sortKey="shares"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={() => {
                        if (sortBy === 'shares') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('shares');
                          setSortOrder('desc');
                        }
                      }}
                    />
                    <ColumnHeader
                      label="Bookmarks"
                      tooltip="Total number of times posts were bookmarked or saved by viewers. This shows content that people find valuable enough to reference later."
                      sortable
                      sortKey="bookmarks"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={() => {
                        if (sortBy === 'bookmarks') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('bookmarks');
                          setSortOrder('desc');
                        }
                      }}
                    />
                    <ColumnHeader
                      label="Engagement"
                      tooltip="Average engagement rate calculated across all videos in the selected time period. Formula: (Likes + Comments + Shares) / Views × 100. Higher rates indicate more interactive audience."
                      sortable
                      sortKey="engagementRate"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={() => {
                        if (sortBy === 'engagementRate') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('engagementRate');
                          setSortOrder('desc');
                        }
                      }}
                    />
                    <ColumnHeader
                      label="Posting Frequency"
                      tooltip="How often this account posts content in the selected time period. Shows posting rate as posts per day, posts per week, or average days between posts."
                      sortable
                      sortKey="postingFrequency"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={() => {
                        if (sortBy === 'postingFrequency') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('postingFrequency');
                          setSortOrder('desc');
                        }
                      }}
                    />
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-zinc-900/60 backdrop-blur z-10">
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
                      {/* Checkbox Column */}
                      <td 
                        className="w-10 px-2 sm:px-4 py-4 sticky left-0 z-20 bg-white/5 dark:bg-white/5 backdrop-blur"
                      >
                        <input
                          type="checkbox"
                          disabled
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-white focus:ring-2 focus:ring-white/20 opacity-30"
                        />
                      </td>
                      {/* Username Column */}
                      <td className="px-6 py-4 whitespace-nowrap sticky left-10 bg-white/5 dark:bg-white/5 backdrop-blur z-10">
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
                            {/* Platform Icon Overlay */}
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-900 rounded-full p-0.5 flex items-center justify-center border border-white/20">
                              <PlatformIcon platform={procAccount.platform as any} size="xs" />
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white flex items-center gap-1.5">
                                      {matchingAccount?.displayName || `@${procAccount.username}`}
                              {matchingAccount?.isVerified && (
                                <img 
                                  src="/verified-badge.png" 
                                  alt="Verified" 
                                  className="w-3.5 h-3.5"
                                />
                              )}
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

                              {/* Creator Column */}
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
                              {/* Type Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-20 h-6 bg-white/10 rounded-full animate-pulse"></div>
                      </td>
                              {/* Date Added Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-20 h-4 bg-white/10 rounded-full animate-pulse"></div>
                      </td>
                              {/* Last Refreshed Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-20 h-4 bg-white/10 rounded-full animate-pulse"></div>
                      </td>
                              {/* Followers Column */}
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {matchingAccount && (matchingAccount.followerCount ?? 0) > 0 ? (
                                  <span className="text-white animate-fade-in">{(matchingAccount.followerCount ?? 0).toLocaleString()}</span>
                                ) : (
                        <div className="w-12 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                                )}
                      </td>
                              {/* Last Post Column */}
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {matchingAccount?.lastSynced ? (
                                  <span className="text-white animate-fade-in">{formatDate(matchingAccount.lastSynced.toDate())}</span>
                                ) : (
                        <div className="w-12 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                )}
                      </td>
                              {/* Total Posts Column */}
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {matchingAccount && (matchingAccount.postCount ?? 0) > 0 ? (
                                  <span className="text-white animate-fade-in">{(matchingAccount.postCount ?? 0).toLocaleString()}</span>
                                ) : (
                        <div className="w-16 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                                )}
                      </td>
                      {/* Views Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-12 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </td>
                      {/* Top Video Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-12 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                      </td>
                      {/* Likes Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-12 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                      </td>
                      {/* Comments Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-12 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.7s' }}></div>
                      </td>
                      {/* Shares Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-12 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.8s' }}></div>
                      </td>
                      {/* Bookmarks Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-12 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.9s' }}></div>
                      </td>
                      {/* Engagement Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-12 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '1.0s' }}></div>
                      </td>
                      {/* Posting Frequency Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="w-12 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '1.1s' }}></div>
                      </td>

                      {/* Actions Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-white/5 dark:bg-white/5 backdrop-blur z-20">
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
                        onClick={(e) => {
                          // Don't trigger row click if clicking on checkbox
                          if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                          if (!isAccountSyncing) {
                            // ✅ Navigate to dashboard with account filter query param
                            navigate(`/dashboard?accounts=${account.id}`);
                          }
                        }}
                        className={clsx(
                          'transition-colors cursor-pointer',
                          {
                            'bg-gray-200 dark:bg-gray-800': selectedAccount?.id === account.id && !isAccountSyncing,
                            'bg-white/5 dark:bg-white/5 border-l-2 border-white/20 animate-pulse-slow': isAccountSyncing,
                            'hover:bg-white/5 dark:hover:bg-white/5': !isAccountSyncing,
                          }
                        )}
                      >
                        {/* Checkbox Column */}
                        <td 
                          className="w-10 px-2 sm:px-4 py-4 sticky left-0 z-20 bg-zinc-900/60 backdrop-blur group-hover:bg-white/5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedAccounts.has(account.id)}
                            onChange={() => handleSelectAccount(account.id)}
                            disabled={isAccountSyncing}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-white focus:ring-2 focus:ring-white/20 cursor-pointer disabled:opacity-30"
                          />
                        </td>
                        {/* Username Column */}
                        <td className="px-6 py-4 whitespace-nowrap sticky left-10 bg-zinc-900/60 backdrop-blur z-10 group-hover:bg-white/5">
                          <div className="flex items-center space-x-3">
                            <div className="relative w-10 h-10">
                              {account.profilePicture && !imageErrors.has(account.id) ? (
                                <img
                                  src={account.profilePicture}
                                  alt={`@${account.username}`}
                                  className="w-10 h-10 rounded-full object-cover"
                                  onError={() => {
                                    setImageErrors(prev => new Set(prev).add(account.id));
                                  }}
                                />
                              ) : (
                                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                  {(account.username || account.platform || 'A').charAt(0).toUpperCase()}
                              </div>
                              )}
                              {/* Platform Icon Overlay */}
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-900 rounded-full p-0.5 flex items-center justify-center border border-white/20">
                                <PlatformIcon platform={account.platform} size="xs" />
                                </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                                  {account.displayName || account.username}
                                  {/* Verified Badge next to username */}
                                  {account.isVerified && (
                                    <img 
                                      src="/verified-badge.png" 
                                      alt="Verified" 
                                      className="w-3.5 h-3.5"
                                    />
                                  )}
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
                                {(account.syncStatus === 'error' || account.hasError) && (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 group relative">
                                      <span className="inline-block w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                                      <span className="text-xs text-red-400 font-medium">
                                        Sync Failed
                                      </span>
                                      {account.lastSyncError && (
                                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700">
                                          <div className="font-semibold mb-1">Error Details:</div>
                                          <div className="text-gray-300">{account.lastSyncError}</div>
                                          {account.syncRetryCount && account.syncRetryCount > 0 && (
                                            <div className="text-gray-400 mt-1">
                                              Retry attempts: {account.syncRetryCount}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await retryFailedAccount(account.id, account.username);
                                      }}
                                      className="flex items-center gap-1 px-2 py-0.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
                                      title="Retry sync"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      Retry
                                    </button>
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await dismissAccountError(account.id, account.username);
                                      }}
                                      className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-500/10 rounded transition-colors"
                                      title="Dismiss error"
                                    >
                                      <X className="w-3 h-3" />
                                      Dismiss
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">@{account.username}</div>
                            </div>
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

                        {/* Type Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                            <span 
                            ref={(el) => {
                              if (el) {
                                typeBadgeRefs.current.set(account.id, el);
                              } else {
                                typeBadgeRefs.current.delete(account.id);
                              }
                            }}
                            onMouseEnter={() => setHoveredTypeId(account.id)}
                            onMouseLeave={() => setHoveredTypeId(null)}
                              className={clsx(
                                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium cursor-help transition-all",
                                (account.creatorType || 'automatic') === 'automatic'
                                  ? "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                                  : "bg-gray-500/20 text-gray-400 border border-gray-500/30 hover:bg-gray-500/30"
                              )}
                            >
                              {(account.creatorType || 'automatic') === 'automatic' ? 'Automatic' : 'Static'}
                            </span>
                          
                          <FloatingTooltip
                            isVisible={hoveredTypeId === account.id}
                            triggerRef={{ current: typeBadgeRefs.current.get(account.id) || null }}
                            position="top"
                          >
                                {(account.creatorType || 'automatic') === 'automatic' ? (
                              <div className="space-y-1.5 w-64">
                                    <div className="font-semibold text-green-400">Automatic Mode</div>
                                    <div className="text-gray-300">
                                      • <span className="text-white font-medium">Discovers new videos</span> during refresh
                                    </div>
                                    <div className="text-gray-300">
                                      • Updates <span className="text-white font-medium">all existing videos</span>
                                    </div>
                                    <div className="text-gray-300">
                                      • Best for <span className="text-white font-medium">tracking full accounts</span>
                                    </div>
                                  </div>
                                ) : (
                              <div className="space-y-1.5 w-64">
                                    <div className="font-semibold text-gray-400">Static Mode</div>
                                    <div className="text-gray-300">
                                      • <span className="text-white font-medium">Only refreshes existing videos</span>
                                    </div>
                                    <div className="text-gray-300">
                                      • Does <span className="text-white font-medium">not discover new content</span>
                                    </div>
                                    <div className="text-gray-300">
                                      • Best for <span className="text-white font-medium">specific video tracking</span>
                                    </div>
                                  </div>
                                )}
                          </FloatingTooltip>
                        </td>

                        {/* Date Added Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {(account.createdAt || account.dateAdded) ? (
                            <span className="text-xs">
                              {new Date((account.createdAt || account.dateAdded).toDate()).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-600">—</span>
                          )}
                        </td>

                        {/* Last Refreshed Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {account.lastRefreshed ? (
                            <span className="text-xs">
                              {new Date(account.lastRefreshed.toDate()).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-600">Never</span>
                          )}
                        </td>

                        {/* Followers Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {account.followerCount ? formatNumber(account.followerCount) : 'N/A'}
                        </td>

                        {/* Last Post Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {account.lastSynced ? formatDate(account.lastSynced.toDate()) : 'Never'}
                        </td>

                        {/* Total Posts Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatNumber('filteredTotalVideos' in account ? (account as AccountWithFilteredStats).filteredTotalVideos : account.totalVideos)}
                        </td>

                        {/* Views Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {formatNumber('filteredTotalViews' in account ? (account as AccountWithFilteredStats).filteredTotalViews : account.totalViews)}
                        </td>

                        {/* Top Video Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {(account as AccountWithFilteredStats).highestViewedVideo ? (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{formatNumber((account as AccountWithFilteredStats).highestViewedVideo!.views)}</span>
                            </div>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>

                        {/* Likes Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatNumber('filteredTotalLikes' in account ? (account as AccountWithFilteredStats).filteredTotalLikes : account.totalLikes)}
                        </td>

                        {/* Comments Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatNumber('filteredTotalComments' in account ? (account as AccountWithFilteredStats).filteredTotalComments : account.totalComments)}
                        </td>

                        {/* Shares Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {(() => {
                            // Only TikTok provides share counts
                            if (account.platform === 'tiktok') {
                              return formatNumber('filteredTotalShares' in account ? (account as AccountWithFilteredStats).filteredTotalShares || 0 : account.totalShares || 0);
                            }
                            // Instagram, YouTube, and Twitter don't provide share counts
                            return 'N/A';
                          })()}
                        </td>

                        {/* Bookmarks Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {(() => {
                            // Twitter and TikTok provide bookmark/save counts
                            if (account.platform === 'twitter' || account.platform === 'tiktok') {
                              return formatNumber('filteredTotalBookmarks' in account ? (account as AccountWithFilteredStats).filteredTotalBookmarks || 0 : 0);
                            }
                            // Instagram and YouTube don't provide bookmark counts
                            return 'N/A';
                          })()}
                        </td>

                        {/* Engagement Rate Column - Average across videos */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {(() => {
                            // Use average engagement if available, otherwise calculate from totals
                            if ('avgEngagementRate' in account && (account as AccountWithFilteredStats).avgEngagementRate !== undefined) {
                              return `${((account as AccountWithFilteredStats).avgEngagementRate! * 100).toFixed(2)}%`;
                            }
                            // Fallback to total-based calculation
                            const totalEngagements = (account.totalLikes || 0) + (account.totalComments || 0) + (account.totalShares || 0);
                            const totalViews = account.totalViews || 0;
                            const engagementRate = totalViews > 0 ? (totalEngagements / totalViews * 100) : 0;
                            return `${engagementRate.toFixed(2)}%`;
                          })()}
                        </td>

                        {/* Posting Frequency Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {(account as AccountWithFilteredStats).postingFrequency && (account as AccountWithFilteredStats).postingFrequency !== 'N/A' ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-blue-400" />
                              <span>{(account as AccountWithFilteredStats).postingFrequency}</span>
                            </div>
                          ) : (
                            <span className="text-white/30">N/A</span>
                          )}
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-zinc-900/60 backdrop-blur z-20 group-hover:bg-white/5">
                          <div className="flex items-center justify-end space-x-2 relative">
                            <button
                              ref={(el) => {
                                if (el) {
                                  dropdownTriggerRefs.current.set(account.id, el);
                                } else {
                                  dropdownTriggerRefs.current.delete(account.id);
                                }
                              }}
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
                            <FloatingDropdown
                              isOpen={openDropdownId === account.id}
                              onClose={() => setOpenDropdownId(null)}
                              triggerRef={{ current: dropdownTriggerRefs.current.get(account.id) || null }}
                              align="right"
                            >
                              <DropdownItem
                                icon={<ExternalLink className="w-4 h-4" />}
                                label="Go to Account"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const platformUrl = account.platform === 'tiktok' ? `https://www.tiktok.com/@${account.username}`
                                        : account.platform === 'instagram' ? `https://www.instagram.com/${account.username.replace('@', '')}`
                                        : account.platform === 'youtube' ? `https://www.youtube.com/@${account.username.replace('@', '')}`
                                        : `https://twitter.com/${account.username.replace('@', '')}`;
                                      window.open(platformUrl, '_blank');
                                      setOpenDropdownId(null);
                                    }}
                              />
                              
                              <DropdownItem
                                icon={<Copy className="w-4 h-4" />}
                                label="Copy Account Link"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const platformUrl = account.platform === 'tiktok' ? `https://www.tiktok.com/@${account.username}`
                                        : account.platform === 'instagram' ? `https://www.instagram.com/${account.username.replace('@', '')}`
                                        : account.platform === 'youtube' ? `https://www.youtube.com/@${account.username.replace('@', '')}`
                                        : `https://twitter.com/${account.username.replace('@', '')}`;
                                      navigator.clipboard.writeText(platformUrl);
                                      alert('Account link copied!');
                                      setOpenDropdownId(null);
                                    }}
                              />
                              
                              <DropdownItem
                                icon={<User className="w-4 h-4" />}
                                label="Copy Username"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(account.username);
                                      alert('Username copied!');
                                      setOpenDropdownId(null);
                                    }}
                              />
                              
                              <DropdownItem
                                icon={<BarChart3 className="w-4 h-4" />}
                                label="View Stats"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenDropdownId(null);
                                      navigate(`/dashboard?accounts=${account.id}`);
                                    }}
                              />
                              
                              <DropdownItem
                                icon={<RefreshCw className="w-4 h-4" />}
                                label={(account.creatorType || 'automatic') === 'automatic' 
                                  ? 'Convert to Static' 
                                  : 'Convert to Automatic'}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setOpenDropdownId(null);
                                      
                                      if (!organizationId || !projectId) {
                                        alert('Missing organization or project ID');
                                        return;
                                      }
                                      
                                      const currentType = account.creatorType || 'automatic';
                                      const newType = currentType === 'automatic' ? 'static' : 'automatic';
                                      
                                      try {
                                        const accountRef = doc(
                                          db,
                                          'organizations',
                                          organizationId,
                                          'projects',
                                          projectId,
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
                                    }}
                              />
                              
                              <DropdownDivider />
                              
                              <DropdownItem
                                icon={<Trash2 className="w-4 h-4" />}
                                label="Remove Account"
                                variant="danger"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenDropdownId(null);
                                      handleRemoveAccount(account.id);
                                    }}
                              />
                            </FloatingDropdown>
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
              const filteredVideoSubmissions: VideoSubmission[] = accountVideos.map(video => {
                const videoId = video.id || video.videoId || '';
                const snapshots = accountVideosSnapshots.get(videoId) || [];
                return {
                  id: videoId,
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
                  snapshots: snapshots
                };
              });

              // ALL videos (unfiltered by date) for PP calculation
              const allVideoSubmissions: VideoSubmission[] = allAccountVideos.map(video => {
                const videoId = video.id || video.videoId || '';
                const snapshots = accountVideosSnapshots.get(videoId) || [];
                return {
                  id: videoId,
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
                  snapshots: snapshots
                };
              });

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
                      
                      {showColumnToggle && createPortal(
                        <>
                          {/* Backdrop */}
                          <div 
                            className="fixed inset-0 z-[9998]" 
                            onClick={() => setShowColumnToggle(false)}
                          />
                          {/* Dropdown */}
                          <div className="fixed right-4 top-20 w-64 bg-black border border-white/20 rounded-lg shadow-2xl p-4 z-[9999]" style={{ boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)' }}>
                          <h3 className="text-sm font-semibold text-white mb-3">Toggle Columns</h3>
                            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
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
                                <label key={key} className="flex items-center space-x-2 cursor-pointer hover:bg-white/10 p-2 rounded transition-colors">
                                <input
                                  type="checkbox"
                                  checked={visibleColumns[key as keyof typeof visibleColumns]}
                                  onChange={(e) => setVisibleColumns(prev => ({ ...prev, [key]: e.target.checked }))}
                                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-white focus:ring-white/50"
                                />
                                  <span className="text-sm text-gray-200">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        </>,
                        document.body
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
                                      <HeicImage 
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
                                    <HeicImage 
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
