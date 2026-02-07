import React, { useMemo } from 'react';
import { DollarSign, TrendingUp, BarChart3, Layers, CheckCircle2, Clock } from 'lucide-react';
import { CreatorPaymentPlan, PaymentTier } from '../types/firestore';

interface CreatorPaymentPlanCardProps {
  plan: CreatorPaymentPlan;
  totalViews?: number;   // Creator's current total views across all videos
  totalVideos?: number;  // Number of videos
}

// ─── Formatters ──────────────────────────────────────────────────────
const fmtViews = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return n.toLocaleString();
};

const fmtDollars = (n: number) =>
  n >= 1000 ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : `$${n.toFixed(2)}`;

// ─── Schedule label ──────────────────────────────────────────────────
const scheduleLabel = (plan: CreatorPaymentPlan) => {
  if (!plan.schedule) return null;
  const map: Record<string, string> = {
    weekly: 'Paid weekly',
    'bi-weekly': 'Paid bi-weekly',
    monthly: 'Paid monthly',
    'per-video': 'Paid per video',
    custom: plan.customSchedule || 'Custom schedule',
  };
  return map[plan.schedule] || null;
};

// ─── Plan badge ──────────────────────────────────────────────────────
const planBadge = (type: string) => {
  const config: Record<string, { label: string; icon: React.ReactNode; gradient: string }> = {
    flat:          { label: 'Flat Rate',   icon: <DollarSign className="w-3.5 h-3.5" />, gradient: 'from-emerald-500/20 to-emerald-600/10' },
    tiered:        { label: 'Tiered',      icon: <Layers className="w-3.5 h-3.5" />,     gradient: 'from-blue-500/20 to-blue-600/10' },
    cpm:           { label: 'CPM',         icon: <BarChart3 className="w-3.5 h-3.5" />,  gradient: 'from-violet-500/20 to-violet-600/10' },
    flat_plus_cpm: { label: 'Flat + CPM',  icon: <TrendingUp className="w-3.5 h-3.5" />, gradient: 'from-amber-500/20 to-amber-600/10' },
  };
  const c = config[type] || config.flat;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${c.gradient} text-white/80 border border-white/10`}>
      {c.icon}
      {c.label}
    </span>
  );
};

// ─── Progress bar ────────────────────────────────────────────────────
const ProgressBar: React.FC<{ current: number; target: number; label?: string }> = ({ current, target, label }) => {
  const pct = Math.min(100, target > 0 ? (current / target) * 100 : 0);
  const reached = current >= target;

  return (
    <div>
      {label && <div className="text-[11px] text-white/40 mb-1">{label}</div>}
      <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
            reached ? 'bg-emerald-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[11px] text-white/40">{fmtViews(current)} views</span>
        <span className="text-[11px] text-white/40">{fmtViews(target)}</span>
      </div>
    </div>
  );
};

// ─── Tier row ────────────────────────────────────────────────────────
const TierRow: React.FC<{ tier: PaymentTier; reached: boolean; current: number }> = ({ tier, reached, current }) => {
  const pct = Math.min(100, tier.viewThreshold > 0 ? (current / tier.viewThreshold) * 100 : 0);

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
      reached ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/[0.02] border-white/5'
    }`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
        reached ? 'bg-emerald-500/20' : 'bg-white/5'
      }`}>
        {reached ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : (
          <Clock className="w-4 h-4 text-white/30" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-sm font-medium ${reached ? 'text-emerald-300' : 'text-white/70'}`}>
            {tier.label || `${fmtViews(tier.viewThreshold)} views`}
          </span>
          <span className={`text-sm font-bold ${reached ? 'text-emerald-300' : 'text-white'}`}>
            {fmtDollars(tier.payout)}
          </span>
        </div>
        {!tier.label && null}
        {!reached && (
          <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────
const CreatorPaymentPlanCard: React.FC<CreatorPaymentPlanCardProps> = ({ plan, totalViews = 0, totalVideos = 0 }) => {
  const earnedAmount = useMemo(() => {
    switch (plan.type) {
      case 'flat':
        return totalViews >= (plan.flatViewTarget || 0) ? (plan.flatAmount || 0) : 0;
      case 'tiered': {
        const sorted = [...(plan.tiers || [])].sort((a, b) => a.viewThreshold - b.viewThreshold);
        return sorted.reduce((sum, tier) => sum + (totalViews >= tier.viewThreshold ? tier.payout : 0), 0);
      }
      case 'cpm':
        return (totalViews / 1000) * (plan.cpmRate || 0);
      case 'flat_plus_cpm':
        return (plan.flatBase || 0) + (totalViews / 1000) * (plan.cpmRateOnTop || 0);
      default:
        return 0;
    }
  }, [plan, totalViews]);

  const maxPossible = useMemo(() => {
    switch (plan.type) {
      case 'flat': return plan.flatAmount || 0;
      case 'tiered': return (plan.tiers || []).reduce((s, t) => s + t.payout, 0);
      default: return 0; // CPM has no max
    }
  }, [plan]);

  const sched = scheduleLabel(plan);

  return (
    <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-white">Your Payment Plan</h3>
          {planBadge(plan.type)}
        </div>
        {sched && (
          <p className="text-xs text-white/40 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> {sched}
          </p>
        )}
      </div>

      {/* Earnings summary */}
      <div className="px-5 py-4 bg-white/[0.02]">
        <div className="text-3xl font-bold text-white tracking-tight">{fmtDollars(earnedAmount)}</div>
        <div className="text-xs text-white/40 mt-1">
          {plan.type === 'cpm' || plan.type === 'flat_plus_cpm'
            ? `Earned from ${fmtViews(totalViews)} views across ${totalVideos} video${totalVideos !== 1 ? 's' : ''}`
            : maxPossible > 0
              ? `of ${fmtDollars(maxPossible)} max • ${fmtViews(totalViews)} views`
              : `from ${fmtViews(totalViews)} views`
          }
        </div>
      </div>

      {/* Plan details */}
      <div className="px-5 py-4 space-y-4">
        {/* Flat */}
        {plan.type === 'flat' && (
          <>
            <ProgressBar
              current={totalViews}
              target={plan.flatViewTarget || 0}
              label={`${fmtDollars(plan.flatAmount || 0)} at ${fmtViews(plan.flatViewTarget || 0)} views`}
            />
            {totalViews >= (plan.flatViewTarget || 0) && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-sm text-emerald-300">Target reached! 🎉</span>
              </div>
            )}
          </>
        )}

        {/* Tiered */}
        {plan.type === 'tiered' && plan.tiers && (
          <div className="space-y-2">
            {[...plan.tiers]
              .sort((a, b) => a.viewThreshold - b.viewThreshold)
              .map((tier, i) => (
                <TierRow key={i} tier={tier} reached={totalViews >= tier.viewThreshold} current={totalViews} />
              ))
            }
          </div>
        )}

        {/* CPM */}
        {plan.type === 'cpm' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">CPM Rate</span>
              <span className="text-white font-semibold">{fmtDollars(plan.cpmRate || 0)} per 1K views</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Total Views</span>
              <span className="text-white font-medium">{fmtViews(totalViews)}</span>
            </div>
            <div className="border-t border-white/5 pt-3 flex items-center justify-between text-sm">
              <span className="text-white/50">Calculation</span>
              <span className="text-white/60 text-xs">
                {fmtViews(totalViews)} ÷ 1,000 × {fmtDollars(plan.cpmRate || 0)} = <span className="text-white font-bold">{fmtDollars(earnedAmount)}</span>
              </span>
            </div>
          </div>
        )}

        {/* Flat + CPM */}
        {plan.type === 'flat_plus_cpm' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Base Amount</span>
              <span className="text-white font-semibold">{fmtDollars(plan.flatBase || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">CPM Rate</span>
              <span className="text-white font-semibold">{fmtDollars(plan.cpmRateOnTop || 0)} per 1K views</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Views Bonus</span>
              <span className="text-white/60 text-xs">
                {fmtViews(totalViews)} ÷ 1,000 × {fmtDollars(plan.cpmRateOnTop || 0)} = {fmtDollars((totalViews / 1000) * (plan.cpmRateOnTop || 0))}
              </span>
            </div>
            <div className="border-t border-white/5 pt-3 flex items-center justify-between text-sm">
              <span className="text-white/50">Total</span>
              <span className="text-white font-bold">
                {fmtDollars(plan.flatBase || 0)} + {fmtDollars((totalViews / 1000) * (plan.cpmRateOnTop || 0))} = {fmtDollars(earnedAmount)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      {plan.notes && (
        <div className="px-5 pb-4">
          <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
            <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1">Notes</div>
            <p className="text-xs text-white/50 leading-relaxed">{plan.notes}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorPaymentPlanCard;
