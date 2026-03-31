import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, Check } from 'lucide-react';
import KPICards from '../components/KPICards';
import VideoSliderSection from '../components/VideoSliderSection';
import PostingActivityHeatmap from '../components/PostingActivityHeatmap';
import TopPerformersSection from '../components/TopPerformersSection';
import { VideoSubmissionsTable } from '../components/VideoSubmissionsTable';
import VideoAnalyticsModal from '../components/VideoAnalyticsModal';
import { DateFilterType } from '../components/DateRangeFilter';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import { PlatformIcon } from '../components/ui/PlatformIcon';
import { VideoSubmission } from '../types';
import { TrackedAccount } from '../types/firestore';
import { Timestamp } from 'firebase/firestore';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

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
    totalVideos: a.totalVideos,
    totalViews: a.totalViews,
    totalLikes: a.totalLikes,
    totalComments: a.totalComments,
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

  // Filter state - date is hardcoded to 'all' (all-time)
  const dateFilter: DateFilterType = 'all';
  const customDateRange: DateRange | undefined = undefined;
  const [platformFilter, setPlatformFilter] = useState<('instagram' | 'tiktok' | 'youtube' | 'twitter')[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);

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
  const allSubmissions: VideoSubmission[] = useMemo(() => {
    if (!data) return [];
    return data.videos.map(toVideoSubmission);
  }, [data]);

  const accounts: TrackedAccount[] = useMemo(() => {
    if (!data) return [];
    return data.accounts.map(toTrackedAccount);
  }, [data]);

  // Auto-calculate granularity based on date filter (same logic as dashboard)
  const granularity = useMemo<'day' | 'week' | 'month' | 'year'>(() => {
    switch (dateFilter) {
      case 'today':
      case 'yesterday':
      case 'last7days':
      case 'last14days':
        return 'day';
      case 'last30days':
      case 'mtd':
        return 'week';
      case 'last90days':
      case 'ytd':
        return 'month';
      case 'all': {
        const videos = allSubmissions;
        if (videos.length > 0) {
          const dates = videos
            .map(v => (v.uploadDate || v.dateSubmitted)?.getTime?.() || 0)
            .filter(d => d > 0);
          if (dates.length > 0) {
            const span = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
            if (span <= 14) return 'day';
            if (span <= 60) return 'week';
            return 'month';
          }
        }
        return 'month';
      }
      case 'custom':
        if (customDateRange) {
          const daysDiff = Math.ceil(
            (customDateRange.endDate.getTime() - customDateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysDiff <= 14) return 'day';
          if (daysDiff <= 60) return 'week';
          if (daysDiff <= 365) return 'month';
          return 'year';
        }
        return 'day';
      default:
        return 'day';
    }
  }, [dateFilter, customDateRange, allSubmissions]);

  // Step 1: Apply platform + account filters (no date filter yet)
  // These are used for KPI card totals (always all-time)
  const submissionsWithoutDateFilter = useMemo(() => {
    let filtered = allSubmissions;

    // Apply platform filter
    if (platformFilter.length > 0) {
      filtered = filtered.filter(v => platformFilter.includes(v.platform as any));
    }

    // Apply account filter
    if (selectedAccountIds.length > 0) {
      const selectedAccountKeys = new Set(
        accounts
          .filter(a => selectedAccountIds.includes(a.id))
          .map(a => `${a.platform}_${a.username.toLowerCase()}`)
      );
      filtered = filtered.filter(v => {
        if (!v.uploaderHandle) return false;
        const key = `${v.platform}_${v.uploaderHandle.toLowerCase()}`;
        return selectedAccountKeys.has(key);
      });
    }

    return filtered;
  }, [allSubmissions, platformFilter, selectedAccountIds, accounts]);

  // With 'all' date filter, filtered = unfiltered
  const filteredSubmissions = submissionsWithoutDateFilter;

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

  // Account options for the multi-select dropdown
  const accountOptions = useMemo(() => {
    if (!data) return [];
    return data.accounts.map(a => ({
      id: a.id,
      label: a.displayName || `@${a.username}`,
      avatar: a.profilePicture,
    }));
  }, [data]);

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
      {/* Header - matches dashboard header with filters */}
      <header className="fixed top-0 left-0 right-0 bg-zinc-900/60 backdrop-blur border-b border-white/5 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 h-16 md:h-[72px] flex items-center justify-between">
          {/* Project name */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {project.icon && <span className="text-2xl">{project.icon}</span>}
            <h1 className="text-lg md:text-xl font-bold text-white truncate">{project.name}</h1>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {/* Account Filter */}
            <div className="hidden lg:block">
              <MultiSelectDropdown
                options={accountOptions}
                selectedIds={selectedAccountIds}
                onChange={setSelectedAccountIds}
                placeholder="All Accounts"
              />
            </div>

            {/* Platform Filter */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
                onBlur={() => setTimeout(() => setPlatformDropdownOpen(false), 200)}
                className="flex items-center gap-2 pl-3 pr-8 py-2 bg-white/5 text-white/90 rounded-lg text-sm font-medium border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm min-w-[140px]"
              >
                {platformFilter.length === 0 ? (
                  <span>All Platforms</span>
                ) : platformFilter.length === 1 ? (
                  <>
                    <PlatformIcon platform={platformFilter[0]} size="sm" />
                    <span className="capitalize">{platformFilter[0] === 'twitter' ? 'X' : platformFilter[0]}</span>
                  </>
                ) : (
                  <span>{platformFilter.length} Platforms</span>
                )}
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-white/50" />
              </button>

              {platformDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPlatformFilter([]); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-white/60 hover:text-white/90 hover:bg-white/5 transition-colors border-b border-white/5"
                  >
                    <span>Clear All</span>
                  </button>
                  {([
                    { value: 'instagram' as const, label: 'Instagram' },
                    { value: 'tiktok' as const, label: 'TikTok' },
                    { value: 'youtube' as const, label: 'YouTube' },
                    { value: 'twitter' as const, label: 'X' },
                  ]).map((p) => {
                    const isSelected = platformFilter.includes(p.value);
                    return (
                      <button
                        key={p.value}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlatformFilter(prev =>
                            isSelected ? prev.filter(x => x !== p.value) : [...prev, p.value]
                          );
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/90 hover:bg-white/5 transition-colors"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-white border-white' : 'border-white/30'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                        </div>
                        <PlatformIcon platform={p.value} size="sm" />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Powered by */}
            <a
              href="https://viewtrack.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors hidden md:block"
            >
              ViewTrack
            </a>
          </div>
        </div>
      </header>

      {/* Main Content - matches dashboard layout */}
      <main className="overflow-auto min-h-screen pt-16 md:pt-24" style={{ overflowX: 'hidden', overflowY: 'auto' }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-8" style={{ overflow: 'visible' }}>
          <div className="space-y-6">
            {/* Video Slider - uses platform/account filtered but NOT date filtered */}
            <VideoSliderSection
              videos={submissionsWithoutDateFilter}
              maxVideos={20}
              onVideoClick={handleVideoClick}
            />

            {/* KPI Cards - totals are ALL-TIME (submissionsWithoutDateFilter),
                sparklines use filtered submissions for chart granularity */}
            <KPICards
              submissions={filteredSubmissions}
              allSubmissions={submissionsWithoutDateFilter}
              accounts={accounts}
              dateFilter={dateFilter}
              customRange={customDateRange}
              granularity={granularity}
              onVideoClick={handleVideoClick}
            />

            {/* Posting Activity Heatmap - uses date-filtered submissions */}
            <PostingActivityHeatmap
              submissions={filteredSubmissions}
              onVideoClick={handleVideoClick}
              dateFilter={dateFilter}
              customDateRange={customDateRange}
            />

            {/* Top Performers Section - uses date-filtered submissions */}
            <TopPerformersSection
              submissions={filteredSubmissions}
              onVideoClick={handleVideoClick}
              subsectionVisibility={topPerformersVisibility}
              granularity={granularity}
              dateFilter={dateFilter}
              customRange={customDateRange}
            />

            {/* Videos Table */}
            <VideoSubmissionsTable
              submissions={filteredSubmissions}
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
