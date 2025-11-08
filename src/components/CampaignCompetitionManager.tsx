import { useState } from 'react';
import { Plus, X, Trophy, Target, TrendingUp, Shuffle, Trash2 } from 'lucide-react';
import type {
  CampaignCompetition,
  CampaignCompetitionType,
  PayoutMetric,
  CampaignCompetitionPrize
} from '../types/payouts';

interface CampaignCompetitionManagerProps {
  competitions: CampaignCompetition[];
  onChange: (competitions: CampaignCompetition[]) => void;
  campaignStartDate: Date;
  campaignEndDate?: Date;
}

export default function CampaignCompetitionManager({
  competitions,
  onChange,
  campaignStartDate,
  campaignEndDate
}: CampaignCompetitionManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<CampaignCompetition | null>(null);

  const handleCreateNew = () => {
    const newComp: CampaignCompetition = {
      id: `comp_${Date.now()}`,
      campaignId: '', // Will be set when campaign is created
      name: 'New Competition',
      description: '',
      metric: 'views',
      type: 'top_n',
      prizes: [
        { rank: 1, amount: 300, description: '1st Place' },
        { rank: 2, amount: 200, description: '2nd Place' },
        { rank: 3, amount: 100, description: '3rd Place' }
      ],
      n: 3,
      isActive: true,
      startDate: campaignStartDate,
      endDate: campaignEndDate || new Date(),
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    };

    setEditingCompetition(newComp);
    setIsCreating(true);
  };

  const handleSave = (competition: CampaignCompetition) => {
    if (isCreating) {
      onChange([...competitions, competition]);
    } else {
      onChange(competitions.map(c => c.id === competition.id ? competition : c));
    }
    setEditingCompetition(null);
    setIsCreating(false);
  };

  const handleDelete = (competitionId: string) => {
    onChange(competitions.filter(c => c.id !== competitionId));
  };

  if (editingCompetition) {
    return (
      <CompetitionEditor
        competition={editingCompetition}
        onSave={handleSave}
        onCancel={() => {
          setEditingCompetition(null);
          setIsCreating(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Campaign Competitions (Optional)
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Top performers, first to hit targets, random draws, etc.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateNew}
          className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Competition
        </button>
      </div>

      {/* Competitions List */}
      {competitions.length === 0 ? (
        <div className="text-center py-8 border border-white/10 rounded-lg bg-zinc-900/40 text-gray-500 text-sm">
          No competitions yet. Click "Add Competition" to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {competitions.map(competition => (
            <CompetitionCard
              key={competition.id}
              competition={competition}
              onEdit={() => {
                setEditingCompetition(competition);
                setIsCreating(false);
              }}
              onDelete={() => handleDelete(competition.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== COMPETITION CARD ====================

interface CompetitionCardProps {
  competition: CampaignCompetition;
  onEdit: () => void;
  onDelete: () => void;
}

function CompetitionCard({ competition, onEdit, onDelete }: CompetitionCardProps) {
  const typeIcons: Record<CampaignCompetitionType, any> = {
    top_n: Trophy,
    first_to_hit: Target,
    most_improved: TrendingUp,
    random_draw: Shuffle,
    consistency: Award,
    engagement_king: Users
  };

  const Icon = typeIcons[competition.type] || Trophy;
  const totalPrizePool = competition.prizes.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="p-4 bg-zinc-900/40 border border-white/10 rounded-lg">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Icon className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-white font-medium mb-1">{competition.name}</h4>
            {competition.description && (
              <p className="text-sm text-gray-400 mb-2">{competition.description}</p>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded">
                {competition.type.replace('_', ' ')}
              </span>
              <span className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded">
                {competition.metric}
              </span>
              <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded">
                ${totalPrizePool} prize pool
              </span>
              {competition.n && (
                <span className="px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded">
                  Top {competition.n}
                </span>
              )}
              {competition.targetValue && (
                <span className="px-2 py-1 bg-orange-500/10 text-orange-400 rounded">
                  Target: {competition.targetValue.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            type="button"
            onClick={onEdit}
            className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== COMPETITION EDITOR ====================

interface CompetitionEditorProps {
  competition: CampaignCompetition;
  onSave: (competition: CampaignCompetition) => void;
  onCancel: () => void;
}

function CompetitionEditor({ competition, onSave, onCancel }: CompetitionEditorProps) {
  const [name, setName] = useState(competition.name);
  const [description, setDescription] = useState(competition.description || '');
  const [type, setType] = useState<CampaignCompetitionType>(competition.type);
  const [metric, setMetric] = useState<PayoutMetric>(competition.metric);
  const [prizes, setPrizes] = useState<CampaignCompetitionPrize[]>(competition.prizes);
  const [n, setN] = useState(competition.n || 3);
  const [targetValue, setTargetValue] = useState(competition.targetValue || 100000);

  const metricOptions: PayoutMetric[] = ['views', 'likes', 'comments', 'shares', 'saves', 'videos_posted', 'engagement_rate'];

  const typeOptions: { value: CampaignCompetitionType; label: string; icon: any }[] = [
    { value: 'top_n', label: 'Top N Performers', icon: Trophy },
    { value: 'first_to_hit', label: 'First to Hit Target', icon: Target },
    { value: 'most_improved', label: 'Most Improved', icon: TrendingUp },
    { value: 'random_draw', label: 'Random Draw', icon: Shuffle }
  ];

  const addPrize = () => {
    setPrizes([
      ...prizes,
      { rank: prizes.length + 1, amount: 100, description: `${prizes.length + 1}${getRankSuffix(prizes.length + 1)} Place` }
    ]);
  };

  const removePrize = (index: number) => {
    setPrizes(prizes.filter((_, i) => i !== index));
  };

  const updatePrize = (index: number, updates: Partial<CampaignCompetitionPrize>) => {
    const updated = [...prizes];
    updated[index] = { ...updated[index], ...updates };
    setPrizes(updated);
  };

  const handleSave = () => {
    onSave({
      ...competition,
      name,
      description,
      type,
      metric,
      prizes,
      n: type === 'top_n' ? n : undefined,
      targetValue: type === 'first_to_hit' ? targetValue : undefined
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-white font-medium">
          {competition.id.startsWith('comp_') ? 'Create' : 'Edit'} Competition
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Basic Info */}
      <div className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Competition name"
          className="w-full px-4 py-2 bg-zinc-900/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full px-4 py-2 bg-zinc-900/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />

        {/* Type Selection */}
        <div className="grid grid-cols-2 gap-2">
          {typeOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={`p-3 rounded-lg border transition-all flex items-center gap-2 text-sm ${
                  type === option.value
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                <Icon className="w-4 h-4" />
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Metric Selection */}
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as PayoutMetric)}
          className="w-full px-4 py-2 bg-zinc-900/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {metricOptions.map(m => (
            <option key={m} value={m}>{m.replace('_', ' ')}</option>
          ))}
        </select>

        {/* Type-specific fields */}
        {type === 'top_n' && (
          <input
            type="number"
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            min="1"
            placeholder="Number of winners"
            className="w-full px-4 py-2 bg-zinc-900/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        )}

        {type === 'first_to_hit' && (
          <input
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(Number(e.target.value))}
            min="0"
            placeholder="Target value (e.g., 100,000 views)"
            className="w-full px-4 py-2 bg-zinc-900/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        )}
      </div>

      {/* Prizes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-400">Prizes</label>
          <button
            type="button"
            onClick={addPrize}
            className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg transition-all flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Prize
          </button>
        </div>

        <div className="space-y-2">
          {prizes.map((prize, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
                <span className="text-white/60 text-sm min-w-[50px]">
                  {prize.rank}{getRankSuffix(prize.rank)}
                </span>
                <span className="text-white/40">$</span>
                <input
                  type="number"
                  value={prize.amount}
                  onChange={(e) => updatePrize(index, { amount: Number(e.target.value) })}
                  min="0"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                  placeholder="Amount"
                />
              </div>
              {prizes.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePrize(index)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="text-xs text-gray-500">
          Total Prize Pool: ${prizes.reduce((sum, p) => sum + p.amount, 0)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-all"
        >
          Save Competition
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm rounded-lg transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ==================== HELPERS ====================

function getRankSuffix(rank: number): string {
  const lastDigit = rank % 10;
  const lastTwoDigits = rank % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return 'th';
  }

  switch (lastDigit) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

