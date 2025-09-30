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
import LoginPage from './components/LoginPage';
import { VideoSubmission, InstagramVideoData } from './types';
import VideoApiService from './services/VideoApiService';
import DateFilterService from './services/DateFilterService';
import SnapshotService from './services/SnapshotService';
import ThemeService from './services/ThemeService';
import FirestoreDataService from './services/FirestoreDataService';
import DataMigrationService from './services/DataMigrationService';
import { cssVariables } from './theme';
import { useAuth } from './contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

function App() {
  // Get authentication state and current organization
  const { user, loading, currentOrgId } = useAuth();

  // Check if this is a link redirect URL
  const isLinkRedirect = window.location.pathname.startsWith('/l/');

  // State
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
  const [dataLoading, setDataLoading] = useState(true);

  // Show login page if not authenticated
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user && !isLinkRedirect) {
    return <LoginPage />;
  }

  // If this is a link redirect, show redirect component instead
  if (isLinkRedirect) {
    return <LinkRedirect />;
  }

  // Load data from Firestore on app initialization
  useEffect(() => {
    if (!user || !currentOrgId) {
      setDataLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        console.log('🎯 ViewTrack Dashboard initialized');
        console.log('🔥 Loading data from Firestore...');
        console.log('📁 Organization ID:', currentOrgId);
        
        // Initialize theme
        ThemeService.initializeTheme();
        
        // Run migration if needed (only runs once)
        if (!DataMigrationService.isMigrationCompleted()) {
          console.log('🔄 Running data migration from localStorage to Firestore...');
          try {
            await DataMigrationService.migrateAllData(currentOrgId, user.uid);
            console.log('✅ Data migration completed!');
          } catch (error) {
            console.error('❌ Migration failed:', error);
          }
        }
        
        // Load videos from Firestore
        const firestoreVideos = await FirestoreDataService.getVideos(currentOrgId, { limitCount: 1000 });
        
        // Convert Firestore videos to VideoSubmission format
        const allSubmissions: VideoSubmission[] = firestoreVideos.map(video => ({
          id: video.id,
          url: video.url || '',
          platform: video.platform as 'instagram' | 'tiktok' | 'youtube',
          thumbnail: video.thumbnail || '',
          title: video.title || '',
          uploader: '', // Will be populated from tracked account if available
          uploaderHandle: '',
          status: video.status === 'archived' ? 'rejected' : 'approved',
          views: video.views,
          likes: video.likes,
          comments: video.comments,
          shares: video.shares,
          dateSubmitted: video.dateAdded.toDate(),
          uploadDate: video.uploadDate.toDate(),
          lastRefreshed: video.lastRefreshed?.toDate(),
          snapshots: [] // Will be loaded on-demand when viewing analytics
        }));
        
        console.log(`✅ Loaded ${allSubmissions.length} videos from Firestore`);
        
        setSubmissions(allSubmissions);
        console.log('🔍 Open browser console to see API logs when adding videos');
      } catch (error) {
        console.error('❌ Failed to load data from Firestore:', error);
      } finally {
        setDataLoading(false);
      }
    };

    loadData();
  }, [user, currentOrgId]);

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
    if (isRefreshing || !user || !currentOrgId) return;
    
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
        
        // Create new snapshot in Firestore
        await FirestoreDataService.addVideoSnapshot(currentOrgId, video.id, user.uid, {
          views: videoData.view_count || 0,
          likes: videoData.like_count,
          comments: videoData.comment_count,
          shares: video.platform === 'tiktok' ? (videoData as any).share_count : undefined
        });
        
        // Update local state with new metrics
        const updatedVideo = {
          ...video,
          views: videoData.view_count || 0,
          likes: videoData.like_count,
          comments: videoData.comment_count,
          shares: video.platform === 'tiktok' ? (videoData as any).share_count : video.shares,
          lastRefreshed: new Date()
        };
        
        updatedSubmissions.push(updatedVideo);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to refresh video "${video.title}":`, error);
        // Keep original video if refresh fails
        updatedSubmissions.push(video);
        errorCount++;
      }
    }

    // Update state
    setSubmissions(updatedSubmissions);
    
    console.log(`✅ Refresh completed: ${successCount} successful, ${errorCount} failed`);
    
    if (successCount > 0) {
      console.log(`🎉 Successfully refreshed ${successCount} videos with new snapshots!`);
    }
    
    setIsRefreshing(false);
  }, [submissions, isRefreshing, user, currentOrgId]);

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
        const videoId = await FirestoreDataService.addVideo(currentOrgId, user.uid, {
          platform: newSubmission.platform,
          url: newSubmission.url,
          videoId: newSubmission.id,
          title: newSubmission.title,
          thumbnail: newSubmission.thumbnail,
          uploadDate: Timestamp.fromDate(uploadDate),
          views: videoData.data.view_count || 0,
          likes: videoData.data.like_count,
          comments: videoData.data.comment_count,
          shares: 0,
          status: 'active',
          isSingular: true
        });

        // Create initial snapshot
        await FirestoreDataService.addVideoSnapshot(currentOrgId, videoId, user.uid, {
          views: videoData.data.view_count || 0,
          likes: videoData.data.like_count,
          comments: videoData.data.comment_count
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
      await FirestoreDataService.updateTrackedAccount(currentOrgId, id, {
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
      await FirestoreDataService.updateTrackedAccount(currentOrgId, id, {
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
