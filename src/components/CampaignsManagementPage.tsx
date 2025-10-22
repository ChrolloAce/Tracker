import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Campaign, CampaignStatus } from '../types/campaigns';
import CampaignService from '../services/CampaignService';
import CreateCampaignModal from './CreateCampaignModal';
import { 
  Trophy, 
  Plus, 
  Target, 
  Users, 
  TrendingUp,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';

/**
 * Campaigns Management Page - For Admins/Managers
 * Create, view, and manage all campaigns
 */
const CampaignsManagementPage: React.FC = () => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<'all' | CampaignStatus>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
  const draftCampaigns = campaigns.filter(c => c.status === 'draft');
  const completedCampaigns = campaigns.filter(c => c.status === 'completed');

  // Calculate overall stats
  const totalParticipants = new Set(campaigns.flatMap(c => c.participantIds)).size;
  const totalViews = campaigns.reduce((sum, c) => sum + c.totalViews, 0);
  const totalPaidOut = campaigns.reduce((sum, c) => sum + c.totalEarnings, 0);

  if (loading) {
    return <div className="text-white">Loading campaigns...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="group relative px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-105"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create Campaign
          </div>
        </button>
      </div>

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

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        {(['all', 'active', 'draft', 'completed', 'cancelled'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedStatus === status
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && (
              <span className="ml-2 text-xs opacity-60">
                ({campaigns.filter(c => c.status === status).length})
              </span>
            )}
          </button>
        ))}
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
            onClick={() => setIsCreateModalOpen(true)}
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
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadCampaigns}
      />
    </div>
  );
};

// Campaign Management Card
const CampaignManagementCard: React.FC<{
  campaign: Campaign;
  onStatusChange: (campaignId: string, newStatus: CampaignStatus) => void;
}> = ({ campaign, onStatusChange }) => {
  const [showDetails, setShowDetails] = useState(false);

  const formatDate = (date: any) => {
    const d = date.toDate ? date.toDate() : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusIcon = (status: CampaignStatus) => {
    switch (status) {
      case 'active':
        return <Play className="w-4 h-4" />;
      case 'draft':
        return <Pause className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: CampaignStatus) => {
    switch (status) {
      case 'active':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'draft':
        return 'text-gray-400 bg-white/5 border-white/10';
      case 'completed':
        return 'text-gray-300 bg-white/5 border-white/10';
      case 'cancelled':
        return 'text-gray-500 bg-white/5 border-white/10';
    }
  };

  return (
    <div 
      className="rounded-xl border border-white/10 overflow-hidden transition-all hover:border-emerald-500/20"
      style={{ backgroundColor: '#121214' }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold text-white">{campaign.name}</h3>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(campaign.status)}`}>
                {getStatusIcon(campaign.status)}
                {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
              </span>
            </div>
            <p className="text-sm text-gray-400">{campaign.description}</p>
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="ml-4 p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
          >
            <Eye className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <div className="text-xs text-gray-400 mb-1">Goal</div>
            <div className="text-sm font-semibold text-white">
              {campaign.goalAmount.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">{campaign.goalType.replace('_', ' ')}</div>
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-1">Progress</div>
            <div className="text-sm font-semibold text-emerald-400">
              {campaign.progressPercent.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">
              {campaign.currentProgress.toLocaleString()} / {campaign.goalAmount.toLocaleString()}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-1">Participants</div>
            <div className="text-sm font-semibold text-white">
              {campaign.participants.length}
            </div>
            <div className="text-xs text-gray-500">creators</div>
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-1">Duration</div>
            <div className="text-sm font-semibold text-white">
              {formatDate(campaign.startDate)}
            </div>
            <div className="text-xs text-gray-500">to {formatDate(campaign.endDate)}</div>
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-1">Total Paid</div>
            <div className="text-sm font-semibold text-white">
              ${campaign.totalEarnings.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">earnings</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
          {campaign.status === 'draft' && (
            <button
              onClick={() => onStatusChange(campaign.id, 'active')}
              className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium rounded-lg transition-all text-sm flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Campaign
            </button>
          )}
          
          {campaign.status === 'active' && (
            <button
              onClick={() => onStatusChange(campaign.id, 'completed')}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg transition-all text-sm flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Complete Campaign
            </button>
          )}

          <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-medium rounded-lg transition-all text-sm">
            View Details
          </button>

          <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-medium rounded-lg transition-all text-sm">
            Edit
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignsManagementPage;

