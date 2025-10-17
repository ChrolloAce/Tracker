import React, { useMemo } from 'react';
import { X, Calendar } from 'lucide-react';
import { VideoSubmission } from '../types';
import { VideoSubmissionsTable } from './VideoSubmissionsTable';

interface DayVideosModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  videos: VideoSubmission[];
  metricLabel: string;
  onVideoClick?: (video: VideoSubmission) => void;
  accountFilter?: string; // Optional: filter by account username
  dateRangeLabel?: string; // Optional: show date range instead of specific date (e.g., "Last 7 Days")
}

const DayVideosModal: React.FC<DayVideosModalProps> = ({
  isOpen,
  onClose,
  date,
  videos,
  metricLabel,
  onVideoClick,
  accountFilter,
  dateRangeLabel
}) => {
  if (!isOpen) return null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Filter by account if specified
  const filteredVideos = useMemo(() => {
    if (!accountFilter) return videos;
    return videos.filter(v => 
      v.uploaderHandle?.toLowerCase() === accountFilter.toLowerCase()
    );
  }, [videos, accountFilter]);

  const totalMetrics = useMemo(() => {
    return {
      views: filteredVideos.reduce((sum, v) => sum + v.views, 0),
      likes: filteredVideos.reduce((sum, v) => sum + v.likes, 0),
      comments: filteredVideos.reduce((sum, v) => sum + v.comments, 0),
      shares: filteredVideos.reduce((sum, v) => sum + (v.shares || 0), 0)
    };
  }, [filteredVideos]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-6xl max-h-[85vh] overflow-hidden border border-white/10 ring-1 ring-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <Calendar className="w-6 h-6 text-gray-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {dateRangeLabel && accountFilter 
                  ? `@${accountFilter} ${dateRangeLabel} Stats`
                  : dateRangeLabel || formatDate(date)
                }
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {filteredVideos.length} {filteredVideos.length === 1 ? 'video' : 'videos'} • {metricLabel}
                {accountFilter && !dateRangeLabel && <span className="ml-2 text-emerald-400">• @{accountFilter}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 p-6 border-b border-white/5">
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Total Views</p>
            <p className="text-2xl font-bold text-white">{formatNumber(totalMetrics.views)}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Total Likes</p>
            <p className="text-2xl font-bold text-white">{formatNumber(totalMetrics.likes)}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Total Comments</p>
            <p className="text-2xl font-bold text-white">{formatNumber(totalMetrics.comments)}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Total Shares</p>
            <p className="text-2xl font-bold text-white">{formatNumber(totalMetrics.shares)}</p>
          </div>
        </div>

        {/* Videos Table - Using VideoSubmissionsTable for consistent styling */}
        <div className="overflow-auto" style={{ maxHeight: 'calc(85vh - 280px)' }}>
          {filteredVideos.length > 0 ? (
            <VideoSubmissionsTable 
              submissions={filteredVideos}
              onVideoClick={onVideoClick}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="p-4 bg-white/5 rounded-full mb-4 border border-white/10">
                <Calendar className="w-12 h-12 text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No videos found
              </h3>
              <p className="text-gray-400 text-sm">
                {accountFilter ? 
                  `No videos from @${accountFilter} on ${formatDate(date)}` :
                  `No videos were uploaded on ${formatDate(date)}`
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayVideosModal;

