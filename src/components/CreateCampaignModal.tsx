import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  X, 
  Plus, 
  Trash2,
  Calendar,
  Users,
  Target,
  DollarSign
} from 'lucide-react';
import { CampaignGoalType, CompensationType, CampaignReward, BonusReward } from '../types/campaigns';
import CampaignService from '../services/CampaignService';
import FirestoreDataService from '../services/FirestoreDataService';
import { OrgMember } from '../types/firestore';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  
  // Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Goal
  const [goalType, setGoalType] = useState<CampaignGoalType>('total_views');
  const [goalAmount, setGoalAmount] = useState<number>(1000000);
  
  // Compensation
  const [compensationType, setCompensationType] = useState<CompensationType>('none');
  const [compensationAmount, setCompensationAmount] = useState<number>(0);
  
  // Rewards
  const [rewards, setRewards] = useState<CampaignReward[]>([
    { position: 1, amount: 500, description: '1st Place' }
  ]);
  const [bonusRewards, setBonusRewards] = useState<BonusReward[]>([]);
  
  // Participants
  const [availableCreators, setAvailableCreators] = useState<OrgMember[]>([]);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && currentOrgId && currentProjectId) {
      loadCreators();
    }
  }, [isOpen, currentOrgId, currentProjectId]);

  const loadCreators = async () => {
    if (!currentOrgId || !currentProjectId) return;
    
    try {
      const members = await FirestoreDataService.getOrganizationMembers(currentOrgId);
      // Filter to only creators or members with creator role
      const creators = members.filter(m => m.role === 'creator' || m.role === 'member');
      setAvailableCreators(creators);
    } catch (error) {
      console.error('Failed to load creators:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentOrgId || !currentProjectId || !user) {
      setError('Missing organization or project context');
      return;
    }

    if (!name || !startDate || !endDate) {
      setError('Please fill in all required fields');
      return;
    }

    if (selectedCreatorIds.length === 0) {
      setError('Please select at least one creator');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await CampaignService.createCampaign(
        currentOrgId,
        currentProjectId,
        {
          name,
          description,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          goalType,
          goalAmount,
          compensationType,
          compensationAmount: compensationType !== 'none' ? compensationAmount : undefined,
          rewards,
          bonusRewards,
          participantIds: selectedCreatorIds,
        }
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
    setName('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setGoalType('total_views');
    setGoalAmount(1000000);
    setCompensationType('none');
    setCompensationAmount(0);
    setRewards([{ position: 1, amount: 500, description: '1st Place' }]);
    setBonusRewards([]);
    setSelectedCreatorIds([]);
    setError('');
  };

  const addReward = () => {
    const nextPosition = rewards.length + 1;
    setRewards([...rewards, { position: nextPosition, amount: 0, description: `${nextPosition}${getOrdinalSuffix(nextPosition)} Place` }]);
  };

  const removeReward = (index: number) => {
    setRewards(rewards.filter((_, i) => i !== index));
  };

  const updateReward = (index: number, field: keyof CampaignReward, value: any) => {
    const updated = [...rewards];
    updated[index] = { ...updated[index], [field]: value };
    setRewards(updated);
  };

  const addBonusReward = () => {
    setBonusRewards([...bonusRewards, { threshold: 0, amount: 0, description: '', type: 'views' }]);
  };

  const removeBonusReward = (index: number) => {
    setBonusRewards(bonusRewards.filter((_, i) => i !== index));
  };

  const updateBonusReward = (index: number, field: keyof BonusReward, value: any) => {
    const updated = [...bonusRewards];
    updated[index] = { ...updated[index], [field]: value };
    setBonusRewards(updated);
  };

  const toggleCreator = (creatorId: string) => {
    if (selectedCreatorIds.includes(creatorId)) {
      setSelectedCreatorIds(selectedCreatorIds.filter(id => id !== creatorId));
    } else {
      setSelectedCreatorIds([...selectedCreatorIds, creatorId]);
    }
  };

  const getOrdinalSuffix = (num: number) => {
    const j = num % 10, k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl my-8 rounded-2xl border border-white/10 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#121214' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-white/10 px-6 py-4" style={{ backgroundColor: '#121214' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Create Campaign</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Campaign Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Summer Growth Challenge"
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the campaign goals and rules..."
                rows={3}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  End Date *
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                  required
                />
              </div>
            </div>
          </div>

          {/* Goal Configuration */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-400" />
              Goal Configuration
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Goal Type
                </label>
                <select
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value as CampaignGoalType)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="total_views">Total Views</option>
                  <option value="total_engagement">Total Engagement</option>
                  <option value="avg_engagement_rate">Avg Engagement Rate</option>
                  <option value="total_likes">Total Likes</option>
                  <option value="video_count">Video Count</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Goal Amount
                </label>
                <input
                  type="number"
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Compensation */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Base Compensation
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Compensation Type
                </label>
                <select
                  value={compensationType}
                  onChange={(e) => setCompensationType(e.target.value as CompensationType)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="none">None (rewards only)</option>
                  <option value="flat_cpm">Flat CPM</option>
                  <option value="flat_fee_per_video">Flat Fee per Video</option>
                </select>
              </div>

              {compensationType !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    {compensationType === 'flat_cpm' ? 'CPM Rate ($)' : 'Fee per Video ($)'}
                  </label>
                  <input
                    type="number"
                    value={compensationAmount}
                    onChange={(e) => setCompensationAmount(Number(e.target.value))}
                    step="0.01"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                    min="0"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Rewards */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Position Rewards</h3>
              <button
                type="button"
                onClick={addReward}
                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Reward
              </button>
            </div>

            <div className="space-y-3">
              {rewards.map((reward, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <input
                      type="number"
                      value={reward.position}
                      onChange={(e) => updateReward(index, 'position', Number(e.target.value))}
                      placeholder="Position"
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50"
                      min="1"
                    />
                    <input
                      type="number"
                      value={reward.amount}
                      onChange={(e) => updateReward(index, 'amount', Number(e.target.value))}
                      placeholder="Amount ($)"
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50"
                      min="0"
                    />
                    <input
                      type="text"
                      value={reward.description}
                      onChange={(e) => updateReward(index, 'description', e.target.value)}
                      placeholder="Description"
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeReward(index)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Select Participants ({selectedCreatorIds.length} selected)
            </h3>

            <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
              {availableCreators.map((creator) => (
                <button
                  key={creator.id}
                  type="button"
                  onClick={() => toggleCreator(creator.id)}
                  className={`px-4 py-3 rounded-lg border transition-all text-left ${
                    selectedCreatorIds.includes(creator.id)
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  <div className="font-medium">{creator.displayName || creator.email}</div>
                  <div className="text-xs opacity-60">{creator.email}</div>
                </button>
              ))}
            </div>

            {availableCreators.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No creators available. Invite creators to your project first.
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-400 hover:text-white transition-all"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-all"
            >
              {loading ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCampaignModal;

