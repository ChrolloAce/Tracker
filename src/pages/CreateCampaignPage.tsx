import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft,
  Target,
  Plus,
  Trash2,
  Check,
  Info,
  Instagram,
  Music,
  Youtube,
  Twitter
} from 'lucide-react';
import { CampaignGoalType, CompensationType, CampaignReward, MetricGuarantee, CampaignType } from '../types/campaigns';
import CampaignService from '../services/CampaignService';
import OrganizationService from '../services/OrganizationService';
import RulesService from '../services/RulesService';
import { OrgMember } from '../types/firestore';
import { TrackingRule } from '../types/rules';

// Tooltip Component
const Tooltip: React.FC<{ content: string; children: React.ReactNode }> = ({ content, children }) => {
  const [show, setShow] = useState(false);
  
  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap shadow-lg border border-white/10">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

// Platform icons mapping
const platformIcons: Record<string, React.ComponentType<any>> = {
  instagram: Instagram,
  tiktok: Music,
  youtube: Youtube,
  twitter: Twitter,
};

const CreateCampaignPage: React.FC = () => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const navigate = useNavigate();
  
  // Current step (1-5)
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  
  // Form data
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage] = useState<string>('');
  const [campaignType, setCampaignType] = useState<CampaignType>('competition');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'tiktok', 'youtube']);
  
  const [durationType, setDurationType] = useState<'days' | 'weeks' | 'indefinite'>('indefinite');
  const [durationValue, setDurationValue] = useState<number>(4);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  
  const [goalType, setGoalType] = useState<CampaignGoalType>('total_views');
  const [goalAmount, setGoalAmount] = useState<number>(1000000);
  const [metricGuarantees, setMetricGuarantees] = useState<MetricGuarantee[]>([]);
  const [defaultRuleId, setDefaultRuleId] = useState<string>('');
  const [rules, setRules] = useState<TrackingRule[]>([]);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleKeywords, setNewRuleKeywords] = useState('');
  
  const [compensationType, setCompensationType] = useState<CompensationType>('none');
  const [compensationAmount, setCompensationAmount] = useState<number>(0);
  const [rewards, setRewards] = useState<CampaignReward[]>([
    { position: 1, amount: 500, description: '1st Place' },
    { position: 2, amount: 300, description: '2nd Place' },
    { position: 3, amount: 200, description: '3rd Place' }
  ]);
  
  const [availableCreators, setAvailableCreators] = useState<OrgMember[]>([]);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentOrgId && currentProjectId) {
      loadCreators();
      loadRules();
    }
  }, [currentOrgId, currentProjectId]);

  useEffect(() => {
    if (durationType === 'indefinite') {
      setEndDate('');
    } else if (startDate && durationValue > 0) {
      const start = new Date(startDate);
      const daysToAdd = durationType === 'weeks' ? durationValue * 7 : durationValue;
      const end = new Date(start);
      end.setDate(start.getDate() + daysToAdd);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [startDate, durationValue, durationType]);

  const loadRules = async () => {
    if (!currentOrgId || !currentProjectId) return;
    
    try {
      const rulesData = await RulesService.getRules(currentOrgId, currentProjectId);
      setRules(rulesData);
    } catch (error) {
      console.error('Failed to load rules:', error);
    }
  };

  const loadCreators = async () => {
    if (!currentOrgId || !currentProjectId) return;
    
    setLoadingCreators(true);
    try {
      const members = await OrganizationService.getOrgMembers(currentOrgId);
      const creators = members.filter(m => m.role === 'creator');
      setAvailableCreators(creators);
    } catch (error) {
      console.error('Failed to load creators:', error);
    } finally {
      setLoadingCreators(false);
    }
  };

  const handleCreateRule = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;
    if (!newRuleName.trim()) {
      setError('Rule name is required');
      return;
    }

    try {
      const keywords = newRuleKeywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      // Create conditions from keywords
      const conditions = keywords.map((keyword, index) => ({
        id: `${Date.now()}_${index}`,
        type: 'description_contains' as const,
        value: keyword,
        operator: 'OR' as const
      }));

      const ruleId = await RulesService.createRule(currentOrgId, currentProjectId, user.uid, {
        name: newRuleName.trim(),
        conditions: conditions.length > 0 ? conditions : [],
        appliesTo: {
          platforms: selectedPlatforms as any[],
          accountIds: []
        },
        isActive: true,
      });

      await loadRules();
      setDefaultRuleId(ruleId);
      setShowCreateRule(false);
      setNewRuleName('');
      setNewRuleKeywords('');
      setError('');
    } catch (error: any) {
      console.error('Failed to create rule:', error);
      setError(error.message || 'Failed to create rule');
    }
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const toggleCreator = (creatorId: string) => {
    setSelectedCreatorIds(prev =>
      prev.includes(creatorId)
        ? prev.filter(id => id !== creatorId)
        : [...prev, creatorId]
    );
  };

  const addMetricGuarantee = () => {
    const newGuarantee: MetricGuarantee = {
      id: Date.now().toString(),
      metric: 'views',
      minValue: 10000,
      description: 'Minimum 10K views per video'
    };
    setMetricGuarantees([...metricGuarantees, newGuarantee]);
  };

  const updateMetricGuarantee = (id: string, updates: Partial<MetricGuarantee>) => {
    setMetricGuarantees(metricGuarantees.map(g => 
      g.id === id ? { ...g, ...updates } : g
    ));
  };

  const removeMetricGuarantee = (id: string) => {
    setMetricGuarantees(metricGuarantees.filter(g => g.id !== id));
  };

  const addReward = () => {
    const nextPosition = rewards.length + 1;
    setRewards([...rewards, { position: nextPosition, amount: 0, description: `${nextPosition}th Place` }]);
  };

  const removeReward = (index: number) => {
    setRewards(rewards.filter((_, i) => i !== index));
  };

  const updateReward = (index: number, field: keyof CampaignReward, value: any) => {
    const updated = [...rewards];
    updated[index] = { ...updated[index], [field]: value };
    setRewards(updated);
  };

  const canProceed = () => {
    switch(currentStep) {
      case 1: return name.trim() !== '';
      case 2: return startDate !== '' && (durationType === 'indefinite' || durationValue > 0);
      case 3: return goalAmount > 0;
      case 4: return true;
      case 5: return selectedCreatorIds.length > 0;
      default: return false;
    }
  };

  const nextStep = () => {
    if (canProceed() && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      setError('');
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError('');
    }
  };

  const handleSubmit = async () => {
    if (!currentOrgId || !currentProjectId || !user) {
      setError('Not authenticated');
      return;
    }

    if (selectedCreatorIds.length === 0) {
      setError('Please select at least one creator');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isIndefinite = durationType === 'indefinite';
      
      const campaignData: any = {
        name,
        description,
        coverImage: coverImage || undefined,
        campaignType,
        startDate: new Date(startDate),
        endDate: isIndefinite ? undefined : new Date(endDate),
        isIndefinite,
        goalType,
        goalAmount,
        compensationType,
        rewards,
        bonusRewards: [],
        metricGuarantees,
        defaultRuleIds: defaultRuleId ? [defaultRuleId] : undefined,
        participantIds: selectedCreatorIds,
      };
      
      if (compensationType !== 'none' && compensationAmount > 0) {
        campaignData.compensationAmount = compensationAmount;
      }
      
      await CampaignService.createCampaign(
        currentOrgId,
        currentProjectId,
        user.uid,
        campaignData
      );

      navigate('/campaigns');
    } catch (error: any) {
      console.error('Failed to create campaign:', error);
      setError(error.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="max-w-6xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden grid md:grid-cols-2">
        
        {/* Left Panel - Black Panel */}
        <div className="bg-black p-12 flex flex-col justify-between">
          {/* Logo & Branding */}
          <div>
          <button
            onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-12"
          >
            <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
          </button>

            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              A few clicks away from launching your campaign.
          </h1>
            <p className="text-gray-400 text-lg">
              Design competitions or challenges that motivate your creators and reward excellence.
          </p>
        </div>

          {/* Minimal Illustration */}
          <div className="relative">
            <div className="w-32 h-32 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl flex items-center justify-center shadow-xl border border-gray-700">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                <Target className="w-8 h-8 text-white" />
            </div>
            </div>
            {/* Progress indicator */}
            <div className="mt-8">
              <div className="flex items-center gap-2">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      i + 1 <= currentStep ? 'bg-white' : 'bg-gray-700'
                    }`}
                  />
                ))}
          </div>
              <p className="text-gray-500 text-sm mt-2">
                Step {currentStep} of {totalSteps}
              </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form Content */}
        <div className="p-12 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            {currentStep > 1 && (
            <button
                onClick={prevStep}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
            </button>
            )}
            <div className="flex-1"></div>
            <button className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Need help?
            </button>
            </div>
            
            {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

          {/* Step Content */}
          <div className="flex-1">

            {/* Step Content */}
            {currentStep === 1 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Campaign Basics</h2>
                <p className="text-gray-500 mb-6">Set up the foundation of your campaign.</p>

                  {/* Campaign Name */}
                <div className="mb-6">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    placeholder="Enter campaign name"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 text-gray-900 placeholder-gray-400 bg-white"
                      autoFocus
                    />
                </div>

                {/* Campaign Type - Dropdown */}
                <div className="mb-6">
                  <label className="text-sm text-gray-500 mb-2 block">Campaign Type</label>
                  <select
                    value={campaignType}
                    onChange={(e) => setCampaignType(e.target.value as CampaignType)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 text-gray-900 bg-white"
                  >
                    <option value="competition">Competition - Campaign-level goal with leaderboard</option>
                    <option value="individual">Individual - Personal goals for each creator</option>
                  </select>
                </div>

                {/* Platform Selection */}
                <div className="mb-6">
                  <label className="text-sm text-gray-500 mb-2 block">Select Platforms</label>
                  <div className="flex gap-2">
                    {['instagram', 'tiktok', 'youtube', 'twitter'].map((platform) => {
                      const Icon = platformIcons[platform];
                      return (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => togglePlatform(platform)}
                          className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                            selectedPlatforms.includes(platform)
                              ? 'bg-black text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="capitalize text-sm">{platform}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the campaign goals, rules, and what creators can win..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 text-gray-900 placeholder-gray-400 bg-white resize-none"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Duration */}
            {currentStep === 2 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Campaign Duration</h2>
                <p className="text-gray-500 mb-6">Set how long your campaign will run.</p>
                
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                    Duration Type *
                    <Tooltip content="Set how long the campaign will run">
                      <Info className="w-4 h-4 text-gray-500" />
                    </Tooltip>
                  </label>
                  <select
                    value={durationType}
                    onChange={(e) => setDurationType(e.target.value as any)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-black/20"
                  >
                    <option value="indefinite">Indefinite (No end date)</option>
                    <option value="days">Custom Days</option>
                    <option value="weeks">Custom Weeks</option>
                  </select>
                </div>

                {durationType !== 'indefinite' && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                      Duration Length
                      <Tooltip content="Number of days or weeks">
                        <Info className="w-4 h-4 text-gray-500" />
                      </Tooltip>
                    </label>
                    <input
                      type="number"
                      value={durationValue}
                      onChange={(e) => setDurationValue(Number(e.target.value))}
                      min="1"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                )}

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                    Start Date *
                    <Tooltip content="When the campaign begins">
                      <Info className="w-4 h-4 text-gray-500" />
                    </Tooltip>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>

                {(durationType === 'indefinite' ? (
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold">Duration:</span> Indefinite — Campaign runs continuously
                    </div>
                  </div>
                ) : endDate && (
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold">End Date:</span> {new Date(endDate).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 3: Goals & Rules */}
            {currentStep === 3 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Goals & Tracking</h2>
                <p className="text-gray-500 mb-6">Define success metrics and tracking rules for your campaign.</p>
                
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                    Goal Type *
                    <Tooltip content="Choose the primary metric to measure success">
                      <Info className="w-4 h-4 text-gray-500" />
                    </Tooltip>
                  </label>
                  <select
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value as CampaignGoalType)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-black/20"
                  >
                    <option value="total_views">Total Views</option>
                    <option value="total_engagement">Total Engagement</option>
                    <option value="avg_engagement_rate">Average Engagement Rate</option>
                    <option value="total_likes">Total Likes</option>
                    <option value="video_count">Video Count</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                    Goal Target *
                    <Tooltip content="The target number to reach for the selected metric">
                      <Info className="w-4 h-4 text-gray-500" />
                    </Tooltip>
                  </label>
                  <input
                    type="number"
                    value={goalAmount}
                    onChange={(e) => setGoalAmount(Number(e.target.value))}
                    min="0"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>

                {/* Tracking Rule */}
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Tracking Rule (Optional)
                      </label>
                      <Tooltip content="Auto-track videos with keywords or hashtags">
                        <Info className="w-4 h-4 text-gray-500" />
                      </Tooltip>
                    </div>
                    {!showCreateRule && (
                      <button
                        type="button"
                        onClick={() => setShowCreateRule(true)}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Create Rule
                      </button>
                    )}
                  </div>

                  {showCreateRule ? (
                    <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                      <input
                        type="text"
                        value={newRuleName}
                        onChange={(e) => setNewRuleName(e.target.value)}
                        placeholder="Rule name"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                      <input
                        type="text"
                        value={newRuleKeywords}
                        onChange={(e) => setNewRuleKeywords(e.target.value)}
                        placeholder="Keywords (comma separated)"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCreateRule}
                          className="flex-1 px-4 py-2 bg-black hover:bg-gray-800 text-white text-sm rounded-lg"
                        >
                          Create
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCreateRule(false)}
                          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={defaultRuleId}
                      onChange={(e) => setDefaultRuleId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-black/20"
                    >
                      <option value="">No rule (manual tracking)</option>
                      {rules.map((rule) => (
                        <option key={rule.id} value={rule.id}>
                          {rule.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Metric Guarantees */}
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-500">Minimum Requirements (Optional)</label>
                    <button
                      type="button"
                      onClick={addMetricGuarantee}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>

                  {metricGuarantees.map((guarantee) => (
                    <div key={guarantee.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg mb-2">
                      <select
                        value={guarantee.metric}
                        onChange={(e) => updateMetricGuarantee(guarantee.id, { metric: e.target.value as any })}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm bg-white"
                      >
                        <option value="views">Views</option>
                        <option value="likes">Likes</option>
                        <option value="comments">Comments</option>
                        <option value="engagement_rate">Engagement Rate %</option>
                      </select>
                      <input
                        type="number"
                        value={guarantee.minValue}
                        onChange={(e) => updateMetricGuarantee(guarantee.id, { minValue: Number(e.target.value) })}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeMetricGuarantee(guarantee.id)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Rewards */}
            {currentStep === 4 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Rewards & Compensation</h2>
                <p className="text-gray-500 mb-6">Set up how creators will be compensated and rewarded.</p>
                
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                    Compensation Type
                    <Tooltip content="How creators will be compensated for participation">
                      <Info className="w-4 h-4 text-gray-500" />
                    </Tooltip>
                  </label>
                  <select
                    value={compensationType}
                    onChange={(e) => setCompensationType(e.target.value as CompensationType)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-black/20"
                  >
                    <option value="none">No base compensation</option>
                    <option value="flat_cpm">CPM (Per 1000 views)</option>
                    <option value="flat_per_video">Flat rate per video</option>
                  </select>
                </div>

                {compensationType !== 'none' && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                      Amount ($)
                      <Tooltip content="Base payment amount per creator">
                        <Info className="w-4 h-4 text-gray-500" />
                      </Tooltip>
                    </label>
                    <input
                      type="number"
                      value={compensationAmount}
                      onChange={(e) => setCompensationAmount(Number(e.target.value))}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                )}

                <div className="border-t border-gray-200 pt-6 mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-500">Position Rewards</label>
                    <button
                      type="button"
                      onClick={addReward}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>

                  {rewards.map((reward, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg mb-2">
                      <input
                        type="text"
                        value={reward.description}
                        onChange={(e) => updateReward(index, 'description', e.target.value)}
                        placeholder="Description"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm bg-white"
                      />
                      <input
                        type="number"
                        value={reward.amount}
                        onChange={(e) => updateReward(index, 'amount', Number(e.target.value))}
                        placeholder="Amount"
                        className="w-32 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeReward(index)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Select Creators */}
            {currentStep === 5 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Creators</h2>
                <p className="text-gray-500 mb-6">Choose which creators can participate in this campaign.</p>
                
                {loadingCreators ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
                    <p className="text-gray-500 mt-4">Loading creators...</p>
                  </div>
                ) : availableCreators.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No creators available. Add creators to your project first.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableCreators.map((creator) => (
                      <button
                        key={creator.userId}
                        type="button"
                        onClick={() => toggleCreator(creator.userId)}
                        className={`w-full flex items-center gap-4 p-4 border-2 rounded-xl transition-all text-left ${
                          selectedCreatorIds.includes(creator.userId)
                            ? 'border-black bg-black/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${
                          selectedCreatorIds.includes(creator.userId)
                            ? 'bg-black border-black'
                            : 'border-gray-300'
                        }`}>
                          {selectedCreatorIds.includes(creator.userId) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{creator.displayName || creator.email}</div>
                          <div className="text-sm text-gray-500">{creator.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedCreatorIds.length > 0 && (
                  <div className="mt-4 text-sm text-gray-700">
                    {selectedCreatorIds.length} creator{selectedCreatorIds.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
            )}
            
        </div>

          {/* Footer Actions */}
          <div className="mt-8">
            {currentStep < totalSteps && (
            <button
                onClick={nextStep}
                disabled={!canProceed() || loading}
                className="w-full bg-black hover:bg-gray-800 text-white py-3.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Continue
            </button>
            )}

            {currentStep === totalSteps && (
            <button
                onClick={handleSubmit}
              disabled={!canProceed() || loading}
                className="w-full bg-black hover:bg-gray-800 text-white py-3.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'Creating...' : 'Create Campaign'}
            </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCampaignPage;
