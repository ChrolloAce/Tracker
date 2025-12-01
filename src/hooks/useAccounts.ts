import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
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

// Mock data for demo mode
const MOCK_ACCOUNTS: TrackedAccount[] = [
  {
    id: 'demo-ig-1',
    orgId: 'demo-org',
    addedBy: 'demo-user',
    username: 'SarahCreate',
    platform: 'instagram',
    dateAdded: { toDate: () => new Date('2025-11-01'), seconds: 1761955200, nanoseconds: 0 } as any,
    totalVideos: 150,
    totalViews: 2500000,
    totalLikes: 120000,
    totalComments: 5000,
    totalShares: 2000,
    followerCount: 50000,
    followingCount: 120,
    profilePicture: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    displayName: 'Sarah Creator',
    status: 'active',
    syncStatus: 'idle',
    creatorType: 'automatic',
    lastRefreshed: { toDate: () => new Date(), seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    accountType: 'my',
    isActive: true
  },
  {
    id: 'demo-tt-1',
    orgId: 'demo-org',
    addedBy: 'demo-user',
    username: 'alex_tiktok_star',
    platform: 'tiktok',
    dateAdded: { toDate: () => new Date('2025-10-15'), seconds: 1760486400, nanoseconds: 0 } as any,
    totalVideos: 320,
    totalViews: 8500000,
    totalLikes: 2200000,
    totalComments: 15000,
    totalShares: 80000,
    followerCount: 1500000,
    followingCount: 50,
    profilePicture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
    displayName: 'Alex TikTok',
    status: 'active',
    syncStatus: 'idle',
    creatorType: 'automatic',
    lastRefreshed: { toDate: () => new Date(), seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    accountType: 'my',
    isActive: true
  },
  {
    id: 'demo-yt-1',
    orgId: 'demo-org',
    addedBy: 'demo-user',
    username: 'TechReviewsDaily',
    platform: 'youtube',
    dateAdded: { toDate: () => new Date('2025-09-20'), seconds: 1758326400, nanoseconds: 0 } as any,
    totalVideos: 85,
    totalViews: 1200000,
    totalLikes: 45000,
    totalComments: 3200,
    totalShares: 1500,
    followerCount: 250000,
    followingCount: 0,
    profilePicture: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100',
    displayName: 'Tech Reviews',
    status: 'active',
    syncStatus: 'idle',
    creatorType: 'automatic',
    lastRefreshed: { toDate: () => new Date(), seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    accountType: 'my',
    isActive: true
  }
];

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
  const { user, currentOrgId: authOrgId, currentProjectId: authProjectId } = useAuth();
  
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

  // Helper for dates
  const toDate = (date: any): Date => {
    if (!date) return new Date();
    if (date && typeof date.toDate === 'function') return date.toDate();
    return new Date(date);
  };

  // --- Effects ---

  // Load Accounts (Realtime)
  useEffect(() => {
    if (isDemoMode) {
      // Use mock data in demo mode
      setAccounts(MOCK_ACCOUNTS);
      setLoading(false);
      return;
    }

    if (!currentOrgId || !currentProjectId) {
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
      if (isDemoMode) {
        // Mock metadata for demo mode
        setUsageLimits({ accountsLeft: 999, videosLeft: 999, isAtAccountLimit: false, isAtVideoLimit: false });
        return;
      }

      if (!currentOrgId || !currentProjectId) return;
      try {
        // Creators
        const creatorsList = await CreatorLinksService.getAllCreators(currentOrgId, currentProjectId);
        setCreators(creatorsList);
        
        // Links
        const links = await FirestoreDataService.getLinks(currentOrgId, currentProjectId);
        setTrackedLinks(links);
        
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
        const clicks = await LinkClicksService.getProjectLinkClicks(currentOrgId, currentProjectId, 5000);
        setLinkClicks(clicks);

      } catch (error) {
        console.error('Failed to load metadata:', error);
      }
    };
    loadMetadata();
  }, [currentOrgId, currentProjectId, user, accounts.length, isDemoMode]);

  // Load Creator Names for accounts
  useEffect(() => {
    const loadCreatorNames = async () => {
        if (isDemoMode) return; // Skip for demo
        if (!currentOrgId || !currentProjectId || accounts.length === 0) return;
        const map = new Map<string, string>();
        const linked: string[] = [];
        
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
  }, [currentOrgId, currentProjectId, accounts, isDemoMode]);

  // Load Video Logic (extracted from AccountsPage)
  const loadAccountVideos = useCallback(async (accountId: string) => {
    if (isDemoMode) {
        // Mock videos for demo mode
        setLoadingAccountDetail(true);
        setTimeout(() => {
            setAccountVideos([]); // Or mock videos if needed
            setLoadingAccountDetail(false);
        }, 500);
        return;
    }

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
        
        setAllAccountVideos(rulesFilteredVideos); 
        
        // Apply Date Filter
        const filteredByDate = rulesFilteredVideos.filter(video => {
            const date = video.uploadDate ? ((video.uploadDate as any).toDate ? (video.uploadDate as any).toDate() : new Date(video.uploadDate)) : new Date();
            
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
                case 'mtd': { const d = new Date(now.getFullYear(), now.getMonth(), 1); return date >= d; }
                case 'lastmonth': { 
                    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const end = new Date(now.getFullYear(), now.getMonth(), 0);
                    return date >= start && date <= end;
                }
                case 'ytd': { const d = new Date(now.getFullYear(), 0, 1); return date >= d; }
                case 'all': default: return true;
            }
        });
        
        setAccountVideos(filteredByDate);
        
    } catch (error) {
        console.error('Failed to load account videos:', error);
    } finally {
        setLoadingAccountDetail(false);
    }
  }, [currentOrgId, currentProjectId, accounts, selectedRuleIds, dashboardRules, dateFilter, isDemoMode]);

  // Calculate Stats & Filter Accounts
  useEffect(() => {
    const updateStats = async () => {
        if (!accounts.length || (!isDemoMode && (!currentOrgId || !currentProjectId))) { 
          setFilteredAccounts([]); 
          return; 
        }
        
        const results = await Promise.all(accounts.map(async (account) => {
            const totalViews = account.totalViews || 0;
            const totalLikes = account.totalLikes || 0;
            const totalComments = account.totalComments || 0;
            const totalShares = account.totalShares || 0;
            const totalVideos = account.totalVideos || 0;
            
            // Calculate engagement rate: (Likes + Comments + Shares) / Views * 100
            const avgEngagementRate = totalViews > 0 
              ? ((totalLikes + totalComments + totalShares) / totalViews) * 100 
              : 0;
            
            // Fetch videos to calculate posting frequency and top video
            let postingFrequency = '—';
            let highestViewedVideo: { title: string; views: number; videoId: string } | undefined = undefined;
            
            try {
              let videos: AccountVideo[] = [];
              if (!isDemoMode) {
                videos = await AccountTrackingServiceFirebase.getAccountVideos(currentOrgId!, currentProjectId!, account.id);
              }
              
              // Find highest viewed video
              if (videos.length > 0) {
                const topVideo = videos.reduce((max, v) => 
                  (v.views || 0) > (max.views || 0) ? v : max
                );
                if (topVideo && topVideo.views && topVideo.views > 0) {
                  highestViewedVideo = {
                    title: topVideo.title || topVideo.caption || 'Untitled',
                    views: topVideo.views,
                    videoId: topVideo.videoId || topVideo.id || ''
                  };
                }
                
                // Calculate ACTUAL posting frequency from video upload dates
                const sortedVideos = [...videos]
                  .filter(v => v.uploadDate)
                  .sort((a, b) => {
                    const dateA = a.uploadDate && typeof (a.uploadDate as any).toDate === 'function' 
                      ? (a.uploadDate as any).toDate().getTime() 
                      : new Date(a.uploadDate!).getTime();
                    const dateB = b.uploadDate && typeof (b.uploadDate as any).toDate === 'function' 
                      ? (b.uploadDate as any).toDate().getTime() 
                      : new Date(b.uploadDate!).getTime();
                    return dateA - dateB;
                  });
                
                if (sortedVideos.length >= 2) {
                  // Calculate average time between posts
                  const intervals: number[] = [];
                  for (let i = 1; i < sortedVideos.length; i++) {
                    const prevDate = sortedVideos[i - 1].uploadDate && typeof (sortedVideos[i - 1].uploadDate as any).toDate === 'function'
                      ? (sortedVideos[i - 1].uploadDate as any).toDate()
                      : new Date(sortedVideos[i - 1].uploadDate!);
                    const currDate = sortedVideos[i].uploadDate && typeof (sortedVideos[i].uploadDate as any).toDate === 'function'
                      ? (sortedVideos[i].uploadDate as any).toDate()
                      : new Date(sortedVideos[i].uploadDate!);
                    const daysBetween = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
                    intervals.push(daysBetween);
                  }
                  
                  const avgDaysBetweenPosts = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
                  
                  if (avgDaysBetweenPosts < 1) {
                    // Multiple posts per day
                    const postsPerDay = 1 / avgDaysBetweenPosts;
                    postingFrequency = `${postsPerDay.toFixed(1)}/day`;
                  } else if (avgDaysBetweenPosts < 7) {
                    // Posts every few days
                    postingFrequency = `every ${Math.round(avgDaysBetweenPosts)} days`;
                  } else if (avgDaysBetweenPosts < 30) {
                    // Weekly posting
                    const postsPerWeek = 7 / avgDaysBetweenPosts;
                    postingFrequency = `${postsPerWeek.toFixed(1)}/week`;
                  } else {
                    // Monthly or less
                    const postsPerMonth = 30 / avgDaysBetweenPosts;
                    postingFrequency = `${postsPerMonth.toFixed(1)}/month`;
                  }
                } else if (sortedVideos.length === 1) {
                  postingFrequency = '1 video';
                }
              }
            } catch (error) {
              console.error(`Failed to fetch videos for account ${account.id}:`, error);
            }
            
            const stats: AccountWithFilteredStats = {
                ...account,
                filteredTotalVideos: totalVideos,
                filteredTotalViews: totalViews,
                filteredTotalLikes: totalLikes,
                filteredTotalComments: totalComments,
                filteredTotalShares: totalShares,
                filteredTotalBookmarks: 0,
                avgEngagementRate,
                postingFrequency,
                highestViewedVideo,
            };
            return stats;
        }));
        setFilteredAccounts(results);
    };
    updateStats();
  }, [accounts, dateFilter, selectedRuleIds, currentOrgId, currentProjectId, isDemoMode]);

  // Processed Accounts (Filtering & Sorting)
  const processedAccounts = useMemo(() => {
    // Use filteredAccounts which already have highestViewedVideo and posting frequency calculated
    let result = filteredAccounts.length > 0 ? filteredAccounts : accounts.map(acc => {
        return {
          ...acc,
          filteredTotalVideos: acc.totalVideos || 0,
          filteredTotalViews: acc.totalViews || 0,
          filteredTotalLikes: acc.totalLikes || 0,
          filteredTotalComments: acc.totalComments || 0,
          filteredTotalShares: acc.totalShares || 0,
          filteredTotalBookmarks: 0,
          avgEngagementRate: 0,
          postingFrequency: '—',
        } as AccountWithFilteredStats;
    });

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
            case 'videos': res = (a.filteredTotalVideos || 0) - (b.filteredTotalVideos || 0); break;
            case 'views': res = (a.filteredTotalViews || 0) - (b.filteredTotalViews || 0); break;
            case 'dateAdded': res = (toDate(a.dateAdded).getTime()) - (toDate(b.dateAdded).getTime()); break;
            default: res = 0;
        }
        return sortOrder === 'asc' ? res : -res;
    });
  }, [filteredAccounts, accounts, accountFilterId, creatorFilterId, creatorLinkedAccountIds, platformFilter, searchQuery, sortBy, sortOrder]);

  // Handlers
  const handleSyncAccount = useCallback(async (accountId: string) => {
    if (isDemoMode) return 0; // Mock success
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
  }, [currentOrgId, currentProjectId, user, isDemoMode]);

  const retryFailedAccount = useCallback(async (accountId: string) => {
    if (isDemoMode) return;
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
  }, [currentOrgId, currentProjectId, user, isDemoMode]);

  const dismissAccountError = useCallback(async (accountId: string) => {
    if (isDemoMode) return;
    if (!currentOrgId || !currentProjectId) return;
    try {
      const accountRef = doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts', accountId);
      await updateDoc(accountRef, { syncStatus: 'idle', hasError: false, lastSyncError: null, syncRetryCount: 0 });
    } catch (error) { console.error('Dismiss failed', error); }
  }, [currentOrgId, currentProjectId, isDemoMode]);

  const toggleAccountType = useCallback(async (account: TrackedAccount) => {
    if (isDemoMode) return;
    if (!currentOrgId || !currentProjectId) return;
    const newType = (account.creatorType || 'automatic') === 'automatic' ? 'static' : 'automatic';
    try {
      const accountRef = doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts', account.id);
      await updateDoc(accountRef, { creatorType: newType });
    } catch (error) { console.error('Toggle failed', error); }
  }, [currentOrgId, currentProjectId, isDemoMode]);

  const cancelSync = useCallback(async (account: TrackedAccount) => {
    if (isDemoMode) return;
    if (!currentOrgId || !currentProjectId) return;
    try {
      const accountRef = doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts', account.id);
      await updateDoc(accountRef, { syncStatus: 'completed', lastSyncedAt: new Date(), syncError: 'Manually cancelled' });
    } catch (error) { console.error('Cancel failed', error); }
  }, [currentOrgId, currentProjectId, isDemoMode]);

  // Exposed API
  return {
    // Data
    accounts,
    processedAccounts,
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
    setProcessingAccounts,
    user,
    setAccounts,
    setFilteredAccounts
  };
};
