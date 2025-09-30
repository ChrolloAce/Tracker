import { useState, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import Sidebar from './components/layout/Sidebar';
import { VideoSubmissionsTable } from './components/VideoSubmissionsTable';
import { VideoSubmissionModal } from './components/VideoSubmissionModal';
import { TikTokSearchModal } from './components/TikTokSearchModal';
import KPICards from './components/KPICards';
import DateRangeFilter, { DateFilterType } from './components/DateRangeFilter';
import TimePeriodSelector, { TimePeriodType } from './components/TimePeriodSelector';
import VideoAnalyticsModal from './components/VideoAnalyticsModal';
import AccountsPage from './components/AccountsPage';
import ContractsPage from './components/ContractsPage';
import SettingsPage from './components/SettingsPage';
import TrackedLinksPage from './components/TrackedLinksPage';
import LinkRedirect from './components/LinkRedirect';
import { VideoSubmission, InstagramVideoData } from './types';
import VideoApiService from './services/VideoApiService';
import LocalStorageService from './services/LocalStorageService';
import DateFilterService from './services/DateFilterService';
import SnapshotService from './services/SnapshotService';
import { AccountTrackingService } from './services/AccountTrackingService';
import ThemeService from './services/ThemeService';
import { cssVariables } from './theme';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

function App() {
  // Check if this is a link redirect URL
  const isLinkRedirect = window.location.pathname.startsWith('/l/');

  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTikTokSearchOpen, setIsTikTokSearchOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedVideoForAnalytics, setSelectedVideoForAnalytics] = useState<VideoSubmission | null>(null);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriodType>('weeks');
  const [activeTab, setActiveTab] = useState('dashboard');

  // If this is a link redirect, show redirect component instead
  if (isLinkRedirect) {
    return <LinkRedirect />;
  }

  // Load saved data on app initialization
  useEffect(() => {
    console.log('🎯 Instagram Submissions Dashboard initialized');
    console.log('📱 Loading saved data from localStorage...');
    
    // Initialize theme
    ThemeService.initializeTheme();
    
    const savedSubmissions = LocalStorageService.loadSubmissions();
    
    // Load tracked account videos and merge with manual submissions
    const trackedAccounts = AccountTrackingService.getTrackedAccounts();
    const accountVideos: VideoSubmission[] = [];
    
    trackedAccounts.forEach(account => {
      const videos = AccountTrackingService.getAccountVideos(account.id);
      videos.forEach(video => {
        // Convert AccountVideo to VideoSubmission format
        accountVideos.push({
          id: video.id || `${account.id}_${video.videoId || Date.now()}`,
          url: video.url,
          platform: account.platform as 'instagram' | 'tiktok',
          thumbnail: video.thumbnail || '',
          title: video.caption || `Video from @${account.username}`,
          uploader: account.displayName || account.username,
          uploaderHandle: account.username,
          status: 'approved',
          views: video.viewsCount || video.views || 0,
          likes: video.likesCount || video.likes || 0,
          comments: video.commentsCount || video.comments || 0,
          shares: video.sharesCount || video.shares,
          dateSubmitted: account.dateAdded,
          uploadDate: video.uploadDate || (video.timestamp ? new Date(video.timestamp) : account.dateAdded),
          lastRefreshed: account.lastSynced,
        });
      });
    });
    
    console.log(`📊 Loaded ${accountVideos.length} videos from ${trackedAccounts.length} tracked accounts`);
    
    const allSubmissions = [...savedSubmissions, ...accountVideos];
    
    // 🔧 MIGRATION: Fix existing snapshots to use upload dates instead of current dates
    console.log('🔄 Migrating existing snapshots to use correct upload dates...');
    const migratedSubmissions = allSubmissions.map(video => {
      if (!video.snapshots || video.snapshots.length === 0) {
        return video;
      }
      
      // Find the initial upload snapshot (the first one, marked as 'initial_upload')
      const initialSnapshotIndex = video.snapshots.findIndex(s => s.capturedBy === 'initial_upload');
      
      if (initialSnapshotIndex !== -1) {
        const initialSnapshot = video.snapshots[initialSnapshotIndex];
        const correctUploadDate = video.uploadDate 
          ? new Date(video.uploadDate)
          : video.timestamp 
          ? new Date(video.timestamp)
          : new Date(video.dateSubmitted);
        
        // Check if the snapshot date is wrong (newer than upload date by more than 1 day)
        const snapshotDate = new Date(initialSnapshot.capturedAt);
        const daysDifference = (snapshotDate.getTime() - correctUploadDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDifference > 1) {
          console.log(`  📅 Fixing "${video.title.substring(0, 30)}..." snapshot date from ${snapshotDate.toLocaleDateString()} to ${correctUploadDate.toLocaleDateString()}`);
          
          // Update the initial snapshot with correct date
          video.snapshots[initialSnapshotIndex] = {
            ...initialSnapshot,
            capturedAt: correctUploadDate
          };
          
          // Save the migrated video
          LocalStorageService.addSubmission(video);
        }
      }
      
      return video;
    });
    
    setSubmissions(migratedSubmissions);
    
    const storageInfo = LocalStorageService.getStorageInfo();
    console.log('📊 Loaded data:', storageInfo);
    console.log('🔍 Open browser console to see API logs when adding videos');
  }, []);

  // Filter submissions based on date range
  const filteredSubmissions = DateFilterService.filterVideosByDateRange(
    submissions, 
    dateFilter, 
    customDateRange
  );

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

  // Refresh all videos and create new snapshots
  const handleRefreshAllVideos = useCallback(async () => {
    if (isRefreshing) return; // Prevent multiple simultaneous refreshes
    
    console.log('🔄 Refresh All button clicked!');
    console.log(`📊 Found ${submissions.length} videos to refresh`);
    
    if (submissions.length === 0) {
      console.log('⚠️ No videos to refresh. Add some videos first!');
      return;
    }
    
    setIsRefreshing(true);
    console.log('🔄 Starting refresh of all videos...');
    
    const updatedSubmissions: VideoSubmission[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const video of submissions) {
      try {
        console.log(`🔄 Refreshing "${video.title.substring(0, 30)}..."...`);
        
        // Fetch latest data from API
        const { data: videoData } = await VideoApiService.fetchVideoData(video.url);
        
        // Create new snapshot with current metrics
        const refreshSnapshot = SnapshotService.createRefreshSnapshot(video, {
          views: videoData.view_count || 0,
          likes: videoData.like_count,
          comments: videoData.comment_count,
          shares: video.platform === 'tiktok' ? (videoData as any).share_count : undefined
        });

        // Add snapshot to video
        let updatedVideo = SnapshotService.addSnapshotToVideo(video, refreshSnapshot);
        
        // Clean up old snapshots to prevent storage bloat
        updatedVideo = SnapshotService.cleanupOldSnapshots(updatedVideo);
        
        updatedSubmissions.push(updatedVideo);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to refresh video "${video.title}":`, error);
        // Keep original video if refresh fails
        updatedSubmissions.push(video);
        errorCount++;
      }
    }

    // Save updated submissions
    LocalStorageService.saveSubmissions(updatedSubmissions);
    setSubmissions(updatedSubmissions);
    
    console.log(`✅ Refresh completed: ${successCount} successful, ${errorCount} failed`);
    
    // Show user feedback (you could add a toast notification here)
    if (successCount > 0) {
      console.log(`🎉 Successfully refreshed ${successCount} videos with new snapshots!`);
    }
    
    setIsRefreshing(false);
  }, [submissions, isRefreshing]);

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

      // Create initial snapshot with upload metrics
      const initialSnapshot = SnapshotService.createInitialSnapshot(newSubmission);
      const videoWithSnapshot = SnapshotService.addSnapshotToVideo(newSubmission, initialSnapshot);

      // Save to localStorage
      LocalStorageService.addSubmission(videoWithSnapshot);
      
      // Update state
      setSubmissions(prev => [videoWithSnapshot, ...prev]);
      console.log('✅ Video submission completed with initial snapshot saved!');
      
    } catch (error) {
      console.error('❌ Failed to add video submission:', error);
      console.error('🔍 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        url: videoUrl
      });
      throw error;
    }
  }, []);


  const handleStatusUpdate = useCallback((id: string, status: VideoSubmission['status']) => {
    console.log('📝 Updating submission status:', id, '→', status);
    
    // Update in localStorage
    LocalStorageService.updateSubmissionStatus(id, status);
    
    // Update state
    setSubmissions(prev => prev.map(submission => 
      submission.id === id ? { ...submission, status } : submission
    ));
    
    console.log('✅ Status updated and saved locally');
  }, []);

  const handleDelete = useCallback((id: string) => {
    console.log('🗑️ Deleting submission:', id);
    
    // Remove from localStorage
    LocalStorageService.removeSubmission(id);
    
    // Update state
    setSubmissions(prev => prev.filter(submission => submission.id !== id));
    
    console.log('✅ Submission deleted and removed from storage');
  }, []);

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

    // Save all new submissions
    newSubmissions.forEach(submission => {
      LocalStorageService.addSubmission(submission);
    });

    // Update state
    setSubmissions(prev => [...newSubmissions, ...prev]);
    
    console.log('✅ TikTok search results added and saved locally!');
  }, []);

  // Apply CSS variables to the root
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
      {/* Fixed Sidebar */}
      <Sidebar 
        onAddVideo={() => setIsModalOpen(true)}
        onTikTokSearch={() => setIsTikTokSearchOpen(true)}
        onRefreshAll={handleRefreshAllVideos}
        isRefreshing={isRefreshing}
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
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {activeTab === 'dashboard' && 'Video Views'}
              {activeTab === 'accounts' && 'Tracked Accounts'}
              {activeTab === 'contracts' && 'Contracts'}
              {activeTab === 'analytics' && 'Tracked Links'}
              {activeTab === 'creators' && 'Creators'}
              {activeTab === 'settings' && 'Settings'}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {activeTab === 'dashboard' && 'Track and analyze your video performance'}
              {activeTab === 'accounts' && 'Monitor entire Instagram and TikTok accounts'}
              {activeTab === 'contracts' && 'Manage brand deals and sponsorships'}
              {activeTab === 'analytics' && 'Track and analyze your shared links'}
              {activeTab === 'creators' && 'Manage and discover content creators'}
              {activeTab === 'settings' && 'Configure your preferences'}
            </p>
          </div>
          {activeTab === 'dashboard' && (
            <div className="flex items-center space-x-4">
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
          {activeTab === 'dashboard' && (
            <>
              {/* KPI Cards with Working Sparklines */}
              <KPICards 
                submissions={filteredSubmissions}
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

          {/* Accounts Tab */}
          {activeTab === 'accounts' && <AccountsPage />}

          {/* Contracts Tab */}
          {activeTab === 'contracts' && <ContractsPage />}

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
          {!['dashboard', 'accounts', 'contracts', 'settings', 'analytics', 'creators'].includes(activeTab) && (
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
    </div>
  );
}

export default App;
