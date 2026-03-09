import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { X, RefreshCw, AlertCircle, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PlatformIcon } from '../ui/PlatformIcon';
import { UrlParserService } from '../../services/UrlParserService';

interface ParsedAccount {
  url: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | null;
  username: string | null;
}

interface UsageLimits {
  videosLeft: number;
  accountsLeft: number;
  isAtAccountLimit: boolean;
  isAtVideoLimit: boolean;
}

export type YoutubeVideoType = 'shorts' | 'long' | 'both';

export interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (accounts: Array<{url: string, username: string, platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter', videoCount: number, youtubeVideoType?: YoutubeVideoType}>) => void;
  usageLimits: UsageLimits;
}

function parseAccountUrlsFromText(text: string): ParsedAccount[] {
  if (!text.trim()) return [];
  const lines = text.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
  const accounts: ParsedAccount[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const urlMatch = line.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : line;
    if (!url || seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());

    const parsed = UrlParserService.parseUrl(url);
    const username = parsed.platform ? UrlParserService.extractUsername(url, parsed.platform) : null;
    accounts.push({ url, platform: parsed.platform, username });
  }
  return accounts;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  usageLimits
}) => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<ParsedAccount[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [videoCount, setVideoCount] = useState(10);
  const [showPresets, setShowPresets] = useState(false);
  const [youtubeVideoType, setYoutubeVideoType] = useState<YoutubeVideoType>('both');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const presetsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setAccounts([]);
      setInputValue('');
      setUrlError(null);
      setVideoCount(10);
      setYoutubeVideoType('both');

      const checkClipboard = async () => {
        const parsed = await UrlParserService.autoDetectFromClipboard();
        if (parsed && parsed.isValid && parsed.platform) {
          const username = UrlParserService.extractUsername(parsed.url, parsed.platform);
          setAccounts([{ url: parsed.url, platform: parsed.platform, username }]);
        }
      };
      checkClipboard();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close presets dropdown on outside click
  useEffect(() => {
    if (!showPresets) return;
    const handleClick = (e: MouseEvent) => {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setShowPresets(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPresets]);

  const processInput = useCallback((text: string) => {
    setUrlError(null);
    if (text.includes('\n')) {
      const parsed = parseAccountUrlsFromText(text);
      if (parsed.length > 0) {
        setAccounts(prev => {
          const existing = new Set(prev.map(a => a.url.toLowerCase()));
          const unique = parsed.filter(a => !existing.has(a.url.toLowerCase()));
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;

      const parsed = parseAccountUrlsFromText(trimmed);
      if (parsed.length > 0) {
        setAccounts(prev => {
          const existing = new Set(prev.map(a => a.url.toLowerCase()));
          const unique = parsed.filter(a => !existing.has(a.url.toLowerCase()));
          return [...prev, ...unique];
        });
        setInputValue('');
      }
    }
  }, [inputValue]);

  const removeAccount = useCallback((urlToRemove: string) => {
    setAccounts(prev => prev.filter(a => a.url !== urlToRemove));
  }, []);

  const validAccounts = useMemo(() => accounts.filter(a => a.platform !== null), [accounts]);
  const invalidAccounts = useMemo(() => accounts.filter(a => a.platform === null), [accounts]);

  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of validAccounts) {
      if (a.platform) counts[a.platform] = (counts[a.platform] || 0) + 1;
    }
    return counts;
  }, [validAccounts]);

  const handleSubmit = () => {
    // Process any remaining text in the input
    let allAccounts = [...accounts];
    if (inputValue.trim()) {
      const remaining = parseAccountUrlsFromText(inputValue.trim());
      if (remaining.length > 0) {
        const existing = new Set(allAccounts.map(a => a.url.toLowerCase()));
        const unique = remaining.filter(a => !existing.has(a.url.toLowerCase()));
        allAccounts = [...allAccounts, ...unique];
      }
    }

    const valid = allAccounts.filter(a => a.platform !== null && a.username);
    if (valid.length === 0) {
      setUrlError('Please paste at least one valid account URL');
      return;
    }

    const accountsToAdd = valid.map(a => ({
      url: a.url,
      username: a.username!,
      platform: a.platform!,
      videoCount,
      ...(a.platform === 'youtube' ? { youtubeVideoType } : {})
    }));

    setAccounts([]);
    setInputValue('');
    onClose();
    onAdd(accountsToAdd);
  };

  if (!isOpen) return null;

  const totalCount = validAccounts.length;
  const hasUnlimitedAccess = usageLimits.videosLeft === 999999 || usageLimits.accountsLeft === 999999;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151515] rounded-[14px] w-full max-w-[620px] shadow-2xl" style={{ padding: '24px' }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Track Accounts</h2>
            <p className="text-sm text-[#A1A1AA]">
              Paste account URLs — one per line or a block of links.
            </p>
          </div>
          <button
            onClick={() => { onClose(); setAccounts([]); setInputValue(''); setUrlError(null); }}
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
            {accounts.map((account) => (
              <div
                key={account.url}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg mx-0.5 my-0.5 transition-colors ${
                  account.platform ? 'hover:bg-white/[0.04]' : 'bg-red-500/5'
                }`}
              >
                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                  {account.platform ? (
                    <PlatformIcon platform={account.platform} size="sm" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                </div>
                <span className={`flex-1 truncate text-[13px] font-mono ${
                  account.platform ? 'text-gray-300' : 'text-red-300'
                }`}>
                  {account.username ? `@${account.username}` : account.url}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeAccount(account.url); }}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
                >
                  <X className="w-3 h-3 text-gray-500 hover:text-gray-300" />
                </button>
              </div>
            ))}

            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => processInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={accounts.length === 0
                ? "Paste account URLs here — one per line...\n\nhttps://www.tiktok.com/@username\nhttps://www.instagram.com/username\nhttps://youtube.com/@channel"
                : "Paste more URLs..."
              }
              rows={accounts.length === 0 ? 6 : 2}
              className="w-full px-3 py-2 bg-transparent text-white placeholder-gray-600 focus:outline-none text-[13px] font-mono leading-relaxed resize-none"
            />
          </div>
        </div>

        {/* Settings row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4">
          {/* Video count selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Videos per account:</span>
            <div className="relative" ref={presetsRef}>
              <button
                onClick={() => setShowPresets(!showPresets)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E1E20] border border-gray-700/50 rounded-full text-sm text-white font-medium hover:border-white/20 transition-colors"
              >
                {videoCount}
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {showPresets && (
                <div className="absolute left-0 mt-1 w-32 bg-[#1E1E20] border border-gray-700/50 rounded-lg shadow-xl z-10">
                  {[10, 25, 50, 100, 250, 500, 1000, 2000].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => { setVideoCount(preset); setShowPresets(false); }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-white/5 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                        videoCount === preset ? 'text-white font-medium' : 'text-gray-400'
                      }`}
                    >
                      {preset} videos
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* YouTube video type selector — only visible when YouTube accounts are present */}
          {(platformCounts['youtube'] > 0 || validAccounts.some(a => a.platform === 'youtube') || inputValue.toLowerCase().includes('youtube')) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">YouTube type:</span>
              <div className="flex gap-1 bg-[#1E1E20] border border-gray-700/50 rounded-full p-0.5">
                {([
                  { value: 'shorts', label: 'Shorts' },
                  { value: 'both', label: 'Both' },
                  { value: 'long', label: 'Long' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setYoutubeVideoType(opt.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      youtubeVideoType === opt.value
                        ? 'bg-white text-black'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Summary bar */}
        {accounts.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-400">
                {totalCount} account{totalCount !== 1 ? 's' : ''} detected
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
            {invalidAccounts.length > 0 && (
              <span className="text-[11px] text-red-400">
                {invalidAccounts.length} invalid
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
        {!hasUnlimitedAccess && (() => {
          const totalVideosRequested = totalCount * videoCount;
          const accountsOverLimit = totalCount > usageLimits.accountsLeft;
          const videosOverLimit = totalVideosRequested > usageLimits.videosLeft;
          const accountsToAdd = Math.min(totalCount, usageLimits.accountsLeft);
          const videosToAdd = Math.min(totalVideosRequested, usageLimits.videosLeft);

          if (usageLimits.isAtAccountLimit) {
            return (
              <div className="flex items-start gap-3 px-4 py-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-300 mb-1">Account limit reached!</p>
                  <p className="text-xs text-red-300/80 mb-2">
                    You've reached your maximum of tracked accounts. Upgrade to add more.
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

          if (accountsOverLimit || videosOverLimit) {
            return (
              <div className="flex items-start gap-3 px-4 py-3 mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-300 mb-1">Limit warning</p>
                  <p className="text-xs text-yellow-300/80 mb-2">
                    {accountsOverLimit && (
                      <>Only <span className="font-semibold">{accountsToAdd} of {totalCount} accounts</span> will be tracked. </>
                    )}
                    {videosOverLimit && (
                      <>Only <span className="font-semibold">{videosToAdd} of {totalVideosRequested} videos</span> will be scraped. </>
                    )}
                    You have {usageLimits.accountsLeft} account slots and {usageLimits.videosLeft} video slots remaining.
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
            disabled={usageLimits.isAtAccountLimit || (validAccounts.length === 0 && !inputValue.trim())}
            className="px-5 py-2 text-sm font-bold text-black bg-white rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            {usageLimits.isAtAccountLimit
              ? 'Limit Reached'
              : totalCount > 0
                ? `Track ${totalCount} Account${totalCount !== 1 ? 's' : ''}`
                : 'Track Accounts'}
          </button>
        </div>
      </div>
    </div>
  );
};
