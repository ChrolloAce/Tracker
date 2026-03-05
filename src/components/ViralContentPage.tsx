import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Flame, 
  Search,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpDown,
  Loader2,
} from 'lucide-react';
import ViralContentService, { ViralFetchResult } from '../services/ViralContentService';
import { ViralVideo } from '../types/viralContent';
import { useAuth } from '../contexts/AuthContext';
import SuperAdminService from '../services/SuperAdminService';
import VideoCard from './viral/VideoCard';
import SeedViralButton from './viral/SeedViralButton';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

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

const PAGE_SIZE = 48;

// ─── Main Page ────────────────────────────────────────────

type OpenDropdown = 'none' | 'filters' | 'sort';

const ViralContentPage: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = SuperAdminService.isSuperAdmin(user?.email);

  // Filter / sort state
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>('none');
  const [sortBy, setSortBy] = useState<SortOption>('recently_added');
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>('all');

  // Data state
  const [allVideos, setAllVideos] = useState<ViralVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch a page from Firestore ────────────────────────
  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (reset) {
    setLoading(true);
        setAllVideos([]);
        setLastDoc(null);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const result: ViralFetchResult = await ViralContentService.fetchPage({
          sortBy,
          pageSize: PAGE_SIZE,
          lastDoc: reset ? null : lastDoc,
        });

        setAllVideos((prev) => (reset ? result.videos : [...prev, ...result.videos]));
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      } catch (err) {
        console.error('Failed to load viral content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
        setLoadingMore(false);
      }
    },
    [sortBy, lastDoc],
  );

  // Initial load + reload when sort changes
  useEffect(() => {
    fetchPage(true);
    ViralContentService.getTotalCount()
      .then(setTotalCount)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  // ── Client-side filtering ──────────────────────────────
  const filteredVideos = useMemo(() => {
    return allVideos.filter((video) => {
      const matchPlatform = selectedPlatform === 'all' || video.platform === selectedPlatform;
      const matchCategory = selectedCategory === 'All' || video.category === selectedCategory;
      const matchType = contentTypeFilter === 'all' || video.contentType === contentTypeFilter;
      const matchSearch =
        !searchQuery ||
        video.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.uploaderHandle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchPlatform && matchCategory && matchType && matchSearch;
    });
  }, [allVideos, selectedPlatform, selectedCategory, contentTypeFilter, searchQuery]);

  const activeFilterCount =
    (selectedPlatform !== 'all' ? 1 : 0) +
    (selectedCategory !== 'All' ? 1 : 0) +
    (contentTypeFilter !== 'all' ? 1 : 0);

  const toggleDropdown = (which: OpenDropdown) =>
    setOpenDropdown((prev) => (prev === which ? 'none' : which));

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Sort';

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Super-admin seed tool ── */}
      {isSuperAdmin && (
        <div className="flex items-center justify-between bg-white/[0.02] border border-white/10 rounded-xl px-4 py-3">
          <span className="text-xs text-gray-500">Admin: seed viral library from CSV</span>
          <SeedViralButton />
        </div>
      )}

      {/* ── Header: Search + Filters + Sort ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search content, creators, hashtags..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/20 text-sm"
          />
        </div>
          {totalCount !== null && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {totalCount.toLocaleString()} videos
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filters dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('filters')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-medium border ${
                openDropdown === 'filters' || activeFilterCount > 0
                  ? 'bg-white/15 border-white/30 text-white'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-0.5 w-5 h-5 bg-white/20 rounded-full text-xs flex items-center justify-center text-white">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'filters' ? 'rotate-180' : ''}`} />
            </button>

            {openDropdown === 'filters' && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#111113] border border-white/10 rounded-2xl shadow-2xl z-50 p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Platform */}
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

                {/* Category */}
                <FilterSection label="Category">
                  <div className="max-h-40 overflow-y-auto space-y-1 scrollbar-hide">
                    {CATEGORIES.map((c) => (
                      <FilterButton key={c} active={selectedCategory === c} onClick={() => setSelectedCategory(c)}>
                        {c}
                      </FilterButton>
                    ))}
                  </div>
                </FilterSection>

                {/* Content Type */}
                <FilterSection label="Content Type">
                  {CONTENT_TYPE_OPTIONS.map((o) => (
                    <FilterButton key={o.value} active={contentTypeFilter === o.value} onClick={() => setContentTypeFilter(o.value)}>
                      {o.label}
                    </FilterButton>
                  ))}
                </FilterSection>

                {/* Reset */}
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { setSelectedPlatform('all'); setSelectedCategory('All'); setContentTypeFilter('all'); }}
                    className="w-full text-center py-2 text-xs text-gray-500 hover:text-white transition-all"
                  >Reset All Filters</button>
                )}
              </div>
            )}
      </div>

          {/* Sort dropdown */}
          <div className="relative">
          <button
              onClick={() => toggleDropdown('sort')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-medium border ${
                openDropdown === 'sort' || sortBy !== 'recently_added'
                  ? 'bg-white/15 border-white/30 text-white'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <ArrowUpDown className="w-4 h-4" />
              {sortLabel}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'sort' ? 'rotate-180' : ''}`} />
          </button>

            {openDropdown === 'sort' && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#111113] border border-white/10 rounded-2xl shadow-2xl z-50 p-3 space-y-1">
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => { setSortBy(o.value); setOpenDropdown('none'); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                      sortBy === o.value ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >{o.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content Grid ── */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Flame className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No viral content found</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            {allVideos.length === 0
              ? 'The viral library is empty. Use the admin seed tool above to import content.'
              : 'Try adjusting your filters or search to find content.'}
          </p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              getPlatformIcon={getPlatformIcon}
              formatNumber={formatNumber}
            />
          ))}
        </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4">
          <button
                onClick={() => fetchPage(false)}
                disabled={loadingMore}
                className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                Load More
          </button>
            </div>
          )}
        </>
      )}

      {/* Click-away overlay to close any open dropdown */}
      {openDropdown !== 'none' && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown('none')} />
      )}
    </div>
  );
};

// ─── Reusable filter UI pieces ────────────────────────────

const FilterSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
          <div>
    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</label>
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
      active ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    {children}
            </button>
  );

export default ViralContentPage;
