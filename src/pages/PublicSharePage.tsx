import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, Check } from 'lucide-react';
import KPICards from '../components/KPICards';
import VideoSliderSection from '../components/VideoSliderSection';
import PostingActivityHeatmap from '../components/PostingActivityHeatmap';
import TopPerformersSection from '../components/TopPerformersSection';
import { VideoSubmissionsTable } from '../components/VideoSubmissionsTable';
import VideoAnalyticsModal from '../components/VideoAnalyticsModal';
import DateRangeFilter, { DateFilterType } from '../components/DateRangeFilter';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import { PlatformIcon } from '../components/ui/PlatformIcon';
import DateFilterService from '../services/DateFilterService';
import { VideoSubmission } from '../types';
import { TrackedAccount } from '../types/firestore';
import { Timestamp } from 'firebase/firestore';

// ─── API types ────────────────────────────────────────────────

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
  project: { name: string; description: string; color: string; icon: string };
  accounts: ApiAccount[];
  videos: ApiVideo[];
  generatedAt: string;
}

interface DateRange {
  startDate: Date;
  endDate: Date;
}

// ─── Mappers ──────────────────────────────────────────────────

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

// ─── Granularity helper (same logic as main dashboard) ────────

function computeGranularity(
  dateFilter: DateFilterType,
  customDateRange: DateRange | undefined,
  submissions: VideoSubmission[]
): 'day' | 'week' | 'month' | 'year' {
  switch (dateFilter) {
    case 'today':
    case 'yesterday':
    case 'last7days':
    case 'last14days':
      return 'day';
    case 'last30days':
    case 'mtd':
    case 'lastmonth':
      return 'week';
    case 'last90days':
    case 'ytd':
      return 'month';
    case 'all': {
      if (submissions.length > 0) {
        const dates = submissions
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
        const days = Math.ceil(
          (customDateRange.endDate.getTime() - customDateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (days <= 14) return 'day';
        if (days <= 60) return 'week';
        if (days <= 365) return 'month';
        return 'year';
      }
      return 'day';
    default:
      return 'week';
  }
}

// ─── Skeletons ────────────────────────────────────────────────

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

// ─── Video table header helper (same as dashboard) ────────────

function getVideoTableHeader(dateFilter: DateFilterType): string {
  switch (dateFilter) {
    case 'today': return 'New Videos Today';
    case 'yesterday': return 'Videos from Yesterday';
    case 'last7days': return 'New Videos Last 7 Days';
    case 'last14days': return 'New Videos Last 14 Days';
    case 'last30days': return 'New Videos Last 30 Days';
    case 'last90days': return 'New Videos Last 90 Days';
    case 'mtd': return 'New Videos This Month';
    case 'lastmonth': return 'Videos from Last Month';
    case 'ytd': return 'New Videos This Year';
    case 'custom': return 'New Videos (Custom Range)';
    case 'all': return 'All Videos';
    default: return 'All Videos';
  }
}

function getTrendPeriodDays(dateFilter: DateFilterType): number {
  switch (dateFilter) {
    case 'today':
    case 'yesterday': return 1;
    case 'last7days': return 7;
    case 'last14days': return 14;
    case 'last30days':
    case 'mtd':
    case 'lastmonth': return 30;
    case 'last90days': return 90;
    case 'ytd':
    case 'all':
    default: return 7;
  }
}

// ─── Platform filter dropdown ─────────────────────────────────

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'twitter';

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'X' },
];

function PlatformFilter({
  selected,
  onChange,
}: {
  selected: Platform[];
  onChange: (v: Platform[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="flex items-center gap-2 pl-2 sm:pl-3 pr-6 sm:pr-8 py-2 bg-white/5 text-white/90 rounded-lg text-xs sm:text-sm font-medium border border-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer backdrop-blur-sm min-w-[100px] sm:min-w-[140px]"
        title={selected.length === 0 ? 'All Platforms' : selected.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
      >
        {selected.length === 0 ? (
          <span>All Platforms</span>
        ) : selected.length === 1 ? (
          <>
            <PlatformIcon platform={selected[0]} size="sm" />
            <span className="capitalize">{selected[0] === 'twitter' ? 'X' : selected[0]}</span>
          </>
        ) : (
          <span>{selected.length} Platforms</span>
        )}
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-white/50" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 w-56 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          <button
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-white/60 hover:text-white/90 hover:bg-white/5 transition-colors border-b border-white/5"
          >
            Clear All
          </button>
          {PLATFORMS.map((p) => {
            const sel = selected.includes(p.value);
            return (
              <button
                key={p.value}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(sel ? selected.filter(x => x !== p.value) : [...selected, p.value]);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/90 hover:bg-white/5 transition-colors"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${sel ? 'bg-white border-white' : 'border-white/30'}`}>
                  {sel && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                </div>
                <PlatformIcon platform={p.value} size="sm" />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────

export default function PublicSharePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoSubmission | null>(null);

  // ── Filter state ──
  const [dateFilter, setDateFilter] = useState<DateFilterType>('last30days');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [platformFilter, setPlatformFilter] = useState<Platform[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  // ── Fetch data ──
  useEffect(() => {
    if (!token) return;
    fetch(`/api/public-share?token=${token}`)
      .then(res => res.json())
      .then(result => {
        if (result.success) setData(result.data);
        else setError(result.error || 'Share link not found');
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false));
  }, [token]);

  // ── Convert API data to dashboard types ──
  const allSubmissions: VideoSubmission[] = useMemo(() => {
    if (!data) return [];
    return data.videos.map(toVideoSubmission);
  }, [data]);

  const accounts: TrackedAccount[] = useMemo(() => {
    if (!data) return [];
    return data.accounts.map(toTrackedAccount);
  }, [data]);

  // Account options for the dropdown
  const accountOptions = useMemo(() => {
    return accounts.map(a => ({
      id: a.id,
      label: a.displayName || `@${a.username}`,
      avatar: a.profilePicture,
    }));
  }, [accounts]);

  // ── Apply platform + account filters (same logic as dashboard) ──
  const submissionsWithoutDateFilter = useMemo(() => {
    let filtered = allSubmissions;

    // Platform filter
    if (platformFilter.length > 0) {
      filtered = filtered.filter(v => platformFilter.includes(v.platform as Platform));
    }

    // Account filter
    if (selectedAccountIds.length > 0) {
      const selectedKeys = new Set(
        accounts
          .filter(a => selectedAccountIds.includes(a.id))
          .map(a => `${a.platform}_${a.username.toLowerCase()}`)
      );
      filtered = filtered.filter(v => {
        if (!v.uploaderHandle) return false;
        return selectedKeys.has(`${v.platform}_${v.uploaderHandle.toLowerCase()}`);
      });
    }

    return filtered;
  }, [allSubmissions, platformFilter, selectedAccountIds, accounts]);

  // ── Apply date filter ──
  const filteredSubmissions = useMemo(() => {
    return DateFilterService.filterVideosByDateRange(
      submissionsWithoutDateFilter,
      dateFilter,
      customDateRange,
      false // non-strict: include videos with snapshots in period
    );
  }, [submissionsWithoutDateFilter, dateFilter, customDateRange]);

  // Strict-filtered for the video table (only videos uploaded in the period)
  const strictFilteredSubmissions = useMemo(() => {
    return DateFilterService.filterVideosByDateRange(
      submissionsWithoutDateFilter,
      dateFilter,
      customDateRange,
      true // strict: only upload date
    );
  }, [submissionsWithoutDateFilter, dateFilter, customDateRange]);

  // ── Granularity ──
  const granularity = useMemo(
    () => computeGranularity(dateFilter, customDateRange, allSubmissions),
    [dateFilter, customDateRange, allSubmissions]
  );

  // ── Top performers date range ──
  const topPerformersDateRange = useMemo(
    () => DateFilterService.getDateRange(dateFilter, customDateRange, allSubmissions),
    [dateFilter, customDateRange, allSubmissions]
  );

  // ── Subsection visibility ──
  const topPerformersVisibility = useMemo(() => ({
    'top-videos': true,
    'top-accounts': true,
    'top-gainers': false,
    'top-creators': false,
    'posting-times': false,
    'top-platforms': true,
    'comparison': true,
  }), []);

  // ── Handlers ──
  const handleDateFilterChange = useCallback((filter: DateFilterType, range?: DateRange) => {
    setDateFilter(filter);
    setCustomDateRange(range);
  }, []);

  const handleVideoClick = useCallback((video: VideoSubmission) => {
    setSelectedVideo(video);
  }, []);

  // ─── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <header className="fixed top-0 left-0 right-0 h-16 md:h-[72px] bg-zinc-900/60 backdrop-blur border-b border-white/5 z-30">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 h-full flex items-center">
            <div className="h-7 w-48 bg-white/5 rounded animate-pulse" />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 pt-24 md:pt-28 space-y-6">
          <VideoSliderSkeleton />
          <KPICardsSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </main>
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────
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
      {/* ── Header with filters ── */}
      <header className="fixed top-0 left-0 right-0 bg-[#111111] border-b border-white/5 z-30">
        {/* Top row: project name + powered by */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {project.icon && <span className="text-xl">{project.icon}</span>}
            <h1 className="text-lg font-bold text-white truncate">{project.name}</h1>
          </div>
          <a
            href="https://viewtrack.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0 ml-4"
          >
            Powered by ViewTrack
          </a>
        </div>

        {/* Filter bar */}
        <div className="border-t border-white/5 bg-[#111111]">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 h-12 flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide">
            {/* Account filter */}
            <div className="flex-shrink-0">
              <MultiSelectDropdown
                options={accountOptions}
                selectedIds={selectedAccountIds}
                onChange={setSelectedAccountIds}
                placeholder="All Accounts"
              />
            </div>

            {/* Platform filter */}
            <div className="flex-shrink-0">
              <PlatformFilter selected={platformFilter} onChange={setPlatformFilter} />
            </div>

            {/* Date filter */}
            <div className="flex-shrink-0">
              <DateRangeFilter
                selectedFilter={dateFilter}
                customRange={customDateRange}
                onFilterChange={handleDateFilterChange}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="overflow-auto min-h-screen pt-[104px] md:pt-[112px]" style={{ overflowX: 'hidden', overflowY: 'auto' }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-8" style={{ overflow: 'visible' }}>
          <div className="space-y-6">
            {/* Video Slider */}
            <VideoSliderSection
              videos={strictFilteredSubmissions}
              maxVideos={20}
              onVideoClick={handleVideoClick}
            />

            {/* KPI Cards */}
            <KPICards
              submissions={filteredSubmissions}
              allSubmissions={submissionsWithoutDateFilter}
              accounts={accounts}
              dateFilter={dateFilter}
              customRange={customDateRange}
              timePeriod="days"
              granularity={granularity}
              onVideoClick={handleVideoClick}
            />

            {/* Posting Activity Heatmap */}
            <PostingActivityHeatmap
              submissions={filteredSubmissions}
              onVideoClick={handleVideoClick}
              dateFilter={dateFilter}
              customDateRange={customDateRange}
            />

            {/* Top Performers */}
            <TopPerformersSection
              submissions={filteredSubmissions}
              onVideoClick={handleVideoClick}
              subsectionVisibility={topPerformersVisibility}
              granularity={granularity}
              dateRange={topPerformersDateRange}
              dateFilter={dateFilter}
              customRange={customDateRange}
            />

            {/* Videos Table */}
            <VideoSubmissionsTable
              submissions={strictFilteredSubmissions}
              onVideoClick={handleVideoClick}
              headerTitle={getVideoTableHeader(dateFilter)}
              trendPeriodDays={getTrendPeriodDays(dateFilter)}
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
