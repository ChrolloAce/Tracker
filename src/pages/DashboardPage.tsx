import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { clsx } from 'clsx';
import { ArrowLeft, ChevronDown, Search } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import { VideoSubmissionsTable } from '../components/VideoSubmissionsTable';
import { AddVideoModal } from '../components/AddVideoModal';
import { TikTokSearchModal } from '../components/TikTokSearchModal';
import KPICards from '../components/KPICards';
import DateRangeFilter, { DateFilterType } from '../components/DateRangeFilter';
import VideoAnalyticsModal from '../components/VideoAnalyticsModal';
import TopPerformersRaceChart from '../components/TopPerformersRaceChart';
import DayVideosModal from '../components/DayVideosModal';
import AccountsPage, { AccountsPageRef } from '../components/AccountsPage';
import SettingsPage from '../components/SettingsPage';
import SubscriptionPage from '../components/SubscriptionPage';
import CronManagementPage from '../components/CronManagementPage';
import TrackedLinksPage, { TrackedLinksPageRef } from '../components/TrackedLinksPage';
import CreatorPortalPage from '../components/CreatorPortalPage';
import CreatorsManagementPage, { CreatorsManagementPageRef } from '../components/CreatorsManagementPage';
import { PageLoadingSkeleton } from '../components/ui/LoadingSkeleton';
import OrganizationService from '../services/OrganizationService';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import { VideoSubmission, InstagramVideoData } from '../types';
import DateFilterService from '../services/DateFilterService';
import ThemeService from '../services/ThemeService';
import FirestoreDataService from '../services/FirestoreDataService';
import LinkClicksService, { LinkClick } from '../services/LinkClicksService';
import RulesService from '../services/RulesService';
import { cssVariables } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { Timestamp, collection, getDocs, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { fixVideoPlatforms } from '../services/FixVideoPlatform';
import { TrackedAccount } from '../types/firestore';

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
  const [allRules, setAllRules] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTikTokSearchOpen, setIsTikTokSearchOpen] = useState(false);
  
  // Loading/pending state for immediate UI feedback
  const [pendingVideos, setPendingVideos] = useState<VideoSubmission[]>([]);
  const [pendingAccounts, setPendingAccounts] = useState<TrackedAccount[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('last30days');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [selectedVideoForAnalytics, setSelectedVideoForAnalytics] = useState<VideoSubmission | null>(null);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Day Videos Modal state (for account clicks from race chart)
  const [isDayVideosModalOpen, setIsDayVideosModalOpen] = useState(false);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string | undefined>();
  const [dayVideosDate, setDayVideosDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState(() => {
    // Restore active tab from localStorage on mount
    const savedTab = localStorage.getItem('activeTab');
    return savedTab || 'dashboard';
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  
  // Accounts page state
  const [accountsDateFilter, setAccountsDateFilter] = useState<DateFilterType>('all');
  const [accountsViewMode, setAccountsViewMode] = useState<'table' | 'details'>('table');
  const [accountsPlatformFilter, setAccountsPlatformFilter] = useState<'all' | 'instagram' | 'tiktok' | 'youtube'>('all');
  const [accountsSearchQuery, setAccountsSearchQuery] = useState('');
  const accountsPageRef = useRef<AccountsPageRef | null>(null);
  const trackedLinksPageRef = useRef<TrackedLinksPageRef | null>(null);
  const creatorsPageRef = useRef<CreatorsManagementPageRef | null>(null);

  // Dashboard platform filter state
  const [dashboardPlatformFilter, setDashboardPlatformFilter] = useState<'all' | 'instagram' | 'tiktok' | 'youtube'>('all');
  
  // Dashboard accounts filter state
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  
  // Tracked Links search state
  const [linksSearchQuery, setLinksSearchQuery] = useState('');
  const [linksDateFilter, setLinksDateFilter] = useState<DateFilterType>('last30days');
  const [linksCustomDateRange, setLinksCustomDateRange] = useState<DateRange | undefined>();
  
  // Creators date filter state
  const [creatorsDateFilter, setCreatorsDateFilter] = useState<DateFilterType>('all');

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Refresh data when switching tabs
  useEffect(() => {
    if (!currentOrgId || !currentProjectId) return;
    
    console.log(`🔄 Tab changed to: ${activeTab} - Refreshing data...`);
    
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
        console.log('✅ Dashboard data refreshed via real-time listeners');
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

    console.log('🎯 ViewTrack Dashboard - Loading data');
    console.log('📁 Organization ID:', currentOrgId);
    console.log('📁 Project ID:', currentProjectId);
    
    // Initialize theme
    ThemeService.initializeTheme();
    
    setIsLoadingData(true);
    
    // Async IIFE to load all data
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
      
      console.log(`👥 Loaded ${accounts.length} tracked accounts`);
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
          status: video.status === 'archived' ? 'rejected' : 'approved',
          views: video.views || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          dateSubmitted: video.dateAdded?.toDate?.() || new Date(),
          uploadDate: video.uploadDate?.toDate?.() || new Date(),
          lastRefreshed: video.lastRefreshed?.toDate?.(),
          snapshots: snapshots
        };
      });
      
      console.log(`🎬 Loaded ${allSubmissions.length} videos`);
      console.log(`📸 Videos with snapshots: ${allSubmissions.filter(v => v.snapshots && v.snapshots.length > 0).length}`);
      setSubmissions(allSubmissions);
      setIsLoadingData(false);
    } catch (error) {
      console.error('❌ Error loading videos:', error);
      setIsLoadingData(false);
    }
    
    // One-time load for rules
    const rulesRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'rules');
    
    try {
      const rulesSnapshot = await getDocs(rulesRef);
      const rules = rulesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`📋 Loaded ${rules.length} tracking rules`);
      setAllRules(rules);
    } catch (error) {
      console.error('❌ Failed to load rules:', error);
    }
    
    // One-time load for link clicks
    try {
      const allClicks = await LinkClicksService.getProjectLinkClicks(currentOrgId, currentProjectId);
      setLinkClicks(allClicks);
      console.log(`🔗 Loaded ${allClicks.length} link clicks`);
    } catch (error) {
      console.error('❌ Failed to load link clicks:', error);
    }
    
    console.log('✅ All data loaded');
    })(); // End of async IIFE
  }, [user, currentOrgId, currentProjectId]); // Reload when project changes!

  // Smart sync monitoring - Auto-refresh when accounts finish syncing
  useEffect(() => {
    if (!user || !currentOrgId || !currentProjectId) return;

    console.log('👂 Setting up smart sync monitor for dashboard...');

    const accountsRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts');
    const syncingQuery = query(accountsRef, where('syncStatus', 'in', ['pending', 'syncing']));

    let previousSyncingCount = 0;

    const unsubscribe = onSnapshot(syncingQuery, async (snapshot) => {
      const currentSyncingCount = snapshot.docs.length;
      
      // If syncing count decreased (someone finished), reload videos
      if (previousSyncingCount > 0 && currentSyncingCount < previousSyncingCount) {
        console.log('✅ Sync completed on dashboard! Auto-refreshing videos...');
        
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
              status: video.status === 'archived' ? 'rejected' : 'approved',
              views: video.views || 0,
              likes: video.likes || 0,
              comments: video.comments || 0,
              shares: video.shares || 0,
              dateSubmitted: video.dateAdded?.toDate?.() || new Date(),
              uploadDate: video.uploadDate?.toDate?.() || new Date(),
              lastRefreshed: video.lastRefreshed?.toDate?.(),
              snapshots: snapshots
            };
          });
          
          console.log(`🔄 Auto-refreshed ${allSubmissions.length} videos after sync`);
          setSubmissions(allSubmissions);
        } catch (error) {
          console.error('❌ Failed to auto-refresh videos:', error);
        }
      }
      
      previousSyncingCount = currentSyncingCount;
    });

    return () => {
      console.log('👋 Cleaning up smart sync monitor');
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
      } else if (activeTab === 'analytics') {
        trackedLinksPageRef.current?.openCreateModal();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, isModalOpen, isTikTokSearchOpen, isAnalyticsModalOpen]);

  // Filter submissions based on date range, platform, and accounts (memoized to prevent infinite loops)
  const filteredSubmissions = useMemo(() => {
    let filtered = DateFilterService.filterVideosByDateRange(
      submissions, 
      dateFilter, 
      customDateRange
    );
    
    // Apply platform filter
    if (dashboardPlatformFilter !== 'all') {
      filtered = filtered.filter(video => video.platform === dashboardPlatformFilter);
    }
    
    // Apply accounts filter
    if (selectedAccountIds.length > 0) {
      // Create a set of usernames from selected accounts
      const selectedUsernames = new Set(
        trackedAccounts
          .filter(account => selectedAccountIds.includes(account.id))
          .map(account => account.username.toLowerCase())
      );
      
      filtered = filtered.filter(video => 
        video.uploaderHandle && selectedUsernames.has(video.uploaderHandle.toLowerCase())
      );
    }
    
    // Apply rules filtering for tracked accounts
    if (allRules.length > 0) {
      filtered = filtered.filter(video => {
        if (!video.uploaderHandle) return true; // Keep videos without uploader handle
        
        // Find the account for this video
        const account = trackedAccounts.find(
          acc => acc.username.toLowerCase() === video.uploaderHandle?.toLowerCase()
        );
        
        if (!account) return true; // Keep videos without matching account
        
        // Get rules that apply to this account
        const accountRules = allRules.filter(rule => {
          if (!rule.isActive) return false;
          
          const { platforms, accountIds } = rule.appliesTo;
          
          // Check platform match
          const platformMatch = !platforms || platforms.length === 0 || platforms.includes(account.platform);
          
          // Check account match
          const accountMatch = !accountIds || accountIds.length === 0 || accountIds.includes(account.id);
          
          return platformMatch && accountMatch;
        });
        
        if (accountRules.length === 0) return true; // No rules = show all videos
        
        // Check if video matches any of the account's rules
        return accountRules.some((rule: any) => 
          RulesService.checkVideoMatchesRule(video as any, rule).matches
        );
      });
    }
    
    return filtered;
  }, [submissions, dateFilter, customDateRange, dashboardPlatformFilter, selectedAccountIds, trackedAccounts, allRules]);

  // Combine real submissions with pending videos for immediate UI feedback
  const combinedSubmissions = useMemo(() => {
    const combined = [...pendingVideos, ...filteredSubmissions];
    
    // Debug: Check first video in combined submissions
    if (combined.length > 0) {
      const first = combined[0];
      console.log('🔍 DashboardPage - First video in combinedSubmissions:');
      console.log('   ID:', first.id);
      console.log('   Title:', first.title || '(EMPTY)');
      console.log('   Caption:', first.caption || '(EMPTY)');
      console.log('   Title length:', first.title?.length || 0);
      console.log('   Caption length:', first.caption?.length || 0);
    }
    
    return combined;
  }, [pendingVideos, filteredSubmissions]);

  // Apply date filter to link clicks
  const filteredLinkClicks = useMemo(() => {
    if (dateFilter === 'all') {
      return linkClicks;
    }
    
    const range = DateFilterService.getDateRange(dateFilter, customDateRange);
    if (!range) return linkClicks;
    
    return LinkClicksService.filterClicksByDateRange(
      linkClicks,
      range.startDate,
      range.endDate
    );
  }, [linkClicks, dateFilter, customDateRange]);

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

  const handleCloseAnalyticsModal = useCallback(() => {
    setIsAnalyticsModalOpen(false);
    setSelectedVideoForAnalytics(null);
  }, []);

  const handleAccountClick = useCallback((username: string) => {
    console.log('🎯 Account clicked from race chart:', username);
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

    console.log('🎬 Adding videos to processing queue...', { platform, count: videoUrls.length });

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
    console.log(`✨ Added ${placeholderVideos.length} placeholder videos to UI`);

    let successCount = 0;
    let failureCount = 0;

    // Queue videos for background processing (like accounts)
    for (const videoUrl of videoUrls) {
      try {
        console.log(`📝 Queuing video: ${videoUrl}`);
        
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

        console.log(`✅ Video queued: ${videoId}`);
        
        // Trigger immediate processing (like accounts)
        console.log(`⚡ Triggering immediate processing...`);
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

    console.log(`📊 Results: ${successCount} queued, ${failureCount} failed`);

    // Handle results
    if (successCount > 0) {
      const message = successCount === 1 
        ? '✅ Video processing started! Refreshing shortly...' 
        : `✅ ${successCount} videos processing! Refreshing shortly...`;
      console.log(message);
      console.log('⚡ Videos are being processed in the background...');
      
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
    
    console.log('📝 Updating submission status:', id, '→', status);
    
    try {
      // Update in Firestore
      await FirestoreDataService.updateTrackedAccount(currentOrgId, currentProjectId!, id, {
        status: status === 'rejected' ? 'archived' : 'active'
      } as any);
      
      // Update state
      setSubmissions(prev => prev.map(submission => 
        submission.id === id ? { ...submission, status } : submission
      ));
      
      console.log('✅ Status updated and saved to Firestore');
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }, [user, currentOrgId]);

  const handleDelete = useCallback(async (id: string) => {
    if (!user || !currentOrgId) return;
    
    console.log('🗑️ Deleting submission:', id);
    
    try {
      // Delete from Firestore (archive it)
      await FirestoreDataService.updateTrackedAccount(currentOrgId, currentProjectId!, id, {
        status: 'archived'
      } as any);
      
      // Update state
      setSubmissions(prev => prev.filter(submission => submission.id !== id));
      
      console.log('✅ Submission deleted and removed from Firestore');
    } catch (error) {
      console.error('Failed to delete video:', error);
    }
  }, [user, currentOrgId]);

  const handleTikTokVideosFound = useCallback((videos: InstagramVideoData[]) => {
    console.log('🎵 Adding TikTok search results to dashboard:', videos.length, 'videos');
    
    const newSubmissions: VideoSubmission[] = videos.map((video, index) => ({
      id: `${Date.now()}_${index}`,
      url: video.id, // TikTok URL will be in webVideoUrl or constructed
      platform: 'tiktok' as const,
      thumbnail: video.thumbnail_url,
      title: video.caption.split('\n')[0] || 'Untitled TikTok Video',
      uploader: video.username,
      uploaderHandle: video.username,
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
    
    console.log('✅ TikTok search results added and saved locally!');
  }, []);


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
      {/* Fixed Sidebar */}
      <Sidebar 
        onCollapsedChange={setIsSidebarCollapsed}
        initialCollapsed={isSidebarCollapsed}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      
      {/* Fixed Header */}
      <header className={clsx(
        'fixed top-0 right-0 bg-white dark:bg-[#111111] border-b border-gray-200 dark:border-gray-800 px-6 py-4 z-20 transition-all duration-300',
        {
          'left-64': !isSidebarCollapsed,
          'left-16': isSidebarCollapsed,
        }
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {activeTab === 'accounts' && accountsViewMode === 'details' && (
              <button
                onClick={() => accountsPageRef.current?.handleBackToTable()}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'accounts' && 'Tracked Accounts'}
                {activeTab === 'subscription' && 'Subscription Plans'}
                {activeTab === 'analytics' && 'Tracked Links'}
                {activeTab === 'creators' && 'Creators'}
                {activeTab === 'cron' && 'Cron Jobs'}
                {activeTab === 'settings' && 'Settings'}
              </h1>
              {activeTab !== 'analytics' && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {activeTab === 'dashboard' && 'Track and analyze your video performance'}
                  {activeTab === 'accounts' && 'Monitor entire Instagram and TikTok accounts'}
                  {activeTab === 'subscription' && 'Choose the perfect plan to scale your tracking'}
                  {activeTab === 'creators' && 'Manage and discover content creators'}
                  {activeTab === 'cron' && 'Manage automated video refreshes'}
                  {activeTab === 'settings' && 'Configure your preferences'}
                </p>
              )}
            </div>
          </div>
          {activeTab === 'dashboard' && (
            <div className="flex items-center space-x-4">
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
              
              {/* Platform Filter Dropdown */}
              <div className="relative">
                <select
                  value={dashboardPlatformFilter}
                  onChange={(e) => setDashboardPlatformFilter(e.target.value as 'all' | 'instagram' | 'tiktok' | 'youtube')}
                  className="appearance-none pl-4 pr-10 py-2 bg-white/5 dark:bg-white/5 text-white/90 rounded-lg text-sm font-medium border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm"
                >
                  <option value="all" className="bg-gray-900">All Platforms</option>
                  <option value="instagram" className="bg-gray-900">Instagram</option>
                  <option value="tiktok" className="bg-gray-900">TikTok</option>
                  <option value="youtube" className="bg-gray-900">YouTube</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
              </div>
              
              <DateRangeFilter
                selectedFilter={dateFilter}
                customRange={customDateRange}
                onFilterChange={handleDateFilterChange}
              />
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
            {isLoadingData ? (
              <PageLoadingSkeleton type="dashboard" />
            ) : (
              <>
                {/* KPI Cards with Working Sparklines */}
                <KPICards 
                  submissions={combinedSubmissions}
                  linkClicks={filteredLinkClicks}
                  dateFilter={dateFilter}
                  customRange={customDateRange}
                  timePeriod="days"
                  onVideoClick={handleVideoClick}
                />
                
                {/* Top Performers Race Chart */}
                <div className="mt-6">
                  <TopPerformersRaceChart 
                    submissions={combinedSubmissions} 
                    onVideoClick={handleVideoClick}
                    onAccountClick={handleAccountClick}
                  />
                </div>
                
                {/* Video Submissions Table */}
                <div className="mt-6">
                  <VideoSubmissionsTable
                    submissions={combinedSubmissions}
                    onStatusUpdate={handleStatusUpdate}
                    onDelete={handleDelete}
                    onVideoClick={handleVideoClick}
                  />
                </div>
              </>
            )}
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
          {!['dashboard', 'accounts', 'subscription', 'settings', 'analytics', 'creators', 'cron', 'team', 'invitations'].includes(activeTab) && (
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
      />

      {/* Day Videos Modal for Account Clicks */}
      <DayVideosModal
        isOpen={isDayVideosModalOpen}
        onClose={() => setIsDayVideosModalOpen(false)}
        date={dayVideosDate}
        videos={combinedSubmissions}
        metricLabel="Videos"
        accountFilter={selectedAccountFilter}
        onVideoClick={handleVideoClick}
      />

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
