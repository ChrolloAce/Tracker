import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { clsx } from 'clsx';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import { VideoSubmissionsTable } from './components/VideoSubmissionsTable';
import { VideoSubmissionModal } from './components/VideoSubmissionModal';
import { TikTokSearchModal } from './components/TikTokSearchModal';
import KPICards from './components/KPICards';
import DateRangeFilter, { DateFilterType } from './components/DateRangeFilter';
import TimePeriodSelector, { TimePeriodType } from './components/TimePeriodSelector';
import VideoAnalyticsModal from './components/VideoAnalyticsModal';
import AccountsPage, { AccountsPageRef } from './components/AccountsPage';
import ContractsPage from './components/ContractsPage';
import SettingsPage from './components/SettingsPage';
import SubscriptionPage from './components/SubscriptionPage';
import TrackedLinksPage from './components/TrackedLinksPage';
import LinkRedirect from './components/LinkRedirect';
import LoginPage from './components/LoginPage';
import { PageLoadingSkeleton } from './components/ui/LoadingSkeleton';
import OrganizationOnboarding from './components/OrganizationOnboarding';
import ProjectCreationFlow from './components/ProjectCreationFlow';
import { VideoSubmission, InstagramVideoData } from './types';
import VideoApiService from './services/VideoApiService';
import DateFilterService from './services/DateFilterService';
import ThemeService from './services/ThemeService';
import FirestoreDataService from './services/FirestoreDataService';
import LinkClicksService, { LinkClick } from './services/LinkClicksService';
import { cssVariables } from './theme';
import { useAuth } from './contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';
import { fixVideoPlatforms } from './services/FixVideoPlatform';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

function App() {
  // Get authentication state, current organization, and current project
  const { user, loading, currentOrgId, currentProjectId } = useAuth();

  // Check if this is a link redirect URL
  const isLinkRedirect = window.location.pathname.startsWith('/l/');
  
  // Check if this is project creation page
  const isProjectCreation = window.location.pathname === '/create-project';

  // State
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [linkClicks, setLinkClicks] = useState<LinkClick[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTikTokSearchOpen, setIsTikTokSearchOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [selectedVideoForAnalytics, setSelectedVideoForAnalytics] = useState<VideoSubmission | null>(null);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriodType>('weeks');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // Accounts page state
  const [accountsDateFilter, setAccountsDateFilter] = useState<DateFilterType>('all');
  const [accountsViewMode, setAccountsViewMode] = useState<'table' | 'details'>('table');
  const [accountsPlatformFilter, setAccountsPlatformFilter] = useState<'all' | 'instagram' | 'tiktok' | 'youtube'>('all');
  const accountsPageRef = useRef<AccountsPageRef | null>(null);

  // Dashboard platform filter state
  const [dashboardPlatformFilter, setDashboardPlatformFilter] = useState<'all' | 'instagram' | 'tiktok' | 'youtube'>('all');

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
        
        // Load link clicks
        const clicks = await LinkClicksService.getOrgLinkClicks(currentOrgId);
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

  // Filter submissions based on date range and platform (memoized to prevent infinite loops)
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
    
    return filtered;
  }, [submissions, dateFilter, customDateRange, dashboardPlatformFilter]);

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

  const handleAddVideo = useCallback(async (videoUrl: string, uploadDate: Date) => {
    console.log('🚀 Starting video submission process...');
    console.log('📋 URL submitted:', videoUrl);
    console.log('📅 Upload date:', uploadDate.toISOString());
    
    try {
      console.log('📡 Calling Video API service...');
      const { data: videoData, platform } = await VideoApiService.fetchVideoData(videoUrl);
      
      console.log('🎬 Processing video data for submission...');
      const newSubmission: VideoSubmission = {
        id: Date.now().toString(),
        url: videoUrl,
        platform: platform,
        thumbnail: videoData.thumbnail_url,
        title: videoData.caption.split('\n')[0] || 'Untitled Video',
        uploader: videoData.username,
        uploaderHandle: videoData.username,
        status: 'pending',
        views: videoData.view_count || 0,
        likes: videoData.like_count,
        comments: videoData.comment_count,
        shares: platform === 'tiktok' ? (videoData as any).share_count : undefined,
        dateSubmitted: new Date(),
        uploadDate: uploadDate, // User-provided upload date
        timestamp: videoData.timestamp, // Original upload timestamp (legacy)
      };

      console.log('💾 Adding new submission to dashboard:', {
        id: newSubmission.id,
        platform: newSubmission.platform,
        title: newSubmission.title,
        username: newSubmission.uploaderHandle,
        status: newSubmission.status
      });

      // Save to Firestore
      if (user && currentOrgId) {
        const videoId = await FirestoreDataService.addVideo(currentOrgId, currentProjectId!, user.uid, {
          platform: newSubmission.platform,
          url: newSubmission.url,
          videoId: newSubmission.id,
          title: newSubmission.title,
          thumbnail: newSubmission.thumbnail,
          uploadDate: Timestamp.fromDate(uploadDate),
          views: videoData.view_count || 0,
          likes: videoData.like_count || 0,
          comments: videoData.comment_count || 0,
          shares: 0,
          status: 'active',
          isSingular: true
        });

        // Create initial snapshot
        await FirestoreDataService.addVideoSnapshot(currentOrgId, currentProjectId!, videoId, user.uid, {
          views: videoData.view_count || 0,
          likes: videoData.like_count || 0,
          comments: videoData.comment_count || 0
        });

        // Update local state
        newSubmission.id = videoId;
      }
      
      // Update state
      setSubmissions(prev => [newSubmission, ...prev]);
      console.log('✅ Video submission completed and saved to Firestore!');
      
    } catch (error) {
      console.error('❌ Failed to add video submission:', error);
      console.error('🔍 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        url: videoUrl
      });
      throw error;
    }
  }, [user, currentOrgId]);


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

  // Show login page if not authenticated
  if (!user && !isLinkRedirect) {
    return loading ? null : <LoginPage />;
  }

  // If this is a link redirect, show redirect component instead
  if (isLinkRedirect) {
    return <LinkRedirect />;
  }

  // Show organization onboarding if user has no organization
  if (user && !loading && !currentOrgId) {
    return <OrganizationOnboarding />;
  }

  // Show project creation flow as full page
  if (user && isProjectCreation && currentOrgId) {
    return (
      <ProjectCreationFlow
        onClose={() => window.location.href = '/'}
        onSuccess={() => {}}
      />
    );
  }

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
                {activeTab === 'contracts' && 'Contracts'}
                {activeTab === 'subscription' && 'Subscription Plans'}
                {activeTab === 'analytics' && 'Tracked Links'}
                {activeTab === 'creators' && 'Creators'}
                {activeTab === 'settings' && 'Settings'}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {activeTab === 'dashboard' && 'Track and analyze your video performance'}
                {activeTab === 'accounts' && 'Monitor entire Instagram and TikTok accounts'}
                {activeTab === 'contracts' && 'Manage brand deals and sponsorships'}
                {activeTab === 'subscription' && 'Choose the perfect plan to scale your tracking'}
                {activeTab === 'analytics' && 'Track and analyze your shared links'}
                {activeTab === 'creators' && 'Manage and discover content creators'}
                {activeTab === 'settings' && 'Configure your preferences'}
              </p>
            </div>
          </div>
          {activeTab === 'dashboard' && (
            <div className="flex items-center space-x-4">
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
              <TimePeriodSelector
                selectedPeriod={timePeriod}
                onPeriodChange={setTimePeriod}
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
                  timePeriod={timePeriod}
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

          {/* Contracts Tab */}
          {activeTab === 'contracts' && <ContractsPage />}

          {/* Subscription Tab */}
          {activeTab === 'subscription' && <SubscriptionPage />}

          {/* Settings Tab */}
          {activeTab === 'settings' && <SettingsPage />}

          {/* Tracked Links Tab */}
          {activeTab === 'analytics' && <TrackedLinksPage />}

          {/* Creators Tab - Placeholder */}
          {activeTab === 'creators' && (
            <div className="bg-white dark:bg-[#161616] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-12 text-center">
              <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Creators</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Discover and manage content creators. Coming soon!
              </p>
            </div>
          )}

          {/* Other Tabs - Placeholder */}
          {!['dashboard', 'accounts', 'contracts', 'subscription', 'settings', 'analytics', 'creators'].includes(activeTab) && (
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

      <VideoSubmissionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddVideo}
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

      {/* Floating Add Video Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-8 z-50 bg-gray-900 dark:bg-white hover:bg-black dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-full p-4 shadow-2xl transition-all duration-200 hover:scale-110 group"
        aria-label="Add Video"
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
          Add Video
        </span>
      </button>
    </div>
  );
}

export default App;
