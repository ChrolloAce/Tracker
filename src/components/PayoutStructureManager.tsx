import { useState, useEffect } from 'react';
import {
  Plus, X, Copy, Trash2, ChevronDown, ChevronUp, Check,
  Coins, Banknote, Sparkles, Gift, Layers, Target, Film,
  Settings2, Tag, Calculator, Pencil,
} from 'lucide-react';
import { Button } from './ui/Button';
import { PayoutStructureService } from '../services/PayoutStructureService';
import { PayoutCalculationEngine } from '../services/PayoutCalculationEngine';
import type {
  PayoutStructure, PayoutComponent, PayoutComponentType, PayoutMetric, BonusCaps, StructureCaps,
} from '../types/payouts';

const METRIC_OPTIONS: PayoutMetric[] = ['views', 'likes', 'comments', 'shares', 'saves', 'videos_posted'];

/** Component types where only a single instance makes sense in a single structure.
 *  CPM, Bonus, and Tiered Bonus stay unlimited — natural to have several (e.g. CPM on views AND CPM on likes). */
const UNIQUE_TYPES: ReadonlySet<PayoutComponentType> = new Set(['base', 'flat', 'per_video', 'conversion']);

/** Money formatter with thousands separators: 1150 → "1,150.00". Pair with leading "$". */
const fmtUSD = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Numeric input that shows commas as the user types (1000 → 1,000).
 *  HTML `<input type="number">` strips commas, so we use `type="text"` with `inputMode="numeric"`.
 *  Preserves trailing `.` and trailing zeros after `.` while typing so decimals are usable. */
function NumberField({ value, onChange, allowDecimal = false, min, placeholder, className, autoFocus }: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  allowDecimal?: boolean;
  min?: number;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  // Hold the user's raw string when it would lose info on number-parse (trailing "." or "0")
  const [rawHold, setRawHold] = useState<string | null>(null);

  const format = (n: number | undefined): string => {
    if (n === undefined || n === null || isNaN(n)) return '';
    return n.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      // High ceiling so formatting doesn't silently truncate user decimals
      maximumFractionDigits: allowDecimal ? 10 : 0,
    });
  };

  const display = rawHold ?? format(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw === '') { onChange(undefined); setRawHold(null); return; }
    const validPattern = allowDecimal ? /^-?\d*\.?\d*$/ : /^-?\d*$/;
    if (!validPattern.test(raw)) return; // reject disallowed chars (rubber-band back to previous value)
    const num = Number(raw);
    if (isNaN(num)) return;
    if (min !== undefined && num < min) return;
    onChange(num);

    // Preserve trailing "." or trailing-zero decimals so user can keep typing
    const preserveRaw = allowDecimal && (
      raw.endsWith('.') ||
      (raw.includes('.') && /0+$/.test(raw.split('.')[1] || ''))
    );
    if (preserveRaw) {
      const [intPart, decPart] = raw.split('.');
      const formattedInt = Number(intPart || 0).toLocaleString('en-US');
      setRawHold(decPart !== undefined ? `${formattedInt}.${decPart}` : `${formattedInt}.`);
    } else {
      setRawHold(null);
    }
  };

  return (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={display}
      onChange={handleChange}
      onBlur={() => setRawHold(null)}
      placeholder={placeholder}
      className={className}
      autoFocus={autoFocus}
    />
  );
}

/** Recursively strip `undefined` values — Firestore rejects them in nested objects/arrays. */
function stripDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(stripDeep) as any;
  if (typeof value === 'object' && !(value instanceof Date)) {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as any)) {
      if (v !== undefined) clean[k] = stripDeep(v);
    }
    return clean as any;
  }
  return value;
}

// ==================== TYPE META ====================

// Brand palette is black/orange/white. Component types are differentiated by icon + label,
// not color. Orange is reserved for brand accent, emerald for money, red for destructive.
const TYPE_META: Record<PayoutComponentType, {
  label: string; short: string; icon: typeof Coins; description: string;
}> = {
  base:         { label: 'Base Pay',       short: 'Base',    icon: Coins,    description: 'Guaranteed flat amount' },
  flat:         { label: 'Flat Fee',       short: 'Flat',    icon: Banknote, description: 'One-time fixed payment' },
  cpm:          { label: 'Per 1K Views',   short: 'CPM',     icon: Sparkles, description: '$X per 1000 views or any metric' },
  bonus:        { label: 'Bonus',          short: 'Bonus',   icon: Gift,     description: 'Pay when a threshold is hit' },
  bonus_tiered: { label: 'Tiered Bonus',   short: 'Tiered',  icon: Layers,   description: 'Multiple reward tiers' },
  conversion:   { label: 'Per Conversion', short: 'Conv.',   icon: Target,   description: 'Pay per conversion or sale' },
  per_video:    { label: 'Per Video',      short: 'Video',   icon: Film,     description: 'Pay a flat amount per video posted' },
};

// ==================== MAIN ====================

interface Props {
  orgId: string; projectId: string; userId: string;
  onSelect?: (structure: PayoutStructure) => void;
  selectedStructureId?: string;
  inlineMode?: boolean;
  initialStructure?: PayoutStructure;
}

export default function PayoutStructureManager({ orgId, projectId, userId, onSelect, selectedStructureId, inlineMode, initialStructure }: Props) {
  const [structures, setStructures] = useState<PayoutStructure[]>([]);
  const [loading, setLoading] = useState(!inlineMode);
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<PayoutStructure | null>(inlineMode && initialStructure ? initialStructure : null);

  useEffect(() => { if (!inlineMode) load(); }, [orgId, projectId]);

  const load = async () => {
    try {
      setLoading(true);
      setStructures(await PayoutStructureService.seedDefaultsIfEmpty(orgId, projectId, userId));
    } catch (e) { console.error('Failed to load:', e); } finally { setLoading(false); }
  };

  const handleSave = async (structure: PayoutStructure) => {
    const v = PayoutStructureService.validateStructure(structure);
    if (!v.valid) { alert('Validation errors:\n' + v.errors.join('\n')); return; }
    // Deep-strip undefined so toggling component fields (e.g. per → undefined, rateTiers → undefined)
    // doesn't cause Firestore to reject the write.
    const cleanComponents = stripDeep(structure.components);
    const cleanCaps = structure.caps ? stripDeep(structure.caps) : undefined;
    try {
      if (isCreating || !structure.id) {
        const created = await PayoutStructureService.createStructure(orgId, projectId, userId, {
          name: structure.name, description: structure.description,
          components: cleanComponents,
          maxPayout: cleanCaps?.perCampaign ?? structure.maxPayout,
          caps: cleanCaps,
        });
        setStructures([created, ...structures]);
        onSelect?.(created);
      } else {
        await PayoutStructureService.updateStructure(orgId, projectId, structure.id, {
          name: structure.name, description: structure.description,
          components: cleanComponents,
          maxPayout: cleanCaps?.perCampaign ?? structure.maxPayout,
          caps: cleanCaps,
        });
        setStructures(structures.map(s => s.id === structure.id ? structure : s));
        onSelect?.(structure);
      }
      setEditing(null); setIsCreating(false);
    } catch (error: any) {
      console.error('Failed to save:', error);
      alert('Failed to save: ' + (error?.message || 'Check console'));
    }
  };

  if (inlineMode && editing) return <Editor structure={editing} onSave={handleSave} onCancel={() => setEditing(null)} showCancel={false} />;
  if (loading) return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => <div key={i} className="h-40 rounded-2xl bg-surface-tertiary border border-border-subtle animate-pulse" />)}
    </div>
  );
  if (editing) return <Editor structure={editing} onSave={handleSave} onCancel={() => { setEditing(null); setIsCreating(false); }} />;

  const newStructure = () => {
    setEditing({ id: '', orgId, name: 'New Payout Structure', description: '', components: [], isActive: true, createdAt: new Date() as any, createdBy: userId });
    setIsCreating(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-content">Payout templates</h3>
          <p className="text-xs text-content-muted mt-0.5">Tap a template to apply, or craft a new one</p>
        </div>
        <Button onClick={newStructure} size="sm"><Plus className="w-4 h-4 mr-1" /> New template</Button>
      </div>

      {structures.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-surface-tertiary border border-border-subtle">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-surface-secondary flex items-center justify-center">
            <Tag className="w-6 h-6 text-content-muted" />
          </div>
          <p className="text-sm font-medium text-content">No templates yet</p>
          <p className="text-xs text-content-muted mt-1 mb-4">Create reusable payout rules to apply to any creator.</p>
          <Button onClick={newStructure} size="sm">Create your first template</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {structures.map(s => (
            <TemplateCard
              key={s.id}
              structure={s}
              selected={s.id === selectedStructureId}
              onSelect={() => onSelect?.(s)}
              onEdit={() => { setEditing(s); setIsCreating(false); }}
              onDuplicate={async () => { const d = await PayoutStructureService.duplicateStructure(orgId, projectId, userId, s.id); setStructures([d, ...structures]); }}
              onDelete={async () => { if (!confirm('Delete this template?')) return; await PayoutStructureService.deleteStructure(orgId, projectId, s.id); setStructures(structures.filter(x => x.id !== s.id)); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== TEMPLATE CARD ====================

function TemplateCard({ structure, selected, onSelect, onEdit, onDuplicate, onDelete }: {
  structure: PayoutStructure; selected: boolean;
  onSelect: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  // Preview uses per-video model: 10 videos × 100K views each = 1M total.
  // Chosen so stacking bonuses (typically pegged at "$X per 100K views/video") actually fire in the estimate.
  const est = PayoutCalculationEngine.estimatePayout(structure, { totalViews: 1_000_000, videoCount: 10 });
  // Dedupe component types for the icon strip at-a-glance
  const uniqueTypes = Array.from(new Set(structure.components.map(c => c.type))) as PayoutComponentType[];

  return (
    <div onClick={onSelect}
      className={`group relative rounded-2xl bg-surface-secondary border p-4 cursor-pointer transition-all ${
        selected
          ? 'border-orange-500 ring-2 ring-orange-500/20 shadow-theme'
          : 'border-border-subtle hover:border-border-strong hover:shadow-theme'
      }`}>
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-[0_2px_0_0_#c2410c]">
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 pr-8">
        <div className="flex -space-x-1.5">
          {uniqueTypes.slice(0, 4).map(t => {
            const meta = TYPE_META[t];
            const Icon = meta.icon;
            return (
              <div key={t} className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 border border-surface-secondary flex items-center justify-center" title={meta.label}>
                <Icon className="w-4 h-4" />
              </div>
            );
          })}
          {uniqueTypes.length > 4 && (
            <div className="w-9 h-9 rounded-xl bg-surface-tertiary text-content-muted border border-surface-secondary flex items-center justify-center text-[10px] font-semibold">
              +{uniqueTypes.length - 4}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-content truncate">{structure.name}</h4>
          {structure.description && <p className="text-xs text-content-muted line-clamp-1 mt-0.5">{structure.description}</p>}
        </div>
      </div>

      {/* Component pills */}
      {structure.components.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {structure.components.map((c, i) => {
            const meta = TYPE_META[c.type];
            const Icon = meta.icon;
            return (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-tertiary text-content-secondary border border-border-subtle">
                <Icon className="w-3 h-3" /> {c.name || meta.short}
              </span>
            );
          })}
        </div>
      )}

      {/* Footer: estimate + actions */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border-subtle">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">Est. · 10 videos × 100K views each</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-500 leading-tight">${fmtUSD(est)}</p>
        </div>
        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} title="Edit"
            className="p-1.5 text-content-muted hover:text-content hover:bg-surface-hover rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onDuplicate} title="Duplicate"
            className="p-1.5 text-content-muted hover:text-content hover:bg-surface-hover rounded-lg transition-colors"><Copy className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} title="Delete"
            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

// ==================== EDITOR ====================

function Editor({ structure, onSave, onCancel, showCancel = true }: {
  structure: PayoutStructure; onSave: (s: PayoutStructure) => void; onCancel: () => void; showCancel?: boolean;
}) {
  const [name, setName] = useState(structure.name);
  const [description, setDescription] = useState(structure.description || '');
  const [components, setComponents] = useState<PayoutComponent[]>(structure.components);
  const [caps, setCaps] = useState<StructureCaps>(structure.caps || {});

  // Preview assumptions — user-editable. Per-video rather than aggregate so the
  // label is clear and stacking bonuses (e.g. "$100 per 100K views/video") can fire.
  const [viewsPerVideo, setViewsPerVideo] = useState(100_000);
  const [videoCount, setVideoCount] = useState(10);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const safeCount = Math.max(1, videoCount);
  const safeViews = Math.max(0, viewsPerVideo);

  const add = (type: PayoutComponentType) => {
    const id = `comp_${Date.now()}`;
    const d: Record<PayoutComponentType, PayoutComponent> = {
      base: { id, type: 'base', name: 'Base Payment', amount: 100 },
      flat: { id, type: 'flat', name: 'Flat Fee', amount: 100 },
      cpm: { id, type: 'cpm', name: 'CPM', rate: 3, metric: 'views' },
      bonus: { id, type: 'bonus', name: 'Bonus', amount: 200, condition: { metric: 'views', value: 500000, operator: '>=' } },
      bonus_tiered: { id, type: 'bonus_tiered', name: 'Tiered Bonus', metric: 'views', tiers: [{ threshold: 100000, amount: 100 }, { threshold: 500000, amount: 300 }, { threshold: 1000000, amount: 500 }] },
      conversion: { id, type: 'conversion', name: 'Conversion Pay', amountPerConversion: 10 },
      per_video: { id, type: 'per_video', name: 'Per Video', amountPerVideo: 50 },
    };
    setComponents([...components, d[type]]);
  };

  const update = (i: number, u: Partial<PayoutComponent>) => { const a = [...components]; a[i] = { ...a[i], ...u } as PayoutComponent; setComponents(a); };
  const remove = (i: number) => setComponents(components.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => { const t = i + dir; if (t < 0 || t >= components.length) return; const a = [...components]; [a[i], a[t]] = [a[t], a[i]]; setComponents(a); };

  const est = PayoutCalculationEngine.estimatePayout(
    { ...structure, components, caps, maxPayout: caps.perCampaign },
    { totalViews: safeViews * safeCount, videoCount: safeCount },
  );

  const inp = 'w-full px-3 py-2 bg-surface-tertiary border border-border rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-content-muted transition-all';
  const sel = 'w-full px-3 py-2 bg-surface-tertiary border border-border rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all';
  const lbl = 'block text-[11px] font-semibold uppercase tracking-wider text-content-secondary mb-1.5';

  const typeOrder: PayoutComponentType[] = ['base', 'cpm', 'bonus', 'bonus_tiered', 'per_video', 'conversion', 'flat'];
  const typesInUse = new Set(components.map(c => c.type));

  return (
    <div>
      <div className="space-y-5 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-content">{structure.id ? 'Edit template' : 'New template'}</h3>
            <p className="text-xs text-content-muted">Mix and match components to build any payout rule.</p>
          </div>
        </div>
        {showCancel && <button onClick={onCancel} className="p-2 text-content-muted hover:text-content hover:bg-surface-hover rounded-lg transition-colors"><X className="w-5 h-5" /></button>}
      </div>

      {/* Basics */}
      <SectionCard title="Basics" icon={<Tag className="w-4 h-4" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={lbl}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="e.g. Base + CPM" />
          </div>
          <div>
            <label className={lbl}>Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className={inp} placeholder="When to use..." />
          </div>
        </div>
      </SectionCard>

      {/* Caps */}
      <SectionCard title="Spending caps" icon={<Settings2 className="w-4 h-4" />} subtitle="Optional safety nets to limit payout per creator">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={lbl}>Max / campaign ($)</label>
            <NumberField allowDecimal min={0} value={caps.perCampaign} onChange={v => setCaps({ ...caps, perCampaign: v })} className={inp} placeholder="No limit" />
          </div>
          <div>
            <label className={lbl}>Period cap ($)</label>
            <NumberField allowDecimal min={0} value={caps.perPeriod?.amount} onChange={v => setCaps({ ...caps, perPeriod: v ? { amount: v, period: caps.perPeriod?.period || 'month', alignment: 'calendar' } : undefined })} className={inp} placeholder="No limit" />
          </div>
          <div>
            <label className={lbl}>Period</label>
            <select value={caps.perPeriod?.period || 'month'} onChange={e => caps.perPeriod && setCaps({ ...caps, perPeriod: { ...caps.perPeriod, period: e.target.value as any } })} className={sel} disabled={!caps.perPeriod}>
              <option value="week">Per Week</option>
              <option value="month">Per Month</option>
            </select>
          </div>
        </div>
      </SectionCard>

      {/* Components */}
      <SectionCard title="Components" icon={<Layers className="w-4 h-4" />} subtitle="Add as many as you want — they stack together">
        {/* Type picker tiles — unique types are disabled once used */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {typeOrder.map(t => {
            const meta = TYPE_META[t];
            const Icon = meta.icon;
            const disabled = UNIQUE_TYPES.has(t) && typesInUse.has(t);
            return (
              <button key={t} type="button" onClick={() => { if (!disabled) add(t); }} disabled={disabled}
                title={disabled ? `${meta.label} is already in this template` : undefined}
                className={`group relative rounded-xl border p-3.5 text-left transition-all ${
                  disabled
                    ? 'border-border-subtle bg-surface-tertiary opacity-60 cursor-not-allowed'
                    : 'border-border bg-surface hover:bg-surface-hover hover:border-orange-300 dark:hover:border-orange-500/40 hover:shadow-theme hover:-translate-y-0.5'
                }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    disabled ? 'bg-surface text-content-muted' : 'bg-orange-500/10 text-orange-500'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1 pr-5">
                    <p className={`text-sm font-semibold leading-tight ${disabled ? 'text-content-muted line-through decoration-content-muted/50' : 'text-content'}`}>{meta.label}</p>
                    <p className="text-[11px] text-content-muted mt-1 leading-snug">
                      {disabled ? 'Already added' : meta.description}
                    </p>
                  </div>
                </div>
                {disabled
                  ? <Check className="absolute top-3 right-3 w-4 h-4 text-content-muted" />
                  : <Plus className="absolute top-3 right-3 w-4 h-4 text-content-muted group-hover:text-orange-500 transition-colors" />
                }
              </button>
            );
          })}
        </div>

        {/* Active components */}
        {components.length > 0 && (
          <div className="space-y-2 mt-4">
            {components.map((c, i) => (
              <CompEditor key={c.id || i} component={c} index={i} total={components.length}
                onUpdate={u => update(i, u)} onRemove={() => remove(i)} onMove={d => move(i, d)}
                inp={inp} sel={sel} lbl={lbl} />
            ))}
          </div>
        )}
        {components.length === 0 && (
          <div className="text-center py-10 mt-3 rounded-xl bg-surface-tertiary/50 border border-dashed border-border-subtle">
            <Layers className="w-8 h-8 mx-auto text-content-muted mb-2" />
            <p className="text-sm text-content-secondary">Pick a component above to start building</p>
            <p className="text-xs text-content-muted mt-0.5">You can combine multiple — e.g. Base + CPM + Tiered Bonus</p>
          </div>
        )}
      </SectionCard>

      </div>

      {/* Sticky footer: live preview + editable assumptions + save/cancel */}
      <div className="sticky bottom-0 z-20 -mx-5 px-5 py-4 bg-surface/95 backdrop-blur-md border-t border-border-subtle shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-[0_3px_0_0_#047857] flex-shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-500 leading-none">${fmtUSD(est)}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">live estimate</p>
              </div>
              <button type="button" onClick={() => setShowAssumptions(!showAssumptions)}
                className="text-[11px] text-content-muted mt-1 hover:text-content transition-colors inline-flex items-center gap-1">
                Assuming <span className="font-semibold text-content">{safeCount}</span> videos × <span className="font-semibold text-content">{safeViews.toLocaleString()}</span> views each
                <ChevronDown className={`w-3 h-3 transition-transform ${showAssumptions ? 'rotate-180' : ''}`} />
              </button>
              {showAssumptions && (
                <div className="flex flex-wrap gap-3 mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-content-muted whitespace-nowrap">Videos</span>
                    <NumberField min={1} value={videoCount}
                      onChange={v => setVideoCount(Math.max(1, v ?? 1))}
                      className="w-16 px-2 py-1 bg-surface-tertiary border border-border rounded-md text-content text-xs focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-content-muted whitespace-nowrap">Views / video</span>
                    <NumberField min={0} value={viewsPerVideo}
                      onChange={v => setViewsPerVideo(Math.max(0, v ?? 0))}
                      className="w-24 px-2 py-1 bg-surface-tertiary border border-border rounded-md text-content text-xs focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <span className="text-[10px] text-content-muted self-center">
                    = {(safeViews * safeCount).toLocaleString()} total views
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {showCancel && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
            <Button onClick={() => onSave({ ...structure, name, description, components, caps, maxPayout: caps.perCampaign ?? structure.maxPayout })}>
              <Check className="w-4 h-4 mr-1.5" /> Save template
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== SECTION CARD ====================

function SectionCard({ title, icon, subtitle, children }: {
  title: string; icon: React.ReactNode; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface-secondary border border-border-subtle shadow-theme p-5">
      <div className="flex items-start gap-2.5 mb-4 pb-3 border-b border-border-subtle">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-500/10 text-orange-500">{icon}</div>
        <div>
          <h4 className="text-sm font-semibold text-content leading-tight">{title}</h4>
          {subtitle && <p className="text-xs text-content-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ==================== COMPONENT EDITOR ====================

function CompEditor({ component, index, total, onUpdate, onRemove, onMove, inp, sel, lbl }: {
  component: PayoutComponent; index: number; total: number;
  onUpdate: (u: Partial<PayoutComponent>) => void; onRemove: () => void; onMove: (d: -1 | 1) => void;
  inp: string; sel: string; lbl: string;
}) {
  const [open, setOpen] = useState(true);
  const meta = TYPE_META[component.type];
  const Icon = meta.icon;

  return (
    <div className="relative rounded-2xl bg-surface border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface-hover transition-colors" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted">{meta.label}</span>
            </div>
            <p className="text-sm font-semibold text-content truncate">{component.name || meta.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {index > 0 && <button onClick={e => { e.stopPropagation(); onMove(-1); }} title="Move up" className="p-1.5 text-content-muted hover:text-content hover:bg-surface-tertiary rounded-lg transition-colors"><ChevronUp className="w-4 h-4" /></button>}
          {index < total - 1 && <button onClick={e => { e.stopPropagation(); onMove(1); }} title="Move down" className="p-1.5 text-content-muted hover:text-content hover:bg-surface-tertiary rounded-lg transition-colors"><ChevronDown className="w-4 h-4" /></button>}
          <button onClick={e => { e.stopPropagation(); onRemove(); }} title="Remove" className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-border-subtle mx-1" />
          <ChevronDown className={`w-4 h-4 text-content-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border-subtle pt-4">
          <div><label className={lbl}>Display name</label><input value={component.name || ''} onChange={e => onUpdate({ name: e.target.value })} className={inp} placeholder={meta.label} /></div>

          {(component.type === 'base' || component.type === 'flat') && (
            <div><label className={lbl}>Amount ($)</label><NumberField allowDecimal min={0} value={(component as any).amount} onChange={v => onUpdate({ amount: v ?? 0 } as any)} className={inp} /></div>
          )}

          {component.type === 'cpm' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className={lbl}>Rate ($/1K)</label><NumberField allowDecimal min={0} value={(component as any).rate} onChange={v => onUpdate({ rate: v ?? 0 } as any)} className={inp} /></div>
                <div><label className={lbl}>Metric</label><select value={(component as any).metric || 'views'} onChange={e => onUpdate({ metric: e.target.value } as any)} className={sel}>{METRIC_OPTIONS.filter(m => m !== 'videos_posted').map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                <div><label className={lbl}>Cap ($)</label><NumberField allowDecimal min={0} value={(component as any).cap} onChange={v => onUpdate({ cap: v } as any)} className={inp} placeholder="No limit" /></div>
                <div><label className={lbl}>Min threshold</label><NumberField min={0} value={(component as any).minThreshold} onChange={v => onUpdate({ minThreshold: v } as any)} className={inp} placeholder="0" /></div>
              </div>
              <div>
                <label className={lbl}>Cross-post handling</label>
                <select value={(component as any).crossPostPolicy || 'sum-all'}
                  onChange={e => onUpdate({ crossPostPolicy: e.target.value } as any)} className={sel}>
                  <option value="sum-all">Sum views across all platforms (each view counts)</option>
                  <option value="max-per-group">Max platform only (take the best-performing copy)</option>
                </select>
              </div>
            </>
          )}

          {component.type === 'bonus' && <BonusFields c={component as any} onUpdate={onUpdate} inp={inp} sel={sel} lbl={lbl} />}
          {component.type === 'bonus_tiered' && <TieredFields c={component as any} onUpdate={onUpdate} inp={inp} sel={sel} lbl={lbl} />}

          {component.type === 'per_video' && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className={lbl}>$ / video</label><NumberField allowDecimal min={0} value={(component as any).amountPerVideo} onChange={v => onUpdate({ amountPerVideo: v ?? 0 } as any)} className={inp} /></div>
                <div><label className={lbl}>Max videos</label><NumberField min={0} value={(component as any).maxVideos} onChange={v => onUpdate({ maxVideos: v } as any)} className={inp} placeholder="Unlimited" /></div>
                <div><label className={lbl}>Min views / video</label><NumberField min={0} value={(component as any).minQualityThreshold?.value} onChange={v => onUpdate({ minQualityThreshold: v ? { metric: 'views', value: v } : undefined } as any)} className={inp} placeholder="No min" /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={lbl}>Cross-post handling</label>
                  <select value={(component as any).crossPostPolicy || 'count-as-1'}
                    onChange={e => onUpdate({ crossPostPolicy: e.target.value } as any)} className={sel}>
                    <option value="count-as-1">Count cross-posts as 1 video (pay once per group)</option>
                    <option value="count-as-each">Count each platform post separately</option>
                    <option value="count-with-cap">Pay for up to N per group (capped)</option>
                  </select>
                </div>
                {(component as any).crossPostPolicy === 'count-with-cap' && (
                  <div>
                    <label className={lbl}>Max per cross-post group</label>
                    <NumberField min={1} value={(component as any).crossPostCap} onChange={v => onUpdate({ crossPostCap: v ?? 1 } as any)} className={inp} placeholder="2" />
                  </div>
                )}
              </div>
            </>
          )}

          {component.type === 'conversion' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className={lbl}>$ / conversion</label><NumberField allowDecimal min={0} value={(component as any).amountPerConversion} onChange={v => onUpdate({ amountPerConversion: v ?? 0 } as any)} className={inp} /></div>
              <div><label className={lbl}>Cap ($)</label><NumberField allowDecimal min={0} value={(component as any).cap} onChange={v => onUpdate({ cap: v } as any)} className={inp} placeholder="No limit" /></div>
              <div><label className={lbl}>Min conversions</label><NumberField min={0} value={(component as any).minConversions} onChange={v => onUpdate({ minConversions: v } as any)} className={inp} placeholder="0" /></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== BONUS FIELDS ====================

function BonusFields({ c, onUpdate, inp, sel, lbl }: { c: any; onUpdate: (u: any) => void; inp: string; sel: string; lbl: string }) {
  const cond = c.condition || { metric: 'views', value: 0, operator: '>=' };
  const caps: BonusCaps = c.caps || {};
  const isStacking = c.per && c.per > 0;
  const scope: 'per_video' | 'creator_total' = c.scope || 'per_video';
  const isPerVideo = isStacking && scope === 'per_video';
  const rateTiers: Array<{ threshold: number; rate: number; per: number }> = c.rateTiers || [];
  const hasRateTiers = rateTiers.length > 0;

  // Piecewise calc mirrors PayoutCalculationEngine.calcStackingAmount so the live example
  // reflects rate tiers when configured.
  const computePiecewise = (metricValue: number): number => {
    const baseTier = { threshold: 0, rate: c.amount || 0, per: c.per || 1 };
    const tiers = [baseTier, ...rateTiers].sort((a, b) => a.threshold - b.threshold);
    let total = 0;
    for (let i = 0; i < tiers.length; i++) {
      const curr = tiers[i];
      const next = tiers[i + 1];
      const upper = next ? next.threshold : Infinity;
      const bandSize = Math.max(0, Math.min(upper, metricValue) - curr.threshold);
      if (bandSize <= 0) continue;
      total += Math.floor(bandSize / (curr.per || 1)) * curr.rate;
    }
    return total;
  };

  // Scale the example past the highest tier threshold so piecewise math actually fires.
  const maxTierThreshold = rateTiers.length > 0 ? Math.max(...rateTiers.map(t => t.threshold)) : 0;
  const exampleViews = isPerVideo
    ? Math.max(500_000, maxTierThreshold + 500_000)
    : Math.max(3_000_000, maxTierThreshold + 1_000_000);
  const exampleGross = computePiecewise(exampleViews);
  const exampleUnits = Math.floor(exampleViews / (c.per || 1));
  const exampleCapped = isPerVideo && caps.perVideo && exampleGross > caps.perVideo ? caps.perVideo : exampleGross;

  const addRateTier = () => {
    const lastThreshold = rateTiers.length > 0 ? rateTiers[rateTiers.length - 1].threshold : 0;
    const nextThreshold = lastThreshold === 0 ? 1_000_000 : lastThreshold + 1_000_000;
    const newTier = {
      threshold: nextThreshold,
      rate: Math.max(1, Math.floor((rateTiers.length > 0 ? rateTiers[rateTiers.length - 1].rate : (c.amount || 100)) / 2)),
      per: (rateTiers.length > 0 ? rateTiers[rateTiers.length - 1].per : c.per) || 100_000,
    };
    onUpdate({ rateTiers: [...rateTiers, newTier] });
  };
  const updateRateTier = (i: number, u: Partial<{ threshold: number; rate: number; per: number }>) => {
    const next = [...rateTiers];
    next[i] = { ...next[i], ...u };
    onUpdate({ rateTiers: next });
  };
  const removeRateTier = (i: number) => {
    onUpdate({ rateTiers: rateTiers.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div>
        <label className={lbl}>How does this bonus pay?</label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onUpdate({ per: undefined, scope: undefined, rateTiers: undefined })}
            className={`px-3 py-2.5 text-xs font-semibold rounded-lg border text-left transition-all ${
              !isStacking
                ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-500/40 ring-2 ring-orange-500/20'
                : 'bg-surface-tertiary text-content-muted border-border hover:bg-surface-hover'
            }`}>
            <div className="flex items-center gap-1.5 mb-0.5"><Gift className="w-3.5 h-3.5" /> One-time</div>
            <div className="text-[10px] font-normal opacity-80">Pays once when the threshold is crossed</div>
          </button>
          <button type="button" onClick={() => {
              const updates: any = { per: c.per || 100000, scope: c.scope || 'per_video' };
              // Stacking usually pays from 0; clear the one-time default threshold (500K) so the bonus
              // actually fires. If the user already customized the threshold, respect it.
              if ((c.condition?.value ?? 500000) === 500000) {
                updates.condition = { ...(c.condition || { metric: 'views', operator: '>=' }), value: 0 };
              }
              onUpdate(updates);
            }}
            className={`px-3 py-2.5 text-xs font-semibold rounded-lg border text-left transition-all ${
              isStacking
                ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-500/40 ring-2 ring-orange-500/20'
                : 'bg-surface-tertiary text-content-muted border-border hover:bg-surface-hover'
            }`}>
            <div className="flex items-center gap-1.5 mb-0.5"><Layers className="w-3.5 h-3.5" /> Stacking</div>
            <div className="text-[10px] font-normal opacity-80">e.g. $100 per 100K views, every time</div>
          </button>
        </div>
      </div>

      {isStacking ? (
        <>
          {/* Scope toggle */}
          <div>
            <label className={lbl}>Apply this bonus to...</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onUpdate({ scope: 'per_video' })}
                className={`px-3 py-2.5 text-left rounded-lg border transition-all ${
                  scope === 'per_video'
                    ? 'bg-orange-500/10 border-orange-300 dark:border-orange-500/40 ring-2 ring-orange-500/20'
                    : 'bg-surface-tertiary border-border hover:bg-surface-hover'
                }`}>
                <div className={`text-xs font-semibold ${scope === 'per_video' ? 'text-orange-600 dark:text-orange-400' : 'text-content'}`}>Each video separately</div>
                <div className={`text-[10px] mt-0.5 ${scope === 'per_video' ? 'text-orange-600/80 dark:text-orange-400/80' : 'text-content-muted'}`}>Most common — each video earns its own bonus</div>
              </button>
              <button type="button" onClick={() => onUpdate({ scope: 'creator_total' })}
                className={`px-3 py-2.5 text-left rounded-lg border transition-all ${
                  scope === 'creator_total'
                    ? 'bg-orange-500/10 border-orange-300 dark:border-orange-500/40 ring-2 ring-orange-500/20'
                    : 'bg-surface-tertiary border-border hover:bg-surface-hover'
                }`}>
                <div className={`text-xs font-semibold ${scope === 'creator_total' ? 'text-orange-600 dark:text-orange-400' : 'text-content'}`}>Creator's total</div>
                <div className={`text-[10px] mt-0.5 ${scope === 'creator_total' ? 'text-orange-600/80 dark:text-orange-400/80' : 'text-content-muted'}`}>One bonus on sum of all videos</div>
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className={lbl}>Amount ($)</label><NumberField allowDecimal min={0} value={c.amount} onChange={v => onUpdate({ amount: v ?? 0 })} className={inp} placeholder="100" /></div>
            <div><label className={lbl}>Per (units)</label><NumberField min={1} value={c.per} onChange={v => onUpdate({ per: v ?? 1 })} className={inp} placeholder="100,000" /></div>
            <div><label className={lbl}>Metric</label><select value={cond.metric} onChange={e => onUpdate({ condition: { ...cond, metric: e.target.value } })} className={sel}>{METRIC_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
          </div>

          {/* Rate tiers — higher bands with a different rate. Base tier (above) pays from 0. */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className={lbl}>Rate changes at higher thresholds</label>
                <p className="text-[10px] text-content-muted -mt-1">Optional. e.g. after 1,000,000 views, drop the rate to $50/100K.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={addRateTier}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add rate tier
              </Button>
            </div>
            {hasRateTiers && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-xl bg-surface border border-border-subtle px-3 py-2 text-xs">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</div>
                  <span className="text-content-muted">From</span>
                  <span className="font-semibold text-content">0</span>
                  <span className="text-content-muted">{cond.metric} →</span>
                  <span className="font-semibold text-content">${fmtUSD(c.amount || 0)}</span>
                  <span className="text-content-muted">per</span>
                  <span className="font-semibold text-content">{(c.per || 0).toLocaleString()}</span>
                  <span className="text-content-muted italic ml-auto">base tier</span>
                </div>
                {rateTiers.map((tier, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface border border-border-subtle px-3 py-2">
                    <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 2}</div>
                    <span className="text-xs text-content-muted whitespace-nowrap">After</span>
                    <NumberField min={0} value={tier.threshold}
                      onChange={v => updateRateTier(i, { threshold: v ?? 0 })}
                      className={`${inp} w-28 text-xs py-1`} />
                    <span className="text-xs text-content-muted whitespace-nowrap">{cond.metric} → $</span>
                    <NumberField allowDecimal min={0} value={tier.rate}
                      onChange={v => updateRateTier(i, { rate: v ?? 0 })}
                      className={`${inp} w-20 text-xs py-1`} />
                    <span className="text-xs text-content-muted whitespace-nowrap">per</span>
                    <NumberField min={1} value={tier.per}
                      onChange={v => updateRateTier(i, { per: v ?? 1 })}
                      className={`${inp} w-24 text-xs py-1`} />
                    <button onClick={() => removeRateTier(i)}
                      className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0 ml-auto"
                      title="Remove tier">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-surface-tertiary border border-border-subtle p-3 text-xs">
            <p className="text-content font-medium mb-1">
              {isPerVideo ? 'Per-video example' : 'Creator-total example'}
              {hasRateTiers && <span className="text-content-muted font-normal"> · using {rateTiers.length + 1} rate tiers</span>}
            </p>
            <p className="text-content-secondary leading-relaxed">
              {isPerVideo ? (
                hasRateTiers ? (
                  <>A video with <span className="font-semibold text-content">{exampleViews.toLocaleString()}</span> {cond.metric} earns <span className="font-semibold text-emerald-600 dark:text-emerald-500">${fmtUSD(exampleGross)}</span> (piecewise across your rate tiers){caps.perVideo && exampleGross > caps.perVideo && <> → capped at <span className="font-semibold text-emerald-600 dark:text-emerald-500">${fmtUSD(exampleCapped)}</span></>}.</>
                ) : (
                  <>A video with <span className="font-semibold text-content">{exampleViews.toLocaleString()}</span> {cond.metric} earns <span className="font-semibold text-content">{exampleUnits.toLocaleString()}</span> × ${fmtUSD(c.amount || 0)} = <span className="font-semibold text-emerald-600 dark:text-emerald-500">${fmtUSD(exampleGross)}</span>{caps.perVideo && exampleGross > caps.perVideo && <> → capped at <span className="font-semibold text-emerald-600 dark:text-emerald-500">${fmtUSD(exampleCapped)}</span></>}.</>
                )
              ) : (
                hasRateTiers ? (
                  <>A creator with <span className="font-semibold text-content">{exampleViews.toLocaleString()}</span> total {cond.metric} across all videos earns <span className="font-semibold text-emerald-600 dark:text-emerald-500">${fmtUSD(exampleGross)}</span> (piecewise across your rate tiers).</>
                ) : (
                  <>If a creator has <span className="font-semibold text-content">{exampleViews.toLocaleString()}</span> total {cond.metric} across all videos, they earn <span className="font-semibold text-content">{exampleUnits.toLocaleString()}</span> × ${fmtUSD(c.amount || 0)} = <span className="font-semibold text-emerald-600 dark:text-emerald-500">${fmtUSD(exampleGross)}</span>.</>
                )
              )}
            </p>
          </div>

          <div>
            <label className={lbl}>Minimum threshold (optional)</label>
            <NumberField min={0} value={cond.value || undefined} onChange={v => onUpdate({ condition: { ...cond, value: v ?? 0 } })} className={inp} placeholder="0 — pays from the start" />
          </div>

          {/* Cross-post handling is only meaningful when scope is per_video */}
          {isPerVideo && (
            <div>
              <label className={lbl}>Cross-post handling</label>
              <select value={c.crossPostPolicy || 'max-per-group'}
                onChange={e => onUpdate({ crossPostPolicy: e.target.value })} className={sel}>
                <option value="max-per-group">Any single platform must hit threshold (pay once per group)</option>
                <option value="sum-per-group">Combined metrics across platforms (pay once per group)</option>
                <option value="per-platform">Each platform independent (pay each copy)</option>
              </select>
            </div>
          )}
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-4">
          <div><label className={lbl}>Amount ($)</label><NumberField allowDecimal min={0} value={c.amount} onChange={v => onUpdate({ amount: v ?? 0 })} className={inp} /></div>
          <div><label className={lbl}>Metric</label><select value={cond.metric} onChange={e => onUpdate({ condition: { ...cond, metric: e.target.value } })} className={sel}>{METRIC_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
          <div><label className={lbl}>Operator</label><select value={cond.operator || '>='} onChange={e => onUpdate({ condition: { ...cond, operator: e.target.value } })} className={sel}><option value=">=">≥</option><option value=">">&#62;</option><option value="<=">≤</option><option value="<">&#60;</option><option value="=">=</option></select></div>
          <div><label className={lbl}>Target</label><NumberField min={0} value={cond.value} onChange={v => onUpdate({ condition: { ...cond, value: v ?? 0 } })} className={inp} /></div>
        </div>
      )}

      {/* Caps — perVideo only makes sense for stacking bonuses in per-video scope */}
      <div className="grid gap-3 sm:grid-cols-2">
        {isStacking && isPerVideo && (
          <div><label className={lbl}>Cap per video ($)</label><NumberField allowDecimal min={0} value={caps.perVideo} onChange={v => onUpdate({ caps: { ...caps, perVideo: v } })} className={inp} placeholder="No limit" /></div>
        )}
        <div><label className={lbl}>Cap per campaign ($)</label><NumberField allowDecimal min={0} value={caps.perCampaign} onChange={v => onUpdate({ caps: { ...caps, perCampaign: v } })} className={inp} placeholder="No limit" /></div>
      </div>
    </div>
  );
}

// ==================== TIERED FIELDS ====================

function TieredFields({ c, onUpdate, inp, sel, lbl }: { c: any; onUpdate: (u: any) => void; inp: string; sel: string; lbl: string }) {
  const tiers = c.tiers || [];
  const caps: BonusCaps = c.caps || {};
  return (
    <div className="space-y-3">
      <div>
        <label className={lbl}>Metric</label>
        <select value={c.metric || 'views'} onChange={e => onUpdate({ metric: e.target.value })} className={sel}>
          {METRIC_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <label className={lbl}>Tiers — each adds to the reward as the threshold is hit</label>
        {tiers.map((t: any, i: number) => (
          <div key={i} className="flex items-center gap-2 rounded-xl bg-surface-tertiary border border-border-subtle px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</div>
            <NumberField min={0} value={t.threshold} onChange={v => { const a = [...tiers]; a[i] = { ...a[i], threshold: v ?? 0 }; onUpdate({ tiers: a }); }} className={`${inp} flex-1`} placeholder="Threshold" />
            <span className="text-xs text-content-muted">→</span>
            <NumberField allowDecimal min={0} value={t.amount} onChange={v => { const a = [...tiers]; a[i] = { ...a[i], amount: v ?? 0 }; onUpdate({ tiers: a }); }} className={`${inp} w-28`} placeholder="$" />
            <button onClick={() => onUpdate({ tiers: tiers.filter((_: any, idx: number) => idx !== i) })} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => { const last = tiers[tiers.length - 1]; onUpdate({ tiers: [...tiers, { threshold: (last?.threshold || 0) + 100000, amount: (last?.amount || 0) + 100 }] }); }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add tier
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={lbl}>Cap per video ($)</label><NumberField allowDecimal min={0} value={caps.perVideo} onChange={v => onUpdate({ caps: { ...caps, perVideo: v } })} className={inp} placeholder="No limit" /></div>
        <div><label className={lbl}>Cap per campaign ($)</label><NumberField allowDecimal min={0} value={caps.perCampaign} onChange={v => onUpdate({ caps: { ...caps, perCampaign: v } })} className={inp} placeholder="No limit" /></div>
      </div>

      {/* Cross-post handling is only meaningful when perVideo cap is set (per-video evaluation mode) */}
      {caps.perVideo !== undefined && (
        <div>
          <label className={lbl}>Cross-post handling</label>
          <select value={c.crossPostPolicy || 'max-per-group'}
            onChange={e => onUpdate({ crossPostPolicy: e.target.value })} className={sel}>
            <option value="max-per-group">Any single platform must hit tier (pay once per group)</option>
            <option value="sum-per-group">Combined metrics across platforms (pay once per group)</option>
            <option value="per-platform">Each platform independent (pay each copy)</option>
          </select>
        </div>
      )}
    </div>
  );
}
