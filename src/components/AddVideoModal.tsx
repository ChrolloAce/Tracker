import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AlertCircle, X, RefreshCw, Trash2 } from 'lucide-react';
import { PlatformIcon } from './ui/PlatformIcon';
import { UrlParserService } from '../services/UrlParserService';
import UsageTrackingService from '../services/UsageTrackingService';
import AdminService from '../services/AdminService';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface AddVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVideo: (platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter', videoUrls: string[]) => Promise<void>;
}

interface ParsedVideo {
  id: string;
  url: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | null;
}

export const AddVideoModal: React.FC<AddVideoModalProps> = ({ isOpen, onClose, onAddVideo }) => {
  const { user, currentOrgId } = useAuth();
  const navigate = useNavigate();
  const [rawText, setRawText] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [videosLeft, setVideosLeft] = useState(999999);
  const [isAtVideoLimit, setIsAtVideoLimit] = useState(false);

  // Auto-detect URL from clipboard when modal opens
  useEffect(() => {
    if (isOpen) {
      const checkClipboard = async () => {
        const parsed = await UrlParserService.autoDetectFromClipboard();
        if (parsed && parsed.isValid && parsed.platform) {
          setRawText(parsed.url);
        }
      };
      checkClipboard();

      if (currentOrgId && user) {
        const checkLimits = async () => {
          const shouldBypass = await AdminService.shouldBypassLimits(user.uid);
          if (shouldBypass) {
            setVideosLeft(999999);
            setIsAtVideoLimit(false);
          } else {
            const usage = await UsageTrackingService.getUsage(currentOrgId);
            const limits = await UsageTrackingService.getLimits(currentOrgId);
            const left = limits.maxVideos === -1 ? 999999 : Math.max(0, limits.maxVideos - usage.trackedVideos);
            setVideosLeft(left);
            setIsAtVideoLimit(left === 0);
          }
        };
        checkLimits();
      }
    } else {
      setRawText('');
      setUrlError(null);
    }
  }, [isOpen, currentOrgId, user]);

  // Parse URLs from the raw text
  const parsedVideos: ParsedVideo[] = useMemo(() => {
    if (!rawText.trim()) return [];

    // Split by newlines, commas, or spaces — then filter to actual URLs
    const lines = rawText
      .split(/[\n,]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const videos: ParsedVideo[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      // Extract URLs from the line (handles lines with extra text)
      const urlMatch = line.match(/https?:\/\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : line;

      if (!url || seen.has(url.toLowerCase())) continue;
      seen.add(url.toLowerCase());

      const parsed = UrlParserService.parseUrl(url);
      videos.push({
        id: `${Date.now()}-${videos.length}`,
        url,
        platform: parsed.platform,
      });
    }

    return videos;
  }, [rawText]);

  const validVideos = useMemo(() => parsedVideos.filter(v => v.platform !== null), [parsedVideos]);
  const invalidVideos = useMemo(() => parsedVideos.filter(v => v.platform === null), [parsedVideos]);

  // Platform summary
  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of validVideos) {
      if (v.platform) {
        counts[v.platform] = (counts[v.platform] || 0) + 1;
      }
    }
    return counts;
  }, [validVideos]);

  const removeUrl = useCallback((urlToRemove: string) => {
    // Remove the URL line from the raw text
    const lines = rawText.split('\n');
    const filtered = lines.filter(line => {
      const match = line.trim().match(/https?:\/\/[^\s]+/);
      return match ? match[0] !== urlToRemove : line.trim() !== urlToRemove;
    });
    setRawText(filtered.join('\n'));
  }, [rawText]);

  const handleSubmit = async () => {
    if (validVideos.length === 0) {
      setUrlError('Please paste at least one valid video URL');
      return;
    }

    // Group by platform
    const platformGroups = validVideos.reduce((acc, v) => {
      const platform = v.platform!;
      if (!acc[platform]) acc[platform] = [];
      acc[platform].push(v.url);
      return acc;
    }, {} as Record<string, string[]>);

    // Reset and close
    setRawText('');
    onClose();

    // Process videos for each platform in background
    for (const [platform, urls] of Object.entries(platformGroups)) {
      onAddVideo(platform as any, urls).catch(error => {
        console.error(`Failed to add ${platform} videos:`, error);
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151515] rounded-[14px] w-full max-w-[620px] shadow-2xl" style={{ padding: '24px' }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Add Videos</h2>
            <p className="text-sm text-[#A1A1AA]">
              Paste video URLs — one per line or a block of links.
            </p>
          </div>
          <button
            onClick={() => { onClose(); setRawText(''); setUrlError(null); }}
            className="text-white/80 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Bulk Textarea */}
        <div className="relative mb-4">
          <textarea
            value={rawText}
            onChange={(e) => { setRawText(e.target.value); setUrlError(null); }}
            placeholder={`Paste video URLs here — one per line:\n\nhttps://www.tiktok.com/t/example1/\nhttps://www.instagram.com/reel/example2/\nhttps://youtube.com/shorts/example3`}
            rows={7}
            className="w-full px-4 py-3 bg-[#1E1E20] border border-gray-700/50 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 text-sm font-mono leading-relaxed resize-none"
            autoFocus
          />
        </div>

        {/* Parsed URLs Preview */}
        {parsedVideos.length > 0 && (
          <div className="mb-4">
            {/* Summary bar */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-400">
                  {validVideos.length} video{validVideos.length !== 1 ? 's' : ''} detected
                </span>
                <div className="flex items-center gap-2">
                  {Object.entries(platformCounts).map(([platform, count]) => (
                    <div key={platform} className="flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded-full">
                      <PlatformIcon platform={platform as any} size="sm" />
                      <span className="text-[11px] text-gray-300 font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              {invalidVideos.length > 0 && (
                <span className="text-[11px] text-red-400">
                  {invalidVideos.length} invalid
                </span>
              )}
            </div>

            {/* URL list */}
            <div className="max-h-[200px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {parsedVideos.map((video) => (
                <div
                  key={video.url}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    video.platform
                      ? 'bg-white/[0.03] border border-white/[0.06]'
                      : 'bg-red-500/5 border border-red-500/10'
                  }`}
                >
                  {/* Platform icon */}
                  <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    {video.platform ? (
                      <PlatformIcon platform={video.platform} size="sm" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>

                  {/* URL */}
                  <span className={`flex-1 truncate font-mono text-xs ${
                    video.platform ? 'text-gray-300' : 'text-red-300'
                  }`}>
                    {video.url}
                  </span>

                  {/* Remove button */}
                  <button
                    onClick={() => removeUrl(video.url)}
                    className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors group"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-300" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Validation error */}
        {urlError && (
          <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-300">{urlError}</span>
          </div>
        )}

        {/* Usage limit warnings */}
        {(() => {
          const videosOverLimit = validVideos.length > videosLeft;
          const videosToAdd = Math.min(validVideos.length, videosLeft);

          if (isAtVideoLimit) {
            return (
              <div className="flex items-start gap-3 px-4 py-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-300 mb-1">Video limit reached!</p>
                  <p className="text-xs text-red-300/80 mb-2">
                    You've reached your maximum of tracked videos. Upgrade to add more.
                  </p>
                  <button
                    onClick={() => navigate('/subscription')}
                    className="text-xs font-medium text-white bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-md transition-colors"
                  >
                    Upgrade Plan →
                  </button>
                </div>
              </div>
            );
          }

          if (videosOverLimit) {
            return (
              <div className="flex items-start gap-3 px-4 py-3 mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-300 mb-1">Limit warning</p>
                  <p className="text-xs text-yellow-300/80 mb-2">
                    Only <span className="font-semibold">{videosToAdd} of {validVideos.length} videos</span> will be added. You have {videosLeft} video slots remaining.
                  </p>
                  <button
                    onClick={() => navigate('/subscription')}
                    className="text-xs font-medium text-white bg-yellow-500/20 hover:bg-yellow-500/30 px-3 py-1.5 rounded-md transition-colors"
                  >
                    Upgrade for More →
                  </button>
                </div>
              </div>
            );
          }

          return null;
        })()}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-800/50">
          <div className="flex items-center gap-2 text-[#9B9B9B] text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Processing takes up to 5 minutes.</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isAtVideoLimit || validVideos.length === 0}
            className="px-5 py-2 text-sm font-bold text-black bg-white rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            {isAtVideoLimit
              ? 'Limit Reached'
              : validVideos.length > 0
                ? `Add ${validVideos.length} Video${validVideos.length !== 1 ? 's' : ''}`
                : 'Add Videos'}
          </button>
        </div>
      </div>
    </div>
  );
};
