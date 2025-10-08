import React, { useState, useEffect } from 'react';
import { Trash2, AlertCircle, Link as LinkIcon, X, ChevronDown, RefreshCw } from 'lucide-react';
import { PlatformIcon } from './ui/PlatformIcon';
import { UrlParserService } from '../services/UrlParserService';

interface AddVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVideo: (platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter', videoUrls: string[]) => Promise<void>;
}

interface VideoInput {
  id: string;
  url: string;
  detectedPlatform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | null;
}

export const AddVideoModal: React.FC<AddVideoModalProps> = ({ isOpen, onClose, onAddVideo }) => {
  const [videoInputs, setVideoInputs] = useState<VideoInput[]>([{ id: '1', url: '', detectedPlatform: null }]);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Auto-detect URL from clipboard when modal opens
  useEffect(() => {
    if (isOpen) {
      const checkClipboard = async () => {
        const parsed = await UrlParserService.autoDetectFromClipboard();
        
        if (parsed && parsed.isValid && parsed.platform) {
          setVideoInputs([{ id: '1', url: parsed.url, detectedPlatform: parsed.platform }]);
          console.log(`🎯 Auto-filled ${parsed.platform} URL from clipboard`);
        }
      };
      
      checkClipboard();
    } else {
      // Reset when modal closes
      setVideoInputs([{ id: '1', url: '', detectedPlatform: null }]);
      setUrlError(null);
    }
  }, [isOpen]);

  const handleAddVideoInput = () => {
    setVideoInputs([...videoInputs, { id: Date.now().toString(), url: '', detectedPlatform: null }]);
  };

  const handleRemoveVideoInput = (id: string) => {
    if (videoInputs.length > 1) {
      setVideoInputs(videoInputs.filter(input => input.id !== id));
    }
  };

  const handleVideoUrlChange = (id: string, url: string) => {
    setUrlError(null);
    
    // Detect platform from URL
    const parsed = UrlParserService.parseUrl(url);
    const detectedPlatform = parsed.platform;
    
    setVideoInputs(videoInputs.map(input => 
      input.id === id ? { ...input, url, detectedPlatform } : input
    ));
  };

  const handleSubmit = async () => {
    const validInputs = videoInputs.filter(input => input.url.trim() && input.detectedPlatform);
    
    if (validInputs.length === 0) {
      setUrlError('Please enter at least one valid video URL');
      return;
    }

    // Check if there are URLs without detected platforms
    const invalidUrls = videoInputs.filter(input => input.url.trim() && !input.detectedPlatform);
    if (invalidUrls.length > 0) {
      setUrlError('Some URLs are invalid. Please check and enter valid social media video URLs.');
      return;
    }

    // Group by platform and process each platform separately
    const platformGroups = validInputs.reduce((acc, input) => {
      const platform = input.detectedPlatform!;
      if (!acc[platform]) {
        acc[platform] = [];
      }
      acc[platform].push(input.url.trim());
      return acc;
    }, {} as Record<string, string[]>);

    // Close modal immediately and reset form
    setVideoInputs([{ id: '1', url: '', detectedPlatform: null }]);
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-[#151515] rounded-[14px] w-full max-w-[580px] shadow-2xl" style={{ padding: '24px' }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Add Videos</h2>
            <p className="text-sm text-[#A1A1AA]">Enter video URLs you want to track & analyze.</p>
          </div>
          <button
            onClick={() => {
              onClose();
              setVideoInputs([{ id: '1', url: '', detectedPlatform: null }]);
              setUrlError(null);
            }}
            className="text-white/80 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
        
        {/* Input Fields */}
        <div className="space-y-3 mb-6">
          {videoInputs.map((input) => (
            <div key={input.id} className="flex gap-2 items-start">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input.url}
                  onChange={(e) => handleVideoUrlChange(input.id, e.target.value)}
                  placeholder="Enter TikTok, YouTube, or Instagram video URL"
                  className="w-full pl-4 pr-10 py-2.5 bg-[#1E1E20] border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 text-sm"
                />
                {input.detectedPlatform ? (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <PlatformIcon platform={input.detectedPlatform} size="sm" />
                  </div>
                ) : (
                  <LinkIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
                )}
              </div>
              
              <div className="relative opacity-0 pointer-events-none">
                <select
                  disabled
                  className="appearance-none pl-3 pr-8 py-2.5 bg-[#1E1E20] border border-gray-700/50 rounded-full text-white text-sm font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/20 whitespace-nowrap"
                >
                  <option>10 videos</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>

              <button
                onClick={() => handleRemoveVideoInput(input.id)}
                disabled={videoInputs.length === 1}
                className={`p-2.5 rounded-lg transition-colors ${
                  videoInputs.length === 1
                    ? 'text-gray-500 opacity-30 cursor-not-allowed'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          ))}

          {/* Show validation error */}
          {urlError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-300">
                {urlError}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-800/50">
          <div className="flex items-center gap-2 text-[#9B9B9B] text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Processing takes up to 5 minutes.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddVideoInput}
              className="px-4 py-2 text-sm font-medium text-gray-400 border border-gray-700 rounded-full hover:border-gray-600 hover:text-gray-300 transition-colors"
            >
              Add More
            </button>
            <button
              onClick={handleSubmit}
              disabled={videoInputs.every(input => !input.url.trim())}
              className="px-4 py-2 text-sm font-bold text-black bg-white rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
              Add Videos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

