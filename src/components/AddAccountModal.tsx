import React, { useState, useCallback, useEffect } from 'react';
import { X, ChevronDown, LinkIcon, RefreshCw, AlertCircle, Trash2, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PlatformIcon } from './ui/PlatformIcon';
import { UrlParserService } from '../services/UrlParserService';
import { AccountTrackingServiceFirebase } from '../services/AccountTrackingServiceFirebase';
import UsageTrackingService from '../services/UsageTrackingService';
import { User } from 'firebase/auth';

/**
 * Extract username from social media URL
 */
function extractUsernameFromUrl(url: string, platform: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Remove trailing slash
    const cleanPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    
    if (platform === 'instagram') {
      // Instagram: Extract first path segment (username), ignore extras like /reels/, /p/, /reel/
      // Examples: /username/ → username, /username/reels/ → username, /username/p/ABC123/ → username
      const match = cleanPath.match(/^\/([^\/]+)/);
      return match ? match[1] : null;
    }
    
    if (platform === 'tiktok') {
      // TikTok: Extract @username from first segment, ignore extras like /video/123
      // Examples: /@username → username, /@username/video/123 → username
      const match = cleanPath.match(/^\/@?([^\/]+)/);
      return match ? match[1] : null;
    }
    
    if (platform === 'youtube') {
      // YouTube: https://www.youtube.com/@username or /c/username or /user/username
      // Allow paths like /@username/shorts, /@username/videos, etc.
      const match = cleanPath.match(/^\/@?([^\/]+)/) || 
                   cleanPath.match(/^\/c\/([^\/]+)/) ||
                   cleanPath.match(/^\/user\/([^\/]+)/);
      return match ? match[1] : null;
    }
    
    if (platform === 'twitter') {
      // Twitter/X: Extract username from first segment, ignore extras like /status/123
      // Examples: /username → username, /username/status/123 → username
      const match = cleanPath.match(/^\/([^\/]+)/);
      return match ? match[1] : null;
    }
    
    return null;
  } catch {
    return null;
  }
}

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

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  orgId: string;
  projectId: string;
  user: User | null;
  usageLimits: UsageLimits;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  orgId,
  projectId,
  user,
  usageLimits
}) => {
  const navigate = useNavigate();
  const [newAccountUrl, setNewAccountUrl] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<'instagram' | 'tiktok' | 'youtube' | 'twitter' | null>(null);
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);
  const [accountInputs, setAccountInputs] = useState<AccountInput[]>([
    { id: '1', url: '', platform: null, error: null, videoCount: 10 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Video limit checking
  const [videoLimitInfo, setVideoLimitInfo] = useState<{ current: number; limit: number; available: number } | null>(null);
  const [checkingLimits, setCheckingLimits] = useState(true);

  // Check video limits when modal opens
  useEffect(() => {
    const checkLimits = async () => {
      if (!isOpen || !orgId) {
        setCheckingLimits(false);
        return;
      }

      try {
        setCheckingLimits(true);
        const [usage, limits] = await Promise.all([
          UsageTrackingService.getUsage(orgId),
          UsageTrackingService.getLimits(orgId)
        ]);

        const currentVideos = usage.trackedVideos;
        const videoLimit = limits.maxVideos;
        const available = videoLimit === -1 ? Infinity : Math.max(0, videoLimit - currentVideos);

        setVideoLimitInfo({
          current: currentVideos,
          limit: videoLimit,
          available: videoLimit === -1 ? Infinity : available
        });

        console.log(`📹 Video limits: ${currentVideos}/${videoLimit} (${available === Infinity ? '∞' : available} available)`);
      } catch (error) {
        console.error('Failed to check video limits:', error);
      } finally {
        setCheckingLimits(false);
      }
    };

    checkLimits();
  }, [isOpen, orgId]);

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

  const handleAddAccount = useCallback(async () => {
    if (!orgId || !projectId || !user) return;

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
        const username = extractUsernameFromUrl(url, platform);
        if (username) {
          accountsToAdd.push({ url, username, platform, videoCount });
        }
      }
    }
    
    if (accountsToAdd.length === 0) {
      setUrlValidationError('Please enter at least one valid account URL.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Process each account in parallel
      const results = await Promise.allSettled(
        accountsToAdd.map(async (acc) => {
          // AccountTrackingServiceFirebase.addAccount now handles queueing automatically
          await AccountTrackingServiceFirebase.addAccount(
            orgId,
            projectId,
            user.uid,
            acc.username,
            acc.platform,
            'my', // Default to 'my' account type
            acc.videoCount // Pass each account's specific video count
          );

          return { success: true, username: acc.username };
        })
      );

      // Check results
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (succeeded > 0) {
        // Close modal and reset
        setNewAccountUrl('');
        setDetectedPlatform(null);
        setUrlValidationError(null);
        setAccountInputs([{ id: '1', url: '', platform: null, error: null, videoCount: 10 }]);
        onClose();
        
        // Call success callback
        if (onSuccess) {
          onSuccess();
        }
      }

      if (failed > 0) {
        setUrlValidationError(`${failed} account(s) failed to add. Please try again.`);
      }
    } catch (error) {
      console.error('❌ Error adding accounts:', error);
      setUrlValidationError(error instanceof Error ? error.message : 'Failed to add accounts');
    } finally {
      setIsSubmitting(false);
    }
  }, [orgId, projectId, user, accountInputs, newAccountUrl, detectedPlatform, onClose, onSuccess]);

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

        {/* Video Limit Warning Banner */}
        {!checkingLimits && videoLimitInfo && videoLimitInfo.limit !== -1 && (() => {
          // Calculate total videos from ALL inputs (including first one using newAccountUrl)
          const totalVideosRequested = accountInputs.reduce((sum, input, index) => {
            const url = (index === 0 ? newAccountUrl : input.url).trim();
            const platform = index === 0 ? detectedPlatform : input.platform;
            
            if (url && platform) {
              console.log(`[Video Limit Check] Input ${index}: ${url} → ${input.videoCount} videos`);
              return sum + input.videoCount;
            }
            return sum;
          }, 0);
          
          console.log(`[Video Limit Check] Total requested: ${totalVideosRequested}, Available: ${videoLimitInfo.available}, Limit: ${videoLimitInfo.limit}`);
          
          const wouldExceedLimit = totalVideosRequested > videoLimitInfo.available;
          const videosOver = totalVideosRequested - videoLimitInfo.available;
          
          if (wouldExceedLimit) {
            console.log(`⚠️ [Video Limit Check] EXCEEDS LIMIT by ${videosOver} videos!`);
            return (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-red-400 mb-1">
                      Not Enough Video Space
                    </div>
                    <div className="text-xs text-red-400/80">
                      You're requesting {totalVideosRequested.toLocaleString()} videos but only have {videoLimitInfo.available.toLocaleString()} slots available 
                      ({videosOver.toLocaleString()} over limit). 
                      Reduce video counts or upgrade your plan.
                    </div>
                  </div>
                </div>
                <a
                  href="/settings?tab=billing"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-white text-black hover:bg-gray-100 dark:hover:bg-gray-100 text-sm font-semibold rounded-lg transition-all"
                >
                  <Crown className="w-4 h-4" />
                  Upgrade Plan
                </a>
              </div>
            );
          }
          return null;
        })()}
        
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
                      const newInputs = [...accountInputs];
                      newInputs[0].url = e.target.value;
                      const result = UrlParserService.parseUrl(e.target.value);
                      newInputs[0].platform = result.platform || null;
                      newInputs[0].error = !result.isValid && e.target.value.trim() ? 'Invalid URL' : null;
                      setAccountInputs(newInputs);
                    } else {
                      const newInputs = [...accountInputs];
                      newInputs[index].url = e.target.value;
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
              
              {/* Video count selector - Input field + dropdown arrow */}
              <div className="flex items-center gap-1.5">
                {/* Number input field */}
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={input.videoCount}
                  onChange={(e) => {
                    const newInputs = [...accountInputs];
                    const value = parseInt(e.target.value) || 1;
                    newInputs[index].videoCount = Math.max(1, Math.min(5000, value));
                    setAccountInputs(newInputs);
                  }}
                  className="w-20 px-3 py-2 bg-[#1E1E20] border border-gray-700/50 rounded-lg text-white text-sm font-medium text-center focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-gray-600"
                  placeholder="10"
                />

                {/* Preset dropdown - just arrow button */}
                <div className="relative w-9 h-9">
                  <select
                    value={input.videoCount}
                    onChange={(e) => {
                      const newInputs = [...accountInputs];
                      newInputs[index].videoCount = Number(e.target.value);
                      setAccountInputs(newInputs);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                    <option value={1000}>1000</option>
                    <option value={2000}>2000</option>
                  </select>
                  {/* Visible arrow button with background */}
                  <div className="absolute inset-0 bg-[#1E1E20] border border-gray-700/50 rounded-lg flex items-center justify-center pointer-events-none">
                    <ChevronDown className="w-4 h-4 text-gray-400" />
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
              disabled={(() => {
                if (isSubmitting) return true;
                if (usageLimits.isAtAccountLimit) return true;
                if (!newAccountUrl.trim() && !accountInputs.slice(1).some(input => input.url.trim() && input.platform)) return true;
                
                // Check video limit (same logic as warning banner)
                if (videoLimitInfo && videoLimitInfo.limit !== -1) {
                  const totalVideosRequested = accountInputs.reduce((sum, input, index) => {
                    const url = (index === 0 ? newAccountUrl : input.url).trim();
                    const platform = index === 0 ? detectedPlatform : input.platform;
                    if (url && platform) {
                      return sum + input.videoCount;
                    }
                    return sum;
                  }, 0);
                  if (totalVideosRequested > videoLimitInfo.available) return true;
                }
                
                return false;
              })()}
              className={`px-4 py-2 text-sm font-bold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                videoLimitInfo && videoLimitInfo.limit !== -1 && (() => {
                  const totalVideosRequested = accountInputs.reduce((sum, input, index) => {
                    const url = (index === 0 ? newAccountUrl : input.url).trim();
                    const platform = index === 0 ? detectedPlatform : input.platform;
                    if (url && platform) {
                      return sum + input.videoCount;
                    }
                    return sum;
                  }, 0);
                  return totalVideosRequested > videoLimitInfo.available;
                })()
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'text-black bg-white hover:bg-gray-100'
              }`}
            >
              {isSubmitting ? 'Processing...' : 
               usageLimits.isAtAccountLimit ? 'Limit Reached' : 
               videoLimitInfo && videoLimitInfo.limit !== -1 && (() => {
                 const totalVideosRequested = accountInputs.reduce((sum, input, index) => {
                   const url = (index === 0 ? newAccountUrl : input.url).trim();
                   const platform = index === 0 ? detectedPlatform : input.platform;
                   if (url && platform) {
                     return sum + input.videoCount;
                   }
                   return sum;
                 }, 0);
                 return totalVideosRequested > videoLimitInfo.available ? 'Not Enough Space' : 'Track Accounts';
               })() || 'Track Accounts'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

