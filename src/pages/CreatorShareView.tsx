import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, Check, Plus, X, Loader2, AlertCircle, UserCircle2, RefreshCw, Banknote, ExternalLink, CheckCircle2 } from 'lucide-react';
import KPICards from '../components/KPICards';
import VideoSliderSection from '../components/VideoSliderSection';
import PostingActivityHeatmap from '../components/PostingActivityHeatmap';
import { VideoSubmissionsTable } from '../components/VideoSubmissionsTable';
import VideoAnalyticsModal from '../components/VideoAnalyticsModal';
import DateRangeFilter, { DateFilterType } from '../components/DateRangeFilter';
import DateFilterService from '../services/DateFilterService';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import { PlatformIcon } from '../components/ui/PlatformIcon';
import { UrlParserService } from '../services/UrlParserService';
import CreatorShareLinkService, { PublicCreatorShareData, CreatorPayoutSummary } from '../services/CreatorShareLinkService';
import { PRIORITY_COUNTRIES, OTHER_COUNTRIES } from '../data/stripe-countries';
import { VideoSubmission } from '../types';
import { TrackedAccount } from '../types/firestore';
import { Timestamp } from 'firebase/firestore';

/**
 * CreatorShareView . public, token-gated, single-creator dashboard.
 *
 * Route: /c/:token
 *
 * Forked from PublicSharePage but scoped to ONE creator's data, with all
 * org-wide ranking/leaderboard sections removed. Adds a "Submit video" button
 * that posts to the public submit endpoint.
 */

interface DateRange {
  startDate: Date;
  endDate: Date;
}

// ─── Adapter helpers (same shape as PublicSharePage so we can reuse dashboard components) ────

function toVideoSubmission(v: PublicCreatorShareData['videos'][number]): VideoSubmission {
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

function toTrackedAccount(a: PublicCreatorShareData['accounts'][number]): TrackedAccount {
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

// ─── Skeletons (copied from PublicSharePage) ───────────────────────────────

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

// ─── Submit Video Modal (public, token-auth) ────────────────────────────────
// Mirrors the paying-user AddVideoModal UX: bulk paste, chip display, multi-platform.
// Creator-selector and freeze-stats options are omitted intentionally — the share
// token identifies the creator, and creator-submitted videos must stay auto-refreshing.

interface SubmitVideoModalProps {
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (url: string, platform: string | null) => void;
}

interface ParsedVideo {
  url: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | null;
}

function parseUrlsFromText(text: string): ParsedVideo[] {
  if (!text.trim()) return [];
  const lines = text.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
  const videos: ParsedVideo[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const urlMatch = line.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : line;
    if (!url || seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    videos.push({ url, platform: UrlParserService.parseUrl(url).platform });
  }
  return videos;
}

function SubmitVideoModal({ token, isOpen, onClose, onSuccess }: SubmitVideoModalProps) {
  const [videos, setVideos] = useState<ParsedVideo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [failures, setFailures] = useState<{ url: string; error: string }[]>([]);
  // When true, all URLs submitted in this batch are the SAME video cross-posted to
  // different platforms. We assign them a shared crossPostGroupId on submit.
  const [isCrossPost, setIsCrossPost] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setVideos([]);
      setInputValue('');
      setUrlError(null);
      setSuccessCount(0);
      setFailures([]);
      setIsCrossPost(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const processInput = useCallback((text: string) => {
    setUrlError(null);
    const hasNewlines = text.includes('\n');
    if (hasNewlines) {
      const newVideos = parseUrlsFromText(text);
      if (newVideos.length > 0) {
        setVideos(prev => {
          const existing = new Set(prev.map(v => v.url.toLowerCase()));
          const unique = newVideos.filter(v => !existing.has(v.url.toLowerCase()));
          return [...prev, ...unique];
        });
        setInputValue('');
      } else {
        setInputValue(text);
      }
    } else {
      setInputValue(text);
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;
      const parsed = parseUrlsFromText(trimmed);
      if (parsed.length > 0) {
        setVideos(prev => {
          const existing = new Set(prev.map(v => v.url.toLowerCase()));
          const unique = parsed.filter(v => !existing.has(v.url.toLowerCase()));
          return [...prev, ...unique];
        });
        setInputValue('');
      }
    }
  }, [inputValue]);

  const removeVideo = useCallback((urlToRemove: string) => {
    setVideos(prev => prev.filter(v => v.url !== urlToRemove));
  }, []);

  const validVideos = useMemo(() => videos.filter(v => v.platform !== null), [videos]);
  const invalidVideos = useMemo(() => videos.filter(v => v.platform === null), [videos]);
  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of validVideos) {
      if (v.platform) counts[v.platform] = (counts[v.platform] || 0) + 1;
    }
    return counts;
  }, [validVideos]);

  const handleSubmit = async () => {
    // Flush any remaining text in the input into chips first.
    let allVideos = [...videos];
    if (inputValue.trim()) {
      const remaining = parseUrlsFromText(inputValue.trim());
      const existing = new Set(allVideos.map(v => v.url.toLowerCase()));
      const unique = remaining.filter(v => !existing.has(v.url.toLowerCase()));
      allVideos = [...allVideos, ...unique];
    }
    const toSubmit = allVideos.filter(v => v.platform !== null);
    if (toSubmit.length === 0) {
      setUrlError('Please paste at least one valid video URL');
      return;
    }

    setSubmitting(true);
    setUrlError(null);
    setFailures([]);
    setSuccessCount(0);

    // Submit sequentially so we respect per-token rate limits and surface per-URL errors.
    // If cross-post mode is on AND we have ≥2 valid URLs, generate one shared group id
    // that the API will attach to every resulting VideoDoc in this batch.
    const groupId = isCrossPost && toSubmit.length >= 2
      ? `xp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
      : undefined;
    const errs: { url: string; error: string }[] = [];
    let ok = 0;
    for (const v of toSubmit) {
      try {
        await CreatorShareLinkService.submitVideo(token, v.url, groupId ? { crossPostGroupId: groupId } : undefined);
        onSuccess(v.url, v.platform);
        ok += 1;
        setSuccessCount(ok);
      } catch (err: any) {
        errs.push({ url: v.url, error: err.message || 'Failed to submit' });
        setFailures([...errs]);
      }
    }

    setSubmitting(false);

    if (errs.length === 0) {
      setTimeout(() => onClose(), 1500);
    }
  };

  if (!isOpen) return null;

  const totalCount = validVideos.length;
  const isDone = !submitting && successCount > 0 && failures.length === 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-secondary rounded-[14px] w-full max-w-[620px] shadow-2xl" style={{ padding: '24px' }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-content mb-1">Submit Videos</h2>
            <p className="text-sm text-content-secondary">
              Paste video URLs — one per line or a block of links.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-content-secondary hover:text-content transition-colors p-1"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {isDone ? (
          <div className="flex flex-col items-center py-8">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-3">
              <Check className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-base font-semibold text-content mb-1">
              {successCount === 1 ? 'Video submitted' : `${successCount} videos submitted`}
            </h3>
            <p className="text-sm text-content-muted text-center">
              Queued for processing. They will appear here shortly.
            </p>
          </div>
        ) : (
          <>
            {/* Cross-post toggle — flag a batch of URLs as the same video across platforms */}
            <div className="mb-4 rounded-xl border border-border bg-surface-tertiary/60 p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-content">Are these the same video or different videos?</p>
                  <p className="text-[11px] text-content-muted mt-0.5 leading-snug">
                    Turn on cross-post mode if the links below are the <span className="font-semibold text-content">same video</span> posted to different platforms.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsCrossPost(false)}
                  disabled={submitting}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${
                    !isCrossPost
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-500/40 ring-2 ring-orange-500/20'
                      : 'bg-surface text-content-muted border-border hover:bg-surface-hover'
                  }`}
                >
                  <div className="font-bold mb-0.5">Multiple different videos</div>
                  <div className="text-[10px] font-normal opacity-80">Each link is a separate piece of content</div>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCrossPost(true)}
                  disabled={submitting}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${
                    isCrossPost
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-500/40 ring-2 ring-orange-500/20'
                      : 'bg-surface text-content-muted border-border hover:bg-surface-hover'
                  }`}
                >
                  <div className="font-bold mb-0.5">Same video, different platforms</div>
                  <div className="text-[10px] font-normal opacity-80">All links = one cross-posted video</div>
                </button>
              </div>
            </div>

            {/* Combined input field with inline icons */}
            <div
              ref={containerRef}
              onClick={() => inputRef.current?.focus()}
              className="bg-surface-tertiary border border-border rounded-xl overflow-hidden cursor-text mb-4 focus-within:ring-1 focus-within:ring-border-strong focus-within:border-border-strong transition-all"
            >
              <div className="max-h-[280px] overflow-y-auto p-1">
                {videos.map((video) => (
                  <div
                    key={video.url}
                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg mx-0.5 my-0.5 transition-colors ${
                      video.platform ? 'hover:bg-surface-hover' : 'bg-red-500/5'
                    }`}
                  >
                    <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                      {video.platform ? (
                        <PlatformIcon platform={video.platform} size="sm" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
                    </div>
                    <span className={`flex-1 truncate text-[13px] font-mono ${
                      video.platform ? 'text-content-secondary' : 'text-red-300'
                    }`}>
                      {video.url}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeVideo(video.url); }}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-surface-active transition-all"
                    >
                      <X className="w-3 h-3 text-content-muted hover:text-content-secondary" />
                    </button>
                  </div>
                ))}

                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => processInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={videos.length === 0
                    ? "Paste video URLs here — one per line...\n\nhttps://www.tiktok.com/t/example/\nhttps://www.instagram.com/reel/example/\nhttps://youtube.com/shorts/example"
                    : "Paste more URLs..."
                  }
                  rows={videos.length === 0 ? 6 : 2}
                  disabled={submitting}
                  className="w-full px-3 py-2 bg-transparent text-content placeholder-gray-600 focus:outline-none text-[13px] font-mono leading-relaxed resize-none disabled:opacity-50"
                />
              </div>
            </div>

            {/* Summary bar */}
            {videos.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-content-muted">
                    {totalCount} video{totalCount !== 1 ? 's' : ''} detected
                  </span>
                  <div className="flex items-center gap-2">
                    {Object.entries(platformCounts).map(([platform, count]) => (
                      <div key={platform} className="flex items-center gap-1 px-2 py-0.5 bg-surface-hover rounded-full">
                        <PlatformIcon platform={platform as any} size="sm" />
                        <span className="text-[11px] text-content-secondary font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {invalidVideos.length > 0 && (
                  <span className="text-[11px] text-red-400">
                    {invalidVideos.length} invalid
                  </span>
                )}
              </div>
            )}

            {urlError && (
              <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-red-300">{urlError}</span>
              </div>
            )}

            {/* Per-URL submission failures */}
            {failures.length > 0 && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-medium text-red-300">
                    {successCount > 0
                      ? `${successCount} submitted, ${failures.length} failed`
                      : `${failures.length} failed to submit`}
                  </span>
                </div>
                <ul className="space-y-1">
                  {failures.map((f, i) => (
                    <li key={i} className="text-[11px] text-red-300/90 font-mono truncate">
                      {f.url}: {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-content-muted text-xs">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Processing takes up to 5 minutes.</span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || (validVideos.length === 0 && !inputValue.trim())}
                className="px-5 py-2 text-sm font-bold text-white bg-orange-500 rounded-lg shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting {successCount + 1}/{totalCount}
                  </>
                ) : totalCount > 0 ? (
                  `Submit ${totalCount} Video${totalCount !== 1 ? 's' : ''}`
                ) : (
                  'Submit Videos'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── My payouts (public, read-only section on the creator portal) ─────────

/**
 * Stripe Connect onboarding banner — shown to the creator inside the public portal so they can
 * set up payouts before admins try to mark them paid. Fetches status on mount, re-fetches when
 * the URL returns from Stripe's hosted onboarding (?stripe=complete or ?stripe=refresh).
 *
 * UI states (all orange = action needed, emerald = all set):
 *   - none / pending — "Set up payments" CTA → opens Stripe onboarding in new tab
 *   - restricted    — "Action required" amber warning, same CTA reopens onboarding
 *   - complete      — green confirmation (subdued; no CTA)
 */
function StripeConnectBanner({ token }: { token: string }) {
  const [status, setStatus] = useState<'none' | 'pending' | 'restricted' | 'complete' | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Default to US since that's our largest creator geo. Only used for first-time account creation —
  // once the Stripe account exists, country is immutable and this state is ignored by the API.
  const [country, setCountry] = useState<string>('US');

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const res = await CreatorShareLinkService.fetchStripeStatus(token);
      setStatus(res.status);
    } catch (e: any) {
      // 503 means the server isn't configured for Stripe yet — don't spam the creator, just hide.
      if (/503|not configured|not available/i.test(String(e?.message))) {
        setStatus(null);
      } else {
        setError(e?.message || 'Failed to load payment setup');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // If we come back from Stripe's hosted onboarding (return_url includes ?stripe=complete),
  // re-fetch status and strip the query param so a second load doesn't loop.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe') === 'complete' || params.get('stripe') === 'refresh') {
      refresh();
      params.delete('stripe');
      const qs = params.toString();
      const url = window.location.pathname + (qs ? `?${qs}` : '');
      window.history.replaceState({}, '', url);
    }
  }, [refresh]);

  const startOnboarding = async () => {
    setStarting(true);
    setError(null);
    try {
      // Only send country on first-time creation (status === 'none'). Stripe locks country at
      // account create, so sending it on resume would be ignored anyway — but we omit for clarity.
      const { onboardingUrl } = await CreatorShareLinkService.startStripeOnboarding(
        token,
        status === 'none' ? country : undefined,
      );
      // New tab so the creator doesn't lose their portal state — return_url brings them back.
      window.open(onboardingUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e?.message || 'Failed to start onboarding');
    } finally {
      setStarting(false);
    }
  };

  if (loading || status === null) return null;

  if (status === 'complete') {
    return (
      <section className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-content">You're ready to receive payments</p>
          <p className="text-xs text-content-muted">When Maktub releases your earnings, they'll arrive in your bank in 1–2 business days.</p>
        </div>
      </section>
    );
  }

  const needsAttention = status === 'restricted';
  const showCountryPicker = status === 'none';

  return (
    <section className={`rounded-2xl border px-5 py-4 ${needsAttention ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-500/5 border-orange-500/20'}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
          {needsAttention ? <AlertCircle className="w-5 h-5" /> : <Banknote className="w-5 h-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-content">
            {needsAttention ? 'Stripe needs more info before you can be paid' :
             status === 'pending' ? 'Finish your payment setup' :
             'Set up payments to get paid'}
          </p>
          <p className="text-xs text-content-muted">
            {needsAttention
              ? 'Click below to resolve the outstanding items on your Stripe account.'
              : `Before Maktub can send you money, we need to verify your identity and bank info through Stripe. Takes about 2 minutes.`}
          </p>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
        {!showCountryPicker && (
          <button
            onClick={startOnboarding}
            disabled={starting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-orange-500 text-white shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
          >
            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            {needsAttention ? 'Resolve' : 'Continue'}
          </button>
        )}
      </div>

      {/* Country picker — only when creator hasn't started onboarding yet. Stripe locks country
           at account creation time, so this is a one-time decision the creator must make. */}
      {showCountryPicker && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-content-muted mb-1">
              Where do you live / where should payouts go?
            </label>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              disabled={starting}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <optgroup label="Most common">
                {PRIORITY_COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                ))}
              </optgroup>
              <optgroup label="Other supported countries">
                {OTHER_COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                ))}
              </optgroup>
            </select>
            <p className="text-[10px] text-content-muted mt-1">
              This determines the currency you'll be paid in and the tax forms you'll complete. It can't be changed later.
            </p>
          </div>
          <button
            onClick={startOnboarding}
            disabled={starting}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-orange-500 text-white shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
          >
            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            Set up
          </button>
        </div>
      )}
    </section>
  );
}

function MyPayoutsSection({ payouts }: { payouts: CreatorPayoutSummary[] }) {
  // Currency-aware money formatter — each payout can be in its own currency so we can't
  // bake `$` into the helper. Falls back to USD formatting on unknown currency codes.
  const fmtMoney = (n: number | null, currency: string = 'usd') => {
    if (n === null || n === undefined) return '—';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  // New action-oriented status copy. Short label (chip) + longer sub-message (under the chip)
  // so creators understand what's happening at each step without jargon. "Internal" labels like
  // campaign name + template name are deliberately NOT surfaced — those are Maktub business
  // info that doesn't help the creator understand their earnings.
  const statusChipCls: Record<CreatorPayoutSummary['status'], string> = {
    not_calculated: 'bg-surface-tertiary text-content-muted border border-border',
    pending:        'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30',
    approved:       'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30',
    paid:           'bg-emerald-500 text-white border border-emerald-500',
  };
  const statusLabel: Record<CreatorPayoutSummary['status'], string> = {
    not_calculated: 'Tracking earnings',
    pending:        'Being finalized',
    approved:       'Ready to pay out',
    paid:           'Paid',
  };
  const statusSubMessage: Record<CreatorPayoutSummary['status'], string> = {
    not_calculated: `We're tracking your videos. Your earnings will appear here once they're counted.`,
    pending:        `Your earnings are being finalized. Payment will be released once reviewed.`,
    approved:       `You're cleared for payment. Make sure your payment setup is complete so it can be released.`,
    paid:           `Payment was sent to your Stripe account. It should land in your bank within 1–2 business days.`,
  };

  // Total earned across all deals — group by currency so we don't mix USD and EUR into one bogus sum.
  const totalByCurrency = payouts.reduce<Record<string, number>>((acc, p) => {
    // Prefer the immutable paid amount where it exists; fall back to the live calc.
    const value = p.status === 'paid' ? (p.paidAmount ?? p.amount ?? 0) : (p.amount ?? 0);
    const cur = (p.currency || 'usd').toLowerCase();
    acc[cur] = (acc[cur] || 0) + value;
    return acc;
  }, {});
  const totalLines = Object.entries(totalByCurrency).map(([cur, sum]) => fmtMoney(sum, cur));

  return (
    <section className="rounded-2xl bg-surface-secondary border border-border-subtle shadow-theme overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Your earnings</p>
          <p className="font-semibold text-content">{payouts.length} active deal{payouts.length === 1 ? '' : 's'}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Total</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-500">
            {totalLines.length > 0 ? totalLines.join(' · ') : '—'}
          </p>
        </div>
      </div>
      <ul className="divide-y divide-border-subtle">
        {payouts.map(p => {
          // Paid creators see the FROZEN snapshot amount — that's the truth of what they were paid.
          // Everyone else sees the live-calc amount, which can still move as videos rack up views.
          const displayAmount = p.status === 'paid' ? (p.paidAmount ?? p.amount) : p.amount;
          return (
            <li key={p.campaignId} className="px-5 py-4 space-y-3">
              {/* Header row: status + earnings side-by-side, biggest visual element */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusChipCls[p.status]}`}>
                    {statusLabel[p.status]}
                  </span>
                  <p className="text-xs text-content-muted mt-1.5 leading-snug">{statusSubMessage[p.status]}</p>
                  {p.status === 'paid' && p.paidAt && (
                    <p className="text-[10px] text-content-muted mt-1">
                      Paid on {new Date(p.paidAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                  {p.note && <p className="text-[10px] text-content-muted italic mt-1">Note from Maktub: {p.note}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-2xl font-bold leading-tight ${p.status === 'paid' || p.status === 'approved' ? 'text-emerald-600 dark:text-emerald-500' : 'text-content'}`}>
                    {fmtMoney(displayAmount ?? null, p.currency)}
                  </p>
                </div>
              </div>

              {/* Deal breakdown — verbose human-readable bullets. Hides all internal structure
                  components, metric keys, etc. — creators see only the "how I earn" translation. */}
              {p.dealSummary && p.dealSummary.length > 0 && (
                <div className="rounded-xl bg-surface-tertiary/60 border border-border-subtle p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-content-muted mb-1.5">Your deal</p>
                  <ul className="space-y-1">
                    {p.dealSummary.map((line, i) => (
                      <li key={i} className="text-xs text-content-secondary flex gap-2">
                        <span className="text-orange-500 font-bold flex-shrink-0">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Calculation breakdown — exact math, component by component. Shown for every status
                  except `paid` (where the frozen amount is what matters, not the live calc). */}
              {p.status !== 'paid' && p.breakdown && p.breakdown.length > 0 && (
                <div className="rounded-xl bg-surface-tertiary/60 border border-border-subtle p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-content-muted mb-2">How your earnings were calculated</p>
                  <ul className="space-y-1.5">
                    {p.breakdown.map((b, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-semibold uppercase text-content-muted">{b.typeLabel}</span>
                            <span className="font-medium text-content">{b.componentName}</span>
                          </div>
                          <p className="text-content-muted mt-0.5 leading-snug">{b.details}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {b.wasCapped && <p className="text-[9px] text-content-muted italic">capped from {fmtMoney(b.originalAmount ?? 0, p.currency)}</p>}
                          <p className="font-bold text-content">{fmtMoney(b.amount, p.currency)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {/* Gross / paid / net summary — only when prior payouts exist (otherwise gross == net and this is noise). */}
                  {typeof p.grossAmount === 'number' && (p.priorPayouts?.length ?? 0) > 0 && (
                    <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-border-subtle">
                      <div className="text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">Gross</p>
                        <p className="text-sm font-bold text-content mt-0.5">{fmtMoney(p.grossAmount, p.currency)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">Already paid</p>
                        <p className="text-sm font-bold text-content-secondary mt-0.5">−{fmtMoney((p.priorPayouts || []).reduce((s, x) => s + x.amount, 0) + (p.paidAmount || 0), p.currency)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">Still owed</p>
                        <p className="text-sm font-bold text-orange-600 dark:text-orange-400 mt-0.5">{fmtMoney(p.netOwed ?? 0, p.currency)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Prior payouts — transparency into what the creator has already been paid for this campaign. */}
              {p.priorPayouts && p.priorPayouts.length > 0 && (
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-300/40 dark:border-emerald-500/25 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
                    Payments you've received
                  </p>
                  <ul className="space-y-1.5">
                    {p.priorPayouts.map(pp => (
                      <li key={pp.id} className="flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-content">{fmtMoney(pp.amount, pp.currency)}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-surface-tertiary text-content-secondary border border-border">
                              {pp.method}
                            </span>
                          </div>
                          <p className="text-[10px] text-content-muted mt-0.5">
                            {new Date(pp.paidAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            {' · based on '}{pp.metricsAtPayout.views.toLocaleString()} views
                            {pp.metricsAtPayout.videoCount !== undefined && `, ${pp.metricsAtPayout.videoCount} videos`}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function CreatorShareView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicCreatorShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoSubmission | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [payouts, setPayouts] = useState<CreatorPayoutSummary[]>([]);

  // Processing state . combines two sources:
  //   1. localPlaceholders: temporary video stubs injected immediately after
  //      submit so the shimmer card shows without waiting for Firestore
  //   2. serverPendingJobs: pending/running syncQueue jobs returned by the API
  //      (covers admin-submitted videos . no local submit needed)
  //
  // Polling strategy (efficient):
  //   - Tab hidden: no polling at all
  //   - Tab visible, idle: poll every 60s (catches admin submissions within ~1min)
  //   - Tab visible, processing: poll every 10s (responsive feedback)
  const [localPlaceholders, setLocalPlaceholders] = useState<VideoSubmission[]>([]);
  const [serverPendingJobs, setServerPendingJobs] = useState(0);
  const [lastKnownVideoCount, setLastKnownVideoCount] = useState<number | null>(null);
  const [tabVisible, setTabVisible] = useState(!document.hidden);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [manualGranularity, setManualGranularity] = useState<'day' | 'week' | 'month' | 'year' | null>(null);
  const [platformFilter, setPlatformFilter] = useState<('instagram' | 'tiktok' | 'youtube' | 'twitter')[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);

  // Track tab visibility so we can pause polling when hidden
  useEffect(() => {
    const handler = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  const load = useCallback((silent?: boolean) => {
    if (!token) return;
    if (!silent) setLoading(true);
    // Fetch payouts in parallel with the main share data — small payload, no need to block the page.
    CreatorShareLinkService.fetchPayouts(token)
      .then(({ payouts }) => setPayouts(payouts))
      .catch(err => console.warn('Payouts fetch failed (non-fatal):', err));

    CreatorShareLinkService.fetchPublic(token)
      .then((result) => {
        setData(result);
        setServerPendingJobs(result.pendingJobs || 0);
        // When real videos arrive, remove placeholders that match by URL
        if (localPlaceholders.length > 0) {
          const realUrls = new Set(result.videos.map(v => v.url.toLowerCase()));
          setLocalPlaceholders(prev => prev.filter(p => !realUrls.has(p.url.toLowerCase())));
        }
        // Also clear any leftover placeholders once server confirms no more pending jobs
        // and video count has grown since we submitted
        if (lastKnownVideoCount !== null && result.videos.length > lastKnownVideoCount && result.pendingJobs === 0) {
          setLocalPlaceholders([]);
        }
        setLastKnownVideoCount(result.videos.length);
      })
      .catch((err) => { if (!silent) setError(err.message || 'Failed to load'); })
      .finally(() => { if (!silent) setLoading(false); });
  }, [token, lastKnownVideoCount, localPlaceholders.length]);

  // Initial load
  useEffect(() => {
    load();
  }, [token]);

  // Two-tier polling: fast (10s) when processing, slow (15s) when idle.
  // 15s idle catches admin-submitted videos quickly without heavy load.
  // Paused entirely when the browser tab is hidden.
  const isProcessing = localPlaceholders.length > 0 || serverPendingJobs > 0;
  useEffect(() => {
    if (!tabVisible) return; // no polling when tab is hidden
    const interval = isProcessing ? 10000 : 15000;
    const timer = setInterval(() => load(true), interval);
    return () => clearInterval(timer);
  }, [isProcessing, tabVisible, load]);

  // When the tab becomes visible again after being hidden, do an immediate refresh
  // so the creator doesn't stare at stale data.
  useEffect(() => {
    if (tabVisible && data) {
      load(true);
    }
  }, [tabVisible]);

  const handleVideoSubmitted = useCallback((submittedUrl: string, platform: string | null) => {
    // Inject a placeholder video immediately so the shimmer card appears
    // without waiting for the API round-trip / Apify processing.
    const placeholder: VideoSubmission & { isLoading: boolean } = {
      id: `placeholder-${Date.now()}`,
      url: submittedUrl,
      platform: (platform || 'tiktok') as VideoSubmission['platform'],
      thumbnail: '', // empty = triggers shimmer card in VideoSliderSection
      title: '',
      caption: '',
      uploader: '',
      uploaderHandle: '',
      uploaderProfilePicture: '',
      followerCount: 0,
      trackedAccountId: '',
      status: 'approved',
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      duration: 0,
      dateSubmitted: new Date(),
      uploadDate: new Date(),
      isLoading: true, // triggers shimmer row in VideoSubmissionsTable
    };
    setLocalPlaceholders(prev => [...prev, placeholder]);
  }, []);

  const handleDateFilterChange = (filter: DateFilterType, range?: DateRange) => {
    setDateFilter(filter);
    setCustomDateRange(range);
  };

  const allSubmissions: VideoSubmission[] = useMemo(() => {
    if (!data) return [];
    const real = data.videos.map(toVideoSubmission);
    // Append local placeholders (shimmer cards) for videos just submitted
    // that haven't appeared in the API response yet
    return [...real, ...localPlaceholders];
  }, [data, localPlaceholders]);

  const accounts: TrackedAccount[] = useMemo(() => {
    if (!data) return [];
    return data.accounts.map(toTrackedAccount);
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

  const submissionsWithoutDateFilter = useMemo(() => {
    let filtered = allSubmissions;
    if (platformFilter.length > 0) {
      filtered = filtered.filter(v => platformFilter.includes(v.platform as any));
    }
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

  const filteredSubmissions = useMemo(() => {
    return DateFilterService.filterVideosByDateRange(
      submissionsWithoutDateFilter,
      dateFilter,
      customDateRange,
      true
    );
  }, [submissionsWithoutDateFilter, dateFilter, customDateRange]);

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
          <KPICardsSkeleton />
          <ChartSkeleton />
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-xl text-content mb-2">Link not found</p>
          <p className="text-content-muted text-sm">{error || 'This share link is invalid, revoked, or has expired.'}</p>
        </div>
      </div>
    );
  }

  const { creator, acceptSubmissions } = data;

  return (
    <div className="min-h-screen bg-surface text-content">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-surface-secondary border-b border-border z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 h-16 md:h-[72px] flex items-center justify-between gap-3">
          {/* Creator identity */}
          <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
            {creator.photoURL ? (
              <img
                src={creator.photoURL}
                alt={creator.displayName}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-surface-tertiary flex items-center justify-center flex-shrink-0">
                <UserCircle2 className="w-5 h-5 text-content-muted" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-bold text-content truncate">{creator.displayName}</h1>
              <p className="text-[11px] text-content-muted truncate">Creator Dashboard</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {accounts.length > 1 && (
              <div className="hidden lg:block">
                <MultiSelectDropdown
                  options={accountOptions}
                  selectedIds={selectedAccountIds}
                  onChange={setSelectedAccountIds}
                  placeholder="All Accounts"
                />
              </div>
            )}

            <div className="relative hidden sm:block">
              <button
                onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
                onBlur={() => setTimeout(() => setPlatformDropdownOpen(false), 200)}
                className="flex items-center gap-2 pl-3 pr-8 py-2 bg-surface-secondary text-content rounded-lg text-sm font-medium border border-border hover:border-border-strong focus:outline-none transition-all cursor-pointer min-w-[140px]"
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
                          setPlatformFilter(prev => isSelected ? prev.filter(x => x !== p.value) : [...prev, p.value]);
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

          </div>
        </div>
      </header>

      {/* Main */}
      <main className="overflow-auto min-h-screen pt-16 md:pt-24" style={{ overflowX: 'hidden', overflowY: 'auto' }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-8" style={{ overflow: 'visible' }}>
          <div className="space-y-6">
            {/* Stripe Connect onboarding — gated by both (a) the admin's per-creator
                `payoutPortalEnabled` toggle AND (b) at least one non-draft payout, so creators
                without approved earnings don't see "set up payments" prompts out of nowhere. */}
            {data?.creator.payoutsVisible && payouts.length > 0 && token && <StripeConnectBanner token={token} />}
            {/* My payouts — same gate. Admin-disabled creators never see this section at all
                (the payouts API returns an empty array for them, but we double-gate in the UI
                just in case the API response was cached from a prior allowed state). */}
            {data?.creator.payoutsVisible && payouts.length > 0 && <MyPayoutsSection payouts={payouts} />}

            <VideoSliderSection
              videos={submissionsWithoutDateFilter}
              maxVideos={20}
              onVideoClick={handleVideoClick}
            />

            <KPICards
              submissions={filteredSubmissions}
              allSubmissions={submissionsWithoutDateFilter}
              accounts={accounts}
              dateFilter={dateFilter}
              customRange={customDateRange}
              granularity={granularity}
              onVideoClick={handleVideoClick}
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

          <div className="pt-8 pb-8">
            <p className="text-center text-xs text-content-muted">
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

      {/* Submit FAB . only when the link accepts submissions */}
      {acceptSubmissions && (
        <button
          onClick={() => setShowSubmitModal(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-500 text-white shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all z-40"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-semibold">Submit Video</span>
        </button>
      )}

      {selectedVideo && (
        <VideoAnalyticsModal
          video={selectedVideo}
          isOpen={true}
          onClose={() => setSelectedVideo(null)}
          updateUrlOnOpen={false}
          showAiAnalysis={false}
        />
      )}

      {token && (
        <SubmitVideoModal
          token={token}
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          onSuccess={handleVideoSubmitted}
        />
      )}
    </div>
  );
}
