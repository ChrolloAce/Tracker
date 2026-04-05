import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2,
  Eye,
  Heart,
  MessageCircle,
  Play,
  ExternalLink,
  Bookmark,
  Share2,
  Flame,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────

function formatNumber(num: number): string {
  if (!num) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function getPlatformName(p: string): string {
  switch (p) {
    case 'tiktok': return 'TikTok';
    case 'instagram': return 'Instagram';
    case 'youtube': return 'YouTube';
    case 'twitter': return 'X / Twitter';
    default: return p;
  }
}

function getPlatformColor(p: string): string {
  switch (p) {
    case 'tiktok': return '#ff0050';
    case 'instagram': return '#E1306C';
    case 'youtube': return '#FF0000';
    case 'twitter': return '#1DA1F2';
    default: return '#888';
  }
}

interface SharedVideo {
  id: string;
  url: string;
  platform: string;
  title: string;
  description: string;
  thumbnail: string;
  uploaderHandle: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  contentType: string;
  category: string;
  tags: string[];
  followerCount: number;
}

// ─── Main Page ───────────────────────────────────────────

const SharedFolderPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [videos, setVideos] = useState<SharedVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<SharedVideo | null>(null);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        // In dev, API runs on 3001; in prod, same origin
        const apiBase = window.location.port === '3000' ? 'http://localhost:3001' : '';
        const resp = await fetch(`${apiBase}/api/public-folder-share?token=${token}`);
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || 'Share link not found');
        }
        const { data } = await resp.json();
        setFolderName(data.folderName);
        setVideos(data.videos);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Stats summary
  const totalViews = useMemo(() => videos.reduce((s, v) => s + (v.views || 0), 0), [videos]);
  const totalLikes = useMemo(() => videos.reduce((s, v) => s + (v.likes || 0), 0), [videos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bookmark className="w-8 h-8 text-gray-600" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Link not found</h1>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Flame className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Shared Collection</p>
              <h1 className="text-2xl font-bold text-white">{folderName}</h1>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-400">
            <span>{videos.length} video{videos.length !== 1 ? 's' : ''}</span>
            <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {formatNumber(totalViews)} total views</span>
            <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {formatNumber(totalLikes)} total likes</span>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {videos.length === 0 ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-16 text-center">
            <Bookmark className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <h3 className="text-base font-medium text-white mb-1">No videos yet</h3>
            <p className="text-gray-500 text-sm">This collection is empty.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {videos.map((video) => (
              <SharedVideoCard
                key={video.id}
                video={video}
                onClick={() => setSelectedVideo(video)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Video Detail Modal */}
      {selectedVideo && (
        <VideoDetailModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />
      )}

      {/* Footer */}
      <div className="border-t border-white/5 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
          <p className="text-xs text-gray-600">
            Powered by <span className="text-gray-400 font-medium">ViewTrack</span>
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Shared Video Card ──────────────────────────────────

const SharedVideoCard: React.FC<{ video: SharedVideo; onClick: () => void }> = ({ video, onClick }) => (
  <div
    onClick={onClick}
    className="group relative bg-black rounded-2xl overflow-hidden border border-white/10 hover:border-white/25 transition-all cursor-pointer"
  >
    <div className="relative aspect-[9/16]">
      {video.thumbnail ? (
        <img loading="lazy" src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-white/5 flex items-center justify-center">
          <Play className="w-8 h-8 text-gray-700" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70 pointer-events-none" />

      {/* Platform badge */}
      <div
        className="absolute top-3 left-3 px-2 py-1 rounded-lg text-[11px] font-medium"
        style={{ backgroundColor: `${getPlatformColor(video.platform)}30`, color: getPlatformColor(video.platform) }}
      >
        {getPlatformName(video.platform)}
      </div>

      {/* Stats */}
      <div className="absolute right-1.5 bottom-24 flex flex-col items-center gap-2.5">
        <MiniStat icon={<Eye className="w-3.5 h-3.5" />} value={formatNumber(video.views)} />
        <MiniStat icon={<Heart className="w-3.5 h-3.5" />} value={formatNumber(video.likes)} />
        <MiniStat icon={<MessageCircle className="w-3.5 h-3.5" />} value={formatNumber(video.comments)} />
      </div>

      {/* Bottom */}
      <div className="absolute bottom-0 left-0 right-10 p-3">
        <span className="text-[13px] font-semibold text-white drop-shadow-lg truncate block">@{video.uploaderHandle}</span>
        {video.title && (
          <p className="text-[12px] text-white/80 line-clamp-2 drop-shadow-lg leading-relaxed mt-1">{video.title}</p>
        )}
      </div>

      {/* Hover play */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
          <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
        </div>
      </div>
    </div>
  </div>
);

// ─── Video Detail Modal ─────────────────────────────────

const VideoDetailModal: React.FC<{ video: SharedVideo; onClose: () => void }> = ({ video, onClose }) => {
  const embedUrl = useMemo(() => {
    try {
      if (video.platform === 'tiktok') {
        const m = video.url.match(/video\/(\d+)/);
        if (m) return `https://www.tiktok.com/embed/v2/${m[1]}`;
      }
      if (video.platform === 'instagram') {
        const m = video.url.match(/instagram\.com\/(p|reel|reels)\/([^\/\?]+)/);
        if (m) return `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/embed`;
      }
      if (video.platform === 'youtube') {
        const u = new URL(video.url);
        const shorts = u.pathname.match(/shorts\/([a-zA-Z0-9_-]+)/);
        if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`;
        if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${u.pathname.substring(1)}`;
        const v = u.searchParams.get('v');
        if (v) return `https://www.youtube.com/embed/${v}`;
      }
    } catch {}
    return null;
  }, [video.url, video.platform]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#121214] rounded-2xl border border-white/10 w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr]">
          {/* Left: embed */}
          <div className="p-4">
            <div className="relative w-full aspect-[9/16] bg-black rounded-xl overflow-hidden border border-white/10">
              {embedUrl ? (
                <iframe src={embedUrl} className="w-full h-full border-0" allowFullScreen />
              ) : video.thumbnail ? (
                <div className="relative w-full h-full">
                  <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                  {video.url && (
                    <a href={video.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 transition-all">
                        <Play className="w-7 h-7 text-white ml-0.5" fill="currentColor" />
                      </div>
                    </a>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="w-12 h-12 text-gray-700" />
                </div>
              )}
            </div>
          </div>

          {/* Right: details */}
          <div className="p-5 space-y-5">
            {/* Creator */}
            <div className="flex items-center gap-3">
              <div
                className="px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{ backgroundColor: `${getPlatformColor(video.platform)}20`, color: getPlatformColor(video.platform) }}
              >
                {getPlatformName(video.platform)}
              </div>
              <span className="text-sm font-semibold text-white">@{video.uploaderHandle}</span>
              {video.followerCount > 0 && (
                <span className="text-xs text-gray-500">{formatNumber(video.followerCount)} followers</span>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-5 gap-3">
              <StatCard label="Views" value={formatNumber(video.views)} icon={<Eye className="w-4 h-4" />} />
              <StatCard label="Likes" value={formatNumber(video.likes)} icon={<Heart className="w-4 h-4" />} />
              <StatCard label="Comments" value={formatNumber(video.comments)} icon={<MessageCircle className="w-4 h-4" />} />
              <StatCard label="Shares" value={formatNumber(video.shares)} icon={<Share2 className="w-4 h-4" />} />
              <StatCard label="Saves" value={formatNumber(video.saves)} icon={<Bookmark className="w-4 h-4" />} />
            </div>

            {/* Caption */}
            {(video.title || video.description) && (
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Caption</h3>
                <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{video.title || video.description}</p>
              </div>
            )}

            {/* Tags */}
            {video.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {video.tags.map((tag) => (
                  <span key={tag} className="px-2.5 py-1 bg-white/5 rounded-lg text-xs text-white/50">{tag}</span>
                ))}
              </div>
            )}

            {/* CTA */}
            {video.url && (
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-sm text-white/70 hover:text-white font-medium border border-white/5"
              >
                <ExternalLink className="w-4 h-4" />
                View on {getPlatformName(video.platform)}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex flex-col items-center gap-1">
    <div className="text-white/40">{icon}</div>
    <span className="text-base font-bold text-white">{value}</span>
    <span className="text-[10px] text-gray-500 uppercase">{label}</span>
  </div>
);

const MiniStat: React.FC<{ icon: React.ReactNode; value: string }> = ({ icon, value }) => (
  <div className="flex flex-col items-center gap-0">
    <div className="text-white drop-shadow-lg">{icon}</div>
    <span className="text-[9px] font-semibold text-white drop-shadow-lg">{value}</span>
  </div>
);

export default SharedFolderPage;
