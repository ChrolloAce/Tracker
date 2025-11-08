import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Trophy, 
  Calendar,
  Users,
  CheckCircle,
  AlertCircle,
  Upload,
  Target,
  Edit2,
  Save,
  X as XIcon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Campaign, CampaignVideoSubmission, MetricGuarantee } from '../types/campaigns';
import { TrackingRule } from '../types/rules';
import { OrgMember } from '../types/firestore';
import CampaignService from '../services/CampaignService';
import RulesService from '../services/RulesService';
import OrganizationService from '../services/OrganizationService';
import CampaignVideoSubmissionsTable from './CampaignVideoSubmissionsTable';
import CampaignVideoSubmissionModal from './CampaignVideoSubmissionModal';
import CampaignResourcesManager from './CampaignResourcesManager';

const CampaignDetailsPage: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { user, currentOrgId, currentProjectId } = useAuth();
  const navigate = useNavigate();
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [submissions, setSubmissions] = useState<CampaignVideoSubmission[]>([]);
  const [campaignRules, setCampaignRules] = useState<TrackingRule[]>([]);
  const [creators, setCreators] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);

  // Edit states
  const [editingTimeline, setEditingTimeline] = useState(false);
  const [editingRequirements, setEditingRequirements] = useState(false);
  const [editedStartDate, setEditedStartDate] = useState('');
  const [editedEndDate, setEditedEndDate] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedMetricGuarantees, setEditedMetricGuarantees] = useState<MetricGuarantee[]>([]);

  useEffect(() => {
    loadCampaign();
    loadSubmissions();
    loadCreators();
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
      
      if (!campaignData) {
        console.error('Campaign not found');
        return;
      }
      
      // Check if current user is a participant (creator)
      const userIsCreator = campaignData.participantIds.includes(user?.uid || '');
      setIsCreator(userIsCreator);
      
      // Redirect creators away from draft campaigns
      if (userIsCreator && campaignData.status === 'draft') {
        console.log('🚫 Creator cannot access draft campaigns');
        navigate('/campaigns');
        return;
      }
      
      setCampaign(campaignData);

      // Load associated rules
      if (campaignData.defaultRuleIds && campaignData.defaultRuleIds.length > 0) {
        const allRules = await RulesService.getRules(currentOrgId, currentProjectId);
        const filteredRules = allRules.filter(rule => campaignData.defaultRuleIds?.includes(rule.id));
        setCampaignRules(filteredRules);
      }
    } catch (error) {
      console.error('Failed to load campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async () => {
    if (!campaignId || !currentOrgId || !currentProjectId) return;

    setLoadingSubmissions(true);
    try {
      const submissionsData = await CampaignService.getCampaignSubmissions(
        currentOrgId,
        currentProjectId,
        campaignId
      );
      setSubmissions(submissionsData);
    } catch (error) {
      console.error('Failed to load submissions:', error);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const loadCreators = async () => {
    if (!currentOrgId || !campaign) return;

    try {
      const allMembers = await OrganizationService.getOrgMembers(currentOrgId);
      const campaignCreators = allMembers.filter(member => 
        campaign.participantIds.includes(member.userId)
      );
      setCreators(campaignCreators);
    } catch (error) {
      console.error('Failed to load creators:', error);
    }
  };

  useEffect(() => {
    if (campaign) {
      loadCreators();
      // Initialize edit states
      setEditedStartDate(campaign.startDate instanceof Date ? campaign.startDate.toISOString().split('T')[0] : new Date(campaign.startDate.toDate()).toISOString().split('T')[0]);
      setEditedEndDate(campaign.endDate ? (campaign.endDate instanceof Date ? campaign.endDate.toISOString().split('T')[0] : new Date(campaign.endDate.toDate()).toISOString().split('T')[0]) : '');
      setEditedDescription(campaign.description);
      setEditedMetricGuarantees(campaign.metricGuarantees || []);
    }
  }, [campaign]);

  const handleSaveTimeline = async () => {
    if (!campaignId || !currentOrgId || !currentProjectId) return;

    try {
      await CampaignService.updateCampaign(
        currentOrgId,
        currentProjectId,
        campaignId,
        {
          startDate: new Date(editedStartDate),
          endDate: editedEndDate ? new Date(editedEndDate) : undefined,
          isIndefinite: !editedEndDate
        }
      );
      await loadCampaign();
      setEditingTimeline(false);
    } catch (error) {
      console.error('Failed to update timeline:', error);
      alert('Failed to update timeline');
    }
  };

  const handleSaveRequirements = async () => {
    if (!campaignId || !currentOrgId || !currentProjectId) return;

    try {
      await CampaignService.updateCampaign(
        currentOrgId,
        currentProjectId,
        campaignId,
        {
          description: editedDescription,
          metricGuarantees: editedMetricGuarantees
        }
      );
      await loadCampaign();
      setEditingRequirements(false);
    } catch (error) {
      console.error('Failed to update requirements:', error);
      alert('Failed to update requirements');
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/20"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-white/40 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Campaign Not Found</h2>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-6 py-2 bg-white hover:bg-white/90 text-black rounded-lg transition-all font-medium"
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Campaigns</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Campaign Header - Horizontal Layout */}
        <div className="mb-6 sm:mb-8 bg-zinc-900/40 rounded-2xl border border-white/10 overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            {/* Left: Campaign Cover Image - Square */}
            <div className="w-full lg:w-80 aspect-square flex-shrink-0 relative overflow-hidden">
              {campaign.coverImage ? (
                <img 
                  src={campaign.coverImage} 
                  alt={campaign.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-800 flex items-center justify-center">
                  <Trophy className="w-16 sm:w-24 h-16 sm:h-24 text-white/20" />
                </div>
              )}
            </div>

            {/* Right: Campaign Info */}
            <div className="flex-1 p-4 sm:p-6 lg:p-8">
              {/* Name and Status */}
              <div className="flex flex-col sm:flex-row items-start justify-between mb-4 sm:mb-6 gap-3">
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{campaign.name}</h1>
                  <p className="text-sm sm:text-base text-white/60">{campaign.description}</p>
                </div>
                <div className="w-full sm:w-auto">
                  <div className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap text-center border ${
                    campaign.status === 'active' ? 'bg-white/10 text-white border-white/20' :
                    campaign.status === 'draft' ? 'bg-white/5 text-white/60 border-white/10' :
                    campaign.status === 'completed' ? 'bg-white/5 text-white/60 border-white/10' :
                    'bg-white/5 text-white/40 border-white/10'
                  }`}>
                    {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                  </div>
                </div>
              </div>

              {/* Key Stats - Compact Grid */}
              <div className={`grid grid-cols-2 ${isCreator ? 'sm:grid-cols-2' : 'sm:grid-cols-4'} gap-3 sm:gap-4 mb-4 sm:mb-6`}>
                {/* Hide Reward Rate for creators */}
                {!isCreator && (
                  <div>
                    <div className="text-xs text-white/40 mb-1">Reward Rate</div>
                    <div className="text-lg sm:text-xl font-bold text-white">{getRewardRate()}</div>
                  </div>
                )}

                <div>
                  <div className="text-xs text-white/40 mb-1">Total Views</div>
                  <div className="text-lg sm:text-xl font-bold text-white">{campaign.totalViews.toLocaleString()}</div>
                </div>

                <div>
                  <div className="text-xs text-white/40 mb-1">Total Paid</div>
                  <div className="text-lg sm:text-xl font-bold text-white">${campaign.totalEarnings.toFixed(2)}</div>
                </div>

                {/* Hide Participants for creators */}
                {!isCreator && (
                  <div>
                    <div className="text-xs text-white/40 mb-1">Participants</div>
                    <div className="text-lg sm:text-xl font-bold text-white">{campaign.participantIds.length}</div>
                  </div>
                )}
              </div>

              {/* Progress Bar - Integrated */}
              <div>
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="text-sm font-semibold text-white">Campaign Progress</div>
                  <div className="text-base sm:text-lg font-bold text-white">{campaign.progressPercent.toFixed(1)}%</div>
                </div>
                <div className="w-full h-2 sm:h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-white to-white/80 transition-all"
                    style={{ width: `${Math.min(campaign.progressPercent, 100)}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-white/40">
                  <span>{campaign.currentProgress.toLocaleString()} / {campaign.goalAmount.toLocaleString()}</span>
                  <span>{campaign.goalType.replace(/_/g, ' ')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid - Reorganized: Videos Left, Resources/Requirements Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Left Column - Video Submissions */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Video Submissions Section */}
            <div className="bg-zinc-900/40 rounded-xl border border-white/10">
              <div className="p-4 sm:p-6 border-b border-white/10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Video Submissions</h2>
                    <p className="text-xs sm:text-sm text-white/60">
                      {submissions.length} submission{submissions.length !== 1 ? 's' : ''} • {submissions.filter(s => s.status === 'approved').length} approved
                    </p>
                  </div>
                  {/* Submit Button (for creators) */}
                  {isCreator && campaign.status === 'active' && (
                    <button
                      onClick={() => setShowSubmissionModal(true)}
                      className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-white/90 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Upload className="w-5 h-5" />
                      Submit Video
                    </button>
                  )}
                </div>
              </div>

              {/* Submissions List */}
              <div className="p-4 sm:p-6">
                {loadingSubmissions ? (
                  <div className="text-center py-12 text-white/60">Loading submissions...</div>
                ) : submissions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white/5 rounded-full mb-4">
                      <Upload className="w-8 h-8 text-white/40" />
                    </div>
                    <p className="text-white/60 mb-4">No submissions yet</p>
                    {isCreator && campaign.status === 'active' && (
                      <p className="text-sm text-white/40">Be the first to submit your video!</p>
                    )}
                  </div>
                ) : (
                  <CampaignVideoSubmissionsTable
                    submissions={submissions}
                    campaignId={campaign.id}
                    isCreator={isCreator}
                    onRefresh={loadSubmissions}
                  />
                )}
              </div>
            </div>

            {/* Leaderboard */}
            {campaign.leaderboard && campaign.leaderboard.length > 0 && (
              <div className="bg-zinc-900/40 rounded-xl p-4 sm:p-6 border border-white/10">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  Leaderboard
                </h2>
                <div className="space-y-2">
                  {campaign.leaderboard.slice(0, 10).map((entry, index) => (
                    <div 
                      key={entry.creatorId}
                      className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg ${
                        index < 3 ? 'bg-gradient-to-r from-white/10 to-transparent border border-white/20' : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-white text-black' :
                        index === 1 ? 'bg-white/70 text-black' :
                        index === 2 ? 'bg-white/50 text-black' :
                        'bg-white/10 text-white'
                      }`}>
                        {entry.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white truncate">Creator {entry.creatorId.substring(0, 8)}</div>
                        <div className="text-xs sm:text-sm text-white/60">{entry.score.toLocaleString()} points</div>
                      </div>
                      {entry.delta !== 0 && (
                        <div className={`text-xs sm:text-sm font-medium ${entry.delta > 0 ? 'text-white' : 'text-white/40'}`}>
                          {entry.delta > 0 ? '+' : ''}{entry.delta}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Requirements & Resources */}
          <div className="space-y-4 sm:space-y-6">
            {/* Submission Requirements */}
            <div className="bg-zinc-900/40 rounded-xl p-4 sm:p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-white" />
                  Submission Requirements
                </h2>
                {!isCreator && !editingRequirements && (
                  <button
                    onClick={() => setEditingRequirements(true)}
                    className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {editingRequirements ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Description</label>
                    <textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2 bg-zinc-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveRequirements}
                      className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-white/90 text-black rounded-lg transition-colors font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingRequirements(false);
                        setEditedDescription(campaign.description);
                        setEditedMetricGuarantees(campaign.metricGuarantees || []);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white/60 rounded-lg hover:bg-white/10 transition-colors border border-white/10"
                    >
                      <XIcon className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Metric Guarantees */}
                  {campaign.metricGuarantees && campaign.metricGuarantees.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-base sm:text-lg font-semibold text-white mb-3">Minimum Metrics Per Video</h3>
                      <div className="space-y-2">
                        {campaign.metricGuarantees.map((guarantee, index) => (
                          <div key={index} className="flex items-center gap-2 sm:gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white flex-shrink-0" />
                            <div className="text-white text-sm sm:text-base">
                              <span className="font-semibold capitalize">{guarantee.metric.replace(/_/g, ' ')}: </span>
                              <span className="text-white font-bold">
                                {guarantee.minValue.toLocaleString()}
                                {guarantee.metric === 'engagement_rate' && '%'}
                              </span>
                              <span className="text-white/60 ml-2">minimum</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description as Requirements */}
                  <div className="prose prose-invert max-w-none">
                    <div className="text-sm sm:text-base text-white/70 whitespace-pre-wrap">{campaign.description}</div>
                  </div>
                </>
              )}
            </div>

            {/* Campaign Resources */}
            <div className="bg-zinc-900/40 rounded-xl p-4 sm:p-6 border border-white/10">
              <CampaignResourcesManager
                campaignId={campaignId!}
                isAdmin={!isCreator}
              />
            </div>

            {/* Rewards */}
            <div className="bg-zinc-900/40 rounded-xl p-4 sm:p-6 border border-white/10">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-4">Rewards</h2>
              <div className="space-y-3">
                {campaign.rewards.map((reward) => (
                  <div key={reward.position} className="flex items-center justify-between p-3 bg-gradient-to-r from-white/10 to-transparent border border-white/10 rounded-lg">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-sm sm:text-base truncate">{reward.description || `${reward.position}${reward.position === 1 ? 'st' : reward.position === 2 ? 'nd' : reward.position === 3 ? 'rd' : 'th'} Place`}</div>
                        <div className="text-xs text-white/60">Position {reward.position}</div>
                      </div>
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-white whitespace-nowrap ml-2">${reward.amount.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-zinc-900/40 rounded-xl p-4 sm:p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                  Timeline
                </h2>
                {!isCreator && !editingTimeline && (
                  <button
                    onClick={() => setEditingTimeline(true)}
                    className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {editingTimeline ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={editedStartDate}
                      onChange={(e) => setEditedStartDate(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">End Date (Optional)</label>
                    <input
                      type="date"
                      value={editedEndDate}
                      onChange={(e) => setEditedEndDate(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                    <p className="text-xs text-white/40 mt-1">Leave empty for indefinite</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveTimeline}
                      className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-white/90 text-black rounded-lg transition-colors font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingTimeline(false);
                        setEditedStartDate(campaign.startDate instanceof Date ? campaign.startDate.toISOString().split('T')[0] : new Date(campaign.startDate.toDate()).toISOString().split('T')[0]);
                        setEditedEndDate(campaign.endDate ? (campaign.endDate instanceof Date ? campaign.endDate.toISOString().split('T')[0] : new Date(campaign.endDate.toDate()).toISOString().split('T')[0]) : '');
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white/60 rounded-lg hover:bg-white/10 transition-colors border border-white/10"
                    >
                      <XIcon className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Start Date</span>
                    <span className="text-white font-medium">
                      {new Date(campaign.startDate instanceof Date ? campaign.startDate : campaign.startDate.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  {campaign.isIndefinite ? (
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">End Date</span>
                      <span className="text-white font-medium">Indefinite</span>
                    </div>
                  ) : campaign.endDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">End Date</span>
                      <span className="text-white font-medium">
                        {new Date(campaign.endDate instanceof Date ? campaign.endDate : campaign.endDate.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Creators List */}
            {!isCreator && creators.length > 0 && (
              <div className="bg-zinc-900/40 rounded-xl p-4 sm:p-6 border border-white/10">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                  Creators ({creators.length})
                </h2>
                <div className="space-y-2">
                  {creators.map((creator) => (
                    <div
                      key={creator.userId}
                      className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      {creator.photoURL ? (
                        <img
                          src={creator.photoURL}
                          alt={creator.displayName || 'Creator'}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                          <Users className="w-5 h-5 text-white/60" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-sm truncate">
                          {creator.displayName || 'Unnamed Creator'}
                        </div>
                        <div className="text-xs text-white/60 truncate">
                          {creator.email}
                        </div>
                      </div>
                      <div className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                        creator.role === 'owner'
                          ? 'bg-white/10 text-white border-white/20'
                          : creator.role === 'admin'
                          ? 'bg-white/5 text-white/80 border-white/10'
                          : 'bg-white/5 text-white/60 border-white/10'
                      }`}>
                        {creator.role}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Campaign Type Badge */}
            <div className="bg-zinc-900/40 rounded-xl p-4 sm:p-6 border border-white/10">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-3">Campaign Type</h2>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold bg-white/10 text-white border border-white/20">
                {campaign.campaignType === 'competition' ? <Trophy className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                <span className="capitalize">{campaign.campaignType}</span>
              </div>
              <p className="text-xs sm:text-sm text-white/60 mt-3">
                {campaign.campaignType === 'competition'
                  ? 'Creators compete for top positions with shared goals'
                  : 'Each creator has individual goals and rewards'}
              </p>
            </div>

            {/* Tracking Rules */}
            {campaignRules.length > 0 && (
              <div className="bg-zinc-900/40 rounded-xl p-4 sm:p-6 border border-white/10">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 sm:w-5 sm:h-5" />
                  Tracking Rules
                </h2>
                <div className="space-y-2">
                  {campaignRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="p-3 bg-white/5 border border-white/10 rounded-lg"
                    >
                      <div className="font-medium text-white text-sm">{rule.name}</div>
                      {rule.conditions && rule.conditions.length > 0 && (
                        <div className="text-xs text-white/60 mt-1">
                          {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal for Video Submission */}
        {showSubmissionModal && (
          <CampaignVideoSubmissionModal
            campaignId={campaign.id}
            isOpen={showSubmissionModal}
            onClose={() => setShowSubmissionModal(false)}
            onSuccess={loadSubmissions}
          />
        )}
      </div>
    </div>
  );
};

export default CampaignDetailsPage;
