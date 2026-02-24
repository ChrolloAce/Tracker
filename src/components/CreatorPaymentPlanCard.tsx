import React, { useMemo } from 'react';
import { DollarSign, TrendingUp, BarChart3, Layers, CheckCircle2, Clock, Target } from 'lucide-react';
import { CreatorPaymentPlan, PaymentTier } from '../types/firestore';

interface CreatorPaymentPlanCardProps {
  plan: CreatorPaymentPlan;
  totalViews?: number;
  totalVideos?: number;
  paidAmount?: number;
  /** Admin callbacks — if provided, admin action buttons are shown */
  onRecordPayment?: () => void;
  onMarkComplete?: () => void;
  onRenewCampaign?: () => void;
  isAdmin?: boolean;
}

// ─── Formatters ──────────────────────────────────────────────────────
const fmtViews = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return n.toLocaleString();
};

const fmtDollars = (n: number) =>
  n >= 1000
    ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
    : `$${n.toFixed(2)}`;

const fmtPct = (n: number) => `${Math.min(100, Math.max(0, n)).toFixed(1)}%`;

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

// ─── Plan badge (monotone) ──────────────────────────────────────────
const planBadge = (type: string) => {
  const config: Record<string, { label: string; icon: React.ReactNode }> = {
    flat:          { label: 'Flat Rate',  icon: <DollarSign className="w-3.5 h-3.5" /> },
    tiered:        { label: 'Tiered',     icon: <Layers className="w-3.5 h-3.5" /> },
    cpm:           { label: 'CPM',        icon: <BarChart3 className="w-3.5 h-3.5" /> },
    flat_plus_cpm: { label: 'Flat + CPM', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  };
  const c = config[type] || config.flat;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/70 border border-white/10">
      {c.icon}
      {c.label}
    </span>
  );
};

// ─── Tier row (monotone) ────────────────────────────────────────────
const TierRow: React.FC<{ tier: PaymentTier; reached: boolean; current: number }> = ({ tier, reached, current }) => {
  const pct = Math.min(100, tier.viewThreshold > 0 ? (current / tier.viewThreshold) * 100 : 0);

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
      reached ? 'bg-white/[0.06] border-white/15' : 'bg-white/[0.02] border-white/5'
    }`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
        reached ? 'bg-white/15' : 'bg-white/5'
      }`}>
        {reached ? (
          <CheckCircle2 className="w-4 h-4 text-white/70" />
        ) : (
          <Clock className="w-4 h-4 text-white/30" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-sm font-medium ${reached ? 'text-white' : 'text-white/60'}`}>
            {tier.label || `${fmtViews(tier.viewThreshold)} views`}
          </span>
          <span className={`text-sm font-bold ${reached ? 'text-white' : 'text-white/80'}`}>
            {fmtDollars(tier.payout)}
          </span>
        </div>
        {!reached && (
          <>
            <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/30 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[10px] text-white/30 mt-0.5 text-right">{fmtPct(pct)}</div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────
const CreatorPaymentPlanCard: React.FC<CreatorPaymentPlanCardProps> = ({
  plan,
  totalViews = 0,
  totalVideos = 0,
  paidAmount = 0,
  onRecordPayment,
  onMarkComplete,
  onRenewCampaign,
  isAdmin = false,
}) => {
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
      default: return 0;
    }
  }, [plan]);

  // Views target for progress
  const viewsTarget = useMemo(() => {
    switch (plan.type) {
      case 'flat': return plan.flatViewTarget || 0;
      case 'tiered': {
        const sorted = [...(plan.tiers || [])].sort((a, b) => b.viewThreshold - a.viewThreshold);
        return sorted[0]?.viewThreshold || 0;
      }
      default: return 0;
    }
  }, [plan]);

  const viewsPct = viewsTarget > 0 ? Math.min(100, (totalViews / viewsTarget) * 100) : 0;
  const viewsRemaining = Math.max(0, viewsTarget - totalViews);
  const viewsRemainingPct = viewsTarget > 0 ? Math.min(100, (viewsRemaining / viewsTarget) * 100) : 0;

  const pendingAmount = Math.max(0, earnedAmount - paidAmount);
  const paymentTarget = maxPossible > 0 ? maxPossible : earnedAmount;
  const paidPct = paymentTarget > 0 ? Math.min(100, (paidAmount / paymentTarget) * 100) : 0;
  const pendingPct = paymentTarget > 0 ? Math.min(100, (pendingAmount / paymentTarget) * 100) : 0;

  const sched = scheduleLabel(plan);
  const isCompleted = plan.campaignStatus === 'completed';

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Payment Plan</h3>
            {isCompleted && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/50 border border-white/10">
                COMPLETED
              </span>
            )}
          </div>
          {planBadge(plan.type)}
        </div>
        {sched && (
          <p className="text-xs text-white/35 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> {sched}
          </p>
        )}
      </div>

      {/* Earned summary */}
      <div className="px-5 py-4">
        <div className="text-3xl font-bold text-white tracking-tight">{fmtDollars(earnedAmount)}</div>
        <div className="text-xs text-white/35 mt-1">
          {plan.type === 'cpm' || plan.type === 'flat_plus_cpm'
            ? `Earned from ${fmtViews(totalViews)} views across ${totalVideos} video${totalVideos !== 1 ? 's' : ''}`
            : maxPossible > 0
              ? `of ${fmtDollars(maxPossible)} goal \u00b7 ${fmtViews(totalViews)} views`
              : `from ${fmtViews(totalViews)} views`}
        </div>
      </div>

      {/* ── Views Progress Bar ─────────────────────────────────────── */}
      {viewsTarget > 0 && (
        <div className="px-5 py-4 border-t border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <Target className="w-3.5 h-3.5" />
              Views Progress
            </div>
            <span className="text-xs font-semibold text-white/70">{fmtPct(viewsPct)}</span>
          </div>
          <div className="relative h-2.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/25 transition-all duration-700"
              style={{ width: `${viewsPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[11px] text-white/30">
            <span>{fmtViews(totalViews)} views</span>
            <span>{fmtViews(viewsRemaining)} remaining ({fmtPct(viewsRemainingPct)})</span>
          </div>
          <div className="text-[11px] text-white/30 mt-0.5">
            Target: {fmtViews(viewsTarget)}
          </div>
        </div>
      )}

      {/* ── Payment Progress Bar ───────────────────────────────────── */}
      <div className="px-5 py-4 border-t border-white/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <DollarSign className="w-3.5 h-3.5" />
            Payment Progress
          </div>
          <span className="text-xs font-semibold text-white/70">
            {fmtDollars(paidAmount)} paid
          </span>
        </div>

        <div className="relative h-2.5 bg-white/5 rounded-full overflow-hidden">
          {/* Paid */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/40 transition-all duration-700"
            style={{ width: `${paidPct}%` }}
          />
          {/* Pending (lighter, stacked after paid) */}
          <div
            className="absolute inset-y-0 rounded-full bg-white/15 transition-all duration-700"
            style={{ left: `${paidPct}%`, width: `${pendingPct}%` }}
          />
        </div>

        <div className="flex justify-between mt-1.5 text-[11px]">
          <span className="text-white/40">Paid: {fmtDollars(paidAmount)}</span>
          <span className="text-white/30">Pending: {fmtDollars(pendingAmount)}</span>
        </div>
        {maxPossible > 0 && (
          <div className="text-[11px] text-white/25 mt-0.5">
            Goal: {fmtDollars(maxPossible)}
          </div>
        )}
      </div>

      {/* ── Plan details ──────────────────────────────────────────── */}
      <div className="px-5 py-4 border-t border-white/5 space-y-4">
        {/* Flat */}
        {plan.type === 'flat' && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/45">Amount</span>
              <span className="text-white font-semibold">{fmtDollars(plan.flatAmount || 0)} at {fmtViews(plan.flatViewTarget || 0)} views</span>
            </div>
            {totalViews >= (plan.flatViewTarget || 0) && (
              <div className="flex items-center gap-2 p-3 bg-white/[0.06] border border-white/10 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-white/60 flex-shrink-0" />
                <span className="text-sm text-white/70">View target reached</span>
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
              ))}
          </div>
        )}

        {/* CPM */}
        {plan.type === 'cpm' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/45">CPM Rate</span>
              <span className="text-white font-semibold">{fmtDollars(plan.cpmRate || 0)} / 1K</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/45">Total Views</span>
              <span className="text-white">{fmtViews(totalViews)}</span>
            </div>
            <div className="border-t border-white/5 pt-3 flex items-center justify-between text-sm">
              <span className="text-white/45">Earnings</span>
              <span className="text-white/60 text-xs">
                {fmtViews(totalViews)} &divide; 1K &times; {fmtDollars(plan.cpmRate || 0)} ={' '}
                <span className="text-white font-bold">{fmtDollars(earnedAmount)}</span>
              </span>
            </div>
          </div>
        )}

        {/* Flat + CPM */}
        {plan.type === 'flat_plus_cpm' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/45">Base</span>
              <span className="text-white font-semibold">{fmtDollars(plan.flatBase || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/45">CPM</span>
              <span className="text-white font-semibold">{fmtDollars(plan.cpmRateOnTop || 0)} / 1K</span>
            </div>
            <div className="border-t border-white/5 pt-3 flex items-center justify-between text-sm">
              <span className="text-white/45">Total</span>
              <span className="text-white font-bold">
                {fmtDollars(plan.flatBase || 0)} + {fmtDollars((totalViews / 1000) * (plan.cpmRateOnTop || 0))} = {fmtDollars(earnedAmount)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Payment history summary ──────────────────────────────── */}
      {plan.payments && plan.payments.length > 0 && (
        <div className="px-5 py-3 border-t border-white/5">
          <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">
            Payment History ({plan.payments.length})
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {[...plan.payments]
              .sort((a, b) => {
                const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date as any);
                const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date as any);
                return dateB.getTime() - dateA.getTime();
              })
              .map((p, i) => {
                const d = p.date?.toDate ? p.date.toDate() : new Date(p.date as any);
                return (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-white/40">
                      {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <div className="flex items-center gap-2">
                      {p.note && <span className="text-white/25 text-[10px] truncate max-w-[120px]">{p.note}</span>}
                      <span className="text-white/70 font-medium">{fmtDollars(p.amount)}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Notes */}
      {plan.notes && (
        <div className="px-5 py-3 border-t border-white/5">
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
            <div className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1">Notes</div>
            <p className="text-xs text-white/40 leading-relaxed">{plan.notes}</p>
          </div>
        </div>
      )}

      {/* ── Admin Actions ────────────────────────────────────────── */}
      {isAdmin && (
        <div className="px-5 py-4 border-t border-white/5 flex flex-wrap gap-2">
          {!isCompleted && onRecordPayment && (
            <button
              onClick={onRecordPayment}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/15 text-white/70 hover:text-white border border-white/10 transition-all"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Record Payment
            </button>
          )}
          {!isCompleted && onMarkComplete && (
            <button
              onClick={onMarkComplete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/15 text-white/70 hover:text-white border border-white/10 transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Complete
            </button>
          )}
          {isCompleted && onRenewCampaign && (
            <button
              onClick={onRenewCampaign}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/15 text-white/70 hover:text-white border border-white/10 transition-all"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Renew / New Campaign
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CreatorPaymentPlanCard;
