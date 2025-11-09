import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Loader2, Search, Hash } from 'lucide-react';
import TikTokApiService from '../services/TikTokApiService';
import { InstagramVideoData } from '../types';
import { HeicImage } from './HeicImage';

interface TikTokSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideosFound: (videos: InstagramVideoData[]) => void;
}

export const TikTokSearchModal: React.FC<TikTokSearchModalProps> = ({
  isOpen,
  onClose,
  onVideosFound
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'keyword' | 'hashtag'>('keyword');
  const [maxVideos, setMaxVideos] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<InstagramVideoData[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      setError('Please enter a search query or hashtag');
      return;
    }

    if (maxVideos < 1 || maxVideos > 50) {
      setError('Number of videos must be between 1 and 50');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      
      let videos: InstagramVideoData[];
      
      if (searchType === 'hashtag') {
        videos = await TikTokApiService.searchByHashtag(searchQuery, maxVideos);
      } else {
        videos = await TikTokApiService.searchVideos(searchQuery, maxVideos);
      }

      setResults(videos);
      
      if (videos.length === 0) {
        setError(`No TikTok videos found for ${searchType}: "${searchQuery}"`);
      }

    } catch (err) {
      console.error('❌ TikTok search failed:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddVideos = () => {
    if (results.length > 0) {
      onVideosFound(results);
      handleClose();
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setSearchQuery('');
      setResults([]);
      setError(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Search TikTok Videos" className="max-w-2xl">
      <div className="space-y-6">
        {/* Search Form */}
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Search Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Type
            </label>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setSearchType('keyword')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                  searchType === 'keyword'
                    ? 'bg-primary-50 border-primary-200 text-primary-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Search className="w-4 h-4" />
                <span>Keyword Search</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchType('hashtag')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                  searchType === 'hashtag'
                    ? 'bg-primary-50 border-primary-200 text-primary-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Hash className="w-4 h-4" />
                <span>Hashtag Search</span>
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div>
            <label htmlFor="search-query" className="block text-sm font-medium text-gray-700 mb-2">
              {searchType === 'hashtag' ? 'Hashtag' : 'Search Query'}
            </label>
            <input
              id="search-query"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchType === 'hashtag' ? '#viral or viral' : 'funny cats, dance trends, etc.'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          {/* Max Videos */}
          <div>
            <label htmlFor="max-videos" className="block text-sm font-medium text-gray-700 mb-2">
              Number of Videos
            </label>
            <input
              id="max-videos"
              type="number"
              min="1"
              max="50"
              value={maxVideos}
              onChange={(e) => setMaxVideos(parseInt(e.target.value) || 10)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Maximum 50 videos per search
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || !searchQuery.trim()}
            className="w-full flex items-center justify-center space-x-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isLoading ? 'Searching...' : 'Search TikTok'}</span>
          </Button>
        </form>

        {/* Results */}
        {results.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Search Results ({results.length} videos found)
              </h3>
              <Button onClick={handleAddVideos} size="sm">
                Add All to Dashboard
              </Button>
            </div>
            
            <div className="max-h-64 overflow-y-auto space-y-2">
              {results.map((video, index) => (
                <div key={video.id || index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    {video.thumbnail_url && (
                      <HeicImage
                        src={video.thumbnail_url}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {video.caption || 'Untitled Video'}
                    </p>
                    <p className="text-xs text-gray-500">
                      @{video.username} • {video.like_count.toLocaleString()} likes • {(video.view_count || 0).toLocaleString()} views
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
