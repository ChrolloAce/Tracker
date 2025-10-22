import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Campaign, CampaignStatus } from '../types/campaigns';
import CampaignService from '../services/CampaignService';
import CreateCampaignModal from './CreateCampaignModal';
import { 
  Trophy, 
  DollarSign,
  MoreVertical,
  Plus
} from 'lucide-react';

interface CampaignsManagementPageProps {
  openCreateModal?: boolean;
  onCloseCreateModal?: () => void;
  selectedStatus?: 'all' | CampaignStatus;
  onStatusChange?: (status: 'all' | CampaignStatus) => void;
  onOpenCreateModal?: () => void;
  onCampaignsLoaded?: (counts: { active: number; draft: number; completed: number; cancelled: number }) => void;
}

/**
 * Campaigns Management Page - For Admins/Managers
 * Create, view, and manage all campaigns
 */
const CampaignsManagementPage: React.FC<CampaignsManagementPageProps> = ({ 
  openCreateModal = false, 
  onCloseCreateModal,
  selectedStatus = 'all',
  onOpenCreateModal,
  onCampaignsLoaded
}) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Sync external open state with internal state
  useEffect(() => {
    if (openCreateModal) {
      setIsCreateModalOpen(true);
    }
  }, [openCreateModal]);

  useEffect(() => {
    loadCampaigns();
  }, [currentOrgId, currentProjectId, selectedStatus]);

  const loadCampaigns = async () => {
    if (!currentOrgId || !currentProjectId) return;

    setLoading(true);
    try {
      const allCampaigns = selectedStatus === 'all'
        ? await CampaignService.getCampaigns(currentOrgId, currentProjectId)
        : await CampaignService.getCampaigns(currentOrgId, currentProjectId, selectedStatus);

      setCampaigns(allCampaigns);

      // Update campaign counts
      if (onCampaignsLoaded) {
        const counts = {
          active: allCampaigns.filter(c => c.status === 'active').length,
          draft: allCampaigns.filter(c => c.status === 'draft').length,
          completed: allCampaigns.filter(c => c.status === 'completed').length,
          cancelled: allCampaigns.filter(c => c.status === 'cancelled').length,
        };
        onCampaignsLoaded(counts);
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (campaignId: string, newStatus: CampaignStatus) => {
    if (!currentOrgId || !currentProjectId) return;

    try {
      await CampaignService.updateCampaignStatus(currentOrgId, currentProjectId, campaignId, newStatus);
      await loadCampaigns();
    } catch (error) {
      console.error('Failed to update campaign status:', error);
    }
  };

  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  // Calculate overall stats
  const totalParticipants = new Set(campaigns.flatMap(c => c.participantIds)).size;
  const totalViews = campaigns.reduce((sum, c) => sum + c.totalViews, 0);
  const totalPaidOut = campaigns.reduce((sum, c) => sum + c.totalEarnings, 0);

  if (loading) {
    return <div className="text-white">Loading campaigns...</div>;
  }

  return (
    <div className="space-y-6">

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 p-6" style={{ backgroundColor: '#121214' }}>
          <div className="text-sm text-gray-400 mb-2">Active Campaigns</div>
          <div className="text-3xl font-bold text-white">{activeCampaigns.length}</div>
        </div>

        <div className="rounded-xl border border-white/10 p-6" style={{ backgroundColor: '#121214' }}>
          <div className="text-sm text-gray-400 mb-2">Total Participants</div>
          <div className="text-3xl font-bold text-white">{totalParticipants}</div>
        </div>

        <div className="rounded-xl border border-white/10 p-6" style={{ backgroundColor: '#121214' }}>
          <div className="text-sm text-gray-400 mb-2">Total Views</div>
          <div className="text-3xl font-bold text-white">{totalViews.toLocaleString()}</div>
        </div>

        <div className="rounded-xl border border-white/10 p-6" style={{ backgroundColor: '#121214' }}>
          <div className="text-sm text-gray-400 mb-2">Total Paid Out</div>
          <div className="text-3xl font-bold text-white">${totalPaidOut.toFixed(2)}</div>
        </div>
      </div>

      {/* Campaigns List */}
      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-white/10 p-12 text-center" style={{ backgroundColor: '#121214' }}>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-full border-2 border-emerald-500/20 mb-4">
            <Trophy className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Campaigns Yet</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Create your first campaign to start motivating creators and tracking performance!
          </p>
          <button
            onClick={() => {
              if (onOpenCreateModal) {
                onOpenCreateModal();
              } else {
                setIsCreateModalOpen(true);
              }
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Your First Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <CampaignManagementCard
              key={campaign.id}
              campaign={campaign}
            />
          ))}
        </div>
      )}

      {/* Floating + Button */}
      {campaigns.length > 0 && (
        <button
          onClick={() => {
            if (onOpenCreateModal) {
              onOpenCreateModal();
            } else {
              setIsCreateModalOpen(true);
            }
          }}
          className="fixed bottom-8 right-8 w-14 h-14 bg-white hover:bg-gray-100 text-black rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 z-50"
          title="Create Campaign"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          onCloseCreateModal?.();
        }}
        onSuccess={loadCampaigns}
      />
    </div>
  );
};

// Campaign Management Card - Redesigned
const CampaignManagementCard: React.FC<{
  campaign: Campaign;
}> = ({ campaign }) => {
  // Calculate CPM/reward from compensation
  const getRewardDisplay = () => {
    if (campaign.compensationType === 'flat_cpm' && campaign.compensationAmount) {
      return `$${campaign.compensationAmount.toFixed(2)} / 1K`;
    } else if (campaign.compensationType === 'flat_per_video' && campaign.compensationAmount) {
      return `$${campaign.compensationAmount.toFixed(2)} / video`;
    }
    return 'Custom';
  };

  // Get campaign category from description or goal type
  const getCategory = () => {
    return campaign.description.split(' ')[0] || 'General';
  };

  // Get campaign type
  const getCampaignType = () => {
    return 'UGC'; // User Generated Content
  };

  // Calculate budget target (assuming rewards * participants)
  const totalBudget = campaign.rewards.reduce((sum, r) => sum + r.amount, 0) + 
                      (campaign.compensationAmount || 0) * campaign.participantIds.length;

  return (
    <div 
      className="rounded-2xl border border-white/10 overflow-hidden transition-all hover:border-white/20 cursor-pointer group"
      style={{ backgroundColor: '#0b0b0b' }}
    >
      <div className="flex">
        {/* Left side - Thumbnail (25-30%) */}
        <div className="w-1/4 min-w-[200px] relative overflow-hidden">
          {campaign.coverImage ? (
            <img 
              src={campaign.coverImage} 
              alt={campaign.name}
              className="w-full h-full object-cover"
            />
          ) : (
            // Placeholder dashboard preview
            <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-800 p-4 flex items-center justify-center">
              <div className="space-y-2 w-full">
                <div className="h-2 bg-white/10 rounded w-3/4"></div>
                <div className="h-2 bg-white/10 rounded w-1/2"></div>
                <div className="h-16 bg-white/5 rounded mt-4"></div>
                <div className="h-16 bg-white/5 rounded"></div>
              </div>
            </div>
          )}
        </div>

        {/* Right side - Campaign Summary (70%) */}
        <div className="flex-1 p-6 flex flex-col justify-between">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-1.5">{campaign.name}</h3>
                <p className="text-sm text-gray-400">
                  ${campaign.totalEarnings.toFixed(2)} of ${totalBudget.toFixed(2)} paid out
                </p>
              </div>

              {/* Top-right controls */}
              <div className="flex items-center gap-2 ml-4">
                <button
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-all text-sm"
                  title="Add budget"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Add budget</span>
                </button>
                <button
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="relative w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                  style={{ width: `${campaign.progressPercent}%` }}
                ></div>
              </div>
              <div className="flex justify-end mt-1">
                <span className="text-xs text-white font-semibold">{campaign.progressPercent.toFixed(0)}%</span>
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-6 mb-3">
              {/* Reward */}
              <div>
                <div className="text-[10px] text-gray-500 uppercase mb-1">Reward</div>
                <div className="inline-flex items-center px-3 py-1 rounded-full font-bold text-sm text-white" style={{ backgroundColor: '#007aff' }}>
                  {getRewardDisplay()}
                </div>
              </div>

              {/* Category */}
              <div>
                <div className="text-[10px] text-gray-500 uppercase mb-1">Category</div>
                <div className="text-sm text-gray-300">{getCategory()}</div>
              </div>

              {/* Type */}
              <div>
                <div className="text-[10px] text-gray-500 uppercase mb-1">Type</div>
                <div className="text-sm text-gray-300">{getCampaignType()}</div>
              </div>

              {/* Views */}
              <div>
                <div className="text-[10px] text-gray-500 uppercase mb-1">Views</div>
                <div className="text-sm text-white font-semibold">{campaign.totalViews.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>{campaign.totalVideos} submissions</span>
              <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
              <span>{campaign.participantIds.length} creators</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignsManagementPage;

