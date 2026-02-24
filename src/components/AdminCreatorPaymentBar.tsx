import React, { useMemo } from 'react';
import { CreatorPaymentPlan } from '../types/firestore';

interface AdminCreatorPaymentBarProps {
  plan: CreatorPaymentPlan;
  totalViews: number;
  paidAmount?: number;
}

const fmtDollars = (n: number) =>
  n >= 1000
    ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `$${n.toFixed(0)}`;

const fmtViews = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

/**
 * Compact admin-side payment progress bar shown inline in the creators table.
 * Monotone styling to match the app theme.
 */
const AdminCreatorPaymentBar: React.FC<AdminCreatorPaymentBarProps> = ({
  plan,
  totalViews,
  paidAmount = 0,
}) => {
  const earned = useMemo(() => {
    switch (plan.type) {
      case 'flat':
        return totalViews >= (plan.flatViewTarget || 0) ? (plan.flatAmount || 0) : 0;
      case 'tiered': {
        const sorted = [...(plan.tiers || [])].sort((a, b) => a.viewThreshold - b.viewThreshold);
        return sorted.reduce(
          (sum, tier) => sum + (totalViews >= tier.viewThreshold ? tier.payout : 0),
          0
        );
      }
      case 'cpm':
        return (totalViews / 1000) * (plan.cpmRate || 0);
      case 'flat_plus_cpm':
        return (plan.flatBase || 0) + (totalViews / 1000) * (plan.cpmRateOnTop || 0);
      default:
        return 0;
    }
  }, [plan, totalViews]);

  // Use payments array if available, otherwise fall back to paidAmount
  const actualPaid = useMemo(() => {
    if (plan.payments && plan.payments.length > 0) {
      return plan.payments.reduce((s, p) => s + p.amount, 0);
    }
    return paidAmount;
  }, [plan.payments, paidAmount]);

  const maxTarget = useMemo(() => {
    switch (plan.type) {
      case 'flat':
        return plan.flatAmount || 0;
      case 'tiered':
        return (plan.tiers || []).reduce((s, t) => s + t.payout, 0);
      default:
        return 0;
    }
  }, [plan]);

  const total = Math.max(earned, maxTarget, 1);
  const paidPct = Math.min(100, (actualPaid / total) * 100);
  const pending = Math.max(0, earned - actualPaid);
  const pendingPct = Math.min(100, (pending / total) * 100);

  return (
    <div className="w-full min-w-[180px] max-w-[260px]">
      {/* Top row: amounts */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-white/60">{fmtDollars(actualPaid)}</span>
        <span className="text-xs font-semibold text-white/30">{fmtDollars(pending)}</span>
      </div>

      {/* Bar */}
      <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
        {/* Paid */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/40 transition-all duration-500"
          style={{ width: `${paidPct}%` }}
        />
        {/* Pending */}
        <div
          className="absolute inset-y-0 rounded-full bg-white/15 transition-all duration-500"
          style={{ left: `${paidPct}%`, width: `${pendingPct}%` }}
        />
      </div>

      {/* Bottom row: labels */}
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[10px] text-white/35">Paid</span>
        <span className="text-[10px] text-white/25">Pending</span>
      </div>

      {/* Views context */}
      <div className="text-[10px] text-white/20 mt-0.5">
        {fmtViews(totalViews)} views &middot; Earned {fmtDollars(earned)}
      </div>
    </div>
  );
};

export default AdminCreatorPaymentBar;
