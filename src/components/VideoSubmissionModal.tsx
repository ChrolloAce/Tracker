import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Loader2, Plus, X } from 'lucide-react';

interface VideoSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (url: string, uploadDate: Date) => Promise<void>;
}

interface VideoUrlInput {
  id: string;
  url: string;
  uploadDate: string; // ISO date string
  error?: string;
}

export const VideoSubmissionModal: React.FC<VideoSubmissionModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [urlInputs, setUrlInputs] = useState<VideoUrlInput[]>([
    { id: '1', url: '', uploadDate: new Date().toISOString().split('T')[0] }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [failureCount, setFailureCount] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all URLs and dates
    const validInputs: Array<{ url: string; uploadDate: Date }> = [];
    const updatedInputs = urlInputs.map(input => {
      const trimmedUrl = input.url.trim();
      if (!trimmedUrl) {
        return { ...input, error: 'Please enter a URL' };
      }
      if (!isValidVideoUrl(trimmedUrl)) {
        return { ...input, error: 'Please enter a valid Instagram, TikTok, or YouTube URL' };
      }
      if (!input.uploadDate) {
        return { ...input, error: 'Please enter an upload date' };
      }
      
      const uploadDate = new Date(input.uploadDate);
      if (isNaN(uploadDate.getTime())) {
        return { ...input, error: 'Please enter a valid upload date' };
      }
      
      validInputs.push({ url: trimmedUrl, uploadDate });
      return { ...input, error: undefined };
    });

    setUrlInputs(updatedInputs);

    if (validInputs.length === 0) {
      setGlobalError('Please enter at least one valid URL with upload date');
      return;
    }

    if (updatedInputs.some(input => input.error)) {
      setGlobalError('Please fix the errors above');
      return;
    }

    setIsLoading(true);
    setGlobalError(null);
    setSuccessCount(0);
    setFailureCount(0);

    // Process all URLs with upload dates
    let successCount = 0;
    let failureCount = 0;

    for (const input of validInputs) {
      try {
        await onSubmit(input.url, input.uploadDate);
        successCount++;
        setSuccessCount(successCount);
      } catch (err) {
        failureCount++;
        setFailureCount(failureCount);
        console.error(`Failed to add video ${input.url}:`, err);
      }
    }

    setIsLoading(false);

    if (successCount > 0) {
      if (failureCount === 0) {
        // All successful - close modal
        resetForm();
        onClose();
      } else {
        // Some successful, some failed - show summary
        setGlobalError(`Added ${successCount} videos successfully, ${failureCount} failed`);
      }
    } else {
      // All failed
      setGlobalError('Failed to add any videos. Please check the URLs and try again.');
    }
  };

  const addUrlInput = () => {
    const newId = Date.now().toString();
    setUrlInputs(prev => [...prev, { 
      id: newId, 
      url: '', 
      uploadDate: new Date().toISOString().split('T')[0] 
    }]);
  };

  const removeUrlInput = (id: string) => {
    if (urlInputs.length > 1) {
      setUrlInputs(prev => prev.filter(input => input.id !== id));
    }
  };

  const updateUrlInput = (id: string, url: string) => {
    setUrlInputs(prev => prev.map(input => 
      input.id === id ? { ...input, url, error: undefined } : input
    ));
  };

  const updateUploadDate = (id: string, uploadDate: string) => {
    setUrlInputs(prev => prev.map(input => 
      input.id === id ? { ...input, uploadDate, error: undefined } : input
    ));
  };

  const resetForm = () => {
    setUrlInputs([{ id: '1', url: '', uploadDate: new Date().toISOString().split('T')[0] }]);
    setGlobalError(null);
    setSuccessCount(0);
    setFailureCount(0);
  };

  const isValidVideoUrl = (url: string): boolean => {
    // Instagram patterns
    const instagramRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/;
    
    // TikTok patterns - more flexible
    const tiktokRegex = /^https?:\/\/(www\.|vm\.|m\.)?tiktok\.com/;
    const tiktokVideoRegex = /tiktok\.com\/@[\w.-]+\/video\/\d+/;
    const shortTikTokRegex = /tiktok\.com\/[A-Za-z0-9]+/;
    
    // YouTube Shorts patterns
    const youtubeRegex = /^https?:\/\/(www\.|m\.)?youtube\.com\/shorts\/[A-Za-z0-9_-]+/;
    const youtubeMobileRegex = /^https?:\/\/youtu\.be\/[A-Za-z0-9_-]+/;
    
    return instagramRegex.test(url) || 
           tiktokRegex.test(url) || 
           tiktokVideoRegex.test(url) || 
           shortTikTokRegex.test(url) ||
           youtubeRegex.test(url) ||
           youtubeMobileRegex.test(url);
  };

  const handleClose = () => {
    if (!isLoading) {
      resetForm();
      onClose();
    }
  };

  const hasValidUrls = urlInputs.some(input => input.url.trim());

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Videos">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Instagram or TikTok Video URLs
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addUrlInput}
              disabled={isLoading}
              className="flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add URL</span>
            </Button>
          </div>

          <div className="space-y-4">
            {urlInputs.map((input) => (
              <div key={input.id} className="space-y-3 p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Video URL
                    </label>
                    <input
                      type="url"
                      value={input.url}
                      onChange={(e) => updateUrlInput(input.id, e.target.value)}
                      placeholder="https://www.instagram.com/p/... or https://www.tiktok.com/@user/video/..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isLoading}
                    />
                  </div>
                  {urlInputs.length > 1 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => removeUrlInput(input.id)}
                      disabled={isLoading}
                      className="mt-6 p-2 text-gray-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Date
                  </label>
                  <input
                    type="date"
                    value={input.uploadDate}
                    onChange={(e) => updateUploadDate(input.id, e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isLoading}
                  />
                </div>
                {input.error && (
                  <p className="text-sm text-red-600">{input.error}</p>
                )}
              </div>
            ))}
          </div>

          <p className="mt-2 text-xs text-gray-500">
            Supports Instagram posts, reels, TikTok videos, and YouTube Shorts. Add multiple URLs to process them all at once.
          </p>

          {isLoading && (successCount > 0 || failureCount > 0) && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Progress: {successCount} added, {failureCount} failed
              </p>
            </div>
          )}

          {globalError && (
            <p className="mt-2 text-sm text-red-600">{globalError}</p>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !hasValidUrls}
            className="flex items-center space-x-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {isLoading 
                ? `Adding ${urlInputs.filter(i => i.url.trim()).length} videos...` 
                : `Add ${urlInputs.filter(i => i.url.trim()).length || 1} Video${urlInputs.filter(i => i.url.trim()).length !== 1 ? 's' : ''}`
              }
            </span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
