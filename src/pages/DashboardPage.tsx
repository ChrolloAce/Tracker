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
import AccountsPage, { AccountsPageRef } from '../components/AccountsPage';
import SettingsPage from '../components/SettingsPage';
import SubscriptionPage from '../components/SubscriptionPage';
import CronManagementPage from '../components/CronManagementPage';
import TrackedLinksPage, { TrackedLinksPageRef } from '../components/TrackedLinksPage';
import TeamManagementPage from '../components/TeamManagementPage';
import PendingInvitationsPage from '../components/PendingInvitationsPage';
import CreatorPortalPage from '../components/CreatorPortalPage';
import CreatorsManagementPage, { CreatorsManagementPageRef } from '../components/CreatorsManagementPage';
import { PageLoadingSkeleton } from '../components/ui/LoadingSkeleton';
import OrganizationService from '../services/OrganizationService';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import { VideoSubmission, InstagramVideoData } from '../types';
import VideoApiService from '../services/VideoApiService';
import DateFilterService from '../services/DateFilterService';
import ThemeService from '../services/ThemeService';
import FirestoreDataService from '../services/FirestoreDataService';
import LinkClicksService, { LinkClick } from '../services/LinkClicksService';
import RulesService from '../services/RulesService';
import { cssVariables } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';
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
  const [dateFilter, setDateFilter] = useState<DateFilterType>('last30days');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [selectedVideoForAnalytics, setSelectedVideoForAnalytics] = useState<VideoSubmission | null>(null);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

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

  // Load data from Firestore on app initialization and when project changes
  useEffect(() => {
    if (!user || !currentOrgId || !currentProjectId) {
      return;
    }

    const loadData = async () => {
      setIsLoadingData(true);
      try {
        console.log('🎯 ViewTrack Dashboard initialized');
        console.log('🔥 Loading data from Firestore...');
        console.log('📁 Organization ID:', currentOrgId);
        
        // Initialize theme
        ThemeService.initializeTheme();
        
        // No migration needed - all new data goes directly to projects!
        console.log('📁 Projects-first architecture enabled');
        
        // Load videos from Firestore for current project
        const firestoreVideos = currentProjectId 
          ? await FirestoreDataService.getVideos(currentOrgId, currentProjectId, { limitCount: 1000 })
          : [];
        
        // Load tracked accounts to get uploader info
        const accounts = currentProjectId
          ? await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId)
          : [];
        const accountsMap = new Map(accounts.map(acc => [acc.id, acc]));
        setTrackedAccounts(accounts); // Store for account filter
        
        // Load all rules for filtering
        const rules = currentProjectId
          ? await RulesService.getRules(currentOrgId, currentProjectId)
          : [];
        setAllRules(rules);
        console.log(`📋 Loaded ${rules.length} tracking rules`);
        
        // Load link clicks
        const clicks = await LinkClicksService.getProjectLinkClicks(currentOrgId, currentProjectId);
        setLinkClicks(clicks);
        console.log(`📊 Loaded ${clicks.length} link clicks`);
        
        // Convert Firestore videos to VideoSubmission format
        const allSubmissions: VideoSubmission[] = firestoreVideos.map(video => {
          const account = video.trackedAccountId ? accountsMap.get(video.trackedAccountId) : null;
          
          return {
            id: video.id,
            url: video.url || '',
            platform: video.platform as 'instagram' | 'tiktok' | 'youtube',
            thumbnail: video.thumbnail || '',
            title: video.title || '',
            caption: video.description || '', // Include caption for rules filtering
            uploader: account?.displayName || account?.username || '',
            uploaderHandle: account?.username || '',
            uploaderProfilePicture: account?.profilePicture,
            status: video.status === 'archived' ? 'rejected' : 'approved',
            views: video.views || 0,
            likes: video.likes || 0,
            comments: video.comments || 0,
            shares: video.shares || 0,
            dateSubmitted: video.dateAdded.toDate(),
            uploadDate: video.uploadDate.toDate(),
            lastRefreshed: video.lastRefreshed?.toDate(),
            snapshots: [] // Will be loaded on-demand when viewing analytics
          };
        });
        
        console.log(`✅ Loaded ${allSubmissions.length} videos from Firestore`);
        console.log(`📁 Current Project ID: ${currentProjectId}`);
        
        setSubmissions(allSubmissions);
        console.log('🔍 Open browser console to see API logs when adding videos');
      } catch (error) {
        console.error('❌ Failed to load data from Firestore:', error);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, [user, currentOrgId, currentProjectId]); // Reload when project changes!

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
      if (activeTab === 'settings' || activeTab === 'subscription' || 
          activeTab === 'cron' || activeTab === 'team' || activeTab === 'invitations') {
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
      } else if (activeTab === 'creators') {
        creatorsPageRef.current?.openInviteModal();
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

  const handleVideoClick = useCallback((video: VideoSubmission) => {
    setSelectedVideoForAnalytics(video);
    setIsAnalyticsModalOpen(true);
  }, []);

  const handleCloseAnalyticsModal = useCallback(() => {
    setIsAnalyticsModalOpen(false);
    setSelectedVideoForAnalytics(null);
  }, []);

  // Legacy function - kept for reference but replaced by handleAddVideosWithAccounts
  // const handleAddVideo = useCallback(async (videoUrl: string, uploadDate: Date) => { ... }


  const handleAddVideosWithAccounts = useCallback(async (platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter', videoUrls: string[]) => {
    if (!user || !currentOrgId || !currentProjectId) {
      throw new Error('User not authenticated or no organization selected');
    }

    console.log('🎬 Adding videos with account management...', { platform, count: videoUrls.length });

    let successCount = 0;
    let failureCount = 0;

    for (const videoUrl of videoUrls) {
      try {
        console.log(`📹 Processing video: ${videoUrl}`);
        
        // Fetch video data
        const { data: videoData } = await VideoApiService.fetchVideoData(videoUrl);
        const username = videoData.username;

        console.log(`👤 Video belongs to: @${username}`);

        // Check if account exists
        const accounts = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
        let account = accounts.find(acc => 
          acc.username.toLowerCase() === username.toLowerCase() && 
          acc.platform === platform
        );

        // If account doesn't exist, create it
        if (!account) {
          console.log(`✨ Account @${username} doesn't exist. Creating new account...`);
          
          const accountId = await FirestoreDataService.addTrackedAccount(currentOrgId, currentProjectId, user.uid, {
            username,
            platform,
            displayName: videoData.username,
            profilePicture: (videoData as any).profile_pic_url || '',
            followerCount: 0,
            lastSynced: Timestamp.fromDate(new Date())
          });

          console.log(`✅ Created new account with ID: ${accountId}`);
        } else {
          console.log(`✅ Account @${username} already exists (ID: ${account.id})`);
        }

        // Add the video
        const videoId = Date.now().toString();
        const timestamp = (videoData as any).timestamp || Date.now() / 1000;
        const uploadDate = new Date(Number(timestamp) * 1000);
        await FirestoreDataService.addVideo(currentOrgId, currentProjectId, user.uid, {
          platform,
          url: videoUrl,
          videoId,
          thumbnail: videoData.thumbnail_url,
          title: videoData.caption?.split('\n')[0] || 'Untitled Video',
          uploadDate: Timestamp.fromDate(uploadDate),
          views: videoData.view_count || 0,
          likes: videoData.like_count || 0,
          comments: videoData.comment_count || 0,
          shares: (videoData as any).share_count || 0,
          status: 'active',
          isSingular: true
        });

        console.log(`✅ Video added successfully`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to process video ${videoUrl}:`, error);
        failureCount++;
      }
    }

    console.log(`📊 Results: ${successCount} successful, ${failureCount} failed`);

    // Reload data - force page refresh to show new videos and accounts
    window.location.reload();

    if (failureCount > 0) {
      alert(`Added ${successCount} videos successfully. ${failureCount} failed.`);
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
                {activeTab === 'team' && 'Team Management'}
                {activeTab === 'invitations' && 'Pending Invitations'}
                {activeTab === 'settings' && 'Settings'}
              </h1>
              {activeTab !== 'analytics' && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {activeTab === 'dashboard' && 'Track and analyze your video performance'}
                  {activeTab === 'accounts' && 'Monitor entire Instagram and TikTok accounts'}
                  {activeTab === 'subscription' && 'Choose the perfect plan to scale your tracking'}
                  {activeTab === 'creators' && 'Manage and discover content creators'}
                  {activeTab === 'cron' && 'Manage automated video refreshes'}
                  {activeTab === 'team' && 'Manage team members and their access'}
                  {activeTab === 'invitations' && 'Review and accept organization invitations'}
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
                  className="appearance-none pl-4 pr-10 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">All Platforms</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
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
                  className="appearance-none pl-4 pr-10 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">All Platforms</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
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
        </div>
      </header>

      {/* Main Content with dynamic margins for sidebar and header */}
      <main className={clsx(
        'pt-24 overflow-auto min-h-screen transition-all duration-300',
        {
          'ml-64': !isSidebarCollapsed,
          'ml-16': isSidebarCollapsed,
        }
      )}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Dashboard Tab */}
          <div className={activeTab === 'dashboard' ? '' : 'hidden'}>
            {isLoadingData ? (
              <PageLoadingSkeleton type="dashboard" />
            ) : (
              <>
                {/* KPI Cards with Working Sparklines */}
                <KPICards 
                  submissions={filteredSubmissions}
                  linkClicks={filteredLinkClicks}
                  dateFilter={dateFilter}
                  timePeriod="days"
                />
                
                {/* Video Submissions Table */}
                <div className="mt-6">
                  <VideoSubmissionsTable
                    submissions={filteredSubmissions}
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
              onViewModeChange={setAccountsViewMode}
            />
          )}

          {/* Subscription Tab */}
          {activeTab === 'subscription' && <SubscriptionPage />}

          {/* Settings Tab */}
          {activeTab === 'settings' && <SettingsPage />}

          {/* Team Management Tab */}
          {activeTab === 'team' && <TeamManagementPage />}

          {/* Pending Invitations Tab */}
          {activeTab === 'invitations' && <PendingInvitationsPage />}

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
            userRole === 'creator' ? <CreatorPortalPage /> : <CreatorsManagementPage ref={creatorsPageRef} />
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

      {/* Context-Aware Floating Action Button */}
      {activeTab !== 'settings' && activeTab !== 'subscription' && activeTab !== 'cron' && activeTab !== 'team' && activeTab !== 'invitations' && (
        <button
          onClick={() => {
            if (activeTab === 'dashboard') {
              setIsModalOpen(true);
            } else if (activeTab === 'accounts') {
              accountsPageRef.current?.openAddModal();
            } else if (activeTab === 'analytics') {
              trackedLinksPageRef.current?.openCreateModal();
            } else if (activeTab === 'creators') {
              creatorsPageRef.current?.openInviteModal();
            }
          }}
          className="fixed bottom-8 right-8 z-50 bg-gray-900 dark:bg-white hover:bg-black dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-full p-4 shadow-2xl transition-all duration-200 hover:scale-110 group"
          aria-label={
            activeTab === 'dashboard' ? 'Add Video' :
            activeTab === 'accounts' ? 'Track Account' :
            activeTab === 'analytics' ? 'Create Link' :
            activeTab === 'creators' ? 'Invite Creator' :
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
            {activeTab === 'creators' && 'Invite Creator'}
          </span>
        </button>
      )}
    </div>
  );
}

export default DashboardPage;
