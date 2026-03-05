import React, { useState, useMemo } from 'react';
import { 
  Flame, 
  Eye, 
  Heart, 
  MessageCircle, 
  Search,
  Play,
  SlidersHorizontal,
  ChevronDown,
  Bookmark,
  Share2,
} from 'lucide-react';
import { VIRAL_SEED_DATA, ViralSeedEntry } from '../data/viralSeedData';

// Platform icons
const TikTokIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const InstagramIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const YouTubeIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const XIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const PLATFORMS = [
  { id: 'all', name: 'All Platforms' },
  { id: 'tiktok', name: 'TikTok', icon: TikTokIcon },
  { id: 'instagram', name: 'Instagram', icon: InstagramIcon },
  { id: 'youtube', name: 'YouTube', icon: YouTubeIcon },
  { id: 'twitter', name: 'X', icon: XIcon },
];

const CATEGORIES = [
  'All',
  'Business & Finance',
  'Health & Wellness',
  'Fashion & Beauty',
  'Arts, Hobbies & Entertainment',
  'Food & Cooking',
  'Entertainment',
  'Education',
  'Lifestyle',
  'Comedy',
  'Music',
  'Sports',
  'Tech',
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

const ViralContentPage: React.FC = () => {
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recently_added');
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>('all');

  // All data is hardcoded — no Firestore, instant render
  const filteredVideos = useMemo(() => {
    let result = VIRAL_SEED_DATA.filter(video => {
      const matchesPlatform = selectedPlatform === 'all' || video.platform === selectedPlatform;

      const matchesSearch = !searchQuery || 
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.uploaderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.uploaderHandle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'All' || video.category === selectedCategory;

      const matchesContentType = contentTypeFilter === 'all' || video.contentType === contentTypeFilter;

      return matchesPlatform && matchesSearch && matchesCategory && matchesContentType;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'recently_added':
          return VIRAL_SEED_DATA.indexOf(a) - VIRAL_SEED_DATA.indexOf(b); // CSV order = added order
        case 'latest_posted':
          return new Date(b.uploadDateISO).getTime() - new Date(a.uploadDateISO).getTime();
        case 'most_views':
          return b.views - a.views;
        case 'most_likes':
          return b.likes - a.likes;
        default:
          return 0;
      }
    });

    return result;
  }, [searchQuery, selectedPlatform, selectedCategory, contentTypeFilter, sortBy]);

  const formatNumber = (num?: number) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getPlatformIcon = (platform: string, className: string = "w-4 h-4") => {
    switch (platform) {
      case 'instagram': return <InstagramIcon className={className} />;
      case 'tiktok': return <TikTokIcon className={className} />;
      case 'youtube': return <YouTubeIcon className={className} />;
      case 'twitter': return <XIcon className={className} />;
      default: return <Flame className={className} />;
    }
  };

  const activeFilterCount = [
    sortBy !== 'recently_added' ? 1 : 0,
    contentTypeFilter !== 'all' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Search & Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
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

        {/* Filters Button */}
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-medium border ${
              showFilters || activeFilterCount > 0
                ? 'bg-white/15 border-white/30 text-white'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 w-5 h-5 bg-white/20 rounded-full text-xs flex items-center justify-center text-white">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Filters Dropdown */}
          {showFilters && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[#111113] border border-white/10 rounded-2xl shadow-2xl z-50 p-4 space-y-4">
              {/* Sort By */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Sort By
                </label>
                <div className="space-y-1">
                  {SORT_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                        sortBy === option.value
                          ? 'bg-white/10 text-white font-medium'
                          : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Content Type
                </label>
                <div className="space-y-1">
                  {CONTENT_TYPE_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setContentTypeFilter(option.value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                        contentTypeFilter === option.value
                          ? 'bg-white/10 text-white font-medium'
                          : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setSortBy('recently_added');
                    setContentTypeFilter('all');
                  }}
                  className="w-full text-center py-2 text-xs text-gray-500 hover:text-white transition-all"
                >
                  Reset Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Platform Filters */}
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map(platform => {
          const Icon = platform.icon;
          const isSelected = selectedPlatform === platform.id;
          return (
            <button
              key={platform.id}
              onClick={() => setSelectedPlatform(platform.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm ${
                isSelected
                  ? 'bg-white/15 border-white/30 text-white'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
              } border`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{platform.name}</span>
            </button>
          );
        })}
      </div>

      {/* Category Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {CATEGORIES.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === category
                ? 'bg-white/15 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Content Grid */}
      {filteredVideos.length === 0 ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Flame className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No viral content found</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Try adjusting your filters or search to find content.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map((video, idx) => (
            <VideoCard
              key={`${video.uploaderHandle}-${idx}`}
              video={video}
              getPlatformIcon={getPlatformIcon}
              formatNumber={formatNumber}
            />
          ))}
        </div>
      )}

      {/* Click-away overlay for filters dropdown */}
      {showFilters && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowFilters(false)}
        />
      )}
    </div>
  );
};

// ─── Video Card ───────────────────────────────────────────

interface VideoCardProps {
  video: ViralSeedEntry;
  getPlatformIcon: (platform: string, className?: string) => JSX.Element;
  formatNumber: (num: number) => string;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, getPlatformIcon, formatNumber }) => {
  const [isHovered, setIsHovered] = useState(false);

  const contentBadgeLabel = video.contentType === 'slideshow' ? 'Slideshow' : 'Video';
  const hasLink = video.url.length > 0;

  return (
    <div
      className="group relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] bg-black/50">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover"
        />

        {/* Content Type Badge */}
        <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg flex items-center gap-1.5">
          <Play className="w-3 h-3 text-white" fill="currentColor" />
          <span className="text-xs text-white font-medium">{contentBadgeLabel}</span>
        </div>

        {/* Caption Overlay */}
        {video.description && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            <p className="text-white text-sm font-medium line-clamp-3 drop-shadow-lg">
              {video.description}
            </p>
          </div>
        )}

        {/* Play Button Overlay */}
        {hasLink && (
          <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 transition-all hover:scale-110"
            >
              <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
            </a>
          </div>
        )}
      </div>

      {/* Content Info */}
      <div className="p-4">
        {/* Creator Info */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            {getPlatformIcon(video.platform)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-white truncate">
                @{video.uploaderHandle}
              </span>
              {getPlatformIcon(video.platform, "w-3.5 h-3.5 text-gray-400")}
            </div>
            <span className="text-xs text-gray-500">{video.category}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {formatNumber(video.views)}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-3.5 h-3.5" />
            {formatNumber(video.likes)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3.5 h-3.5" />
            {formatNumber(video.comments)}
          </span>
          {video.shares > 0 && (
            <span className="flex items-center gap-1">
              <Share2 className="w-3.5 h-3.5" />
              {formatNumber(video.shares)}
            </span>
          )}
          {video.saves > 0 && (
            <span className="flex items-center gap-1">
              <Bookmark className="w-3.5 h-3.5" />
              {formatNumber(video.saves)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViralContentPage;
