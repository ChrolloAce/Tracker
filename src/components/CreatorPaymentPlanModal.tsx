import React, { useState, useEffect } from 'react';
import {
  X, DollarSign, TrendingUp, BarChart3, Layers,
  Plus, Trash2, Save, Loader2, GripVertical
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import CreatorLinksService from '../services/CreatorLinksService';
import { OrgMember, CreatorPaymentPlan, PaymentPlanType, PaymentTier } from '../types/firestore';

interface CreatorPaymentPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  creator: OrgMember;
}

const PLAN_TYPES: { value: PaymentPlanType; label: string; icon: React.ReactNode; desc: string; example: string }[] = [
  {
    value: 'flat',
    label: 'Flat Rate',
    icon: <DollarSign className="w-5 h-5" />,
    desc: 'Fixed payment for reaching a view target',
    example: 'e.g. $300 for 150K views',
  },
  {
    value: 'tiered',
    label: 'Tiered',
    icon: <Layers className="w-5 h-5" />,
    desc: 'Progressive thresholds with payouts at each level',
    example: 'e.g. $100 at 50K, $250 at 100K, $500 at 200K',
  },
  {
    value: 'cpm',
    label: 'CPM',
    icon: <BarChart3 className="w-5 h-5" />,
    desc: 'Pay per 1,000 views (Cost Per Mille)',
    example: 'e.g. $5 CPM = $500 at 100K views',
  },
  {
    value: 'flat_plus_cpm',
    label: 'Flat + CPM',
    icon: <TrendingUp className="w-5 h-5" />,
    desc: 'Base flat amount plus additional CPM on all views',
    example: 'e.g. $200 base + $3 CPM',
  },
];

const SCHEDULES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'per-video', label: 'Per Video' },
  { value: 'custom', label: 'Custom' },
];

const CreatorPaymentPlanModal: React.FC<CreatorPaymentPlanModalProps> = ({
  isOpen, onClose, onSuccess, creator,
}) => {
  const { currentOrgId, currentProjectId, user } = useAuth();

  // Plan state
  const [planType, setPlanType] = useState<PaymentPlanType>('flat');
  const [flatAmount, setFlatAmount] = useState<string>('');
  const [flatViewTarget, setFlatViewTarget] = useState<string>('');
  const [tiers, setTiers] = useState<PaymentTier[]>([]);
  const [cpmRate, setCpmRate] = useState<string>('');
  const [flatBase, setFlatBase] = useState<string>('');
  const [cpmRateOnTop, setCpmRateOnTop] = useState<string>('');
  const [schedule, setSchedule] = useState<string>('monthly');
  const [customSchedule, setCustomSchedule] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingPlan, setExistingPlan] = useState<CreatorPaymentPlan | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadExistingPlan();
    }
  }, [isOpen, creator.userId]);

  const loadExistingPlan = async () => {
    if (!currentOrgId || !currentProjectId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const profile = await CreatorLinksService.getCreatorProfile(
        currentOrgId, currentProjectId, creator.userId
      );
      const plan = profile?.paymentPlan;
      if (plan) {
        setExistingPlan(plan);
        setPlanType(plan.type);
        setFlatAmount(plan.flatAmount?.toString() || '');
        setFlatViewTarget(plan.flatViewTarget?.toString() || '');
        setTiers(plan.tiers || []);
        setCpmRate(plan.cpmRate?.toString() || '');
        setFlatBase(plan.flatBase?.toString() || '');
        setCpmRateOnTop(plan.cpmRateOnTop?.toString() || '');
        setSchedule(plan.schedule || 'monthly');
        setCustomSchedule(plan.customSchedule || '');
        setNotes(plan.notes || '');
      } else {
        resetForm();
      }
    } catch {
      setError('Failed to load existing plan');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setExistingPlan(null);
    setPlanType('flat');
    setFlatAmount('');
    setFlatViewTarget('');
    setTiers([]);
    setCpmRate('');
    setFlatBase('');
    setCpmRateOnTop('');
    setSchedule('monthly');
    setCustomSchedule('');
    setNotes('');
  };

  const addTier = () => {
    const lastThreshold = tiers.length > 0 ? tiers[tiers.length - 1].viewThreshold : 0;
    setTiers([...tiers, { viewThreshold: lastThreshold + 50000, payout: 0, label: '' }]);
  };

  const updateTier = (index: number, updates: Partial<PaymentTier>) => {
    setTiers(prev => prev.map((t, i) => i === index ? { ...t, ...updates } : t));
  };

  const removeTier = (index: number) => {
    setTiers(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;
    setSaving(true);
    setError(null);

    try {
      const plan: CreatorPaymentPlan = {
        type: planType,
        currency: 'USD',
        schedule: schedule as CreatorPaymentPlan['schedule'],
        ...(schedule === 'custom' && { customSchedule }),
        ...(notes && { notes }),
      };

      // Populate type-specific fields
      switch (planType) {
        case 'flat':
          if (!flatAmount || !flatViewTarget) { setError('Enter both the payout amount and view target'); setSaving(false); return; }
          plan.flatAmount = parseFloat(flatAmount);
          plan.flatViewTarget = parseInt(flatViewTarget);
          break;
        case 'tiered':
          if (tiers.length === 0) { setError('Add at least one tier'); setSaving(false); return; }
          // Sort tiers by threshold ascending
          plan.tiers = [...tiers].sort((a, b) => a.viewThreshold - b.viewThreshold);
          break;
        case 'cpm':
          if (!cpmRate) { setError('Enter the CPM rate'); setSaving(false); return; }
          plan.cpmRate = parseFloat(cpmRate);
          break;
        case 'flat_plus_cpm':
          if (!flatBase || !cpmRateOnTop) { setError('Enter both the base amount and CPM rate'); setSaving(false); return; }
          plan.flatBase = parseFloat(flatBase);
          plan.cpmRateOnTop = parseFloat(cpmRateOnTop);
          break;
      }

      await CreatorLinksService.updateCreatorProfile(
        currentOrgId, currentProjectId, creator.userId,
        { paymentPlan: plan }
      );

      onSuccess();
    } catch (err: any) {
      console.error('Failed to save payment plan:', err);
      setError(err.message || 'Failed to save payment plan');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePlan = async () => {
    if (!currentOrgId || !currentProjectId) return;
    setSaving(true);
    try {
      await CreatorLinksService.updateCreatorProfile(
        currentOrgId, currentProjectId, creator.userId,
        { paymentPlan: null as any }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to remove plan');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // Helper to format numbers nicely
  const fmtViews = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
    return n.toString();
  };

  // Preview
  const renderPreview = () => {
    switch (planType) {
      case 'flat':
        if (!flatAmount || !flatViewTarget) return null;
        return (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">${parseFloat(flatAmount).toLocaleString()}</div>
            <div className="text-sm text-white/50 mt-1">for reaching {fmtViews(parseInt(flatViewTarget))} views</div>
          </div>
        );
      case 'tiered':
        if (tiers.length === 0) return null;
        return (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
            {[...tiers].sort((a, b) => a.viewThreshold - b.viewThreshold).map((t, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-white/60">{fmtViews(t.viewThreshold)} views</span>
                <span className="text-white font-semibold">${t.payout.toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t border-white/10 pt-2 flex items-center justify-between text-sm font-bold">
              <span className="text-white/60">Max payout</span>
              <span className="text-white">${tiers.reduce((s, t) => s + t.payout, 0).toLocaleString()}</span>
            </div>
          </div>
        );
      case 'cpm':
        if (!cpmRate) return null;
        const rate = parseFloat(cpmRate);
        return (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">${rate.toFixed(2)} <span className="text-sm font-normal text-white/50">CPM</span></div>
              <div className="text-xs text-white/40 mt-2">Example: 100K views = ${(rate * 100).toLocaleString()}</div>
            </div>
          </div>
        );
      case 'flat_plus_cpm':
        if (!flatBase || !cpmRateOnTop) return null;
        const base = parseFloat(flatBase);
        const cpmTop = parseFloat(cpmRateOnTop);
        return (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">
              ${base.toLocaleString()} <span className="text-white/40 text-lg">+</span> ${cpmTop.toFixed(2)} <span className="text-sm font-normal text-white/50">CPM</span>
            </div>
            <div className="text-xs text-white/40 mt-2">
              Example at 100K views: ${base.toLocaleString()} + ${(cpmTop * 100).toLocaleString()} = ${(base + cpmTop * 100).toLocaleString()}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#0A0A0A] rounded-2xl shadow-2xl border border-white/10 w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Payment Plan</h2>
            <p className="text-sm text-white/50 mt-0.5">{creator.displayName || creator.email}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white/40" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
            </div>
          ) : (
            <>
              {/* Plan type selector */}
              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Deal Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {PLAN_TYPES.map(pt => (
                    <button
                      key={pt.value}
                      onClick={() => setPlanType(pt.value)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        planType === pt.value
                          ? 'bg-white/10 border-white/30'
                          : 'bg-white/[0.02] border-transparent hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          planType === pt.value ? 'bg-white/15 text-white' : 'bg-white/5 text-white/40'
                        }`}>
                          {pt.icon}
                        </div>
                        <span className={`text-sm font-semibold ${planType === pt.value ? 'text-white' : 'text-white/70'}`}>
                          {pt.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/40 leading-tight ml-9">{pt.example}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan-specific fields */}
              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Details</label>

                {/* ── Flat ── */}
                {planType === 'flat' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-white/50 mb-1.5">Payout Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                        <input
                          type="number"
                          value={flatAmount}
                          onChange={e => setFlatAmount(e.target.value)}
                          placeholder="300"
                          className="w-full pl-7 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 mb-1.5">View Target</label>
                      <input
                        type="number"
                        value={flatViewTarget}
                        onChange={e => setFlatViewTarget(e.target.value)}
                        placeholder="150000"
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                      />
                      {flatViewTarget && (
                        <div className="text-[11px] text-white/30 mt-1">{fmtViews(parseInt(flatViewTarget) || 0)} views</div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Tiered ── */}
                {planType === 'tiered' && (
                  <div className="space-y-3">
                    {tiers.map((tier, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-lg p-3">
                        <GripVertical className="w-4 h-4 text-white/20 flex-shrink-0" />
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] text-white/40 mb-1">Views</label>
                            <input
                              type="number"
                              value={tier.viewThreshold || ''}
                              onChange={e => updateTier(i, { viewThreshold: parseInt(e.target.value) || 0 })}
                              placeholder="50000"
                              className="w-full px-2.5 py-2 bg-white/5 border border-white/10 rounded text-white text-sm placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-white/40 mb-1">Payout ($)</label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 text-xs">$</span>
                              <input
                                type="number"
                                value={tier.payout || ''}
                                onChange={e => updateTier(i, { payout: parseFloat(e.target.value) || 0 })}
                                placeholder="100"
                                className="w-full pl-5 pr-2.5 py-2 bg-white/5 border border-white/10 rounded text-white text-sm placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] text-white/40 mb-1">Label</label>
                            <input
                              type="text"
                              value={tier.label || ''}
                              onChange={e => updateTier(i, { label: e.target.value })}
                              placeholder="Bronze"
                              className="w-full px-2.5 py-2 bg-white/5 border border-white/10 rounded text-white text-sm placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => removeTier(i)}
                          className="p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addTier}
                      className="w-full px-4 py-2.5 bg-white/5 border border-dashed border-white/10 hover:border-white/20 rounded-lg flex items-center justify-center gap-2 text-white/50 hover:text-white text-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Tier
                    </button>
                  </div>
                )}

                {/* ── CPM ── */}
                {planType === 'cpm' && (
                  <div className="max-w-xs">
                    <label className="block text-xs text-white/50 mb-1.5">CPM Rate ($ per 1K views)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={cpmRate}
                        onChange={e => setCpmRate(e.target.value)}
                        placeholder="5.00"
                        className="w-full pl-7 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                      />
                    </div>
                  </div>
                )}

                {/* ── Flat + CPM ── */}
                {planType === 'flat_plus_cpm' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-white/50 mb-1.5">Base Flat Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                        <input
                          type="number"
                          value={flatBase}
                          onChange={e => setFlatBase(e.target.value)}
                          placeholder="200"
                          className="w-full pl-7 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 mb-1.5">CPM Rate ($ per 1K views)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={cpmRateOnTop}
                          onChange={e => setCpmRateOnTop(e.target.value)}
                          placeholder="3.00"
                          className="w-full pl-7 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Preview */}
              {renderPreview() && (
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Preview</label>
                  {renderPreview()}
                </div>
              )}

              {/* Schedule */}
              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Payment Schedule</label>
                <div className="flex flex-wrap gap-2">
                  {SCHEDULES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setSchedule(s.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        schedule === s.value
                          ? 'bg-white/10 border-white/30 text-white'
                          : 'bg-white/[0.02] border-white/5 text-white/40 hover:text-white/60 hover:border-white/10'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {schedule === 'custom' && (
                  <input
                    type="text"
                    value={customSchedule}
                    onChange={e => setCustomSchedule(e.target.value)}
                    placeholder="e.g. Every 2 weeks after video goes live"
                    className="w-full mt-2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                  />
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Notes <span className="font-normal">(optional)</span></label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional terms or notes about this deal..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-6 py-2 flex-shrink-0">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 flex-shrink-0">
          <div>
            {existingPlan && (
              <button
                onClick={handleRemovePlan}
                disabled={saving}
                className="text-xs text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-40"
              >
                Remove plan
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-5 py-2 bg-white text-black text-sm font-bold rounded-full hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Plan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorPaymentPlanModal;
