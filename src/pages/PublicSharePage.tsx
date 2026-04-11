import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, Check } from 'lucide-react';
import KPICards from '../components/KPICards';
import VideoSliderSection from '../components/VideoSliderSection';
import PostingActivityHeatmap from '../components/PostingActivityHeatmap';
import TopPerformersSection from '../components/TopPerformersSection';
import {
  RankingCreator,
  RankingCreatorLink,
  RankingAccount,
} from '../components/TopCreatorsRanking';
import { VideoSubmissionsTable } from '../components/VideoSubmissionsTable';
import VideoAnalyticsModal from '../components/VideoAnalyticsModal';
import DateRangeFilter, { DateFilterType } from '../components/DateRangeFilter';
import DateFilterService from '../services/DateFilterService';
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
  creators?: RankingCreator[];
  creatorLinks?: RankingCreatorLink[];
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
        <div key={i} className="bg-surface-secondary rounded-2xl border border-border-subtle p-4 md:p-5 animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-20 bg-surface-hover rounded" />
            <div className="h-5 w-5 bg-surface-hover rounded" />
          </div>
          <div className="h-8 w-24 bg-surface-hover rounded mb-2" />
          <div className="h-3 w-16 bg-surface-hover rounded" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-80 bg-surface-secondary rounded-2xl border border-border-subtle animate-pulse">
      <div className="p-6">
        <div className="h-5 w-40 bg-surface-hover rounded mb-2" />
        <div className="h-3 w-64 bg-surface-hover rounded mb-6" />
      </div>
    </div>
  );
}

function VideoSliderSkeleton() {
  return (
    <div className="bg-surface-secondary rounded-2xl border border-border-subtle p-4 md:p-6 animate-pulse">
      <div className="h-5 w-32 bg-surface-hover rounded mb-4" />
      <div className="flex space-x-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-40 md:w-48">
            <div className="aspect-[9/16] bg-surface-hover rounded-xl mb-2" />
            <div className="h-3 w-full bg-surface-hover rounded mb-1" />
            <div className="h-3 w-2/3 bg-surface-hover rounded" />
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

  // Filter state — matches the main dashboard: dateFilter, customDateRange,
  // manualGranularity (null = auto), platform and account filters
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [manualGranularity, setManualGranularity] = useState<'day' | 'week' | 'month' | 'year' | null>(null);
  const [platformFilter, setPlatformFilter] = useState<('instagram' | 'tiktok' | 'youtube' | 'twitter')[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);

  const handleDateFilterChange = (filter: DateFilterType, range?: DateRange) => {
    setDateFilter(filter);
    setCustomDateRange(range);
  };

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

  // Lightweight projections for the creators ranking (avoids threading the
  // full Firestore-shape TrackedAccount through to a data-driven component)
  const rankingAccounts: RankingAccount[] = useMemo(() => {
    if (!data) return [];
    return data.accounts.map(a => ({
      id: a.id,
      username: a.username,
      platform: a.platform,
    }));
  }, [data]);

  const rankingCreators: RankingCreator[] = useMemo(() => data?.creators ?? [], [data]);
  const rankingCreatorLinks: RankingCreatorLink[] = useMemo(
    () => data?.creatorLinks ?? [],
    [data]
  );

  // Granularity: manual override wins, otherwise auto-calculate based on the
  // selected date filter. Same logic the main dashboard uses.
  const granularity = useMemo<'day' | 'week' | 'month' | 'year'>(() => {
    if (manualGranularity) return manualGranularity;

    let autoGranularity: 'day' | 'week' | 'month' | 'year' = 'day';

    switch (dateFilter) {
      case 'today':
      case 'yesterday':
      case 'last7days':
      case 'last14days':
        autoGranularity = 'day';
        break;
      case 'last30days':
      case 'mtd':
        autoGranularity = 'week';
        break;
      case 'last90days':
      case 'ytd':
      case 'lastmonth':
        autoGranularity = 'month';
        break;
      case 'all': {
        // Smart granularity for "All Time": check actual data spread
        if (allSubmissions.length > 0) {
          const dates = allSubmissions
            .map(v => (v.uploadDate || v.dateSubmitted)?.getTime?.() || 0)
            .filter(d => d > 0);
          if (dates.length > 0) {
            const span = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
            if (span <= 14) autoGranularity = 'day';
            else if (span <= 60) autoGranularity = 'week';
            else autoGranularity = 'month';
          }
        }
        break;
      }
      case 'custom':
        if (customDateRange) {
          const daysDiff = Math.ceil(
            (customDateRange.endDate.getTime() - customDateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysDiff <= 14) autoGranularity = 'day';
          else if (daysDiff <= 60) autoGranularity = 'week';
          else if (daysDiff <= 365) autoGranularity = 'month';
          else autoGranularity = 'year';
        }
        break;
    }

    return autoGranularity;
  }, [dateFilter, customDateRange, manualGranularity, allSubmissions]);

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

  // Apply the date filter on top of the platform/account-filtered set.
  // The public API doesn't return snapshots, so strictMode has no effect here —
  // the filter effectively uses the upload date, which is the expected behavior
  // for a read-only share view.
  const filteredSubmissions = useMemo(() => {
    return DateFilterService.filterVideosByDateRange(
      submissionsWithoutDateFilter,
      dateFilter,
      customDateRange,
      true
    );
  }, [submissionsWithoutDateFilter, dateFilter, customDateRange]);

  // Default subsection visibility for TopPerformersSection.
  // `comparison` is off (old metrics chart replaced), `top-creators-ranking`
  // is on so the new creators card slots into the 2-column masonry grid
  // alongside Top Videos / Top Accounts / Top Platforms.
  const topPerformersVisibility = useMemo(() => ({
    'top-videos': true,
    'top-accounts': true,
    'top-gainers': false,
    'top-creators': false,
    'top-creators-ranking': true,
    'posting-times': false,
    'top-platforms': true,
    'comparison': false,
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
      <div className="min-h-screen bg-surface text-content">
        <header className="border-b border-border-subtle bg-surface-secondary sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4">
            <div className="h-7 w-48 bg-surface-hover rounded animate-pulse" />
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
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-content mb-2">Link not found</p>
          <p className="text-content-muted">{error || 'This share link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const { project } = data;

  return (
    <div className="min-h-screen bg-surface text-content">
      {/* Header - matches dashboard header with filters */}
      <header className="fixed top-0 left-0 right-0 bg-surface-secondary border-b border-border z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 h-16 md:h-[72px] flex items-center justify-between">
          {/* Project name */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {project.icon && <span className="text-2xl">{project.icon}</span>}
            <h1 className="text-lg md:text-xl font-bold text-content truncate">{project.name}</h1>
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
                className="flex items-center gap-2 pl-3 pr-8 py-2 bg-surface-secondary text-content rounded-lg text-sm font-medium border border-border hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-border-strong transition-all cursor-pointer min-w-[140px]"
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
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-content-muted" />
              </button>

              {platformDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-surface-tertiary border border-border rounded-lg shadow-xl overflow-hidden z-50">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPlatformFilter([]); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-content-muted hover:text-content hover:bg-surface-hover transition-colors border-b border-border-subtle"
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
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-content hover:bg-surface-hover transition-colors"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-content border-content' : 'border-border-strong'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-content-inverse" strokeWidth={3} />}
                        </div>
                        <PlatformIcon platform={p.value} size="sm" />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Granularity Selector — matches main dashboard exactly */}
            <div className="relative hidden md:block">
              <select
                value={granularity}
                onChange={(e) => setManualGranularity(e.target.value as 'day' | 'week' | 'month' | 'year')}
                className="appearance-none pl-3 pr-8 py-2 bg-surface-secondary text-content rounded-lg text-sm font-medium border border-border hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-border-strong transition-all cursor-pointer"
              >
                <option value="day" className="bg-surface-tertiary">Daily</option>
                <option value="week" className="bg-surface-tertiary">Weekly</option>
                <option value="month" className="bg-surface-secondary">Monthly</option>
                <option value="year" className="bg-surface-secondary">Yearly</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-content-muted pointer-events-none" />
            </div>

            {/* Date Range Filter — reused component from the main dashboard */}
            <div className="hidden sm:block">
              <DateRangeFilter
                selectedFilter={dateFilter}
                customRange={customDateRange}
                onFilterChange={handleDateFilterChange}
              />
            </div>

            {/* Powered by */}
            <a
              href="https://viewtrack.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-content-muted hover:text-content transition-colors hidden md:block"
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

            {/* Top Performers Section - uses date-filtered submissions.
                `layout="grid"` renders a uniform 2x2 grid with fixed 480px
                rows so every card is exactly the same size (share page only —
                the main dashboard keeps its masonry layout). */}
            <TopPerformersSection
              submissions={filteredSubmissions}
              onVideoClick={handleVideoClick}
              subsectionVisibility={topPerformersVisibility}
              granularity={granularity}
              dateFilter={dateFilter}
              customRange={customDateRange}
              rankingCreators={rankingCreators}
              rankingCreatorLinks={rankingCreatorLinks}
              rankingAccounts={rankingAccounts}
              layout="grid"
            />

            {/* Videos Table */}
            <VideoSubmissionsTable
              submissions={filteredSubmissions}
              onVideoClick={handleVideoClick}
              headerTitle="All Videos"
            />
          </div>

          {/* Footer */}
          <footer className="text-center text-xs text-content-muted pt-12 pb-6">
            <a
              href="https://viewtrack.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-content-muted hover:text-content transition-colors"
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
