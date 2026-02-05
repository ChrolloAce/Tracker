import React, { useState } from 'react';
import { X, Plus, Trash2, Check, Loader2, Video, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UrlParserService } from '../services/UrlParserService';
import authenticatedApiService from '../services/AuthenticatedApiService';

// Platform Icons as SVG components
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

// Platform configuration
const PLATFORMS = [
  {
    id: 'instagram',
    name: 'Instagram',
    Icon: InstagramIcon,
    placeholder: 'https://instagram.com/reel/...',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    Icon: TikTokIcon,
    placeholder: 'https://tiktok.com/@user/video/...',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    Icon: YouTubeIcon,
    placeholder: 'https://youtube.com/shorts/... or https://youtu.be/...',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    Icon: XIcon,
    placeholder: 'https://x.com/user/status/... or https://twitter.com/...',
  },
] as const;

type PlatformId = typeof PLATFORMS[number]['id'];

interface VideoInput {
  id: string;
  url: string;
  isValid: boolean;
  error?: string;
}

interface PlatformVideos {
  [key: string]: VideoInput[];
}

interface CreatorDirectVideoSubmissionProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * CreatorDirectVideoSubmission
 * Clean monotone modal for creators to submit videos directly
 * Videos are queued for processing and added to the dashboard
 */
export const CreatorDirectVideoSubmission: React.FC<CreatorDirectVideoSubmissionProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  
  // Initialize state with empty array for each platform
  const [platformVideos, setPlatformVideos] = useState<PlatformVideos>(() => {
    const initial: PlatformVideos = {};
    PLATFORMS.forEach(p => {
      initial[p.id] = [{ id: `${p.id}-1`, url: '', isValid: false }];
    });
    return initial;
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedCount, setSubmittedCount] = useState(0);

  // Handle URL change for a specific platform and video index
  const handleUrlChange = (platformId: PlatformId, videoId: string, url: string) => {
    const platform = PLATFORMS.find(p => p.id === platformId);
    if (!platform) return;

    // Validate URL
    let isValid = false;
    let errorMsg: string | undefined;

    if (url.trim()) {
      const parsed = UrlParserService.parseUrl(url);
      isValid = parsed.platform === platformId;
      
      if (!isValid && parsed.platform) {
        errorMsg = `This looks like a ${parsed.platform} URL. Please paste it in the ${parsed.platform} section.`;
      } else if (!isValid && url.trim()) {
        errorMsg = 'Invalid URL format';
      }
    }

    setPlatformVideos(prev => ({
      ...prev,
      [platformId]: prev[platformId].map(v =>
        v.id === videoId ? { ...v, url, isValid, error: errorMsg } : v
      ),
    }));
  };

  // Add another video input for a platform
  const handleAddVideo = (platformId: PlatformId) => {
    setPlatformVideos(prev => ({
      ...prev,
      [platformId]: [
        ...prev[platformId],
        { id: `${platformId}-${Date.now()}`, url: '', isValid: false },
      ],
    }));
  };

  // Remove a video input
  const handleRemoveVideo = (platformId: PlatformId, videoId: string) => {
    setPlatformVideos(prev => {
      const videos = prev[platformId];
      if (videos.length <= 1) return prev; // Keep at least one input
      return {
        ...prev,
        [platformId]: videos.filter(v => v.id !== videoId),
      };
    });
  };

  // Get total valid videos count
  const getValidVideosCount = () => {
    return Object.values(platformVideos).flat().filter(v => v.isValid).length;
  };

  // Handle submission
  const handleSubmit = async () => {
    if (!currentOrgId || !currentProjectId || !user) {
      setError('Not authenticated. Please refresh and try again.');
      return;
    }

    const validVideos = Object.entries(platformVideos).flatMap(([platformId, videos]) =>
      videos.filter(v => v.isValid).map(v => ({ platform: platformId, url: v.url }))
    );

    if (validVideos.length === 0) {
      setError('Please enter at least one valid video URL');
      return;
    }

    setSubmitting(true);
    setError(null);
    let successCount = 0;

    try {
      // Submit each video for processing
      for (const video of validVideos) {
        try {
          await authenticatedApiService.processVideo(video.url, currentOrgId, currentProjectId);
          successCount++;
        } catch (err: any) {
          console.error(`Failed to submit video: ${video.url}`, err);
          // Continue with other videos
        }
      }

      if (successCount > 0) {
        setSubmittedCount(successCount);
        setSuccess(true);
        
        // Auto-close after success
        setTimeout(() => {
          handleClose();
          onSuccess();
        }, 2000);
      } else {
        setError('Failed to submit videos. Please try again.');
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.message || 'Failed to submit videos');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset and close
  const handleClose = () => {
    // Reset state
    const initial: PlatformVideos = {};
    PLATFORMS.forEach(p => {
      initial[p.id] = [{ id: `${p.id}-1`, url: '', isValid: false }];
    });
    setPlatformVideos(initial);
    setSuccess(false);
    setError(null);
    setSubmittedCount(0);
    onClose();
  };

  if (!isOpen) return null;

  // Success state
  if (success) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#111113] rounded-2xl p-10 max-w-md w-full text-center border border-white/10">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Videos Submitted!</h2>
          <p className="text-gray-400">
            {submittedCount} video{submittedCount !== 1 ? 's' : ''} queued for processing.
            <br />
            <span className="text-sm text-gray-500">They'll appear on your dashboard shortly.</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111113] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/10">
        {/* Header */}
        <div className="sticky top-0 bg-[#111113] border-b border-white/10 px-6 py-5 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-3">
              <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
                <Video className="w-4 h-4 text-white" />
              </div>
              Submit Videos
            </h2>
            <p className="text-sm text-gray-500 mt-1">Add video URLs to track their performance</p>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
          {/* Platform Sections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PLATFORMS.map(platform => (
              <PlatformSection
                key={platform.id}
                platform={platform}
                videos={platformVideos[platform.id]}
                onUrlChange={(videoId, url) => handleUrlChange(platform.id as PlatformId, videoId, url)}
                onAddVideo={() => handleAddVideo(platform.id as PlatformId)}
                onRemoveVideo={(videoId) => handleRemoveVideo(platform.id as PlatformId, videoId)}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#111113] border-t border-white/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {getValidVideosCount() > 0 ? (
                <span className="text-emerald-400">
                  {getValidVideosCount()} video{getValidVideosCount() !== 1 ? 's' : ''} ready
                </span>
              ) : (
                'Paste video URLs above'
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={submitting}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all disabled:opacity-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || getValidVideosCount() === 0}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Submit {getValidVideosCount() > 0 ? getValidVideosCount() : ''} Video{getValidVideosCount() !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Platform Section Component
interface PlatformSectionProps {
  platform: typeof PLATFORMS[number];
  videos: VideoInput[];
  onUrlChange: (videoId: string, url: string) => void;
  onAddVideo: () => void;
  onRemoveVideo: (videoId: string) => void;
}

const PlatformSection: React.FC<PlatformSectionProps> = ({
  platform,
  videos,
  onUrlChange,
  onAddVideo,
  onRemoveVideo,
}) => {
  const validCount = videos.filter(v => v.isValid).length;
  const { Icon } = platform;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-all hover:border-white/20">
      {/* Platform Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white">
            <Icon />
          </div>
          <div>
            <h3 className="font-medium text-white text-sm">{platform.name}</h3>
            {validCount > 0 && (
              <span className="text-xs text-emerald-400">
                {validCount} video{validCount !== 1 ? 's' : ''} ready
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Video Inputs */}
      <div className="space-y-2">
        {videos.map((video) => (
          <div key={video.id} className="group">
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="url"
                  value={video.url}
                  onChange={(e) => onUrlChange(video.id, e.target.value)}
                  placeholder={platform.placeholder}
                  className={`w-full bg-black/40 border ${
                    video.isValid
                      ? 'border-emerald-500/50'
                      : video.error
                      ? 'border-red-500/50'
                      : 'border-white/10'
                  } rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-white/30 transition-all`}
                />
                {video.error && (
                  <p className="mt-1 text-xs text-red-400">{video.error}</p>
                )}
                {video.isValid && (
                  <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Valid URL
                  </p>
                )}
              </div>
              {videos.length > 1 && (
                <button
                  onClick={() => onRemoveVideo(video.id)}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add More Button */}
      <button
        onClick={onAddVideo}
        className="mt-3 w-full py-2 flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all border border-dashed border-white/10 hover:border-white/20"
      >
        <Plus className="w-3.5 h-3.5" />
        Add another video
      </button>
    </div>
  );
};

export default CreatorDirectVideoSubmission;
