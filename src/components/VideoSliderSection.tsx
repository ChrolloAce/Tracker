import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Heart, MessageCircle, Play } from 'lucide-react';
import { VideoSubmission } from '../types';
import { ProxiedImage } from './ProxiedImage';

// Platform icons
import instagramIcon from '/Instagram_icon.png';
import tiktokIcon from '/TiktokLogo.png';
import youtubeIcon from '/Youtube_shorts_icon.svg.png';
import xLogo from '/twitter-x-logo.png';

interface VideoSliderSectionProps {
  videos: VideoSubmission[];
  maxVideos?: number;
  onVideoClick?: (video: VideoSubmission) => void;
}

/**
 * VideoSliderSection - Full-height social media style video slider
 * Displays videos sorted by views (highest to lowest)
 */
const VideoSliderSection: React.FC<VideoSliderSectionProps> = ({
  videos,
  maxVideos = 20,
  onVideoClick
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Sort videos by views (highest first) and limit
  const sortedVideos = [...videos]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, maxVideos);

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

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 300;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  if (sortedVideos.length === 0) {
    return (
      <div className="bg-zinc-900/60 backdrop-blur rounded-2xl border border-white/10 p-8 text-center">
        <Play className="w-12 h-12 text-white/20 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-white mb-1">No videos match your filters</h3>
        <p className="text-white/60 text-sm">Try adjusting the date range or filters to see your top videos.</p>
      </div>
    );
  }

  return (
    <div className="relative group">
      {/* Left Arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/80 hover:bg-black border border-white/20 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-xl"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Right Arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/80 hover:bg-black border border-white/20 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-xl"
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
            onClick={() => onVideoClick?.(video)}
          />
        ))}
      </div>

      {/* Hide scrollbar styles */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
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
  onClick?: () => void;
}> = ({ video, platformIcon, formatNumber, onClick }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      onClick={onClick}
      className="flex-shrink-0 w-[200px] cursor-pointer group/card"
    >
      {/* Video Container - 9:16 Aspect Ratio */}
      <div 
        className="relative rounded-2xl overflow-hidden bg-zinc-800 border border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
        style={{ aspectRatio: '9/16' }}
      >
        {/* Thumbnail */}
        {video.thumbnail && !imageError ? (
          <img
            src={video.thumbnail}
            alt={video.title || 'Video'}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              console.error('❌ Failed to load thumbnail:', video.thumbnail?.substring(0, 100));
              setImageError(true);
            }}
            onLoad={() => console.log('✅ Loaded thumbnail for:', video.title?.substring(0, 30))}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center">
            <Play className="w-12 h-12 text-white/30" />
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

        {/* Stats on Right Side - Vertical (Social Media Style) */}
        <div className="absolute right-2 bottom-20 flex flex-col items-center gap-3">
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
        </div>

        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30">
            <Play className="w-6 h-6 text-white fill-white ml-1" />
          </div>
        </div>

        {/* Bottom Info */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
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
          <p className="text-white/80 text-xs line-clamp-2 leading-relaxed">
            {video.caption || video.title || 'No caption'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VideoSliderSection;

