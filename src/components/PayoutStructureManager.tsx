import { useState, useEffect } from 'react';
import { Plus, X, Copy, Trash2, DollarSign, TrendingUp, Award, Zap, Target } from 'lucide-react';
import { PayoutStructureService } from '../services/PayoutStructureService';
import { PayoutCalculationEngine } from '../services/PayoutCalculationEngine';
import type { PayoutStructure, PayoutComponent, PayoutComponentType, PayoutMetric } from '../types/payouts';

interface PayoutStructureManagerProps {
  orgId: string;
  projectId: string;
  userId: string;
  onSelect?: (structure: PayoutStructure) => void;
  selectedStructureId?: string;
}

export default function PayoutStructureManager({
  orgId,
  projectId,
  userId,
  onSelect,
  selectedStructureId
}: PayoutStructureManagerProps) {
  const [structures, setStructures] = useState<PayoutStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingStructure, setEditingStructure] = useState<PayoutStructure | null>(null);

  useEffect(() => {
    loadStructures();
  }, [orgId, projectId]);

  const loadStructures = async () => {
    try {
      setLoading(true);
      const data = await PayoutStructureService.listStructures(orgId, projectId);
      setStructures(data);
    } catch (error) {
      console.error('Failed to load payout structures:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingStructure({
      id: '',
      organizationId: orgId,
      projectId: projectId,
      name: 'New Payout Structure',
      description: '',
      components: [],
      createdAt: new Date() as any,
      createdBy: userId,
      updatedAt: new Date() as any
    });
    setIsCreating(true);
  };

  const handleDuplicate = async (structure: PayoutStructure) => {
    try {
      const duplicated = await PayoutStructureService.duplicateStructure(
        orgId,
        projectId,
        userId,
        structure.id
      );
      setStructures([duplicated, ...structures]);
    } catch (error) {
      console.error('Failed to duplicate structure:', error);
      alert('Failed to duplicate structure');
    }
  };

  const handleDelete = async (structureId: string) => {
    if (!confirm('Are you sure you want to delete this payout structure?')) {
      return;
    }

    try {
      await PayoutStructureService.deleteStructure(orgId, projectId, structureId);
      setStructures(structures.filter(s => s.id !== structureId));
    } catch (error: any) {
      console.error('Failed to delete structure:', error);
      alert(error.message || 'Failed to delete structure');
    }
  };

  const handleSave = async (structure: PayoutStructure) => {
    // Validate
    const validation = PayoutStructureService.validateStructure(structure);
    if (!validation.valid) {
      alert('Validation errors:\n' + validation.errors.join('\n'));
      return;
    }

    try {
      if (isCreating) {
        const created = await PayoutStructureService.createStructure(
          orgId,
          projectId,
          userId,
          {
            name: structure.name,
            description: structure.description,
            components: structure.components,
            maxPayout: structure.maxPayout
          }
        );
        setStructures([created, ...structures]);
      } else {
        await PayoutStructureService.updateStructure(
          orgId,
          projectId,
          structure.id,
          {
            name: structure.name,
            description: structure.description,
            components: structure.components,
            maxPayout: structure.maxPayout
          }
        );
        setStructures(structures.map(s => s.id === structure.id ? structure : s));
      }

      setEditingStructure(null);
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to save structure:', error);
      alert('Failed to save structure');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white/60">Loading payout structures...</div>
      </div>
    );
  }

  if (editingStructure) {
    return (
      <StructureEditor
        structure={editingStructure}
        onSave={handleSave}
        onCancel={() => {
          setEditingStructure(null);
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
          <h3 className="text-lg font-semibold text-white">Payout Structures</h3>
          <p className="text-sm text-white/60">Create reusable payment templates</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Structure
        </button>
      </div>

      {/* Structures List */}
      {structures.length === 0 ? (
        <div className="text-center py-12 border border-white/10 rounded-lg bg-zinc-900/40">
          <DollarSign className="w-12 h-12 mx-auto text-white/40 mb-3" />
          <p className="text-white/60 mb-4">No payout structures yet</p>
          <button
            onClick={handleCreateNew}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Create your first payout structure →
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {structures.map(structure => (
            <StructureCard
              key={structure.id}
              structure={structure}
              isSelected={structure.id === selectedStructureId}
              onSelect={() => onSelect?.(structure)}
              onEdit={() => {
                setEditingStructure(structure);
                setIsCreating(false);
              }}
              onDuplicate={() => handleDuplicate(structure)}
              onDelete={() => handleDelete(structure.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== STRUCTURE CARD ====================

interface StructureCardProps {
  structure: PayoutStructure;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function StructureCard({
  structure,
  isSelected,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete
}: StructureCardProps) {
  const estimatedPayout = PayoutCalculationEngine.estimatePayout(structure, {
    totalViews: 100000,
    videoCount: 10
  });

  const componentTypeIcons: Record<PayoutComponentType, any> = {
    base: DollarSign,
    flat: DollarSign,
    cpm: TrendingUp,
    bonus: Award,
    bonus_tiered: Zap
  };

  return (
    <div
      className={`border rounded-lg p-4 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-white/10 bg-zinc-900/40 hover:border-white/20'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1" onClick={onSelect} role="button">
          <h4 className="text-white font-medium mb-1">{structure.name}</h4>
          {structure.description && (
            <p className="text-sm text-white/60">{structure.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={onEdit}
            className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDuplicate}
            className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Components Preview */}
      <div className="flex flex-wrap gap-2 mb-3">
        {structure.components.map((component, idx) => {
          const Icon = componentTypeIcons[component.type] || DollarSign;
          return (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-md text-xs text-white/70"
            >
              <Icon className="w-3.5 h-3.5" />
              {component.name}
            </div>
          );
        })}
      </div>

      {/* Estimated Payout */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <span className="text-xs text-white/60">Est. for 100K views, 10 videos:</span>
        <span className="text-lg font-semibold text-green-400">${estimatedPayout.toFixed(2)}</span>
      </div>

      {structure.maxPayout && (
        <div className="mt-2 text-xs text-white/50">
          Max payout: ${structure.maxPayout}
        </div>
      )}
    </div>
  );
}

// ==================== STRUCTURE EDITOR ====================

interface StructureEditorProps {
  structure: PayoutStructure;
  onSave: (structure: PayoutStructure) => void;
  onCancel: () => void;
}

function StructureEditor({ structure, onSave, onCancel }: StructureEditorProps) {
  const [name, setName] = useState(structure.name);
  const [description, setDescription] = useState(structure.description || '');
  const [components, setComponents] = useState<PayoutComponent[]>(structure.components);
  const [maxPayout, setMaxPayout] = useState<number | undefined>(structure.maxPayout);

  const addComponent = (type: PayoutComponentType) => {
    const newComponent: PayoutComponent = {
      id: `comp_${Date.now()}`,
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Payment`,
      amount: type === 'base' || type === 'flat' || type === 'bonus' ? 100 : undefined,
      rate: type === 'cpm' ? 10 : undefined,
      metric: type === 'cpm' || type === 'bonus' ? 'views' : undefined,
      condition: type === 'bonus' ? { metric: 'views', value: 50000, operator: 'gte' } : undefined,
      tiers: type === 'bonus_tiered' ? [
        { condition: { metric: 'views', value: 50000, operator: 'gte' }, amount: 100 }
      ] : undefined
    };

    setComponents([...components, newComponent]);
  };

  const updateComponent = (index: number, updates: Partial<PayoutComponent>) => {
    const updated = [...components];
    updated[index] = { ...updated[index], ...updates };
    setComponents(updated);
  };

  const removeComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({
      ...structure,
      name,
      description,
      components,
      maxPayout
    });
  };

  const estimatedPayout = PayoutCalculationEngine.estimatePayout(
    { ...structure, components, maxPayout },
    { totalViews: 100000, videoCount: 10 }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          {structure.id ? 'Edit' : 'Create'} Payout Structure
        </h3>
        <button
          onClick={onCancel}
          className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Structure Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-900/40 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Base + CPM w/ cap"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-4 py-2 bg-zinc-900/40 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe when to use this structure..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Max Payout (Optional)
          </label>
          <input
            type="number"
            value={maxPayout || ''}
            onChange={(e) => setMaxPayout(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-4 py-2 bg-zinc-900/40 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="No limit"
            min="0"
          />
        </div>
      </div>

      {/* Components */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white/80">
            Payment Components
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => addComponent('base')}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white transition-colors"
            >
              + Base
            </button>
            <button
              onClick={() => addComponent('cpm')}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white transition-colors"
            >
              + CPM
            </button>
            <button
              onClick={() => addComponent('bonus')}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white transition-colors"
            >
              + Bonus
            </button>
            <button
              onClick={() => addComponent('bonus_tiered')}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white transition-colors"
            >
              + Tiered
            </button>
          </div>
        </div>

        {components.length === 0 ? (
          <div className="text-center py-8 border border-white/10 rounded-lg bg-zinc-900/40 text-white/60">
            No components yet. Click a button above to add one.
          </div>
        ) : (
          <div className="space-y-3">
            {components.map((component, index) => (
              <ComponentEditor
                key={component.id}
                component={component}
                onUpdate={(updates) => updateComponent(index, updates)}
                onRemove={() => removeComponent(index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Estimated Preview */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/60 mb-1">Estimated Payout</p>
            <p className="text-xs text-white/50">For 100K views, 10 videos</p>
          </div>
          <p className="text-2xl font-bold text-green-400">${estimatedPayout.toFixed(2)}</p>
        </div>
        {maxPayout && estimatedPayout > maxPayout && (
          <p className="text-xs text-yellow-400 mt-2">
            ⚠️ Capped at ${maxPayout}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-white/10">
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          Save Structure
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ==================== COMPONENT EDITOR ====================

interface ComponentEditorProps {
  component: PayoutComponent;
  onUpdate: (updates: Partial<PayoutComponent>) => void;
  onRemove: () => void;
}

function ComponentEditor({ component, onUpdate, onRemove }: ComponentEditorProps) {
  const metricOptions: PayoutMetric[] = ['views', 'likes', 'comments', 'shares', 'saves', 'video_count'];

  return (
    <div className="p-4 bg-zinc-900/40 border border-white/10 rounded-lg">
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-3">
          {/* Name */}
          <input
            type="text"
            value={component.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Component name"
          />

          {/* Type-specific fields */}
          {(component.type === 'base' || component.type === 'flat' || component.type === 'bonus') && (
            <input
              type="number"
              value={component.amount || ''}
              onChange={(e) => onUpdate({ amount: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Amount ($)"
              min="0"
            />
          )}

          {component.type === 'cpm' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  value={component.rate || ''}
                  onChange={(e) => onUpdate({ rate: Number(e.target.value) })}
                  className="px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Rate ($/1K)"
                  min="0"
                  step="0.1"
                />
                <select
                  value={component.metric || 'views'}
                  onChange={(e) => onUpdate({ metric: e.target.value as PayoutMetric })}
                  className="px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {metricOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  value={component.cap || ''}
                  onChange={(e) => onUpdate({ cap: e.target.value ? Number(e.target.value) : undefined })}
                  className="px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Cap ($, optional)"
                  min="0"
                />
                <input
                  type="number"
                  value={component.minThreshold || ''}
                  onChange={(e) => onUpdate({ minThreshold: e.target.value ? Number(e.target.value) : undefined })}
                  className="px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Min threshold (optional)"
                  min="0"
                />
              </div>
            </>
          )}

          {component.type === 'bonus' && component.condition && (
            <div className="grid grid-cols-3 gap-3">
              <select
                value={component.condition.metric}
                onChange={(e) => onUpdate({
                  condition: { ...component.condition!, metric: e.target.value as PayoutMetric }
                })}
                className="px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {metricOptions.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={component.condition.operator || 'gte'}
                onChange={(e) => onUpdate({
                  condition: { ...component.condition!, operator: e.target.value as any }
                })}
                className="px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="gte">≥</option>
                <option value="gt">&gt;</option>
                <option value="lte">≤</option>
                <option value="lt">&lt;</option>
                <option value="eq">=</option>
              </select>
              <input
                type="number"
                value={component.condition.value}
                onChange={(e) => onUpdate({
                  condition: { ...component.condition!, value: Number(e.target.value) }
                })}
                className="px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Target"
                min="0"
              />
            </div>
          )}
        </div>

        <button
          onClick={onRemove}
          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

