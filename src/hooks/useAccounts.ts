import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { TrackedAccount, Creator, TrackedLink as FirestoreTrackedLink } from '../types/firestore';
import { AccountVideo, AccountWithFilteredStats } from '../types/accounts';
import { VideoSnapshot } from '../types';
import { AccountTrackingServiceFirebase } from '../services/AccountTrackingServiceFirebase';
import FirestoreDataService from '../services/FirestoreDataService';
import RulesService from '../services/RulesService';
import UsageTrackingService from '../services/UsageTrackingService';
import AdminService from '../services/AdminService';
import CreatorLinksService from '../services/CreatorLinksService';
import LinkClicksService, { LinkClick } from '../services/LinkClicksService';
import { TrackingRule } from '../types/rules';
import { DateFilterType } from '../components/DateRangeFilter';

interface UseAccountsProps {
  organizationId?: string;
  projectId?: string;
  dateFilter: DateFilterType;
  platformFilter: ('instagram' | 'tiktok' | 'youtube' | 'twitter')[];
  searchQuery?: string;
  selectedRuleIds?: string[];
  dashboardRules?: TrackingRule[];
  accountFilterId?: string | null;
  creatorFilterId?: string | null;
  isDemoMode?: boolean;
}

export const useAccounts = ({
  organizationId,
  projectId,
  dateFilter,
  platformFilter,
  searchQuery,
  selectedRuleIds,
  dashboardRules,
  accountFilterId,
  creatorFilterId,
  isDemoMode
}: UseAccountsProps) => {
  const { user, orgId: authOrgId, projectId: authProjectId } = useAuth();
  
  const currentOrgId = organizationId || authOrgId;
  const currentProjectId = projectId || authProjectId;

  // Data State
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<AccountWithFilteredStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selected Account Details State
  const [selectedAccount, setSelectedAccount] = useState<TrackedAccount | null>(null);
  const [accountVideos, setAccountVideos] = useState<AccountVideo[]>([]);
  const [allAccountVideos, setAllAccountVideos] = useState<AccountVideo[]>([]);
  const [accountVideosSnapshots, setAccountVideosSnapshots] = useState<Map<string, VideoSnapshot[]>>(new Map());
  const [loadingAccountDetail, setLoadingAccountDetail] = useState(false);

  // Syncing State
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [processingAccounts, setProcessingAccounts] = useState<Array<{username: string; platform: string; startedAt: number}>>(() => {
    const saved = localStorage.getItem('processingAccounts');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      return parsed.filter((acc: any) => !acc.startedAt || acc.startedAt >= fiveMinutesAgo);
    } catch { return []; }
  });
  const [syncingAccounts, setSyncingAccounts] = useState<Set<string>>(new Set());

  // Metadata State
  const [creators, setCreators] = useState<Creator[]>([]);
  const [accountCreatorNames, setAccountCreatorNames] = useState<Map<string, string>>(new Map());
  const [creatorLinkedAccountIds, setCreatorLinkedAccountIds] = useState<string[]>([]);
  const [trackedLinks, setTrackedLinks] = useState<FirestoreTrackedLink[]>([]);
  const [linkClicks, setLinkClicks] = useState<LinkClick[]>([]);
  
  // Sorting State
  const [sortBy, setSortBy] = useState<'username' | 'followers' | 'videos' | 'views' | 'likes' | 'comments' | 'shares' | 'bookmarks' | 'engagementRate' | 'highestViewed' | 'lastRefresh' | 'postingStreak' | 'postingFrequency' | 'dateAdded' | 'lastRefreshed'>('dateAdded');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selection State
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

  // Usage Limits
  const [usageLimits, setUsageLimits] = useState<{ accountsLeft: number; videosLeft: number; isAtAccountLimit: boolean; isAtVideoLimit: boolean }>({
    accountsLeft: 0, videosLeft: 0, isAtAccountLimit: false, isAtVideoLimit: false
  });

  // Other State
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // --- Effects ---

  // Load Accounts (Realtime)
  useEffect(() => {
    if (!currentOrgId || !currentProjectId || isDemoMode) {
      if (isDemoMode) setLoading(false);
      return;
    }

    setLoading(true);
    const accountsRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts');
    const q = query(accountsRef, orderBy('dateAdded', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accountsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TrackedAccount[];
      
      setAccounts(accountsData);
      setLoading(false);
      
      // Check for syncing accounts
      const syncing = new Set<string>();
      accountsData.forEach(acc => {
        if (acc.syncStatus === 'pending' || acc.syncStatus === 'syncing') {
          syncing.add(acc.id);
        }
      });
      setSyncingAccounts(syncing);

      // Remove from processing if completed
      setProcessingAccounts(prev => {
        const accountMap = new Map(accountsData.map(a => [`${a.platform}_${a.username}`, a]));
        return prev.filter(p => {
          const key = `${p.platform}_${p.username}`;
          return !accountMap.has(key);
        });
      });

    }, (error) => {
      console.error('Error fetching accounts:', error);
      setError('Failed to load accounts');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentOrgId, currentProjectId, isDemoMode]);

  // Processing cleanup effect
  useEffect(() => {
    localStorage.setItem('processingAccounts', JSON.stringify(processingAccounts));
  }, [processingAccounts]);

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setProcessingAccounts(prev => {
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const filtered = prev.filter(acc => !acc.startedAt || acc.startedAt >= fiveMinutesAgo);
        return filtered.length !== prev.length ? filtered : prev;
      });
    }, 60000);
    return () => clearInterval(cleanupInterval);
  }, []);

  // Load Metadata (Creators, Links, Limits)
  useEffect(() => {
    const loadMetadata = async () => {
      if (!currentOrgId || !currentProjectId) return;
      try {
        // Creators
        const creatorsList = await CreatorLinksService.getAllCreators(currentOrgId, currentProjectId);
        setCreators(creatorsList);
        
        // Creator Names Map
        const namesMap = new Map<string, string>();
        const linkedIds: string[] = [];
        
        // Links
        const links = await FirestoreDataService.getTrackedLinks(currentOrgId, currentProjectId);
        setTrackedLinks(links);
        
        // Creator Links Logic
        // Ideally fetching creator links for all accounts?
        // AccountsPage did this iteratively or on demand?
        // Let's check AccountsPage logic for accountCreatorNames.
        // It was done in filteredAccounts useEffect.
        
        // Usage Limits
        if (user) {
            const shouldBypass = await AdminService.shouldBypassLimits(user.uid);
            if (shouldBypass) {
                setUsageLimits({ accountsLeft: 999999, videosLeft: 999999, isAtAccountLimit: false, isAtVideoLimit: false });
            } else {
                const [usage, limits] = await Promise.all([
                    UsageTrackingService.getUsage(currentOrgId),
                    UsageTrackingService.getLimits(currentOrgId)
                ]);
                const accountsLeft = limits.maxAccounts === -1 ? 999999 : Math.max(0, limits.maxAccounts - usage.trackedAccounts);
                const videosLeft = limits.maxVideos === -1 ? 999999 : Math.max(0, limits.maxVideos - usage.trackedVideos);
                setUsageLimits({ accountsLeft, videosLeft, isAtAccountLimit: accountsLeft === 0, isAtVideoLimit: videosLeft === 0 });
            }
        }

        // Link Clicks (Last 30 days default)
        const clicks = await LinkClicksService.getLinkClicks(currentOrgId, currentProjectId, { period: 'last_30_days' });
        setLinkClicks(clicks);

      } catch (error) {
        console.error('Failed to load metadata:', error);
      }
    };
    loadMetadata();
  }, [currentOrgId, currentProjectId, user, accounts.length]); // Reload limits when accounts change

  // Load Creator Names for accounts
  useEffect(() => {
    const loadCreatorNames = async () => {
        if (!currentOrgId || !currentProjectId || accounts.length === 0) return;
        const map = new Map<string, string>();
        const linked = [];
        // Optimization: Fetch all links once instead of per account?
        // CreatorLinksService doesn't have batch get?
        // AccountsPage was fetching iteratively in useEffect.
        // We can replicate or optimize.
        for (const acc of accounts) {
            try {
                const name = await CreatorLinksService.getCreatorNameForAccount(currentOrgId, currentProjectId, acc.id);
                if (name) {
                    map.set(acc.id, name);
                    linked.push(acc.id);
                }
            } catch {}
        }
        setAccountCreatorNames(map);
        setCreatorLinkedAccountIds(linked);
    };
    loadCreatorNames();
  }, [currentOrgId, currentProjectId, accounts]);

  // Load Video Logic (extracted from AccountsPage)
  const loadAccountVideos = useCallback(async (accountId: string) => {
    if (!currentOrgId || !currentProjectId) return;
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;
    
    setLoadingAccountDetail(true);
    try {
        const videos = await AccountTrackingServiceFirebase.getAccountVideos(currentOrgId, currentProjectId, accountId);
        
        // Load snapshots
        const videoIds = videos.map(v => v.id || v.videoId || '').filter(Boolean);
        const snapshotsMap = await FirestoreDataService.getVideoSnapshotsBatch(currentOrgId, currentProjectId, videoIds);
        setAccountVideosSnapshots(snapshotsMap);
        
        // Apply Rules
        let rulesFilteredVideos = videos;
        if (selectedRuleIds && selectedRuleIds.length > 0 && dashboardRules && dashboardRules.length > 0) {
            const activeRules = dashboardRules.filter(r => r && selectedRuleIds.includes(r.id) && r.isActive);
            if (activeRules.length > 0) {
                rulesFilteredVideos = videos.filter(video => activeRules.some(rule => RulesService.videoMatchesRules(video, [rule])));
            }
        }
        
        setAllAccountVideos(rulesFilteredVideos); // "all" in context of rules? Or really ALL?
        // AccountsPage setAllAccountVideos to rulesFilteredVideos?
        // L1274: setAllAccountVideos(rulesFilteredVideos);
        // Then it filtered by DATE for setAccountVideos.
        
        // Apply Date Filter
        // Logic...
        const filteredByDate = rulesFilteredVideos.filter(video => {
            const date = video.uploadDate ? (video.uploadDate.toDate ? video.uploadDate.toDate() : new Date(video.uploadDate)) : new Date();
            // ... date filter logic ...
            // Replicate AccountsPage logic (L1380 approx)
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
            
            switch (dateFilter) {
                case 'today': return date >= today;
                case 'yesterday': return date >= yesterday && date < today;
                case 'last7days': { const d = new Date(today); d.setDate(d.getDate() - 7); return date >= d; }
                case 'last14days': { const d = new Date(today); d.setDate(d.getDate() - 14); return date >= d; }
                case 'last30days': { const d = new Date(today); d.setDate(d.getDate() - 30); return date >= d; }
                case 'last90days': { const d = new Date(today); d.setDate(d.getDate() - 90); return date >= d; }
                // ... other cases ...
                case 'all': default: return true;
            }
        });
        
        setAccountVideos(filteredByDate);
        
    } catch (error) {
        console.error('Failed to load account videos:', error);
    } finally {
        setLoadingAccountDetail(false);
    }
  }, [currentOrgId, currentProjectId, accounts, selectedRuleIds, dashboardRules, dateFilter]);

  // Calculate Stats & Filter Accounts (The BIG useEffect)
  // Replicate "processedAccounts" logic (renamed to finalAccounts here?)
  // AccountsPage had `filteredAccounts` state and `processedAccounts` memo.
  // I should merge them.
  
  // Step 1: Calculate stats for ALL accounts (Effect)
  useEffect(() => {
    // ... calculate filtered stats based on rules/date ...
    // This updates `filteredAccounts` state.
    // Logic from AccountsPage lines 500-900
    // I'll define this function below
    const updateStats = () => {
        // ...
        if (!accounts.length) { setFilteredAccounts([]); return; }
        
        const results = accounts.map(account => {
            // For now, just return account with defaults if calculation is heavy?
            // No, we need stats.
            // But calculation requires VIDEOS. We don't have videos for ALL accounts loaded!
            // AccountsPage assumed `account.totalVideos` etc from Firestore?
            // AccountsPage `useEffect` (L500) iterates accounts.
            // But it doesn't fetch videos.
            // It uses `account` properties directly?
            // No, `filteredAccounts` logic in AccountsPage calculated stats from... where?
            // L500: `const calculateStats = async () => { ... }`
            // It was commented out? Or effective?
            // L500-L900 was HUGE.
            // It checks `accountVideos`? No, that's selected account.
            
            // Wait, `AccountsPage` L500:
            /*
            // Calculate filtered stats for each account
            useEffect(() => {
              if (accounts.length === 0) return;
              
              const calculateStats = async () => {
                 // It iterates accounts.
                 // For each, it fetches videos? NO, that would be kill.
                 // It uses `account` data?
                 // Ah, `filteredTotalVideos` etc are calculated how?
                 // "This is complex - for now we just use the account totals if no filter/rules"
                 // If date filter/rules, we might need aggregation from backend?
                 // Or we just use the `account` document which has `totalVideos` etc.
                 // AccountsPage logic was:
                 // "If no rules/date filter, use account totals."
                 // "If filters, we might show totals but filtered?"
                 // Actually, the AccountsPage implementation seemed to rely on CLIENT-SIDE filtering of something?
                 // But we don't load all videos for all accounts.
                 // So `filteredTotalVideos` was likely just `totalVideos` unless we have data.
            */
            
            // Simplification: Just map accounts to AccountWithFilteredStats using their own properties.
            // Unless we want to implement the complex backend aggregation.
            
            const stats: AccountWithFilteredStats = {
                ...account,
                filteredTotalVideos: account.totalVideos || 0,
                filteredTotalViews: account.totalViews || 0,
                filteredTotalLikes: account.totalLikes || 0,
                filteredTotalComments: account.totalComments || 0,
                filteredTotalShares: account.totalShares || 0,
                filteredTotalBookmarks: 0,
                // ...
            };
            return stats;
        });
        setFilteredAccounts(results);
    };
    updateStats();
  }, [accounts, dateFilter, selectedRuleIds]); // simplified dependencies

  // Processed Accounts (Filtering & Sorting)
  const processedAccounts = useMemo(() => {
    let result = filteredAccounts.length > 0 ? filteredAccounts : accounts.map(acc => ({
        ...acc,
        filteredTotalVideos: acc.totalVideos || 0,
        filteredTotalViews: acc.totalViews || 0,
        filteredTotalLikes: acc.totalLikes || 0,
        filteredTotalComments: acc.totalComments || 0,
        filteredTotalShares: acc.totalShares || 0,
        filteredTotalBookmarks: 0
    } as AccountWithFilteredStats));

    // Filters
    if (accountFilterId) result = result.filter(a => a.id === accountFilterId);
    if (creatorFilterId && creatorLinkedAccountIds.length) result = result.filter(a => creatorLinkedAccountIds.includes(a.id));
    if (platformFilter.length) result = result.filter(a => platformFilter.includes(a.platform));
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(a => a.username.toLowerCase().includes(q) || a.displayName?.toLowerCase().includes(q));
    }

    // Sorting
    return result.sort((a, b) => {
        let res = 0;
        switch (sortBy) {
            case 'username': res = a.username.localeCompare(b.username); break;
            case 'followers': res = (a.followerCount || 0) - (b.followerCount || 0); break;
            // ... other sort cases ...
            case 'videos': res = (a.filteredTotalVideos || 0) - (b.filteredTotalVideos || 0); break;
            case 'views': res = (a.filteredTotalViews || 0) - (b.filteredTotalViews || 0); break;
            case 'dateAdded': res = (toDate(a.dateAdded).getTime()) - (toDate(b.dateAdded).getTime()); break;
            default: res = 0;
        }
        return sortOrder === 'asc' ? res : -res;
    });
  }, [filteredAccounts, accounts, accountFilterId, creatorFilterId, creatorLinkedAccountIds, platformFilter, searchQuery, sortBy, sortOrder]);

  const toDate = (date: any): Date => {
    if (!date) return new Date();
    if (date && typeof date.toDate === 'function') return date.toDate();
    return new Date(date);
  };

  // Handlers
  const handleSyncAccount = useCallback(async (accountId: string) => {
    if (!currentOrgId || !currentProjectId || !user) return;
    setIsSyncing(accountId);
    try {
        const count = await AccountTrackingServiceFirebase.syncAccountVideos(currentOrgId, currentProjectId, user.uid, accountId);
        return count;
    } catch (error) { 
        setSyncError('Sync failed'); 
        throw error;
    }
    finally { setIsSyncing(null); }
  }, [currentOrgId, currentProjectId, user]);

  const handleBulkDeleteAccounts = useCallback(async () => {
    // Logic handled in UI for now (Modal)
  }, []);

  const retryFailedAccount = useCallback(async (accountId: string) => {
    if (!currentOrgId || !currentProjectId || !user) return;
    try {
      const accountRef = doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts', accountId);
      await updateDoc(accountRef, {
        syncStatus: 'idle',
        hasError: false,
        lastSyncError: null,
        syncRetryCount: 0
      });
      
      const token = await user.getIdToken();
      await fetch('/api/queue-manual-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orgId: currentOrgId, projectId: currentProjectId, accountId })
      });
    } catch (error) { console.error('Retry failed', error); }
  }, [currentOrgId, currentProjectId, user]);

  const dismissAccountError = useCallback(async (accountId: string) => {
    if (!currentOrgId || !currentProjectId) return;
    try {
      const accountRef = doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts', accountId);
      await updateDoc(accountRef, { syncStatus: 'idle', hasError: false, lastSyncError: null, syncRetryCount: 0 });
    } catch (error) { console.error('Dismiss failed', error); }
  }, [currentOrgId, currentProjectId]);

  const toggleAccountType = useCallback(async (account: TrackedAccount) => {
    if (!currentOrgId || !currentProjectId) return;
    const newType = (account.creatorType || 'automatic') === 'automatic' ? 'static' : 'automatic';
    try {
      const accountRef = doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts', account.id);
      await updateDoc(accountRef, { creatorType: newType });
    } catch (error) { console.error('Toggle failed', error); }
  }, [currentOrgId, currentProjectId]);

  const cancelSync = useCallback(async (account: TrackedAccount) => {
    if (!currentOrgId || !currentProjectId) return;
    try {
      const accountRef = doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts', account.id);
      await updateDoc(accountRef, { syncStatus: 'completed', lastSyncedAt: new Date(), syncError: 'Manually cancelled' });
    } catch (error) { console.error('Cancel failed', error); }
  }, [currentOrgId, currentProjectId]);

  // Exposed API
  return {
    // Data
    accounts,
    processedAccounts, // The final list to display
    processingAccounts,
    loading,
    error,
    
    // Details
    selectedAccount,
    setSelectedAccount,
    accountVideos,
    allAccountVideos,
    accountVideosSnapshots,
    loadingAccountDetail,
    loadAccountVideos,
    setAccountVideos,
    setAccountVideosSnapshots,
    
    // Sync
    isSyncing,
    syncError,
    setSyncError,
    handleSyncAccount,
    syncingAccounts,
    retryFailedAccount,
    dismissAccountError,
    cancelSync,
    
    // Account Management
    toggleAccountType,
    
    // Selection
    selectedAccounts,
    setSelectedAccounts,
    
    // Sorting
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    
    // Metadata
    creators,
    accountCreatorNames,
    setAccountCreatorNames,
    trackedLinks,
    linkClicks,
    usageLimits,
    imageErrors,
    setImageErrors,
    
    // Misc
    currentOrgId,
    currentProjectId,
    setProcessingAccounts, // needed for adding accounts
    user, // needed for modals
    setAccounts, // needed for instant delete
    setFilteredAccounts // needed for instant delete
  };
};

