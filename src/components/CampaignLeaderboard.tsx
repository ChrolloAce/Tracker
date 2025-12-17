import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Eye, Video, DollarSign, Medal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Campaign } from '../types/campaigns';
import { OrgMember } from '../types/firestore';
import OrganizationService from '../services/OrganizationService';
import { ProxiedImage } from './ProxiedImage';

interface LeaderboardEntry {
  rank: number;
  previousRank?: number;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  photoURL?: string;
  score: number;
  views: number;
  videoCount: number;
  earnings: number;
  contributionPercent: number;
  isCurrentUser: boolean;
}

interface CampaignLeaderboardProps {
  campaign: Campaign;
  maxEntries?: number;
  showFullStats?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * CampaignLeaderboard - Displays ranked creators with photos, names, and metrics
 */
const CampaignLeaderboard: React.FC<CampaignLeaderboardProps> = ({
  campaign,
  maxEntries = 10,
  showFullStats = true,
  compact = false,
  className = ''
}) => {
  const { user, currentOrgId } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setMemberMap] = useState<Map<string, OrgMember>>(new Map());

  useEffect(() => {
    loadLeaderboardData();
  }, [campaign, currentOrgId]);

  const loadLeaderboardData = async () => {
    if (!currentOrgId || !campaign.participants) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch all org members to get profile pictures and display names
      const members = await OrganizationService.getOrgMembers(currentOrgId);
      const membersById = new Map(members.map(m => [m.userId, m]));
      setMemberMap(membersById);

      // Build leaderboard entries from campaign participants
      const leaderboardData = campaign.leaderboard || [];
      const participantsMap = new Map(
        campaign.participants.map(p => [p.creatorId, p])
      );

      const sortedEntries: LeaderboardEntry[] = leaderboardData
        .slice(0, maxEntries)
        .map((entry) => {
          const participant = participantsMap.get(entry.creatorId);
          const member = membersById.get(entry.creatorId);

          return {
            rank: entry.rank,
            previousRank: entry.delta !== 0 ? entry.rank + entry.delta : undefined,
            creatorId: entry.creatorId,
            creatorName: member?.displayName || participant?.creatorName || 'Unknown Creator',
            creatorEmail: member?.email || participant?.creatorEmail || '',
            photoURL: member?.photoURL,
            score: entry.score,
            views: participant?.totalViews || 0,
            videoCount: participant?.videoCount || 0,
            earnings: participant?.totalEarnings || 0,
            contributionPercent: participant?.contributionPercent || 0,
            isCurrentUser: entry.creatorId === user?.uid
          };
        });

      setEntries(sortedEntries);
    } catch (error) {
      console.error('Failed to load leaderboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankChange = (entry: LeaderboardEntry) => {
    if (!entry.previousRank || entry.previousRank === entry.rank) {
      return { icon: Minus, color: 'text-gray-500', text: '—' };
    }
    if (entry.previousRank > entry.rank) {
      // Moved up (lower rank number is better)
      const change = entry.previousRank - entry.rank;
      return { icon: TrendingUp, color: 'text-emerald-400', text: `+${change}` };
    }
    // Moved down
    const change = entry.rank - entry.previousRank;
    return { icon: TrendingDown, color: 'text-red-400', text: `-${change}` };
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-yellow-500/30">
          <Trophy className="w-5 h-5 text-white" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center shadow-lg shadow-gray-400/30">
          <Medal className="w-5 h-5 text-white" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-600/30">
          <Medal className="w-5 h-5 text-white" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
        <span className="text-white font-bold text-sm">{rank}</span>
      </div>
    );
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  if (loading) {
    return (
      <div className={`bg-zinc-900/40 rounded-xl border border-white/10 p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <h2 className="text-xl font-bold text-white">Leaderboard</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-white/5 rounded-lg">
              <div className="w-10 h-10 bg-white/10 rounded-full" />
              <div className="w-10 h-10 bg-white/10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/10 rounded w-1/3" />
                <div className="h-3 bg-white/10 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={`bg-zinc-900/40 rounded-xl border border-white/10 p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <h2 className="text-xl font-bold text-white">Leaderboard</h2>
        </div>
        <div className="text-center py-8">
          <Trophy className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/60">No rankings yet</p>
          <p className="text-sm text-white/40 mt-1">Submit videos to compete!</p>
        </div>
      </div>
    );
  }

  // Compact version for sidebars
  if (compact) {
    return (
      <div className={`bg-zinc-900/40 rounded-xl border border-white/10 p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-bold text-white">Top Performers</h3>
        </div>
        <div className="space-y-2">
          {entries.slice(0, 5).map((entry) => (
            <div
              key={entry.creatorId}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                entry.isCurrentUser ? 'bg-emerald-500/10 border border-emerald-500/30' : 'hover:bg-white/5'
              }`}
            >
              <span className={`w-6 text-center font-bold text-sm ${
                entry.rank === 1 ? 'text-yellow-400' :
                entry.rank === 2 ? 'text-gray-300' :
                entry.rank === 3 ? 'text-amber-600' : 'text-white/60'
              }`}>
                #{entry.rank}
              </span>
              {entry.photoURL ? (
                <ProxiedImage
                  src={entry.photoURL}
                  alt={entry.creatorName}
                  className="w-8 h-8 rounded-full object-cover"
                  fallback={
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                      {entry.creatorName.charAt(0).toUpperCase()}
                    </div>
                  }
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                  {entry.creatorName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{entry.creatorName}</p>
              </div>
              <span className="text-sm font-semibold text-white/80">{formatNumber(entry.score)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Full leaderboard view
  return (
    <div className={`bg-zinc-900/40 rounded-xl border border-white/10 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-yellow-500/10 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-bold text-white">Leaderboard</h2>
          </div>
          <span className="text-sm text-white/60">{entries.length} participants</span>
        </div>
      </div>

      {/* Leaderboard Entries */}
      <div className="divide-y divide-white/5">
        {entries.map((entry, index) => {
          const rankChange = getRankChange(entry);
          const RankIcon = rankChange.icon;

          return (
            <div
              key={entry.creatorId}
              className={`flex items-center gap-4 p-4 transition-all hover:bg-white/5 ${
                entry.isCurrentUser ? 'bg-emerald-500/10 border-l-4 border-emerald-500' : ''
              } ${index < 3 ? 'bg-gradient-to-r from-white/5 to-transparent' : ''}`}
            >
              {/* Rank Badge */}
              {getRankBadge(entry.rank)}

              {/* Profile Picture */}
              {entry.photoURL ? (
                <ProxiedImage
                  src={entry.photoURL}
                  alt={entry.creatorName}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10"
                  fallback={
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center ring-2 ring-white/10 text-white font-bold">
                      {entry.creatorName.charAt(0).toUpperCase()}
                    </div>
                  }
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center ring-2 ring-white/10 text-white font-bold">
                  {entry.creatorName.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Creator Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white truncate">{entry.creatorName}</h3>
                  {entry.isCurrentUser && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                      You
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/50 truncate">{entry.creatorEmail}</p>
              </div>

              {/* Rank Change Indicator */}
              <div className={`flex items-center gap-1 ${rankChange.color}`}>
                <RankIcon className="w-4 h-4" />
                <span className="text-sm font-medium">{rankChange.text}</span>
              </div>

              {/* Stats */}
              {showFullStats && (
                <div className="hidden sm:flex items-center gap-6">
                  {/* Score/Main Metric */}
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">{formatNumber(entry.score)}</div>
                    <div className="text-xs text-white/40">Score</div>
                  </div>

                  {/* Views */}
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-white/80">
                      <Eye className="w-3.5 h-3.5" />
                      <span className="font-semibold">{formatNumber(entry.views)}</span>
                    </div>
                    <div className="text-xs text-white/40">Views</div>
                  </div>

                  {/* Videos */}
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-white/80">
                      <Video className="w-3.5 h-3.5" />
                      <span className="font-semibold">{entry.videoCount}</span>
                    </div>
                    <div className="text-xs text-white/40">Videos</div>
                  </div>

                  {/* Earnings */}
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-emerald-400">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="font-semibold">{entry.earnings.toFixed(0)}</span>
                    </div>
                    <div className="text-xs text-white/40">Earned</div>
                  </div>
                </div>
              )}

              {/* Contribution Bar (mobile) */}
              {showFullStats && (
                <div className="sm:hidden">
                  <div className="text-right mb-1">
                    <span className="text-sm font-semibold text-white">{entry.contributionPercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                      style={{ width: `${Math.min(entry.contributionPercent, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current User Position (if not in top entries) */}
      {user && !entries.find(e => e.isCurrentUser) && campaign.participants.find(p => p.creatorId === user.uid) && (
        <div className="px-4 py-3 bg-white/5 border-t border-white/10">
          <p className="text-sm text-white/60 text-center">
            Your current rank: <span className="font-semibold text-white">
              #{campaign.participants.find(p => p.creatorId === user.uid)?.currentRank || '—'}
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

export default CampaignLeaderboard;

