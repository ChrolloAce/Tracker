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

/** Build a 14-day posting heatmap (array of post counts) */
export function buildPostActivityBars(videos: VideoDoc[]): number[] {
  const days = 14;
  const counts = Array(days).fill(0);
  const now = new Date();

  for (const v of videos) {
    const d = v.uploadDate?.toDate ? v.uploadDate.toDate() : new Date(v.uploadDate as any);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < days) {
      counts[days - 1 - diffDays]++;
    }
  }
  return counts;
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
              const bars = buildPostActivityBars(row.allVideos);
              const maxBar = Math.max(...bars, 1);

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
                    <div className="flex items-end space-x-[2px] h-6">
                      {bars.map((count, i) => (
                        <div
                          key={i}
                          className="w-[6px] rounded-sm transition-all"
                          style={{
                            height: `${count > 0 ? Math.max(20, (count / maxBar) * 100) : 8}%`,
                            backgroundColor: count > 0
                              ? `rgba(168, 85, 247, ${0.4 + (count / maxBar) * 0.6})`
                              : 'rgba(255,255,255,0.08)'
                          }}
                          title={`${count} post${count !== 1 ? 's' : ''}`}
                        />
                      ))}
                    </div>
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
