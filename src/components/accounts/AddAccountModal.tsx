import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { X, RefreshCw, AlertCircle, ChevronDown, UserPlus, Check } from 'lucide-react';
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

export interface CreatorOption {
  id: string;
  displayName: string;
  photoURL?: string;
}

export interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Commit handler. Receives the parsed accounts and an optional `creatorId`
   * the admin picked (or just created) so the parent can link the new tracked
   * accounts to that creator in one shot — no second hop through the
   * AttachCreatorModal. youtubeVideoType is no longer surfaced in the UI and
   * always commits as 'shorts' for any YouTube row.
   */
  onAdd: (
    accounts: Array<{url: string, username: string, platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter', videoCount: number, youtubeVideoType?: YoutubeVideoType}>,
    creatorId?: string,
  ) => void;
  usageLimits: UsageLimits;
  /** Existing creators in the project — populates the inline assignment picker. */
  existingCreators?: CreatorOption[];
  /** Inline create-creator hook. When provided, the picker shows a "Create new
   *  creator" input at the bottom that resolves to a fresh creatorId. */
  onCreateCreator?: (name: string) => Promise<string>;
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
  usageLimits,
  existingCreators = [],
  onCreateCreator,
}) => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<ParsedAccount[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [videoCount, setVideoCount] = useState(10);
  const [showPresets, setShowPresets] = useState(false);
  // Inline creator-assignment state. The picker is a popover anchored to the
  // pill button; when a creator is selected we render a small chip in the
  // header so the admin can see "for X" at a glance and clear it with one
  // click.
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [showCreatorPicker, setShowCreatorPicker] = useState(false);
  const [newCreatorName, setNewCreatorName] = useState('');
  const [creatingCreator, setCreatingCreator] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const presetsRef = useRef<HTMLDivElement>(null);
  const creatorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setAccounts([]);
      setInputValue('');
      setUrlError(null);
      setVideoCount(10);
      setSelectedCreatorId(null);
      setShowCreatorPicker(false);
      setNewCreatorName('');

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

  // Close creator picker on outside click
  useEffect(() => {
    if (!showCreatorPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (creatorPickerRef.current && !creatorPickerRef.current.contains(e.target as Node)) {
        setShowCreatorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showCreatorPicker]);

  const selectedCreator = useMemo(
    () => existingCreators.find(c => c.id === selectedCreatorId) || null,
    [existingCreators, selectedCreatorId],
  );

  const handleCreateCreatorInline = async () => {
    const name = newCreatorName.trim();
    if (!name || !onCreateCreator) return;
    setCreatingCreator(true);
    try {
      const id = await onCreateCreator(name);
      setSelectedCreatorId(id);
      setNewCreatorName('');
      setShowCreatorPicker(false);
    } catch (e: any) {
      console.error('Inline creator-create failed', e);
      alert(`Failed to create creator: ${e?.message || e}`);
    } finally {
      setCreatingCreator(false);
    }
  };

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
    // Block submission if at video or account limit
    if (usageLimits.isAtVideoLimit || usageLimits.isAtAccountLimit) {
      setUrlError('You have reached your plan limit. Please upgrade to continue.');
      return;
    }

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

    // Clamp videoCount to remaining plan capacity
    const clampedVideoCount = hasUnlimitedVideos
      ? videoCount
      : Math.min(videoCount, usageLimits.videosLeft);

    const accountsToAdd = valid.map(a => ({
      url: a.url,
      username: a.username!,
      platform: a.platform!,
      videoCount: clampedVideoCount,
      // YouTube always tracks Shorts now — the long/short/both selector was
      // removed from the UI because it confused admins. The field is still
      // populated downstream for backwards compat with the scraper config.
      ...(a.platform === 'youtube' ? { youtubeVideoType: 'shorts' as const } : {}),
    }));

    setAccounts([]);
    setInputValue('');
    onClose();
    onAdd(accountsToAdd, selectedCreatorId || undefined);
  };

  if (!isOpen) return null;

  const totalCount = validAccounts.length;
  const hasUnlimitedVideos = usageLimits.videosLeft === 999999;
  const hasUnlimitedAccounts = usageLimits.accountsLeft === 999999;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-[14px] w-full max-w-[620px] shadow-2xl" style={{ padding: '24px' }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-content mb-1">Track Accounts</h2>
            <p className="text-sm text-content-muted">
              Paste account URLs — one per line or a block of links.
            </p>
          </div>
          <button
            onClick={() => { onClose(); setAccounts([]); setInputValue(''); setUrlError(null); }}
            className="text-content-muted hover:text-content transition-colors p-1"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Combined input field with inline icons */}
        <div
          ref={containerRef}
          onClick={() => inputRef.current?.focus()}
          className="bg-surface-secondary border border-border rounded-xl overflow-hidden cursor-text mb-4 focus-within:ring-1 focus-within:ring-border-hover focus-within:border-border-hover transition-all"
        >
          <div className="max-h-[280px] overflow-y-auto p-1">
            {accounts.map((account) => (
              <div
                key={account.url}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg mx-0.5 my-0.5 transition-colors ${
                  account.platform ? 'hover:bg-surface-hover' : 'bg-red-500/5'
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
                  account.platform ? 'text-content-muted' : 'text-red-300'
                }`}>
                  {account.username ? `@${account.username}` : account.url}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeAccount(account.url); }}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-surface-active transition-all"
                >
                  <X className="w-3 h-3 text-content-muted hover:text-content" />
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
              className="w-full px-3 py-2 bg-transparent text-content placeholder-content-muted focus:outline-none text-[13px] font-mono leading-relaxed resize-none"
            />
          </div>
        </div>

        {/* Settings row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4">
          {/* Video count selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-content-muted">Videos per account:</span>
            <div className="relative" ref={presetsRef}>
              <button
                onClick={() => setShowPresets(!showPresets)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-secondary border border-border rounded-full text-sm text-content font-medium hover:border-border-hover transition-colors"
              >
                {videoCount}
                <ChevronDown className="w-3.5 h-3.5 text-content-muted" />
              </button>
              {showPresets && (
                <div className="absolute left-0 mt-1 w-32 bg-surface-secondary border border-border rounded-lg shadow-xl z-10">
                  {[10, 25, 50, 100, 250, 500, 1000, 2000]
                    .filter((preset) => hasUnlimitedVideos || preset <= usageLimits.videosLeft)
                    .map((preset) => (
                    <button
                      key={preset}
                      onClick={() => { setVideoCount(preset); setShowPresets(false); }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-surface-hover first:rounded-t-lg last:rounded-b-lg transition-colors ${
                        videoCount === preset ? 'text-content font-medium' : 'text-content-muted'
                      }`}
                    >
                      {preset} videos
                    </button>
                  ))}
                  {!hasUnlimitedVideos && usageLimits.videosLeft < 2000 && (
                    <div className="px-3 py-2 text-[11px] text-content-muted border-t border-border">
                      {usageLimits.videosLeft} videos remaining on your plan
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Inline creator-assignment picker. When set, the new accounts get
              linked to this creator immediately on commit so the admin doesn't
              have to bounce through AttachCreatorModal afterwards. */}
          <div className="flex items-center gap-2 relative" ref={creatorPickerRef}>
            <span className="text-xs text-content-muted">Creator:</span>
            {selectedCreator ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/30 rounded-full">
                {selectedCreator.photoURL ? (
                  <img src={selectedCreator.photoURL} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-[9px] font-bold text-white">
                    {(selectedCreator.displayName || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-semibold text-content max-w-[140px] truncate">
                  {selectedCreator.displayName}
                </span>
                <button
                  onClick={() => setShowCreatorPicker(s => !s)}
                  className="text-[10px] text-content-muted hover:text-content uppercase tracking-wider"
                >
                  change
                </button>
                <button
                  onClick={() => setSelectedCreatorId(null)}
                  className="p-0.5 text-content-muted hover:text-content"
                  aria-label="Clear creator"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCreatorPicker(s => !s)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-secondary border border-border rounded-full text-xs font-medium text-content-muted hover:text-content hover:border-border-strong transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Assign to creator
              </button>
            )}

            {showCreatorPicker && (
              <div
                className="absolute left-0 top-full mt-2 w-72 bg-surface border border-border rounded-xl shadow-2xl z-20 overflow-hidden"
              >
                {existingCreators.length > 0 && (
                  <div className="max-h-56 overflow-y-auto py-1">
                    {existingCreators.map(c => {
                      const isPicked = c.id === selectedCreatorId;
                      return (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedCreatorId(c.id); setShowCreatorPicker(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover ${
                            isPicked ? 'bg-surface-hover' : ''
                          }`}
                        >
                          {c.photoURL ? (
                            <img src={c.photoURL} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                              {(c.displayName || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="flex-1 text-sm text-content truncate">{c.displayName}</span>
                          {isPicked && <Check className="w-4 h-4 text-orange-500" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {onCreateCreator && (
                  <div className={`p-2 ${existingCreators.length > 0 ? 'border-t border-border-subtle' : ''} bg-surface-secondary`}>
                    <div className="text-[10px] font-semibold text-content-muted uppercase tracking-wider mb-1.5">
                      New creator
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        value={newCreatorName}
                        onChange={(e) => setNewCreatorName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCreatorInline(); } }}
                        placeholder="Creator name"
                        className="flex-1 px-2.5 py-1.5 rounded-md bg-surface border border-border text-xs text-content placeholder:text-content-muted focus:outline-none focus:border-border-strong"
                      />
                      <button
                        onClick={handleCreateCreatorInline}
                        disabled={creatingCreator || !newCreatorName.trim()}
                        className="px-2.5 py-1.5 rounded-md bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-bold"
                      >
                        {creatingCreator ? '…' : 'Create'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Summary bar */}
        {accounts.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-content-muted">
                {totalCount} account{totalCount !== 1 ? 's' : ''} detected
              </span>
              <div className="flex items-center gap-2">
                {Object.entries(platformCounts).map(([platform, count]) => (
                  <div key={platform} className="flex items-center gap-1 px-2 py-0.5 bg-surface-hover rounded-full">
                    <PlatformIcon platform={platform as any} size="sm" />
                    <span className="text-[11px] text-content-muted font-medium">{count}</span>
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

        {/* Usage limit warnings — hidden, paywall handles gatekeeping */}
        {false && !(hasUnlimitedVideos && hasUnlimitedAccounts) && (() => {
          const totalVideosRequested = totalCount * videoCount;
          const accountsOverLimit = totalCount > usageLimits.accountsLeft;
          const videosOverLimit = totalVideosRequested > usageLimits.videosLeft;
          const accountsToAdd = Math.min(totalCount, usageLimits.accountsLeft);
          const videosToAdd = Math.min(totalVideosRequested, usageLimits.videosLeft);

          if (usageLimits.isAtAccountLimit || usageLimits.isAtVideoLimit) {
            const limitType = usageLimits.isAtAccountLimit ? 'Account' : 'Video';
            return (
              <div className="flex items-start gap-3 px-4 py-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-300 mb-1">{limitType} limit reached!</p>
                  <p className="text-xs text-red-300/80 mb-2">
                    You've reached your maximum of tracked {limitType.toLowerCase()}s. Upgrade to add more.
                  </p>
                  <button
                    onClick={() => navigate('/subscription')}
                    className="text-xs font-medium text-content bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-md transition-colors"
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
                    className="text-xs font-medium text-content bg-yellow-500/20 hover:bg-yellow-500/30 px-3 py-1.5 rounded-md transition-colors"
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
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-content-muted text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Processing takes up to 5 minutes.</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={usageLimits.isAtAccountLimit || usageLimits.isAtVideoLimit || (validAccounts.length === 0 && !inputValue.trim())}
            className="px-5 py-2 text-sm font-bold text-white bg-orange-500 rounded-lg shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
          >
            {usageLimits.isAtAccountLimit || usageLimits.isAtVideoLimit
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
