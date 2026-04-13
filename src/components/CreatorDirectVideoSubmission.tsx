import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, AlertCircle, Check, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UrlParserService } from '../services/UrlParserService';
import { PlatformIcon } from './ui/PlatformIcon';
import authenticatedApiService from '../services/AuthenticatedApiService';

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

interface CreatorDirectVideoSubmissionProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** When set, videos are attributed to this creator instead of the current user */
  assignedCreatorId?: string;
}

/**
 * CreatorDirectVideoSubmission
 * 
 * Bulk-paste modal for creators to submit videos.
 * Matches the admin AddVideoModal design — single textarea,
 * auto-detect platform, inline icons per parsed URL.
 */
export const CreatorDirectVideoSubmission: React.FC<CreatorDirectVideoSubmissionProps> = ({
  isOpen,
  onClose,
  onSuccess,
  assignedCreatorId,
}) => {
  const { user, currentOrgId, currentProjectId } = useAuth();

  const [videos, setVideos] = useState<ParsedVideo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset + clipboard check on open
  useEffect(() => {
    if (isOpen) {
      setVideos([]);
      setInputValue('');
      setUrlError(null);
      setSuccess(false);
      setSubmittedCount(0);

      const checkClipboard = async () => {
        try {
          const parsed = await UrlParserService.autoDetectFromClipboard();
          if (parsed && parsed.isValid && parsed.platform) {
            setVideos([{ url: parsed.url, platform: parsed.platform }]);
          }
        } catch {
          // Clipboard not available — ignore
        }
      };
      checkClipboard();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Process input — detect if user pasted multiple lines
  const processInput = useCallback((text: string) => {
    setUrlError(null);
    const hasNewlines = text.includes('\n');

    if (hasNewlines) {
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

  // Collect all valid videos (including any remaining input text)
  const collectAllValid = useCallback((): ParsedVideo[] => {
    let allVideos = [...videos];
    if (inputValue.trim()) {
      const remaining = parseUrlsFromText(inputValue.trim());
      if (remaining.length > 0) {
        const existing = new Set(allVideos.map(v => v.url.toLowerCase()));
        const unique = remaining.filter(v => !existing.has(v.url.toLowerCase()));
        allVideos = [...allVideos, ...unique];
      }
    }
    return allVideos.filter(v => v.platform !== null);
  }, [videos, inputValue]);

  const handleSubmit = async () => {
    if (!currentOrgId || !currentProjectId || !user) {
      setUrlError('Not authenticated. Please refresh and try again.');
      return;
    }

    const allValid = collectAllValid();

    if (allValid.length === 0) {
      setUrlError('Please paste at least one valid video URL');
      return;
    }

    setSubmitting(true);
    setUrlError(null);
    let successCount = 0;

    try {
      for (const video of allValid) {
        try {
          await authenticatedApiService.processVideo(video.url, currentOrgId, currentProjectId, undefined, assignedCreatorId || user.uid);
          successCount++;
        } catch (err: any) {
          console.error(`Failed to submit video: ${video.url}`, err);
        }
      }

      if (successCount > 0) {
        setSubmittedCount(successCount);
        setSuccess(true);
        setTimeout(() => {
          handleClose();
          onSuccess();
        }, 2000);
      } else {
        setUrlError('Failed to submit videos. Please try again.');
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      setUrlError(err.message || 'Failed to submit videos');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setVideos([]);
    setInputValue('');
    setUrlError(null);
    setSuccess(false);
    setSubmittedCount(0);
    onClose();
  };

  if (!isOpen) return null;

  // ─── Success state ───
  if (success) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-surface-secondary rounded-2xl p-10 max-w-md w-full text-center border border-border">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-content mb-3">Videos Submitted!</h2>
          <p className="text-content-muted">
            {submittedCount} video{submittedCount !== 1 ? 's' : ''} queued for processing.
            <br />
            <span className="text-sm text-content-muted">They'll appear on your dashboard shortly.</span>
          </p>
        </div>
      </div>
    );
  }

  const totalCount = validVideos.length;

  // ─── Main modal ───
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-secondary rounded-2xl w-full max-w-[620px] shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-content">Submit Videos</h2>
            <p className="text-sm text-content-muted mt-0.5">
              Paste video URLs — one per line or a block of links.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-content-muted hover:text-content hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Combined input field with inline icons */}
          <div
            ref={containerRef}
            onClick={() => inputRef.current?.focus()}
            className="bg-surface-tertiary border border-border rounded-xl overflow-hidden cursor-text mb-4 focus-within:ring-2 focus-within:ring-border-strong focus-within:border-border-strong transition-all"
          >
            <div className="max-h-[280px] overflow-y-auto p-1">
              {/* Rendered URL lines with icons */}
              {videos.map((video) => (
                <div
                  key={video.url}
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg mx-0.5 my-0.5 transition-colors ${
                    video.platform
                      ? 'hover:bg-surface-hover'
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
                    video.platform ? 'text-content-secondary' : 'text-red-300'
                  }`}>
                    {video.url}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeVideo(video.url); }}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-surface-active transition-all"
                  >
                    <X className="w-3 h-3 text-content-muted hover:text-content" />
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
                className="w-full px-3 py-2 bg-transparent text-content placeholder-content-muted focus:outline-none text-[13px] font-mono leading-relaxed resize-none"
              />
            </div>
          </div>

          {/* Summary bar */}
          {videos.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-content-muted">
                  {totalCount} video{totalCount !== 1 ? 's' : ''} detected
                </span>
                <div className="flex items-center gap-2">
                  {Object.entries(platformCounts).map(([platform, count]) => (
                    <div key={platform} className="flex items-center gap-1 px-2 py-0.5 bg-surface-tertiary rounded-full border border-border">
                      <PlatformIcon platform={platform as any} size="sm" />
                      <span className="text-[11px] text-content-secondary font-medium">{count}</span>
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-5 border-t border-border">
          <div className="flex items-center gap-2 text-content-muted text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Processing takes up to 5 minutes.</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2.5 text-sm font-semibold text-content bg-surface-secondary border border-border rounded-lg shadow-[0_2px_0_0_var(--border)] hover:shadow-[0_1px_0_0_var(--border)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || (validVideos.length === 0 && !inputValue.trim())}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-orange-500 rounded-lg shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : totalCount > 0 ? (
                `Submit ${totalCount} Video${totalCount !== 1 ? 's' : ''}`
              ) : (
                'Submit Videos'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorDirectVideoSubmission;
