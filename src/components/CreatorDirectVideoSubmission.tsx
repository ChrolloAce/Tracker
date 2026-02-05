import React, { useState } from 'react';
import { X, Plus, Trash2, Check, Loader2, Video, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UrlParserService } from '../services/UrlParserService';
import AuthenticatedApiService from '../services/AuthenticatedApiService';

// Platform configuration
const PLATFORMS = [
  {
    id: 'instagram',
    name: 'Instagram',
    color: 'from-pink-500 to-purple-600',
    borderColor: 'border-pink-500/30',
    bgColor: 'bg-pink-500/10',
    textColor: 'text-pink-400',
    icon: '📸',
    placeholder: 'https://instagram.com/reel/...',
    urlPattern: /instagram\.com/,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    color: 'from-cyan-400 to-pink-500',
    borderColor: 'border-cyan-500/30',
    bgColor: 'bg-cyan-500/10',
    textColor: 'text-cyan-400',
    icon: '🎵',
    placeholder: 'https://tiktok.com/@user/video/...',
    urlPattern: /tiktok\.com/,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    color: 'from-red-500 to-red-600',
    borderColor: 'border-red-500/30',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    icon: '▶️',
    placeholder: 'https://youtube.com/shorts/... or https://youtu.be/...',
    urlPattern: /youtube\.com|youtu\.be/,
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    color: 'from-gray-600 to-gray-800',
    borderColor: 'border-gray-500/30',
    bgColor: 'bg-gray-500/10',
    textColor: 'text-gray-400',
    icon: '𝕏',
    placeholder: 'https://x.com/user/status/... or https://twitter.com/...',
    urlPattern: /twitter\.com|x\.com/,
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
 * Beautiful minimalist modal for creators to submit videos directly
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
      const apiService = new AuthenticatedApiService();

      // Submit each video for processing
      for (const video of validVideos) {
        try {
          await apiService.processVideo(video.url, currentOrgId, currentProjectId);
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-[#0A0A0B] rounded-3xl p-10 max-w-md w-full text-center border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Videos Submitted!</h2>
          <p className="text-gray-400 text-lg">
            {submittedCount} video{submittedCount !== 1 ? 's' : ''} queued for processing.
            <br />
            <span className="text-sm text-gray-500">They'll appear on your dashboard shortly.</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#0A0A0B] rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-[#0A0A0B]/95 backdrop-blur border-b border-white/5 px-8 py-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              Submit Videos
            </h2>
            <p className="text-sm text-gray-500 mt-1">Add video URLs to track their performance</p>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Platform Sections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <div className="mt-6 bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#0A0A0B]/95 backdrop-blur border-t border-white/5 px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {getValidVideosCount() > 0 ? (
                <span className="text-emerald-400 font-medium">
                  {getValidVideosCount()} video{getValidVideosCount() !== 1 ? 's' : ''} ready to submit
                </span>
              ) : (
                'Paste video URLs above'
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={submitting}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all disabled:opacity-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || getValidVideosCount() === 0}
                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-emerald-500/25 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-5 h-5" />
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

  return (
    <div className={`rounded-2xl border ${platform.borderColor} ${platform.bgColor} p-5 transition-all hover:border-opacity-50`}>
      {/* Platform Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${platform.color} flex items-center justify-center text-lg shadow-lg`}>
            {platform.icon}
          </div>
          <div>
            <h3 className="font-semibold text-white">{platform.name}</h3>
            {validCount > 0 && (
              <span className={`text-xs ${platform.textColor}`}>
                {validCount} video{validCount !== 1 ? 's' : ''} ready
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Video Inputs */}
      <div className="space-y-3">
        {videos.map((video, index) => (
          <div key={video.id} className="group">
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="url"
                  value={video.url}
                  onChange={(e) => onUrlChange(video.id, e.target.value)}
                  placeholder={platform.placeholder}
                  className={`w-full bg-black/30 border ${
                    video.isValid
                      ? 'border-emerald-500/50 focus:border-emerald-500'
                      : video.error
                      ? 'border-red-500/50'
                      : 'border-white/10 focus:border-white/30'
                  } rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all`}
                />
                {video.error && (
                  <p className="mt-1.5 text-xs text-red-400">{video.error}</p>
                )}
                {video.isValid && (
                  <p className="mt-1.5 text-xs text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Valid {platform.name} URL
                  </p>
                )}
              </div>
              {videos.length > 1 && (
                <button
                  onClick={() => onRemoveVideo(video.id)}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all opacity-0 group-hover:opacity-100"
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
        className={`mt-3 w-full py-2.5 flex items-center justify-center gap-2 text-sm ${platform.textColor} hover:bg-white/5 rounded-xl transition-all border border-dashed border-white/10 hover:border-white/20`}
      >
        <Plus className="w-4 h-4" />
        Add another video
      </button>
    </div>
  );
};

export default CreatorDirectVideoSubmission;
