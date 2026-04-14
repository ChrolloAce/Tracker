import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, Check, Users, ArrowRight } from 'lucide-react';
import LandingCTABanner from '../components/marketing/LandingCTABanner';
import KPICards from '../components/KPICards';
import VideoSliderSection from '../components/VideoSliderSection';
import PostingActivityHeatmap from '../components/PostingActivityHeatmap';
import { VideoSubmissionsTable } from '../components/VideoSubmissionsTable';
import VideoAnalyticsModal from '../components/VideoAnalyticsModal';
import DateRangeFilter, { DateFilterType } from '../components/DateRangeFilter';
import DateFilterService from '../services/DateFilterService';
import { PlatformIcon } from '../components/ui/PlatformIcon';
import AccountShareLinkService, { PublicAccountShareData } from '../services/AccountShareLinkService';
import { VideoSubmission } from '../types';
import { TrackedAccount } from '../types/firestore';
import { Timestamp } from 'firebase/firestore';

/**
 * AccountShareView . public, token-gated, single-account dashboard.
 * Route: /a/:token
 *
 * Used by super admins for marketing/demo . paste the link anywhere and
 * viewers see that account's ViewTrack data (videos + summary + heatmap).
 * No submission flow, no auth.
 */

interface DateRange {
  startDate: Date;
  endDate: Date;
}

function formatNumber(num: number): string {
  if (!num) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function toVideoSubmission(v: PublicAccountShareData['videos'][number]): VideoSubmission {
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

function toTrackedAccount(a: PublicAccountShareData['account']): TrackedAccount {
  return {
    id: 'shared-account',
    orgId: '',
    platform: a.platform as TrackedAccount['platform'],
    username: a.username,
    displayName: a.displayName,
    profilePicture: a.profilePicture,
    accountType: 'my',
    followerCount: a.followerCount,
    totalVideos: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    dateAdded: Timestamp.now(),
    addedBy: '',
    isActive: true,
  };
}

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

export default function AccountShareView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicAccountShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoSubmission | null>(null);

  // Filters (default: all time . best for marketing numbers)
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [manualGranularity, setManualGranularity] = useState<'day' | 'week' | 'month' | 'year' | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    AccountShareLinkService.fetchPublic(token)
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [token]);

  const handleDateFilterChange = (filter: DateFilterType, range?: DateRange) => {
    setDateFilter(filter);
    setCustomDateRange(range);
  };

  const allSubmissions: VideoSubmission[] = useMemo(() => {
    if (!data) return [];
    return data.videos.map(toVideoSubmission);
  }, [data]);

  const accounts: TrackedAccount[] = useMemo(() => {
    if (!data) return [];
    return [toTrackedAccount(data.account)];
  }, [data]);

  const granularity = useMemo<'day' | 'week' | 'month' | 'year'>(() => {
    if (manualGranularity) return manualGranularity;
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
      case 'lastmonth':
        return 'month';
      case 'custom': {
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
      }
      case 'all':
      default: {
        if (allSubmissions.length > 0) {
          const dates = allSubmissions
            .map(v => (v.uploadDate || v.dateSubmitted)?.getTime?.() || 0)
            .filter(d => d > 0);
          if (dates.length > 0) {
            const span = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
            if (span <= 14) return 'day';
            if (span <= 60) return 'week';
            return 'month';
          }
        }
        return 'day';
      }
    }
  }, [dateFilter, customDateRange, manualGranularity, allSubmissions]);

  const filteredSubmissions = useMemo(() => {
    return DateFilterService.filterVideosByDateRange(
      allSubmissions,
      dateFilter,
      customDateRange,
      true
    );
  }, [allSubmissions, dateFilter, customDateRange]);

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
          <KPICardsSkeleton />
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-xl text-content mb-2">Link not found</p>
          <p className="text-content-muted text-sm">{error || 'This share link is invalid or has been revoked.'}</p>
        </div>
      </div>
    );
  }

  const { account, summary } = data;

  return (
    <div className="min-h-screen bg-surface text-content">
      {/* Header . compact, matches creator view style */}
      <header className="fixed top-0 left-0 right-0 bg-surface-secondary border-b border-border z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 h-16 md:h-[72px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
            {account.profilePicture ? (
              <img
                src={account.profilePicture}
                alt={account.username}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-1 ring-border"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-surface-tertiary flex items-center justify-center flex-shrink-0">
                <PlatformIcon platform={account.platform as any} size="sm" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base md:text-lg font-bold text-content truncate">@{account.username}</h1>
                {account.isVerified && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white text-[10px]" title="Verified">✓</span>
                )}
              </div>
              <p className="text-[11px] text-content-muted truncate">
                {account.displayName || 'Account Dashboard'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <PlatformIcon platform={account.platform as any} size="sm" />

            <div className="relative hidden md:block">
              <select
                value={granularity}
                onChange={(e) => setManualGranularity(e.target.value as 'day' | 'week' | 'month' | 'year')}
                className="appearance-none pl-3 pr-8 py-2 bg-surface-secondary text-content rounded-lg text-sm font-medium border border-border hover:border-border-strong focus:outline-none transition-all cursor-pointer"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-content-muted pointer-events-none" />
            </div>

            <div className="hidden sm:block">
              <DateRangeFilter
                selectedFilter={dateFilter}
                customRange={customDateRange}
                onFilterChange={handleDateFilterChange}
              />
            </div>

            <a
              href="https://www.viewtrack.app"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-500 text-white rounded-lg font-bold text-xs shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all whitespace-nowrap"
            >
              Try ViewTrack
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="overflow-auto min-h-screen pt-16 md:pt-24" style={{ overflowX: 'hidden', overflowY: 'auto' }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-8" style={{ overflow: 'visible' }}>
          <div className="space-y-6">
            {/* Featured profile banner . big profile pic + key stats */}
            <div className="bg-surface-secondary rounded-2xl border border-border-subtle p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                {account.profilePicture ? (
                  <img
                    src={account.profilePicture}
                    alt={account.username}
                    className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover ring-4 ring-border"
                  />
                ) : (
                  <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-surface-tertiary flex items-center justify-center ring-4 ring-border">
                    <PlatformIcon platform={account.platform as any} size="lg" />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-center md:text-left">
                  <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
                    <h2 className="text-2xl md:text-3xl font-bold text-content truncate">
                      {account.displayName || `@${account.username}`}
                    </h2>
                    {account.isVerified && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex-shrink-0" title="Verified">✓</span>
                    )}
                  </div>
                  <p className="text-content-muted text-sm mb-3">@{account.username}</p>
                  {account.bio && (
                    <p className="text-content-secondary text-sm mb-4 line-clamp-3">{account.bio}</p>
                  )}
                  <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-content-secondary">
                      <Users className="w-4 h-4" />
                      <span className="font-semibold text-content">{formatNumber(account.followerCount)}</span>
                      <span className="text-content-muted">followers</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-content-secondary">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="font-semibold text-content">{formatNumber(summary.totalVideos)}</span>
                      <span className="text-content-muted">videos tracked</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-content-secondary">
                      <span className="font-semibold text-content">{formatNumber(summary.totalViews)}</span>
                      <span className="text-content-muted">total views</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <VideoSliderSection
              videos={allSubmissions}
              maxVideos={20}
              onVideoClick={handleVideoClick}
            />

            <KPICards
              submissions={filteredSubmissions}
              allSubmissions={allSubmissions}
              accounts={accounts}
              dateFilter={dateFilter}
              customRange={customDateRange}
              granularity={granularity}
              onVideoClick={handleVideoClick}
            />

            {/* Mid-page marketing CTA . placed after the stats so viewers have
                already engaged with the numbers before we pitch */}
            <LandingCTABanner
              variant="full"
              headline={`Track creators like @${account.username}`}
              body="Monitor any TikTok, Instagram, YouTube, or X account. Auto-sync videos, stats, and engagement in real time."
              buttonLabel="Start Free"
            />

            <PostingActivityHeatmap
              submissions={filteredSubmissions}
              onVideoClick={handleVideoClick}
              dateFilter={dateFilter}
              customDateRange={customDateRange}
            />

            <VideoSubmissionsTable
              submissions={filteredSubmissions}
              onVideoClick={handleVideoClick}
              headerTitle="Videos"
            />
          </div>

          {/* Footer CTA . final conversion touchpoint after they've scrolled through everything */}
          <div className="pt-12 pb-8">
            <LandingCTABanner variant="footer" />
            <p className="text-center text-xs text-content-muted mt-6">
              <a
                href="https://www.viewtrack.app"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-content transition-colors"
              >
                Powered by ViewTrack
              </a>
            </p>
          </div>
        </div>
      </main>

      {selectedVideo && (
        <VideoAnalyticsModal
          video={selectedVideo}
          isOpen={true}
          onClose={() => setSelectedVideo(null)}
          updateUrlOnOpen={false}
          showAiAnalysis={false}
          showLandingCTA={true}
        />
      )}
    </div>
  );
}
