import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);
  
  if (!isOpen) return null;

  // Convert video URLs to embed URLs
  const getEmbedUrl = (url: string, platform?: string): string => {
    console.log('🎬 Converting video URL:', { url, platform });
    
    try {
      // TikTok
      if (url.includes('tiktok.com') || platform === 'tiktok') {
        // Extract video ID from various TikTok URL formats
        const videoIdMatch = url.match(/video\/(\d+)/);
        if (videoIdMatch) {
          const embedUrl = `https://www.tiktok.com/embed/v2/${videoIdMatch[1]}`;
          console.log('✅ TikTok embed URL:', embedUrl);
          return embedUrl;
        }
        console.warn('⚠️ Could not parse TikTok video ID from:', url);
        return url;
      }
      
      // Instagram - needs to be a post/reel URL
      if (url.includes('instagram.com') || platform === 'instagram') {
        // Extract the post/reel code from the URL
        const postMatch = url.match(/instagram\.com\/(p|reel|reels)\/([^\/\?]+)/);
        if (postMatch) {
          const type = postMatch[1] === 'reels' ? 'reel' : postMatch[1]; // Normalize 'reels' to 'reel'
          const code = postMatch[2];
          const embedUrl = `https://www.instagram.com/${type}/${code}/embed`;
          console.log('✅ Instagram embed URL:', embedUrl);
          return embedUrl;
        }
        
        // Fallback: if URL already has /embed, use it
        if (url.includes('/embed')) {
          console.log('✅ Using existing Instagram embed URL:', url);
          return url;
        }
        
        // Last resort: try appending /embed
        const embedUrl = url.replace(/\/$/, '') + '/embed';
        console.log('⚠️ Fallback Instagram embed URL:', embedUrl);
        return embedUrl;
      }
      
      // YouTube Shorts or watch URLs
      if (url.includes('youtube.com') || url.includes('youtu.be') || platform === 'youtube') {
        const shortsMatch = url.match(/shorts\/([a-zA-Z0-9_-]+)/);
        if (shortsMatch) {
          const embedUrl = `https://www.youtube.com/embed/${shortsMatch[1]}`;
          console.log('✅ YouTube Shorts embed URL:', embedUrl);
          return embedUrl;
        }
        
        const youtuMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
        if (youtuMatch) {
          const embedUrl = `https://www.youtube.com/embed/${youtuMatch[1]}`;
          console.log('✅ YouTube embed URL:', embedUrl);
          return embedUrl;
        }
        
        try {
          const u = new URL(url);
          const v = u.searchParams.get('v');
          if (v) {
            const embedUrl = `https://www.youtube.com/embed/${v}`;
            console.log('✅ YouTube watch embed URL:', embedUrl);
            return embedUrl;
          }
        } catch (e) {
          console.error('Error parsing YouTube URL:', e);
        }
      }
      
      // Twitter/X
      if (url.includes('twitter.com') || url.includes('x.com') || platform === 'twitter') {
        console.log('ℹ️ Twitter video - opening externally');
        return url;
      }
      
      console.log('⚠️ Using original URL:', url);
      return url;
    } catch (error) {
      console.error('❌ Error converting video URL:', error);
      return url;
    }
  };

  const embedUrl = getEmbedUrl(videoUrl, platform);

  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh'
      }}
    >
      {/* Close button - top right corner */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-[100000] p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all text-white hover:scale-110"
        aria-label="Close video"
      >
        <X className="w-5 h-5" strokeWidth={2.5} />
      </button>

      {/* Video Container */}
      <div 
        className="relative flex flex-col items-center justify-center gap-4 max-w-full max-h-full p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        {title && (
          <div className="text-center px-4 max-w-md">
            <h3 className="text-lg font-semibold text-white drop-shadow-lg line-clamp-2">
              {title}
            </h3>
          </div>
        )}

        {/* Video Player - Responsive size */}
        <div className="relative w-[90vw] max-w-[380px] aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/20">
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ border: 'none' }}
            title={title || 'Video player'}
          />
        </div>

        {/* Footer Link */}
        <div className="text-center">
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-sm text-white transition-all hover:scale-105"
          >
            Open in {platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Platform'} →
          </a>
        </div>
      </div>
    </div>
  );
  
  return createPortal(modalContent, document.body);
};

export default VideoPlayerModal;

