import React, { useState } from 'react';
import { Clock, Flame, ExternalLink } from 'lucide-react';
import { VideoSubmission } from '../../types';

interface VideoSidebarProps {
  video: VideoSubmission;
  twitterMedia: string[];
  embedUrl: string;
  viralityFactor: number;
}

export const VideoSidebar: React.FC<VideoSidebarProps> = ({
  video,
  twitterMedia,
  embedUrl,
  viralityFactor
}) => {
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="overflow-hidden">
      <div className="relative rounded-xl border border-white/5 shadow-lg p-3 overflow-hidden" style={{ backgroundColor: '#121214' }}>
        {/* Depth Gradient Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
          }}
        />
        
        <div className="relative w-full aspect-[9/16] bg-black rounded-lg overflow-hidden border border-white/10 z-10">
          {video.platform === 'twitter' && twitterMedia.length > 0 ? (
            // Twitter: Show images in slideshow
            <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
              <img
                src={twitterMedia[currentMediaIndex]}
                alt={`Tweet media ${currentMediaIndex + 1}`}
                className="w-full h-full object-contain"
                onError={(e) => {
                  // Fallback to placeholder on image error
                  e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3Ctext fill="%23666" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
                }}
              />
              
              {/* Slideshow controls if multiple images */}
              {twitterMedia.length > 1 && (
                <>
                  {/* Previous button */}
                  <button
                    onClick={() => setCurrentMediaIndex((currentMediaIndex - 1 + twitterMedia.length) % twitterMedia.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-all z-10"
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                  
                  {/* Next button */}
                  <button
                    onClick={() => setCurrentMediaIndex((currentMediaIndex + 1) % twitterMedia.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-all z-10"
                    aria-label="Next image"
                  >
                    ›
                  </button>
                  
                  {/* Image indicators */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                    {twitterMedia.map((_: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentMediaIndex(idx)}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${
                          idx === currentMediaIndex ? 'bg-white w-4' : 'bg-white/40 hover:bg-white/60'
                        }`}
                        aria-label={`Go to image ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            // Other platforms: Use iframe embed
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ border: 'none' }}
              title={video.title || video.caption || 'Video'}
              sandbox="allow-scripts allow-same-origin allow-presentation"
            />
          )}
        </div>

        {/* Duration & Virality Info */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/5 p-2" style={{ backgroundColor: '#0a0a0b' }}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-400">Duration</span>
            </div>
            <div className="text-sm font-bold text-white">
              {formatDuration(video.duration || 0)}
            </div>
          </div>
          <div className="rounded-lg border border-white/5 p-2" style={{ backgroundColor: '#0a0a0b' }}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs text-gray-400">Virality</span>
            </div>
            <div className="text-sm font-bold text-white">
              {viralityFactor.toFixed(2)}x
            </div>
          </div>
        </div>

        {/* Posted & Last Refresh Info */}
        <div className="mt-2 rounded-lg border border-white/5 p-2.5 space-y-1.5" style={{ backgroundColor: '#0a0a0b' }}>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">Posted:</span>
            <span className="text-white font-medium">
              {new Date(video.uploadDate || video.dateSubmitted).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>
          {video.lastRefreshed && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">Last refresh:</span>
              <span className="text-white font-medium">
                {new Date(video.lastRefreshed).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
          )}
        </div>

        {/* View on Platform Button */}
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-sm font-medium text-white"
        >
          <ExternalLink className="w-4 h-4" />
          View on Platform
        </a>
      </div>
    </div>
  );
};

