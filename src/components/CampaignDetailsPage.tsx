import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Trophy, 
  Calendar,
  Users,
  Eye,
  DollarSign,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Upload,
  Instagram as InstagramIcon,
  Youtube,
  Video
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Campaign } from '../types/campaigns';
import CampaignService from '../services/CampaignService';

const CampaignDetailsPage: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { user, currentOrgId, currentProjectId } = useAuth();
  const navigate = useNavigate();
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    loadCampaign();
  }, [campaignId, currentOrgId, currentProjectId]);

  const loadCampaign = async () => {
    if (!campaignId || !currentOrgId || !currentProjectId) return;

    setLoading(true);
    try {
      const campaignData = await CampaignService.getCampaign(
        currentOrgId,
        currentProjectId,
        campaignId
      );
      setCampaign(campaignData);
      
      // Check if current user is a participant (creator)
      setIsCreator(campaignData.participantIds.includes(user?.uid || ''));
    } catch (error) {
      console.error('Failed to load campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch(platform.toLowerCase()) {
      case 'instagram': return <InstagramIcon className="w-5 h-5" />;
      case 'tiktok': return <Video className="w-5 h-5" />;
      case 'youtube': return <Youtube className="w-5 h-5" />;
      default: return <Video className="w-5 h-5" />;
    }
  };

  const getRewardRate = () => {
    if (!campaign) return '';
    
    if (campaign.compensationType === 'flat_cpm' && campaign.compensationAmount) {
      return `$${campaign.compensationAmount.toFixed(2)} / 1K views`;
    } else if (campaign.compensationType === 'flat_per_video' && campaign.compensationAmount) {
      return `$${campaign.compensationAmount.toFixed(2)} / video`;
    }
    return 'Variable';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Campaign Not Found</h2>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A0A0A]/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Campaigns</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Cover Image */}
        {campaign.coverImage && (
          <div className="w-full h-64 rounded-2xl overflow-hidden mb-8">
            <img 
              src={campaign.coverImage} 
              alt={campaign.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Campaign Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-white mb-2">{campaign.name}</h1>
              <p className="text-lg text-gray-400">{campaign.description}</p>
            </div>
            <div className="ml-6">
              <div className={`px-4 py-2 rounded-full font-semibold ${
                campaign.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                campaign.status === 'draft' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30' :
                campaign.status === 'completed' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                'bg-gray-500/10 text-gray-400 border border-gray-500/30'
              }`}>
                {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
              </div>
            </div>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-gray-400 mb-1">Reward Rate</div>
              <div className="text-2xl font-bold text-emerald-400">{getRewardRate()}</div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-gray-400 mb-1">Total Views</div>
              <div className="text-2xl font-bold text-white">{campaign.totalViews.toLocaleString()}</div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-gray-400 mb-1">Total Paid</div>
              <div className="text-2xl font-bold text-white">${campaign.totalEarnings.toFixed(2)}</div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-gray-400 mb-1">Participants</div>
              <div className="text-2xl font-bold text-white">{campaign.participantIds.length}</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8 bg-white/5 rounded-xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold text-white">Campaign Progress</div>
            <div className="text-xl font-bold text-emerald-400">{campaign.progressPercent.toFixed(1)}%</div>
          </div>
          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
              style={{ width: `${Math.min(campaign.progressPercent, 100)}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between mt-2 text-sm text-gray-400">
            <span>{campaign.currentProgress.toLocaleString()} / {campaign.goalAmount.toLocaleString()}</span>
            <span>{campaign.goalType.replace(/_/g, ' ')}</span>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Requirements */}
          <div className="lg:col-span-2 space-y-6">
            {/* Submission Requirements */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                Submission Requirements
              </h2>

              {/* Metric Guarantees */}
              {campaign.metricGuarantees && campaign.metricGuarantees.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Minimum Metrics Per Video</h3>
                  <div className="space-y-2">
                    {campaign.metricGuarantees.map((guarantee, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <div className="text-white">
                          <span className="font-semibold capitalize">{guarantee.metric.replace(/_/g, ' ')}: </span>
                          <span className="text-blue-400 font-bold">
                            {guarantee.minValue.toLocaleString()}
                            {guarantee.metric === 'engagement_rate' && '%'}
                          </span>
                          <span className="text-gray-400 ml-2">minimum</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description as Requirements */}
              <div className="prose prose-invert max-w-none">
                <div className="text-gray-300 whitespace-pre-wrap">{campaign.description}</div>
              </div>
            </div>

            {/* Leaderboard */}
            {campaign.leaderboard && campaign.leaderboard.length > 0 && (
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-yellow-400" />
                  Leaderboard
                </h2>
                <div className="space-y-2">
                  {campaign.leaderboard.slice(0, 10).map((entry, index) => (
                    <div 
                      key={entry.creatorId}
                      className={`flex items-center gap-4 p-4 rounded-lg ${
                        index < 3 ? 'bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/30' : 'bg-white/5'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-yellow-500 text-black' :
                        index === 1 ? 'bg-gray-400 text-black' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-white/10 text-white'
                      }`}>
                        {entry.rank}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-white">Creator {entry.creatorId.substring(0, 8)}</div>
                        <div className="text-sm text-gray-400">{entry.score.toLocaleString()} points</div>
                      </div>
                      {entry.delta !== 0 && (
                        <div className={`text-sm font-medium ${entry.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {entry.delta > 0 ? '+' : ''}{entry.delta}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Rewards & Actions */}
          <div className="space-y-6">
            {/* Rewards */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h2 className="text-xl font-bold text-white mb-4">Rewards</h2>
              <div className="space-y-3">
                {campaign.rewards.map((reward) => (
                  <div key={reward.position} className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">{reward.description || `${reward.position}${reward.position === 1 ? 'st' : reward.position === 2 ? 'nd' : reward.position === 3 ? 'rd' : 'th'} Place`}</div>
                        <div className="text-xs text-gray-400">Position {reward.position}</div>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-emerald-400">${reward.amount.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Timeline
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Start Date</span>
                  <span className="text-white font-medium">
                    {new Date(campaign.startDate instanceof Date ? campaign.startDate : campaign.startDate.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">End Date</span>
                  <span className="text-white font-medium">
                    {new Date(campaign.endDate instanceof Date ? campaign.endDate : campaign.endDate.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Submit Button (for creators) */}
            {isCreator && campaign.status === 'active' && (
              <button
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-xl transition-all hover:scale-105 flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Submit Your Video
              </button>
            )}

            {/* View Analytics (for managers) */}
            {!isCreator && (
              <button
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-xl transition-all hover:scale-105 flex items-center justify-center gap-2"
              >
                <Eye className="w-5 h-5" />
                View Analytics
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignDetailsPage;

