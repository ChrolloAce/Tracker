import React, { useState, useEffect } from 'react';
import { Check, ArrowLeft } from 'lucide-react';
import { SUBSCRIPTION_PLANS, PlanTier } from '../types/subscription';
import { useAuth } from '../contexts/AuthContext';
import StripeService from '../services/StripeService';
import SubscriptionService from '../services/SubscriptionService';
import { useNavigate } from 'react-router-dom';

const SubscriptionPage: React.FC = () => {
  const { currentOrgId } = useAuth();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('basic');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSubscriptionInfo();
  }, [currentOrgId]);

  const loadSubscriptionInfo = async () => {
    if (!currentOrgId) return;
    try {
      console.log('🔍 Loading subscription info for org:', currentOrgId);

      // Check if subscription exists
      const existingSubscription = await SubscriptionService.getSubscription(currentOrgId);

      // If no subscription exists, create default one (free trial)
      if (!existingSubscription) {
        console.log('📝 No subscription found. Creating default free trial...');
        await SubscriptionService.createDefaultSubscription(currentOrgId);
        console.log('✅ Default subscription created');
      }

      const tier = await SubscriptionService.getPlanTier(currentOrgId);
      console.log('✅ Subscription loaded:', { tier });
      setCurrentPlan(tier);
    } catch (error) {
      console.error('❌ Failed to load subscription info:', error);
    }
  };

  const handleSelectPlan = async (planTier: PlanTier) => {
    if (!currentOrgId) return;

    if (planTier === 'enterprise') {
      window.location.href = 'mailto:support@viewtrack.com?subject=Enterprise Plan Inquiry';
      return;
    }

    if (planTier === 'free') {
      alert('To downgrade to the free plan, please go to Settings → Billing and cancel your subscription.');
      return;
    }

    setLoading(true);
    try {
      await StripeService.createCheckoutSession(currentOrgId, planTier, billingCycle);
    } catch (error: any) {
      console.error('Failed to create checkout session:', error);
        alert('Failed to start checkout. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  // Show Basic, Pro, Ultra for main cards (Free plan removed)
  const mainPlans = [
    SUBSCRIPTION_PLANS.basic,
    SUBSCRIPTION_PLANS.pro,
    SUBSCRIPTION_PLANS.ultra,
  ];

  return (
    <div className="min-h-screen bg-surface">
      {/* Header Navigation */}
      <div className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-4 py-2 text-content-muted hover:text-content transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Dashboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative pt-12 pb-8 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center">
            <h1 className="text-4xl font-bold text-content mb-3">
              Simple, transparent pricing
            </h1>
            <p className="text-lg text-content-muted mb-6 max-w-2xl mx-auto">
              Choose the perfect plan to track your content and grow your reach
            </p>

          {/* Billing Toggle */}
            <div className="inline-flex items-center bg-surface-secondary rounded-full p-1.5 border border-border shadow-sm">
            <button
              onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-content-muted'
              }`}
            >
                Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billingCycle === 'yearly'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-content-muted'
                }`}
              >
                Yearly
                <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-semibold">
                  Save 25%
              </span>
            </button>
            </div>
          </div>
          </div>
        </div>

        {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 pt-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {mainPlans.map((plan) => {
            const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const isCurrentPlan = currentPlan === plan.id;
            const isRecommended = plan.recommended;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col w-full bg-surface-secondary rounded-xl p-6 border transition-all ${
                  isRecommended
                    ? 'border-orange-500 shadow-xl'
                    : 'border-border'
                }`}
              >
                {/* Recommended Badge */}
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-green-500 text-white px-2.5 py-0.5 rounded-full text-xs font-semibold">
                      Current
                    </span>
                  </div>
                )}

                {/* Plan Title */}
                <h3 className="text-xl font-bold text-content mb-4">
                  {plan.displayName}
                </h3>

                <p className="text-xs text-content-muted mb-4">
                  {plan.description}
                </p>

                {/* Price */}
                <div className="mb-5">
                  {plan.id === 'free' ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-content">
                        Free
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-content">
                          ${price}
                        </span>
                        <span className="text-sm text-content-muted">/mo</span>
                      </div>
                      {billingCycle === 'yearly' && (
                        <p className="text-xs text-green-500 mt-1">
                          ${(price * 12).toFixed(0)}/year
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loading || isCurrentPlan}
                  data-fast-goal={plan.id !== 'free' ? `pricing_${plan.id}_${billingCycle}` : undefined}
                  data-fast-goal-plan={plan.id}
                  data-fast-goal-billing-cycle={billingCycle}
                  data-fast-goal-price={price}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-all mb-5 ${
                    isCurrentPlan
                      ? 'bg-surface-hover text-content-muted cursor-not-allowed'
                      : isRecommended
                      ? 'bg-orange-500 text-white shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]'
                      : 'bg-surface-hover text-content hover:bg-surface-active border border-border'
                  }`}
                >
                  {isCurrentPlan
                      ? 'Current Plan'
                      : loading
                      ? 'Loading...'
                      : plan.id === 'free'
                      ? 'Free Plan'
                      : currentPlan !== 'free' && currentPlan !== plan.id
                      ? (['free', 'basic', 'pro', 'ultra', 'enterprise'].indexOf(plan.id) >
                         ['free', 'basic', 'pro', 'ultra', 'enterprise'].indexOf(currentPlan)
                          ? 'Upgrade'
                          : 'Downgrade')
                      : 'Select Plan'}
                </button>

                {/* Features */}
                <div className="flex-1 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <span className="text-xs text-content-secondary">
                      <strong>{plan.features.teamSeats}</strong> team {plan.features.teamSeats === 1 ? 'seat' : 'seats'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <span className="text-xs text-content-secondary">
                      <strong>{plan.features.maxAccounts === -1 ? 'Unlimited' : plan.features.maxAccounts}</strong> accounts
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <span className="text-xs text-content-secondary">
                      <strong>{plan.features.maxVideos.toLocaleString()}</strong> videos
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <span className="text-xs text-content-secondary">
                      <strong>{plan.features.dataRefreshHours}h</strong> refresh
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <span className="text-xs text-content-secondary">
                      <strong>{plan.features.mcpCallsPerMonth.toLocaleString()}</strong> API calls
                    </span>
                  </div>
                  {plan.features.refreshOnDemand && (
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <span className="text-xs text-content-secondary">
                        On-demand refresh
                      </span>
                    </div>
                  )}
                  {plan.features.apiAccess && (
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <span className="text-xs text-content-secondary">
                        API access
                      </span>
                    </div>
                  )}
                  {plan.features.prioritySupport && (
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <span className="text-xs text-content-secondary">
                        Priority support
                      </span>
                </div>
                  )}

                  {/* New Features with Coming Soon Badge */}
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <span className="text-xs text-content-secondary flex items-center flex-wrap gap-1">
                      Creator portals
                      <span className="text-[10px] font-bold text-content bg-surface-hover px-1.5 py-0.5 rounded border border-border whitespace-nowrap">Coming Dec 5 2025</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <span className="text-xs text-content-secondary flex items-center flex-wrap gap-1">
                      Contract management
                      <span className="text-[10px] font-bold text-content bg-surface-hover px-1.5 py-0.5 rounded border border-border whitespace-nowrap">Coming Dec 5 2025</span>
                    </span>
                  </div>

                  {(plan.id === 'pro' || plan.id === 'ultra' || plan.id === 'enterprise') && (
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <span className="text-xs text-content-secondary flex items-center flex-wrap gap-1">
                        Creator campaigns
                        <span className="text-[10px] font-bold text-content bg-surface-hover px-1.5 py-0.5 rounded border border-border whitespace-nowrap">Coming Dec 5 2025</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>

    </div>
  );
};

export default SubscriptionPage;
