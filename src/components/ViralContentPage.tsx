import React, { useState, useEffect, useMemo } from 'react';
import { 
  Flame, 
  Plus, 
  X, 
  Trash2, 
  Eye, 
  Heart, 
  MessageCircle, 
  Loader2,
  Search,
  Play,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ViralContentService from '../services/ViralContentService';
import { ViralVideo, ViralVideoInput } from '../types/viralContent';

// Platform icons
const InstagramIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const TikTokIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
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
  'Entertainment',
  'Education',
  'Lifestyle',
  'Comedy',
  'Music',
  'Sports',
  'Tech',
  'Beauty',
  'Food',
];

const ViralContentPage: React.FC = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState<ViralVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  const isSuperAdmin = ViralContentService.isSuperAdmin(user?.email);

  useEffect(() => {
    loadVideos();
  }, [selectedPlatform]);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const data = selectedPlatform === 'all'
        ? await ViralContentService.getViralVideos()
        : await ViralContentService.getViralVideosByPlatform(selectedPlatform);
      setVideos(data);
    } catch (error) {
      console.error('Failed to load viral videos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter videos by search and category
  const filteredVideos = useMemo(() => {
    return videos.filter(video => {
      const matchesSearch = !searchQuery || 
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.uploaderName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'All' || video.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [videos, searchQuery, selectedCategory]);

  // Calculate quick insights
  const insights = useMemo(() => {
    if (filteredVideos.length === 0) {
      return { totalContent: 0, avgViews: 0, avgLikes: 0, avgEngagement: 0 };
    }
    
    const totalViews = filteredVideos.reduce((sum, v) => sum + (v.views || 0), 0);
    const totalLikes = filteredVideos.reduce((sum, v) => sum + (v.likes || 0), 0);
    
    return {
      totalContent: filteredVideos.length,
      avgViews: Math.round(totalViews / filteredVideos.length),
      avgLikes: Math.round(totalLikes / filteredVideos.length),
      avgEngagement: totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(2) : '0',
    };
  }, [filteredVideos]);

  const handleDelete = async (videoId: string) => {
    if (!user?.email || !confirm('Are you sure you want to delete this video?')) return;
    
    try {
      await ViralContentService.deleteViralVideo(videoId, user.email);
      setVideos(prev => prev.filter(v => v.id !== videoId));
    } catch (error) {
      console.error('Failed to delete video:', error);
      alert('Failed to delete video');
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Search and Add Button Row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
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
        
        {isSuperAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl transition-all text-sm font-medium border border-white/10"
          >
            <Plus className="w-4 h-4" />
            Add Video
          </button>
        )}
      </div>

      {/* Quick Insights */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-white">Quick Insights</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Play className="w-3 h-3" />
              CONTENT
            </div>
            <div className="text-2xl font-bold text-white">{formatNumber(insights.totalContent)}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Eye className="w-3 h-3" />
              AVG VIEWS
            </div>
            <div className="text-2xl font-bold text-white">{formatNumber(insights.avgViews)}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Heart className="w-3 h-3" />
              AVG LIKES
            </div>
            <div className="text-2xl font-bold text-white">{formatNumber(insights.avgLikes)}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <TrendingUp className="w-3 h-3" />
              ENGAGEMENT
            </div>
            <div className="text-2xl font-bold text-white">{insights.avgEngagement}%</div>
          </div>
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
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Flame className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No viral content yet</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            {isSuperAdmin 
              ? 'Add your first viral video to start building your content library.'
              : 'Check back soon for trending content across platforms.'}
          </p>
          {isSuperAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl transition-all text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add First Video
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map(video => (
            <VideoCard
              key={video.id}
              video={video}
              isSuperAdmin={isSuperAdmin}
              onDelete={handleDelete}
              getPlatformIcon={getPlatformIcon}
              formatNumber={formatNumber}
            />
          ))}
        </div>
      )}

      {/* Add Video Modal */}
      {showAddModal && isSuperAdmin && (
        <AddViralVideoModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadVideos();
          }}
        />
      )}
    </div>
  );
};

// Video Card Component
interface VideoCardProps {
  video: ViralVideo;
  isSuperAdmin: boolean;
  onDelete: (id: string) => void;
  getPlatformIcon: (platform: string, className?: string) => JSX.Element;
  formatNumber: (num?: number) => string;
}

const VideoCard: React.FC<VideoCardProps> = ({ 
  video, 
  isSuperAdmin, 
  onDelete, 
  getPlatformIcon, 
  formatNumber 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] bg-black/50">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/10">
            {getPlatformIcon(video.platform, "w-12 h-12 text-gray-600")}
          </div>
        )}
        
        {/* Video Badge */}
        <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg flex items-center gap-1.5">
          <Play className="w-3 h-3 text-white" fill="currentColor" />
          <span className="text-xs text-white font-medium">Video</span>
        </div>

        {/* Text Overlay on Thumbnail */}
        {video.description && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            <p className="text-white text-sm font-medium line-clamp-3 drop-shadow-lg">
              {video.description || video.title}
            </p>
          </div>
        )}

        {/* Play Button Overlay */}
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

        {/* Admin Delete Button */}
        {isSuperAdmin && isHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(video.id);
            }}
            className="absolute top-3 right-3 p-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg transition-all backdrop-blur-sm"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        )}
      </div>

      {/* Content Info */}
      <div className="p-4">
        {/* Creator Info */}
        <div className="flex items-center gap-2 mb-3">
          {video.uploaderProfilePic ? (
            <img 
              src={video.uploaderProfilePic} 
              alt={video.uploaderName || ''} 
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              {getPlatformIcon(video.platform)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-white truncate">
                @{video.uploaderHandle || video.uploaderName || 'unknown'}
              </span>
              {getPlatformIcon(video.platform, "w-3.5 h-3.5 text-gray-400")}
            </div>
            {video.category && (
              <span className="text-xs text-gray-500">{video.category}</span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
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
        </div>
      </div>
    </div>
  );
};

// Add Video Modal Component
interface AddViralVideoModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AddViralVideoModal: React.FC<AddViralVideoModalProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<'instagram' | 'tiktok' | 'youtube' | 'twitter'>('tiktok');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('');

  // Auto-detect platform from URL
  useEffect(() => {
    if (url.includes('instagram.com')) setPlatform('instagram');
    else if (url.includes('tiktok.com')) setPlatform('tiktok');
    else if (url.includes('youtube.com') || url.includes('youtu.be')) setPlatform('youtube');
    else if (url.includes('twitter.com') || url.includes('x.com')) setPlatform('twitter');
  }, [url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !url || !title) return;

    setLoading(true);
    setError(null);

    try {
      const input: ViralVideoInput = {
        url,
        platform,
        title,
        description: description || undefined,
        thumbnail: thumbnail || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        category: category || undefined
      };

      await ViralContentService.addViralVideo(input, user.email);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to add video');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#0A0A0B] rounded-2xl max-w-lg w-full border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#0A0A0B]">
          <h2 className="text-lg font-semibold text-white">Add Viral Video</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Video URL *</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://tiktok.com/@user/video/..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 text-sm"
              >
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="twitter">X (Twitter)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 text-sm"
              >
                <option value="">Select category</option>
                {CATEGORIES.filter(c => c !== 'All').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video title"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description / Hook Text</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="The text overlay shown on the video..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 resize-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Thumbnail URL</label>
            <input
              type="url"
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              placeholder="https://..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Tags (comma separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="viral, trending, dance"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !url || !title}
              className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl transition-all text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add Video
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ViralContentPage;
