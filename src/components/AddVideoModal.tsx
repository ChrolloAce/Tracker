import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AlertCircle, X, RefreshCw } from 'lucide-react';
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
  url: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | null;
}

/** Parse a block of text into individual video entries */
function parseUrlsFromText(text: string): ParsedVideo[] {
  if (!text.trim()) return [];
  const lines = text.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
  const videos: ParsedVideo[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const urlMatch = line.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : line;
    if (!url || seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    videos.push({ url, platform: UrlParserService.parseUrl(url).platform });
  }
  return videos;
}

export const AddVideoModal: React.FC<AddVideoModalProps> = ({ isOpen, onClose, onAddVideo }) => {
  const { user, currentOrgId } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<ParsedVideo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [videosLeft, setVideosLeft] = useState(999999);
  const [isAtVideoLimit, setIsAtVideoLimit] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset + clipboard check on open
  useEffect(() => {
    if (isOpen) {
      setVideos([]);
      setInputValue('');
      setUrlError(null);

      const checkClipboard = async () => {
        const parsed = await UrlParserService.autoDetectFromClipboard();
        if (parsed && parsed.isValid && parsed.platform) {
          setVideos([{ url: parsed.url, platform: parsed.platform }]);
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

      // Focus the input after a tick
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, currentOrgId, user]);

  // Process input — detect if user pasted multiple lines
  const processInput = useCallback((text: string) => {
    setUrlError(null);
    const hasNewlines = text.includes('\n');

    if (hasNewlines) {
      // Bulk paste — parse all URLs and add them
      const newVideos = parseUrlsFromText(text);
      if (newVideos.length > 0) {
        setVideos(prev => {
          const existing = new Set(prev.map(v => v.url.toLowerCase()));
          const unique = newVideos.filter(v => !existing.has(v.url.toLowerCase()));
          return [...prev, ...unique];
        });
        setInputValue('');
      } else {
        setInputValue(text);
      }
    } else {
      setInputValue(text);
    }
  }, []);

  // Handle Enter key — add current single URL
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;

      const parsed = parseUrlsFromText(trimmed);
      if (parsed.length > 0) {
        setVideos(prev => {
          const existing = new Set(prev.map(v => v.url.toLowerCase()));
          const unique = parsed.filter(v => !existing.has(v.url.toLowerCase()));
          return [...prev, ...unique];
        });
        setInputValue('');
      }
    }
  }, [inputValue]);

  const removeVideo = useCallback((urlToRemove: string) => {
    setVideos(prev => prev.filter(v => v.url !== urlToRemove));
  }, []);

  const validVideos = useMemo(() => videos.filter(v => v.platform !== null), [videos]);
  const invalidVideos = useMemo(() => videos.filter(v => v.platform === null), [videos]);

  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of validVideos) {
      if (v.platform) counts[v.platform] = (counts[v.platform] || 0) + 1;
    }
    return counts;
  }, [validVideos]);

  const handleSubmit = async () => {
    // Also process any remaining text in the input
    if (inputValue.trim()) {
      const remaining = parseUrlsFromText(inputValue.trim());
      if (remaining.length > 0) {
        const existing = new Set(videos.map(v => v.url.toLowerCase()));
        const unique = remaining.filter(v => !existing.has(v.url.toLowerCase()));
        const allVideos = [...videos, ...unique];
        const allValid = allVideos.filter(v => v.platform !== null);

        if (allValid.length === 0) {
          setUrlError('Please paste at least one valid video URL');
          return;
        }

        const groups = allValid.reduce((acc, v) => {
          const p = v.platform!;
          if (!acc[p]) acc[p] = [];
          acc[p].push(v.url);
          return acc;
        }, {} as Record<string, string[]>);

        setVideos([]);
        setInputValue('');
        onClose();

        for (const [platform, urls] of Object.entries(groups)) {
          onAddVideo(platform as any, urls).catch(err => console.error(`Failed to add ${platform} videos:`, err));
        }
        return;
      }
    }

    if (validVideos.length === 0) {
      setUrlError('Please paste at least one valid video URL');
      return;
    }

    const groups = validVideos.reduce((acc, v) => {
      const p = v.platform!;
      if (!acc[p]) acc[p] = [];
      acc[p].push(v.url);
      return acc;
    }, {} as Record<string, string[]>);

    setVideos([]);
    setInputValue('');
    onClose();

    for (const [platform, urls] of Object.entries(groups)) {
      onAddVideo(platform as any, urls).catch(err => console.error(`Failed to add ${platform} videos:`, err));
    }
  };

  if (!isOpen) return null;

  const totalCount = validVideos.length;

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
            onClick={() => { onClose(); setVideos([]); setInputValue(''); setUrlError(null); }}
            className="text-white/80 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Combined input field with inline icons */}
        <div
          ref={containerRef}
          onClick={() => inputRef.current?.focus()}
          className="bg-[#1E1E20] border border-gray-700/50 rounded-xl overflow-hidden cursor-text mb-4 focus-within:ring-1 focus-within:ring-white/20 focus-within:border-white/20 transition-all"
        >
          <div className="max-h-[280px] overflow-y-auto p-1">
            {/* Rendered URL lines with icons */}
            {videos.map((video) => (
              <div
                key={video.url}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg mx-0.5 my-0.5 transition-colors ${
                  video.platform
                    ? 'hover:bg-white/[0.04]'
                    : 'bg-red-500/5'
                }`}
              >
                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                  {video.platform ? (
                    <PlatformIcon platform={video.platform} size="sm" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                </div>
                <span className={`flex-1 truncate text-[13px] font-mono ${
                  video.platform ? 'text-gray-300' : 'text-red-300'
                }`}>
                  {video.url}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeVideo(video.url); }}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
                >
                  <X className="w-3 h-3 text-gray-500 hover:text-gray-300" />
                </button>
              </div>
            ))}

            {/* Inline textarea for new input */}
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => processInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={videos.length === 0
                ? "Paste video URLs here — one per line...\n\nhttps://www.tiktok.com/t/example/\nhttps://www.instagram.com/reel/example/\nhttps://youtube.com/shorts/example"
                : "Paste more URLs..."
              }
              rows={videos.length === 0 ? 6 : 2}
              className="w-full px-3 py-2 bg-transparent text-white placeholder-gray-600 focus:outline-none text-[13px] font-mono leading-relaxed resize-none"
            />
          </div>
        </div>

        {/* Summary bar */}
        {videos.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-400">
                {totalCount} video{totalCount !== 1 ? 's' : ''} detected
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
          const videosOverLimit = totalCount > videosLeft;
          const videosToAdd = Math.min(totalCount, videosLeft);

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
                    Only <span className="font-semibold">{videosToAdd} of {totalCount} videos</span> will be added. You have {videosLeft} video slots remaining.
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
            disabled={isAtVideoLimit || (validVideos.length === 0 && !inputValue.trim())}
            className="px-5 py-2 text-sm font-bold text-black bg-white rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            {isAtVideoLimit
              ? 'Limit Reached'
              : totalCount > 0
                ? `Add ${totalCount} Video${totalCount !== 1 ? 's' : ''}`
                : 'Add Videos'}
          </button>
        </div>
      </div>
    </div>
  );
};
