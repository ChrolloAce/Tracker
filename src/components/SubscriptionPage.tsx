import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { SUBSCRIPTION_PLANS, PlanTier } from '../types/subscription';
import { useAuth } from '../contexts/AuthContext';
import StripeService from '../services/StripeService';
import SubscriptionService from '../services/SubscriptionService';

const SubscriptionPage: React.FC = () => {
  const { currentOrgId } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('basic');
  const [loading, setLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    planTier: PlanTier;
    isActive: boolean;
    isExpired: boolean;
    expiresAt: Date | null;
    daysUntilExpiry: number | null;
    needsRenewal: boolean;
  } | null>(null);

  useEffect(() => {
    loadSubscriptionInfo();
  }, [currentOrgId]);

  const loadSubscriptionInfo = async () => {
    if (!currentOrgId) return;
    try {
      const [tier, status] = await Promise.all([
        SubscriptionService.getPlanTier(currentOrgId),
        SubscriptionService.getSubscriptionStatus(currentOrgId),
      ]);
      setCurrentPlan(tier);
      setSubscriptionStatus(status);
    } catch (error) {
      console.error('Failed to load subscription info:', error);
    }
  };

  const handleSelectPlan = async (planTier: PlanTier) => {
    if (!currentOrgId) return;
    if (planTier === 'enterprise') {
      window.location.href = 'mailto:support@viewtrack.com?subject=Enterprise Plan Inquiry';
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

  const handleManageBilling = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      await StripeService.createPortalSession(currentOrgId);
    } catch (error: any) {
      console.error('Failed to open billing portal:', error);
      alert('Failed to open billing portal. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  // Show Free, Basic, Pro, Ultra for main cards
  const mainPlans = [
    SUBSCRIPTION_PLANS.free,
    SUBSCRIPTION_PLANS.basic,
    SUBSCRIPTION_PLANS.pro,
    SUBSCRIPTION_PLANS.ultra,
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
      {/* Hero Section */}
      <div className="relative pt-12 pb-8 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Manage Billing Button - Show for paid subscribers */}
          {subscriptionStatus && subscriptionStatus.planTier !== 'free' && (
            <div className="mb-6 flex justify-end">
              <button
                onClick={handleManageBilling}
                disabled={loading}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                {loading ? 'Loading...' : 'Manage Billing & Subscription'}
              </button>
            </div>
          )}

          {/* Subscription Status Banner */}
          {subscriptionStatus && subscriptionStatus.needsRenewal && subscriptionStatus.planTier !== 'free' && (
            <div className={`mb-6 rounded-xl border p-4 ${
              subscriptionStatus.isExpired 
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            }`}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {subscriptionStatus.isExpired ? (
                    <span className="text-2xl">⚠️</span>
                  ) : (
                    <span className="text-2xl">⏰</span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold mb-1 ${
                    subscriptionStatus.isExpired 
                      ? 'text-red-900 dark:text-red-200' 
                      : 'text-yellow-900 dark:text-yellow-200'
                  }`}>
                    {subscriptionStatus.isExpired ? 'Subscription Expired' : 'Subscription Expiring Soon'}
                  </h3>
                  <p className={`text-sm ${
                    subscriptionStatus.isExpired 
                      ? 'text-red-700 dark:text-red-300' 
                      : 'text-yellow-700 dark:text-yellow-300'
                  }`}>
                    {subscriptionStatus.isExpired 
                      ? `Your ${subscriptionStatus.planTier.toUpperCase()} plan has expired. Please renew to continue using premium features.`
                      : `Your ${subscriptionStatus.planTier.toUpperCase()} plan expires in ${subscriptionStatus.daysUntilExpiry} day${subscriptionStatus.daysUntilExpiry !== 1 ? 's' : ''}. ${
                          subscriptionStatus.expiresAt 
                            ? `(${subscriptionStatus.expiresAt.toLocaleDateString()})` 
                            : ''
                        }`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
              Simple, transparent pricing
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
              Choose the perfect plan to track your content and grow your reach
            </p>

          {/* Billing Toggle */}
            <div className="inline-flex items-center bg-white dark:bg-[#161616] rounded-full p-1.5 border border-gray-200 dark:border-gray-800 shadow-sm">
            <button
              onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
              }`}
            >
                Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billingCycle === 'yearly'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {mainPlans.map((plan) => {
            const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const isCurrentPlan = currentPlan === plan.id;
            const isRecommended = plan.recommended;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col w-full bg-white dark:bg-[#161616] rounded-xl p-6 border transition-all ${
                  isRecommended
                    ? 'border-blue-500 shadow-xl'
                    : 'border-gray-200 dark:border-gray-800'
                }`}
              >
                {/* Recommended Badge */}
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
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
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  {plan.displayName}
                </h3>

                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                  {plan.description}
                </p>

                {/* Price */}
                <div className="mb-5">
                  {plan.id === 'free' ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        Free
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-gray-900 dark:text-white">
                          ${price}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">/mo</span>
                      </div>
                      {billingCycle === 'yearly' && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          ${(price * 12).toFixed(0)}/year
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loading || isCurrentPlan || plan.id === 'free'}
                  className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all mb-5 ${
                    isCurrentPlan
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                      : plan.id === 'free'
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                      : isRecommended
                      ? 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-300'
                      : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                  }`}
                >
                  {plan.id === 'free' ? 'Current Plan' : isCurrentPlan ? 'Current Plan' : loading ? 'Loading...' : 'Get Started'}
                </button>

                {/* Features */}
                <div className="flex-1 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      <strong>{plan.features.teamSeats}</strong> team {plan.features.teamSeats === 1 ? 'seat' : 'seats'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      <strong>{plan.features.maxAccounts === -1 ? 'Unlimited' : plan.features.maxAccounts}</strong> accounts
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      <strong>{plan.features.maxVideos.toLocaleString()}</strong> videos
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      <strong>{plan.features.dataRefreshHours}h</strong> refresh
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      <strong>{plan.features.mcpCallsPerMonth.toLocaleString()}</strong> API calls
                    </span>
                  </div>
                  {plan.features.refreshOnDemand && (
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-xs text-gray-700 dark:text-gray-300">
                        On-demand refresh
                      </span>
                    </div>
                  )}
                  {plan.features.apiAccess && (
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-xs text-gray-700 dark:text-gray-300">
                        API access
                      </span>
                    </div>
                  )}
                  {plan.features.prioritySupport && (
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-xs text-gray-700 dark:text-gray-300">
                        Priority support
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
