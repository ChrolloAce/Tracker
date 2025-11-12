import React, { useState, useCallback } from 'react';
import { X, ChevronDown, LinkIcon, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PlatformIcon } from './ui/PlatformIcon';
import { UrlParserService } from '../services/UrlParserService';
import FirestoreDataService from '../services/FirestoreDataService';
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
      // Process each account
      const results = await Promise.allSettled(
        accountsToAdd.map(async (acc) => {
          const accountData = {
            username: acc.username,
            platform: acc.platform,
            url: acc.url,
            displayName: acc.username,
            avatarUrl: null,
            followerCount: null,
            videoCount: null,
            isVerified: false,
            bio: null,
            lastUpdated: new Date(),
            lastSynced: null,
            syncStatus: 'idle' as const,
            creatorType: 'manual' as const,
          };

          const accountId = await FirestoreDataService.addTrackedAccount(
            orgId,
            projectId,
            user.uid,
            accountData
          );

          // Sync videos for this account with specific video count
          await FirestoreDataService.syncAccountVideos(
            orgId,
            projectId,
            accountId,
            user.uid,
            acc.videoCount
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
              
              {/* Video count selector */}
              <div className="relative">
                <select
                  value={input.videoCount}
                  onChange={(e) => {
                    const newInputs = [...accountInputs];
                    newInputs[index].videoCount = Number(e.target.value);
                    setAccountInputs(newInputs);
                  }}
                  className="appearance-none pl-3 pr-8 py-2.5 bg-[#1E1E20] border border-gray-700/50 rounded-full text-white text-sm font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/20 whitespace-nowrap"
                >
                  <option value={10}>10 videos</option>
                  <option value={25}>25 videos</option>
                  <option value={50}>50 videos</option>
                  <option value={100}>100 videos</option>
                  <option value={250}>250 videos</option>
                  <option value={500}>500 videos</option>
                  <option value={1000}>1000 videos</option>
                  <option value={2000}>2000 videos</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
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
              disabled={isSubmitting || usageLimits.isAtAccountLimit || (!newAccountUrl.trim() && !accountInputs.slice(1).some(input => input.url.trim() && input.platform))}
              className="px-4 py-2 text-sm font-bold text-black bg-white rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
              {isSubmitting ? 'Processing...' : usageLimits.isAtAccountLimit ? 'Limit Reached' : 'Track Accounts'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

