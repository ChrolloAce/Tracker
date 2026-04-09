import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Flame,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Loader2,
} from 'lucide-react';
import ViralContentService, { PageFilters, SortField, SortDir } from '../services/ViralContentService';
import { ViralVideo } from '../types/viralContent';
import { useAuth } from '../contexts/AuthContext';
import SuperAdminService from '../services/SuperAdminService';
import VideoCard from './viral/VideoCard';
import SeedViralButton from './viral/SeedViralButton';

// ─── Platform icons ───────────────────────────────────────

const TikTokIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const InstagramIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const YouTubeIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

// ─── Constants ────────────────────────────────────────────

const PLATFORMS = [
  { id: 'all', name: 'All Platforms' },
  { id: 'tiktok', name: 'TikTok', icon: TikTokIcon },
  { id: 'instagram', name: 'Instagram', icon: InstagramIcon },
  { id: 'youtube', name: 'YouTube', icon: YouTubeIcon },
];

const CATEGORIES = [
  'All', 'Business & Finance', 'Health & Wellness', 'Fashion & Beauty',
  'Arts, Hobbies & Entertainment', 'Food & Cooking', 'Entertainment',
  'Education', 'Lifestyle', 'Comedy', 'Music', 'Sports', 'Tech',
  'Relationships & Lifestyle', 'Personal Development',
  'Education & Knowledge', 'Spirituality & Beliefs', 'Uncategorized',
];

type SortOption = 'recently_added' | 'latest_posted' | 'most_views' | 'most_likes';
type ContentTypeFilter = 'all' | 'video' | 'slideshow';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recently_added', label: 'Recently Added' },
  { value: 'latest_posted', label: 'Latest Posted' },
  { value: 'most_views', label: 'Most Views' },
  { value: 'most_likes', label: 'Most Likes' },
];

const CONTENT_TYPE_OPTIONS: { value: ContentTypeFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'video', label: 'Video Only' },
  { value: 'slideshow', label: 'Slideshow Only' },
];

// ─── Helpers ──────────────────────────────────────────────

const formatNumber = (num: number): string => {
  if (!num) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
};

const getPlatformIcon = (platform: string, className = 'w-4 h-4') => {
  switch (platform) {
    case 'instagram': return <InstagramIcon className={className} />;
    case 'tiktok':    return <TikTokIcon className={className} />;
    case 'youtube':   return <YouTubeIcon className={className} />;
    default:          return <Flame className={className} />;
  }
};

const PAGE_SIZE = 20;

/** Map UI sort options to Firestore sort field + direction */
const SORT_TO_FIRESTORE: Record<SortOption, { sortField: SortField; sortDir: SortDir }> = {
  recently_added: { sortField: 'order', sortDir: 'asc' },
  latest_posted:  { sortField: 'uploadDate', sortDir: 'desc' },
  most_views:     { sortField: 'views', sortDir: 'desc' },
  most_likes:     { sortField: 'likes', sortDir: 'desc' },
};

// ─── Main Page ────────────────────────────────────────────

type OpenDropdown = 'none' | 'filters' | 'sort';

const FREE_VISIBLE_COUNT = 4;

const ViralContentPage: React.FC<{ onRequiresPaidPlan?: (context: string) => boolean }> = ({ onRequiresPaidPlan }) => {
  const { user } = useAuth();
  const isSuperAdmin = SuperAdminService.isSuperAdmin(user?.email);

  // Current page data from the server (browse mode)
  const [pageVideos, setPageVideos] = useState<ViralVideo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search mode: all docs fetched for client-side filtering
  const [allVideos, setAllVideos] = useState<ViralVideo[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Filter / sort state
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>('none');
  const [sortBy, setSortBy] = useState<SortOption>('most_views');
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);

  // Debounce ref for search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce the search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // Track filter key so we know when to reset pagination
  const filterKeyRef = useRef('');

  // Build the current filter key (changes when any filter/sort changes)
  const filterKey = useMemo(() => {
    const { sortField, sortDir } = SORT_TO_FIRESTORE[sortBy];
    return [selectedPlatform, selectedCategory, contentTypeFilter, sortField, sortDir].join('|');
  }, [selectedPlatform, selectedCategory, contentTypeFilter, sortBy]);

  // Are we in search mode?
  const isSearchMode = debouncedSearch.length > 0;

  // Reset search page when search query or filters change
  useEffect(() => {
    setSearchPage(1);
  }, [debouncedSearch, selectedPlatform, selectedCategory, contentTypeFilter, sortBy]);

  // ── Fetch current page from server (browse mode only) ──
  useEffect(() => {
    // Skip server-side fetch when searching — search mode uses allVideos
    if (isSearchMode) return;

    let cancelled = false;

    // Detect if filters changed — if so, clear cache and reset to page 1
    const filtersChanged = filterKeyRef.current !== '' && filterKeyRef.current !== filterKey;
    filterKeyRef.current = filterKey;

    if (filtersChanged) {
      ViralContentService.clearCache();
      // If not already on page 1, reset — the page change will re-trigger this effect.
      // If already on page 1, fall through to fetch with the new filters immediately.
      if (currentPage !== 1) {
        setCurrentPage(1);
        return;
      }
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { sortField, sortDir } = SORT_TO_FIRESTORE[sortBy];
        const filters: PageFilters = {
          platform: selectedPlatform,
          category: selectedCategory,
          contentType: contentTypeFilter,
          sortField,
          sortDir,
        };
        const result = await ViralContentService.fetchPage(currentPage, PAGE_SIZE, filters);
        if (!cancelled) {
          setPageVideos(result.videos);
          setTotalCount(result.totalCount);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load content');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [currentPage, filterKey, selectedPlatform, selectedCategory, contentTypeFilter, sortBy, isSearchMode]);

  // ── Fetch all docs for search mode ─────────────────────
  useEffect(() => {
    if (!isSearchMode) return;

    let cancelled = false;

    // Only fetch if we haven't loaded allVideos yet
    if (allVideos === null) {
      setSearchLoading(true);
      setError(null);
      (async () => {
        try {
          const videos = await ViralContentService.fetchAllForSearch();
          if (!cancelled) {
            setAllVideos(videos);
            setSearchLoading(false);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Failed to load content for search');
            setSearchLoading(false);
          }
        }
      })();
    }

    return () => { cancelled = true; };
  }, [isSearchMode, allVideos]);

  // ── Client-side filtered + sorted results (search mode) ─
  const searchFilteredVideos = useMemo(() => {
    if (!isSearchMode || !allVideos) return [];

    const q = debouncedSearch.toLowerCase();

    // Step 1: text search
    let results = allVideos.filter((video) =>
      video.title?.toLowerCase().includes(q) ||
      video.uploaderHandle?.toLowerCase().includes(q) ||
      video.description?.toLowerCase().includes(q) ||
      video.tags?.some((t) => t.toLowerCase().includes(q)),
    );

    // Step 2: apply platform filter
    if (selectedPlatform && selectedPlatform !== 'all') {
      results = results.filter((v) => v.platform === selectedPlatform);
    }

    // Step 3: apply category filter
    if (selectedCategory && selectedCategory !== 'All') {
      results = results.filter((v) => v.category === selectedCategory);
    }

    // Step 4: apply content type filter
    if (contentTypeFilter && contentTypeFilter !== 'all') {
      results = results.filter((v) => v.contentType === contentTypeFilter);
    }

    // Step 5: apply sort
    const { sortField, sortDir } = SORT_TO_FIRESTORE[sortBy];
    results = [...results].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      // Handle Firestore Timestamp objects (uploadDate)
      const aComp = typeof aVal === 'object' && 'toMillis' in aVal ? (aVal as any).toMillis() : aVal;
      const bComp = typeof bVal === 'object' && 'toMillis' in bVal ? (bVal as any).toMillis() : bVal;
      if (aComp < bComp) return sortDir === 'asc' ? -1 : 1;
      if (aComp > bComp) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return results;
  }, [allVideos, debouncedSearch, selectedPlatform, selectedCategory, contentTypeFilter, sortBy, isSearchMode]);

  // ── Choose which videos to display ─────────────────────
  const displayVideos = useMemo(() => {
    if (isSearchMode) {
      // Client-side pagination of filtered search results
      const start = (searchPage - 1) * PAGE_SIZE;
      return searchFilteredVideos.slice(start, start + PAGE_SIZE);
    }
    return pageVideos;
  }, [isSearchMode, searchFilteredVideos, searchPage, pageVideos]);

  // ── Pagination math ────────────────────────────────────
  const totalFiltered = isSearchMode ? searchFilteredVideos.length : totalCount;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const activePage = isSearchMode ? searchPage : currentPage;
  const safePage = Math.min(activePage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const isLoading = isSearchMode ? searchLoading : loading;

  const activeFilterCount =
    (selectedPlatform !== 'all' ? 1 : 0) +
    (selectedCategory !== 'All' ? 1 : 0) +
    (contentTypeFilter !== 'all' ? 1 : 0);

  const toggleDropdown = (which: OpenDropdown) =>
    setOpenDropdown((prev) => (prev === which ? 'none' : which));

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Sort';

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === safePage) return;
    if (isSearchMode) {
      setSearchPage(page);
    } else {
      setCurrentPage(page);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Build page numbers: 1 … 4 5 [6] 7 8 … 85
  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('...');
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [safePage, totalPages]);

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Super-admin seed tool */}
      {isSuperAdmin && (
        <div className="flex items-center justify-between bg-surface-secondary border border-border rounded-xl px-4 py-3">
          <span className="text-xs text-content-muted">Admin: seed viral library from CSV</span>
          <SeedViralButton />
        </div>
      )}

      {/* Header: Search + Filters + Sort */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (onRequiresPaidPlan?.('to discover viral content')) return; }}
            placeholder="Search content, creators, hashtags..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-hover border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:border-border-strong text-sm"
          />
        </div>
          <span className="text-xs text-content-muted whitespace-nowrap">
            {totalFiltered.toLocaleString()} video{totalFiltered !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filters dropdown */}
          <div className="relative">
            <button
              onClick={() => { if (onRequiresPaidPlan?.('to discover viral content')) return; toggleDropdown('filters'); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-medium border ${
                openDropdown === 'filters' || activeFilterCount > 0
                  ? 'bg-surface-active border-border-strong text-content'
                  : 'bg-surface-hover border-border text-content-muted hover:bg-surface-active hover:text-content'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-0.5 w-5 h-5 bg-surface-active rounded-full text-xs flex items-center justify-center text-content">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'filters' ? 'rotate-180' : ''}`} />
            </button>

            {openDropdown === 'filters' && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-surface-secondary border border-border rounded-2xl shadow-2xl z-50 p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <FilterSection label="Platform">
                  {PLATFORMS.map((p) => {
                    const Icon = p.icon;
                    return (
                      <FilterButton key={p.id} active={selectedPlatform === p.id} onClick={() => setSelectedPlatform(p.id)}>
                        {Icon && <Icon className="w-4 h-4" />}
                        {p.name}
                      </FilterButton>
                    );
                  })}
                </FilterSection>

                <FilterSection label="Category">
                  <div className="max-h-40 overflow-y-auto space-y-1 scrollbar-hide">
                    {CATEGORIES.map((c) => (
                      <FilterButton key={c} active={selectedCategory === c} onClick={() => setSelectedCategory(c)}>
                        {c}
                      </FilterButton>
                    ))}
                  </div>
                </FilterSection>

                <FilterSection label="Content Type">
                  {CONTENT_TYPE_OPTIONS.map((o) => (
                    <FilterButton key={o.value} active={contentTypeFilter === o.value} onClick={() => setContentTypeFilter(o.value)}>
                      {o.label}
                    </FilterButton>
                  ))}
                </FilterSection>

                {activeFilterCount > 0 && (
          <button
                    onClick={() => { setSelectedPlatform('all'); setSelectedCategory('All'); setContentTypeFilter('all'); }}
                    className="w-full text-center py-2 text-xs text-content-muted hover:text-content transition-all"
          >
                    Reset All Filters
          </button>
        )}
      </div>
            )}
        </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => { if (onRequiresPaidPlan?.('to discover viral content')) return; toggleDropdown('sort'); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-medium border ${
                openDropdown === 'sort' || sortBy !== 'recently_added'
                  ? 'bg-surface-active border-border-strong text-content'
                  : 'bg-surface-hover border-border text-content-muted hover:bg-surface-active hover:text-content'
              }`}
            >
              <ArrowUpDown className="w-4 h-4" />
              {sortLabel}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'sort' ? 'rotate-180' : ''}`} />
            </button>

            {openDropdown === 'sort' && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-surface-secondary border border-border rounded-2xl shadow-2xl z-50 p-3 space-y-1">
                {SORT_OPTIONS.map((o) => (
          <button
                    key={o.value}
                    onClick={() => { setSortBy(o.value); setOpenDropdown('none'); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                      sortBy === o.value ? 'bg-surface-active text-content font-medium' : 'text-content-muted hover:bg-surface-hover hover:text-content'
            }`}
          >
                    {o.label}
          </button>
        ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Content Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-content-muted animate-spin" />
        </div>
      ) : displayVideos.length === 0 ? (
        <div className="rounded-2xl bg-surface-hover border border-border p-12 text-center">
          <div className="w-16 h-16 bg-surface-hover rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Flame className="w-8 h-8 text-content-muted" />
          </div>
          <h3 className="text-lg font-medium text-content mb-2">No viral content found</h3>
          <p className="text-content-muted text-sm max-w-sm mx-auto">
            {totalFiltered === 0 && !debouncedSearch
              ? 'The viral library is empty. Use the admin seed tool above to import content.'
              : 'Try adjusting your filters or search to find content.'}
          </p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {displayVideos.map((video, index) => {
              const globalIndex = startIdx + index;
              const isBlurred = !!onRequiresPaidPlan && globalIndex >= FREE_VISIBLE_COUNT;
              return isBlurred ? (
                <div
                  key={video.id}
                  className="relative cursor-pointer select-none"
                  onClick={() => onRequiresPaidPlan('to discover viral content')}
                >
                  <div className="pointer-events-none" style={{ filter: 'blur(8px)' }}>
                    <VideoCard
                      video={video}
                      getPlatformIcon={getPlatformIcon}
                      formatNumber={formatNumber}
                    />
                  </div>
                </div>
              ) : (
                <VideoCard
                  key={video.id}
                  video={video}
                  getPlatformIcon={getPlatformIcon}
                  formatNumber={formatNumber}
                />
              );
            })}
        </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-4 pb-2">
              <button
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage === 1}
                className="p-2 rounded-lg bg-surface-hover border border-border text-content-muted hover:bg-surface-active hover:text-content transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {pageNumbers.map((p, idx) =>
                p === '...' ? (
                  <span key={`dots-${idx}`} className="px-2 text-content-muted text-sm select-none">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all ${
                      p === safePage
                        ? 'bg-surface-active border border-border-strong text-content'
                        : 'bg-surface-hover border border-border text-content-muted hover:bg-surface-active hover:text-content'
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}

          <button
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage === totalPages}
                className="p-2 rounded-lg bg-surface-hover border border-border text-content-muted hover:bg-surface-active hover:text-content transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
                <ChevronRight className="w-4 h-4" />
          </button>

              <span className="ml-3 text-xs text-content-muted">
                Page {safePage} of {totalPages}
              </span>
            </div>
          )}
        </>
      )}

      {/* Click-away overlay */}
      {openDropdown !== 'none' && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown('none')} />
      )}
    </div>
  );
};

// ─── Reusable filter UI ──────────────────────────────────

const FilterSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
          <div>
    <label className="block text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">{label}</label>
    <div className="space-y-1">{children}</div>
          </div>
);

const FilterButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
            <button
    onClick={onClick}
    className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm transition-all ${
      active ? 'bg-surface-active text-content font-medium' : 'text-content-muted hover:bg-surface-hover hover:text-content'
    }`}
  >
    {children}
            </button>
  );

export default ViralContentPage;
