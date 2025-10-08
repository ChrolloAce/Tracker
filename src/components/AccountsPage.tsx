import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  Plus, 
  Users, 
  RefreshCw,
  Trash2,
  Filter,
  Search,
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
  Circle
  } from 'lucide-react';
import { AccountVideo } from '../types/accounts';
import { TrackedAccount } from '../types/firestore';
import { AccountTrackingServiceFirebase } from '../services/AccountTrackingServiceFirebase';
import FirestoreDataService from '../services/FirestoreDataService';
import RulesService from '../services/RulesService';
import { TrackingRule, RuleCondition, RuleConditionType } from '../types/rules';
import { PlatformIcon } from './ui/PlatformIcon';
import { clsx } from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import { MiniTrendChart } from './ui/MiniTrendChart';
import { TrendCalculationService } from '../services/TrendCalculationService';
import { VideoSubmission } from '../types';
import VideoPlayerModal from './VideoPlayerModal';
import { DateFilterType } from './DateRangeFilter';
import { Modal } from './ui/Modal';
import { UrlParserService } from '../services/UrlParserService';
import Pagination from './ui/Pagination';
import ColumnPreferencesService from '../services/ColumnPreferencesService';
import KPICards from './KPICards';
import DateFilterService from '../services/DateFilterService';

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
      // Instagram: https://www.instagram.com/username/
      const match = cleanPath.match(/^\/([^\/]+)\/?$/);
      return match ? match[1] : null;
    }
    
    if (platform === 'tiktok') {
      // TikTok: https://www.tiktok.com/@username
      const match = cleanPath.match(/^\/@?([^\/]+)\/?$/);
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
      // Twitter/X: https://twitter.com/username or https://x.com/username
      const match = cleanPath.match(/^\/([^\/]+)\/?$/);
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
  onViewModeChange: (mode: 'table' | 'details') => void;
  pendingAccounts?: TrackedAccount[];
}

export interface AccountsPageRef {
  handleBackToTable: () => void;
  openAddModal: () => void;
}

interface AccountWithFilteredStats extends TrackedAccount {
  filteredTotalVideos: number;
  filteredTotalViews: number;
  filteredTotalLikes: number;
  filteredTotalComments: number;
}

const AccountsPage = forwardRef<AccountsPageRef, AccountsPageProps>(({ dateFilter, platformFilter, onViewModeChange, pendingAccounts = [] }, ref) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<AccountWithFilteredStats[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<TrackedAccount | null>(null);
  const [accountVideos, setAccountVideos] = useState<AccountVideo[]>([]);
  const [activeRulesCount, setActiveRulesCount] = useState(0);
  const [viewMode, setViewMode] = useState<'table' | 'details'>('table');
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<{url: string; title: string; platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [newAccountUsername, setNewAccountUsername] = useState('');
  const [newAccountPlatform, setNewAccountPlatform] = useState<'instagram' | 'tiktok' | 'youtube' | 'twitter'>('instagram');
  const [clipboardDetectedAccount, setClipboardDetectedAccount] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'username' | 'followers' | 'videos' | 'views' | 'likes' | 'comments' | 'dateAdded'>('dateAdded');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<TrackedAccount | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showColumnToggle, setShowColumnToggle] = useState(false);
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
          console.log(`🧹 Cleaning up stuck account: @${acc.username}`);
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
            console.log(`🧹 Auto-cleanup: Removing stuck account @${acc.username}`);
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
  }, [onViewModeChange]);

  // Expose handleBackToTable and openAddModal to parent component
  useImperativeHandle(ref, () => ({
    handleBackToTable,
    openAddModal: () => setIsAddModalOpen(true)
  }), [handleBackToTable]);

  // Auto-detect account URL from clipboard when modal opens
  useEffect(() => {
    if (isAddModalOpen) {
      const checkClipboard = async () => {
        const parsed = await UrlParserService.autoDetectFromClipboard();
        
        if (parsed && parsed.isValid && parsed.platform) {
          // Extract username from URL
          const username = extractUsernameFromUrl(parsed.url, parsed.platform);
          
          if (username) {
            setNewAccountPlatform(parsed.platform);
            setNewAccountUsername(username);
            setClipboardDetectedAccount(true);
            console.log(`🎯 Auto-filled ${parsed.platform} username from clipboard: @${username}`);
          }
        }
      };
      
      checkClipboard();
    } else {
      // Reset when modal closes
      setNewAccountUsername('');
      setNewAccountPlatform('instagram');
      setClipboardDetectedAccount(false);
    }
  }, [isAddModalOpen]);

  // Load accounts on mount and restore selected account
  useEffect(() => {
    const loadAccounts = async () => {
      if (!currentOrgId || !currentProjectId) {
        setLoading(false);
        return;
      }

      try {
        console.log('📥 Loading accounts from Firestore...');
        const loadedAccounts = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
        setAccounts(loadedAccounts);

        // Restore selected account from localStorage
        const savedSelectedAccountId = localStorage.getItem('selectedAccountId');
        if (savedSelectedAccountId && loadedAccounts.length > 0) {
          const savedAccount = loadedAccounts.find(a => a.id === savedSelectedAccountId);
          if (savedAccount) {
            console.log('🔄 Restoring selected account:', savedAccount.username);
            setSelectedAccount(savedAccount);
          }
        }
      } catch (error) {
        console.error('❌ Failed to load accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAccounts();
  }, [currentOrgId, currentProjectId]);

  // Real-time listener for syncing accounts
  useEffect(() => {
    if (!currentOrgId || !currentProjectId) return;

    console.log('👂 Setting up real-time sync status listener...');

    const accountsRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts');
    const syncingQuery = query(accountsRef, where('syncStatus', 'in', ['pending', 'syncing']));

    const unsubscribe = onSnapshot(syncingQuery, (snapshot) => {
      const syncingIds = new Set<string>();
      const previousSize = syncingAccounts.size;
      
      snapshot.docs.forEach((doc) => {
        syncingIds.add(doc.id);
        const data = doc.data();
        console.log(`🔄 Account syncing: ${data.username} - ${data.syncStatus}`);
      });

      setSyncingAccounts(syncingIds);

      // If an account just finished syncing (size decreased), reload
      if (syncingIds.size < previousSize && syncingIds.size === 0) {
        console.log('✅ All syncs completed! Reloading accounts...');
        setTimeout(() => {
          window.location.reload(); // Force reload to show new data
        }, 1000);
      }
    });

    return () => {
      console.log('👋 Cleaning up sync status listener');
      unsubscribe();
    };
  }, [currentOrgId, currentProjectId]);

  // Calculate filtered stats for all accounts (for table view)
  useEffect(() => {
    const calculateFilteredStats = async () => {
      if (!currentOrgId || !currentProjectId || accounts.length === 0 || viewMode !== 'table') {
        return;
      }

      console.log('📊 Calculating filtered stats for table view...');
      const accountsWithStats: AccountWithFilteredStats[] = [];

      for (const account of accounts) {
        try {
          // Load videos for this account
          const videos = await AccountTrackingServiceFirebase.getAccountVideos(
            currentOrgId,
            currentProjectId,
            account.id
          );

          // Apply rules filtering
          const rulesFilteredVideos = await RulesService.filterVideosByRules(
            currentOrgId,
            currentProjectId,
            account.id,
            account.platform,
            videos
          );

          // Apply date filtering
          const videoSubmissions: VideoSubmission[] = rulesFilteredVideos.map(video => ({
            id: video.id || video.videoId || '',
            url: video.url || '',
            platform: account.platform,
            thumbnail: video.thumbnail || '',
            title: video.caption || 'No caption',
            uploader: account.displayName || account.username,
            uploaderHandle: account.username,
            status: 'approved' as const,
            views: video.viewsCount || video.views || 0,
            likes: video.likesCount || video.likes || 0,
            comments: video.commentsCount || video.comments || 0,
            shares: video.sharesCount || video.shares || 0,
            dateSubmitted: video.uploadDate || new Date(),
            uploadDate: video.uploadDate || new Date(),
            snapshots: []
          }));

          const dateAndRulesFiltered = DateFilterService.filterVideosByDateRange(
            videoSubmissions,
            dateFilter,
            undefined
          );

          // Calculate stats from filtered videos
          const filteredTotalVideos = dateAndRulesFiltered.length;
          const filteredTotalViews = dateAndRulesFiltered.reduce((sum, v) => sum + v.views, 0);
          const filteredTotalLikes = dateAndRulesFiltered.reduce((sum, v) => sum + v.likes, 0);
          const filteredTotalComments = dateAndRulesFiltered.reduce((sum, v) => sum + v.comments, 0);

          accountsWithStats.push({
            ...account,
            filteredTotalVideos,
            filteredTotalViews,
            filteredTotalLikes,
            filteredTotalComments
          });
        } catch (error) {
          console.error(`Failed to calculate stats for ${account.username}:`, error);
          // Fallback to original stats
          accountsWithStats.push({
            ...account,
            filteredTotalVideos: account.totalVideos,
            filteredTotalViews: account.totalViews,
            filteredTotalLikes: account.totalLikes,
            filteredTotalComments: account.totalComments
          });
        }
      }

      console.log(`✅ Calculated filtered stats for ${accountsWithStats.length} accounts`);
      setFilteredAccounts(accountsWithStats);
    };

    calculateFilteredStats();
  }, [accounts, currentOrgId, currentProjectId, dateFilter, viewMode]);

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

  // Load videos when account is selected or date filter changes
  useEffect(() => {
    const loadVideos = async () => {
      if (selectedAccount && currentOrgId && currentProjectId) {
        console.log('📱 Loading videos for account:', selectedAccount.username);
        const videos = await AccountTrackingServiceFirebase.getAccountVideos(currentOrgId, currentProjectId, selectedAccount.id);
        console.log('📹 Loaded videos from Firestore:', videos.length);
        
        // Apply rules to filter videos in real-time
        console.log('📋 Applying rules to filter videos...');
        
        // Get active rules for this account
        const accountRules = await RulesService.getRulesForAccount(
          currentOrgId,
          currentProjectId,
          selectedAccount.id,
          selectedAccount.platform
        );
        setActiveRulesCount(accountRules.length);
        
        const rulesFilteredVideos = await RulesService.filterVideosByRules(
          currentOrgId,
          currentProjectId,
          selectedAccount.id,
          selectedAccount.platform,
          videos
        );
        
        console.log(`✅ Rules filtered: ${rulesFilteredVideos.length}/${videos.length} videos match rules (${accountRules.length} rules active)`);
        
        // Apply date filtering on top of rules filtering
        const videoSubmissions: VideoSubmission[] = rulesFilteredVideos.map(video => ({
          id: video.id || video.videoId || '',
          url: video.url || '',
          platform: selectedAccount.platform,
          thumbnail: video.thumbnail || '',
          title: video.caption || 'No caption',
          uploader: selectedAccount.displayName || selectedAccount.username,
          uploaderHandle: selectedAccount.username,
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
          dateFilter,
          undefined
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
        
        console.log(`✅ Date + Rules filtered: ${finalFilteredVideos.length}/${videos.length} videos (${accountRules.length} rules, ${dateFilter} date range)`);
        setAccountVideos(finalFilteredVideos);
        setViewMode('details');
        onViewModeChange('details');
        
        // Reset pagination when loading new account or filter changes
        setCurrentPage(1);
        
        // Save selected account ID to localStorage for persistence
        localStorage.setItem('selectedAccountId', selectedAccount.id);
      } else {
        setViewMode('table');
        onViewModeChange('table');
        setAccountVideos([]);
        
        // Clear selected account ID from localStorage
        localStorage.removeItem('selectedAccountId');
      }
    };

    loadVideos();
  }, [selectedAccount, currentOrgId, currentProjectId, onViewModeChange, dateFilter]);

  const handleSyncAccount = useCallback(async (accountId: string) => {
    if (!currentOrgId || !currentProjectId || !user) return;

    setIsSyncing(accountId);
    setSyncError(null);
    try {
      console.log(`🔄 Starting sync for account ${accountId}...`);
      const videoCount = await AccountTrackingServiceFirebase.syncAccountVideos(currentOrgId, currentProjectId, user.uid, accountId);
      
      // Update accounts list
      const updatedAccounts = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
      setAccounts(updatedAccounts);
      
      // Update videos if this account is selected
      if (selectedAccount?.id === accountId) {
        const videos = await AccountTrackingServiceFirebase.getAccountVideos(currentOrgId, currentProjectId, accountId);
        console.log('🔄 Updating displayed videos after sync:', videos.length);
        
        // Apply rules to filter
        const filteredVideos = await RulesService.filterVideosByRules(
          currentOrgId,
          currentProjectId,
          accountId,
          selectedAccount.platform,
          videos
        );
        console.log(`✅ After sync filter: ${filteredVideos.length}/${videos.length} videos match rules`);
        setAccountVideos(filteredVideos);
      }
      
      console.log(`✅ Successfully synced ${videoCount} videos to Firestore`);
      
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

  const handleAddAccount = useCallback(async () => {
    if (!newAccountUsername.trim() || !currentOrgId || !currentProjectId || !user) return;

    const username = newAccountUsername.trim();
    const platform = newAccountPlatform;

    // Add to processing accounts immediately with timestamp
    setProcessingAccounts(prev => [...prev, { username, platform, startedAt: Date.now() }]);
    
    // Close modal and reset form immediately
    setNewAccountUsername('');
    setIsAddModalOpen(false);

    try {
      await AccountTrackingServiceFirebase.addAccount(
        currentOrgId,
        currentProjectId,
        user.uid,
        username,
        platform,
        'my' // Default to 'my' account type
      );
      
      // Reload accounts
      const updatedAccounts = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
      setAccounts(updatedAccounts);
      
      console.log(`✅ Added account @${username}`);
      console.log(`⏳ Account queued for background sync. Check your email in 5-10 minutes!`);
      
      // Remove from processing accounts
      setProcessingAccounts(prev => prev.filter(acc => acc.username !== username));
    } catch (error) {
      console.error('Failed to add account:', error);
      alert('Failed to add account. Please check the username and try again.');
      // Remove from processing accounts on error
      setProcessingAccounts(prev => prev.filter(acc => acc.username !== username));
    }
  }, [newAccountUsername, newAccountPlatform, currentOrgId, currentProjectId, user, handleSyncAccount]);

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
        ...rule,
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
      
      // Reload videos with updated rules by triggering the useEffect
      setSelectedAccount({ ...selectedAccount });
      
      console.log(`✅ Toggled rule "${rule.name}" for @${selectedAccount.username}`);
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      alert('Failed to update rule. Please try again.');
    }
  }, [currentOrgId, currentProjectId, selectedAccount, allRules, accountRules]);

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
      
      console.log(`✅ Created rule "${ruleName}" for @${selectedAccount.username}`);
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

      {/* Controls Bar - Only show in table mode */}
      {viewMode === 'table' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-80 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {viewMode === 'table' ? (
        <div className="space-y-6">
          {/* Accounts Table */}
          <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 overflow-hidden">
          {accounts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">No accounts tracked yet</h3>
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
                          <span className="text-blue-500">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Platform
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
                          <span className="text-blue-500">
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
                          <span className="text-blue-500">
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
                          <span className="text-blue-500">
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
                          <span className="text-blue-500">
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
                          <span className="text-blue-500">
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
                      className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 dark:from-blue-500/20 dark:via-purple-500/20 dark:to-blue-500/20 border-l-4 border-blue-500 dark:border-blue-400"
                    >
                      {/* Username Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="relative w-10 h-10">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center animate-spin">
                              <RefreshCw className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              @{procAccount.username}
                            </div>
                            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium animate-pulse">
                              ⏳ Account processing...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Platform Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <PlatformIcon platform={procAccount.platform as any} size="sm" />
                          <span className="text-sm text-gray-900 dark:text-white capitalize">{procAccount.platform}</span>
                        </div>
                      </td>

                      {/* Other columns with loading placeholders */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 dark:text-gray-500">
                        <div className="w-16 h-4 bg-gray-300 dark:bg-white/10 rounded animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 dark:text-gray-500">
                        <div className="w-12 h-4 bg-gray-300 dark:bg-white/10 rounded animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 dark:text-gray-500">
                        <div className="w-12 h-4 bg-gray-300 dark:bg-white/10 rounded animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 dark:text-gray-500">
                        <div className="w-16 h-4 bg-gray-300 dark:bg-white/10 rounded animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 dark:text-gray-500">
                        <div className="w-12 h-4 bg-gray-300 dark:bg-white/10 rounded animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 dark:text-gray-500">
                        <div className="w-12 h-4 bg-gray-300 dark:bg-white/10 rounded animate-pulse"></div>
                      </td>

                      {/* Actions Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setProcessingAccounts(prev => prev.filter((_, i) => i !== index));
                              console.log(`🗑️ Manually removed stuck account: @${procAccount.username}`);
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
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
                            'bg-blue-900/20 dark:bg-blue-900/20': selectedAccount?.id === account.id && !isAccountSyncing,
                            'bg-yellow-900/10 dark:bg-yellow-900/10 animate-pulse': isAccountSyncing,
                            'hover:bg-white/5 dark:hover:bg-white/5 cursor-pointer': !isAccountSyncing,
                            'cursor-not-allowed opacity-60 pointer-events-none': isAccountSyncing,
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
                                  <div className="flex items-center gap-1.5">
                                    <RefreshCw className="w-3.5 h-3.5 text-yellow-500 animate-spin" />
                                    <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                                      Syncing...
                                    </span>
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
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveAccount(account.id);
                              }}
                              disabled={isAccountSyncing}
                              className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={isAccountSyncing ? "Account is syncing..." : "Remove account"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
                        className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors group"
                      >
                        <Filter className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                          {activeRulesCount} {activeRulesCount === 1 ? 'Rule' : 'Rules'} Active
                        </span>
                        <Edit2 className="w-3 h-3 text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                    <button
                      onClick={handleOpenRuleModal}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      {activeRulesCount > 0 ? 'Manage Rules' : 'Add Rule'}
                    </button>
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
                title: video.caption || 'No caption',
                uploader: selectedAccount.displayName || selectedAccount.username,
                uploaderHandle: selectedAccount.username,
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
                <div className="mb-6">
                  <KPICards 
                    submissions={filteredVideoSubmissions}
                    linkClicks={[]}
                    dateFilter={dateFilter}
                    timePeriod="days"
                  />
                </div>
              );
              })()}

            {/* Videos Table */}
            <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg overflow-hidden">
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
                                  className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
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
                                <span className="text-blue-400">
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
                                <span className="text-blue-400">
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
                                <span className="text-blue-400">
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
                                <span className="text-blue-400">
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
                                <span className="text-blue-400">
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
                                <span className="text-blue-400">
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
                          title: video.caption || 'No caption',
                          uploader: selectedAccount.displayName || selectedAccount.username,
                          uploaderHandle: selectedAccount.username,
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
                                  <p className="text-sm font-medium text-white truncate" title={video.caption || 'No caption'}>
                                    {video.caption || 'No caption'}
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
                                  setSelectedVideoForPlayer({
                                    url: video.url || '',
                                    title: video.caption || 'No caption',
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
                                <Activity className="w-4 h-4 text-purple-500" />
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
                                className="text-gray-400 hover:text-blue-400 transition-colors"
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
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={clsx('w-4 h-4', { 'animate-spin': isSyncing === selectedAccount.id })} />
                    <span>{isSyncing === selectedAccount.id ? 'Syncing...' : 'Sync Videos'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      )}


      {/* Add Account Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 dark:bg-zinc-900 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Add Account to Track</h2>
              <p className="text-gray-500 dark:text-gray-400">Start monitoring a new Instagram, TikTok, or YouTube account</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Choose Platform
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => setNewAccountPlatform('instagram')}
                    className={clsx(
                      'flex flex-col items-center justify-center space-y-2 py-4 px-3 rounded-xl border-2 transition-all duration-200',
                      newAccountPlatform === 'instagram'
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                        : 'border-gray-700 dark:border-gray-700 hover:border-gray-600 dark:hover:border-gray-600 hover:bg-gray-800 dark:hover:bg-gray-800 text-gray-300'
                    )}
                  >
                    <PlatformIcon platform="instagram" size="md" />
                    <span className="font-medium text-xs">Instagram</span>
                  </button>
                  <button
                    onClick={() => setNewAccountPlatform('tiktok')}
                    className={clsx(
                      'flex flex-col items-center justify-center space-y-2 py-4 px-3 rounded-xl border-2 transition-all duration-200',
                      newAccountPlatform === 'tiktok'
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                        : 'border-gray-700 dark:border-gray-700 hover:border-gray-600 dark:hover:border-gray-600 hover:bg-gray-800 dark:hover:bg-gray-800 text-gray-300'
                    )}
                  >
                    <PlatformIcon platform="tiktok" size="md" />
                    <span className="font-medium text-xs">TikTok</span>
                  </button>
                  <button
                    onClick={() => setNewAccountPlatform('youtube')}
                    className={clsx(
                      'flex flex-col items-center justify-center space-y-2 py-4 px-3 rounded-xl border-2 transition-all duration-200',
                      newAccountPlatform === 'youtube'
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                        : 'border-gray-700 dark:border-gray-700 hover:border-gray-600 dark:hover:border-gray-600 hover:bg-gray-800 dark:hover:bg-gray-800 text-gray-300'
                    )}
                  >
                    <Play className="w-6 h-6" />
                    <span className="font-medium text-xs">YouTube</span>
                  </button>
                  <button
                    onClick={() => setNewAccountPlatform('twitter')}
                    className={clsx(
                      'flex flex-col items-center justify-center space-y-2 py-4 px-3 rounded-xl border-2 transition-all duration-200',
                      newAccountPlatform === 'twitter'
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                        : 'border-gray-700 dark:border-gray-700 hover:border-gray-600 dark:hover:border-gray-600 hover:bg-gray-800 dark:hover:bg-gray-800 text-gray-300'
                    )}
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span className="font-medium text-xs">Twitter</span>
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Username
                </label>
                
                {clipboardDetectedAccount && (
                  <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="text-sm text-green-700 dark:text-green-300">
                      ✨ Auto-detected account from clipboard!
                    </span>
                  </div>
                )}
                
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">@</span>
                <input
                  type="text"
                  value={newAccountUsername}
                  onChange={(e) => setNewAccountUsername(e.target.value)}
                    placeholder="username"
                    className="w-full pl-8 pr-4 py-4 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Enter the username without the @ symbol
                </p>
              </div>
            </div>

            <div className="flex space-x-4 mt-8">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 px-6 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAccount}
                disabled={!newAccountUsername.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl"
              >
                Add Account
              </button>
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
                  className="flex items-center gap-1 px-3 py-1 text-sm text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
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
                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
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
            <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-blue-300 mb-1">
                    Auto-Applied to @{selectedAccount?.username}
                  </h4>
                  <p className="text-xs text-blue-200/80">
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
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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
                        ? 'bg-blue-900/20 border-blue-500/50'
                        : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    )}
                    onClick={() => handleToggleRule(rule.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {isApplied ? (
                          <CheckCircle2 className="w-5 h-5 text-blue-400" />
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
                                <span className="text-blue-400 font-semibold">
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
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
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
    </div>
  );
});

AccountsPage.displayName = 'AccountsPage';

export default AccountsPage;
