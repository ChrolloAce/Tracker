import React, { useEffect, useState } from 'react';
import { MoreVertical, Eye, Heart, MessageCircle, Share2, Trash2, Edit3, Star, StarIcon } from 'lucide-react';
import { VideoSubmission } from '../types';
import { StatusBadge } from './ui/StatusBadge';
import { PlatformIcon } from './ui/PlatformIcon';
import { clsx } from 'clsx';
import InstagramApiService from '../services/InstagramApiService';
import { theme } from '../theme';

interface VideoSubmissionsTableProps {
  submissions: VideoSubmission[];
  selectedIds: Set<string>;
  onSelectionChange: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onStatusUpdate?: (id: string, status: VideoSubmission['status']) => void;
  onDelete?: (id: string) => void;
  onVideoClick?: (video: VideoSubmission) => void;
  periodDescription?: string;
}

// Dropdown menu component for video actions
const DropdownMenu: React.FC<{
  submission: VideoSubmission;
  onDelete?: (id: string) => void;
  onStatusUpdate?: (id: string, status: VideoSubmission['status']) => void;
}> = ({ submission, onDelete, onStatusUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleStatusChange = (status: VideoSubmission['status']) => {
    if (onStatusUpdate) {
      onStatusUpdate(submission.id, status);
    }
    setIsOpen(false);
  };

  const handleDelete = () => {
    if (onDelete && window.confirm('Are you sure you want to delete this video submission?')) {
      onDelete(submission.id);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
            {/* Status Updates */}
            <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
              Update Status
            </div>
            
            <button
              onClick={() => handleStatusChange('approved')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Approve</span>
            </button>
            
            <button
              onClick={() => handleStatusChange('rejected')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>Reject</span>
            </button>
            
            <button
              onClick={() => handleStatusChange('pending')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              <span>Set Pending</span>
            </button>

            {/* Divider */}
            <div className="border-t border-gray-100 my-1"></div>

            {/* Actions */}
            <button
              onClick={() => window.open(submission.url, '_blank')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <Edit3 className="w-4 h-4" />
              <span>View Original</span>
            </button>
            
            <button
              onClick={handleDelete}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// Progress Bar Component
const ProgressBar: React.FC<{ 
  value: number; 
  max: number; 
  color?: 'blue' | 'green' | 'purple' | 'gray';
  size?: 'sm' | 'md';
}> = ({ value, max, color = 'blue', size = 'sm' }) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    gray: 'bg-gray-400'
  };

  const heightClass = size === 'md' ? 'h-2' : 'h-1.5';

  return (
    <div className={`w-full ${heightClass} bg-gray-200 rounded-full overflow-hidden`}>
      <div 
        className={`${heightClass} ${colorClasses[color]} rounded-full transition-all duration-300 ease-out`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

// Star Rating Component
const StarRating: React.FC<{ 
  rating: number; 
  maxRating?: number;
  size?: 'sm' | 'md';
  interactive?: boolean;
  onChange?: (rating: number) => void;
}> = ({ rating, maxRating = 5, size = 'sm', interactive = false, onChange }) => {
  const [hoverRating, setHoverRating] = useState(0);
  
  const starSize = size === 'md' ? 'w-4 h-4' : 'w-3 h-3';

  const handleClick = (newRating: number) => {
    if (interactive && onChange) {
      onChange(newRating);
    }
  };

  return (
    <div className="flex items-center space-x-0.5">
      {Array.from({ length: maxRating }, (_, index) => {
        const starIndex = index + 1;
        const isActive = starIndex <= (interactive ? (hoverRating || rating) : rating);
        
        return (
          <button
            key={index}
            onClick={() => handleClick(starIndex)}
            onMouseEnter={() => interactive && setHoverRating(starIndex)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            className={clsx(
              starSize,
              'transition-colors duration-150',
              {
                'cursor-pointer': interactive,
                'cursor-default': !interactive,
              }
            )}
            disabled={!interactive}
          >
            <Star 
              className={clsx(
                'w-full h-full',
                {
                  'text-yellow-400 fill-yellow-400': isActive,
                  'text-gray-300': !isActive,
                }
              )}
            />
          </button>
        );
      })}
    </div>
  );
};

// Component for handling thumbnail loading with localStorage fallback
const ThumbnailImage: React.FC<{ submission: VideoSubmission }> = ({ submission }) => {
  const [thumbnailSrc, setThumbnailSrc] = useState<string>(submission.thumbnail);

  useEffect(() => {
    // Try to load from localStorage first
    const storedThumbnail = InstagramApiService.loadThumbnailFromStorage(submission.id);
    if (storedThumbnail) {
      setThumbnailSrc(storedThumbnail);
    }
  }, [submission.id]);

  const handleImageError = () => {
    console.log('🖼️ Image failed to load, trying proxy or fallback for:', submission.id);
    
    // If it's an Instagram URL, try using a CORS proxy service
    if (thumbnailSrc.includes('instagram.com') || thumbnailSrc.includes('cdninstagram.com')) {
      console.log('📡 Trying CORS proxy for Instagram image...');
      // Try using a public CORS proxy (note: in production, you'd want your own proxy)
      const proxiedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(thumbnailSrc)}`;
      setThumbnailSrc(proxiedUrl);
    } else {
      // Final fallback to SVG placeholder
      console.log('🎨 Using SVG placeholder as final fallback');
      setThumbnailSrc(`data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjZTVlN2ViIi8+CjxwYXRoIGQ9Ik0yNCAzMkMxNy4zNzI2IDMyIDEyIDI2LjYyNzQgMTIgMjBDMTIgMTMuMzcyNiAxNy4zNzI2IDggMjQgOEMzMC42Mjc0IDggMzYgMTMuMzcyNiAzNiAyMEMzNiAyNi42Mjc0IDMwLjYyNzQgMzIgMjQgMzJaTTI0IDI4QzI4LjQxODMgMjggMzIgMjQuNDE4MyAzMiAyMEMzMiAxNS41ODE3IDI4LjQxODMgMTIgMjQgMTJDMTkuNTgxNyAxMiAxNiAxNS41ODE3IDE2IDIwQzE2IDI0LjQxODMgMTkuNTgxNyAyOCAyNCAyOFoiIGZpbGw9IiM5Y2EzYWYiLz4KPC9zdmc+Cg==`);
    }
  };

  return (
    <img
      src={thumbnailSrc}
      alt="Video thumbnail"
      className="w-full h-full object-cover"
      onError={handleImageError}
    />
  );
};

export const VideoSubmissionsTable: React.FC<VideoSubmissionsTableProps> = ({
  submissions,
  selectedIds,
  onSelectionChange,
  onSelectAll,
  onStatusUpdate,
  onDelete,
  onVideoClick,
  periodDescription = 'All Time'
}) => {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const formatUploadDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
      return formatDate(date);
    }
  };

  const allSelected = submissions.length > 0 && selectedIds.size === submissions.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < submissions.length;

  // Calculate max values for progress bars
  const maxViews = Math.max(...submissions.map(s => s.views), 1);
  const maxLikes = Math.max(...submissions.map(s => s.likes), 1);
  const maxComments = Math.max(...submissions.map(s => s.comments), 1);

  // Calculate performance rating based on engagement
  const calculatePerformanceRating = (submission: VideoSubmission): number => {
    const engagementRate = submission.views > 0 ? 
      ((submission.likes + submission.comments) / submission.views) * 100 : 0;
    
    if (engagementRate >= 5) return 5;
    if (engagementRate >= 3) return 4;
    if (engagementRate >= 2) return 3;
    if (engagementRate >= 1) return 2;
    return 1;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Table Header */}
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <p className="text-sm text-gray-500 mt-1">Showing {submissions.length} videos posted during {periodDescription}</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <button className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                All
              </button>
              <button className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                Pending
              </button>
              <button className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                Approved
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="w-12 px-6 py-4 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Video
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Performance
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rating
              </th>
              <th className="w-12 px-6 py-4 text-left"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {submissions.map((submission, index) => {
              const performanceRating = calculatePerformanceRating(submission);
              
              return (
                <tr 
                  key={submission.id}
                  onClick={() => onVideoClick?.(submission)}
                  className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(submission.id)}
                      onChange={(e) => onSelectionChange(submission.id, e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 ring-2 ring-white shadow-sm">
                          <ThumbnailImage submission={submission} />
                        </div>
                        <div className="absolute -bottom-1 -right-1">
                          <PlatformIcon platform={submission.platform} size="sm" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {submission.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          @{submission.uploaderHandle}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>Views</span>
                        <span className="font-medium">{formatNumber(submission.views)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>Likes</span>
                        <span className="font-medium">{formatNumber(submission.likes)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>Comments</span>
                        <span className="font-medium">{formatNumber(submission.comments)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Views</span>
                          <span>{Math.round((submission.views / maxViews) * 100)}%</span>
                        </div>
                        <ProgressBar 
                          value={submission.views} 
                          max={maxViews} 
                          color="blue" 
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Engagement</span>
                          <span>{Math.round(((submission.likes + submission.comments) / maxLikes) * 100)}%</span>
                        </div>
                        <ProgressBar 
                          value={submission.likes + submission.comments} 
                          max={maxLikes + maxComments} 
                          color="green" 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center">
                      <StarRating rating={performanceRating} />
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu submission={submission} onDelete={onDelete} onStatusUpdate={onStatusUpdate} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {submissions.length === 0 && (
        <div className="px-6 py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <Eye className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No videos found</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            No videos match the selected time period. Try adjusting your date filter or add some new video submissions.
          </p>
        </div>
      )}
    </div>
  );
};
