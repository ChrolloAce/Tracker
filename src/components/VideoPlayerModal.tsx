import React from 'react';
import { X } from 'lucide-react';

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title?: string;
  platform?: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
}

/**
 * VideoPlayerModal
 * 
 * Displays a video in an iframe popup player
 */
const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ 
  isOpen, 
  onClose, 
  videoUrl,
  title,
  platform 
}) => {
  if (!isOpen) return null;

  // Convert video URLs to embed URLs
  const getEmbedUrl = (url: string, platform?: string): string => {
    try {
      // TikTok
      if (url.includes('tiktok.com') || platform === 'tiktok') {
        // Extract video ID from various TikTok URL formats
        const videoIdMatch = url.match(/video\/(\d+)/);
        if (videoIdMatch) {
          return `https://www.tiktok.com/embed/v2/${videoIdMatch[1]}`;
        }
        return url; // Return original if can't parse
      }
      
      // Instagram
      if (url.includes('instagram.com') || platform === 'instagram') {
        // Convert Instagram URL to embed URL
        let embedUrl = url;
        if (!url.includes('/embed')) {
          embedUrl = url.replace(/\/$/, '') + '/embed';
        }
        return embedUrl;
      }
      
      // YouTube Shorts or watch URLs
      if (url.includes('youtube.com') || url.includes('youtu.be') || platform === 'youtube') {
        const shortsMatch = url.match(/shorts\/([a-zA-Z0-9_-]+)/);
        if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
        const youtuMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
        if (youtuMatch) return `https://www.youtube.com/embed/${youtuMatch[1]}`;
        try {
          const u = new URL(url);
          const v = u.searchParams.get('v');
          if (v) return `https://www.youtube.com/embed/${v}`;
        } catch {}
      }
      
      // Twitter/X
      if (url.includes('twitter.com') || url.includes('x.com') || platform === 'twitter') {
        // Twitter videos are opened externally, no embed
        return url;
      }
      
      return url;
    } catch (error) {
      console.error('Error converting video URL:', error);
      return url;
    }
  };

  const embedUrl = getEmbedUrl(videoUrl, platform);

  return (
    <div 
      className="fixed inset-0 w-full h-full z-[9999] flex items-center justify-center backdrop-blur-2xl bg-black/30"
      onClick={onClose}
    >
      {/* Close button - top right corner */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-[10000] p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all text-white hover:scale-110"
      >
        <X className="w-5 h-5" strokeWidth={2.5} />
      </button>

      {/* Video Container */}
      <div 
        className="relative flex flex-col items-center justify-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        {title && (
          <div className="text-center px-4">
            <h3 className="text-lg font-semibold text-white drop-shadow-lg">
              {title}
            </h3>
          </div>
        )}

        {/* Video Player - Compact size */}
        <div className="relative w-[380px] h-[680px] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ border: 'none' }}
          />
        </div>

        {/* Footer Link */}
        <div className="text-center">
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-sm text-white transition-all"
          >
            Open in {platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Platform'} →
          </a>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerModal;

