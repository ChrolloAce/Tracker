import { useState, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import Sidebar from './components/layout/Sidebar';
import { VideoSubmissionsTable } from './components/VideoSubmissionsTable';
import { VideoSubmissionModal } from './components/VideoSubmissionModal';
import { TikTokSearchModal } from './components/TikTokSearchModal';
import { AnalyticsCards } from './components/AnalyticsCards';
import DateRangeFilter, { DateFilterType } from './components/DateRangeFilter';
import TimePeriodSelector, { TimePeriodType } from './components/TimePeriodSelector';
import VideoAnalyticsModal from './components/VideoAnalyticsModal';
import AccountsPage from './components/AccountsPage';
import { VideoSubmission, InstagramVideoData } from './types';
import VideoApiService from './services/VideoApiService';
import LocalStorageService from './services/LocalStorageService';
import DateFilterService from './services/DateFilterService';
import SnapshotService from './services/SnapshotService';
import { cssVariables } from './theme';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

function App() {
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  // Load saved data on app initialization
  useEffect(() => {
    console.log('🎯 Instagram Submissions Dashboard initialized');
    console.log('📱 Loading saved data from localStorage...');
    
    const savedSubmissions = LocalStorageService.loadSubmissions();
    setSubmissions(savedSubmissions);
    
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

  // Get period description for display
  const periodDescription = DateFilterService.getPeriodDescription(dateFilter, customDateRange);

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

  const handleAddVideo = useCallback(async (videoUrl: string) => {
    console.log('🚀 Starting video submission process...');
    console.log('📋 URL submitted:', videoUrl);
    
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
        timestamp: videoData.timestamp, // Original upload timestamp
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

  const handleSelectionChange = useCallback((id: string, selected: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(submissions.map(s => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [submissions]);

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
    
    // Remove from selected if it was selected
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    
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
    <div className="min-h-screen bg-gray-50">
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
        'fixed top-0 right-0 bg-white border-b border-gray-200 px-6 py-4 z-20 transition-all duration-300',
        {
          'left-64': !isSidebarCollapsed,
          'left-16': isSidebarCollapsed,
        }
      )}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {activeTab === 'dashboard' && 'Reporting Overview'}
              {activeTab === 'accounts' && 'Account Tracking'}
              {activeTab === 'analytics' && 'Analytics'}
              {activeTab === 'videos' && 'Video Library'}
              {activeTab === 'performance' && 'Performance'}
              {activeTab === 'calendar' && 'Content Calendar'}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {activeTab === 'dashboard' && 'Track and analyze your video performance'}
              {activeTab === 'accounts' && 'Monitor entire Instagram and TikTok accounts'}
              {activeTab === 'analytics' && 'Deep dive into your content analytics'}
              {activeTab === 'videos' && 'Manage your video content library'}
              {activeTab === 'performance' && 'Analyze performance metrics and trends'}
              {activeTab === 'calendar' && 'Plan and schedule your content'}
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
              {/* Analytics Cards */}
              <AnalyticsCards 
                submissions={filteredSubmissions} 
                periodDescription={periodDescription}
                dateFilter={dateFilter}
                customDateRange={customDateRange}
                timePeriod={timePeriod}
              />
              
              {/* Video Submissions Table */}
              <VideoSubmissionsTable
                submissions={filteredSubmissions}
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
                onSelectAll={handleSelectAll}
                onStatusUpdate={handleStatusUpdate}
                onDelete={handleDelete}
                onVideoClick={handleVideoClick}
              />
            </>
          )}

          {/* Accounts Tab */}
          {activeTab === 'accounts' && <AccountsPage />}

          {/* Other Tabs - Placeholder */}
          {activeTab !== 'dashboard' && activeTab !== 'accounts' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚧</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
              <p className="text-gray-500">
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
