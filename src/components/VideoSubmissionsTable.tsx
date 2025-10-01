import React, { useEffect, useState } from 'react';
import { MoreVertical, Eye, Heart, MessageCircle, Share2, Trash2, Edit3, ChevronUp, ChevronDown } from 'lucide-react';
import { VideoSubmission } from '../types';
import { PlatformIcon } from './ui/PlatformIcon';
import { MiniTrendChart } from './ui/MiniTrendChart';
import { TrendCalculationService } from '../services/TrendCalculationService';
import { clsx } from 'clsx';
import InstagramApiService from '../services/InstagramApiService';
import InstagramIcon from '/Instagram_icon.png';
import TikTokIcon from '/TiktokLogo.png';
import YouTubeShortsIcon from '../Youtube_shorts_icon.svg.png';

interface VideoSubmissionsTableProps {
  submissions: VideoSubmission[];
  onStatusUpdate?: (id: string, status: VideoSubmission['status']) => void;
  onDelete?: (id: string) => void;
  onVideoClick?: (video: VideoSubmission) => void;
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
          <div className="absolute right-0 top-8 z-20 w-48 bg-white dark:bg-[#1A1A1A] rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 py-1">
            {/* Status Updates */}
            <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
              Update Status
            </div>
            
            <button
              onClick={() => handleStatusChange('approved')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Approve</span>
            </button>
            
            <button
              onClick={() => handleStatusChange('rejected')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2"
            >
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>Reject</span>
            </button>
            
            <button
              onClick={() => handleStatusChange('pending')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2"
            >
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              <span>Set Pending</span>
            </button>

            {/* Divider */}
            <div className="border-t border-gray-100 my-1"></div>

            {/* Actions */}
            <button
              onClick={() => window.open(submission.url, '_blank')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2"
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
    console.log('📸 Failed thumbnail URL:', thumbnailSrc);
    
    // If it's already a Firebase Storage URL, don't try proxy - just use placeholder
    if (thumbnailSrc.includes('firebasestorage.googleapis.com')) {
      console.log('⚠️ Firebase Storage thumbnail failed to load - using placeholder');
      setThumbnailSrc(`data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjZTVlN2ViIi8+CjxwYXRoIGQ9Ik0yNCAzMkMxNy4zNzI2IDMyIDEyIDI2LjYyNzQgMTIgMjBDMTIgMTMuMzcyNiAxNy4zNzI2IDggMjQgOEMzMC42Mjc0IDggMzYgMTMuMzcyNiAzNiAyMEMzNiAyNi42Mjc0IDMwLjYyNzQgMzIgMjQgMzJaTTI0IDI4QzI4LjQxODMgMjggMzIgMjQuNDE4MyAzMiAyMEMzMiAxNS41ODE3IDI4LjQxODMgMTIgMjQgMTJDMTkuNTgxNyAxMiAxNiAxNS41ODE3IDE2IDIwQzE2IDI0LjQxODMgMTkuNTgxNyAyOCAyNCAyOFoiIGZpbGw9IiM5Y2EzYWYiLz4KPC9zdmc+Cg==`);
    }
    // If it's an Instagram URL, try using a CORS proxy service
    else if (thumbnailSrc.includes('instagram.com') || thumbnailSrc.includes('cdninstagram.com')) {
      console.log('📡 Trying CORS proxy for Instagram image...');
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
  onStatusUpdate,
  onDelete,
  onVideoClick
}) => {
  console.log('🎬 VideoSubmissionsTable rendered with', submissions.length, 'videos');
  console.log('📅 Sample submission uploadDate check:', submissions[0]?.uploadDate);
  const [platformFilter, setPlatformFilter] = useState<'all' | 'instagram' | 'tiktok' | 'youtube'>('all');
  const [sortBy, setSortBy] = useState<'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'uploadDate' | 'dateSubmitted'>('views');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Handle sorting
  const handleSort = (column: 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'uploadDate' | 'dateSubmitted') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Filter and sort submissions
  const getFilteredAndSortedSubmissions = () => {
    let filtered = submissions;

    // Apply platform filter
    if (platformFilter !== 'all') {
      filtered = submissions.filter(submission => {
        // Check if submission has platform property, otherwise infer from URL
        const platform = submission.platform || 
          (submission.url?.includes('instagram.com') ? 'instagram' : 
           submission.url?.includes('tiktok.com') ? 'tiktok' : 
           submission.url?.includes('youtube.com') ? 'youtube' : 'unknown');
        return platform === platformFilter;
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case 'views':
          aValue = a.views;
          bValue = b.views;
          break;
        case 'likes':
          aValue = a.likes;
          bValue = b.likes;
          break;
        case 'comments':
          aValue = a.comments;
          bValue = b.comments;
          break;
        case 'shares':
          aValue = a.shares || 0;
          bValue = b.shares || 0;
          break;
        case 'engagement':
          aValue = a.likes + a.comments + (a.shares || 0);
          bValue = b.likes + b.comments + (b.shares || 0);
          break;
        case 'uploadDate':
          aValue = new Date(a.uploadDate || a.dateSubmitted).getTime();
          bValue = new Date(b.uploadDate || b.dateSubmitted).getTime();
          break;
        case 'dateSubmitted':
          aValue = new Date(a.dateSubmitted).getTime();
          bValue = new Date(b.dateSubmitted).getTime();
          break;
        default:
          aValue = a.views;
          bValue = b.views;
          break;
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return sorted;
  };

  const filteredAndSortedSubmissions = getFilteredAndSortedSubmissions();

  // Sortable header component
  const SortableHeader: React.FC<{
    column: 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'uploadDate' | 'dateSubmitted';
    children: React.ReactNode;
    className?: string;
  }> = ({ column, children, className }) => (
    <th 
      className={clsx(
        'px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none',
        className
      )}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        <div className="flex flex-col">
          <ChevronUp 
            className={clsx(
              'w-3 h-3 -mb-1',
              sortBy === column && sortOrder === 'asc' ? 'text-blue-600' : 'text-gray-300'
            )} 
          />
          <ChevronDown 
            className={clsx(
              'w-3 h-3',
              sortBy === column && sortOrder === 'desc' ? 'text-blue-600' : 'text-gray-300'
            )} 
          />
        </div>
      </div>
    </th>
  );

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };


  // Calculate engagement percentage
  const calculateEngagementRate = (submission: VideoSubmission): number => {
    if (submission.views === 0) return 0;
    const totalEngagement = submission.likes + submission.comments + (submission.shares || 0);
    return (totalEngagement / submission.views) * 100;
  };

  // Get relative time string (e.g. "3 hours ago", "2 days ago")
  const getRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears > 0) return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
    if (diffMonths > 0) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    if (diffWeeks > 0) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return (
    <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg overflow-hidden">
      {/* Table Header */}
      <div className="px-6 py-5 border-b border-white/5 bg-zinc-900/40">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setPlatformFilter('all')}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                  platformFilter === 'all' 
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
              >
                All
              </button>
              <button 
                onClick={() => setPlatformFilter('instagram')}
                className={clsx(
                  'p-2 rounded-lg transition-all',
                  platformFilter === 'instagram' 
                    ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500 dark:ring-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 opacity-60 hover:opacity-100'
                )}
                title="Instagram"
              >
                <img src={InstagramIcon} alt="Instagram" className="w-6 h-6 object-contain" />
              </button>
              <button 
                onClick={() => setPlatformFilter('tiktok')}
                className={clsx(
                  'p-2 rounded-lg transition-all',
                  platformFilter === 'tiktok' 
                    ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500 dark:ring-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 opacity-60 hover:opacity-100'
                )}
                title="TikTok"
              >
                <img src={TikTokIcon} alt="TikTok" className="w-6 h-6 object-contain" />
              </button>
              <button 
                onClick={() => setPlatformFilter('youtube')}
                className={clsx(
                  'p-2 rounded-lg transition-all',
                  platformFilter === 'youtube' 
                    ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500 dark:ring-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 opacity-60 hover:opacity-100'
                )}
                title="YouTube Shorts"
              >
                <img src={YouTubeShortsIcon} alt="YouTube Shorts" className="w-6 h-6 object-contain" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider sticky left-0 bg-zinc-900/60 backdrop-blur z-10 min-w-[280px]">
                Video
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px]">
                Trend
              </th>
              <SortableHeader column="views" className="min-w-[120px]">
                Views
              </SortableHeader>
              <SortableHeader column="likes" className="min-w-[120px]">
                Likes
              </SortableHeader>
              <SortableHeader column="comments" className="min-w-[120px]">
                Comments
              </SortableHeader>
              <SortableHeader column="shares" className="min-w-[120px]">
                Shares
              </SortableHeader>
              <SortableHeader column="engagement" className="min-w-[140px]">
                Engagement
              </SortableHeader>
              <SortableHeader column="uploadDate" className="min-w-[120px]">
                Upload Date
              </SortableHeader>
              <SortableHeader column="dateSubmitted" className="min-w-[120px]">
                Date Added
              </SortableHeader>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[120px]">
                Last Refresh
              </th>
              <th className="w-12 px-6 py-4 text-left"></th>
            </tr>
          </thead>
          <tbody className="bg-zinc-900/60 divide-y divide-white/5">
            {filteredAndSortedSubmissions.map((submission) => {
              const engagementRate = calculateEngagementRate(submission);
              
              return (
                <tr 
                  key={submission.id}
                  onClick={() => onVideoClick?.(submission)}
                  className="hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-5 sticky left-0 bg-zinc-900/60 backdrop-blur z-10 group-hover:bg-white/5">
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
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {submission.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          @{submission.uploaderHandle}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <MiniTrendChart 
                      data={TrendCalculationService.getViewsTrend(submission)}
                      className="flex items-center justify-center"
                    />
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center space-x-2">
                      <Eye className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatNumber(submission.views)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center space-x-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatNumber(submission.likes)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center space-x-2">
                      <MessageCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatNumber(submission.comments)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center space-x-2">
                      <Share2 className="w-4 h-4 text-purple-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatNumber(submission.shares || 0)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center space-x-2">
                      <div className={clsx(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        {
                          "bg-green-100 text-green-800": engagementRate >= 3,
                          "bg-yellow-100 text-yellow-800": engagementRate >= 1 && engagementRate < 3,
                          "bg-red-100 text-red-800": engagementRate < 1,
                        }
                      )}>
                        {engagementRate.toFixed(2)}%
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm text-zinc-300">
                      {submission.uploadDate ? 
                        new Date(submission.uploadDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : 
                        new Date(submission.dateSubmitted).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })
                      }
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm text-zinc-300">
                      {new Date(submission.dateSubmitted).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm text-zinc-400">
                      {submission.lastRefreshed ? getRelativeTime(new Date(submission.lastRefreshed)) : 'Never'}
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No videos found</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            No videos match the selected time period. Try adjusting your date filter or add some new video submissions.
          </p>
        </div>
      )}
    </div>
  );
};
