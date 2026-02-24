import { useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { VideoDoc } from '../types/firestore';
import { ProxiedImage } from './ProxiedImage';
import {
  Info,
  Settings2,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Percent
} from 'lucide-react';

// ─── Shared Types ───────────────────────────────────────────

export interface CreatorRow {
  creatorId: string;
  displayName: string;
  photoURL?: string;
  email?: string;
  accountCount: number;
  videos: VideoDoc[];       // videos in the current period
  allVideos: VideoDoc[];    // all-time videos
}

export type SortField =
  | 'creator'
  | 'posted'
  | 'views'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'saves'
  | 'engagement'
  | 'cpm';

// ─── Shared Helpers ─────────────────────────────────────────

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function getEngagementRate(videos: VideoDoc[]): number {
  const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);
  if (totalViews === 0) return 0;
  const totalEngagement = videos.reduce(
    (s, v) => s + (v.likes || 0) + (v.comments || 0) + (v.shares || 0),
    0
  );
  return (totalEngagement / totalViews) * 100;
}

/** Day cell data for the heatmap squares */
export interface DayCellData {
  date: Date;
  count: number;
  videos: VideoDoc[];
}

/** Build a 14-day posting heatmap with date+video details */
export function buildPostActivitySquares(videos: VideoDoc[]): DayCellData[] {
  const days = 14;
  const now = new Date();
  const cells: DayCellData[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    cells.push({ date, count: 0, videos: [] });
  }

  for (const v of videos) {
    const d = v.uploadDate?.toDate ? v.uploadDate.toDate() : new Date(v.uploadDate as any);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < days) {
      const idx = days - 1 - diffDays;
      cells[idx].count++;
      cells[idx].videos.push(v);
    }
  }
  return cells;
}

// Legacy compat
export function buildPostActivityBars(videos: VideoDoc[]): number[] {
  return buildPostActivitySquares(videos).map(c => c.count);
}

// ─── Creator Cell (shared between both tables) ─────────────

function CreatorCell({ row }: { row: CreatorRow }) {
  return (
    <div className="flex items-center space-x-3">
      {row.photoURL ? (
        <ProxiedImage
          src={row.photoURL}
          alt={row.displayName}
          className="w-9 h-9 rounded-full object-cover"
          fallback={
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
              {row.displayName.charAt(0).toUpperCase()}
            </div>
          }
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
          {row.displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-white">{row.displayName}</p>
        <p className="text-xs text-white/40">
          {row.accountCount} account{row.accountCount !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

// ─── Engagement Badge ───────────────────────────────────────

function EngagementBadge({ rate }: { rate: number }) {
  let color = 'text-white/50 bg-white/5';
  if (rate >= 8) color = 'text-green-400 bg-green-500/10';
  else if (rate >= 5) color = 'text-emerald-400 bg-emerald-500/10';
  else if (rate >= 2) color = 'text-yellow-400 bg-yellow-500/10';
  else if (rate > 0) color = 'text-orange-400 bg-orange-500/10';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {rate.toFixed(1)}%
    </span>
  );
}

// ─── Activity Table ─────────────────────────────────────────

/** Hoverable square tooltip for the heatmap */
function HeatmapSquareTooltip({ cell, position }: { cell: DayCellData; position: { x: number; y: number } }) {
  return createPortal(
    <div
      className="bg-[#1a1a1a] text-white rounded-lg shadow-2xl border border-white/10 px-3 py-2 pointer-events-none"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%) translateY(-8px)',
        zIndex: 999999,
        minWidth: 140,
      }}
    >
      <p className="text-[11px] text-white/50 font-medium">{format(cell.date, 'EEE, MMM d')}</p>
      <p className="text-sm font-bold text-white mt-0.5">
        {cell.count} post{cell.count !== 1 ? 's' : ''}
      </p>
      {cell.videos.length > 0 && (
        <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
          {cell.videos.slice(0, 4).map((v, i) => (
            <p key={i} className="text-[10px] text-white/40 truncate max-w-[200px]">
              {(v as any).title || (v as any).description || (v as any).videoTitle || 'Untitled'} — {formatNumber(v.views || 0)} views
            </p>
          ))}
          {cell.videos.length > 4 && (
            <p className="text-[10px] text-white/30">+{cell.videos.length - 4} more</p>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}

/** Inline 14-day heatmap squares with hover tooltip */
function PostActivityHeatmapInline({ videos }: { videos: VideoDoc[] }) {
  const [hoveredCell, setHoveredCell] = useState<DayCellData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const cells = buildPostActivitySquares(videos);
  const maxCount = Math.max(...cells.map(c => c.count), 1);

  const getSquareColor = (count: number) => {
    if (count === 0) return 'bg-white/[0.04]';
    const intensity = count / maxCount;
    if (intensity >= 0.8) return 'bg-emerald-500/80';
    if (intensity >= 0.5) return 'bg-emerald-500/50';
    if (intensity >= 0.25) return 'bg-emerald-500/30';
    return 'bg-emerald-500/20';
  };

  return (
    <div className="flex items-center gap-[3px]">
      {cells.map((cell, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-[3px] transition-all cursor-pointer ${getSquareColor(cell.count)} ${
            cell.count > 0 ? 'hover:ring-1 hover:ring-emerald-400 hover:ring-offset-1 hover:ring-offset-zinc-900' : ''
          }`}
          onMouseEnter={(e) => {
            setHoveredCell(cell);
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
          }}
          onMouseLeave={() => setHoveredCell(null)}
        />
      ))}
      {hoveredCell && <HeatmapSquareTooltip cell={hoveredCell} position={tooltipPos} />}
    </div>
  );
}

export function ActivityTable({
  rows,
  toggleSort,
  SortIcon
}: {
  rows: CreatorRow[];
  toggleSort: (f: SortField) => void;
  SortIcon: React.FC<{ field: SortField }>;
}) {
  return (
    <div className="bg-zinc-900/60 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-white">Creator Activity</h2>
          <button className="text-white/30 hover:text-white/60 transition-colors" title="Shows posting activity per creator in the selected period">
            <Info className="w-4 h-4" />
          </button>
        </div>
        <Settings2 className="w-4 h-4 text-white/30" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-white/50 uppercase tracking-wider border-b border-white/5">
              <th className="px-6 py-3 cursor-pointer hover:text-white/80" onClick={() => toggleSort('creator')}>
                Creator <SortIcon field="creator" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-white/80" onClick={() => toggleSort('posted')}>
                Posted <SortIcon field="posted" />
              </th>
              <th className="px-4 py-3">Eligible</th>
              <th className="px-4 py-3 cursor-pointer hover:text-white/80" onClick={() => toggleSort('views')}>
                Total Views <SortIcon field="views" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-white/80" onClick={() => toggleSort('engagement')}>
                Eng. Rate <SortIcon field="engagement" />
              </th>
              <th className="px-4 py-3">Post Activity (14d)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map(row => {
              const totalViews = row.videos.reduce((s, v) => s + (v.views || 0), 0);
              const engagement = getEngagementRate(row.videos);

              return (
                <tr key={row.creatorId} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4"><CreatorCell row={row} /></td>
                  <td className="px-4 py-4"><span className="text-sm text-white font-medium">{row.videos.length}</span></td>
                  <td className="px-4 py-4"><span className="text-sm text-white/60">{row.allVideos.length}</span></td>
                  <td className="px-4 py-4"><span className="text-sm text-white font-medium">{formatNumber(totalViews)}</span></td>
                  <td className="px-4 py-4">
                    <span className={`text-sm font-medium ${engagement >= 5 ? 'text-green-400' : engagement >= 2 ? 'text-yellow-400' : 'text-white/60'}`}>
                      {engagement.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <PostActivityHeatmapInline videos={row.allVideos} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Performance Table ──────────────────────────────────────

export function PerformanceTable({
  rows,
  toggleSort,
  SortIcon
}: {
  rows: CreatorRow[];
  toggleSort: (f: SortField) => void;
  SortIcon: React.FC<{ field: SortField }>;
}) {
  return (
    <div className="bg-zinc-900/60 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-white">Creator Performance</h2>
          <button className="text-white/30 hover:text-white/60 transition-colors" title="Detailed performance metrics per creator">
            <Info className="w-4 h-4" />
          </button>
        </div>
        <Settings2 className="w-4 h-4 text-white/30" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-white/50 uppercase tracking-wider border-b border-white/5">
              <th className="px-6 py-3 cursor-pointer hover:text-white/80" onClick={() => toggleSort('creator')}>
                Creator <SortIcon field="creator" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-white/80" onClick={() => toggleSort('posted')}>
                <span className="inline-flex items-center"><span className="mr-1">📹</span> Videos</span>
                <SortIcon field="posted" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-white/80" onClick={() => toggleSort('views')}>
                <span className="inline-flex items-center"><Eye className="w-3.5 h-3.5 mr-1" /> Views</span>
                <SortIcon field="views" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-white/80" onClick={() => toggleSort('likes')}>
                <span className="inline-flex items-center"><Heart className="w-3.5 h-3.5 mr-1" /> Likes</span>
                <SortIcon field="likes" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-white/80" onClick={() => toggleSort('comments')}>
                <span className="inline-flex items-center"><MessageCircle className="w-3.5 h-3.5 mr-1" /> Comments</span>
                <SortIcon field="comments" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-white/80" onClick={() => toggleSort('shares')}>
                <span className="inline-flex items-center"><Share2 className="w-3.5 h-3.5 mr-1" /> Shares</span>
                <SortIcon field="shares" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-white/80" onClick={() => toggleSort('saves')}>
                <span className="inline-flex items-center"><Bookmark className="w-3.5 h-3.5 mr-1" /> Saves</span>
                <SortIcon field="saves" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-white/80" onClick={() => toggleSort('engagement')}>
                <span className="inline-flex items-center"><Percent className="w-3.5 h-3.5 mr-1" /> Eng.</span>
                <SortIcon field="engagement" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map(row => {
              const totalViews = row.videos.reduce((s, v) => s + (v.views || 0), 0);
              const totalLikes = row.videos.reduce((s, v) => s + (v.likes || 0), 0);
              const totalComments = row.videos.reduce((s, v) => s + (v.comments || 0), 0);
              const totalShares = row.videos.reduce((s, v) => s + (v.shares || 0), 0);
              const totalSaves = row.videos.reduce((s, v) => s + (v.saves || 0), 0);
              const engagement = getEngagementRate(row.videos);

              return (
                <tr key={row.creatorId} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4"><CreatorCell row={row} /></td>
                  <td className="px-4 py-4"><span className="text-sm text-white font-medium">{row.videos.length}</span></td>
                  <td className="px-4 py-4"><span className="text-sm text-white font-medium">{formatNumber(totalViews)}</span></td>
                  <td className="px-4 py-4"><span className="text-sm text-white/80">{formatNumber(totalLikes)}</span></td>
                  <td className="px-4 py-4"><span className="text-sm text-white/80">{formatNumber(totalComments)}</span></td>
                  <td className="px-4 py-4"><span className="text-sm text-white/80">{formatNumber(totalShares)}</span></td>
                  <td className="px-4 py-4"><span className="text-sm text-white/80">{formatNumber(totalSaves)}</span></td>
                  <td className="px-4 py-4"><EngagementBadge rate={engagement} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
