import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
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
      <div className="bg-zinc-900 dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="text-center p-8 pb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Add Videos to Track</h2>
          <p className="text-gray-500 dark:text-gray-400">Paste video URLs and we'll detect the platform automatically</p>
        </div>

        <div className="px-8 pb-6 space-y-4">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-gray-900 dark:text-white">
              Video URLs
            </label>
            <button
              onClick={handleAddVideoInput}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Another
            </button>
          </div>

          <div className="space-y-3">
            {videoInputs.map((input, index) => (
              <div key={input.id} className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={input.url}
                    onChange={(e) => handleVideoUrlChange(input.id, e.target.value)}
                    placeholder={`Paste video URL ${videoInputs.length > 1 ? `${index + 1}` : ''}`}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  {input.detectedPlatform && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <PlatformIcon platform={input.detectedPlatform} size="sm" />
                    </div>
                  )}
                </div>
                {videoInputs.length > 1 && (
                  <button
                    onClick={() => handleRemoveVideoInput(input.id)}
                    className="p-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                    title="Remove URL"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {urlError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-700 dark:text-red-300">
                {urlError}
              </span>
            </div>
          )}

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Paste full video URLs from Instagram, TikTok, YouTube, or Twitter. Accounts will be created automatically if they don't exist.
          </p>
        </div>

        {/* Footer */}
        <div className="p-8 pt-6 flex space-x-4">
          <button
            onClick={() => {
              onClose();
              setVideoInputs([{ id: '1', url: '', detectedPlatform: null }]);
              setUrlError(null);
            }}
            className="flex-1 px-6 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={videoInputs.every(input => !input.url.trim())}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Add Videos
          </button>
        </div>
      </div>
    </div>
  );
};

