import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  X, 
  Plus, 
  Trash2,
  ChevronRight,
  ChevronLeft,
  Check
} from 'lucide-react';
import { CampaignGoalType, CompensationType, CampaignReward } from '../types/campaigns';
import CampaignService from '../services/CampaignService';
import OrganizationService from '../services/OrganizationService';
import { OrgMember } from '../types/firestore';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  
  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // Step 2: Duration
  const [durationType, setDurationType] = useState<'days' | 'weeks'>('weeks');
  const [durationValue, setDurationValue] = useState<number>(4);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Step 3: Goal
  const [goalType, setGoalType] = useState<CampaignGoalType>('total_views');
  const [goalAmount, setGoalAmount] = useState<number>(1000000);
  
  // Step 4: Rewards & Compensation
  const [compensationType, setCompensationType] = useState<CompensationType>('none');
  const [compensationAmount, setCompensationAmount] = useState<number>(0);
  const [rewards, setRewards] = useState<CampaignReward[]>([
    { position: 1, amount: 500, description: '1st Place' },
    { position: 2, amount: 300, description: '2nd Place' },
    { position: 3, amount: 200, description: '3rd Place' }
  ]);
  
  // Step 5: Participants
  const [availableCreators, setAvailableCreators] = useState<OrgMember[]>([]);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && currentOrgId && currentProjectId) {
      loadCreators();
      setCurrentStep(1);
    }
  }, [isOpen, currentOrgId, currentProjectId]);

  // Auto-calculate end date
  useEffect(() => {
    if (startDate && durationValue > 0) {
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
      const campaignData: any = {
        name,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        goalType,
        goalAmount,
        compensationType,
        rewards,
        bonusRewards: [],
        participantIds: selectedCreatorIds,
      };
      
      // Only add compensationAmount if it exists and compensationType is not 'none'
      if (compensationType !== 'none' && compensationAmount > 0) {
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
    setDurationType('weeks');
    setDurationValue(4);
    setStartDate('');
    setEndDate('');
    setGoalType('total_views');
    setGoalAmount(1000000);
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
      case 2: return startDate !== '' && durationValue > 0;
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: '#121214' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Steps */}
        <div className="border-b border-white/10 px-6 py-4" style={{ backgroundColor: '#121214' }}>
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

        {/* Content */}
        <div className="p-6" style={{ minHeight: '400px' }}>
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <h3 className="text-xl font-bold text-white mb-6">{stepTitles[currentStep - 1]}</h3>

          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
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
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={durationValue}
                    onChange={(e) => setDurationValue(Number(e.target.value))}
                    min="1"
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                  />
                  <select
                    value={durationType}
                    onChange={(e) => setDurationType(e.target.value as 'days' | 'weeks')}
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                  </select>
                </div>
              </div>

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

              {endDate && (
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
            </div>
          )}

          {/* Step 4: Rewards */}
          {currentStep === 4 && (
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

              <div className="pt-4 border-t border-white/5 space-y-3">
                <label className="text-sm font-medium text-gray-400">
                  Base Compensation (Optional)
                </label>
                
                <select
                  value={compensationType}
                  onChange={(e) => setCompensationType(e.target.value as CompensationType)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="none">None (rewards only)</option>
                  <option value="flat_cpm">Flat CPM (per 1000 views)</option>
                  <option value="flat_fee_per_video">Flat Fee per Video</option>
                </select>

                {compensationType !== 'none' && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-lg">
                    <span className="text-gray-400">$</span>
                    <input
                      type="number"
                      value={compensationAmount}
                      onChange={(e) => setCompensationAmount(Number(e.target.value))}
                      step="0.01"
                      min="0"
                      placeholder={compensationType === 'flat_cpm' ? 'e.g., 1.50' : 'e.g., 10.00'}
                      className="flex-1 bg-transparent text-white focus:outline-none"
                    />
                    <span className="text-gray-500 text-sm">
                      {compensationType === 'flat_cpm' ? 'per 1K views' : 'per video'}
                    </span>
                  </div>
                )}
              </div>
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

        {/* Footer Navigation */}
        <div className="border-t border-white/5 px-6 py-4 flex items-center justify-between">
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
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
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
