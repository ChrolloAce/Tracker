import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { ViralVideo } from '../../types/viralContent';

interface VideoPlayerModalProps {
  video: ViralVideo;
  onClose: () => void;
}

/**
 * Extract the TikTok video ID from a full URL.
 * e.g. https://www.tiktok.com/@user/video/7603219066978979085 → 7603219066978979085
 */
function extractVideoId(url: string): string | null {
  const match = url.match(/video\/(\d+)/);
  return match ? match[1] : null;
}

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ video, onClose }) => {
  const videoId = extractVideoId(video.url);
  const embedUrl = videoId
    ? `https://www.tiktok.com/embed/v2/${videoId}`
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-[#0A0A0B] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ width: 400 }}
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

        {/* Embed Player */}
        <div className="flex-1 min-h-0">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full border-0"
              style={{ height: 700 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <p className="text-gray-400 text-sm mb-4">
                No embeddable video link available for this content.
              </p>
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full max-w-[280px] rounded-xl object-cover"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerModal;
