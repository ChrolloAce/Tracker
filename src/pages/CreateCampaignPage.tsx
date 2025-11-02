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
  ChevronRight,
  Link as LinkIcon,
  Upload
} from 'lucide-react';
import { CampaignGoalType, CompensationType, CampaignReward, MetricGuarantee, CampaignType } from '../types/campaigns';
import CampaignService from '../services/CampaignService';
import OrganizationService from '../services/OrganizationService';
import RulesService from '../services/RulesService';
import { OrgMember } from '../types/firestore';
import { TrackingRule, RuleCondition, RuleConditionType } from '../types/rules';
import { clsx } from 'clsx';
import { Modal } from '../components/ui/Modal';

// Platform icon imports
import instagramIcon from '/Instagram_icon.png';
import tiktokIcon from '/TiktokLogo.png';
import youtubeIcon from '/Youtube_shorts_icon.svg.png';
import xLogo from '/twitter-x-logo.png';

// Resource type
interface CampaignResource {
  type: 'text' | 'link' | 'media';
  content: string;
  url?: string;
  fileName?: string;
}

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

// Get platform icon
const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case 'instagram': return instagramIcon;
    case 'tiktok': return tiktokIcon;
    case 'youtube': return youtubeIcon;
    case 'twitter': return xLogo;
    default: return null;
  }
};

const CreateCampaignPage: React.FC = () => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const navigate = useNavigate();
  
  // Current step (1-6)
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;
  
  // Form data
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [resources, setResources] = useState<CampaignResource[]>([]);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [currentResource, setCurrentResource] = useState('');
  const [currentResourceType, setCurrentResourceType] = useState<'text' | 'link' | 'media'>('text');
  const [currentResourceUrl, setCurrentResourceUrl] = useState('');
  const [currentRequirement, setCurrentRequirement] = useState('');
  const [coverImage] = useState<string>('');
  const [campaignType, setCampaignType] = useState<CampaignType>('individual');
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
  const [showCreateRuleModal, setShowCreateRuleModal] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [conditions, setConditions] = useState<RuleCondition[]>([
    { id: Date.now().toString(), type: 'description_contains', value: '', operator: 'AND' }
  ]);
  
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

  // Rule condition management
  const addCondition = () => {
    setConditions([...conditions, {
      id: Date.now().toString(),
      type: 'description_contains',
      value: '',
      operator: 'AND'
    }]);
  };

  const updateCondition = (id: string, field: keyof RuleCondition, value: any) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeCondition = (id: string) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter(c => c.id !== id));
    }
  };

  const handleCreateRule = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;
    if (!newRuleName.trim()) {
      setError('Rule name is required');
      return;
    }

    try {
      const ruleId = await RulesService.createRule(currentOrgId, currentProjectId, user.uid, {
        name: newRuleName.trim(),
        conditions: conditions.filter(c => String(c.value).trim()),
        appliesTo: {
          platforms: selectedPlatforms as any[],
          accountIds: []
        },
        isActive: true,
      });

      await loadRules();
      setDefaultRuleId(ruleId);
      setShowCreateRuleModal(false);
      setNewRuleName('');
      setConditions([{ id: Date.now().toString(), type: 'description_contains', value: '', operator: 'AND' }]);
      setError('');
    } catch (error: any) {
      console.error('Failed to create rule:', error);
      setError(error.message || 'Failed to create rule');
    }
  };

  // Number formatting helper
  const formatNumber = (value: number): string => {
    return value.toLocaleString('en-US');
  };

  const parseFormattedNumber = (value: string): number => {
    return parseInt(value.replace(/,/g, '')) || 0;
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
      case 2: return true; // Description, resources, and requirements are optional
      case 3: return startDate !== '' && (durationType === 'indefinite' || durationValue > 0);
      case 4: return true; // Goals are optional
      case 5: return true;
      case 6: return selectedCreatorIds.length > 0;
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
    <div className="min-h-screen bg-[#FAFAFB] flex">
      {/* Left Panel - Dotted Black Grid */}
      <div className="hidden lg:flex lg:w-1/2 bg-black relative overflow-hidden">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 flex items-center gap-2 text-white/70 hover:text-white transition-colors z-10"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Campaigns</span>
        </button>
        
        {/* Dotted Background Pattern */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle, #FFFFFF 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />

          {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 py-20">
          <div className="max-w-lg">
            <div className="mb-8">
              <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
                Create Your Campaign
              </h1>
              <p className="text-white/60 text-lg">
                Design competitions or challenges that motivate your creators and reward excellence.
              </p>
            </div>

            {/* Progress Steps */}
            <div className="mt-12">
              <div className="flex items-center gap-2 mb-4">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={clsx(
                      "h-1 flex-1 rounded-full transition-all duration-300",
                      i + 1 <= currentStep ? 'bg-white' : 'bg-white/20'
                    )}
                  />
                ))}
              </div>
              <p className="text-white/40 text-sm">
                Step {currentStep} of {totalSteps}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form Content */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-2xl">
          {/* Mobile Header */}
          <div className="lg:hidden mb-8">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Campaign</h1>
            <div className="flex items-center gap-2 mt-4">
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <div key={s} className={clsx(
                  "h-2 rounded-full transition-all duration-300",
                  s === currentStep ? "w-12 bg-black" : s < currentStep ? "w-8 bg-gray-400" : "w-8 bg-gray-300"
                )} />
              ))}
            </div>
          </div>

          {/* Form Card */}
          <div className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Step 1: Campaign Basics */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Campaign Basics</h2>
                  <p className="text-gray-600">Set up the foundation of your campaign</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaign Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Summer Challenge 2024"
                    className="w-full px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black transition-colors"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaign Type
                  </label>
                  <select
                    value={campaignType}
                    onChange={(e) => setCampaignType(e.target.value as CampaignType)}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 focus:outline-none focus:border-black transition-colors"
                  >
                    <option value="competition">Competition - Campaign-level goal with leaderboard</option>
                    <option value="individual">Individual - Personal goals for each creator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Platforms
                  </label>
                  <div className="flex gap-3">
                    {['instagram', 'tiktok', 'youtube', 'twitter'].map((platform) => (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => togglePlatform(platform)}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                          selectedPlatforms.includes(platform)
                            ? 'bg-black border-black text-white'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {getPlatformIcon(platform) && (
                          <img 
                            src={getPlatformIcon(platform)!} 
                            alt={platform}
                            className="w-5 h-5 object-contain"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Description, Resources & Requirements */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Details & Requirements</h2>
                  <p className="text-gray-600">Add campaign description, resources, and requirements</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the campaign goals, rules, and what creators can win..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 text-gray-900 placeholder-gray-400 bg-white resize-none"
                  />
                </div>

                {/* Resources */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resources
                  </label>
                  
                  {/* Resource Type Selector */}
                  <div className="flex gap-2 mb-3">
                    {(['text', 'link', 'media'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setCurrentResourceType(type)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          currentResourceType === type
                            ? 'bg-black text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {type === 'text' && 'Text'}
                        {type === 'link' && 'Link'}
                        {type === 'media' && 'Media'}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {currentResourceType === 'text' && (
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={currentResource}
                          onChange={(e) => setCurrentResource(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && currentResource.trim()) {
                              setResources([...resources, { type: 'text', content: currentResource.trim() }]);
                              setCurrentResource('');
                            }
                          }}
                          placeholder="Add a text resource (e.g., Brand guidelines)"
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 text-gray-900 placeholder-gray-400 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (currentResource.trim()) {
                              setResources([...resources, { type: 'text', content: currentResource.trim() }]);
                              setCurrentResource('');
                            }
                          }}
                          disabled={!currentResource.trim()}
                          className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {currentResourceType === 'link' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={currentResource}
                          onChange={(e) => setCurrentResource(e.target.value)}
                          placeholder="Link title"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 text-gray-900 placeholder-gray-400 bg-white"
                        />
                        <div className="flex gap-3">
                          <input
                            type="url"
                            value={currentResourceUrl}
                            onChange={(e) => setCurrentResourceUrl(e.target.value)}
                            placeholder="https://example.com/resource"
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 text-gray-900 placeholder-gray-400 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (currentResource.trim() && currentResourceUrl.trim()) {
                                setResources([...resources, { type: 'link', content: currentResource.trim(), url: currentResourceUrl.trim() }]);
                                setCurrentResource('');
                                setCurrentResourceUrl('');
                              }
                            }}
                            disabled={!currentResource.trim() || !currentResourceUrl.trim()}
                            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            <LinkIcon className="w-4 h-4" />
                            Add
                          </button>
                        </div>
                      </div>
                    )}

                    {currentResourceType === 'media' && (
                      <div className="flex gap-3">
                        <input
                          type="url"
                          value={currentResourceUrl}
                          onChange={(e) => setCurrentResourceUrl(e.target.value)}
                          placeholder="Media URL (e.g., https://example.com/image.png)"
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 text-gray-900 placeholder-gray-400 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (currentResourceUrl.trim()) {
                              const fileName = currentResourceUrl.split('/').pop() || 'Media file';
                              setResources([...resources, { type: 'media', content: fileName, url: currentResourceUrl.trim(), fileName }]);
                              setCurrentResourceUrl('');
                            }
                          }}
                          disabled={!currentResourceUrl.trim()}
                          className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                    )}
                  </div>

                  {resources.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {resources.map((resource, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {resource.type === 'text' && <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">TEXT</span>}
                            {resource.type === 'link' && <LinkIcon className="w-4 h-4 text-blue-600" />}
                            {resource.type === 'media' && <Upload className="w-4 h-4 text-green-600" />}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-900 truncate">{resource.content}</div>
                              {resource.url && (
                                <a 
                                  href={resource.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline truncate block"
                                >
                                  {resource.url}
                                </a>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setResources(resources.filter((_, i) => i !== index))}
                            className="text-red-400 hover:text-red-600 transition-colors ml-3"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Requirements */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Requirements
                  </label>
                  <div className="flex gap-3 mb-3">
                    <input
                      type="text"
                      value={currentRequirement}
                      onChange={(e) => setCurrentRequirement(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && currentRequirement.trim()) {
                          setRequirements([...requirements, currentRequirement.trim()]);
                          setCurrentRequirement('');
                        }
                      }}
                      placeholder="Add a requirement (e.g., Must use #BrandHashtag)"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 text-gray-900 placeholder-gray-400 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (currentRequirement.trim()) {
                          setRequirements([...requirements, currentRequirement.trim()]);
                          setCurrentRequirement('');
                        }
                      }}
                      disabled={!currentRequirement.trim()}
                      className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>

                  {requirements.length > 0 && (
                    <div className="space-y-2">
                      {requirements.map((requirement, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                        >
                          <span className="text-sm text-gray-900">{requirement}</span>
                          <button
                            type="button"
                            onClick={() => setRequirements(requirements.filter((_, i) => i !== index))}
                            className="text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Duration */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Campaign Duration</h2>
                  <p className="text-gray-600">Set how long your campaign will run</p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    Duration Type <span className="text-red-500">*</span>
                    <Tooltip content="Set how long the campaign will run">
                      <Info className="w-4 h-4 text-gray-400" />
                    </Tooltip>
                  </label>
                  <select
                    value={durationType}
                    onChange={(e) => setDurationType(e.target.value as any)}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 focus:outline-none focus:border-black transition-colors"
                  >
                    <option value="indefinite">Indefinite (No end date)</option>
                    <option value="days">Custom Days</option>
                    <option value="weeks">Custom Weeks</option>
                  </select>
                </div>

                {durationType !== 'indefinite' && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      Duration Length
                    </label>
                    <input
                      type="number"
                      value={durationValue}
                      onChange={(e) => setDurationValue(Number(e.target.value))}
                      min="1"
                      className="w-full px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                )}

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 focus:outline-none focus:border-black transition-colors"
                  />
                </div>

                {durationType === 'indefinite' ? (
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
                )}
              </div>
            )}

            {/* Step 4: Goals & Rules */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Goals & Tracking</h2>
                  <p className="text-gray-600">Define success metrics and tracking rules</p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    Goal Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value as CampaignGoalType)}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 focus:outline-none focus:border-black transition-colors"
                  >
                    <option value="total_views">Total Views</option>
                    <option value="total_engagement">Total Engagement</option>
                    <option value="avg_engagement_rate">Average Engagement Rate</option>
                    <option value="total_likes">Total Likes</option>
                    <option value="video_count">Video Count</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    Goal Target
                  </label>
                  <input
                    type="text"
                    value={formatNumber(goalAmount)}
                    onChange={(e) => setGoalAmount(parseFormattedNumber(e.target.value))}
                    placeholder="1,000,000"
                    className="w-full px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 focus:outline-none focus:border-black transition-colors"
                  />
                </div>

                {/* Tracking Rule */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Tracking Rule (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCreateRuleModal(true)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Create Rule
                    </button>
                  </div>

                  <select
                    value={defaultRuleId}
                    onChange={(e) => setDefaultRuleId(e.target.value)}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 focus:outline-none focus:border-black transition-colors"
                  >
                    <option value="">No rule (manual tracking)</option>
                    {rules.map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {rule.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Metric Guarantees */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Minimum Requirements (Optional)</label>
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
                        type="text"
                        value={formatNumber(guarantee.minValue)}
                        onChange={(e) => updateMetricGuarantee(guarantee.id, { minValue: parseFormattedNumber(e.target.value) })}
                        placeholder="10,000"
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

            {/* Step 5: Rewards */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Rewards & Compensation</h2>
                  <p className="text-gray-600">Set up how creators will be compensated</p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    Compensation Type
                  </label>
                  <select
                    value={compensationType}
                    onChange={(e) => setCompensationType(e.target.value as CompensationType)}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 focus:outline-none focus:border-black transition-colors"
                  >
                    <option value="none">No base compensation</option>
                    <option value="flat_cpm">CPM (Per 1000 views)</option>
                    <option value="flat_per_video">Flat rate per video</option>
                  </select>
                </div>

                {compensationType !== 'none' && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      Amount ($)
                    </label>
                    <input
                      type="text"
                      value={formatNumber(compensationAmount)}
                      onChange={(e) => setCompensationAmount(parseFormattedNumber(e.target.value))}
                      placeholder="1,000"
                      className="w-full px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                )}

                {/* Position Rewards - Only for Competition Campaigns */}
                {campaignType === 'competition' && (
                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-700">Position Rewards</label>
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
                          type="text"
                          value={formatNumber(reward.amount)}
                          onChange={(e) => updateReward(index, 'amount', parseFormattedNumber(e.target.value))}
                          placeholder="1,000"
                          className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm bg-white"
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
                )}
              </div>
            )}

            {/* Step 6: Select Creators */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Select Creators</h2>
                  <p className="text-gray-600">Choose which creators can participate</p>
                </div>

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

            {/* Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              {currentStep > 1 ? (
                <button
                  onClick={prevStep}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50 font-medium"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  Back
                </button>
              ) : (
                <div />
              )}

              {currentStep < totalSteps ? (
                <button
                  onClick={nextStep}
                  disabled={!canProceed() || loading}
                  className="flex items-center gap-2 px-8 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!canProceed() || loading}
                  className="px-8 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold shadow-lg"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Create Campaign</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rule Creation Modal */}
      <Modal
        isOpen={showCreateRuleModal}
        onClose={() => setShowCreateRuleModal(false)}
        title="Create Tracking Rule"
      >
        <div className="space-y-6">
          {/* Rule Name */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Rule Name
            </label>
            <input
              type="text"
              value={newRuleName}
              onChange={(e) => setNewRuleName(e.target.value)}
              placeholder="e.g., Track #BrandHashtag posts"
              className="w-full px-4 py-3 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
            />
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-white">
                Conditions
              </label>
              <button
                type="button"
                onClick={addCondition}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Condition
              </button>
            </div>

            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div key={condition.id} className="space-y-2">
                  {index > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={conditions[index - 1].operator || 'AND'}
                        onChange={(e) => updateCondition(conditions[index - 1].id, 'operator', e.target.value as 'AND' | 'OR')}
                        className="px-3 py-1.5 text-sm border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                    </div>
                  )}
                  
                  <div className="flex gap-2 items-start p-3 border border-gray-700 rounded-lg bg-gray-800/50">
                    <select
                      value={condition.type}
                      onChange={(e) => updateCondition(condition.id, 'type', e.target.value as RuleConditionType)}
                      className="flex-1 px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
                    >
                      <option value="description_contains">Description contains</option>
                      <option value="description_not_contains">Description does not contain</option>
                      <option value="hashtag_includes">Hashtag includes</option>
                      <option value="hashtag_not_includes">Hashtag does not include</option>
                      <option value="views_greater_than">Views greater than</option>
                      <option value="views_less_than">Views less than</option>
                      <option value="likes_greater_than">Likes greater than</option>
                      <option value="engagement_rate_greater_than">Engagement rate &gt;</option>
                      <option value="posted_after_date">Posted after date</option>
                      <option value="posted_before_date">Posted before date</option>
                    </select>

                    <input
                      type={
                        condition.type.includes('date') ? 'date' :
                        condition.type.includes('greater') || condition.type.includes('less') ? 'text' :
                        'text'
                      }
                      value={condition.type.includes('greater') || condition.type.includes('less') && !condition.type.includes('date') ? 
                        (condition.value ? formatNumber(typeof condition.value === 'number' ? condition.value : parseInt(String(condition.value))) : '') : 
                        String(condition.value)
                      }
                      onChange={(e) => {
                        const value = (condition.type.includes('greater') || condition.type.includes('less')) && !condition.type.includes('date')
                          ? parseFormattedNumber(e.target.value).toString()
                          : e.target.value;
                        updateCondition(condition.id, 'value', value);
                      }}
                      placeholder={
                        condition.type.includes('description') ? 'e.g., @brand or product name' :
                        condition.type.includes('hashtag') ? 'e.g., #ad or #sponsored' :
                        condition.type.includes('views') || condition.type.includes('likes') ? 'e.g., 10,000' :
                        'Value'
                      }
                      className="flex-1 px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
                    />

                    {conditions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCondition(condition.id)}
                        className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowCreateRuleModal(false)}
              className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateRule}
              disabled={!newRuleName.trim()}
              className="flex-1 px-6 py-3 bg-white hover:bg-gray-200 text-black rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Rule
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CreateCampaignPage;
