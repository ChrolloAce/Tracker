import React from 'react';
import {
  X,
  ExternalLink,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Users,
  Calendar,
  Play,
} from 'lucide-react';
import { ViralVideo } from '../../types/viralContent';
import { Timestamp } from 'firebase/firestore';

interface VideoPlayerModalProps {
  video: ViralVideo;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────

function extractVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/video\/(\d+)/);
  return match ? match[1] : null;
}

function formatNumber(num: number): string {
  if (!num) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatDate(val: Timestamp | string | undefined): string {
  if (!val) return '';
  try {
    const date = val instanceof Timestamp ? val.toDate() : new Date(val as string);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

// ─── Component ───────────────────────────────────────────

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ video, onClose }) => {
  const videoId = extractVideoId(video.url);
  const canEmbed = !!videoId;
  const embedUrl = videoId ? `https://www.tiktok.com/embed/v2/${videoId}` : null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-[#0A0A0B] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ width: canEmbed ? 400 : 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-white truncate">
              @{video.uploaderHandle}
            </span>
            {video.url && (
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
                title="Open on TikTok"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-all flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {canEmbed && embedUrl ? (
            /* ─── Embeddable TikTok video ─── */
            <iframe
              src={embedUrl}
              className="w-full border-0"
              style={{ height: 700 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            /* ─── Rich preview for non-embeddable content ─── */
            <div className="flex flex-col">
              {/* Thumbnail hero */}
              <div className="relative">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full aspect-[9/14] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                {/* Play / Open on TikTok overlay */}
                {video.url && (
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center group/play"
                  >
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center group-hover/play:bg-white/30 transition-all group-hover/play:scale-110">
                      <Play className="w-7 h-7 text-white ml-0.5" fill="currentColor" />
                    </div>
                  </a>
                )}

                {/* Content type badge */}
                <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-lg">
                  <span className="text-[11px] text-white font-medium">
                    {video.contentType === 'slideshow' ? 'Slideshow' : 'Video'}
                  </span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-5 gap-1 px-4 py-3 bg-white/[0.03]">
                <StatCell icon={<Eye className="w-4 h-4" />} value={formatNumber(video.views)} label="Views" />
                <StatCell icon={<Heart className="w-4 h-4" />} value={formatNumber(video.likes)} label="Likes" />
                <StatCell icon={<MessageCircle className="w-4 h-4" />} value={formatNumber(video.comments)} label="Comments" />
                <StatCell icon={<Share2 className="w-4 h-4" />} value={formatNumber(video.shares)} label="Shares" />
                <StatCell icon={<Bookmark className="w-4 h-4" />} value={formatNumber(video.saves)} label="Saves" />
              </div>

              {/* Details */}
              <div className="px-4 py-4 space-y-3">
                {/* Caption */}
                {video.description && (
                  <p className="text-sm text-white/80 leading-relaxed">{video.description}</p>
                )}

                {/* Meta row */}
                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  {video.followerCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {formatNumber(video.followerCount)} followers
                    </span>
                  )}
                  {video.uploadDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(video.uploadDate)}
                    </span>
                  )}
                </div>

                {/* Category + Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {video.category && (
                    <span className="px-2 py-0.5 bg-white/10 rounded text-[11px] text-white/60 font-medium">
                      {video.category}
                    </span>
                  )}
                  {video.tags?.slice(0, 5).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-white/5 rounded text-[11px] text-white/40">
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                {video.url && (
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center justify-center gap-2 w-full py-2.5 bg-white/10 hover:bg-white/15 rounded-xl transition-all text-sm text-white font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Watch on TikTok
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Stat cell used in the grid ──────────────────────────

const StatCell: React.FC<{ icon: React.ReactNode; value: string; label: string }> = ({
  icon,
  value,
  label,
}) => (
  <div className="flex flex-col items-center gap-0.5 py-1">
    <div className="text-white/50">{icon}</div>
    <span className="text-xs font-semibold text-white">{value}</span>
    <span className="text-[10px] text-gray-500">{label}</span>
  </div>
);

export default VideoPlayerModal;
