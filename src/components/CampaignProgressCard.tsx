import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Target, 
  Trophy, 
  Clock, 
  TrendingUp, 
  ChevronRight,
  Users,
  Video
} from 'lucide-react';
import { Campaign } from '../types/campaigns';
import { OrgMember } from '../types/firestore';
import { useAuth } from '../contexts/AuthContext';
import OrganizationService from '../services/OrganizationService';
import { ProxiedImage } from './ProxiedImage';

interface CampaignProgressCardProps {
  campaign: Campaign;
  showLeaderboard?: boolean;
  showActions?: boolean;
  className?: string;
  onClick?: () => void;
}

/**
 * CampaignProgressCard - Shows campaign progress with animated bar and top performers
 */
const CampaignProgressCard: React.FC<CampaignProgressCardProps> = ({
  campaign,
  showLeaderboard = true,
  showActions = true,
  className = '',
  onClick
}) => {
  const { user, currentOrgId } = useAuth();
  const navigate = useNavigate();
  const [memberMap, setMemberMap] = useState<Map<string, OrgMember>>(new Map());
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    // Animate progress bar on mount
    const timer = setTimeout(() => {
      setAnimatedProgress(Math.min(campaign.progressPercent, 100));
    }, 100);
    return () => clearTimeout(timer);
  }, [campaign.progressPercent]);

  useEffect(() => {
    loadMemberData();
  }, [currentOrgId]);

  const loadMemberData = async () => {
    if (!currentOrgId) return;
    try {
      const members = await OrganizationService.getOrgMembers(currentOrgId);
      setMemberMap(new Map(members.map(m => [m.userId, m])));
    } catch (error) {
      console.error('Failed to load member data:', error);
    }
  };

  const getDaysRemaining = () => {
    if (campaign.isIndefinite || !campaign.endDate) return null;
    
    const endDate = campaign.endDate instanceof Date 
      ? campaign.endDate 
      : campaign.endDate.toDate();
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return 'Ended';
    if (days === 0) return 'Ends today';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getGoalLabel = (goalType: string) => {
    switch(goalType) {
      case 'total_views': return 'Views';
      case 'total_engagement': return 'Engagement';
      case 'avg_engagement_rate': return 'Avg ER';
      case 'total_likes': return 'Likes';
      case 'total_comments': return 'Comments';
      case 'video_count': return 'Videos';
      default: return goalType;
    }
  };

  const topPerformers = campaign.leaderboard?.slice(0, 3) || [];
  const myParticipant = campaign.participants.find(p => p.creatorId === user?.uid);
  const isActive = campaign.status === 'active';
  const daysRemaining = getDaysRemaining();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/campaigns/${campaign.id}`);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`relative overflow-hidden bg-zinc-900/60 backdrop-blur rounded-2xl border transition-all duration-300 cursor-pointer group ${
        isActive 
          ? 'border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10' 
          : 'border-white/10 hover:border-white/20'
      } ${className}`}
    >
      {/* Gradient Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${
        isActive 
          ? 'from-emerald-500/10 via-transparent to-transparent' 
          : 'from-white/5 via-transparent to-transparent'
      }`} />

      {/* Content */}
      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isActive ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Active
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-white/10 text-gray-400 text-xs font-semibold rounded-full border border-white/10">
                  {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                </span>
              )}
              {daysRemaining && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {daysRemaining}
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
              {campaign.name}
            </h3>
            <p className="text-sm text-gray-400 line-clamp-1 mt-0.5">{campaign.description}</p>
          </div>

          {showActions && (
            <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress Section */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Target className="w-4 h-4" />
              {getGoalLabel(campaign.goalType)} Goal
            </span>
            <span className="text-white font-semibold">
              {formatNumber(campaign.currentProgress)} / {formatNumber(campaign.goalAmount)}
            </span>
          </div>
          
          {/* Animated Progress Bar */}
          <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={{ width: `${animatedProgress}%` }}
            >
              {/* Shimmer Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-emerald-400 font-medium">
              {campaign.progressPercent.toFixed(1)}% complete
            </span>
            {campaign.totalVideos > 0 && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Video className="w-3 h-3" />
                {campaign.totalVideos} videos
              </span>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1">
              <Users className="w-3 h-3" />
              Creators
            </div>
            <div className="text-white font-bold">{campaign.participantIds.length}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Views
            </div>
            <div className="text-white font-bold">{formatNumber(campaign.totalViews)}</div>
          </div>
          <div className="bg-emerald-500/10 rounded-lg p-3 text-center border border-emerald-500/20">
            <div className="text-xs text-emerald-400/70 mb-1">Paid Out</div>
            <div className="text-emerald-400 font-bold">${campaign.totalEarnings.toFixed(0)}</div>
          </div>
        </div>

        {/* Top Performers Preview */}
        {showLeaderboard && topPerformers.length > 0 && (
          <div className="pt-4 border-t border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                Top Performers
              </span>
            </div>
            <div className="flex items-center gap-2">
              {topPerformers.map((entry, index) => {
                const member = memberMap.get(entry.creatorId);
                const participant = campaign.participants.find(p => p.creatorId === entry.creatorId);
                const isMe = entry.creatorId === user?.uid;
                
                return (
                  <div 
                    key={entry.creatorId}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg flex-1 ${
                      isMe 
                        ? 'bg-emerald-500/10 border border-emerald-500/30' 
                        : 'bg-white/5'
                    }`}
                  >
                    <div className="relative">
                      {member?.photoURL ? (
                        <ProxiedImage
                          src={member.photoURL}
                          alt={member.displayName || 'Creator'}
                          className="w-8 h-8 rounded-full object-cover"
                          fallback={
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                              {(member?.displayName || participant?.creatorName || '?').charAt(0).toUpperCase()}
                            </div>
                          }
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                          {(participant?.creatorName || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      {/* Rank Badge */}
                      <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        index === 0 ? 'bg-yellow-400 text-black' :
                        index === 1 ? 'bg-gray-300 text-black' :
                        'bg-amber-600 text-white'
                      }`}>
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {isMe ? 'You' : (member?.displayName || participant?.creatorName || 'Creator')}
                      </p>
                      <p className="text-[10px] text-gray-400">{formatNumber(entry.score)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* My Performance (if participating) */}
        {myParticipant && !topPerformers.find(p => p.creatorId === user?.uid) && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Your Rank</p>
                  <p className="text-lg font-bold text-white">#{myParticipant.currentRank}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Earnings</p>
                <p className="text-lg font-bold text-emerald-400">${myParticipant.totalEarnings.toFixed(0)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Shimmer animation styles */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default CampaignProgressCard;

