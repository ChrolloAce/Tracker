import React, { useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import StripeService from '../services/StripeService';

interface PaywallOverlayProps {
  isActive: boolean;
}

const PLANS = [
  {
    name: 'Starter',
    monthly: 24,
    yearly: 19,
    desc: 'Perfect for small teams and individual creators getting started.',
    features: ['Unlimited tracked accounts', 'Up to 150 videos', '24-hour data refresh', 'Creator portals', 'Contract management', '2 team seats'],
    planId: 'basic' as const,
    highlighted: false,
  },
  {
    name: 'Pro',
    monthly: 79,
    yearly: 65,
    desc: 'For growing brands scaling their creator campaigns.',
    features: ['Unlimited tracked accounts', 'Up to 1,000 videos', '24-hour data refresh', 'Revenue tracking', 'Creator campaigns', 'Creator portals', 'Contract management', '5 team seats'],
    planId: 'pro' as const,
    highlighted: true,
  },
  {
    name: 'Ultra',
    monthly: 199,
    yearly: 165,
    desc: 'For agencies and large teams with high-volume needs.',
    features: ['Unlimited tracked accounts', 'Up to 5,000 videos', '12-hour data refresh', 'Revenue tracking', 'Creator campaigns', '15 team seats', 'API access', 'Custom integrations'],
    planId: 'ultra' as const,
    highlighted: false,
  },
];

const PaywallOverlay: React.FC<PaywallOverlayProps> = ({ isActive }) => {
  const { currentOrgId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingYearly, setBillingYearly] = useState(false);

  if (!isActive) return null;

  const handleUpgrade = async (plan: 'basic' | 'pro' | 'ultra') => {
    if (!currentOrgId) return;
    setLoading(plan);
    try {
      await StripeService.createCheckoutSession(currentOrgId, plan, billingYearly ? 'yearly' : 'monthly');
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      setLoading(null);
    }
  };

  return (
    <div className="relative z-10 max-w-6xl w-full mx-auto py-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-content mb-2 uppercase tracking-tight">Simple and transparent pricing</h2>
        <p className="text-content-muted text-base">Unlock full access to ViewTrack</p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <span className={`text-sm font-medium ${!billingYearly ? 'text-content' : 'text-content-muted'}`}>Monthly</span>
        <button
          onClick={() => setBillingYearly(!billingYearly)}
          className={`relative w-12 h-7 rounded-full transition-colors ${billingYearly ? 'bg-orange-500' : 'bg-gray-300'}`}
        >
          <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${billingYearly ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm font-medium ${billingYearly ? 'text-content' : 'text-content-muted'}`}>Yearly</span>
        <span className={`text-xs font-bold px-2 py-1 rounded-full transition-opacity ${billingYearly ? 'text-orange-500 bg-orange-50 opacity-100' : 'opacity-0'}`}>20% OFF</span>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl overflow-hidden flex flex-col relative ${
              plan.highlighted
                ? 'bg-orange-500 text-white shadow-xl'
                : 'border border-border bg-surface-secondary'
            }`}
          >
            {plan.highlighted && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-neutral-900 text-white text-[10px] font-semibold uppercase tracking-wider rounded-b-xl z-10">
                Most Popular
              </div>
            )}

            {/* Top area */}
            <div className={`px-8 pt-10 pb-6 ${plan.highlighted ? '' : 'bg-gradient-to-br from-surface-tertiary to-surface-secondary'}`}>
              <h3 className={`text-lg font-semibold mb-3 ${plan.highlighted ? 'text-white' : 'text-content'}`}>{plan.name}</h3>
              <p className={`text-xs mb-1 ${plan.highlighted ? 'text-orange-200' : 'text-content-muted'}`}>Starts at</p>
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className={`text-5xl font-bold ${plan.highlighted ? 'text-white' : 'text-content'}`}>
                  ${billingYearly ? plan.yearly : plan.monthly}
                </span>
                <span className={`text-sm ${plan.highlighted ? 'text-orange-200' : 'text-content-muted'}`}>/month</span>
              </div>
              <p className={`text-sm leading-relaxed ${plan.highlighted ? 'text-orange-100' : 'text-content-muted'}`}>{plan.desc}</p>
              <p className={`text-xs mt-2 ${plan.highlighted ? 'text-orange-200' : 'text-content-muted'}`}>
                {billingYearly ? `Billed annually at $${(billingYearly ? plan.yearly : plan.monthly) * 12}` : 'Billed monthly'}
              </p>
            </div>

            {/* CTA */}
            <div className="px-8 py-5">
              <button
                onClick={() => handleUpgrade(plan.planId)}
                disabled={loading !== null}
                className={`w-full py-3.5 font-semibold rounded-xl text-sm transition-all disabled:opacity-50 ${
                  plan.highlighted
                    ? 'bg-white text-orange-600 shadow-[0_4px_0_0_#e5e5e5] hover:shadow-[0_2px_0_0_#e5e5e5] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]'
                    : 'bg-orange-500 text-white shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]'
                }`}
              >
                {loading === plan.planId ? 'Loading...' : 'Get Started'}
                {loading !== plan.planId && <ArrowRight className="w-4 h-4 inline ml-1" />}
              </button>
            </div>

            {/* Features */}
            <div className="px-8 pb-8">
              <div className={`border-t pt-5 mb-4 ${plan.highlighted ? 'border-orange-400/30' : 'border-border'}`}>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-4 ${plan.highlighted ? 'text-orange-200' : 'text-content-muted'}`}>
                  What's included
                </p>
              </div>
              <ul className="space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className={`flex items-center gap-2.5 text-sm ${plan.highlighted ? 'text-white' : 'text-content-secondary'}`}>
                    <Check className={`w-4 h-4 flex-shrink-0 ${plan.highlighted ? 'text-white' : 'text-orange-500'}`} />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Settings Link */}
      <div className="text-center mt-8">
        <button
          onClick={() => navigate('/settings/billing')}
          className="text-content-muted hover:text-content transition-colors text-sm"
        >
          View billing settings →
        </button>
      </div>
    </div>
  );
};

export default PaywallOverlay;
