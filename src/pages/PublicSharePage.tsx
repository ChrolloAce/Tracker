import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import KPICards from '../components/KPICards';
import VideoSliderSection from '../components/VideoSliderSection';
import PostingActivityHeatmap from '../components/PostingActivityHeatmap';
import TopPerformersSection from '../components/TopPerformersSection';
import { VideoSubmissionsTable } from '../components/VideoSubmissionsTable';
import VideoAnalyticsModal from '../components/VideoAnalyticsModal';
import { VideoSubmission } from '../types';
import { TrackedAccount } from '../types/firestore';
import { Timestamp } from 'firebase/firestore';

interface ApiVideo {
  id: string;
  url: string;
  platform: string;
  thumbnail: string;
  title: string;
  caption: string;
  uploader: string;
  uploaderHandle: string;
  uploaderProfilePicture: string;
  followerCount: number;
  trackedAccountId: string;
  status: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  duration: number;
  dateSubmitted: string;
  uploadDate: string | null;
  lastRefreshed: string | null;
}

interface ApiAccount {
  id: string;
  username: string;
  displayName: string;
  platform: string;
  profilePicture: string;
  followerCount: number;
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
}

interface ShareData {
  project: {
    name: string;
    description: string;
    color: string;
    icon: string;
  };
  summary: {
    totalAccounts: number;
    totalVideos: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
  };
  accounts: ApiAccount[];
  videos: ApiVideo[];
  generatedAt: string;
}

/** Map API video data to the VideoSubmission type the dashboard components expect */
function toVideoSubmission(v: ApiVideo): VideoSubmission {
  return {
    id: v.id,
    url: v.url,
    platform: v.platform as VideoSubmission['platform'],
    thumbnail: v.thumbnail,
    title: v.title,
    caption: v.caption,
    uploader: v.uploader,
    uploaderHandle: v.uploaderHandle,
    uploaderProfilePicture: v.uploaderProfilePicture,
    followerCount: v.followerCount,
    trackedAccountId: v.trackedAccountId,
    status: 'approved',
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    saves: v.saves,
    duration: v.duration,
    dateSubmitted: v.dateSubmitted ? new Date(v.dateSubmitted) : new Date(),
    uploadDate: v.uploadDate ? new Date(v.uploadDate) : new Date(),
    lastRefreshed: v.lastRefreshed ? new Date(v.lastRefreshed) : undefined,
  };
}

/** Map API account data to the TrackedAccount type the KPICards component expects */
function toTrackedAccount(a: ApiAccount): TrackedAccount {
  return {
    id: a.id,
    orgId: '',
    platform: a.platform as TrackedAccount['platform'],
    username: a.username,
    displayName: a.displayName,
    profilePicture: a.profilePicture,
    accountType: 'my',
    followerCount: a.followerCount,
    dateAdded: Timestamp.now(),
    addedBy: '',
    isActive: true,
  };
}

// Skeleton loaders matching the dashboard
function KPICardsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-zinc-900/60 backdrop-blur rounded-2xl border border-white/5 p-4 md:p-5 animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-20 bg-white/5 rounded" />
            <div className="h-5 w-5 bg-white/5 rounded" />
          </div>
          <div className="h-8 w-24 bg-white/5 rounded mb-2" />
          <div className="h-3 w-16 bg-white/5 rounded" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-80 bg-zinc-900/60 backdrop-blur rounded-2xl border border-white/5 animate-pulse">
      <div className="p-6">
        <div className="h-5 w-40 bg-white/5 rounded mb-2" />
        <div className="h-3 w-64 bg-white/5 rounded mb-6" />
      </div>
    </div>
  );
}

function VideoSliderSkeleton() {
  return (
    <div className="bg-zinc-900/60 backdrop-blur rounded-2xl border border-white/5 p-4 md:p-6 animate-pulse">
      <div className="h-5 w-32 bg-white/5 rounded mb-4" />
      <div className="flex space-x-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-40 md:w-48">
            <div className="aspect-[9/16] bg-white/5 rounded-xl mb-2" />
            <div className="h-3 w-full bg-white/5 rounded mb-1" />
            <div className="h-3 w-2/3 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PublicSharePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoSubmission | null>(null);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/public-share?token=${token}`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || 'Share link not found');
        }
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false));
  }, [token]);

  // Convert API data to dashboard-compatible types
  const submissions: VideoSubmission[] = useMemo(() => {
    if (!data) return [];
    return data.videos.map(toVideoSubmission);
  }, [data]);

  const accounts: TrackedAccount[] = useMemo(() => {
    if (!data) return [];
    return data.accounts.map(toTrackedAccount);
  }, [data]);

  // Default subsection visibility for TopPerformersSection
  const topPerformersVisibility = useMemo(() => ({
    'top-videos': true,
    'top-accounts': true,
    'top-gainers': false,
    'top-creators': false,
    'posting-times': false,
    'top-platforms': true,
    'comparison': true,
  }), []);

  const handleVideoClick = (video: VideoSubmission) => {
    setSelectedVideo(video);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <header className="border-b border-white/5 bg-zinc-900/40 backdrop-blur sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4">
            <div className="h-7 w-48 bg-white/5 rounded animate-pulse" />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-8 space-y-6">
          <VideoSliderSkeleton />
          <KPICardsSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-white mb-2">Link not found</p>
          <p className="text-zinc-400">{error || 'This share link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const { project } = data;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header - matches dashboard header style */}
      <header className="fixed top-0 left-0 right-0 h-16 md:h-[72px] bg-zinc-900/60 backdrop-blur border-b border-white/5 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            {project.icon && <span className="text-2xl">{project.icon}</span>}
            <div>
              <h1 className="text-lg md:text-xl font-bold text-white">{project.name}</h1>
              {project.description && (
                <p className="text-xs text-zinc-400 hidden sm:block">{project.description}</p>
              )}
            </div>
          </div>
          <a
            href="https://viewtrack.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Powered by ViewTrack
          </a>
        </div>
      </header>

      {/* Main Content - matches dashboard layout */}
      <main className="overflow-auto min-h-screen pt-16 md:pt-24" style={{ overflowX: 'hidden', overflowY: 'auto' }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-8" style={{ overflow: 'visible' }}>
          <div className="space-y-6">
            {/* Video Slider - Top videos with thumbnails */}
            <VideoSliderSection
              videos={submissions}
              maxVideos={20}
              onVideoClick={handleVideoClick}
            />

            {/* KPI Cards */}
            <KPICards
              submissions={submissions}
              allSubmissions={submissions}
              accounts={accounts}
              dateFilter="all"
              granularity="day"
              onVideoClick={handleVideoClick}
            />

            {/* Posting Activity Heatmap */}
            <PostingActivityHeatmap
              submissions={submissions}
              onVideoClick={handleVideoClick}
              dateFilter="all"
            />

            {/* Top Performers Section */}
            <TopPerformersSection
              submissions={submissions}
              onVideoClick={handleVideoClick}
              subsectionVisibility={topPerformersVisibility}
              granularity="week"
              dateFilter="all"
            />

            {/* Videos Table */}
            <VideoSubmissionsTable
              submissions={submissions}
              onVideoClick={handleVideoClick}
              headerTitle="All Videos"
            />
          </div>

          {/* Footer */}
          <footer className="text-center text-xs text-zinc-600 pt-12 pb-6">
            <a
              href="https://viewtrack.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Powered by ViewTrack
            </a>
          </footer>
        </div>
      </main>

      {/* Video Analytics Modal */}
      {selectedVideo && (
        <VideoAnalyticsModal
          video={selectedVideo}
          isOpen={true}
          onClose={() => setSelectedVideo(null)}
          updateUrlOnOpen={false}
        />
      )}
    </div>
  );
}
