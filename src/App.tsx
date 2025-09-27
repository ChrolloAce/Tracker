import { useState, useCallback, useEffect } from 'react';
import { TopNavigation } from './components/layout/TopNavigation';
import { VideoSubmissionsTable } from './components/VideoSubmissionsTable';
import { VideoSubmissionModal } from './components/VideoSubmissionModal';
import { TikTokSearchModal } from './components/TikTokSearchModal';
import { AnalyticsCards } from './components/AnalyticsCards';
import { VideoSubmission, InstagramVideoData } from './types';
import VideoApiService from './services/VideoApiService';
import LocalStorageService from './services/LocalStorageService';

function App() {
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTikTokSearchOpen, setIsTikTokSearchOpen] = useState(false);

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

      // Save to localStorage
      LocalStorageService.addSubmission(newSubmission);
      
      // Update state
      setSubmissions(prev => [newSubmission, ...prev]);
      console.log('✅ Video submission completed and saved locally!');
      
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

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation 
        onAddVideo={() => setIsModalOpen(true)}
        onTikTokSearch={() => setIsTikTokSearchOpen(true)}
      />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Analytics Cards */}
        <AnalyticsCards submissions={submissions} />
        
        {/* Video Submissions Table */}
        <VideoSubmissionsTable
          submissions={submissions}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
          onSelectAll={handleSelectAll}
          onStatusUpdate={handleStatusUpdate}
          onDelete={handleDelete}
        />
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
    </div>
  );
}

export default App;
