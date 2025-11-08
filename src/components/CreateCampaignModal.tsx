import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  X, 
  Plus, 
  Trash2,
  ChevronRight,
  ChevronLeft,
  Check,
  Upload,
  Target,
  Instagram,
  Music,
  Youtube,
  Twitter
} from 'lucide-react';
import { CampaignGoalType, CompensationType, CampaignReward, MetricGuarantee, CampaignType, CompensationStructure } from '../types/campaigns';
import CampaignService from '../services/CampaignService';
import OrganizationService from '../services/OrganizationService';
import RulesService from '../services/RulesService';
import CompensationBuilder from './CompensationBuilder';
import PayoutStructureManager from './PayoutStructureManager';
import CampaignCompetitionManager from './CampaignCompetitionManager';
import { OrgMember } from '../types/firestore';
import { TrackingRule } from '../types/rules';
import FirebaseStorageService from '../services/FirebaseStorageService';
import type { PayoutStructure, CampaignCreatorAssignment, CampaignCompetition } from '../types/payouts';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Platform icons mapping
const platformIcons: Record<string, React.ComponentType<any>> = {
  instagram: Instagram,
  tiktok: Music,
  youtube: Youtube,
  twitter: Twitter,
};

const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  
  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [campaignType, setCampaignType] = useState<'competition' | 'individual'>('competition');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'tiktok', 'youtube']);
  
  // Step 2: Duration
  const [durationType, setDurationType] = useState<'days' | 'weeks' | 'indefinite'>('indefinite');
  const [durationValue, setDurationValue] = useState<number>(4);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  
  // Step 3: Goal
  const [goalType, setGoalType] = useState<CampaignGoalType>('total_views');
  const [goalAmount, setGoalAmount] = useState<number>(1000000);
  const [metricGuarantees, setMetricGuarantees] = useState<MetricGuarantee[]>([]);
  const [defaultRuleId, setDefaultRuleId] = useState<string>('');
  const [rules, setRules] = useState<TrackingRule[]>([]);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleKeywords, setNewRuleKeywords] = useState('');
  
  // Step 4: Rewards & Compensation
  const [compensationType, setCompensationType] = useState<CompensationType>('flexible'); // NEW: Default to flexible
  const [compensationAmount, setCompensationAmount] = useState<number>(0);
  const [compensationStructure, setCompensationStructure] = useState<CompensationStructure>({
    rules: [],
    notes: ''
  });
  const [rewards, setRewards] = useState<CampaignReward[]>([
    { position: 1, amount: 500, description: '1st Place' },
    { position: 2, amount: 300, description: '2nd Place' },
    { position: 3, amount: 200, description: '3rd Place' }
  ]);
  
  // NEW: Flexible Payout System
  const [payoutMode, setPayoutMode] = useState<'legacy' | 'flexible'>('flexible');
  const [selectedPayoutStructure, setSelectedPayoutStructure] = useState<PayoutStructure | null>(null);
  const [creatorAssignments, setCreatorAssignments] = useState<CampaignCreatorAssignment[]>([]);
  const [defaultPayoutStructureId, setDefaultPayoutStructureId] = useState<string>('');
  const [competitions, setCompetitions] = useState<CampaignCompetition[]>([]);
  
  // Step 5: Participants
  const [availableCreators, setAvailableCreators] = useState<OrgMember[]>([]);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && currentOrgId && currentProjectId) {
      loadCreators();
      loadRules();
      setCurrentStep(1);
    }
  }, [isOpen, currentOrgId, currentProjectId]);

  const loadRules = async () => {
    if (!currentOrgId || !currentProjectId) return;
    
    try {
      const rulesData = await RulesService.getRules(currentOrgId, currentProjectId);
      setRules(rulesData);
    } catch (error) {
      console.error('Failed to load rules:', error);
    }
  };

  // Auto-calculate end date
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

  const loadCreators = async () => {
    if (!currentOrgId || !currentProjectId) {
      console.error('❌ Missing org or project ID:', { currentOrgId, currentProjectId });
      return;
    }
    
    console.log('🔍 Loading creators for campaign...', { currentOrgId, currentProjectId });
    setLoadingCreators(true);
    
    try {
      const members = await OrganizationService.getOrgMembers(currentOrgId);
      console.log('✅ Loaded all members:', members.length);
      
      // Filter to only show creators (not admin/owner team members)
      const creators = members.filter(m => m.role === 'creator');
      console.log('📊 Filtered creators:', creators.length);
      
      if (creators.length > 0) {
        console.log('👥 Creator details:', creators.map(m => ({ 
          userId: m.userId, 
          name: m.displayName || 'No name', 
          email: m.email, 
          role: m.role 
        })));
      }
      
      setAvailableCreators(creators);
    } catch (error) {
      console.error('❌ Failed to load creators:', error);
      setError('Failed to load creators. Please try again.');
    } finally {
      setLoadingCreators(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentOrgId || !currentProjectId || !user) {
      setError('Missing organization or project context');
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
        compensationType: payoutMode === 'flexible' ? 'flexible' : compensationType,
        compensationStructure: payoutMode === 'legacy' ? compensationStructure : undefined, // Legacy compensation
        rewards: payoutMode === 'legacy' ? rewards : [],
        bonusRewards: [],
        metricGuarantees,
        defaultRuleIds: defaultRuleId ? [defaultRuleId] : undefined,
        participantIds: selectedCreatorIds,
        
        // NEW: Flexible Payout System fields
        useFlexiblePayouts: payoutMode === 'flexible',
        defaultPayoutStructureId: payoutMode === 'flexible' ? defaultPayoutStructureId : undefined,
        creatorAssignments: payoutMode === 'flexible' ? creatorAssignments : undefined,
        competitionIds: payoutMode === 'flexible' && competitions.length > 0 ? competitions.map(c => c.id) : undefined,
      };
      
      // Legacy: Only add compensationAmount if using old system
      if (payoutMode === 'legacy' && compensationType !== 'none' && compensationType !== 'flexible' && compensationAmount > 0) {
        campaignData.compensationAmount = compensationAmount;
      }
      
      console.log('📤 Creating campaign:', campaignData);
      
      await CampaignService.createCampaign(
        currentOrgId,
        currentProjectId,
        user.uid,
        campaignData
      );

      onSuccess();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Failed to create campaign:', error);
      setError('Failed to create campaign. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setName('');
    setDescription('');
    setCoverImage('');
    setCampaignType('competition');
    setSelectedPlatforms(['instagram', 'tiktok', 'youtube']);
    setDurationType('weeks');
    setDurationValue(4);
    setStartDate('');
    setEndDate('');
    setGoalType('total_views');
    setGoalAmount(1000000);
    setMetricGuarantees([]);
    setCompensationType('none');
    setCompensationAmount(0);
    setRewards([
      { position: 1, amount: 500, description: '1st Place' },
      { position: 2, amount: 300, description: '2nd Place' },
      { position: 3, amount: 200, description: '3rd Place' }
    ]);
    setSelectedCreatorIds([]);
    setError('');
  };

  const getPlaceLabel = (position: number) => {
    switch(position) {
      case 1: return '1st Place';
      case 2: return '2nd Place';
      case 3: return '3rd Place';
      case 4: return '4th Place';
      case 5: return '5th Place';
      default: return `${position}th Place`;
    }
  };

  const nextStep = () => {
    setError('');
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    setError('');
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
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

  const addReward = () => {
    const nextPosition = rewards.length + 1;
    setRewards([...rewards, { position: nextPosition, amount: 0, description: getPlaceLabel(nextPosition) }]);
  };

  const removeReward = (index: number) => {
    setRewards(rewards.filter((_, i) => i !== index));
  };

  const updateReward = (index: number, field: keyof CampaignReward, value: any) => {
    const updated = [...rewards];
    updated[index] = { ...updated[index], [field]: value };
    setRewards(updated);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentOrgId) return;

    setUploadingImage(true);
    try {
      const imageUrl = await FirebaseStorageService.downloadAndUpload(
        currentOrgId,
        URL.createObjectURL(file),
        `campaign_${Date.now()}`,
        'profile'
      );
      setCoverImage(imageUrl);
    } catch (error) {
      console.error('Failed to upload image:', error);
      setError('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
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

  const toggleCreator = (creatorId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    console.log('🔘 Toggling creator:', creatorId);
    console.log('📋 Before:', selectedCreatorIds);
    
    setSelectedCreatorIds(prev => {
      const newSelection = prev.includes(creatorId)
        ? prev.filter(id => id !== creatorId)
        : [...prev, creatorId];
      
      console.log('📋 After:', newSelection);
      return newSelection;
    });
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
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

      // Reload rules and select the new one
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

  if (!isOpen) return null;

  const stepTitles = [
    'Basic Information',
    'Campaign Duration',
    'Goal Configuration',
    'Rewards & Compensation',
    'Select Creators'
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-6xl rounded-2xl border border-white/10 overflow-hidden flex flex-col my-8 max-h-[90vh]"
        style={{ backgroundColor: '#121214' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Steps - Fixed at top */}
        <div className="border-b border-white/10 px-6 py-4 flex-shrink-0" style={{ backgroundColor: '#121214' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Create Campaign</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    step < currentStep 
                      ? 'bg-emerald-500 text-white' 
                      : step === currentStep
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/10 text-gray-500'
                  }`}>
                    {step < currentStep ? <Check className="w-4 h-4" /> : step}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 hidden md:block text-center">
                    {stepTitles[step - 1].split(' ')[0]}
                  </div>
                </div>
                {step < 5 && (
                  <div className={`h-0.5 flex-1 mx-2 ${
                    step < currentStep ? 'bg-emerald-500' : 'bg-white/10'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content - Scrollable with custom scrollbar */}
        <div 
          className="p-6 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20" 
          style={{ minHeight: '400px' }}
        >
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <h3 className="text-xl font-bold text-white mb-6">{stepTitles[currentStep - 1]}</h3>

          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {/* Campaign Name and Cover Image - Horizontally aligned */}
              <div className="flex gap-4 items-start">
                {/* Cover Image - Small Square */}
                <div className="flex-shrink-0">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Cover
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
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Campaign Name *
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
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Campaign Type *
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

              {/* Platform Selection - All in one row */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Platforms *
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
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Public Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the campaign goals, rules, and what creators can win..."
                  rows={4}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">This will be visible to all participants</p>
              </div>
            </div>
          )}

          {/* Step 2: Duration */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Campaign Duration *
                </label>
                <select
                  value={durationType}
                  onChange={(e) => setDurationType(e.target.value as 'days' | 'weeks' | 'indefinite')}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="indefinite">Indefinite (No end date)</option>
                  <option value="days">Custom Days</option>
                  <option value="weeks">Custom Weeks</option>
                </select>
              </div>

              {durationType !== 'indefinite' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Duration Length
                  </label>
                  <input
                    type="number"
                    value={durationValue}
                    onChange={(e) => setDurationValue(Number(e.target.value))}
                    min="1"
                    placeholder={durationType === 'weeks' ? 'e.g., 4' : 'e.g., 30'}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the number of {durationType} for this campaign
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {durationType === 'indefinite' ? (
                <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="text-sm text-blue-400">
                    <span className="font-semibold">Duration:</span> Indefinite
                  </div>
                  <div className="text-xs text-blue-400/70 mt-1">
                    Campaign will run continuously with no end date
                  </div>
                </div>
              ) : endDate && (
                <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <div className="text-sm text-emerald-400">
                    <span className="font-semibold">End Date:</span> {new Date(endDate).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </div>
                  <div className="text-xs text-emerald-400/70 mt-1">
                    Campaign will run for {durationType === 'weeks' ? `${durationValue} week${durationValue !== 1 ? 's' : ''}` : `${durationValue} day${durationValue !== 1 ? 's' : ''}`}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Goal */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Goal Type *
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
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Goal Target *
                </label>
                <input
                  type="number"
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(Number(e.target.value))}
                  min="0"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {goalType === 'total_views' && `Target: ${goalAmount.toLocaleString()} total views`}
                  {goalType === 'video_count' && `Target: ${goalAmount} videos`}
                  {goalType === 'total_engagement' && `Target: ${goalAmount.toLocaleString()} total engagements`}
                </p>
              </div>

              {/* Metric Guarantees */}
              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="text-sm font-medium text-gray-400 block">
                      Metric Guarantees (Optional)
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Set minimum requirements per video
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addMetricGuarantee}
                    className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Requirement
                  </button>
                </div>

                {metricGuarantees.length > 0 && (
                  <div className="space-y-2">
                    {metricGuarantees.map((guarantee) => (
                      <div key={guarantee.id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                        <select
                          value={guarantee.metric}
                          onChange={(e) => updateMetricGuarantee(guarantee.id, { metric: e.target.value as any })}
                          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                        >
                          <option value="views">Views</option>
                          <option value="likes">Likes</option>
                          <option value="comments">Comments</option>
                          <option value="shares">Shares</option>
                          <option value="engagement_rate">Engagement Rate %</option>
                        </select>
                        
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-gray-400 text-sm">Min:</span>
                          <input
                            type="number"
                            value={guarantee.minValue}
                            onChange={(e) => updateMetricGuarantee(guarantee.id, { minValue: Number(e.target.value) })}
                            min="0"
                            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeMetricGuarantee(guarantee.id)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {metricGuarantees.length === 0 && (
                  <div className="text-center py-6 text-gray-500 text-sm border-2 border-dashed border-white/10 rounded-lg">
                    No requirements set. Click "Add Requirement" to add minimum metrics.
                  </div>
                )}
              </div>

              {/* Tracking Rules */}
              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="text-sm font-medium text-gray-400 block flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Tracking Rules (Optional)
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Select rules to track videos for this campaign
                    </p>
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

                {/* Create New Rule Form */}
                {showCreateRule && (
                  <div className="mb-4 p-4 bg-white/5 border border-white/10 rounded-lg space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        Rule Name
                      </label>
                      <input
                        type="text"
                        value={newRuleName}
                        onChange={(e) => setNewRuleName(e.target.value)}
                        placeholder="e.g., My Campaign Videos"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        Keywords (Optional)
                      </label>
                      <input
                        type="text"
                        value={newRuleKeywords}
                        onChange={(e) => setNewRuleKeywords(e.target.value)}
                        placeholder="keyword1, keyword2, keyword3"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                      />
                      <p className="text-xs text-gray-500 mt-1">Separate with commas</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCreateRule}
                        className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-all"
                      >
                        Create Rule
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateRule(false);
                          setNewRuleName('');
                          setNewRuleKeywords('');
                        }}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm border border-white/10 rounded-lg transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Rule Selection Dropdown */}
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
                
                {defaultRuleId && (
                  <div className="text-xs text-emerald-400 mt-2">
                    ✓ Videos matching this rule will be automatically tracked
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Rewards & Payouts */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {/* Payout Mode Toggle */}
              <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPayoutMode('flexible')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    payoutMode === 'flexible'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  💰 Flexible Payouts (New)
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutMode('legacy')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    payoutMode === 'legacy'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🏆 Position Rewards (Legacy)
                </button>
              </div>

              {/* Flexible Payouts UI */}
              {payoutMode === 'flexible' && (
                <div className="space-y-6">
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm text-blue-400">
                      <strong>Flexible Payouts:</strong> Create reusable payout templates with any combination of base pay, CPM, bonuses, and caps. Assign different structures to each creator.
                    </p>
                  </div>

                  <PayoutStructureManager
                    orgId={currentOrgId!}
                    projectId={currentProjectId!}
                    userId={user!.uid}
                    onSelect={(structure) => {
                      setSelectedPayoutStructure(structure);
                      setDefaultPayoutStructureId(structure.id);
                    }}
                    selectedStructureId={defaultPayoutStructureId}
                  />

                  {selectedPayoutStructure && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <p className="text-sm text-green-400">
                        ✓ <strong>{selectedPayoutStructure.name}</strong> will be used as the default payout structure for all creators in this campaign. You can customize per-creator after adding participants.
                      </p>
                    </div>
                  )}

                  {/* Competitions */}
                  <div className="pt-4 border-t border-white/10">
                    <CampaignCompetitionManager
                      competitions={competitions}
                      onChange={setCompetitions}
                      campaignStartDate={startDate ? new Date(startDate) : new Date()}
                      campaignEndDate={endDate ? new Date(endDate) : undefined}
                    />
                  </div>
                </div>
              )}

              {/* Legacy Mode UI */}
              {payoutMode === 'legacy' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-400">
                        Position Rewards
                      </label>
                      <button
                        type="button"
                        onClick={addReward}
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Place
                      </button>
                    </div>

                    <div className="space-y-2">
                      {rewards.map((reward, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-lg">
                            <div className="text-white font-medium min-w-[80px]">
                              {getPlaceLabel(reward.position)}
                            </div>
                            <div className="flex items-center flex-1">
                              <span className="text-gray-400 mr-2">$</span>
                              <input
                                type="number"
                                value={reward.amount}
                                onChange={(e) => updateReward(index, 'amount', Number(e.target.value))}
                                placeholder="Amount"
                                min="0"
                                step="10"
                                className="flex-1 bg-transparent text-white focus:outline-none"
                              />
                            </div>
                          </div>
                          {rewards.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeReward(index)}
                              className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <CompensationBuilder
                      value={compensationStructure}
                      onChange={setCompensationStructure}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Select Creators */}
          {currentStep === 5 && (
            <div className="space-y-4">
              {loadingCreators ? (
                <div className="text-center py-12">
                  <div className="inline-block w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-gray-400">Loading team members...</p>
                </div>
              ) : (
                <>
                  <div className="text-sm text-gray-400 mb-3">
                    Selected: {selectedCreatorIds.length} / {availableCreators.length}
                  </div>

                  {availableCreators.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {availableCreators.map((creator) => {
                        const isSelected = selectedCreatorIds.includes(creator.userId);
                        return (
                          <button
                            key={creator.userId}
                            type="button"
                            onClick={(e) => toggleCreator(creator.userId, e)}
                            className={`w-full px-4 py-3 rounded-lg border transition-all text-left flex items-center gap-3 ${
                              isSelected
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : 'bg-white/5 border-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected 
                                ? 'bg-emerald-500 border-emerald-500' 
                                : 'border-gray-500'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-medium truncate ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                                {creator.displayName || creator.email}
                              </div>
                              <div className="text-xs text-gray-500 truncate">{creator.email}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-white/5 border border-white/10 rounded-lg">
                      <p className="text-gray-400 font-medium mb-2">No team members found</p>
                      <p className="text-sm text-gray-500 mb-4">
                        Check the console for debugging info
                      </p>
                      <button
                        type="button"
                        onClick={loadCreators}
                        className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all"
                      >
                        Retry Loading
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation - Fixed at bottom */}
        <div className="border-t border-white/5 px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ backgroundColor: '#121214' }}>
          <button
            type="button"
            onClick={currentStep === 1 ? onClose : prevStep}
            className="px-4 py-2 text-gray-400 hover:text-white transition-all flex items-center gap-2"
            disabled={loading}
          >
            {currentStep === 1 ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                Back
              </>
            )}
          </button>

          <div className="text-sm text-gray-500">
            Step {currentStep} of {totalSteps}
          </div>

          <button
            type="button"
            onClick={currentStep === totalSteps ? handleSubmit : nextStep}
            disabled={!canProceed() || loading}
            className="px-6 py-2 bg-white/10 hover:bg-white/15 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl border border-white/20 hover:border-white/30 transition-all flex items-center gap-2"
          >
            {loading ? (
              'Creating...'
            ) : currentStep === totalSteps ? (
              'Create Campaign'
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateCampaignModal;
