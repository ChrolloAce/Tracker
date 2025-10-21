import React, { useState, useEffect } from 'react';
import { Check, ArrowLeft, ExternalLink } from 'lucide-react';
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
  const [hasStripeCustomer, setHasStripeCustomer] = useState(false);
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
      console.log('🔍 Loading subscription info for org:', currentOrgId);
      
      // Check if subscription exists
      const existingSubscription = await SubscriptionService.getSubscription(currentOrgId);
      
      // If no subscription exists, create default one (free trial)
      if (!existingSubscription) {
        console.log('📝 No subscription found. Creating default free trial...');
        await SubscriptionService.createDefaultSubscription(currentOrgId);
        console.log('✅ Default subscription created');
      }
      
      const [tier, status] = await Promise.all([
        SubscriptionService.getPlanTier(currentOrgId),
        SubscriptionService.getSubscriptionStatus(currentOrgId),
      ]);
      console.log('✅ Subscription loaded:', { tier, status });
      setCurrentPlan(tier);
      setSubscriptionStatus(status);
      
      // Check if user has Stripe customer
      const subscription = await SubscriptionService.getSubscription(currentOrgId);
      setHasStripeCustomer(!!subscription?.stripeCustomerId);
      console.log('💳 Has Stripe customer:', !!subscription?.stripeCustomerId);
      
      // Log warning if expired
      if (status.isExpired) {
        console.warn('⚠️ Subscription has expired!');
      }
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
      alert('To downgrade to the free plan, please cancel your subscription through the "Manage Billing" portal.');
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
    
    if (!hasStripeCustomer) {
      alert('Please subscribe to a paid plan first to access billing management.');
      return;
    }
    
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
      {/* Header Navigation */}
      <div className="sticky top-0 z-50 bg-gray-50/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Dashboard</span>
            </button>
            
            {hasStripeCustomer && (
              <button
                onClick={handleManageBilling}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Manage Billing
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative pt-12 pb-8 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

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
                  disabled={loading || isCurrentPlan}
                  className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all mb-5 ${
                    isCurrentPlan
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                      : isRecommended
                      ? 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-300'
                      : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                  }`}
                >
                  {isCurrentPlan ? 'Current Plan' : loading ? 'Loading...' : plan.id === 'free' ? 'Free Plan' : 'Select Plan'}
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
