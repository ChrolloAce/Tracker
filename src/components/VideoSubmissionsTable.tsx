import React, { useEffect, useState, useMemo } from 'react';
import { MoreVertical, Eye, Heart, MessageCircle, Share2, Trash2, Edit3, ChevronUp, ChevronDown, Filter, TrendingUp, TrendingDown, Minus, Bookmark, Clock } from 'lucide-react';
import Lottie from 'lottie-react';
import { VideoSubmission } from '../types';
import { PlatformIcon } from './ui/PlatformIcon';
import { MiniTrendChart } from './ui/MiniTrendChart';
import { TrendCalculationService } from '../services/TrendCalculationService';
import { clsx } from 'clsx';
import InstagramApiService from '../services/InstagramApiService';
import VideoPlayerModal from './VideoPlayerModal';
import Pagination from './ui/Pagination';
import ColumnPreferencesService from '../services/ColumnPreferencesService';
import { OutlierBadge, calculateOutlierStatus } from './ui/OutlierBadge';
import videoMaterialAnimation from '../../public/lottie/Video Material.json';

interface VideoSubmissionsTableProps {
  submissions: VideoSubmission[];
  onStatusUpdate?: (id: string, status: VideoSubmission['status']) => void;
  onDelete?: (id: string) => void;
  onVideoClick?: (video: VideoSubmission) => void;
  headerTitle?: string; // Custom title for the table header (defaults to "Recent Activity")
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
    // Just use placeholder for any failed images - don't try to proxy
    // Instagram URLs with 403 errors can't be bypassed with simple proxies
    // The proper solution is to store thumbnails during sync via /api/image-proxy
    setThumbnailSrc(`data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjZTVlN2ViIi8+CjxwYXRoIGQ9Ik0yNCAzMkMxNy4zNzI2IDMyIDEyIDI2LjYyNzQgMTIgMjBDMTIgMTMuMzcyNiAxNy4zNzI2IDggMjQgOEMzMC42Mjc0IDggMzYgMTMuMzcyNiAzNiAyMEMzNiAyNi42Mjc0IDMwLjYyNzQgMzIgMjQgMzJaTTI0IDI4QzI4LjQxODMgMjggMzIgMjQuNDE4MyAzMiAyMEMzMiAxNS41ODE3IDI4LjQxODMgMTIgMjQgMTJDMTkuNTgxNyAxMiAxNiAxNS41ODE3IDE2IDIwQzE2IDI0LjQxODMgMTkuNTgxNyAyOCAyNCAyOFoiIGZpbGw9IiM5Y2EzYWYiLz4KPC9zdmc+Cg==`);
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
  onVideoClick,
  headerTitle
}) => {
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('videoSubmissions_itemsPerPage');
    return saved ? Number(saved) : 10;
  });
  
  const [sortBy, setSortBy] = useState<'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'uploadDate' | 'dateSubmitted'>('views');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<VideoSubmission | null>(null);
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  
  // Load column preferences from localStorage
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = ColumnPreferencesService.getPreferences('videoSubmissions');
    return saved || {
      video: true,
      preview: true,
      trend: true,
      views: true,
      likes: true,
      comments: true,
      shares: true,
      bookmarks: true,
      duration: true,
      engagement: true,
      outlier: true,
      uploadDate: true,
      dateAdded: true,
      lastRefresh: true
    };
  });

  // Save column preferences when they change
  useEffect(() => {
    ColumnPreferencesService.savePreferences('videoSubmissions', visibleColumns);
  }, [visibleColumns]);

  // Save items per page preference
  useEffect(() => {
    localStorage.setItem('videoSubmissions_itemsPerPage', String(itemsPerPage));
  }, [itemsPerPage]);

  // Calculate outlier statistics per account
  const accountStats = useMemo(() => {
    const stats = new Map<string, { median: number; std: number; count: number }>();
    
    // Group videos by account
    const accountVideos = new Map<string, number[]>();
    submissions.forEach(video => {
      const accountId = video.uploaderHandle || 'unknown';
      if (!accountVideos.has(accountId)) {
        accountVideos.set(accountId, []);
      }
      accountVideos.get(accountId)!.push(video.views);
    });
    
    // Calculate stats for each account
    accountVideos.forEach((views, accountId) => {
      if (views.length < 2) {
        stats.set(accountId, { median: views[0] || 0, std: 0, count: views.length });
        return;
      }
      
      // Calculate median
      const sorted = [...views].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      
      // Calculate standard deviation
      const mean = views.reduce((sum, v) => sum + v, 0) / views.length;
      const squareDiffs = views.map(v => Math.pow(v - mean, 2));
      const avgSquareDiff = squareDiffs.reduce((sum, v) => sum + v, 0) / views.length;
      const std = Math.sqrt(avgSquareDiff);
      
      stats.set(accountId, { median, std, count: views.length });
    });
    
    return stats;
  }, [submissions]);

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
    // Apply sorting
    const sorted = [...submissions].sort((a, b) => {
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

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedSubmissions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSubmissions = filteredAndSortedSubmissions.slice(startIndex, endIndex);

  // Reset to page 1 when submissions change
  useEffect(() => {
    setCurrentPage(1);
  }, [submissions.length]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

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

  const formatDuration = (seconds: number | undefined): string => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    <div className="relative rounded-2xl border border-white/5 shadow-lg overflow-hidden" style={{ backgroundColor: '#121214' }}>
      {/* Depth Gradient Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
        }}
      />
      
      {/* Table Header */}
      <div className="relative px-6 py-5 border-b border-white/5 z-10" style={{ backgroundColor: 'rgba(18, 18, 20, 0.6)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{headerTitle || 'Recent Activity'}</h2>
          </div>
          <div className="flex items-center space-x-3">
            {/* Column Visibility Toggle */}
            <div className="relative">
              <button
                onClick={() => setShowColumnToggle(!showColumnToggle)}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg hover:border-white/20 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>Columns</span>
              </button>
              
              {showColumnToggle && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-800 border border-white/10 rounded-lg shadow-xl p-4 z-50">
                  <h3 className="text-sm font-semibold text-white mb-3">Toggle Columns</h3>
                  <div className="space-y-2">
                    {Object.entries({
                      video: 'Video',
                      preview: 'Preview',
                      trend: 'Trend',
                      views: 'Views',
                      likes: 'Likes',
                      comments: 'Comments',
                      shares: 'Shares',
                      bookmarks: 'Bookmarks',
                      duration: 'Video Length',
                      engagement: 'Engagement Rate',
                      outlier: 'Outlier Factor',
                      uploadDate: 'Upload Date',
                      dateAdded: 'Date Added',
                      lastRefresh: 'Last Refresh'
                    }).map(([key, label]) => (
                      <label key={key} className="flex items-center space-x-2 cursor-pointer hover:bg-white/5 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={visibleColumns[key as keyof typeof visibleColumns]}
                          onChange={(e) => setVisibleColumns(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-300">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="relative overflow-x-auto z-10">
        <table className="w-full min-w-max">
          <thead>
            <tr className="border-b border-white/5">
              {visibleColumns.video && (
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider sticky left-0 z-20 min-w-[280px]" style={{ backgroundColor: 'rgba(18, 18, 20, 0.95)' }}>
                  Video
                </th>
              )}
              {visibleColumns.preview && (
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[100px]">
                  Preview
                </th>
              )}
              {visibleColumns.trend && (
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px]">
                  Trend
                </th>
              )}
              {visibleColumns.views && (
                <SortableHeader column="views" className="min-w-[120px]">
                  Views
                </SortableHeader>
              )}
              {visibleColumns.likes && (
                <SortableHeader column="likes" className="min-w-[120px]">
                  Likes
                </SortableHeader>
              )}
              {visibleColumns.comments && (
                <SortableHeader column="comments" className="min-w-[120px]">
                  Comments
                </SortableHeader>
              )}
              {visibleColumns.shares && (
                <SortableHeader column="shares" className="min-w-[120px]">
                  Shares
                </SortableHeader>
              )}
              {visibleColumns.bookmarks && (
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[120px]">
                  Bookmarks
                </th>
              )}
              {visibleColumns.duration && (
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[100px]">
                  Length
                </th>
              )}
              {visibleColumns.engagement && (
                <SortableHeader column="engagement" className="min-w-[140px]">
                  Engagement
                </SortableHeader>
              )}
              {visibleColumns.outlier && (
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[160px]">
                  Outlier Factor
                </th>
              )}
              {visibleColumns.uploadDate && (
                <SortableHeader column="uploadDate" className="min-w-[120px]">
                  Upload Date
                </SortableHeader>
              )}
              {visibleColumns.dateAdded && (
                <SortableHeader column="dateSubmitted" className="min-w-[120px]">
                  Date Added
                </SortableHeader>
              )}
              {visibleColumns.lastRefresh && (
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[120px]">
                  Last Refresh
                </th>
              )}
              <th className="w-12 px-6 py-4 text-left"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {paginatedSubmissions.map((submission) => {
              const engagementRate = calculateEngagementRate(submission);
              const isLoading = (submission as any).isLoading;
              
              return (
                <tr 
                  key={submission.id}
                  onClick={(e) => {
                    // Don't trigger row click if clicking on video preview link or if loading
                    if (isLoading || (e.target as HTMLElement).closest('a')) return;
                    onVideoClick?.(submission);
                  }}
                  className={clsx(
                    'transition-colors group',
                    {
                      'hover:bg-white/5 cursor-pointer': !isLoading,
                      'bg-yellow-900/10 animate-pulse cursor-not-allowed pointer-events-none': isLoading
                    }
                  )}
                  style={{ backgroundColor: isLoading ? undefined : '#121214' }}
                >
                  {visibleColumns.video && (
                    <td className="px-6 py-5 sticky left-0 z-20 group-hover:bg-white/5" style={{ backgroundColor: 'rgba(18, 18, 20, 0.95)' }}>
                      <div className="flex items-center space-x-4">
                        <div className="relative">
                          {submission.uploaderProfilePicture ? (
                            <img
                              src={submission.uploaderProfilePicture}
                              alt={submission.uploaderHandle || submission.uploader || 'Account'}
                              className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-white shadow-sm"
                              onError={(e) => {
                                // Fallback to default avatar if profile picture fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  const fallback = document.createElement('div');
                                  fallback.className = 'w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 ring-2 ring-white shadow-sm';
                                  fallback.innerHTML = `<span class="text-sm font-bold text-gray-900 dark:text-white">${(submission.uploaderHandle || submission.uploader || 'U').charAt(0).toUpperCase()}</span>`;
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 ring-2 ring-white shadow-sm">
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {(submission.uploaderHandle || submission.uploader || 'U').charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1">
                            <PlatformIcon platform={submission.platform} size="sm" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-white" title={submission.title || submission.caption || ''} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                              {(() => {
                                const fullTitle = submission.title || submission.caption || '(No caption)';
                                return fullTitle.length > 20 ? fullTitle.substring(0, 20) + '...' : fullTitle;
                              })()}
                            </p>
                            {isLoading && (
                              <svg className="animate-spin h-3 w-3 text-yellow-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            @{submission.uploaderHandle || submission.uploader || 'unknown'}
                          </p>
                        </div>
                      </div>
                    </td>
                  )}
                  {visibleColumns.preview && (
                    <td className="px-6 py-5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          
                          console.log('Opening video player:', {
                            videoId: submission.id,
                            url: submission.url,
                            platform: submission.platform,
                            hasUrl: !!submission.url
                          });
                          
                          // Validate URL before opening player
                          if (!submission.url || submission.url.trim() === '') {
                            console.error('❌ Video URL is empty, cannot open player');
                            alert('This video has no URL. Please try refreshing the page.');
                            return;
                          }
                          
                          setSelectedVideoForPlayer(submission);
                          setVideoPlayerOpen(true);
                        }}
                        className="block hover:opacity-80 transition-opacity group cursor-pointer"
                      >
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 shadow-sm hover:shadow-md transition-all relative">
                          <ThumbnailImage submission={submission} />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                          </div>
                        </div>
                      </button>
                    </td>
                  )}
                  {visibleColumns.trend && (
                    <td className="px-6 py-5">
                      <MiniTrendChart 
                        data={TrendCalculationService.getViewsTrend(submission)}
                        className="flex items-center justify-center"
                      />
                    </td>
                  )}
                  {visibleColumns.views && (
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-2">
                        <Eye className="w-4 h-4 text-gray-900 dark:text-white" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatNumber(submission.views)}
                        </span>
                      </div>
                    </td>
                  )}
                  {visibleColumns.likes && (
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-2">
                        <Heart className="w-4 h-4 text-gray-900 dark:text-white" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatNumber(submission.likes)}
                        </span>
                      </div>
                    </td>
                  )}
                  {visibleColumns.comments && (
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-2">
                        <MessageCircle className="w-4 h-4 text-gray-900 dark:text-white" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatNumber(submission.comments)}
                        </span>
                      </div>
                    </td>
                  )}
                  {visibleColumns.shares && (
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-2">
                        <Share2 className="w-4 h-4 text-gray-900 dark:text-white" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatNumber(submission.shares || 0)}
                        </span>
                      </div>
                    </td>
                  )}
                  {visibleColumns.bookmarks && (
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-2">
                        <Bookmark className="w-4 h-4 text-gray-900 dark:text-white" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatNumber((submission as any).saves || 0)}
                        </span>
                      </div>
                    </td>
                  )}
                  {visibleColumns.duration && (
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-900 dark:text-white" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatDuration(submission.duration)}
                        </span>
                      </div>
                    </td>
                  )}
                  {visibleColumns.engagement && (
                    <td className="px-6 py-5">
                      <div
                        className={clsx(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                          {
                            "bg-green-500/15 text-green-400 border-green-500/30": engagementRate >= 5,
                            "bg-green-500/10 text-green-400 border-green-500/20": engagementRate >= 3 && engagementRate < 5,
                            "bg-gray-500/10 text-gray-400 border-gray-500/20": engagementRate >= 1 && engagementRate < 3,
                            "bg-red-500/10 text-red-400 border-red-500/20": engagementRate < 1,
                          }
                        )}
                      >
                        {engagementRate >= 5 ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : engagementRate >= 3 ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : engagementRate >= 1 ? (
                          <Minus className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        <span>{engagementRate.toFixed(2)}%</span>
                      </div>
                    </td>
                  )}
                  {visibleColumns.outlier && (() => {
                    const accountId = submission.uploaderHandle || 'unknown';
                    const stats = accountStats.get(accountId);
                    
                    if (!stats || stats.count < 2) {
                      return (
                        <td className="px-6 py-5">
                          <span className="text-xs text-zinc-500">N/A</span>
                        </td>
                      );
                    }
                    
                    const outlierStatus = calculateOutlierStatus(
                      submission.views,
                      stats.median,
                      stats.std
                    );
                    const factor = stats.median > 0 ? submission.views / stats.median : 1;
                    const factorLabel = `${factor.toFixed(2)}x`;
                    
                    return (
                      <td className="px-6 py-5">
                        <OutlierBadge
                          level={outlierStatus.level}
                          direction={outlierStatus.direction}
                          zScore={outlierStatus.zScore}
                          percentageDiff={outlierStatus.percentageDiff}
                          labelText={factorLabel}
                        />
                      </td>
                    );
                  })()}
                  {visibleColumns.uploadDate && (
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
                  )}
                  {visibleColumns.dateAdded && (
                    <td className="px-6 py-5">
                      <div className="text-sm text-zinc-300">
                        {new Date(submission.dateSubmitted).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    </td>
                  )}
                  {visibleColumns.lastRefresh && (
                    <td className="px-6 py-5">
                      <div className="text-sm text-zinc-400">
                        {submission.lastRefreshed ? getRelativeTime(new Date(submission.lastRefreshed)) : 'Never'}
                      </div>
                    </td>
                  )}
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

      {/* Pagination */}
      {filteredAndSortedSubmissions.length > 0 && (
        <div className="relative z-10">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={filteredAndSortedSubmissions.length}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        </div>
      )}

      {/* Empty State */}
      {submissions.length === 0 && (
        <div className="relative px-6 py-16 text-center z-10">
          <div className="w-64 h-64 mx-auto mb-6">
            <Lottie animationData={videoMaterialAnimation} loop={true} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No videos found</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            No videos match the selected time period. Try adjusting your date filter or add some new video submissions.
          </p>
        </div>
      )}

      {/* Video Player Modal */}
      {selectedVideoForPlayer && (
        <VideoPlayerModal
          isOpen={videoPlayerOpen}
          onClose={() => {
            setVideoPlayerOpen(false);
            setSelectedVideoForPlayer(null);
          }}
          videoUrl={selectedVideoForPlayer.url}
          title={selectedVideoForPlayer.title}
          platform={selectedVideoForPlayer.platform}
        />
      )}
    </div>
  );
};
