import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TrackedAccount, VideoDoc } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import CampaignService from '../services/CampaignService';
import { Video, Users as UsersIcon, Trophy, Target, Award, Plus, Link as LinkIcon, Eye, DollarSign, TrendingUp, ChevronRight } from 'lucide-react';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import { VideoSubmissionsTable } from './VideoSubmissionsTable';
import { VideoSubmission } from '../types';
import { Campaign } from '../types/campaigns';
import CreatorVideoSubmissionModal from './CreatorVideoSubmissionModal';
import CreatorAccountLinkingModal from './CreatorAccountLinkingModal';

interface CreatorStats {
  totalAccounts: number;
  totalVideos: number;
  totalViews: number;
}

/**
 * CreatorPortalPage - PROJECT SCOPED
 * Creator's view of their project data: Dashboard and Campaigns
 */
const CreatorPortalPage: React.FC = () => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [view, setView] = useState<'dashboard' | 'campaigns'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CreatorStats>({
    totalAccounts: 0,
    totalVideos: 0,
    totalViews: 0,
  });
  const [linkedAccounts, setLinkedAccounts] = useState<TrackedAccount[]>([]);
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showVideoSubmissionModal, setShowVideoSubmissionModal] = useState(false);
  const [showAccountLinkingModal, setShowAccountLinkingModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentOrgId, currentProjectId, user]);

  const loadData = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;

    setLoading(true);
    try {
      // Load linked accounts for this project
      const links = await CreatorLinksService.getCreatorLinkedAccounts(
        currentOrgId,
        currentProjectId,
        user.uid
      );

      // Load all accounts and filter to linked ones
      const allAccounts = await FirestoreDataService.getTrackedAccounts(
        currentOrgId,
        currentProjectId
      );

      const linkedAccountIds = links.map(link => link.accountId);
      const accounts = allAccounts.filter(acc => linkedAccountIds.includes(acc.id));

      setLinkedAccounts(accounts);

      // Load videos from linked accounts
      const allVideos = await FirestoreDataService.getVideos(
        currentOrgId,
        currentProjectId,
        { limitCount: 1000 }
      );

      // Filter videos to only those from linked accounts
      const filteredVideos = allVideos.filter((video) =>
        video.trackedAccountId && linkedAccountIds.includes(video.trackedAccountId)
      );

      setVideos(filteredVideos);

      // Load campaigns for this creator
      const creatorCampaigns = await CampaignService.getCreatorCampaigns(
        currentOrgId,
        currentProjectId,
        user.uid
      );

      setCampaigns(creatorCampaigns);

      // Calculate stats
      const totalViews = filteredVideos.reduce((sum, v) => sum + (v.views || 0), 0);

      setStats({
        totalAccounts: links.length,
        totalVideos: filteredVideos.length,
        totalViews,
      });
    } catch (error) {
      console.error('Failed to load creator data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Convert VideoDoc[] to VideoSubmission[] for the VideoSubmissionsTable
  const videoSubmissions: VideoSubmission[] = useMemo(() => {
    const accountsMap = new Map(linkedAccounts.map(acc => [acc.id, acc]));
    
    return videos.map(video => {
      const account = video.trackedAccountId ? accountsMap.get(video.trackedAccountId) : null;
      
      return {
        id: video.id,
        url: video.url || '',
        platform: video.platform as 'instagram' | 'tiktok' | 'youtube',
        thumbnail: video.thumbnail || '',
        title: video.title || '',
        caption: video.description || '',
        uploader: account?.displayName || account?.username || '',
        uploaderHandle: account?.username || '',
        uploaderProfilePicture: account?.profilePicture,
        followerCount: account?.followerCount,
        status: video.status === 'archived' ? 'rejected' : 'approved',
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0,
        shares: video.shares || 0,
        duration: video.duration || 0,
        dateSubmitted: video.dateAdded.toDate(),
        uploadDate: video.uploadDate.toDate(),
        lastRefreshed: video.lastRefreshed?.toDate(),
        snapshots: []
      };
    });
  }, [videos, linkedAccounts]);

  if (loading) {
    return <PageLoadingSkeleton type="dashboard" />;
  }

  return (
    <div className="space-y-6 relative">
      {/* Header with Toggle and Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* View Toggle - Simple Tabs */}
        <div className="inline-flex items-center gap-1 bg-zinc-900/60 backdrop-blur border border-white/10 rounded-xl p-1">
          <button
            onClick={() => setView('dashboard')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              view === 'dashboard'
                ? 'bg-white/10 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setView('campaigns')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              view === 'campaigns'
                ? 'bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/20'
                : 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/5'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Campaigns
            {campaigns.filter(c => c.status === 'active').length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-emerald-500 text-white rounded-full">
                {campaigns.filter(c => c.status === 'active').length}
              </span>
            )}
          </button>
        </div>

        {/* Manage Accounts Button */}
        <button
          onClick={() => setShowAccountLinkingModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white/80 hover:text-white transition-all"
        >
          <LinkIcon className="w-4 h-4" />
          <span className="text-sm font-medium">Manage Accounts</span>
        </button>
      </div>

      {/* View Content */}
      {view === 'dashboard' && (
        <DashboardTab
          linkedAccounts={linkedAccounts}
          totalVideos={stats.totalVideos}
          totalViews={stats.totalViews}
          videoSubmissions={videoSubmissions}
          campaigns={campaigns}
        />
      )}

      {view === 'campaigns' && <CampaignsTab campaigns={campaigns} />}

      {/* Floating Action Button */}
      <button
        onClick={() => setShowVideoSubmissionModal(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-full shadow-2xl shadow-emerald-500/40 flex items-center justify-center transition-all duration-300 hover:scale-110 z-40 group"
        title="Submit Videos"
      >
        <Plus className="w-6 h-6 transition-transform group-hover:rotate-90" />
      </button>

      {/* Video Submission Modal */}
      <CreatorVideoSubmissionModal
        isOpen={showVideoSubmissionModal}
        onClose={() => setShowVideoSubmissionModal(false)}
        onSuccess={() => {
          loadData(); // Reload data after successful submission
        }}
      />

      {/* Account Linking Modal */}
      <CreatorAccountLinkingModal
        isOpen={showAccountLinkingModal}
        onClose={() => setShowAccountLinkingModal(false)}
        onSuccess={() => {
          loadData(); // Reload data after linking accounts
        }}
      />
    </div>
  );
};

// Dashboard Tab
const DashboardTab: React.FC<{
  linkedAccounts: TrackedAccount[];
  totalVideos: number;
  totalViews: number;
  videoSubmissions: VideoSubmission[];
  campaigns: Campaign[];
}> = ({ linkedAccounts, totalVideos, totalViews, videoSubmissions, campaigns }) => {
  const { user } = useAuth();
  
  // Calculate total earnings across all campaigns
  const totalEarnings = campaigns.reduce((sum, campaign) => {
    const myParticipant = campaign.participants.find(p => p.creatorId === user?.uid);
    return sum + (myParticipant?.totalEarnings || 0);
  }, 0);

  // Get active campaigns for the creator
  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Earnings */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-transparent rounded-xl border border-emerald-500/30 p-5 hover:border-emerald-500/50 transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-300" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-emerald-500/20 rounded-lg p-2.5">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">
              ${totalEarnings.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400">Total Earnings</div>
          </div>
        </div>

        {/* Total Views */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-500/20 via-blue-600/10 to-transparent rounded-xl border border-blue-500/30 p-5 hover:border-blue-500/50 transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-300" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-blue-500/20 rounded-lg p-2.5">
                <Eye className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">
              {formatNumber(totalViews)}
            </div>
            <div className="text-xs text-gray-400">Total Views</div>
          </div>
        </div>

        {/* Total Videos */}
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-500/20 via-purple-600/10 to-transparent rounded-xl border border-purple-500/30 p-5 hover:border-purple-500/50 transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all duration-300" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-purple-500/20 rounded-lg p-2.5">
                <Video className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">
              {totalVideos}
            </div>
            <div className="text-xs text-gray-400">Total Videos</div>
          </div>
        </div>

        {/* Linked Accounts */}
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-500/20 via-orange-600/10 to-transparent rounded-xl border border-orange-500/30 p-5 hover:border-orange-500/50 transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all duration-300" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-orange-500/20 rounded-lg p-2.5">
                <UsersIcon className="w-5 h-5 text-orange-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">
              {linkedAccounts.length}
            </div>
            <div className="text-xs text-gray-400">Linked Accounts</div>
          </div>
        </div>
      </div>

      {/* Active Campaigns Summary */}
      {activeCampaigns.length > 0 && (
        <div className="bg-zinc-900/60 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-emerald-400" />
              Active Campaigns
            </h3>
            <span className="text-sm text-gray-400">{activeCampaigns.length} active</span>
          </div>
          <div className="divide-y divide-white/5">
            {activeCampaigns.slice(0, 3).map(campaign => {
              const myParticipant = campaign.participants.find(p => p.creatorId === user?.uid);
              return (
                <div key={campaign.id} className="p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">{campaign.name}</h4>
                      <p className="text-xs text-gray-400">
                        {myParticipant ? `Rank #${myParticipant.currentRank}` : 'Participating'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {myParticipant && (
                        <span className="text-emerald-400 font-semibold">
                          ${myParticipant.totalEarnings.toFixed(0)}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                        style={{ width: `${Math.min(campaign.progressPercent, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-12 text-right">
                      {campaign.progressPercent.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Videos - Using Dashboard Table */}
      {videoSubmissions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            Recent Videos
          </h3>
          <VideoSubmissionsTable
            submissions={videoSubmissions}
          />
        </div>
      )}

      {videoSubmissions.length === 0 && activeCampaigns.length === 0 && (
        <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-12 text-center">
          <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No videos yet</h3>
          <p className="text-gray-400">
            Videos from your linked accounts will appear here.
          </p>
        </div>
      )}
    </div>
  );
};

// Campaigns Tab - Premium B2C Design
const CampaignsTab: React.FC<{ campaigns: Campaign[] }> = ({ campaigns }) => {
  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  const completedCampaigns = campaigns.filter(c => c.status === 'completed');
  
  if (campaigns.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 p-12 text-center" style={{ backgroundColor: '#121214' }}>
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-full border-2 border-emerald-500/20 mb-4">
          <Trophy className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Campaigns Yet</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          You haven't been added to any campaigns yet. Check back soon to compete for rewards!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Campaigns */}
      {activeCampaigns.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-400" />
            Active Campaigns
            <span className="text-sm font-normal text-gray-400">({activeCampaigns.length})</span>
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {activeCampaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </div>
      )}
      
      {/* Completed Campaigns */}
      {completedCampaigns.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Award className="w-6 h-6 text-gray-400" />
            Completed Campaigns
            <span className="text-sm font-normal text-gray-400">({completedCampaigns.length})</span>
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {completedCampaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Campaign Card - Animated & Premium
const CampaignCard: React.FC<{ campaign: Campaign }> = ({ campaign }) => {
  const { user } = useAuth();
  const myParticipant = campaign.participants.find(p => p.creatorId === user?.uid);
  const isActive = campaign.status === 'active';
  
  const formatDate = (date: any) => {
    const d = date.toDate ? date.toDate() : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  const getGoalLabel = (goalType: string) => {
    switch(goalType) {
      case 'total_views': return 'Total Views';
      case 'total_engagement': return 'Total Engagement';
      case 'avg_engagement_rate': return 'Avg Engagement Rate';
      case 'total_likes': return 'Total Likes';
      case 'video_count': return 'Video Count';
      default: return goalType;
    }
  };
  
  return (
    <div 
      className="group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
      style={{ 
        backgroundColor: '#121214',
        borderColor: isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)'
      }}
    >
      {/* Gradient Glow Effect */}
      <div 
        className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl transition-opacity duration-300 ${
          isActive ? 'opacity-20 group-hover:opacity-30' : 'opacity-0'
        }`}
        style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(5, 150, 105, 0.2))' }}
      />
      
      {/* Content */}
      <div className="relative p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">
              {campaign.name}
            </h3>
            <p className="text-sm text-gray-400 line-clamp-2">{campaign.description}</p>
          </div>
          
          {isActive && (
            <div className="flex-shrink-0 ml-4">
              <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  Active
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* Dates */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>{formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}</span>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{getGoalLabel(campaign.goalType)}</span>
            <span className="text-white font-semibold">
              {campaign.currentProgress.toLocaleString()} / {campaign.goalAmount.toLocaleString()}
            </span>
          </div>
          
          <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={{ width: `${Math.min(campaign.progressPercent, 100)}%` }}
            />
          </div>
          
          <span className="text-xs text-emerald-400 font-medium">
            {campaign.progressPercent.toFixed(1)}% Complete
          </span>
        </div>
        
        {/* My Performance */}
        {myParticipant && (
          <div className="pt-4 border-t border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">My Rank</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-emerald-400">#{myParticipant.currentRank}</span>
                <span className="text-xs text-gray-400">of {campaign.participants.length}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">My Views</div>
                <div className="text-lg font-bold text-white">{myParticipant.totalViews.toLocaleString()}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Earnings</div>
                <div className="text-lg font-bold text-emerald-400">${myParticipant.totalEarnings.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Rewards Preview */}
        {campaign.rewards.length > 0 && (
          <div className="pt-4 border-t border-white/5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Rewards</div>
            <div className="flex items-center gap-2">
              {campaign.rewards.slice(0, 3).map((reward) => (
                <div key={reward.position} className="flex items-center gap-1 text-xs">
                  <span className="text-gray-400">#{reward.position}</span>
                  <span className="font-semibold text-emerald-400">${reward.amount}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorPortalPage;
