import React, { useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { VideoSnapshot } from '../../types';
import { formatNumber } from '../../utils/formatters';

interface VideoSnapshotsHistoryProps {
  snapshots: VideoSnapshot[];
}

export const VideoSnapshotsHistory: React.FC<VideoSnapshotsHistoryProps> = ({ snapshots }) => {
  const [snapshotsPage, setSnapshotsPage] = useState(1);
  const snapshotsPerPage = 5;

  if (!snapshots || snapshots.length === 0) return null;

  const sortedSnapshots = [...snapshots].sort((a, b) => 
    new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
  );
  
  const filteredSnapshots = sortedSnapshots;
  
  // Calculate engagement for each snapshot with trend
  const snapshotsWithEngagement = filteredSnapshots.map((snapshot, idx) => {
    const engagement = snapshot.views > 0 
      ? ((snapshot.likes + snapshot.comments + (snapshot.shares || 0)) / snapshot.views) * 100 
      : 0;
    
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    if (idx < filteredSnapshots.length - 1) {
      const prevSnapshot = filteredSnapshots[idx + 1];
      const prevEngagement = prevSnapshot.views > 0 
        ? ((prevSnapshot.likes + prevSnapshot.comments + (prevSnapshot.shares || 0)) / prevSnapshot.views) * 100 
        : 0;
      
      if (engagement > prevEngagement + 0.1) trend = 'up';
      else if (engagement < prevEngagement - 0.1) trend = 'down';
    }
    
    return { ...snapshot, engagement, trend };
  });

  const totalPages = Math.ceil(snapshotsWithEngagement.length / snapshotsPerPage);
  const startIndex = (snapshotsPage - 1) * snapshotsPerPage;
  const endIndex = startIndex + snapshotsPerPage;
  const paginatedSnapshots = snapshotsWithEngagement.slice(startIndex, endIndex);

  return (
    <div className="relative rounded-2xl border border-border-subtle shadow-lg overflow-hidden min-w-0" style={{ backgroundColor: 'var(--surface-secondary)' }}>
      {/* Header with Pagination */}
      <div className="relative px-6 py-4 border-b border-border-subtle" style={{ backgroundColor: 'var(--surface-tertiary)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bookmark className="w-4 h-4 text-content-muted" />
            <div>
              <h3 className="text-base font-semibold text-content">
                Snapshots History
              </h3>
              <p className="text-xs text-content-muted mt-0.5">
                {snapshots.length} {snapshots.length === 1 ? 'recording' : 'recordings'}
              </p>
            </div>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSnapshotsPage(p => Math.max(1, p - 1))}
                disabled={snapshotsPage === 1}
                className="p-1.5 rounded-lg bg-surface-hover hover:bg-surface-active disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-content" />
              </button>
              <span className="text-xs text-content-muted min-w-[80px] text-center">
                Page {snapshotsPage} of {totalPages}
              </span>
              <button
                onClick={() => setSnapshotsPage(p => Math.min(totalPages, p + 1))}
                disabled={snapshotsPage === totalPages}
                className="p-1.5 rounded-lg bg-surface-hover hover:bg-surface-active disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-content" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-6 gap-4 px-6 py-3 bg-surface-hover border-b border-border-subtle text-xs font-medium text-content-muted uppercase tracking-wider">
        <div className="col-span-2">Date Captured</div>
        <div className="text-right">Views</div>
        <div className="text-right">Likes</div>
        <div className="text-right">Comments</div>
        <div className="text-right">Engagement</div>
      </div>

      {/* Snapshots List - Scrollable */}
      <div className="divide-y divide-border-subtle max-h-[400px] overflow-y-auto">
        {paginatedSnapshots.map((snapshot) => (
          <div 
            key={snapshot.capturedAt instanceof Date ? snapshot.capturedAt.toISOString() : String(snapshot.capturedAt)}
            className="grid grid-cols-6 gap-4 px-6 py-4 hover:bg-surface-hover transition-colors items-center"
          >
            {/* Date */}
            <div className="col-span-2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center border border-border">
                <Bookmark className="w-4 h-4 text-content-muted" />
              </div>
              <div>
                <div className="text-sm font-medium text-content">
                  {new Date(snapshot.capturedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
                <div className="text-xs text-content-muted">
                  {new Date(snapshot.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="text-right text-sm text-content-secondary font-medium">
              {formatNumber(snapshot.views)}
            </div>
            <div className="text-right text-sm text-content-secondary">
              {formatNumber(snapshot.likes)}
            </div>
            <div className="text-right text-sm text-content-secondary">
              {formatNumber(snapshot.comments)}
            </div>

            {/* Engagement */}
            <div className="text-right">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                snapshot.trend === 'up' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : snapshot.trend === 'down'
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-surface-hover text-content-muted border-border-subtle'
              }`}>
                {snapshot.trend === 'up' && <TrendingUp className="w-3 h-3" />}
                {snapshot.trend === 'down' && <TrendingDown className="w-3 h-3" />}
                {snapshot.trend === 'neutral' && <Minus className="w-3 h-3" />}
                {snapshot.engagement.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

