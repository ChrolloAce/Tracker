import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { PlatformIcon } from './ui/PlatformIcon';
import { clsx } from 'clsx';

interface AddVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVideo: (platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter', videoUrls: string[]) => Promise<void>;
}

interface VideoInput {
  id: string;
  url: string;
}

export const AddVideoModal: React.FC<AddVideoModalProps> = ({ isOpen, onClose, onAddVideo }) => {
  const [selectedPlatform, setSelectedPlatform] = useState<'instagram' | 'tiktok' | 'youtube' | 'twitter'>('tiktok');
  const [videoInputs, setVideoInputs] = useState<VideoInput[]>([{ id: '1', url: '' }]);

  const handleAddVideoInput = () => {
    setVideoInputs([...videoInputs, { id: Date.now().toString(), url: '' }]);
  };

  const handleRemoveVideoInput = (id: string) => {
    if (videoInputs.length > 1) {
      setVideoInputs(videoInputs.filter(input => input.id !== id));
    }
  };

  const handleVideoUrlChange = (id: string, url: string) => {
    setVideoInputs(videoInputs.map(input => 
      input.id === id ? { ...input, url } : input
    ));
  };

  const handleSubmit = async () => {
    const urls = videoInputs.map(input => input.url.trim()).filter(url => url);
    
    if (urls.length === 0) {
      alert('Please enter at least one video URL');
      return;
    }

    // Close modal immediately and reset form
    setVideoInputs([{ id: '1', url: '' }]);
    setSelectedPlatform('tiktok');
    onClose();
    
    // Process videos in background (server-side will handle and page will reload)
    onAddVideo(selectedPlatform, urls).catch(error => {
      console.error('Failed to add videos:', error);
      // Error handling happens in DashboardPage with console logs
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-[#1A1A1A] border-b border-gray-200 dark:border-gray-800 p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Add Custom Video</h2>
              <p className="text-gray-500 dark:text-gray-400">Add videos to track from Instagram, TikTok, YouTube, or Twitter</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Step 1: Choose Platform */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Step 1: Choose Platform
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => setSelectedPlatform('instagram')}
                className={clsx(
                  'flex flex-col items-center justify-center space-y-2 py-4 px-3 rounded-xl border-2 transition-all duration-200',
                  selectedPlatform === 'instagram'
                    ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                    : 'border-gray-700 dark:border-gray-700 hover:border-gray-600 dark:hover:border-gray-600 hover:bg-gray-800 dark:hover:bg-gray-800 text-gray-300'
                )}
              >
                <PlatformIcon platform="instagram" size="md" />
                <span className="font-medium text-xs">Instagram</span>
              </button>
              <button
                onClick={() => setSelectedPlatform('tiktok')}
                className={clsx(
                  'flex flex-col items-center justify-center space-y-2 py-4 px-3 rounded-xl border-2 transition-all duration-200',
                  selectedPlatform === 'tiktok'
                    ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                    : 'border-gray-700 dark:border-gray-700 hover:border-gray-600 dark:hover:border-gray-600 hover:bg-gray-800 dark:hover:bg-gray-800 text-gray-300'
                )}
              >
                <PlatformIcon platform="tiktok" size="md" />
                <span className="font-medium text-xs">TikTok</span>
              </button>
              <button
                onClick={() => setSelectedPlatform('youtube')}
                className={clsx(
                  'flex flex-col items-center justify-center space-y-2 py-4 px-3 rounded-xl border-2 transition-all duration-200',
                  selectedPlatform === 'youtube'
                    ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                    : 'border-gray-700 dark:border-gray-700 hover:border-gray-600 dark:hover:border-gray-600 hover:bg-gray-800 dark:hover:bg-gray-800 text-gray-300'
                )}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
                <span className="font-medium text-xs">YouTube</span>
              </button>
              <button
                onClick={() => setSelectedPlatform('twitter')}
                className={clsx(
                  'flex flex-col items-center justify-center space-y-2 py-4 px-3 rounded-xl border-2 transition-all duration-200',
                  selectedPlatform === 'twitter'
                    ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                    : 'border-gray-700 dark:border-gray-700 hover:border-gray-600 dark:hover:border-gray-600 hover:bg-gray-800 dark:hover:bg-gray-800 text-gray-300'
                )}
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span className="font-medium text-xs">Twitter</span>
              </button>
            </div>
          </div>

          {/* Step 2: Add Video URLs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white">
                Step 2: Add Video URLs
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
                      placeholder={`Enter ${selectedPlatform} video URL ${index + 1}`}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
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

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
              Enter the full video URL. If the account doesn't exist, it will be created automatically.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-[#1A1A1A] border-t border-gray-200 dark:border-gray-800 p-6 flex space-x-4">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={videoInputs.every(input => !input.url.trim())}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl"
          >
            Add Videos
          </button>
        </div>
      </div>
    </div>
  );
};

