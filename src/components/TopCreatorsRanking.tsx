import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  Info,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
} from 'lucide-react';
import { VideoSubmission } from '../types';

/**
 * Minimal creator shape — matches the public-share API payload.
 * Keeping a component-local interface (instead of importing the Firestore type)
 * because this component is fed by the API, not Firestore.
 */
export interface RankingCreator {
  id: string;
  displayName: string;
  photoURL?: string;
}

export interface RankingCreatorLink {
  creatorId: string;
  accountId: string;
}

export interface RankingAccount {
  id: string;
  username: string;
  platform: string;
}

interface TopCreatorsRankingProps {
  videos: VideoSubmission[];
  accounts: RankingAccount[];
  creators: RankingCreator[];
  creatorLinks: RankingCreatorLink[];
}

interface CreatorStats {
  creator: RankingCreator;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  videoCount: number;
}

// Format numbers consistently with TopPlatformsRaceChart
function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

/**
 * Top Creators ranking — styled to match TopPlatformsRaceChart so it lives
 * comfortably next to it in the masonry grid on the share page.
 *
 * Differences from the platforms card:
 *   - Ranked by total views (no metric selector — the spec pins ranking to views
 *     and surfaces the other 4 stats inline on each row).
 *   - Each row is taller to fit the creator name, the race bar, and the inline
 *     secondary-stats row underneath (likes / comments / shares / saves).
 *   - No hover tooltip because everything's already visible.
 */
const TopCreatorsRanking: React.FC<TopCreatorsRankingProps> = ({
  videos,
  accounts,
  creators,
  creatorLinks,
}) => {
  const [topCount, setTopCount] = useState(5);
  const [showInfo, setShowInfo] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Aggregate stats per creator
  const creatorStats = useMemo<CreatorStats[]>(() => {
    if (creators.length === 0 || accounts.length === 0) return [];

    // Deduplicate videos by id (defensive — matches the pattern used elsewhere)
    const uniqueVideos = new Map<string, VideoSubmission>();
    videos.forEach((v) => {
      const key =
        v.id ||
        v.url ||
        `${v.platform}_${v.uploaderHandle}_${v.dateSubmitted?.getTime?.() ?? 0}`;
      if (!uniqueVideos.has(key)) uniqueVideos.set(key, v);
    });

    // username+platform  →  accountId
    const usernameToAccountId = new Map<string, string>();
    accounts.forEach((a) => {
      usernameToAccountId.set(
        `${a.platform}_${(a.username || '').toLowerCase()}`,
        a.id
      );
    });

    // accountId  →  creatorId
    const accountToCreator = new Map<string, string>();
    creatorLinks.forEach((link) => {
      if (link.accountId && link.creatorId) {
        accountToCreator.set(link.accountId, link.creatorId);
      }
    });

    // Seed every creator so they're listed even with zero videos (we'll filter
    // those out at the end)
    const statsById = new Map<string, CreatorStats>();
    creators.forEach((c) => {
      statsById.set(c.id, {
        creator: c,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalSaves: 0,
        videoCount: 0,
      });
    });

    uniqueVideos.forEach((v) => {
      const handle = (v.uploaderHandle || '').toLowerCase();
      if (!handle) return;
      const accountId = usernameToAccountId.get(`${v.platform}_${handle}`);
      if (!accountId) return;
      const creatorId = accountToCreator.get(accountId);
      if (!creatorId) return;
      const s = statsById.get(creatorId);
      if (!s) return;
      s.totalViews += v.views || 0;
      s.totalLikes += v.likes || 0;
      s.totalComments += v.comments || 0;
      s.totalShares += v.shares || 0;
      s.totalSaves += v.saves || 0;
      s.videoCount += 1;
    });

    return Array.from(statsById.values()).filter((s) => s.videoCount > 0);
  }, [videos, accounts, creators, creatorLinks]);

  // Sort by views, take top N
  const topCreators = useMemo(() => {
    return [...creatorStats]
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, topCount);
  }, [creatorStats, topCount]);

  const maxViews = topCreators[0]?.totalViews ?? 0;

  // Shell matches TopPlatformsRaceChart exactly. In a uniform-grid layout the
  // parent cell has a fixed height (e.g. 480px via grid-auto-rows) and h-full
  // stretches the card to fill. In masonry mode the parent has no defined
  // height, h-full degrades to auto, and min-h-[400px] takes over.
  return (
    <div className="relative rounded-2xl bg-surface-secondary border border-border shadow-theme p-6 min-h-[400px] h-full flex flex-col">
      {/* Header — mirrors TopPlatformsRaceChart */}
      <div className="flex items-center justify-between mb-8 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-content">Top Creators</h2>
          <div className="relative">
            <button
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
              className="text-content-muted hover:text-content-secondary transition-colors"
            >
              <Info className="w-4 h-4" style={{ opacity: 0.5 }} />
            </button>

            {showInfo && (
              <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] p-3 rounded-lg bg-surface-tertiary border border-border shadow-xl z-50">
                <p className="text-xs text-content-secondary leading-relaxed">
                  Ranks every creator in this project by total views across all their tracked accounts, with likes, comments, shares and saves shown for context.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Count selector — same styling as TopPlatformsRaceChart */}
          <div className="relative">
            <select
              value={topCount}
              onChange={(e) => setTopCount(Number(e.target.value))}
              className="appearance-none bg-surface-hover text-content rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-border-subtle hover:bg-surface-tertiary focus:outline-none focus:ring-1 focus:ring-border transition-all cursor-pointer"
            >
              <option value={3} className="bg-surface-secondary">3</option>
              <option value={5} className="bg-surface-secondary">5</option>
              <option value={10} className="bg-surface-secondary">10</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Body */}
      {topCreators.length === 0 ? (
        <div className="text-center py-16 text-content-muted flex-1 flex flex-col items-center justify-center">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No creator data available</p>
          <p className="text-xs mt-1">Link creators to tracked accounts to see rankings here</p>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto -mr-2 pr-2">
          {topCreators.map((stats, index) => {
            const percentage = maxViews > 0 ? (stats.totalViews / maxViews) * 100 : 0;
            const name = stats.creator.displayName || 'Creator';
            const initial = name.charAt(0).toUpperCase();
            const hasPhoto =
              !!stats.creator.photoURL && !imageErrors.has(stats.creator.id);

            return (
              <div
                key={stats.creator.id}
                className={`group relative py-2 ${index > 0 ? 'border-t border-border-subtle' : ''}`}
                style={{
                  animation: `raceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.12}s both`,
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar (same 40x40 spearhead as TopPlatformsRaceChart) */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border border-border-subtle bg-surface-tertiary flex items-center justify-center mt-0.5">
                    {hasPhoto ? (
                      <img
                        src={stats.creator.photoURL}
                        alt={name}
                        className="w-full h-full object-cover"
                        onError={() =>
                          setImageErrors((prev) => new Set(prev).add(stats.creator.id))
                        }
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-content-inverse font-bold text-sm">
                        {initial}
                      </div>
                    )}
                  </div>

                  {/* Creator name + race bar + secondary stats */}
                  <div className="flex-1 min-w-0">
                    {/* Name + total views (top line) */}
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="text-sm font-medium text-content truncate">
                        {name}
                      </span>
                      <span
                        className="text-lg font-semibold text-content tabular-nums tracking-tight flex-shrink-0"
                        style={{
                          fontFamily: 'Inter, SF Pro Display, system-ui, sans-serif',
                        }}
                      >
                        {formatNumber(stats.totalViews)}
                      </span>
                    </div>

                    {/* Orange race bar — same gradient/styling as TopPlatforms */}
                    <div className="h-6 rounded-lg overflow-hidden bg-surface-tertiary">
                      <div
                        className="race-bar h-full rounded-lg transition-all duration-300 ease-out"
                        style={{
                          width: `${percentage}%`,
                          minWidth: '8%',
                          background: 'linear-gradient(to right, #f97316, #ea580c)',
                        }}
                      />
                    </div>

                    {/* Secondary stats row (likes / comments / shares / saves) */}
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-content-muted tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {formatNumber(stats.totalViews)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5" />
                        {formatNumber(stats.totalLikes)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" />
                        {formatNumber(stats.totalComments)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Share2 className="w-3.5 h-3.5" />
                        {formatNumber(stats.totalShares)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Bookmark className="w-3.5 h-3.5" />
                        {formatNumber(stats.totalSaves)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes raceSlideIn {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default TopCreatorsRanking;
