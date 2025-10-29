import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft,
  Target,
  Plus,
  Trash2,
  Check,
  Upload,
  X,
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
import FirebaseStorageService from '../services/FirebaseStorageService';

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
  const [coverImage, setCoverImage] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentOrgId) return;

    setUploadingImage(true);
    try {
      const imageUrl = await CampaignService.uploadCoverImage(currentOrgId, file);
      setCoverImage(imageUrl);
      console.log('✅ Cover image uploaded:', imageUrl);
    } catch (error) {
      console.error('Failed to upload image:', error);
      setError('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
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

  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Left Panel - Colored Banner/Branding */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-all mb-12"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            Create a<br />Campaign
          </h1>
          
          <p className="text-white/90 text-lg leading-relaxed max-w-md">
            Design competitions or individual challenges that motivate your creators, 
            track performance, and reward excellence.
          </p>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">Set Clear Goals</h3>
              <p className="text-white/80 text-sm">Define objectives and rewards that drive results</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Check className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">Track Progress</h3>
              <p className="text-white/80 text-sm">Monitor real-time performance across all creators</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header with progress */}
        <div className="border-b border-white/10 px-8 py-6">
          <div className="max-w-4xl mx-auto w-full">
            {/* Mobile back button */}
            <button
              onClick={() => navigate(-1)}
              className="lg:hidden flex items-center gap-2 text-gray-400 hover:text-white transition-all mb-6"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>

            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Create Campaign</h2>
                <p className="text-gray-400 text-sm">Step {currentStep} of {totalSteps}</p>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-4xl mx-auto w-full">
            {error && (
              <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Step Content */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-white mb-6">Campaign Basics</h3>
                
                {/* Campaign Name and Cover Image - Horizontally aligned */}
                <div className="flex gap-4 items-start">
                  {/* Cover Image - Small Square */}
                  <div className="flex-shrink-0">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
                      Cover
                      <Tooltip content="Upload an image to represent your campaign">
                        <Info className="w-4 h-4 text-gray-500" />
                      </Tooltip>
                    </label>
                    {coverImage ? (
                      <div className="relative w-[48px] h-[48px] rounded-lg overflow-hidden border border-white/10 group">
                        <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setCoverImage('')}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-[48px] h-[48px] border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-emerald-500/50 transition-all flex items-center justify-center bg-white/5">
                        {uploadingImage ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                        ) : (
                          <Upload className="w-4 h-4 text-gray-500" />
                        )}
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                        />
                      </label>
                    )}
                  </div>

                  {/* Campaign Name */}
                  <div className="flex-1">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
                      Campaign Name *
                      <Tooltip content="Give your campaign a memorable name">
                        <Info className="w-4 h-4 text-gray-500" />
                      </Tooltip>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Summer Growth Challenge 2025"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Campaign Type - Dropdown */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
                    Campaign Type *
                    <Tooltip content="Choose between competition or individual structure">
                      <Info className="w-4 h-4 text-gray-500" />
                    </Tooltip>
                  </label>
                  <select
                    value={campaignType}
                    onChange={(e) => setCampaignType(e.target.value as CampaignType)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="competition">Competition - Campaign-level goal with leaderboard</option>
                    <option value="individual">Individual - Personal goals for each creator</option>
                  </select>
                </div>

                {/* Platform Selection - All in one row, smaller */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
                    Platforms *
                    <Tooltip content="Select which social media platforms this campaign targets">
                      <Info className="w-4 h-4 text-gray-500" />
                    </Tooltip>
                  </label>
                  <div className="flex gap-2">
                    {['instagram', 'tiktok', 'youtube', 'twitter'].map((platform) => {
                      const Icon = platformIcons[platform];
                      return (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => togglePlatform(platform)}
                          className={`px-3 py-2 rounded-lg border-2 transition-all flex items-center gap-2 text-sm ${
                            selectedPlatforms.includes(platform)
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/30'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="capitalize">{platform}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
                    Description
                    <Tooltip content="Explain campaign goals, rules, and rewards">
                      <Info className="w-4 h-4 text-gray-500" />
                    </Tooltip>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the campaign goals, rules, and what creators can win..."
                    rows={4}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 resize-none"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Duration */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-white mb-6">Campaign Duration</h3>
                
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
                    Duration Type *
                    <Tooltip content="Set how long the campaign will run">
                      <Info className="w-4 h-4 text-gray-500" />
                    </Tooltip>
                  </label>
                  <select
                    value={durationType}
                    onChange={(e) => setDurationType(e.target.value as any)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="indefinite">Indefinite (No end date)</option>
                    <option value="days">Custom Days</option>
                    <option value="weeks">Custom Weeks</option>
                  </select>
                </div>

                {durationType !== 'indefinite' && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
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
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                )}

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
                    Start Date *
                    <Tooltip content="When the campaign begins">
                      <Info className="w-4 h-4 text-gray-500" />
                    </Tooltip>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                {(durationType === 'indefinite' ? (
                  <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="text-sm text-blue-400">
                      <span className="font-semibold">Duration:</span> Indefinite — Campaign runs continuously
                    </div>
                  </div>
                ) : endDate && (
                  <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <div className="text-sm text-emerald-400">
                      <span className="font-semibold">End Date:</span> {new Date(endDate).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 3: Goals & Rules */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-white mb-6">Goals & Tracking</h3>
                
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
                    Goal Type *
                    <Tooltip content="Choose the primary metric to measure success">
                      <Info className="w-4 h-4 text-gray-500" />
                    </Tooltip>
                  </label>
                  <select
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value as CampaignGoalType)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="total_views">Total Views</option>
                    <option value="total_engagement">Total Engagement</option>
                    <option value="avg_engagement_rate">Average Engagement Rate</option>
                    <option value="total_likes">Total Likes</option>
                    <option value="video_count">Video Count</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
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
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                {/* Tracking Rule */}
                <div className="border-t border-white/10 pt-6">
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
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Create Rule
                      </button>
                    )}
                  </div>

                  {showCreateRule ? (
                    <div className="mb-4 p-4 bg-white/5 border border-white/10 rounded-lg space-y-3">
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
                          className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg"
                        >
                          Create
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCreateRule(false)}
                          className="px-4 py-2 bg-white/5 text-white text-sm rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={defaultRuleId}
                      onChange={(e) => setDefaultRuleId(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
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
                <div className="border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-400">Minimum Requirements (Optional)</label>
                    <button
                      type="button"
                      onClick={addMetricGuarantee}
                      className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>

                  {metricGuarantees.map((guarantee) => (
                    <div key={guarantee.id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg mb-2">
                      <select
                        value={guarantee.metric}
                        onChange={(e) => updateMetricGuarantee(guarantee.id, { metric: e.target.value as any })}
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
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
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
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
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-white mb-6">Rewards & Compensation</h3>
                
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
                    Compensation Type
                    <Tooltip content="How creators will be compensated for participation">
                      <Info className="w-4 h-4 text-gray-500" />
                    </Tooltip>
                  </label>
                  <select
                    value={compensationType}
                    onChange={(e) => setCompensationType(e.target.value as CompensationType)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="none">No base compensation</option>
                    <option value="flat_cpm">CPM (Per 1000 views)</option>
                    <option value="flat_per_video">Flat rate per video</option>
                  </select>
                </div>

                {compensationType !== 'none' && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
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
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                )}

                <div className="border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-400">Position Rewards</label>
                    <button
                      type="button"
                      onClick={addReward}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>

                  {rewards.map((reward, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg mb-2">
                      <input
                        type="text"
                        value={reward.description}
                        onChange={(e) => updateReward(index, 'description', e.target.value)}
                        placeholder="Description"
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
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
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-6">
                  <h3 className="text-2xl font-bold text-white">Select Creators</h3>
                  <Tooltip content="Choose which creators can participate in this campaign">
                    <Info className="w-5 h-5 text-gray-500" />
                  </Tooltip>
                </div>
                
                {loadingCreators ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
                    <p className="text-gray-400 mt-4">Loading creators...</p>
                  </div>
                ) : availableCreators.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    No creators available. Add creators to your project first.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {availableCreators.map((creator) => (
                      <button
                        key={creator.userId}
                        type="button"
                        onClick={() => toggleCreator(creator.userId)}
                        className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                          selectedCreatorIds.includes(creator.userId)
                            ? 'bg-emerald-500/20 border-emerald-500'
                            : 'bg-white/5 border-white/10 hover:border-white/30'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${
                          selectedCreatorIds.includes(creator.userId)
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-white/30'
                        }`}>
                          {selectedCreatorIds.includes(creator.userId) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium text-white">{creator.displayName || creator.email}</div>
                          <div className="text-sm text-gray-400">{creator.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedCreatorIds.length > 0 && (
                  <div className="mt-4 text-sm text-emerald-400">
                    {selectedCreatorIds.length} creator{selectedCreatorIds.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
            )}
            
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="border-t border-white/10 px-8 py-6 bg-[#0A0A0A]/95">
          <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
            <button
              type="button"
              onClick={currentStep === 1 ? () => navigate(-1) : prevStep}
              disabled={loading}
              className="px-6 py-3 text-gray-400 hover:text-white transition-all disabled:opacity-50"
            >
              {currentStep === 1 ? 'Cancel' : 'Back'}
            </button>

            <button
              type="button"
              onClick={currentStep === totalSteps ? handleSubmit : nextStep}
              disabled={!canProceed() || loading}
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : currentStep === totalSteps ? 'Create Campaign' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCampaignPage;
