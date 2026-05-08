import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Heart, MessageCircle, Play, Loader2, ArrowUpDown, Check } from 'lucide-react';
import { VideoSubmission } from '../types';
import { ProxiedImage } from './ProxiedImage';

// Platform icons
import instagramIcon from '/Instagram_icon.png';
import tiktokIcon from '/TiktokLogo.png';
import youtubeIcon from '/Youtube_shorts_icon.svg.png';
import xLogo from '/twitter-x-logo.png';

interface VideoSliderSectionProps {
  videos: VideoSubmission[];
  /** Hard ceiling on how many videos can be rendered. Defaults to all
   *  (no cap) — set to a finite number when a caller wants a fixed top-N
   *  slider. */
  maxVideos?: number;
  /** Initial batch size + how many cards to reveal per lazy-load tick when
   *  the user scrolls near the right edge. Defaults to 20. */
  pageSize?: number;
  onVideoClick?: (video: VideoSubmission) => void;
  /** Skip the built-in views/likes sort and render videos in the order given. */
  preserveOrder?: boolean;
  /** Optional sort dropdown rendered inside the slider header. Lets the
   *  parent control the sort state (so the underlying video list is sorted
   *  upstream, then handed to the slider with `preserveOrder`). */
  sortControl?: {
    value: string;
    label: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
  };
  /** Number of skeleton "processing" cards to render after real videos */
  pendingCount?: number;
}

/**
 * VideoSliderSection - Full-height social media style video slider
 * Displays videos sorted by views (highest to lowest)
 */
const VideoSliderSection: React.FC<VideoSliderSectionProps> = ({
  videos,
  maxVideos = Infinity,
  pageSize = 20,
  onVideoClick,
  preserveOrder = false,
  sortControl,
  pendingCount = 0
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  // Blur/sensor toggle removed per user request — videos render unblurred
  // unconditionally now. The `isBlurred` flag is kept as a const-false so
  // VideoCard's per-card `isBlurred` prop continues to compile cleanly.
  const isBlurred = false;

  // Internal sort state — used when the parent doesn't supply an external
  // `sortControl` and `preserveOrder` is false. Default 'views' preserves
  // the prior "most viewed first" behavior of the slider so existing call
  // sites don't change shape.
  type SortKey = 'views' | 'recent' | 'likes' | 'comments' | 'engagement';
  const [internalSort, setInternalSort] = useState<SortKey>('views');
  const INTERNAL_SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
    { value: 'views', label: 'Most viewed' },
    { value: 'recent', label: 'Most recent' },
    { value: 'likes', label: 'Most liked' },
    { value: 'comments', label: 'Most commented' },
    { value: 'engagement', label: 'Highest engagement' },
  ];

  // Effective sort control: parent-supplied wins (existing API), otherwise
  // wire the InlineSortButton up to the internal state. Hidden entirely when
  // `preserveOrder` is true since the parent has explicitly asked the slider
  // not to reorder.
  const effectiveSortControl = sortControl ?? (preserveOrder ? null : {
    value: internalSort,
    label: INTERNAL_SORT_OPTIONS.find(o => o.value === internalSort)?.label || 'Most viewed',
    options: INTERNAL_SORT_OPTIONS as Array<{ value: string; label: string }>,
    onChange: (v: string) => setInternalSort(v as SortKey),
  });

  // Build the displayed list. When the parent has externally sorted (sortControl
  // provided OR preserveOrder true), we don't re-sort. Otherwise we apply the
  // internal sort key.
  const applyInternalSort = (list: VideoSubmission[]): VideoSubmission[] => {
    const cmp: Record<SortKey, (a: VideoSubmission, b: VideoSubmission) => number> = {
      views: (a, b) => (b.views || 0) - (a.views || 0),
      likes: (a, b) => (b.likes || 0) - (a.likes || 0),
      comments: (a, b) => (b.comments || 0) - (a.comments || 0),
      engagement: (a, b) => {
        const er = (v: VideoSubmission) => (v.views || 0) > 0
          ? (((v.likes || 0) + (v.comments || 0)) / (v.views || 1))
          : 0;
        return er(b) - er(a);
      },
      recent: (a, b) => {
        const t = (v: VideoSubmission) => new Date(v.uploadDate || v.dateSubmitted || 0).getTime();
        return t(b) - t(a);
      },
    };
    return [...list].sort(cmp[internalSort]);
  };

  const fullSorted = preserveOrder
    ? [...videos]
    : sortControl
      ? [...videos] // parent already sorted upstream — preserve order
      : applyInternalSort(videos);

  const totalAvailable = Math.min(fullSorted.length, maxVideos);

  // Lazy-load: render the first `pageSize` cards, reveal more as the user
  // scrolls near the right edge. Reset whenever the source list changes
  // (filter swap) or the sort key changes — both of those mean the user is
  // looking at a different ranked sequence and should start fresh from the
  // beginning.
  const [visibleCount, setVisibleCount] = useState(() => Math.min(pageSize, totalAvailable));
  const sortKey = sortControl ? `ext:${sortControl.value}` : `int:${internalSort}`;
  useEffect(() => {
    setVisibleCount(Math.min(pageSize, totalAvailable));
  }, [videos, sortKey, pageSize, totalAvailable]);

  const sortedVideos = fullSorted.slice(0, Math.min(visibleCount, maxVideos));

  // Debug: Log what videos the slider is receiving
  console.log('🎬 VideoSlider received:', videos.length, 'videos, showing top', sortedVideos.length);
  if (sortedVideos.length > 0) {
    console.log('🎬 Top video:', sortedVideos[0]?.title || sortedVideos[0]?.caption, '-', sortedVideos[0]?.views, 'views');
    console.log('🖼️ Top video thumbnail URL:', sortedVideos[0]?.thumbnail);
    // Log first 3 thumbnail URLs for debugging
    sortedVideos.slice(0, 3).forEach((v, i) => {
      console.log(`🖼️ Video ${i + 1} thumbnail:`, v.thumbnail ? v.thumbnail.substring(0, 100) + '...' : 'MISSING');
    });
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case 'instagram': return instagramIcon;
      case 'tiktok': return tiktokIcon;
      case 'youtube': return youtubeIcon;
      case 'twitter': return xLogo;
      default: return null;
    }
  };

  // "Posted Xd ago" — short relative-time label shown on every card. Mirrors
  // the TikTok/IG mental model: today / 1d / 5d / 3w / 2mo / 1y. Falls back
  // gracefully when the video has no upload date (returns null → pill hides).
  const formatRelativeTime = (input?: Date | string | { toDate?: () => Date }): string | null => {
    if (!input) return null;
    let d: Date;
    if (input instanceof Date) d = input;
    else if (typeof input === 'object' && typeof (input as any).toDate === 'function') d = (input as any).toDate();
    else d = new Date(input as any);
    if (isNaN(d.getTime())) return null;
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) return 'just now';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 1) return 'today';
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Reveal the next batch of cards when the user is within ~600px of the
  // right edge. 600px ≈ 3 cards at the current 200px width — enough lead
  // time that the new cards are mounted before the user catches up to them,
  // so the experience feels like one continuous list, not paginated.
  const NEAR_END_PX = 600;
  const maybeLoadMore = () => {
    if (visibleCount >= totalAvailable) return;
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    if (scrollLeft + clientWidth >= scrollWidth - NEAR_END_PX) {
      setVisibleCount(c => Math.min(c + pageSize, totalAvailable));
    }
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(
      scrollLeft < scrollWidth - clientWidth - 10 || visibleCount < totalAvailable,
    );
    maybeLoadMore();
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    if (direction === 'right') maybeLoadMore();
    const scrollAmount = 300;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  if (sortedVideos.length === 0 && pendingCount === 0) {
    return (
      <div className="bg-surface-secondary backdrop-blur rounded-2xl border border-border p-8 text-center">
        <Play className="w-12 h-12 text-content-muted mx-auto mb-3" />
        <h3 className="text-base font-semibold text-content mb-1">No videos match your filters</h3>
        <p className="text-content-secondary text-sm">Try adjusting the date range or filters to see your top videos.</p>
      </div>
    );
  }

  return (
    <div className="relative group">
      {/* Top-right control cluster — Sort. Renders whenever the slider is
          ordering its own content (i.e. not in `preserveOrder` mode), with
          either the parent-supplied control or the slider's internal state. */}
      {effectiveSortControl && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          <InlineSortButton sort={effectiveSortControl} />
        </div>
      )}

      {/* Left Arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/80 hover:bg-black border border-border-strong rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-xl"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Right Arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/80 hover:bg-black border border-border-strong rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-xl"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Videos Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {sortedVideos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            platformIcon={getPlatformIcon(video.platform)}
            formatNumber={formatNumber}
            postedLabel={formatRelativeTime(video.uploadDate || video.dateSubmitted)}
            onClick={() => onVideoClick?.(video)}
            isBlurred={isBlurred}
          />
        ))}
      </div>

      {/* Hide scrollbar + shimmer animation */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .shimmer-bar {
          background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.06) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
};

// Individual Video Card
const VideoCard: React.FC<{
  video: VideoSubmission;
  platformIcon: string | null;
  formatNumber: (num: number) => string;
  /** Short relative-time string (e.g. "5d ago", "2w ago"). Null when the
   *  video has no usable upload date — the pill simply hides in that case. */
  postedLabel?: string | null;
  onClick?: () => void;
  isBlurred?: boolean;
}> = ({ video, platformIcon, formatNumber, postedLabel, onClick, isBlurred }) => {
  const [imageError, setImageError] = useState(false);
  const isProcessing = !video.thumbnail || imageError;

  return (
    <div
      className={`flex-shrink-0 w-[200px] group/card`}
    >
      {/* Video Container - 9:16 Aspect Ratio */}
      <div
        onClick={isProcessing ? undefined : onClick}
        className={`relative rounded-2xl overflow-hidden bg-surface-tertiary border transition-all duration-300 ${
          isProcessing
            ? 'border-border'
            : `border-border ${onClick ? 'cursor-pointer' : ''} hover:border-border-strong hover:scale-[1.02] hover:shadow-2xl`
        }`}
        style={{ aspectRatio: '9/16' }}
      >
        {/* Thumbnail — or processing spinner when thumbnail hasn't arrived yet */}
        {!isProcessing ? (
          <img
            src={video.thumbnail}
            alt={video.title || 'Video'}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => {
              console.error('❌ Failed to load thumbnail:', video.thumbnail?.substring(0, 100));
              setImageError(true);
            }}
            onLoad={() => console.log('✅ Loaded thumbnail for:', video.title?.substring(0, 30))}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-surface-tertiary to-surface-secondary flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
            </div>
            <p className="text-xs font-medium text-content-muted">Processing...</p>
            <p className="text-[10px] text-content-muted">Up to 5 min</p>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Platform Badge - Top Left */}
        {platformIcon && (
          <div className="absolute top-3 left-3">
            <img src={platformIcon} alt={video.platform} className="w-6 h-6 object-contain drop-shadow-lg" />
          </div>
        )}

        {/* Posted-time pill — top right. Mirrors the TikTok/IG date label
            position so admins can scan recency without opening the modal.
            Hidden when the video has no usable upload date. */}
        {!isProcessing && postedLabel && (
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm">
            <span className="text-[10px] font-semibold text-white drop-shadow-sm whitespace-nowrap">
              {postedLabel}
            </span>
          </div>
        )}

        {/* Stats on Right Side - Vertical (Social Media Style) */}
        <div className="absolute right-2 bottom-20 flex flex-col items-center gap-3">
          {isProcessing ? (
            /* Shimmer bars replacing stat numbers */
            <>
              <div className="flex flex-col items-center">
                <Eye className="w-5 h-5 text-white/30" />
                <div className="h-2.5 w-6 mt-1 rounded-full shimmer-bar" />
              </div>
              <div className="flex flex-col items-center">
                <Heart className="w-5 h-5 text-white/30" />
                <div className="h-2.5 w-5 mt-1 rounded-full shimmer-bar" />
              </div>
              <div className="flex flex-col items-center">
                <MessageCircle className="w-5 h-5 text-white/30" />
                <div className="h-2.5 w-4 mt-1 rounded-full shimmer-bar" />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center">
                <Eye className="w-5 h-5 text-white drop-shadow-lg" />
                <span className="text-white text-[10px] font-bold mt-0.5 drop-shadow-lg">{formatNumber(video.views || 0)}</span>
              </div>
              <div className="flex flex-col items-center">
                <Heart className="w-5 h-5 text-white drop-shadow-lg" />
                <span className="text-white text-[10px] font-bold mt-0.5 drop-shadow-lg">{formatNumber(video.likes || 0)}</span>
              </div>
              <div className="flex flex-col items-center">
                <MessageCircle className="w-5 h-5 text-white drop-shadow-lg" />
                <span className="text-white text-[10px] font-bold mt-0.5 drop-shadow-lg">{formatNumber(video.comments || 0)}</span>
              </div>
            </>
          )}
        </div>

        {/* Hover affordance: subtle dim only — no overlay pill (the whole
            card is clickable; the dim signals interactivity). */}
        {!isProcessing && (
          <div className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity bg-black/15 pointer-events-none" />
        )}

        {/* Bottom Info */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {isProcessing ? (
            /* Shimmer placeholders for uploader + caption */
            <>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-full shimmer-bar flex-shrink-0" />
                <div className="h-3 w-20 rounded-full shimmer-bar" />
              </div>
              <div className="space-y-1.5">
                <div className="h-2.5 w-full rounded-full shimmer-bar" />
                <div className="h-2.5 w-2/3 rounded-full shimmer-bar" />
              </div>
            </>
          ) : (
            <>
              {/* Uploader */}
              <div className="flex items-center gap-2 mb-1.5">
                {video.uploaderProfilePicture ? (
                  <ProxiedImage
                    src={video.uploaderProfilePicture}
                    alt={video.uploaderHandle || 'Creator'}
                    className="w-7 h-7 rounded-full object-cover ring-2 ring-white/30"
                    fallback={
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-white/30">
                        {(video.uploaderHandle || 'U').charAt(0).toUpperCase()}
                      </div>
                    }
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-white/30">
                    {(video.uploaderHandle || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-white text-sm font-semibold truncate flex-1">
                  @{video.uploaderHandle || 'unknown'}
                </span>
              </div>

              {/* Caption/Description */}
              <p className="text-white/80 text-xs line-clamp-2 leading-relaxed drop-shadow-lg">
                {video.caption || video.title || 'No caption'}
              </p>
            </>
          )}
        </div>

        {/* Blur Overlay - per card */}
        {isBlurred && (
          <div className="absolute inset-0 z-10 rounded-2xl" style={{ backdropFilter: 'blur(6px) saturate(1.2)' }} />
        )}
      </div>
    </div>
  );
};

/**
 * Compact white-pill sort button rendered inside the slider's top-right
 * control cluster. Always visible (not hover-gated) so it's discoverable.
 */
const InlineSortButton: React.FC<{
  sort: NonNullable<VideoSliderSectionProps['sortControl']>;
}> = ({ sort }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);
  const activeLabel = sort.options.find(o => o.value === sort.value)?.label || sort.label;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-white text-black border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
        title="Sort videos"
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
        Sort: {activeLabel}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-lg bg-white border border-gray-200 shadow-xl z-50 overflow-hidden">
          {sort.options.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                sort.onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left ${
                sort.value === opt.value ? 'bg-gray-100 text-black' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{opt.label}</span>
              {sort.value === opt.value && <Check className="w-3.5 h-3.5 text-black" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoSliderSection;

