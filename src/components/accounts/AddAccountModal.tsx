import React, { useState, useCallback, useEffect } from 'react';
import { X, ChevronDown, LinkIcon, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PlatformIcon } from '../ui/PlatformIcon';
import { UrlParserService } from '../../services/UrlParserService';

interface AccountInput {
  id: string;
  url: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | null;
  error: string | null;
  videoCount: number;
}

interface UsageLimits {
  videosLeft: number;
  accountsLeft: number;
  isAtAccountLimit: boolean;
  isAtVideoLimit: boolean;
}

export interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (accounts: Array<{url: string, username: string, platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter', videoCount: number}>) => void;
  usageLimits: UsageLimits;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  usageLimits
}) => {
  const navigate = useNavigate();
  const [newAccountUrl, setNewAccountUrl] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<'instagram' | 'tiktok' | 'youtube' | 'twitter' | null>(null);
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);
  const [accountInputs, setAccountInputs] = useState<AccountInput[]>([
    { id: '1', url: '', platform: null, error: null, videoCount: 10 }
  ]);

  // Auto-detect account URL from clipboard when modal opens
  useEffect(() => {
    if (isOpen) {
      const checkClipboard = async () => {
        const parsed = await UrlParserService.autoDetectFromClipboard();
        
        if (parsed && parsed.isValid && parsed.platform) {
          setNewAccountUrl(parsed.url);
          setDetectedPlatform(parsed.platform);
      }
    };

      checkClipboard();
    }
  }, [isOpen]);

  // Handle URL input change and auto-detect platform
  const handleUrlChange = useCallback((url: string) => {
    setNewAccountUrl(url);
    setUrlValidationError(null);
    
    if (!url.trim()) {
      setDetectedPlatform(null);
      return;
    }
    
    const parsed = UrlParserService.parseUrl(url);
    
    if (parsed.platform) {
      setDetectedPlatform(parsed.platform);
      setUrlValidationError(null);
    } else if (url.trim().length > 5) {
      setDetectedPlatform(null);
      setUrlValidationError('Please enter a valid Instagram, TikTok, YouTube, or Twitter URL');
    }
  }, []);

  const handleAddAccount = useCallback(() => {
    // Collect all valid accounts from ALL inputs
    const accountsToAdd: Array<{
      url: string;
      username: string;
      platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
      videoCount: number;
    }> = [];
    
    for (let i = 0; i < accountInputs.length; i++) {
      const input = accountInputs[i];
      const url = (i === 0 ? newAccountUrl : input.url).trim();
      const platform = i === 0 ? detectedPlatform : input.platform;
      const videoCount = input.videoCount;
      
      if (url && platform) {
        const username = UrlParserService.extractUsername(url, platform);
        if (username) {
          accountsToAdd.push({ url, username, platform, videoCount });
        }
      }
    }
    
    if (accountsToAdd.length === 0) {
      setUrlValidationError('Please enter at least one valid account URL.');
      return;
    }

    // Call onAdd prop and close immediately
    onAdd(accountsToAdd);

    // Reset form
        setNewAccountUrl('');
        setDetectedPlatform(null);
        setUrlValidationError(null);
        setAccountInputs([{ id: '1', url: '', platform: null, error: null, videoCount: 10 }]);
        onClose();
  }, [accountInputs, newAccountUrl, detectedPlatform, onClose, onAdd]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151515] rounded-[14px] w-full max-w-[580px] shadow-2xl" style={{ padding: '24px' }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Track Accounts</h2>
            <p className="text-sm text-[#A1A1AA]">Enter accounts you want to track videos & analytics for.</p>
          </div>
          <button
            onClick={() => {
              setNewAccountUrl('');
              setDetectedPlatform(null);
              setUrlValidationError(null);
              setAccountInputs([{ id: '1', url: '', platform: null, error: null, videoCount: 10 }]);
              onClose();
            }}
            className="text-white/80 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        
        {/* Input Fields - Multiple */}
        <div className="space-y-3 mb-6 max-h-[400px] overflow-y-auto">
          {accountInputs.map((input, index) => (
            <div key={input.id} className="flex gap-2 items-start">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={index === 0 ? newAccountUrl : input.url}
                  onChange={(e) => {
                    if (index === 0) {
                      handleUrlChange(e.target.value);
                      // Also update accountInputs[0] for consistency
                      const newInputs = [...accountInputs];
                      newInputs[0].url = e.target.value;
                      const result = UrlParserService.parseUrl(e.target.value);
                      newInputs[0].platform = result.platform || null;
                      newInputs[0].error = !result.isValid && e.target.value.trim() ? 'Invalid URL' : null;
                      setAccountInputs(newInputs);
                    } else {
                      const newInputs = [...accountInputs];
                      newInputs[index].url = e.target.value;
                      // Detect platform
                      const result = UrlParserService.parseUrl(e.target.value);
                      newInputs[index].platform = result.platform || null;
                      newInputs[index].error = !result.isValid && e.target.value.trim() ? 'Invalid URL' : null;
                      setAccountInputs(newInputs);
                    }
                  }}
                  placeholder="Enter TikTok, YouTube, Instagram, or X URL"
                  className="w-full pl-4 pr-10 py-2.5 bg-[#1E1E20] border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 text-sm"
                />
                {(index === 0 ? detectedPlatform : input.platform) ? (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <PlatformIcon platform={index === 0 ? detectedPlatform! : input.platform!} size="sm" />
                  </div>
                ) : (
                  <LinkIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
                )}
              </div>
              
              {/* Video count input with dropdown presets */}
              <div className="relative">
                <input
                  type="number"
                  value={input.videoCount}
                  onChange={(e) => {
                    const value = Math.max(1, Math.min(5000, Number(e.target.value) || 10));
                    const newInputs = [...accountInputs];
                    newInputs[index].videoCount = value;
                    setAccountInputs(newInputs);
                  }}
                  min="1"
                  max="5000"
                  className="w-20 pl-3 pr-8 py-2.5 bg-[#1E1E20] border border-gray-700/50 rounded-full text-white text-sm font-medium text-center focus:outline-none focus:ring-1 focus:ring-white/20"
                />
                <div className="relative inline-block">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const btn = e.currentTarget;
                      const dropdown = btn.nextElementSibling as HTMLElement;
                      if (dropdown) {
                        dropdown.classList.toggle('hidden');
                      }
                    }}
                    onBlur={(e) => {
                      // Delay to allow click on dropdown items
                      setTimeout(() => {
                        const dropdown = e.currentTarget.nextElementSibling as HTMLElement;
                        if (dropdown && !dropdown.matches(':hover')) {
                          dropdown.classList.add('hidden');
                        }
                      }, 150);
                    }}
                    className="ml-1 p-2.5 bg-[#1E1E20] border border-gray-700/50 rounded-full text-gray-400 hover:text-white hover:bg-[#252528] transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <div className="hidden absolute right-0 mt-1 w-32 bg-[#1E1E20] border border-gray-700/50 rounded-lg shadow-xl z-10">
                    {[10, 25, 50, 100, 250, 500, 1000, 2000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const newInputs = [...accountInputs];
                          newInputs[index].videoCount = preset;
                          setAccountInputs(newInputs);
                          // Close dropdown
                          const dropdown = e.currentTarget.parentElement;
                          if (dropdown) dropdown.classList.add('hidden');
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5 first:rounded-t-lg last:rounded-b-lg transition-colors"
                      >
                        {preset} videos
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Delete button for additional inputs */}
              {index > 0 && (
                <button
                  onClick={() => {
                    setAccountInputs(prev => prev.filter(i => i.id !== input.id));
                  }}
                  className="p-2.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )}
              {/* Spacer for first input when alone */}
              {index === 0 && accountInputs.length === 1 && (
                <div className="w-10" /> 
              )}
            </div>
          ))}

          {/* Show validation error */}
          {urlValidationError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-300">
                {urlValidationError}
              </span>
            </div>
          )}

          {/* Usage Limit Warnings */}
          {(() => {
            const validAccountsCount = accountInputs.filter(input => input.url.trim() && input.platform).length;
            const totalVideosRequested = accountInputs.reduce((sum, input) => {
              if (input.url.trim() && input.platform) {
                return sum + input.videoCount;
              }
              return sum;
            }, 0);

            // Skip limit warnings if user has unlimited access (demo/admin)
            const hasUnlimitedAccess = usageLimits.videosLeft === 999999 || usageLimits.accountsLeft === 999999;
            
            if (hasUnlimitedAccess) {
              // Demo/Admin user - no limit warnings
              return null;
            }

            const accountsOverLimit = validAccountsCount > usageLimits.accountsLeft;
            const videosOverLimit = totalVideosRequested > usageLimits.videosLeft;
            const accountsToAdd = Math.min(validAccountsCount, usageLimits.accountsLeft);
            const videosToAdd = Math.min(totalVideosRequested, usageLimits.videosLeft);

            if (usageLimits.isAtAccountLimit) {
              return (
                <div className="flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-300 mb-1">
                      Account limit reached!
                    </p>
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
                <div className="flex items-start gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-300 mb-1">
                      Limit warning
                    </p>
                    <p className="text-xs text-yellow-300/80 mb-2">
                      {accountsOverLimit && (
                        <>Only <span className="font-semibold">{accountsToAdd} of {validAccountsCount} accounts</span> will be tracked. </>
                      )}
                      {videosOverLimit && (
                        <>Only <span className="font-semibold">{videosToAdd} of {totalVideosRequested} videos</span> will be scraped. </>
                      )}
                      {(accountsOverLimit || videosOverLimit) && (
                        <>You have {usageLimits.accountsLeft} account slots and {usageLimits.videosLeft} video slots remaining.</>
                      )}
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-800/50">
          <div className="flex items-center gap-2 text-[#9B9B9B] text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Processing takes up to 5 minutes.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAccountInputs(prev => {
                  const lastInput = prev[prev.length - 1];
                  const videoCountToCopy = lastInput?.videoCount || 10;
                  return [...prev, { 
                    id: Date.now().toString(), 
                    url: '', 
                    platform: null, 
                    error: null,
                    videoCount: videoCountToCopy 
                  }];
                });
              }}
              className="px-4 py-2 text-sm font-medium text-gray-300 border border-gray-700 rounded-full hover:border-gray-600 hover:text-white transition-colors"
            >
              Add More
            </button>
            <button
              onClick={handleAddAccount}
              disabled={usageLimits.isAtAccountLimit || (!newAccountUrl.trim() && !accountInputs.slice(1).some(input => input.url.trim() && input.platform))}
              className="px-4 py-2 text-sm font-bold text-black bg-white rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
              {usageLimits.isAtAccountLimit ? 'Limit Reached' : 'Track Accounts'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

