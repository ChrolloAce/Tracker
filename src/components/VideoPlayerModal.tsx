import React from 'react';
import { X } from 'lucide-react';

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title?: string;
  platform?: 'instagram' | 'tiktok' | 'youtube';
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
      
      return url;
    } catch (error) {
      console.error('Error converting video URL:', error);
      return url;
    }
  };

  const embedUrl = getEmbedUrl(videoUrl, platform);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white truncate">
            {title || 'Video Player'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative w-full" style={{ paddingTop: '177.78%' }}> {/* 9:16 aspect ratio for vertical videos */}
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ border: 'none' }}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/50">
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Open in {platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Platform'} →
          </a>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerModal;

