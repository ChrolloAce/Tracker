import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Eye, Heart, MessageCircle, Share2, Trash2, ChevronUp, ChevronDown, Filter, TrendingUp, TrendingDown, Minus, Bookmark, Clock, Loader, RefreshCw, ExternalLink, Copy, User, BarChart3, Download, Link as LinkIcon } from 'lucide-react';
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
import { HeicImage } from './HeicImage';
import { FloatingDropdown, DropdownItem, DropdownDivider } from './ui/FloatingDropdown';
import { ExportVideosModal } from './ExportVideosModal';
import { exportVideosToCSV } from '../utils/csvExport';
import { Toast } from './ui/Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';

interface VideoSubmissionsTableProps {
  submissions: VideoSubmission[];
  onDelete?: (id: string) => void;
  onVideoClick?: (video: VideoSubmission) => void;
  headerTitle?: string; // Custom title for the table header (defaults to "Recent Activity")
  trendPeriodDays?: number; // Number of days for trend calculation (defaults to 7)
}

// Dropdown menu component for video actions
const DropdownMenu: React.FC<{
  submission: VideoSubmission;
  onDelete?: (id: string) => void;
  onVideoClick?: (video: VideoSubmission) => void;
}> = ({ submission, onDelete, onVideoClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleDelete = () => {
    if (onDelete && window.confirm('Are you sure you want to delete this video submission?')) {
      onDelete(submission.id);
    }
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation(); // Prevent row click
          setIsOpen(!isOpen);
        }}
        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      <FloatingDropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        align="right"
      >
        <DropdownItem
          icon={<ExternalLink className="w-4 h-4" />}
          label="Go to Video"
              onClick={(e) => {
                e.stopPropagation();
                window.open(submission.url, '_blank');
                setIsOpen(false);
              }}
        />
        
        <DropdownItem
          icon={<Copy className="w-4 h-4" />}
          label="Copy Link"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(submission.url);
                alert('Video link copied!');
                setIsOpen(false);
              }}
        />
        
            {submission.uploaderHandle && (
          <DropdownItem
            icon={<User className="w-4 h-4" />}
            label="Copy Username"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(submission.uploaderHandle);
                  alert('Username copied!');
                  setIsOpen(false);
                }}
          />
        )}
        
        <DropdownItem
          icon={<BarChart3 className="w-4 h-4" />}
          label="View Stats"
              onClick={(e) => {
                e.stopPropagation();
                if (onVideoClick) {
                  onVideoClick(submission);
                }
                setIsOpen(false);
              }}
        />
        
        <DropdownDivider />
        
        <DropdownItem
          icon={<Trash2 className="w-4 h-4" />}
          label="Delete"
          variant="danger"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
        />
      </FloatingDropdown>
    </>
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

  // If no thumbnail, render nothing - just leave the space empty
  if (!thumbnailSrc || thumbnailSrc.trim() === '') {
    return null;
  }

  return (
    <HeicImage
      src={thumbnailSrc}
      alt="Video thumbnail"
      className="w-full h-full object-cover"
    />
  );
};

export const VideoSubmissionsTable: React.FC<VideoSubmissionsTableProps> = ({ 
  submissions, 
  onDelete,
  onVideoClick,
  headerTitle,
  trendPeriodDays = 7
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
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsMenuRef = useRef<HTMLButtonElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Debug: Watch showDeleteConfirm state changes
  useEffect(() => {
    console.log('🟡 [VideoTable] showDeleteConfirm state changed to:', showDeleteConfirm);
  }, [showDeleteConfirm]);
  
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

  // Selection and action handlers (defined after filteredAndSortedSubmissions)
  const handleSelectAll = () => {
    // Select ALL videos in filtered list, not just current page
    if (selectedVideos.size === filteredAndSortedSubmissions.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(filteredAndSortedSubmissions.map((v: VideoSubmission) => v.id)));
    }
  };

  const handleSelectVideo = (videoId: string) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };

  const handleCopyLinks = () => {
    const selectedSubmissions = filteredAndSortedSubmissions.filter((v: VideoSubmission) => selectedVideos.has(v.id));
    const links = selectedSubmissions.map(v => v.url).join('\n');
    navigator.clipboard.writeText(links);
    setShowActionsMenu(false);
    setShowToast({ message: `Copied ${selectedSubmissions.length} video link${selectedSubmissions.length !== 1 ? 's' : ''} to clipboard`, type: 'success' });
    console.log(`✅ Copied ${selectedSubmissions.length} video links to clipboard`);
  };

  const handleBulkDelete = () => {
    console.log('🔴🔴🔴 [BULK DELETE] Button clicked!');
    console.log('  onDelete exists:', !!onDelete);
    console.log('  Selected videos count:', selectedVideos.size);
    console.log('  Filtered videos count:', filteredAndSortedSubmissions.length);
    console.log('  Current showDeleteConfirm:', showDeleteConfirm);
    console.log('  Current showActionsMenu:', showActionsMenu);
    
    if (!onDelete) {
      console.error('❌ onDelete function not provided');
      setShowToast({ message: 'Delete function not available. Please refresh the page.', type: 'error' });
      return;
    }
    
    if (selectedVideos.size === 0) {
      console.warn('⚠️ No videos selected');
      setShowToast({ message: 'Please select videos to delete first.', type: 'info' });
      return;
    }
    
    const selectedSubmissions = filteredAndSortedSubmissions.filter((v: VideoSubmission) => selectedVideos.has(v.id));
    const count = selectedSubmissions.length;
    
    console.log('  Videos to delete:', count);
    
    if (count === 0) {
      console.error('❌ No matching videos found');
      setShowToast({ message: 'No videos found to delete. Please try again.', type: 'error' });
      return;
    }
    
    // Close menu first, then show dialog after a tiny delay
    console.log('🔴 Setting showActionsMenu to FALSE');
    setShowActionsMenu(false);
    
    // Delay opening the dialog to ensure menu is fully closed
    console.log('🔴 Setting timeout to show delete confirm');
    setTimeout(() => {
      console.log('🔴 Opening delete confirmation dialog NOW');
      setShowDeleteConfirm(true);
    }, 10);
  };

  const confirmBulkDelete = () => {
    const selectedSubmissions = filteredAndSortedSubmissions.filter((v: VideoSubmission) => selectedVideos.has(v.id));
    const count = selectedSubmissions.length;
    
    console.log(`🗑️ [BULK DELETE] Starting deletion of ${count} videos`);
    
    // Close dialog and clear selection
    setShowDeleteConfirm(false);
    setSelectedVideos(new Set());
    
    // Delete each video
    selectedSubmissions.forEach((video, index) => {
      console.log(`  Deleting ${index + 1}/${count}: ${video.title || video.caption}`);
      try {
        onDelete!(video.id);
      } catch (error) {
        console.error(`  ❌ Failed to delete video ${video.id}:`, error);
      }
    });
    
    setShowToast({ message: `Deleting ${count} video${count !== 1 ? 's' : ''}...`, type: 'success' });
    console.log(`✅ [BULK DELETE] Initiated deletion of ${count} videos`);
  };

  const handleExport = (filename: string) => {
    const selectedSubmissions = filteredAndSortedSubmissions.filter((v: VideoSubmission) => selectedVideos.has(v.id));
    exportVideosToCSV(selectedSubmissions, filename);
    setShowExportModal(false);
    setSelectedVideos(new Set()); // Clear selection after export
  };

  // Backdrop handles outside clicks now, so this is removed to prevent conflicts

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

  // Sortable header component with tooltip
  const SortableHeader: React.FC<{
    column: 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'uploadDate' | 'dateSubmitted';
    children: React.ReactNode;
    className?: string;
    tooltip: string;
  }> = ({ column, children, className, tooltip }) => {
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
    
    const handleMouseMove = (e: React.MouseEvent) => {
      setTooltipPosition({ x: e.clientX, y: e.clientY });
    };
    
    const handleMouseLeave = () => {
      setTooltipPosition(null);
    };
    
    return (
      <>
    <th 
      className={clsx(
        'px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none',
        className
      )}
      onClick={() => handleSort(column)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-center space-x-0.5 sm:space-x-1">
        <span>{children}</span>
        <div className="flex flex-col">
          <ChevronUp 
            className={clsx(
              'w-2.5 sm:w-3 h-2.5 sm:h-3 -mb-1',
              sortBy === column && sortOrder === 'asc' ? 'text-blue-600' : 'text-gray-300'
            )} 
          />
          <ChevronDown 
            className={clsx(
              'w-2.5 sm:w-3 h-2.5 sm:h-3',
              sortBy === column && sortOrder === 'desc' ? 'text-blue-600' : 'text-gray-300'
            )} 
          />
        </div>
      </div>
    </th>
        
        {/* Tooltip portal */}
        {tooltipPosition && createPortal(
          <div
            className="fixed z-[999999] pointer-events-none"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y + 20}px`,
              transform: 'translateX(-50%)',
              maxWidth: '320px',
              width: 'max-content'
            }}
          >
            <div 
              className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10 p-3"
              style={{
                maxWidth: '320px',
                width: 'max-content'
              }}
            >
              <div className="text-xs text-gray-300 leading-relaxed whitespace-normal">
                {tooltip}
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  };
  
  // Non-sortable header component with tooltip
  const ColumnHeader: React.FC<{
    children: React.ReactNode;
    className?: string;
    tooltip: string;
    sticky?: boolean;
  }> = ({ children, className, tooltip, sticky }) => {
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
    
    const handleMouseMove = (e: React.MouseEvent) => {
      setTooltipPosition({ x: e.clientX, y: e.clientY });
    };
    
    const handleMouseLeave = () => {
      setTooltipPosition(null);
    };
    
    return (
      <>
        <th 
          className={clsx(
            'px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider',
            sticky && 'sticky left-0 z-20',
            className
          )}
          style={sticky ? { backgroundColor: 'rgba(18, 18, 20, 0.95)' } : undefined}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {children}
        </th>
        
        {/* Tooltip portal */}
        {tooltipPosition && createPortal(
          <div
            className="fixed z-[999999] pointer-events-none"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y + 20}px`,
              transform: 'translateX(-50%)',
              maxWidth: '320px',
              width: 'max-content'
            }}
          >
            <div 
              className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10 p-3"
              style={{
                maxWidth: '320px',
                width: 'max-content'
              }}
            >
              <div className="text-xs text-gray-300 leading-relaxed whitespace-normal">
                {tooltip}
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  };

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
      <div className="relative px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 border-b border-white/5 z-10" style={{ backgroundColor: 'rgba(18, 18, 20, 0.6)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">{headerTitle || 'Recent Activity'}</h2>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            {/* Actions Dropdown */}
            <div className="relative">
              <button
                ref={actionsMenuRef}
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                disabled={selectedVideos.size === 0}
                className={clsx(
                  "flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 text-sm border rounded-lg transition-colors",
                  selectedVideos.size > 0
                    ? "text-white bg-white/10 border-white/20 hover:bg-white/15"
                    : "text-gray-500 border-white/5 cursor-not-allowed opacity-50"
                )}
              >
                <MoreVertical className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {selectedVideos.size > 0 ? `Actions (${selectedVideos.size})` : 'Actions'}
                </span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* Actions Dropdown Menu (Portal) */}
              {showActionsMenu && selectedVideos.size > 0 && actionsMenuRef.current && createPortal(
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-[9998]" 
                    onClick={() => setShowActionsMenu(false)}
                  />
                  
                  {/* Dropdown Menu */}
                  <div 
                    className="fixed w-48 bg-[#1A1A1A] border border-gray-800 rounded-lg shadow-xl z-[9999] overflow-hidden"
                    style={{
                      top: `${actionsMenuRef.current.getBoundingClientRect().bottom + 8}px`,
                      left: `${actionsMenuRef.current.getBoundingClientRect().right - 192}px`
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyLinks();
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center space-x-3 transition-colors"
                    >
                      <LinkIcon className="w-4 h-4" />
                      <span>Copy Links</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowExportModal(true);
                        setShowActionsMenu(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center space-x-3 transition-colors border-t border-gray-800"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export to CSV</span>
                    </button>
                    {onDelete && (
                      <button
                        onClick={(e) => {
                          console.log('🔴 BUTTON CLICK EVENT FIRED');
                          e.stopPropagation();
                          e.preventDefault();
                          handleBulkDelete();
                        }}
                        onMouseDown={() => console.log('🔴 MOUSE DOWN on delete button')}
                        onMouseUp={() => console.log('🔴 MOUSE UP on delete button')}
                        className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center space-x-3 transition-colors border-t border-gray-800"
                        type="button"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Selected</span>
                      </button>
                    )}
                  </div>
                </>,
                document.body
              )}
            </div>

            {/* Column Visibility Toggle */}
            <div className="relative">
              <button
                onClick={() => setShowColumnToggle(!showColumnToggle)}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg hover:border-white/20 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Columns</span>
              </button>
              
              {showColumnToggle && createPortal(
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-[9998]" 
                    onClick={() => setShowColumnToggle(false)}
                  />
                  {/* Dropdown */}
                  <div className="fixed right-4 top-20 w-64 bg-black border border-white/20 rounded-lg shadow-2xl p-4 z-[9999]" style={{ boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)' }}>
                  <h3 className="text-sm font-semibold text-white mb-3">Toggle Columns</h3>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
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
                        <label key={key} className="flex items-center space-x-2 cursor-pointer hover:bg-white/10 p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={visibleColumns[key as keyof typeof visibleColumns]}
                          onChange={(e) => setVisibleColumns(prev => ({ ...prev, [key]: e.target.checked }))}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-white focus:ring-white/50"
                        />
                          <span className="text-sm text-gray-200">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                </>,
                document.body
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="relative overflow-x-auto z-10 -mx-3 sm:-mx-0">
        <table className="w-full min-w-max">
          <thead>
            <tr className="border-b border-white/5">
              {/* Select All Checkbox */}
              <th className="w-10 px-2 sm:px-4 py-3 sm:py-4 text-left sticky left-0 z-20 bg-[#121214]">
                <div className="flex items-center justify-center" title={`Select all ${filteredAndSortedSubmissions.length} videos`}>
                  <input
                    type="checkbox"
                    checked={filteredAndSortedSubmissions.length > 0 && selectedVideos.size === filteredAndSortedSubmissions.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-white focus:ring-2 focus:ring-white/20 cursor-pointer"
                  />
                </div>
              </th>
              {visibleColumns.video && (
                <ColumnHeader 
                  sticky
                  className="min-w-[200px] sm:min-w-[280px] left-10"
                  tooltip="Video title, creator, and basic information. Click on a video row to see detailed analytics, engagement history, and performance trends."
                >
                  Video
                </ColumnHeader>
              )}
              {visibleColumns.preview && (
                <ColumnHeader 
                  className="min-w-[80px] sm:min-w-[100px]"
                  tooltip="Visual preview thumbnail of the video content. Click to view the full video on its original platform."
                >
                  Preview
                </ColumnHeader>
              )}
              {visibleColumns.trend && (
                <ColumnHeader 
                  className="min-w-[60px] sm:min-w-[80px]"
                  tooltip="Performance trend indicator showing if the video is gaining or losing momentum. Green arrow indicates growing engagement, red arrow shows declining interest."
                >
                  Trend
                </ColumnHeader>
              )}
              {visibleColumns.views && (
                <SortableHeader 
                  column="views" 
                  className="min-w-[120px]"
                  tooltip="Total number of times this video has been viewed. This is the primary metric for measuring content reach and visibility across the platform."
                >
                  Views
                </SortableHeader>
              )}
              {visibleColumns.likes && (
                <SortableHeader 
                  column="likes" 
                  className="min-w-[120px]"
                  tooltip="Total likes received on the video. High like counts indicate strong audience appreciation and content resonance. Click to sort videos by popularity."
                >
                  Likes
                </SortableHeader>
              )}
              {visibleColumns.comments && (
                <SortableHeader 
                  column="comments" 
                  className="min-w-[120px]"
                  tooltip="Total number of comments on the video. High comment counts suggest strong audience engagement, conversation, and community interaction."
                >
                  Comments
                </SortableHeader>
              )}
              {visibleColumns.shares && (
                <SortableHeader 
                  column="shares" 
                  className="min-w-[120px]"
                  tooltip="Number of times this video has been shared or reposted. Shares indicate viral potential and content that resonates enough for viewers to spread."
                >
                  Shares
                </SortableHeader>
              )}
              {visibleColumns.bookmarks && (
                <ColumnHeader 
                  className="min-w-[90px] sm:min-w-[120px]"
                  tooltip="Number of times viewers saved or bookmarked this video. High bookmark counts indicate valuable content people want to reference or watch again later."
                >
                  Bookmarks
                </ColumnHeader>
              )}
              {visibleColumns.duration && (
                <ColumnHeader 
                  className="min-w-[80px] sm:min-w-[100px]"
                  tooltip="Duration of the video content in minutes and seconds. Shorter videos often have higher completion rates, while longer content can drive more watch time."
                >
                  Length
                </ColumnHeader>
              )}
              {visibleColumns.engagement && (
                <SortableHeader 
                  column="engagement" 
                  className="min-w-[140px]"
                  tooltip="Engagement rate calculated as (Likes + Comments + Shares) / Views × 100. This percentage shows how actively viewers interact with the content. Higher rates indicate more compelling content."
                >
                  Engagement
                </SortableHeader>
              )}
              {visibleColumns.outlier && (
                <ColumnHeader 
                  className="min-w-[120px] sm:min-w-[160px]"
                  tooltip="Indicates if this video's performance is significantly above or below your average. Top Performers exceed expectations, while Underperformers may need content strategy adjustments."
                >
                  Outlier Factor
                </ColumnHeader>
              )}
              {visibleColumns.uploadDate && (
                <SortableHeader 
                  column="uploadDate" 
                  className="min-w-[120px]"
                  tooltip="The date when this video was originally published on the platform. Helps track content freshness and identify trending vs. evergreen content performance."
                >
                  Upload Date
                </SortableHeader>
              )}
              {visibleColumns.dateAdded && (
                <SortableHeader 
                  column="dateSubmitted" 
                  className="min-w-[120px]"
                  tooltip="The date when you added this video to your tracking dashboard. Use this to monitor how long you've been tracking each piece of content."
                >
                  Date Added
                </SortableHeader>
              )}
              {visibleColumns.lastRefresh && (
                <ColumnHeader 
                  className="min-w-[100px] sm:min-w-[120px]"
                  tooltip="Last time metrics were updated for this video. Data is automatically refreshed periodically to keep performance statistics current and accurate."
                >
                  Last Refresh
                </ColumnHeader>
              )}
              <th className="w-8 sm:w-12 px-2 sm:px-4 md:px-6 py-3 sm:py-4 text-left sticky right-0 z-10" style={{ backgroundColor: 'rgba(18, 18, 20, 0.95)' }}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {paginatedSubmissions.map((submission) => {
              const engagementRate = calculateEngagementRate(submission);
              const isLoading = (submission as any).isLoading;
              // Check if currently syncing
              const isSyncing = submission.syncStatus === 'pending' || submission.syncStatus === 'syncing';
              
              return (
                <tr 
                  key={submission.id}
                  onClick={(e) => {
                    // Don't trigger row click if clicking on video preview link, dropdown menu, checkbox, or if loading
                    if (isLoading || (e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('.relative.opacity-0') || (e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                    onVideoClick?.(submission);
                  }}
                  className={clsx(
                    'transition-colors group',
                    isSyncing && 'bg-zinc-900/30', // Subtle background for syncing videos
                    {
                      'hover:bg-white/5 cursor-pointer': !isLoading,
                      'bg-white/5 dark:bg-white/5 border-l-2 border-white/20 cursor-not-allowed pointer-events-none': isLoading
                    }
                  )}
                  style={{ backgroundColor: isLoading ? undefined : '#121214' }}
                >
                  {/* Checkbox Column */}
                  <td 
                    className="w-10 px-2 sm:px-4 py-3 sm:py-4 sticky left-0 z-20 group-hover:bg-white/5"
                    style={{ backgroundColor: isLoading ? 'rgba(255, 255, 255, 0.05)' : 'rgba(18, 18, 20, 0.95)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedVideos.has(submission.id)}
                      onChange={() => handleSelectVideo(submission.id)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-white focus:ring-2 focus:ring-white/20"
                      disabled={isLoading}
                    />
                  </td>
                  {visibleColumns.video && (
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 sticky left-10 z-10 group-hover:bg-white/5" style={{ backgroundColor: isLoading ? 'rgba(255, 255, 255, 0.05)' : 'rgba(18, 18, 20, 0.95)' }}>
                      <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4">
                        <div className="relative flex-shrink-0">
                          {isLoading ? (
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center relative overflow-hidden bg-white/10">
                              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-white/60 animate-spin" />
                            </div>
                          ) : submission.uploaderProfilePicture && !imageErrors.has(submission.id) ? (
                            <img
                              src={submission.uploaderProfilePicture}
                              alt={submission.uploaderHandle || submission.uploader || 'Account'}
                              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover flex-shrink-0 ring-1 sm:ring-2 ring-white shadow-sm"
                              onError={() => {
                                setImageErrors(prev => new Set(prev).add(submission.id));
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 ring-1 sm:ring-2 ring-white shadow-sm">
                              <span className="text-xs sm:text-sm font-bold text-white">
                                {(submission.uploaderHandle || submission.uploader || 'U').charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="absolute -bottom-0.5 sm:-bottom-1 -right-0.5 sm:-right-1">
                            <PlatformIcon platform={submission.platform} size="sm" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          {isLoading ? (
                            <>
                              <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                                Processing video...
                              </div>
                              <div className="text-[10px] sm:text-xs text-white/40 font-medium flex items-center gap-1 mt-0.5 sm:mt-1">
                                <span className="inline-block w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse"></span>
                                Fetching data from {submission.platform}...
                              </div>
                            </>
                          ) : (
                            <>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate" title={submission.title || submission.caption || ''}>
                              {(() => {
                                const fullTitle = submission.title || submission.caption || '(No caption)';
                                return fullTitle.length > 20 ? fullTitle.substring(0, 20) + '...' : fullTitle;
                              })()}
                            </p>
                                {isSyncing && (
                              <Loader className="animate-spin h-3 w-3 text-blue-400 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">
                            @{submission.uploaderHandle || submission.uploader || 'unknown'}
                          </p>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  )}
                  {visibleColumns.preview && (
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5">
                      {isLoading ? (
                        <div className="w-16 h-16 rounded-lg bg-white/10 animate-pulse"></div>
                      ) : (
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
                      )}
                    </td>
                  )}
                  {visibleColumns.trend && (
                    <td className="px-6 py-5">
                      <MiniTrendChart 
                        data={TrendCalculationService.getViewsTrend(submission, trendPeriodDays)}
                        className="flex items-center justify-center"
                      />
                    </td>
                  )}
                  {visibleColumns.views && (
                    <td className="px-6 py-5">
                      {isLoading ? (
                        <div className="w-16 h-4 bg-white/10 rounded-full animate-pulse"></div>
                      ) : (
                      <div className="flex items-center space-x-2">
                        <Eye className="w-4 h-4 text-gray-900 dark:text-white" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatNumber(submission.views)}
                        </span>
                      </div>
                      )}
                    </td>
                  )}
                  {visibleColumns.likes && (
                    <td className="px-6 py-5">
                      {isLoading ? (
                        <div className="w-16 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                      ) : (
                      <div className="flex items-center space-x-2">
                        <Heart className="w-4 h-4 text-gray-900 dark:text-white" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatNumber(submission.likes)}
                        </span>
                      </div>
                      )}
                    </td>
                  )}
                  {visibleColumns.comments && (
                    <td className="px-6 py-5">
                      {isLoading ? (
                        <div className="w-16 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      ) : (
                      <div className="flex items-center space-x-2">
                        <MessageCircle className="w-4 h-4 text-gray-900 dark:text-white" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatNumber(submission.comments)}
                        </span>
                      </div>
                      )}
                    </td>
                  )}
                  {visibleColumns.shares && (
                    <td className="px-6 py-5">
                      {isLoading ? (
                        <div className="w-16 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                      ) : (
                      <div className="flex items-center space-x-2">
                        <Share2 className="w-4 h-4 text-gray-900 dark:text-white" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {(() => {
                            // Only TikTok has shares available
                            if (submission.platform === 'tiktok') {
                              return formatNumber(submission.shares || 0);
                            }
                            // Instagram, YouTube, and Twitter don't provide share counts
                            return 'N/A';
                          })()}
                        </span>
                      </div>
                      )}
                    </td>
                  )}
                  {visibleColumns.bookmarks && (
                    <td className="px-6 py-5">
                      {isLoading ? (
                        <div className="w-16 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      ) : (
                      <div className="flex items-center space-x-2">
                        <Bookmark className="w-4 h-4 text-gray-900 dark:text-white" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {(() => {
                            // Twitter and TikTok have bookmarks/saves
                            if (submission.platform === 'twitter' || submission.platform === 'tiktok') {
                              const saves = (submission as any).saves || submission.bookmarks || 0;
                              return formatNumber(saves);
                            }
                            // Instagram and YouTube don't have bookmarks
                            return 'N/A';
                          })()}
                        </span>
                      </div>
                      )}
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
                      {isLoading ? (
                        <div className="w-20 h-6 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                      ) : (
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
                      )}
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
                      {isLoading ? (
                        <div className="w-24 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                      ) : (
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
                      )}
                    </td>
                  )}
                  {visibleColumns.dateAdded && (
                    <td className="px-6 py-5">
                      {isLoading ? (
                        <div className="w-24 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.7s' }}></div>
                      ) : (
                      <div className="text-sm text-zinc-300">
                        {new Date(submission.dateSubmitted).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      )}
                    </td>
                  )}
                  {visibleColumns.lastRefresh && (
                    <td className="px-6 py-5">
                      {isLoading ? (
                        <div className="w-20 h-4 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.8s' }}></div>
                      ) : (
                      <div className="text-sm text-zinc-400">
                        {submission.lastRefreshed ? getRelativeTime(new Date(submission.lastRefreshed)) : 'Never'}
                      </div>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-5 sticky right-0 z-10 group-hover:bg-white/5" style={{ backgroundColor: 'rgba(18, 18, 20, 0.95)' }}>
                    <div className="relative">
                      <DropdownMenu submission={submission} onDelete={onDelete} onVideoClick={onVideoClick} />
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

      {/* Export Videos Modal */}
      <ExportVideosModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        selectedCount={selectedVideos.size}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Videos"
        message={`⚠️ You are about to delete ${selectedVideos.size} video${selectedVideos.size !== 1 ? 's' : ''}\n\nThis will permanently delete:\n• ${selectedVideos.size} video${selectedVideos.size !== 1 ? 's' : ''}\n• All associated snapshots and data\n\nThis action CANNOT be undone!`}
        confirmText="Delete Videos"
        cancelText="Cancel"
        requireTyping={true}
        typingConfirmation="DELETE"
        onConfirm={confirmBulkDelete}
        onCancel={() => {
          console.log('🔴 Cancel clicked - closing dialog');
          setShowDeleteConfirm(false);
        }}
        isDanger={true}
      />

      {/* Toast Notification */}
      {showToast && (
        <Toast
          message={showToast.message}
          type={showToast.type}
          onClose={() => setShowToast(null)}
        />
      )}
    </div>
  );
};
