import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Loader2 } from 'lucide-react';

interface VideoSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (url: string) => Promise<void>;
}

export const VideoSubmissionModal: React.FC<VideoSubmissionModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('Please enter an Instagram URL');
      return;
    }

    if (!isValidVideoUrl(url)) {
      setError('Please enter a valid Instagram or TikTok URL');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onSubmit(url);
      setUrl('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add video');
    } finally {
      setIsLoading(false);
    }
  };

  const isValidVideoUrl = (url: string): boolean => {
    // Instagram patterns
    const instagramRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/;
    
    // TikTok patterns
    const tiktokRegex = /^https?:\/\/(www\.|vm\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/;
    const shortTikTokRegex = /^https?:\/\/vm\.tiktok\.com\/[A-Za-z0-9]+/;
    
    return instagramRegex.test(url) || tiktokRegex.test(url) || shortTikTokRegex.test(url);
  };

  const handleClose = () => {
    if (!isLoading) {
      setUrl('');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Video">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="video-url" className="block text-sm font-medium text-gray-700 mb-2">
            Instagram or TikTok Video URL
          </label>
          <input
            id="video-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.instagram.com/p/... or https://www.tiktok.com/@user/video/..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={isLoading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Supports Instagram posts, reels, and TikTok videos
          </p>
          {error && (
            <p className="mt-2 text-sm text-danger-600">{error}</p>
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
            disabled={isLoading || !url.trim()}
            className="flex items-center space-x-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isLoading ? 'Adding...' : 'Add Video'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
