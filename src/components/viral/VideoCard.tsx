import React, { useState } from 'react';
import {
  Eye,
  Heart,
  MessageCircle,
  Play,
  Bookmark,
  Share2,
  ExternalLink,
} from 'lucide-react';
import { ViralVideo } from '../../types/viralContent';
import VideoPlayerModal from './VideoPlayerModal';

interface VideoCardProps {
  video: ViralVideo;
  getPlatformIcon: (platform: string, className?: string) => JSX.Element;
  formatNumber: (num: number) => string;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, getPlatformIcon, formatNumber }) => {
  const [showPlayer, setShowPlayer] = useState(false);

  const isSlideshow = video.contentType === 'slideshow';
  const contentBadgeLabel = isSlideshow ? 'Slideshow' : 'Video';

  return (
    <>
      <div
        className="group relative bg-black rounded-2xl overflow-hidden border border-white/10 hover:border-white/25 transition-all cursor-pointer"
        onClick={() => setShowPlayer(true)}
      >
        {/* Full-bleed thumbnail — aspect ratio adapts to content type */}
        <div className={`relative ${isSlideshow ? 'aspect-[4/3]' : 'aspect-[9/16]'}`}>
          <img
            src={video.thumbnail}
            alt={video.title}
            className={`w-full h-full ${isSlideshow ? 'object-contain' : 'object-cover'}`}
          />

          {/* Dark gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70 pointer-events-none" />

          {/* ── Top-left: content type badge ── */}
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg flex items-center gap-1.5">
            <Play className="w-3 h-3 text-white" fill="currentColor" />
            <span className="text-[11px] text-white font-medium">{contentBadgeLabel}</span>
          </div>

          {/* ── Right sidebar: TikTok-style metrics ── */}
          <div className={`absolute right-2 flex flex-col items-center ${isSlideshow ? 'top-10 gap-2' : 'bottom-24 gap-4'}`}>
            <StatIcon icon={<Eye className={isSlideshow ? "w-4 h-4" : "w-5 h-5"} />} value={formatNumber(video.views)} />
            <StatIcon icon={<Heart className={isSlideshow ? "w-4 h-4" : "w-5 h-5"} />} value={formatNumber(video.likes)} />
            <StatIcon icon={<MessageCircle className={isSlideshow ? "w-4 h-4" : "w-5 h-5"} />} value={formatNumber(video.comments)} />
            {video.shares > 0 && (
              <StatIcon icon={<Share2 className={isSlideshow ? "w-4 h-4" : "w-5 h-5"} />} value={formatNumber(video.shares)} />
            )}
            {video.saves > 0 && (
              <StatIcon icon={<Bookmark className={isSlideshow ? "w-4 h-4" : "w-5 h-5"} />} value={formatNumber(video.saves)} />
            )}
          </div>

          {/* ── Bottom overlay: creator + caption ── */}
          <div className="absolute bottom-0 left-0 right-10 p-3">
            {/* Creator row */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                {getPlatformIcon(video.platform, "w-3.5 h-3.5 text-white")}
              </div>
              <span className="text-[13px] font-semibold text-white drop-shadow-lg truncate">
                @{video.uploaderHandle}
              </span>
              {video.url && (
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 text-white/60 hover:text-white transition-colors"
                  title="Open on TikTok"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* Caption */}
            {video.description && (
              <p className="text-[12px] text-white/80 line-clamp-2 drop-shadow-lg leading-relaxed">
                {video.description}
              </p>
            )}

            {/* Category tag */}
            <span className="inline-block mt-1.5 px-2 py-0.5 bg-white/10 backdrop-blur-sm rounded text-[10px] text-white/70 font-medium">
              {video.category}
            </span>
          </div>

          {/* ── Center play button on hover ── */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
              <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
            </div>
          </div>
        </div>
      </div>

      {/* Video player modal */}
      {showPlayer && (
        <VideoPlayerModal video={video} onClose={() => setShowPlayer(false)} />
      )}
    </>
  );
};

// ─── Small stat icon + count used in the right sidebar ────

interface StatIconProps {
  icon: React.ReactNode;
  value: string;
}

const StatIcon: React.FC<StatIconProps> = ({ icon, value }) => (
  <div className="flex flex-col items-center gap-0.5">
    <div className="text-white drop-shadow-lg">{icon}</div>
    <span className="text-[11px] font-semibold text-white drop-shadow-lg">{value}</span>
  </div>
);

export default VideoCard;
